import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { createGatewayClient, type GatewayClient } from './lib/gatewayClient.js';
import { logger } from './lib/logger.js';
import { registerSearchTool } from './tools/search.js';
import { registerGetVideoTool } from './tools/getVideo.js';
import { registerListVideosTool } from './tools/listVideos.js';
import { registerUploadVideoTool } from './tools/uploadVideo.js';
import { registerConfirmUploadTool } from './tools/confirmUpload.js';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT ?? '3001', 10);

function createServer(gateway: GatewayClient): McpServer {
  const server = new McpServer({
    name: 'mediapro-mcp',
    version: '1.0.0',
  });

  registerSearchTool(server, gateway);
  registerGetVideoTool(server, gateway);
  registerListVideosTool(server, gateway);
  registerUploadVideoTool(server, gateway);
  registerConfirmUploadTool(server, gateway);

  return server;
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/mcp', (_req, res) => {
  res.status(405).json({ error: 'Method not allowed. Use POST.' });
});

app.post('/mcp', async (req, res) => {
  const start = Date.now();
  const authHeader = req.headers.authorization;
  const gateway = createGatewayClient(authHeader);
  const server = createServer(gateway);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on('close', () => {
    transport.close();
    logger.info({ ms: Date.now() - start }, 'mcp request completed');
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'mcp server listening');
});