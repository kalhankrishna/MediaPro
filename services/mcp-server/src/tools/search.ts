import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { gateway } from '../lib/gatewayClient.js';

export function registerSearchTool(server: McpServer) {
  server.registerTool(
    'search_videos',
    {
      title: 'Search Videos',
      description: 'Semantically search across all video transcripts and get an AI-generated answer with sources.',
      inputSchema: {
        query: z.string().min(1).max(500).describe('The search query'),
      },
    },
    async ({ query }) => {
      const result = await gateway.search(query);
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