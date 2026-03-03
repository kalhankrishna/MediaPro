import { embeddingWorker } from '../workers/embeddingQueue.worker.js';
import { pool } from '../processors/embeddingQueue.processor.js';
import { redisConnection } from '../config/redis.js';

console.log('Embedding worker started, waiting for jobs...');

async function shutdown() {
  console.log('Shutting down embedding worker...');
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  await embeddingWorker.close();
  await pool.end();
  await redisConnection.quit();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);