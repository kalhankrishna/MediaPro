export const QUEUES = {
  VIDEO_PROCESSING: 'video-processing',
} as const;

export interface VideoProcessingJob {
  videoId: string;
  rawS3Key: string;
}