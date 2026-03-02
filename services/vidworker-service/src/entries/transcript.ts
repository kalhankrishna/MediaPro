import { execSync } from 'child_process';
import { transcriptWorker } from '../workers/transcriptQueue.worker.js';
import { redisConnection } from '../config/redis.js';

// Fail fast before registering with BullMQ
try {
  execSync('ffmpeg -version', { stdio: 'ignore', env: process.env });
} catch {
  throw new Error('ffmpeg not found. Install via: winget install ffmpeg (Windows) or apt install ffmpeg (Linux)');
}

console.log('Transcript worker started, waiting for jobs...');

async function shutdown() {
  console.log('Shutting down transcript worker...');
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  await transcriptWorker.close();
  await redisConnection.quit();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);