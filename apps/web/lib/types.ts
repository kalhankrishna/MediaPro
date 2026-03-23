export interface VideoFile {
  id: string;
  s3Key: string;
  fileSize: number;
  format: number;
  createdAt: string;
}

export interface Video {
  id: string;
  userId: string;
  title: string;
  status: number;
  originalResolution: string;
  duration: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  files: VideoFile[];
}
