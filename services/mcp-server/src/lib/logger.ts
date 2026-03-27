import pino from 'pino';

export const logger = pino({
  name: 'mcp-server',
  level: process.env.LOG_LEVEL ?? 'info',
});
