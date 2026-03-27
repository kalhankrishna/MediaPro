import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import type * as grpc from '@grpc/grpc-js';
import { logger } from './logger.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const globalForPrisma = global as unknown as {prisma: PrismaClient};

export const prisma = globalForPrisma.prisma || new PrismaClient({ 
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    adapter 
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Track gRPC server for graceful shutdown
let grpcServer: grpc.Server | null = null;

export function registerGrpcServer(server: grpc.Server) {
  grpcServer = server;
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'starting graceful shutdown');

  let shutdownComplete = false;

  // Force shutdown after 10 seconds
  const forceShutdownTimer = setTimeout(() => {
    if (!shutdownComplete) {
      logger.error('graceful shutdown timeout, forcing shutdown');
      if (grpcServer) grpcServer.forceShutdown();
      process.exit(1);
    }
  }, 10000);

  try {
    // Stop accepting new gRPC requests
    await new Promise<void>((resolve, reject) => {
        if(grpcServer){
            grpcServer.tryShutdown((err) => {
                if (err) {
                    logger.error({ err }, 'gRPC server shutdown error');
                    if(grpcServer) grpcServer.forceShutdown();
                    reject(err);
                } else {
                    logger.info('gRPC server shut down successfully');
                    resolve();
                }
            });
        }
        else{
            logger.warn('no gRPC server instance found to shut down');
            resolve();
        }
    });

    shutdownComplete = true;
    clearTimeout(forceShutdownTimer);
    logger.info('graceful shutdown complete');
    process.exit(0);
  }
  catch (error) {
    logger.error({ err: error }, 'error during shutdown');
    clearTimeout(forceShutdownTimer);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));