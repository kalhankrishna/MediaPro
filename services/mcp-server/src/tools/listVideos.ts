import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GatewayClient } from '../lib/gatewayClient.js';

export function registerListVideosTool(server: McpServer, gateway: GatewayClient) {
  server.registerTool(
    'list_videos',
    {
      title: 'List Videos',
      description: 'List all videos for a given user.',
    },
    async () => {
      const result = await gateway.listVideos();
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