import { promisify } from 'util';
import { grpcClient } from './grpcClient.js';
import type {
  CreateVideoRequest,
  CreateVideoResponse,
  GetVideoRequest,
  GetVideoResponse,
  ListUserVideosRequest,
  ListUserVideosResponse,
} from '@mediapro/proto';

export const createVideo = promisify(
  grpcClient.createVideo.bind(grpcClient)
) as (req: CreateVideoRequest) => Promise<CreateVideoResponse>;

export const getVideo = promisify(
  grpcClient.getVideo.bind(grpcClient)
) as (req: GetVideoRequest) => Promise<GetVideoResponse>;

export const listUserVideos = promisify(
  grpcClient.listUserVideos.bind(grpcClient)
) as (req: ListUserVideosRequest) => Promise<ListUserVideosResponse>;