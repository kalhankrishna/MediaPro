import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import type * as grpc from '@grpc/grpc-js';

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
  console.log(`\n${signal} received, starting graceful shutdown...`);
  
  let shutdownComplete = false;

  // Force shutdown after 10 seconds
  const forceShutdownTimer = setTimeout(() => {
    if (!shutdownComplete) {
      console.error('Graceful shutdown timeout, forcing shutdown');
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
                    console.error('gRPC server shutdown error:', err);
                    if(grpcServer) grpcServer.forceShutdown();
                    reject(err);
                } else {
                    console.log('gRPC server shut down successfully');
                    resolve();
                }
            });
        }
        else{
            console.warn('No gRPC server instance found to shut down');
            resolve();
        }
    });

    shutdownComplete = true;
    clearTimeout(forceShutdownTimer);
    console.log('Graceful shutdown complete');
    process.exit(0);
  }
  catch (error) {
    console.error('Error during shutdown:', error);
    clearTimeout(forceShutdownTimer);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));