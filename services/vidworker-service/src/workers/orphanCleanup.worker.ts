import { Worker, Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { createOrphanCleanupProcessor } from '../processors/orphanCleanup.processor.js';
import { QUEUES, type VideoProcessingJob } from '@mediapro/queue';
import { logger } from '../lib/logger.js';

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
    logger.info({ jobId: job.id }, 'orphan cleanup job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'orphan cleanup job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'orphan cleanup worker error');
  });

  return worker;
}
