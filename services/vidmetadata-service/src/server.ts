import * as grpc from '@grpc/grpc-js';
import { VidMetadataService } from '@mediapro/proto';
import { vidMetadataHandlers } from './services/vid_metadata.impl.js';
import { createHealthService } from './lib/health.js';

export function createServer(): grpc.Server {
    const server = new grpc.Server();
    server.addService(VidMetadataService, vidMetadataHandlers);
    createHealthService(server);
    return server;
}