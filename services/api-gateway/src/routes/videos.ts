import { Router } from "express";
import { createVideo, getVideo, listUserVideos, getTranscript } from '../lib/vidMetadataService.js';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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

// GET /videos/:videoId
router.get('/:videoId', asyncHandler(async (req, res) => {
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

// GET /videos/:videoId/stream-url?key=<s3key>
// Generates a short-lived presigned GET URL. The key must be scoped to this
// video (raw/{id}/…, processed/{id}/…, or assets/{id}/…) to prevent
// cross-video access.
router.get('/:videoId/stream-url', asyncHandler(async (req, res) => {
    const { videoId } = videoIdParamSchema.parse(req.params);
    const key = req.query.key as string | undefined;

    if (!key) {
        res.status(400).json({ error: 'Missing key query parameter' });
        return;
    }

    const allowedPrefixes = [`raw/${videoId}/`, `processed/${videoId}/`, `assets/${videoId}/`];
    if (!allowedPrefixes.some(prefix => key.startsWith(prefix))) {
        res.status(403).json({ error: 'Key does not belong to this video' });
        return;
    }

    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ url });
}));

// GET /videos/:videoId/transcript
router.get('/:videoId/transcript', asyncHandler(async (req, res) => {
    const { videoId } = videoIdParamSchema.parse(req.params);
    try {
        const { transcript } = await getTranscript({ videoId });
        if (!transcript) {
            res.status(404).json({ error: 'Transcript not found' });
            return;
        }
        res.json({ content: transcript.content, segmentsJson: transcript.segmentsJson, createdAt: transcript.createdAt });
    } catch (err: unknown) {
        // gRPC NOT_FOUND (code 5) — transcript does not exist yet
        if ((err as { code?: number })?.code === 5) {
            res.status(404).json({ error: 'Transcript not found' });
            return;
        }
        throw err;
    }
}));

// POST /videos/:videoId/confirm
router.post('/:videoId/confirm', asyncHandler(async (req, res) => {
    const { videoId } = videoIdParamSchema.parse(req.params);

    await videoQueue.add('process', {
        videoId,
        rawS3Key: `raw/${videoId}/raw.mp4`,
    });

    res.status(202).json({ message: 'Processing started' });
}));

export default router;
