import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { registerSearchTool } from './tools/search.js';
import { registerGetVideoTool } from './tools/getVideo.js';
import { registerListVideosTool } from './tools/listVideos.js';
import { registerUploadVideoTool } from './tools/uploadVideo.js';
import { registerConfirmUploadTool } from './tools/confirmUpload.js';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT ?? '3001', 10);

function createServer(): McpServer {
  const server = new McpServer({
    name: 'mediapro-mcp',
    version: '1.0.0',
  });

  registerSearchTool(server);
  registerGetVideoTool(server);
  registerListVideosTool(server);
  registerUploadVideoTool(server);
  registerConfirmUploadTool(server);

  return server;
}

app.get('/mcp', (req, res) => {
  res.status(405).json({ error: 'Method not allowed. Use POST.' });
});

app.post('/mcp', async (req, res) => {
  const server = createServer();  // new instance per request
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP server running on port ${PORT}`);
});