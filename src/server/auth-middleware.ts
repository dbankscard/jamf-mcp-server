import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { createLogger } from './logger.js';
import { LRUCache } from '../utils/lru-cache.js';

const logger = createLogger('auth-middleware');

// LRU cache for JWKS clients with automatic eviction
const JWKS_CACHE_SIZE = 100; // Maximum number of clients to cache
const JWKS_CACHE_TTL = 3600000; // 1 hour TTL

const jwksClientsCache = new LRUCache<jwksRsa.JwksClient>({
  maxSize: JWKS_CACHE_SIZE,
  maxAge: JWKS_CACHE_TTL,
  onEvict: (key, client) => {
    logger.debug(`Evicting JWKS client for domain: ${key}`);
  }
});

// Periodic cleanup of expired entries
const cleanupInterval = setInterval(() => {
  jwksClientsCache.cleanExpired();
  logger.debug('JWKS cache cleanup completed', jwksClientsCache.getStats());
}, 300000); // Clean every 5 minutes

interface TokenPayload {
  sub: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  iat?: number;
  scope?: string;
  permissions?: string[];
  [key: string]: any;
}

// Get or create JWKS client with LRU caching
const getJwksClient = (domain: string): jwksRsa.JwksClient => {
  const cacheKey = domain;
  
  // Check if client exists in cache
  const cachedClient = jwksClientsCache.get(cacheKey);
  if (cachedClient) {
    logger.debug(`Using cached JWKS client for domain: ${domain}`);
    return cachedClient;
  }
  
  // Create new client if not in cache
  logger.info(`Creating new JWKS client for domain: ${domain}`);
  const client = jwksRsa({
    jwksUri: `https://${domain}/.well-known/jwks.json`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600000, // 10 minutes
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    timeout: 30000, // 30 seconds
  });
  
  // Store in LRU cache
  jwksClientsCache.set(cacheKey, client);
  
  return client;
};

// Validate Auth0 token
const validateAuth0Token = async (token: string): Promise<TokenPayload> => {
  const domain = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE;
  
  if (!domain) {
    throw new Error('AUTH0_DOMAIN not configured');
  }
  
  const client = getJwksClient(domain);
  
  return new Promise((resolve, reject) => {
    const verifyOptions: jwt.VerifyOptions = {
      audience,
      issuer: `https://${domain}/`,
      algorithms: ['RS256'],
      complete: false,
    };

    jwt.verify(token, (header, callback) => {
      if (!header.kid) {
        return callback(new Error('No kid specified in token header'));
      }
      
      client.getSigningKey(header.kid, (err, key) => {
        if (err) {
          return callback(err);
        }
        if (!key) {
          return callback(new Error('No signing key found'));
        }
        
        const signingKey = 'publicKey' in key ? key.publicKey : key.rsaPublicKey;
        callback(null, signingKey);
      });
    }, verifyOptions, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as TokenPayload);
      }
    });
  });
};

// Validate Okta token
const validateOktaToken = async (token: string): Promise<TokenPayload> => {
  const domain = process.env.OKTA_DOMAIN;
  const clientId = process.env.OKTA_CLIENT_ID;
  
  if (!domain) {
    throw new Error('OKTA_DOMAIN not configured');
  }
  
  const issuer = domain.includes('oauth2') ? domain : `${domain}/oauth2/default`;
  const client = getJwksClient(issuer.replace('https://', ''));
  
  return new Promise((resolve, reject) => {
    const verifyOptions: jwt.VerifyOptions = {
      audience: clientId,
      issuer,
      algorithms: ['RS256'],
      complete: false,
    };

    jwt.verify(token, (header, callback) => {
      if (!header.kid) {
        return callback(new Error('No kid specified in token header'));
      }
      
      client.getSigningKey(header.kid, (err, key) => {
        if (err) {
          return callback(err);
        }
        if (!key) {
          return callback(new Error('No signing key found'));
        }
        
        const signingKey = 'publicKey' in key ? key.publicKey : key.rsaPublicKey;
        callback(null, signingKey);
      });
    }, verifyOptions, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as TokenPayload);
      }
    });
  });
};

// Validate token based on provider
const validateToken = async (token: string): Promise<TokenPayload> => {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token format');
  }

  const provider = process.env.OAUTH_PROVIDER || 'auth0';
  
  try {
    switch (provider) {
      case 'auth0':
        return await validateAuth0Token(token);
        
      case 'okta':
        return await validateOktaToken(token);
        
      case 'dev':
        // Development mode - use local JWT validation
        if (process.env.NODE_ENV !== 'development') {
          throw new Error('Dev mode authentication only available in development environment');
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET not configured for dev mode');
        }
        return jwt.verify(token, secret) as TokenPayload;
        
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
  } catch (error) {
    // Add more context to JWT errors
    if (error instanceof jwt.JsonWebTokenError) {
      if (error.message === 'jwt expired') {
        throw new Error('Token has expired');
      }
      if (error.message === 'invalid signature') {
        throw new Error('Token signature is invalid');
      }
      throw new Error(`Token validation failed: ${error.message}`);
    }
    throw error;
  }
};

// Extended Request interface
interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  authInfo?: {
    token: string;
    tokenType: string;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.warn('Missing authorization header', {
        ip: req.ip,
        path: req.path,
      });
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }

    // Validate header format
    const headerParts = authHeader.split(' ');
    if (headerParts.length !== 2) {
      res.status(401).json({ error: 'Invalid authorization header format' });
      return;
    }

    const [scheme, token] = headerParts;
    if (scheme.toLowerCase() !== 'bearer') {
      res.status(401).json({ error: 'Invalid authentication scheme' });
      return;
    }

    // Validate token
    const decoded = await validateToken(token);
    
    // Check token expiration
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      res.status(401).json({ error: 'Token has expired' });
      return;
    }
    
    // Add user information to request
    req.user = decoded;
    req.authInfo = {
      token,
      tokenType: 'Bearer',
    };

    // Check for required scopes
    const requiredScopes = process.env.REQUIRED_SCOPES?.split(' ').filter(Boolean) || [];
    if (requiredScopes.length > 0) {
      const userScopes = decoded.scope?.split(' ') || [];
      const userPermissions = decoded.permissions || [];
      const allUserScopes = [...userScopes, ...userPermissions];
      
      const hasRequiredScopes = requiredScopes.every(scope => 
        allUserScopes.includes(scope)
      );
      
      if (!hasRequiredScopes) {
        logger.warn('Insufficient permissions', {
          user: decoded.sub,
          required: requiredScopes,
          provided: allUserScopes,
        });
        res.status(403).json({ 
          error: 'Insufficient permissions',
          required: requiredScopes,
        });
        return;
      }
    }

    logger.info('Authentication successful', {
      user: decoded.sub,
      provider: process.env.OAUTH_PROVIDER,
      duration: Date.now() - startTime,
    });

    next();
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ip: req.ip,
      path: req.path,
      duration,
    });
    
    // Don't expose internal error details in production
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'Authentication failed';
    
    res.status(401).json({ 
      error: errorMessage,
    });
  }
};

// Export cleanup function for graceful shutdown
export const cleanupAuthMiddleware = (): void => {
  logger.info('Cleaning up auth middleware resources');
  clearInterval(cleanupInterval);
  jwksClientsCache.clear();
};