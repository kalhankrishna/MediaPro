import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { gateway } from '../lib/gatewayClient.js';

export function registerListVideosTool(server: McpServer) {
  server.registerTool(
    'list_videos',
    {
      title: 'List Videos',
      description: 'List all videos for a given user.',
      inputSchema: {
        userId: z.string().min(1).describe('The user ID'),
      },
    },
    async ({ userId }) => {
      const result = await gateway.listVideos(userId);
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