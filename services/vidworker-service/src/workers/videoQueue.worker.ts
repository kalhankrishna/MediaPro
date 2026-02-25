import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { videoQueueProcessor } from '../processors/videoQueue.processor.js';
import { QUEUES } from '@mediapro/queue';

export const videoWorker = new Worker(QUEUES.VIDEO_PROCESSING, videoQueueProcessor, {
  connection: redisConnection,
  concurrency: 1,
  lockDuration: 30_000,
  stalledInterval: 15_000,
  maxStalledCount: 2,
});

videoWorker.on('completed', (job, returnValue) => {
  console.log(`[${job.id}] completed`, returnValue);
});

videoWorker.on('failed', (job, err) => {
  console.error(`[${job?.id}] failed: ${err.message}`);
});

videoWorker.on('error', (err) => {
  console.error('Worker error:', err);
});