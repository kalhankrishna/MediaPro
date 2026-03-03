import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { embeddingQueueProcessor } from '../processors/embeddingQueue.processor.js';
import { QUEUES } from '@mediapro/queue';

export const embeddingWorker = new Worker(QUEUES.EMBEDDING, embeddingQueueProcessor, {
  connection: redisConnection,
  concurrency: 1,
  lockDuration: 30_000,
  stalledInterval: 15_000,
  maxStalledCount: 2,
});

embeddingWorker.on('completed', (job, returnValue) => {
  console.log(`[${job.id}] completed`, returnValue);
});

embeddingWorker.on('failed', (job, err) => {
  console.error(`[${job?.id}] failed: ${err.message}`);
});

embeddingWorker.on('error', (err) => {
  console.error('Worker error:', err);
});