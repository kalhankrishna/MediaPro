import { videoWorker } from "./workers/videoQueue.worker.js";
import { redisConnection } from "./config/redis.js";

console.log('Video worker started, waiting for jobs...');

async function shutdown() {
  console.log('Shutting down worker...');
  
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  
  await videoWorker.close();
  await redisConnection.quit();
  
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);