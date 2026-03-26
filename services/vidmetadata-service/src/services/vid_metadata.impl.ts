import { status as GrpcStatus } from "@grpc/grpc-js";
import type { VidMetadataServer } from '@mediapro/proto';
import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
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
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await prisma.videoFile.findUnique({
          where: { videoId_format: { videoId: call.request.videoId, format: mapFileFormatToPrisma(call.request.format) } },
          select: { id: true },
        });

        if (existing) {
          callback(null, { fileId: existing.id });
          return;
        }
      }

      callback({
        code: GrpcStatus.INTERNAL,
        message: (err as Error).message,
      }, null);
    }
  },

  createTranscript: async (call, callback) => {
    try {
      const { videoId, content, segmentsJson } = call.request;

      const transcript = await prisma.videoTranscript.create({
        data: { videoId, content, segmentsJson },
      });

      callback(null, { transcriptId: transcript.id });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await prisma.videoTranscript.findUnique({
          where: { videoId: call.request.videoId },
          select: { id: true },
        });
        if (existing) {
          callback(null, { transcriptId: existing.id });
          return;
        }
      }
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },

  getTranscript: async (call, callback) => {
    try {
      const { videoId } = call.request;

      const transcript = await prisma.videoTranscript.findUnique({
        where: { videoId },
      });

      if (!transcript) {
        return callback({
          code: GrpcStatus.NOT_FOUND,
          message: `Transcript for video ${videoId} not found`,
        }, null);
      }

      callback(null, {
        transcript: {
          id: transcript.id,
          videoId: transcript.videoId,
          content: transcript.content,
          segmentsJson: transcript.segmentsJson,
          createdAt: transcript.createdAt,
        },
      });
    } catch (err) {
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },

  upsertUser: async (call, callback) => {
    try {
      const { email, name, avatarUrl, provider, providerAccountId } = call.request;

      const user = await prisma.user.upsert({
        where: {
          provider_providerAccountId: { provider, providerAccountId },
        },
        create: {
          email,
          name: name ?? null,
          avatarUrl: avatarUrl ?? null,
          provider,
          providerAccountId,
        },
        update: {
          email,
          name: name ?? undefined,
          avatarUrl: avatarUrl ?? undefined,
        },
      });

      callback(null, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          avatarUrl: user.avatarUrl ?? undefined,
          provider: user.provider,
          providerAccountId: user.providerAccountId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (err) {
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },

  getUserById: async (call, callback) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: call.request.userId },
      });

      if (!user) {
        return callback({ code: GrpcStatus.NOT_FOUND, message: 'User not found' }, null);
      }

      callback(null, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          avatarUrl: user.avatarUrl ?? undefined,
          provider: user.provider,
          providerAccountId: user.providerAccountId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (err) {
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },

  createRefreshToken: async (call, callback) => {
    try {
      const { userId, tokenHash, expiresAt } = call.request;

      const token = await prisma.refreshToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt: expiresAt!,
        },
      });

      callback(null, { tokenId: token.id });
    } catch (err) {
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },

  getRefreshTokenByHash: async (call, callback) => {
    try {
      const token = await prisma.refreshToken.findUnique({
        where: { tokenHash: call.request.tokenHash },
      });

      if (!token) {
        return callback({ code: GrpcStatus.NOT_FOUND, message: 'Token not found' }, null);
      }

      callback(null, {
        tokenId: token.id,
        userId: token.userId,
        expiresAt: token.expiresAt,
      });
    } catch (err) {
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },

  deleteRefreshToken: async (call, callback) => {
    try {
      await prisma.refreshToken.delete({
        where: { tokenHash: call.request.tokenHash },
      });

      callback(null, { success: true });
    } catch (err) {
      if ((err as any).code === 'P2025') {
        return callback(null, { success: false });
      }
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },

  deleteAllUserRefreshTokens: async (call, callback) => {
    try {
      const result = await prisma.refreshToken.deleteMany({
        where: { userId: call.request.userId },
      });

      callback(null, { deletedCount: result.count });
    } catch (err) {
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },

  createApiKey: async (call, callback) => {
    try {
      const { userId, name, keyHash } = call.request;

      const apiKey = await prisma.apiKey.create({
        data: { userId, name, keyHash },
      });

      callback(null, { keyId: apiKey.id });
    } catch (err) {
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },

  listUserApiKeys: async (call, callback) => {
    try {
      const keys = await prisma.apiKey.findMany({
        where: { userId: call.request.userId },
        select: { id: true, name: true, createdAt: true, lastUsedAt: true },
        orderBy: { createdAt: 'desc' },
      });

      callback(null, {
        keys: keys.map(k => ({
          id: k.id,
          name: k.name,
          createdAt: k.createdAt,
          lastUsedAt: k.lastUsedAt ?? undefined,
        })),
      });
    } catch (err) {
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },

  revokeApiKey: async (call, callback) => {
    try {
      const { keyId, userId } = call.request;

      const deleted = await prisma.apiKey.deleteMany({
        where: { id: keyId, userId },
      });

      callback(null, { success: deleted.count > 0 });
    } catch (err) {
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },

  getApiKeyByHash: async (call, callback) => {
    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash: call.request.keyHash },
      });

      if (!apiKey) {
        return callback({ code: GrpcStatus.NOT_FOUND, message: 'API key not found' }, null);
      }

      // Update lastUsedAt — fire and forget
      prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});

      callback(null, { keyId: apiKey.id, userId: apiKey.userId });
    } catch (err) {
      callback({ code: GrpcStatus.INTERNAL, message: (err as Error).message }, null);
    }
  },
};