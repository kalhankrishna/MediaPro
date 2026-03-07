import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { gateway } from '../lib/gatewayClient.js';

export function registerGetVideoTool(server: McpServer) {
  server.registerTool(
    'get_video',
    {
      title: 'Get Video',
      description: 'Get metadata for a specific video by its ID.',
      inputSchema: {
        videoId: z.string().uuid().describe('The video ID'),
      },
    },
    async ({ videoId }) => {
      const video = await gateway.getVideo(videoId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(video, null, 2),
          },
        ],
      };
    }
  );
}