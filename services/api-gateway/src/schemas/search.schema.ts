import { z } from 'zod';

export const searchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query must be at most 500 characters'),
});