import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware, cleanupAuthMiddleware } from '../../server/auth-middleware.js';

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockReq = {
      headers: {},
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test',
      originalUrl: '/test'
    };

    mockRes = {
      status: jest.fn(() => mockRes as Response),
      json: jest.fn(() => mockRes as Response),
      setHeader: jest.fn()
    };

    mockNext = jest.fn();

    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe('authMiddleware - request validation', () => {
    test('should reject requests without Authorization header', async () => {
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing authorization header'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject requests with invalid header format (single part)', async () => {
      mockReq.headers = { authorization: 'InvalidFormat' };

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid authorization header format'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject requests with non-Bearer scheme', async () => {
      mockReq.headers = { authorization: 'Basic token123' };

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid authentication scheme'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject requests with too many header parts', async () => {
      mockReq.headers = { authorization: 'Bearer token extra' };

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authMiddleware - provider validation', () => {
    test('should reject unsupported OAuth provider', async () => {
      process.env.OAUTH_PROVIDER = 'unsupported';
      mockReq.headers = { authorization: 'Bearer some-token' };

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject dev mode in non-development environment', async () => {
      process.env.OAUTH_PROVIDER = 'dev';
      process.env.NODE_ENV = 'production';
      mockReq.headers = { authorization: 'Bearer dev-token' };

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject dev mode without JWT_SECRET', async () => {
      process.env.OAUTH_PROVIDER = 'dev';
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_SECRET;
      mockReq.headers = { authorization: 'Bearer dev-token' };

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject auth0 without valid token', async () => {
      process.env.OAUTH_PROVIDER = 'auth0';
      process.env.AUTH0_DOMAIN = 'test.auth0.com';
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

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
