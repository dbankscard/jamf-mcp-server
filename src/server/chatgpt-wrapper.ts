import express, { Request, Response } from 'express';
import { createLogger } from './logger.js';

const logger = createLogger('chatgpt-wrapper');

// Development token for ChatGPT
const CHATGPT_DEV_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlci0wMDEiLCJlbWFpbCI6ImRldkBqYW1mLW1jcC5sb2NhbCIsIm5hbWUiOiJEZXZlbG9wbWVudCBVc2VyIiwic2NvcGUiOiJyZWFkOmphbWYgd3JpdGU6amFtZiIsInBlcm1pc3Npb25zIjpbInJlYWQ6amFtZiIsIndyaXRlOmphbWYiXSwiaWF0IjoxNzYwODk1MTYxLCJleHAiOjE3NjE0OTk5NjF9.U6Au2fzy7AewSsRKdjhgTRd8nVFdApVpHJGRxKgNERM';

export const createChatGPTWrapper = (app: express.Application) => {
  // ChatGPT health check endpoint (no auth required)
  app.get('/chatgpt/health', (req: Request, res: Response) => {
    logger.info('ChatGPT health check');
    res.json({
      status: 'healthy',
      service: 'jamf-mcp-server-chatgpt',
      version: '1.0.0',
      mode: 'development',
      timestamp: new Date().toISOString()
    });
  });

  // ChatGPT MCP proxy endpoint (no auth required from ChatGPT)
  app.get('/chatgpt/mcp', async (req: Request, res: Response) => {
    logger.info('ChatGPT MCP connection attempt');
    
    try {
      // Make internal request with dev token
      const internalReq = {
        ...req,
        headers: {
          ...req.headers,
          'authorization': `Bearer ${CHATGPT_DEV_TOKEN}`
        }
      } as Request;
      
      // Forward to the actual MCP endpoint
      req.app.emit('mcp-request', internalReq, res);
      
    } catch (error) {
      logger.error('ChatGPT wrapper error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Simple device search endpoint for ChatGPT
  app.get('/chatgpt/devices/search', async (req: Request, res: Response) => {
    logger.info('ChatGPT device search', { query: req.query });
    
    // Add auth header internally
    req.headers.authorization = `Bearer ${CHATGPT_DEV_TOKEN}`;
    
    // Forward to your internal handlers
    // This is a simplified example - you'd connect to your actual Jamf client here
    res.json({
      message: 'Device search endpoint',
      query: req.query,
      note: 'Connect this to your Jamf client'
    });
  });

  logger.info('ChatGPT wrapper endpoints registered');
};