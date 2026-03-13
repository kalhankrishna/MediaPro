import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GatewayClient } from '../lib/gatewayClient.js';

export function registerConfirmUploadTool(server: McpServer, gateway: GatewayClient) {
  server.registerTool(
    'confirm_upload',
    {
      title: 'Confirm Upload',
      description: 'Confirm that a video file has been uploaded to S3 and start the processing pipeline.',
      inputSchema: {
        videoId: z.string().uuid().describe('The video ID returned from upload_video'),
      },
    },
    async ({ videoId }) => {
      const result = await gateway.confirmUpload(videoId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}