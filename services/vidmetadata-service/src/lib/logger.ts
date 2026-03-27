import pino from 'pino';

export const logger = pino({
  name: 'vidmetadata-service',
  level: process.env.LOG_LEVEL ?? 'info',
});
