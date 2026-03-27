import { rateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { Redis } from 'ioredis';

if (!process.env.REDIS_URL) throw new Error('REDIS_URL is not defined');

const parsed = new URL(process.env.REDIS_URL);
const isTLS = parsed.protocol === 'rediss:';

// Separate connection from BullMQ — rate-limit-redis must NOT use maxRetriesPerRequest: null
const redisClient = new Redis({
  host: parsed.hostname,
  port: Number(parsed.port) || 6379,
  password: parsed.password || undefined,
  username: parsed.username || undefined,
  ...(isTLS && { tls: { rejectUnauthorized: false } }),
});

function makeStore(prefix: string): RedisStore {
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      redisClient.call(args[0], ...args.slice(1)) as Promise<RedisReply>,
    prefix,
  });
}

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: makeStore('rl:general:'),
  // /auth has its own stricter limiter — exclude it from the general bucket
  skip: (req) => req.path.startsWith('/auth'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: makeStore('rl:auth:'),
});

export const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: makeStore('rl:search:'),
});
