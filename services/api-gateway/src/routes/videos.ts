import { Router } from "express";
import { createVideo, getVideo, listUserVideos } from '../lib/vidMetadataService.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3, S3_BUCKET } from '../lib/s3Client.js';
import { videoQueue } from "../lib/queue.js";
import { asyncHandler } from '../lib/asyncHandler.js';
import { createVideoSchema, uploadUrlSchema, userIdQuerySchema, videoIdParamSchema } from '../schemas/videos.schema.js';

const router = Router();

// GET /videos?userId={userId}
router.get('/', asyncHandler(async (req, res) => {
    const { userId } = userIdQuerySchema.parse(req.query);
    const { videos } = await listUserVideos({ userId: userId as string });
    res.json({ videos });
}));

// GET /videos/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const { videoId } = videoIdParamSchema.parse(req.params);
    const { video } = await getVideo({ videoId });
    res.json(video);
}));

// POST /videos
router.post('/', asyncHandler(async (req, res) => {
    const { userId, title, originalResolution, duration } = createVideoSchema.parse(req.body);
    const { videoId } = await createVideo({ userId, title, originalResolution, duration });
    res.status(201).json({ videoId });
}));

// POST /videos/:videoId/upload-url
router.post('/:videoId/upload-url', asyncHandler(async (req, res) => {
    const { videoId } = videoIdParamSchema.parse(req.params);
    const { contentType } = uploadUrlSchema.parse(req.body);

    const key = `raw/${videoId}/raw.mp4`;

    const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        ContentType: contentType,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.json({ url, key });
}));

// POST /videos/:videoId/confirm
router.post('/:videoId/confirm', asyncHandler(async (req, res) => {
    const { videoId } = videoIdParamSchema.parse(req.params);

    await videoQueue.add('process', {
        videoId,
        // rawS3Key: `raw/${videoId}/raw.mp4`,
        rawS3Key: 'raw/test-123/test-speech.mp4',
    });

    res.status(202).json({ message: 'Processing started' });
}));

export default router;