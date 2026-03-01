import { promisify } from 'util';
import { vidMetadataClient } from './grpcClient.js';
import { UpdateVideoStatusRequest, CreateVideoFileRequest, CreateTranscriptRequest } from '@mediapro/proto';

export const updateVideoStatus = promisify(
  vidMetadataClient.updateVideoStatus.bind(vidMetadataClient)
) as (req: UpdateVideoStatusRequest) => Promise<void>;

export const createVideoFile = promisify(
  vidMetadataClient.createVideoFile.bind(vidMetadataClient)
) as (req: CreateVideoFileRequest) => Promise<{ fileId: string }>;

export const createTranscript = promisify(
  vidMetadataClient.createTranscript.bind(vidMetadataClient)
) as (req: CreateTranscriptRequest) => Promise<{ transcriptId: string }>;