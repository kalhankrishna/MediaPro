import http from 'node:http';
import type { Redis } from 'ioredis';
import { logger } from './logger.js';

export function startHealthServer(redis: Redis, port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      try {
        await redis.ping();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (err) {
        logger.error({ err }, 'health check: redis ping failed');
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', reason: 'redis unavailable' }));
      }
      return;
    }
    res.writeHead(404).end();
  });

  server.listen(port, () => {
    logger.info({ port }, 'health server listening');
  });

  return server;
}
