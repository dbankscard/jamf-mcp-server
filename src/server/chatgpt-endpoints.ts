import { Request, Response, Application } from 'express';
import { createLogger } from './logger.js';

const logger = createLogger('chatgpt-endpoints');

// Hardcoded dev token for POC
const DEV_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlci0wMDEiLCJlbWFpbCI6ImRldkBqYW1mLW1jcC5sb2NhbCIsIm5hbWUiOiJEZXZlbG9wbWVudCBVc2VyIiwic2NvcGUiOiJyZWFkOmphbWYgd3JpdGU6amFtZiIsInBlcm1pc3Npb25zIjpbInJlYWQ6amFtZiIsIndyaXRlOmphbWYiXSwiaWF0IjoxNzYwODk1MTYxLCJleHAiOjE3NjE0OTk5NjF9.U6Au2fzy7AewSsRKdjhgTRd8nVFdApVpHJGRxKgNERM';

export function setupChatGPTEndpoints(app: Application) {
  // Special endpoint for ChatGPT that adds auth header automatically
  app.get('/chatgpt/mcp', (req: Request, res: Response, next: any) => {
    logger.info('ChatGPT MCP request - adding dev auth');
    
    // Add the authorization header
    req.headers.authorization = `Bearer ${DEV_TOKEN}`;
    
    // Change the path to /mcp
    req.url = '/mcp';
    
    // Pass to the normal MCP handler
    next();
  });
  
  // ChatGPT-friendly health endpoint
  app.get('/chatgpt/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'jamf-mcp-chatgpt',
      message: 'ChatGPT endpoint ready',
      timestamp: new Date().toISOString()
    });
  });
  
  logger.info('ChatGPT endpoints configured at /chatgpt/*');
}