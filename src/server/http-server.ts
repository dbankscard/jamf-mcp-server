import express, { Request, Response, NextFunction } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import { registerTools } from '../tools/index.js';
import { registerResources } from '../resources/index.js';
import { registerPrompts } from '../prompts/index.js';
import { authMiddleware } from './auth-middleware.js';
import { handleOAuthAuthorize, handleOAuthCallback, handleTokenRefresh } from './oauth-config.js';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { registerShutdownHandler } from '../utils/shutdown-manager.js';
import { basicHealthCheck, detailedHealthCheck, livenessProbe, readinessProbe } from './health-check.js';
import { createLogger } from './logger.js';
import { 
  validateSecurityHeaders, 
  validateOAuthAuthorize, 
  validateOAuthCallback, 
  validateTokenRefresh,
  requestIdMiddleware 
} from './validation-middleware.js';
import path from 'path';
import { SkillsManager } from '../skills/manager.js';
import { createSkillsRouter, chatGPTOptimizationMiddleware } from './skills-endpoints.js';
import { integrateSkillsWithTools, getSkillTools } from '../tools/skills-integration.js';
import { initializeSkillsForHttp } from '../skills/http-initializer.js';

// Load environment variables
dotenv.config();

const logger = createLogger('http-server');
const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Skills Manager
const skillsManager = new SkillsManager();

// Initialize Jamf client for skills
const jamfClientForSkills = new JamfApiClientHybrid({
  baseUrl: process.env.JAMF_URL!,
  clientId: process.env.JAMF_CLIENT_ID,
  clientSecret: process.env.JAMF_CLIENT_SECRET,
  username: process.env.JAMF_USERNAME,
  password: process.env.JAMF_PASSWORD,
  readOnlyMode: process.env.JAMF_READ_ONLY === 'true',
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://chatgpt.com", "https://chat.openai.com"],
    },
  },
}));

// Compression
app.use(compression());

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID and security headers validation
app.use(requestIdMiddleware);
app.use(validateSecurityHeaders);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://chat.openai.com',
  'https://chatgpt.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/mcp', limiter);
app.use('/auth', limiter);

// ChatGPT optimization middleware
app.use(chatGPTOptimizationMiddleware);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log incoming request details for debugging
  logger.info(`Incoming request: ${req.method} ${req.url}`, {
    headers: req.headers,
    query: req.query,
    body: req.body,
    ip: req.ip
  });
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`Request completed: ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Initialize skills manager for HTTP context
initializeSkillsForHttp(skillsManager, jamfClientForSkills);

// Mount skills router
app.use('/api/v1/skills', createSkillsRouter(skillsManager));

// Serve OpenAPI schema for ChatGPT
app.get('/chatgpt-openapi-schema.json', (_req: Request, res: Response) => {
  res.sendFile('chatgpt-openapi-schema.json', { root: path.join(process.cwd(), 'chatgpt', 'public') });
});

// Serve Skills OpenAPI schema for ChatGPT
app.get('/chatgpt-skills-openapi.json', (_req: Request, res: Response) => {
  res.sendFile('chatgpt-skills-openapi.json', { root: path.join(process.cwd(), 'chatgpt', 'public') });
});

// ChatGPT endpoints (no auth required for POC)
if (process.env.NODE_ENV === 'development') {
  app.get('/chatgpt/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'jamf-mcp-chatgpt',
      message: 'ChatGPT endpoint ready',
      timestamp: new Date().toISOString()
    });
  });
  
  // Simple REST endpoints for ChatGPT
  const jamfClient = new JamfApiClientHybrid({
    baseUrl: process.env.JAMF_URL!,
    clientId: process.env.JAMF_CLIENT_ID,
    clientSecret: process.env.JAMF_CLIENT_SECRET,
    username: process.env.JAMF_USERNAME,
    password: process.env.JAMF_PASSWORD,
    readOnlyMode: process.env.JAMF_READ_ONLY === 'true',
    // TLS/SSL configuration - only disable for development with self-signed certs
    rejectUnauthorized: process.env.JAMF_ALLOW_INSECURE !== 'true',
  });
  
  app.get('/chatgpt/devices/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string || '';
      logger.info('ChatGPT device search', { query });
      
      const devices = await jamfClient.searchComputers(query);
      res.json({
        devices: devices.slice(0, 10), // Limit to 10 for ChatGPT
        count: devices.length,
        query
      });
    } catch (error) {
      logger.error('Device search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });
  
  app.get('/chatgpt/devices/compliance', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      logger.info('ChatGPT compliance check', { days });
      
      const devices = await jamfClient.getAllComputers();
      const now = Date.now();
      const threshold = days * 24 * 60 * 60 * 1000;
      
      const noncompliant = devices.filter(device => {
        if (!device.last_contact_time) return true;
        const lastContact = new Date(device.last_contact_time).getTime();
        return (now - lastContact) > threshold;
      });
      
      res.json({
        total: devices.length,
        compliant: devices.length - noncompliant.length,
        noncompliant: noncompliant.length,
        devices: noncompliant.slice(0, 5).map(d => ({
          id: d.id,
          name: d.name,
          serialNumber: d.serial_number,
          lastSeen: d.last_contact_time
        }))
      });
    } catch (error) {
      logger.error('Compliance check error:', error);
      res.status(500).json({ error: 'Compliance check failed' });
    }
  });
  
  app.get('/chatgpt/policies', async (_req: Request, res: Response) => {
    try {
      logger.info('ChatGPT list policies');
      // For now, return a simple message
      res.json({
        message: 'Policy listing endpoint',
        note: 'Connect this to your Jamf policies API'
      });
    } catch (error) {
      logger.error('List policies error:', error);
      res.status(500).json({ error: 'Failed to list policies' });
    }
  });
  
  logger.info('ChatGPT development endpoints enabled at /chatgpt/*');
}

// Root endpoint for ChatGPT MCP discovery and JSON-RPC
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Jamf MCP Server',
    version: '1.0.0',
    protocol: 'mcp',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      oauth: {
        authorize: '/auth/authorize',
        token: '/auth/token'
      }
    }
  });
});

// Handle JSON-RPC requests at root for ChatGPT
app.post('/', async (req: Request, res: Response) => {
  try {
    const { method, params, id } = req.body;
    logger.info(`JSON-RPC request: ${method}`, { params, id });
    
    if (method === 'initialize') {
      // Respond to initialize request
      res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: {
            tools: {
              listTools: true
            },
            resources: {
              list: true,
              read: true
            },
            prompts: {
              list: true
            }
          },
          serverInfo: {
            name: 'Jamf MCP Server',
            version: '1.0.0'
          }
        }
      });
    } else if (method === 'tools/list') {
      // List available tools including skills
      const basicTools = [
        {
          name: 'search_computers',
          description: 'Search for computers in Jamf Pro',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              }
            }
          }
        },
        {
          name: 'check_compliance',
          description: 'Check device compliance status',
          inputSchema: {
            type: 'object',
            properties: {
              days: {
                type: 'number',
                description: 'Days since last check-in'
              }
            }
          }
        }
      ];
      
      // Add skill tools
      const skillTools = getSkillTools(skillsManager);
      const allTools = [...basicTools, ...skillTools];
      
      res.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: allTools
        }
      });
    } else if (method === 'notifications/initialized') {
      // Handle initialized notification (no response needed for notifications)
      logger.info('Client initialized successfully');
      res.status(204).end();
    } else if (method === 'tools/call') {
      // Handle tool invocation
      const { name, arguments: args } = params;
      logger.info(`Tool call: ${name}`, { args });
      
      try {
        const jamfClient = new JamfApiClientHybrid({
          baseUrl: process.env.JAMF_URL!,
          clientId: process.env.JAMF_CLIENT_ID,
          clientSecret: process.env.JAMF_CLIENT_SECRET,
          username: process.env.JAMF_USERNAME,
          password: process.env.JAMF_PASSWORD,
          readOnlyMode: process.env.JAMF_READ_ONLY === 'true',
        });
        
        let result;
        if (name === 'search_computers') {
          const devices = await jamfClient.searchComputers(args.query || '');
          result = {
            devices: devices.slice(0, 10),
            count: devices.length,
            query: args.query
          };
        } else if (name === 'check_compliance') {
          const devices = await jamfClient.getAllComputers();
          const days = args.days || 30;
          const now = Date.now();
          const threshold = days * 24 * 60 * 60 * 1000;
          
          const noncompliant = devices.filter(device => {
            if (!device.last_contact_time) return true;
            const lastContact = new Date(device.last_contact_time).getTime();
            return (now - lastContact) > threshold;
          });
          
          result = {
            total: devices.length,
            compliant: devices.length - noncompliant.length,
            noncompliant: noncompliant.length,
            devices: noncompliant.slice(0, 5).map(d => ({
              id: d.id,
              name: d.name,
              serialNumber: d.serial_number,
              lastSeen: d.last_contact_time
            }))
          };
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
        
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        });
      } catch (error: any) {
        logger.error('Tool execution error:', error);
        res.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: error.message || 'Tool execution failed'
          }
        });
      }
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      });
    }
  } catch (error) {
    logger.error('JSON-RPC error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id,
      error: {
        code: -32603,
        message: 'Internal error'
      }
    });
  }
});

// MCP discovery endpoint
app.get('/.well-known/mcp', (_req: Request, res: Response) => {
  res.json({
    "mcp_version": "1.0",
    "name": "Jamf MCP Server",
    "description": "MCP server for Jamf Pro device management",
    "icon_url": null,
    "capabilities": {
      "authentication": {
        "type": "oauth2",
        "oauth2": {
          "authorization_url": "https://glance-rosa-sec-tone.trycloudflare.com/auth/authorize",
          "token_url": "https://glance-rosa-sec-tone.trycloudflare.com/auth/token",
          "scopes": ["read", "write"]
        }
      }
    }
  });
});

// Health check endpoints
app.get('/health', basicHealthCheck);
app.get('/health/detailed', (req: Request, res: Response) => {
  detailedHealthCheck(req, res, jamfClientForSkills);
});
app.get('/health/live', livenessProbe);
app.get('/health/ready', (req: Request, res: Response) => {
  readinessProbe(req, res, jamfClientForSkills);
});

// OAuth endpoints for ChatGPT with validation
app.get('/auth/authorize', validateOAuthAuthorize, handleOAuthAuthorize);
app.get('/auth/callback', validateOAuthCallback, handleOAuthCallback);
app.post('/auth/token', validateTokenRefresh, handleTokenRefresh);

// MCP-specific endpoint that ChatGPT might look for
app.get('/mcp/v1', (_req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    protocol: 'mcp',
    capabilities: {
      tools: true,
      resources: true,
      prompts: true
    }
  });
});

// Validate environment configuration on startup
const validateConfig = () => {
  const required = ['JAMF_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Check for at least one auth method
  const hasOAuth2 = !!(process.env.JAMF_CLIENT_ID && process.env.JAMF_CLIENT_SECRET);
  const hasBasicAuth = !!(process.env.JAMF_USERNAME && process.env.JAMF_PASSWORD);
  
  if (!hasOAuth2 && !hasBasicAuth) {
    throw new Error('Missing Jamf authentication credentials. Provide either OAuth2 or Basic Auth.');
  }

  // Validate OAuth provider configuration
  if (!['dev', 'auth0', 'okta'].includes(process.env.OAUTH_PROVIDER || 'auth0')) {
    throw new Error('Invalid OAUTH_PROVIDER. Must be one of: dev, auth0, okta');
  }
};

// MCP endpoint with authentication
app.use('/mcp', authMiddleware, async (req: Request, res: Response) => {
  let server: Server | null = null;
  let transport: SSEServerTransport | null = null;

  try {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });

    // Create MCP server instance
    server = new Server(
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
    
    // Integrate skills with existing tools for Claude
    integrateSkillsWithTools(server, skillsManager, jamfClient);

    // Create SSE transport for HTTP
    transport = new SSEServerTransport('/mcp', res);
    await server.connect(transport);
    
    logger.info(`MCP connection established for user: ${(req as any).user?.sub || 'unknown'}`);

    // Handle client disconnect
    req.on('close', () => {
      logger.info('Client disconnected');
      if (transport) {
        transport.close();
      }
    });

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
      if (res.writable) {
        res.write(':ping\n\n');
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // 30 seconds

    // Clean up on connection close
    req.on('close', () => {
      clearInterval(pingInterval);
    });

  } catch (error) {
    logger.error('MCP connection error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to establish MCP connection',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.url}`, {
    headers: req.headers,
    body: req.body,
    query: req.query
  });
  res.status(404).json({ 
    error: 'Not found',
    path: req.url,
    method: req.method
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    });
  }
});

// Server instance will be available after listen()
let httpServer: any = null;

// Catch-all to debug 404s
app.use('*', (req: Request, res: Response) => {
  logger.warn(`404 - Not found: ${req.method} ${req.originalUrl}`, {
    headers: req.headers,
    query: req.query
  });
  res.status(404).json({ 
    error: 'Not found', 
    path: req.originalUrl,
    method: req.method 
  });
});

// Start server
try {
  validateConfig();
  
  httpServer = app.listen(port, () => {
    logger.info(`Jamf MCP HTTP server running on port ${port}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Health check: http://localhost:${port}/health`);
    logger.info(`MCP endpoint: http://localhost:${port}/mcp`);
    
    // Register shutdown handler after server starts
    registerShutdownHandler(
      'http-server',
      () => new Promise<void>((resolve, reject) => {
        logger.info('Closing HTTP server...');
        httpServer.close((err?: Error) => {
          if (err) {
            logger.error('Error closing HTTP server', { error: err.message });
            reject(err);
          } else {
            logger.info('HTTP server closed');
            resolve();
          }
        });
      }),
      30, // Priority 30 - close server early
      10000 // 10 second timeout
    );
  });
} catch (error) {
  logger.error('Failed to start server:', error);
  process.exit(1);
}