import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { embeddingQueueProcessor } from '../processors/embeddingQueue.processor.js';
import { QUEUES } from '@mediapro/queue';
import { logger } from '../lib/logger.js';

export const embeddingWorker = new Worker(QUEUES.EMBEDDING, embeddingQueueProcessor, {
  connection: redisConnection,
  concurrency: 1,
  lockDuration: 30_000,
  stalledInterval: 15_000,
  maxStalledCount: 2,
});

embeddingWorker.on('completed', (job, returnValue) => {
  logger.info({ jobId: job.id, returnValue }, 'job completed');
});

embeddingWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'job failed');
});

embeddingWorker.on('error', (err) => {
  logger.error({ err }, 'worker error');
});
