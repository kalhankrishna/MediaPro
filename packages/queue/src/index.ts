export const QUEUES = {
  VIDEO_PROCESSING: 'video-processing',
  TRANSCRIPTION: 'transcription',
  EMBEDDING: 'embedding',
  ORPHAN_CLEANUP: 'orphan-cleanup',
} as const;

export interface VideoProcessingJob {
  videoId: string;
  rawS3Key: string;
}

export interface TranscriptionJob {
  videoId: string;
  processedS3Key: string;
}

export interface EmbeddingJob {
  videoId: string;
  transcriptId: string;
  transcriptText: string;
}

export interface OrphanCleanupJob {}