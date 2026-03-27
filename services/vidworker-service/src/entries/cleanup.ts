import { Queue } from 'bullmq';
import { createOrphanCleanupWorker } from '../workers/orphanCleanup.worker.js';
import { redisConnection } from '../config/redis.js';
import { QUEUES, type VideoProcessingJob, type OrphanCleanupJob } from '@mediapro/queue';
import { logger } from '../lib/logger.js';
import { startHealthServer } from '../lib/health.js';

const videoQueue = new Queue<VideoProcessingJob>(QUEUES.VIDEO_PROCESSING, { connection: redisConnection });
const scheduler = new Queue<OrphanCleanupJob>(QUEUES.ORPHAN_CLEANUP, { connection: redisConnection });
const orphanCleanupWorker = createOrphanCleanupWorker(videoQueue);

await scheduler.upsertJobScheduler(
  'orphan-cleanup-repeat',
  { every: 15 * 60 * 1000 }, // every 15 minutes
  { name: 'cleanup' },
);

const healthServer = startHealthServer(redisConnection);
logger.info('orphan cleanup worker started');

async function shutdown() {
  logger.info('shutting down orphan cleanup worker');
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  await new Promise<void>((resolve, reject) => healthServer.close((err) => (err ? reject(err) : resolve())));
  await orphanCleanupWorker.close();
  await scheduler.close();
  await videoQueue.close();
  await redisConnection.quit();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
