import { Worker, Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { createOrphanCleanupProcessor } from '../processors/orphanCleanup.processor.js';
import { QUEUES, type VideoProcessingJob } from '@mediapro/queue';

export function createOrphanCleanupWorker(videoQueue: Queue<VideoProcessingJob>) {
  const worker = new Worker(
    QUEUES.ORPHAN_CLEANUP,
    createOrphanCleanupProcessor(videoQueue),
    {
      connection: redisConnection,
      concurrency: 1,
      lockDuration: 30_000,
      stalledInterval: 15_000,
      maxStalledCount: 2,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[${job.id}] orphan cleanup completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[${job?.id}] orphan cleanup failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('Orphan cleanup worker error:', err);
  });

  return worker;
}
