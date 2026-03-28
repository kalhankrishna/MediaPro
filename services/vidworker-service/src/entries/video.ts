import { execSync } from 'child_process';
import { videoWorker } from '../workers/videoQueue.worker.js';
import { redisConnection } from '../config/redis.js';
import { logger } from '../lib/logger.js';
import { startHealthServer } from '../lib/health.js';

// Fail fast before registering with BullMQ
try {
  execSync('ffmpeg -version', { stdio: 'ignore', env: process.env });
} catch {
  throw new Error('ffmpeg not found. Install via: winget install ffmpeg (Windows) or apt install ffmpeg (Linux)');
}

const port = Number(process.env.VID_WORKER_HEALTH_PORT ?? '9100');

const healthServer = startHealthServer(redisConnection, port);
logger.info('video worker started, waiting for jobs');

async function shutdown() {
  logger.info('shutting down video worker');
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  await new Promise<void>((resolve, reject) => healthServer.close((err) => (err ? reject(err) : resolve())));
  await videoWorker.close();
  await redisConnection.quit();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
