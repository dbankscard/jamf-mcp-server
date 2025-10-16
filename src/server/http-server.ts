import express, { Request, Response, NextFunction } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import { registerTools } from '../tools/index-compat.js';
import { registerResources } from '../resources/index-compat.js';
import { registerPrompts } from '../prompts/index.js';
import { authMiddleware } from './auth-middleware.js';
import { handleOAuthAuthorize, handleOAuthCallback, handleTokenRefresh } from './oauth-config.js';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createLogger } from './logger.js';
import { 
  validateSecurityHeaders, 
  validateOAuthAuthorize, 
  validateOAuthCallback, 
  validateTokenRefresh,
  requestIdMiddleware 
} from './validation-middleware.js';

// Load environment variables
dotenv.config();

const logger = createLogger('http-server');
const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

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

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    service: 'jamf-mcp-server',
    version: '1.2.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  res.json(health);
});

// OAuth endpoints for ChatGPT with validation
app.get('/auth/authorize', validateOAuthAuthorize, handleOAuthAuthorize);
app.get('/auth/callback', validateOAuthCallback, handleOAuthCallback);
app.post('/auth/token', validateTokenRefresh, handleTokenRefresh);

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
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
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

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
try {
  validateConfig();
  
  app.listen(port, () => {
    logger.info(`Jamf MCP HTTP server running on port ${port}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Health check: http://localhost:${port}/health`);
    logger.info(`MCP endpoint: http://localhost:${port}/mcp`);
  });
} catch (error) {
  logger.error('Failed to start server:', error);
  process.exit(1);
}