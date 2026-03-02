import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { transcriptQueueProcessor } from '../processors/transcriptionQueue.processor.js';
import { QUEUES } from '@mediapro/queue';

export const transcriptWorker = new Worker(QUEUES.TRANSCRIPTION, transcriptQueueProcessor, {
  connection: redisConnection,
  concurrency: 1,
  lockDuration: 30_000,
  stalledInterval: 15_000,
  maxStalledCount: 2,
});

transcriptWorker.on('completed', (job, returnValue) => {
  console.log(`[${job.id}] completed`, returnValue);
});

transcriptWorker.on('failed', (job, err) => {
  console.error(`[${job?.id}] failed: ${err.message}`);
});

transcriptWorker.on('error', (err) => {
  console.error('Worker error:', err);
});