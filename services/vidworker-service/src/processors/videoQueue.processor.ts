import { Job, Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { s3, S3_BUCKET } from '../lib/s3Client.js';
import { updateVideoStatus, createVideoFile } from '../lib/vidMetadataService.js';
import { type VideoProcessingJob, QUEUES } from '@mediapro/queue';
import { VideoStatus, FileFormat } from '@mediapro/proto';

const transcriptQueue = new Queue(QUEUES.TRANSCRIPTION, {
  connection: redisConnection,
});

const TEMP_DIR = path.join(os.tmpdir(), 'mediapro');

const RESOLUTIONS = [
  { name: '480p',  height: 480,  format: FileFormat.FILE_FORMAT_480P  },
  { name: '720p',  height: 720,  format: FileFormat.FILE_FORMAT_720P  },
  { name: '1080p', height: 1080, format: FileFormat.FILE_FORMAT_1080P },
] as const;

function transcode(inputPath: string, outputPath: string, height: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-vf', `scale=-2:${height}`,
      '-c:v', 'libx264',
      '-crf', '23',
      '-preset', 'fast',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ]

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`ffmpeg timed out transcoding to ${height}p`));
    }, 15 * 60 * 1000);

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 50_000) stderr = stderr.slice(-50_000);
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });

    proc.on('error', (err)=> {
      clearTimeout(timeout);
      reject(err);
    })
  });
}

function extractPosterFrame(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-ss', '00:00:05',
      '-i', inputPath,
      '-vframes', '1',
      '-q:v', '2',
      '-y', outputPath,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffmpeg frame extraction timed out'));
    }, 60_000);

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 50_000) stderr = stderr.slice(-50_000);
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg frame extraction exited with code ${code}: ${stderr.slice(-500)}`));
    });

    proc.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

export async function videoQueueProcessor(job: Job<VideoProcessingJob>): Promise<void> {
  const { videoId, rawS3Key } = job.data;

  let jobTempDir: string | null = null;

  if(job.id){
    jobTempDir = path.join(TEMP_DIR, job.id);
  }
  else{
    throw new Error('Job ID is required for processing');
  }

  const rawFilePath = path.join(jobTempDir, 'raw.mp4');

  await mkdir(jobTempDir, { recursive: true });

  try{
    await updateVideoStatus({ videoId, status: VideoStatus.VIDEO_STATUS_PROCESSING });
    await job.updateProgress(5);

    // Check if already processed
    const alreadyProcessed = await Promise.all(
      RESOLUTIONS.map(async (resolution) => {
        const s3Key = `processed/${videoId}/${resolution.name}.mp4`;
        try {
          await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
          return true;
        } catch {
          return false;
        }
      })
    );

    if (alreadyProcessed.every(Boolean)) {
      console.log(`[${job.id}] All resolutions already processed, skipping transcode.`);
      const processed720pKey = `processed/${videoId}/720p.mp4`;
      await transcriptQueue.add('transcribe', { videoId, processedS3Key: processed720pKey });
      await job.updateProgress(100);
      return;
    }

    console.log(`[${job.id}] Downloading ${rawS3Key} from S3...`);
    const s3Object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: rawS3Key }));
    await pipeline(s3Object.Body as Readable, createWriteStream(rawFilePath));

    await job.updateProgress(15);

    let processed720pKey: string | null = null;

    for (const resolution of RESOLUTIONS) {
      const outputPath = path.join(jobTempDir, `${resolution.name}.mp4`);
      const s3Key = `processed/${videoId}/${resolution.name}.mp4`;

      console.log(`[${job.id}] Transcoding to ${resolution.name}...`);
      await transcode(rawFilePath, outputPath, resolution.height);

      const { size } = await stat(outputPath);

      console.log(`[${job.id}] Uploading ${resolution.name} to S3...`);
      
      await new Upload({
        client: s3,
        params: {
          Bucket: S3_BUCKET,
          Key: s3Key,
          Body: createReadStream(outputPath),
          ContentType: 'video/mp4',
        },
      }).done();

      await createVideoFile({ videoId, s3Key, fileSize: BigInt(size), format: resolution.format });

      await rm(outputPath, { force: true });


      if (resolution.name === '720p') processed720pKey = s3Key;

      const progressMap = { '480p': 40, '720p': 65, '1080p': 85 };
      await job.updateProgress(progressMap[resolution.name]);
    }

    const posterFramePath = path.join(jobTempDir, 'poster-frame.jpg');
    await extractPosterFrame(rawFilePath, posterFramePath);

    await new Upload({
      client: s3,
      params: {
        Bucket: S3_BUCKET,
        Key: `assets/${videoId}/poster-frame.jpg`,
        Body: createReadStream(posterFramePath),
        ContentType: 'image/jpeg',
      },
    }).done();
    await job.updateProgress(90);
    console.log(`[${job.id}] Poster frame uploaded: assets/${videoId}/poster-frame.jpg`);

    if(processed720pKey){
      await transcriptQueue.add(
        'transcribe', 
        {
          videoId,
          processedS3Key: processed720pKey,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
    }

    await job.updateProgress(100);
    console.log(`[${job.id}] Video processing complete.`);
  }
  catch(err){
    await updateVideoStatus({ videoId, status: VideoStatus.VIDEO_STATUS_FAILED, errorMessage: err instanceof Error ? err.message : 'Unknown error' });
    console.error(`[${job.id}] Error processing video:`, err);
    throw err;
  }
  finally{
    await rm(jobTempDir, { recursive: true, force: true });
  }
}