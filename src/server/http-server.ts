import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import { registerTools } from '../tools/index-compat.js';
import { registerResources } from '../resources/index-compat.js';
import { registerPrompts } from '../prompts/index.js';
import { authMiddleware } from './auth-middleware.js';
import { handleOAuthAuthorize, handleOAuthCallback } from './oauth-config.js';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for ChatGPT
app.use(cors({
  origin: ['https://chat.openai.com', 'https://chatgpt.com'],
  credentials: true,
}));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'jamf-mcp-server' });
});

// OAuth endpoints for ChatGPT
app.get('/auth/authorize', handleOAuthAuthorize);
app.get('/auth/callback', handleOAuthCallback);

// MCP endpoint with authentication
app.use('/mcp', authMiddleware, async (req, res) => {
  try {
    // Create MCP server instance
    const server = new Server(
      {
        name: 'jamf-mcp-server',
        version: '1.2.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // Initialize Jamf client with environment variables
    const jamfClient = new JamfApiClientHybrid({
      baseUrl: process.env.JAMF_URL!,
      clientId: process.env.JAMF_CLIENT_ID,
      clientSecret: process.env.JAMF_CLIENT_SECRET,
      username: process.env.JAMF_USERNAME,
      password: process.env.JAMF_PASSWORD,
      readOnlyMode: process.env.JAMF_READ_ONLY === 'true',
    });

    // Register handlers
    registerTools(server, jamfClient as any);
    registerResources(server, jamfClient as any);
    registerPrompts(server);

    // Create SSE transport for HTTP
    const transport = new SSEServerTransport('/mcp', res);
    await server.connect(transport);
    
    // Keep the connection alive
    req.on('close', () => {
      transport.close();
    });
  } catch (error) {
    console.error('MCP connection error:', error);
    res.status(500).json({ error: 'Failed to establish MCP connection' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Jamf MCP HTTP server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
});