import { Redis } from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not defined");
}

const parsed = new URL(process.env.REDIS_URL);
const isTLS = parsed.protocol === "rediss:";

export const redisConnection = new Redis({
  host: parsed.hostname,
  port: Number(parsed.port) || 6379,
  password: parsed.password || undefined,
  username: parsed.username || undefined,
  maxRetriesPerRequest: null,
  ...(isTLS && { tls: { rejectUnauthorized: false } }),
});