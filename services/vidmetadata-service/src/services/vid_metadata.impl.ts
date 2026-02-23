import { status as GrpcStatus } from "@grpc/grpc-js";
import type { VidMetadataServer } from '@mediapro/proto';
import { prisma } from "../lib/prisma.js";
import { mapVideoStatusToPrisma, mapFileFormatToPrisma, mapVideoStatusToProto, mapFileFormatToProto } from '../lib/enumMappers.js';

export const vidMetadataHandlers: VidMetadataServer = {
  createVideo: async (call, callback) => {
    try{
      const { userId, title, originalResolution, duration } = call.request;

      const video = await prisma.video.create({
        data: {
          userId,
          title,
          originalResolution,
          duration,
        },
      });

      callback(null, { videoId: video.id });
    }
    catch(err){
      callback({
        code: GrpcStatus.INTERNAL,
        message: (err as Error).message,
      }, null);
    }
  },

  updateVideoStatus: async (call, callback) => {
    try{
      const { videoId, status, errorMessage } = call.request;
      const mappedStatus = mapVideoStatusToPrisma(status);

      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: mappedStatus,
          errorMessage: errorMessage || null,
          ...(mappedStatus === 'COMPLETED' && { completedAt: new Date() }),
        }
      });

      callback(null, { success: true });
    }
    catch(err){
      callback({
        code: GrpcStatus.INTERNAL,
        message: (err as Error).message,
      }, null);
    }
  },

  getVideo: async (call, callback) => {
    try{
      const { videoId } = call.request;

      const video = await prisma.video.findUnique({
        where: { id: videoId },
        include: { files: true },
      });

      if (!video) {
        return callback({
          code: GrpcStatus.NOT_FOUND,
          message: `Video ${videoId} not found`,
        }, null);
      }

      callback(null, {
        video: {
          id: video.id,
          userId: video.userId,
          title: video.title,
          originalResolution: video.originalResolution,
          duration: video.duration,
          status: mapVideoStatusToProto(video.status),
          errorMessage: video.errorMessage || undefined,
          createdAt: video.createdAt,
          updatedAt: video.updatedAt,
          completedAt: video.completedAt || undefined,
          files: video.files.map(file => ({
            id: file.id,
            s3Key: file.s3Key,
            fileSize: file.fileSize,
            format: mapFileFormatToProto(file.format),
            createdAt: file.createdAt,
          })),
        }
      });
    }
    catch(err){
      callback({
        code: GrpcStatus.INTERNAL,
        message: (err as Error).message,
      }, null);
    }
  },

  listUserVideos: async (call, callback) => {
    try{
      const { userId } = call.request;

      const videos = await prisma.video.findMany({
        where: { userId },
        include: { files: true },
        orderBy: { createdAt: 'desc' },
      });

      callback(null, {
        videos: videos.map(video => ({
          id: video.id,
          userId: video.userId,
          title: video.title,
          errorMessage: video.errorMessage || undefined,
          originalResolution: video.originalResolution,
          duration: video.duration,
          status: mapVideoStatusToProto(video.status),
          createdAt: video.createdAt,
          updatedAt: video.updatedAt,
          completedAt: video.completedAt || undefined,
          files: video.files.map(file => ({
            id: file.id,
            s3Key: file.s3Key,
            fileSize: file.fileSize,
            format: mapFileFormatToProto(file.format),
            createdAt: file.createdAt,
          })),
        }))
      });
    }
    catch(err){
      callback({
        code: GrpcStatus.INTERNAL,
        message: (err as Error).message,
      }, null);
    }
  },

  createVideoFile: async (call, callback) => {
    try{
      const { videoId, format, s3Key, fileSize } = call.request;
    
      const file = await prisma.videoFile.create({
        data: {
          videoId,
          format: mapFileFormatToPrisma(format),
          s3Key,
          fileSize,
        },
      });
      
      callback(null, { fileId: file.id });
    }
    catch(err){
      callback({
        code: GrpcStatus.INTERNAL,
        message: (err as Error).message,
      }, null);
    }
  },
};