import { prisma } from "../lib/prisma.js";
import type { VidMetadataServer } from '@mediapro/proto';

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
      callback(err as Error, null);
    }
  },
  updateVideoStatus: (call, callback) => {
    try{

    }
    catch(err){
      callback(err as Error, null);
    }
  },
  getVideo: (call, callback) => {
    try{

    }
    catch(err){
      callback(err as Error, null);
    }
  },
  listUserVideos: (call, callback) => {
    try{

    }
    catch(err){
      callback(err as Error, null);
    }
  },
  createVideoFile: (call, callback) => {
    try{

    }
    catch(err){
      callback(err as Error, null);
    }
  },
};