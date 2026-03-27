import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { transcriptQueueProcessor } from '../processors/transcriptionQueue.processor.js';
import { QUEUES } from '@mediapro/queue';
import { logger } from '../lib/logger.js';

export const transcriptWorker = new Worker(QUEUES.TRANSCRIPTION, transcriptQueueProcessor, {
  connection: redisConnection,
  concurrency: 1,
  lockDuration: 30_000,
  stalledInterval: 15_000,
  maxStalledCount: 2,
});

transcriptWorker.on('completed', (job, returnValue) => {
  logger.info({ jobId: job.id, returnValue }, 'job completed');
});

transcriptWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'job failed');
});

transcriptWorker.on('error', (err) => {
  logger.error({ err }, 'worker error');
});
