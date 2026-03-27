import { execSync } from 'child_process';
import { transcriptWorker } from '../workers/transcriptQueue.worker.js';
import { redisConnection } from '../config/redis.js';
import { logger } from '../lib/logger.js';
import { startHealthServer } from '../lib/health.js';

// Fail fast before registering with BullMQ
try {
  execSync('ffmpeg -version', { stdio: 'ignore', env: process.env });
} catch {
  throw new Error('ffmpeg not found. Install via: winget install ffmpeg (Windows) or apt install ffmpeg (Linux)');
}

const healthServer = startHealthServer(redisConnection);
logger.info('transcript worker started, waiting for jobs');

async function shutdown() {
  logger.info('shutting down transcript worker');
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  await new Promise<void>((resolve, reject) => healthServer.close((err) => (err ? reject(err) : resolve())));
  await transcriptWorker.close();
  await redisConnection.quit();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
