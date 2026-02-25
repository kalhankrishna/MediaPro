import { Job } from 'bullmq';
import { type VideoProcessingJob } from '@mediapro/queue';

export async function videoQueueProcessor(job: Job<VideoProcessingJob>): Promise<void> {
  console.log(`Processing job ${job.id}`, job.data);
}