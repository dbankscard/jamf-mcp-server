import { Request, Response, Application } from 'express';
import { createLogger } from './logger.js';

const logger = createLogger('chatgpt-mcp-mock');

export function setupChatGPTMockEndpoints(app: Application) {
  // Mock OAuth endpoints for ChatGPT MCP Connector
  
  // Mock authorize endpoint - immediately redirect with code
  app.get('/chatgpt/oauth/authorize', (req: Request, res: Response) => {
    logger.info('ChatGPT OAuth authorize request', req.query);
    const { redirect_uri, state } = req.query;
    
    // Immediately redirect back with a mock code
    const code = 'mock_auth_code_' + Date.now();
    const callbackUrl = `${redirect_uri}?code=${code}&state=${state}`;
    
    res.redirect(callbackUrl);
  });
  
  // Mock token endpoint
  app.post('/chatgpt/oauth/token', (req: Request, res: Response) => {
    logger.info('ChatGPT OAuth token request', req.body);
    
    // Return a mock token
    res.json({
      access_token: 'mock_access_token_' + Date.now(),
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read write',
      refresh_token: 'mock_refresh_token_' + Date.now()
    });
  });
  
  // Mock .well-known endpoint for OAuth discovery
  app.get('/.well-known/openid-configuration', (req: Request, res: Response) => {
    const baseUrl = `https://${req.hostname}`;
    
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/chatgpt/oauth/authorize`,
      token_endpoint: `${baseUrl}/chatgpt/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic']
    });
  });
  
  // MCP endpoint that accepts any bearer token
  app.get('/chatgpt/mcp', (req: Request, res: Response) => {
    logger.info('ChatGPT MCP request', { 
      auth: req.headers.authorization?.substring(0, 20) + '...' 
    });
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    
    // Send initial connection message
    res.write('data: {"type":"connection","status":"ready"}\n\n');
    
    // Keep connection alive
    const interval = setInterval(() => {
      res.write(':ping\n\n');
    }, 30000);
    
    req.on('close', () => {
      clearInterval(interval);
      logger.info('ChatGPT MCP connection closed');
    });
  });
  
  logger.info('ChatGPT mock OAuth endpoints ready');
}