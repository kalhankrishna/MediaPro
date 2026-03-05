import grpc from '@grpc/grpc-js';
import { VidMetadataClient } from '@mediapro/proto';

if (!process.env.VIDMETADATA_SERVICE_URL) throw new Error('VIDMETADATA_SERVICE_URL is not defined');

export const grpcClient = new VidMetadataClient(
  process.env.VIDMETADATA_SERVICE_URL,
  grpc.credentials.createInsecure()
);