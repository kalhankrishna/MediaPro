import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { videoQueueProcessor } from '../processors/videoQueue.processor.js';
import { QUEUES } from '@mediapro/queue';
import { logger } from '../lib/logger.js';

export const videoWorker = new Worker(QUEUES.VIDEO_PROCESSING, videoQueueProcessor, {
  connection: redisConnection,
  concurrency: 1,
  lockDuration: 30_000,
  stalledInterval: 15_000,
  maxStalledCount: 2,
});

videoWorker.on('completed', (job, returnValue) => {
  logger.info({ jobId: job.id, returnValue }, 'job completed');
});

videoWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'job failed');
});

videoWorker.on('error', (err) => {
  logger.error({ err }, 'worker error');
});
