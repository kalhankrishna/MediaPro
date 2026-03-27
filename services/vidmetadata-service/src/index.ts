import 'dotenv/config';
import * as grpc from '@grpc/grpc-js';
import { createServer } from './server.js';
import { registerGrpcServer } from './lib/prisma.js';
import { logger } from './lib/logger.js';

const PORT = process.env.GRPC_PORT ?? '50051';

const server = createServer();
registerGrpcServer(server);

server.bindAsync(
  `0.0.0.0:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) {
      logger.error({ err }, 'failed to bind gRPC server');
      process.exit(1);
    }
    logger.info({ port }, 'vidmetadata-service gRPC server listening');
  }
);