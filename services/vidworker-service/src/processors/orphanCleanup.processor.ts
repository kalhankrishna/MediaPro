import { Job, Queue } from 'bullmq';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { s3, S3_BUCKET } from '../lib/s3Client.js';
import { listVideosByStatus, updateVideoStatus } from '../lib/vidMetadataService.js';
import { VideoStatus } from '@mediapro/proto';
import { type VideoProcessingJob } from '@mediapro/queue';

const ORPHAN_THRESHOLD_MS = 45 * 60 * 1000;

export function createOrphanCleanupProcessor(videoQueue: Queue<VideoProcessingJob>) {
  return async function orphanCleanupProcessor(_job: Job): Promise<void> {
    const cutoff = new Date(Date.now() - ORPHAN_THRESHOLD_MS);

    const { videos } = await listVideosByStatus({
      status: VideoStatus.VIDEO_STATUS_UPLOADED,
      createdBefore: cutoff,
    });

    if (videos.length === 0) {
      console.log('[orphan-cleanup] No orphaned videos found.');
      return;
    }

    console.log(`[orphan-cleanup] Found ${videos.length} candidate(s).`);

    for (const video of videos) {
      const rawKey = `raw/${video.id}/raw.mp4`;

      let fileExists = false;
      try {
        await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: rawKey }));
        fileExists = true;
      } catch (err: unknown) {
        const name = (err as { name?: string }).name;
        if (name === 'NotFound' || name === 'NoSuchKey') {
          fileExists = false;
        } else {
          throw err;
        }
      }

      if (fileExists) {
        console.log(`[orphan-cleanup] ${video.id}: file in S3, re-enqueuing.`);
        await videoQueue.add(
          'process',
          { videoId: video.id, rawS3Key: rawKey },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );
      } else {
        console.log(`[orphan-cleanup] ${video.id}: no S3 file, marking FAILED.`);
        await updateVideoStatus({
          videoId: video.id,
          status: VideoStatus.VIDEO_STATUS_FAILED,
          errorMessage: 'Upload never completed — marked failed by orphan cleanup.',
        });
      }
    }
  };
}
