import { Queue } from 'bullmq';
import { createOrphanCleanupWorker } from '../workers/orphanCleanup.worker.js';
import { redisConnection } from '../config/redis.js';
import { QUEUES, type VideoProcessingJob, type OrphanCleanupJob } from '@mediapro/queue';

const videoQueue = new Queue<VideoProcessingJob>(QUEUES.VIDEO_PROCESSING, { connection: redisConnection });
const scheduler = new Queue<OrphanCleanupJob>(QUEUES.ORPHAN_CLEANUP, { connection: redisConnection });
const orphanCleanupWorker = createOrphanCleanupWorker(videoQueue);

await scheduler.upsertJobScheduler(
  'orphan-cleanup-repeat',
  { every: 15 * 60 * 1000 }, // every 15 minutes
  { name: 'cleanup' },
);

console.log('Orphan cleanup worker started.');

async function shutdown() {
  console.log('Shutting down orphan cleanup worker...');
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  await orphanCleanupWorker.close();
  await scheduler.close();
  await videoQueue.close();
  await redisConnection.quit();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
