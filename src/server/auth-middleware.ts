import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

// OAuth2 configuration from environment
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;
const OAUTH_PROVIDER = process.env.OAUTH_PROVIDER || 'auth0';

// Simple in-memory token validation for development
// In production, use proper OAuth2 validation
const validateToken = async (token: string): Promise<any> => {
  if (!token) {
    throw new Error('No token provided');
  }

  // For Auth0
  if (OAUTH_PROVIDER === 'auth0' && AUTH0_DOMAIN) {
    const client = jwksRsa({
      jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
    });

    const getKey = (header: any, callback: any) => {
      client.getSigningKey(header.kid, (err: any, key: any) => {
        if (err) {
          callback(err);
        } else {
          const signingKey = key.getPublicKey();
          callback(null, signingKey);
        }
      });
    };

    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey as any,
        {
          audience: AUTH0_AUDIENCE,
          issuer: `https://${AUTH0_DOMAIN}/`,
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded);
          }
        }
      );
    });
  }

  // For development/testing with a simple JWT
  if (OAUTH_PROVIDER === 'dev') {
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
    return jwt.verify(token, JWT_SECRET);
  }

  throw new Error('OAuth provider not configured');
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Invalid authorization format' });
    }

    const token = parts[1];

    // Validate the token
    const decoded = await validateToken(token);
    
    // Add user information to request
    (req as any).user = decoded;

    // Check for required scopes if needed
    const requiredScopes = process.env.REQUIRED_SCOPES?.split(' ') || [];
    if (requiredScopes.length > 0 && decoded.scope) {
      const userScopes = decoded.scope.split(' ');
      const hasRequiredScopes = requiredScopes.every(scope => 
        userScopes.includes(scope)
      );
      
      if (!hasRequiredScopes) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: requiredScopes,
        });
      }
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ 
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};