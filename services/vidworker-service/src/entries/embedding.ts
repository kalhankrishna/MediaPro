import { embeddingWorker } from '../workers/embeddingQueue.worker.js';
import { pool } from '../processors/embeddingQueue.processor.js';
import { redisConnection } from '../config/redis.js';
import { logger } from '../lib/logger.js';
import { startHealthServer } from '../lib/health.js';

const port = Number(process.env.EMBEDDING_WORKER_HEALTH_PORT ?? '9102');

const healthServer = startHealthServer(redisConnection, port);
logger.info('embedding worker started, waiting for jobs');

async function shutdown() {
  logger.info('shutting down embedding worker');
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  await new Promise<void>((resolve, reject) => healthServer.close((err) => (err ? reject(err) : resolve())));
  await embeddingWorker.close();
  await pool.end();
  await redisConnection.quit();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
