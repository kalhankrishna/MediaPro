import * as grpc from '@grpc/grpc-js';
import { createServer } from './server.js';

const PORT = process.env.GRPC_PORT ?? '50051';

const server = createServer();

server.bindAsync(
  `0.0.0.0:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) {
      console.error('Failed to bind server:', err);
      process.exit(1);
    }
    console.log(`metadata-service gRPC server listening on port ${port}`);
  }
);