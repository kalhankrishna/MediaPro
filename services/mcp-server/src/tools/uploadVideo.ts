import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GatewayClient } from '../lib/gatewayClient.js';

export function registerUploadVideoTool(server: McpServer, gateway: GatewayClient) {
  server.registerTool(
    'upload_video',
    {
      title: 'Upload Video',
      description: 'Create a video record and get a presigned S3 URL to upload a video file directly.',
      inputSchema: {
        title: z.string().min(1).describe('Video title'),
        originalResolution: z.string().describe('e.g. 1920x1080'),
        duration: z.number().int().positive().describe('Duration in seconds'),
        contentType: z.string().default('video/mp4').describe('MIME type of the video file'),
      },
    },
    async ({ title, originalResolution, duration, contentType }) => {
      const { videoId } = await gateway.createVideo({ title, originalResolution, duration });
      const { url, key } = await gateway.getUploadUrl(videoId, contentType);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              videoId,
              uploadUrl: url,
              s3Key: key,
              instructions: 'PUT your video file directly to uploadUrl with the correct Content-Type header. Then call confirm_upload with the videoId to start processing.',
            }, null, 2),
          },
        ],
      };
    }
  );
}