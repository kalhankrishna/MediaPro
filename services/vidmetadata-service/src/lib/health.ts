import { HealthImplementation } from 'grpc-health-check';
import type * as grpc from '@grpc/grpc-js';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

const SERVICE_NAME = 'vidmetadata.VidMetadata';
const PROBE_INTERVAL_MS = 15_000;

export function createHealthService(server: grpc.Server): HealthImplementation {
  const health = new HealthImplementation({
    '': 'SERVING',
    [SERVICE_NAME]: 'SERVING',
  });

  health.addToServer(server);

  const probe = async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.setStatus('', 'SERVING');
      health.setStatus(SERVICE_NAME, 'SERVING');
    } catch (err) {
      logger.error({ err }, 'db health probe failed — marking service NOT_SERVING');
      health.setStatus('', 'NOT_SERVING');
      health.setStatus(SERVICE_NAME, 'NOT_SERVING');
    }
  };

  setInterval(probe, PROBE_INTERVAL_MS).unref();

  return health;
}
