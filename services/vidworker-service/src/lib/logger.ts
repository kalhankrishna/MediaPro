import pino from 'pino';

export const logger = pino({
  name: 'vidworker-service',
  level: process.env.LOG_LEVEL ?? 'info',
});
