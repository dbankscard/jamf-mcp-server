import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { authenticateToken, cleanupAuthMiddleware } from '../../server/auth-middleware.js';

// Mock jwks-rsa
jest.mock('jwks-rsa', () => ({
  default: jest.fn(() => ({
    getSigningKey: jest.fn()
  }))
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
    decode: jest.fn()
  }
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      ip: '127.0.0.1',
      method: 'GET',
      originalUrl: '/test'
    };

    mockRes = {
      status: jest.fn(() => mockRes as Response),
      json: jest.fn(() => mockRes as Response),
      setHeader: jest.fn()
    };

    mockNext = jest.fn();

    // Reset environment variables
    process.env.OAUTH_PROVIDER = 'test';
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    test('should reject requests without Authorization header', async () => {
      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'No authorization token provided'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject requests with invalid Bearer format', async () => {
      mockReq.headers = { authorization: 'InvalidFormat token123' };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid authorization format'
      });
    });

    test('should authenticate with dev token in development', async () => {
      process.env.OAUTH_PROVIDER = 'dev';
      mockReq.headers = { authorization: 'Bearer dev-token' };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toEqual({
        sub: 'dev-user',
        permissions: ['read:all', 'write:all']
      });
    });

    test('should handle JWT validation with local secret', async () => {
      process.env.OAUTH_PROVIDER = 'local';
      const jwt = await import('jsonwebtoken');
      const mockVerify = jwt.default.verify as jest.Mock;
      
      mockVerify.mockImplementation((token, secret, options, callback) => {
        callback(null, { sub: 'local-user', scope: 'read write' });
      });

      mockReq.headers = { authorization: 'Bearer valid-jwt' };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toMatchObject({
        sub: 'local-user',
        permissions: ['read', 'write']
      });
    });

    test('should handle JWT validation errors', async () => {
      process.env.OAUTH_PROVIDER = 'local';
      const jwt = await import('jsonwebtoken');
      const mockVerify = jwt.default.verify as jest.Mock;
      
      mockVerify.mockImplementation((token, secret, options, callback) => {
        callback(new Error('Invalid token'), null);
      });

      mockReq.headers = { authorization: 'Bearer invalid-jwt' };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle Auth0 token validation', async () => {
      process.env.OAUTH_PROVIDER = 'auth0';
      process.env.AUTH0_DOMAIN = 'test.auth0.com';
      process.env.AUTH0_AUDIENCE = 'https://api.test.com';

      const jwt = await import('jsonwebtoken');
      const mockDecode = jwt.default.decode as jest.Mock;
      const mockVerify = jwt.default.verify as jest.Mock;

      mockDecode.mockReturnValue({
        header: { kid: 'test-kid' },
        payload: { sub: 'auth0|user123' }
      });

      const jwksRsa = await import('jwks-rsa');
      const mockJwksClient = jwksRsa.default as jest.Mock;
      const mockGetSigningKey = jest.fn().mockResolvedValue({
        getPublicKey: () => 'test-public-key'
      });

      mockJwksClient.mockReturnValue({
        getSigningKey: mockGetSigningKey
      });

      mockVerify.mockImplementation((token, key, options, callback) => {
        callback(null, { 
          sub: 'auth0|user123', 
          permissions: ['read:devices', 'write:devices']
        });
      });

      mockReq.headers = { authorization: 'Bearer valid-auth0-token' };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toMatchObject({
        sub: 'auth0|user123',
        permissions: ['read:devices', 'write:devices']
      });
    });

    test('should handle missing JWT_SECRET', async () => {
      process.env.OAUTH_PROVIDER = 'local';
      delete process.env.JWT_SECRET;

      mockReq.headers = { authorization: 'Bearer some-token' };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('cleanupAuthMiddleware', () => {
    test('should clean up resources without errors', () => {
      expect(() => cleanupAuthMiddleware()).not.toThrow();
    });
  });
});