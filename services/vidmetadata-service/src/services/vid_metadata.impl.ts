import type { VidMetadataServer } from '@mediapro/proto';

export const vidMetadataHandlers: VidMetadataServer = {
  createVideo: (call, callback) => {
    try{
      
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