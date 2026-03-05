import { z } from 'zod';

export const createVideoSchema = z.object({
  userId: z.string().min(1, 'Invalid user ID'),
  title: z.string().min(1, 'Title is required'),
  originalResolution: z.string().min(1, 'Original resolution is required'),
  duration: z.number().int().positive('Duration must be a positive integer'),
});

export const uploadUrlSchema = z.object({
  contentType: z.string().min(1, 'Content type is required'),
});

export const userIdQuerySchema = z.object({
  userId: z.string().min(1, 'Invalid user ID'),
});

export const videoIdParamSchema = z.object({
  videoId: z.uuid('Invalid video ID'),
});