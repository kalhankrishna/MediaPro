import { Job, Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";
import os from 'node:os';
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "../lib/s3Client.js";
import { createTranscript, updateVideoStatus } from "../lib/vidMetadataService.js";
import { type TranscriptionJob, QUEUES, type EmbeddingJob } from "@mediapro/queue";
import Groq from "groq-sdk";
import { VideoStatus } from "@mediapro/proto";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const embeddingQueue = new Queue<EmbeddingJob>(QUEUES.EMBEDDING, {
  connection: redisConnection,
});

const TEMP_DIR = path.join(os.tmpdir(), 'mediapro');

function extractAudio(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const args = [
            '-i', inputPath,
            '-vn',
            '-c:a', 'libmp3lame',
            '-b:a', '128k',
            '-y',
            outputPath,
        ];

        const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });

        const timeout = setTimeout(() => {
            proc.kill('SIGKILL');
            reject(new Error('ffmpeg timed out extracting audio'));
        }, 10 * 60 * 1000);

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

        proc.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

export async function transcriptQueueProcessor(job: Job<TranscriptionJob>) {
    const { videoId, processedS3Key } = job.data;

    if (!job.id) throw new Error('Job ID is required for processing');

    const jobTempDir = path.join(TEMP_DIR, job.id);
    const videoPath = path.join(jobTempDir, 'video.mp4');
    const audioPath = path.join(jobTempDir, 'audio.mp3');

    await mkdir(jobTempDir, { recursive: true });

    try{
        await job.updateProgress(5);

        console.log(`[${job.id}] Downloading ${processedS3Key} from S3...`);
        const s3Object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: processedS3Key }));
        await pipeline(s3Object.Body as Readable, createWriteStream(videoPath));
        await job.updateProgress(20);

        console.log(`[${job.id}] Extracting audio...`);
        await extractAudio(videoPath, audioPath);
        await job.updateProgress(40);

        console.log(`[${job.id}] Transcribing via Groq Whisper...`);
        const transcription = await groq.audio.transcriptions.create({
            file: createReadStream(audioPath),
            model: 'whisper-large-v3',
            response_format: 'text',
            // language: 'en',
        });
        await job.updateProgress(70);

        const content = typeof transcription === 'string' ? transcription : transcription.text;

        console.log(`[${job.id}] Saving transcript...`);
        const { transcriptId } = await createTranscript({ videoId, content });
        await job.updateProgress(85);

        await embeddingQueue.add(
            'embed', 
            {
                videoId,
                transcriptId,
                transcriptText: content,
            },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            },
        );

        await job.updateProgress(100);
        console.log(`[${job.id}] Transcription complete.`);
    }
    catch(err){
        console.error(`[${job.id}] Transcription failed:`, err);
        await updateVideoStatus({ videoId, status: VideoStatus.VIDEO_STATUS_FAILED, errorMessage: err instanceof Error ? err.message : 'Unknown error' });
        throw err;
    }
    finally{
        await rm(jobTempDir, { recursive: true, force: true });
    }
}