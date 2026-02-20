import * as grpc from '@grpc/grpc-js';
import { VidMetadataService } from '@mediapro/proto';
import { vidMetadataHandlers } from './services/vid_metadata.impl.js';

export function createServer(): grpc.Server {
    const server = new grpc.Server();
    server.addService(VidMetadataService, vidMetadataHandlers);
    return server;
}