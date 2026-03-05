import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUES, type VideoProcessingJob } from '@mediapro/queue';

if (!process.env.REDIS_URL) throw new Error('REDIS_URL is not defined');

const parsed = new URL(process.env.REDIS_URL);
const isTLS = parsed.protocol === 'rediss:';

const redisConnection = new Redis({
  host: parsed.hostname,
  port: Number(parsed.port) || 6379,
  password: parsed.password || undefined,
  username: parsed.username || undefined,
  maxRetriesPerRequest: null,
  ...(isTLS && { tls: { rejectUnauthorized: false } }),
});

export const videoQueue = new Queue<VideoProcessingJob>(QUEUES.VIDEO_PROCESSING, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});