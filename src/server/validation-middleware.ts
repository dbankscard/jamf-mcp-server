import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { createLogger } from './logger.js';

const logger = createLogger('validation');

// Security headers validation
export const validateSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Check for suspicious headers
  const suspiciousHeaders = [
    'x-forwarded-host',
    'x-original-url',
    'x-rewrite-url',
  ];

  for (const header of suspiciousHeaders) {
    if (req.headers[header]) {
      logger.warn('Suspicious header detected', {
        header,
        value: req.headers[header],
        ip: req.ip,
      });
    }
  }

  // Validate content-type for POST requests
  if (req.method === 'POST' && !req.is('application/json') && !req.is('application/x-www-form-urlencoded')) {
    res.status(415).json({ error: 'Unsupported media type' });
    return;
  }

  next();
};

// Query parameter validation schemas
const OAuthAuthorizeQuerySchema = z.object({
  state: z.string().optional(),
  prompt: z.enum(['none', 'login', 'consent', 'select_account']).optional(),
  login_hint: z.string().email().optional(),
  access_type: z.enum(['online', 'offline']).optional(),
}).strict();

const OAuthCallbackQuerySchema = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(2048),
  error: z.string().optional(),
  error_description: z.string().optional(),
}).strict();

// Validate OAuth authorize request
export const validateOAuthAuthorize = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const validated = OAuthAuthorizeQuerySchema.parse(req.query);
    req.query = validated as any;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn('Invalid OAuth authorize parameters', {
        errors: error.errors,
        ip: req.ip,
      });
      res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    next(error);
  }
};

// Validate OAuth callback request
export const validateOAuthCallback = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const validated = OAuthCallbackQuerySchema.parse(req.query);
    req.query = validated as any;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn('Invalid OAuth callback parameters', {
        errors: error.errors,
        ip: req.ip,
      });
      res.status(400).json({
        error: 'Invalid callback parameters',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    next(error);
  }
};

// Token refresh validation
const TokenRefreshSchema = z.object({
  refresh_token: z.string().min(1).max(4096),
}).strict();

export const validateTokenRefresh = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const validated = TokenRefreshSchema.parse(req.body);
    req.body = validated;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn('Invalid token refresh request', {
        errors: error.errors,
        ip: req.ip,
      });
      res.status(400).json({
        error: 'Invalid request body',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    next(error);
  }
};

// Sanitize response data to prevent information leakage
export const sanitizeResponse = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveKeys = [
    'password',
    'secret',
    'token',
    'key',
    'authorization',
    'cookie',
    'session',
  ];

  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive terms
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeResponse(sanitized[key]);
    }
  }

  return sanitized;
};

// Input sanitization for strings
export const sanitizeString = (input: string): string => {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length to prevent DoS
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000);
  }
  
  return sanitized;
};

// Request ID middleware for tracking
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || 
                    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  (req as any).id = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};