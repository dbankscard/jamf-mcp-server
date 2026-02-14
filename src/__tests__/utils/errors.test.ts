import { describe, expect, test } from '@jest/globals';
import {
  JamfAPIError,
  NetworkError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  ConfigurationError,
  isRetryableError,
  getRetryDelay
} from '../../utils/errors.js';

describe('Error Classes', () => {
  describe('JamfAPIError', () => {
    test('should create with message only', () => {
      const error = new JamfAPIError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('JamfAPIError');
      expect(error.statusCode).toBeUndefined();
      expect(error.errorCode).toBeUndefined();
      expect(error.suggestions).toEqual([]);
      expect(error.context).toBeUndefined();
      expect(error.originalError).toBeUndefined();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(JamfAPIError);
    });

    test('should create with all parameters', () => {
      const originalError = new Error('original');
      const context = { method: 'GET', url: '/test' };
      const suggestions = ['Try again', 'Check config'];

      const error = new JamfAPIError(
        'Full error',
        404,
        'NOT_FOUND',
        suggestions,
        context,
        originalError
      );

      expect(error.message).toBe('Full error');
      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe('NOT_FOUND');
      expect(error.suggestions).toEqual(suggestions);
      expect(error.context).toEqual(context);
      expect(error.originalError).toBe(originalError);
    });

    test('should have proper stack trace', () => {
      const error = new JamfAPIError('Stack test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Stack test');
    });

    describe('toDetailedString', () => {
      test('should format basic error', () => {
        const error = new JamfAPIError('Basic error');
        const result = error.toDetailedString();
        expect(result).toBe('JamfAPIError: Basic error');
      });

      test('should include status code', () => {
        const error = new JamfAPIError('Error', 500);
        const result = error.toDetailedString();
        expect(result).toContain('Status Code: 500');
      });

      test('should include error code', () => {
        const error = new JamfAPIError('Error', undefined, 'TEST_CODE');
        const result = error.toDetailedString();
        expect(result).toContain('Error Code: TEST_CODE');
      });

      test('should include suggestions', () => {
        const error = new JamfAPIError('Error', undefined, undefined, ['Suggestion 1', 'Suggestion 2']);
        const result = error.toDetailedString();
        expect(result).toContain('Suggestions:');
        expect(result).toContain('1. Suggestion 1');
        expect(result).toContain('2. Suggestion 2');
      });

      test('should include context', () => {
        const error = new JamfAPIError('Error', undefined, undefined, [], { key: 'value' });
        const result = error.toDetailedString();
        expect(result).toContain('Context:');
        expect(result).toContain('key: "value"');
      });
    });

    describe('fromAxiosError', () => {
      const createAxiosError = (status: number, data?: any, headers?: any, config?: any) => {
        const error = new Error('Request failed') as any;
        error.isAxiosError = true;
        error.response = { status, data: data || {}, headers: headers || {} };
        error.config = config || { method: 'get', url: '/api/test' };
        return error;
      };

      test('should handle 400 Bad Request', () => {
        const axiosError = createAxiosError(400, { message: 'Invalid input' });
        const result = JamfAPIError.fromAxiosError(axiosError);

        expect(result.statusCode).toBe(400);
        expect(result.message).toContain('Bad Request');
        expect(result.message).toContain('Invalid input');
        expect(result.suggestions.length).toBeGreaterThan(0);
      });

      test('should handle 401 Unauthorized and return AuthenticationError', () => {
        const axiosError = createAxiosError(401, { message: 'Token expired' });
        const result = JamfAPIError.fromAxiosError(axiosError);

        expect(result).toBeInstanceOf(AuthenticationError);
        expect(result.statusCode).toBe(401);
        expect(result.message).toContain('Authentication failed');
      });

      test('should handle 403 Forbidden', () => {
        const axiosError = createAxiosError(403);
        const result = JamfAPIError.fromAxiosError(axiosError);

        expect(result.statusCode).toBe(403);
        expect(result.message).toContain('Forbidden');
        expect(result.suggestions).toContain('Verify your API client has the required permissions');
      });

      test('should handle 404 Not Found', () => {
        const axiosError = createAxiosError(404);
        const result = JamfAPIError.fromAxiosError(axiosError);

        expect(result.statusCode).toBe(404);
        expect(result.message).toContain('Not Found');
        expect(result.suggestions).toContain('Verify the resource ID is correct');
      });

      test('should handle 409 Conflict', () => {
        const axiosError = createAxiosError(409, { message: 'Duplicate name' });
        const result = JamfAPIError.fromAxiosError(axiosError);

        expect(result.statusCode).toBe(409);
        expect(result.message).toContain('Conflict');
        expect(result.message).toContain('Duplicate name');
      });

      test('should handle 429 Rate Limit and return RateLimitError', () => {
        const axiosError = createAxiosError(
          429,
          {},
          { 'retry-after': '30', 'x-ratelimit-limit': '100', 'x-ratelimit-remaining': '0' }
        );
        const result = JamfAPIError.fromAxiosError(axiosError);

        expect(result).toBeInstanceOf(RateLimitError);
        expect(result.statusCode).toBe(429);
        expect((result as RateLimitError).retryAfter).toBe(30);
        expect((result as RateLimitError).limit).toBe('100');
        expect((result as RateLimitError).remaining).toBe('0');
      });

      test('should handle 500 Server Error', () => {
        const axiosError = createAxiosError(500);
        const result = JamfAPIError.fromAxiosError(axiosError);

        expect(result.statusCode).toBe(500);
        expect(result.message).toContain('Server Error');
        expect(result.suggestions).toContain('This is likely a temporary issue, retry the request');
      });

      test('should handle 503 Service Unavailable', () => {
        const axiosError = createAxiosError(503);
        const result = JamfAPIError.fromAxiosError(axiosError);

        expect(result.statusCode).toBe(503);
        expect(result.message).toContain('Server Error (503)');
      });

      test('should include request method and URL in message', () => {
        const axiosError = createAxiosError(400, { message: 'bad' }, {}, { method: 'post', url: '/api/v1/devices' });
        const result = JamfAPIError.fromAxiosError(axiosError);

        expect(result.message).toContain('[POST /api/v1/devices]');
      });

      test('should pass context through', () => {
        const axiosError = createAxiosError(400);
        const context = { operation: 'createDevice' };
        const result = JamfAPIError.fromAxiosError(axiosError, context);

        expect(result.context).toEqual(context);
      });
    });
  });

  describe('NetworkError', () => {
    test('should create with correct defaults', () => {
      const error = new NetworkError('Connection failed');
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Connection failed');
      expect(error.errorCode).toBe('NETWORK_ERROR');
      expect(error.statusCode).toBeUndefined();
      expect(error.suggestions.length).toBeGreaterThan(0);
      expect(error).toBeInstanceOf(JamfAPIError);
    });

    describe('fromError', () => {
      test('should detect ECONNREFUSED', () => {
        const result = NetworkError.fromError(new Error('connect ECONNREFUSED 127.0.0.1:8443'));
        expect(result.message).toContain('Connection refused');
      });

      test('should detect ETIMEDOUT', () => {
        const result = NetworkError.fromError(new Error('connect ETIMEDOUT'));
        expect(result.message).toContain('timed out');
      });

      test('should detect ECONNABORTED', () => {
        const result = NetworkError.fromError(new Error('ECONNABORTED'));
        expect(result.message).toContain('timed out');
      });

      test('should detect ENOTFOUND', () => {
        const result = NetworkError.fromError(new Error('getaddrinfo ENOTFOUND example.com'));
        expect(result.message).toContain('Server not found');
      });

      test('should detect ECONNRESET', () => {
        const result = NetworkError.fromError(new Error('read ECONNRESET'));
        expect(result.message).toContain('Connection reset');
      });

      test('should handle unknown network error', () => {
        const result = NetworkError.fromError(new Error('Something weird'));
        expect(result.message).toContain('Network error: Something weird');
      });

      test('should preserve original error', () => {
        const original = new Error('ECONNREFUSED');
        const result = NetworkError.fromError(original);
        expect(result.originalError).toBe(original);
      });
    });
  });

  describe('AuthenticationError', () => {
    test('should create with correct defaults', () => {
      const error = new AuthenticationError('Invalid credentials');
      expect(error.name).toBe('AuthenticationError');
      expect(error.statusCode).toBe(401);
      expect(error.errorCode).toBe('AUTH_ERROR');
      expect(error.suggestions).toContain('Verify your API client ID and client secret are correct');
    });

    test('should accept context', () => {
      const context = { endpoint: '/api/auth' };
      const error = new AuthenticationError('Failed', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('RateLimitError', () => {
    test('should create with retry information', () => {
      const error = new RateLimitError(60, '100', '0', { endpoint: '/api/test' });
      expect(error.name).toBe('RateLimitError');
      expect(error.statusCode).toBe(429);
      expect(error.errorCode).toBe('RATE_LIMIT');
      expect(error.retryAfter).toBe(60);
      expect(error.limit).toBe('100');
      expect(error.remaining).toBe('0');
      expect(error.message).toContain('60 seconds');
    });

    test('should work without optional parameters', () => {
      const error = new RateLimitError(30);
      expect(error.retryAfter).toBe(30);
      expect(error.limit).toBeUndefined();
      expect(error.remaining).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    test('should create with field errors', () => {
      const fieldErrors = {
        name: ['Name is required', 'Name must be at least 3 characters'],
        email: ['Invalid email format']
      };
      const error = new ValidationError('Validation failed', fieldErrors);

      expect(error.name).toBe('ValidationError');
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
      expect(error.fieldErrors).toEqual(fieldErrors);
    });

    test('should include field errors in toDetailedString', () => {
      const fieldErrors = { name: ['Required'] };
      const error = new ValidationError('Invalid', fieldErrors);
      const result = error.toDetailedString();

      expect(result).toContain('Field Errors:');
      expect(result).toContain('name:');
      expect(result).toContain('- Required');
    });

    test('should work without field errors', () => {
      const error = new ValidationError('Simple validation error');
      expect(error.fieldErrors).toBeUndefined();
      const result = error.toDetailedString();
      expect(result).not.toContain('Field Errors:');
    });
  });

  describe('ConfigurationError', () => {
    test('should create with correct defaults', () => {
      const error = new ConfigurationError('Missing JAMF_URL');
      expect(error.name).toBe('ConfigurationError');
      expect(error.statusCode).toBeUndefined();
      expect(error.errorCode).toBe('CONFIG_ERROR');
      expect(error.suggestions).toContain('Check your environment variables are set correctly');
    });
  });

  describe('isRetryableError', () => {
    test('should return true for NetworkError', () => {
      expect(isRetryableError(new NetworkError('connection failed'))).toBe(true);
    });

    test('should return true for server errors (5xx)', () => {
      expect(isRetryableError(new JamfAPIError('error', 500))).toBe(true);
      expect(isRetryableError(new JamfAPIError('error', 502))).toBe(true);
      expect(isRetryableError(new JamfAPIError('error', 503))).toBe(true);
    });

    test('should return true for RateLimitError', () => {
      expect(isRetryableError(new RateLimitError(60))).toBe(true);
    });

    test('should return false for client errors (4xx)', () => {
      expect(isRetryableError(new JamfAPIError('error', 400))).toBe(false);
      expect(isRetryableError(new JamfAPIError('error', 403))).toBe(false);
      expect(isRetryableError(new JamfAPIError('error', 404))).toBe(false);
    });

    test('should return false for AuthenticationError', () => {
      expect(isRetryableError(new AuthenticationError('auth failed'))).toBe(false);
    });

    test('should return false for plain Error', () => {
      expect(isRetryableError(new Error('generic error'))).toBe(false);
    });

    test('should return true for retryable error codes', () => {
      const error = new JamfAPIError('timeout', undefined, 'ETIMEDOUT');
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('getRetryDelay', () => {
    test('should return retry-after value for RateLimitError (in ms)', () => {
      const error = new RateLimitError(30);
      expect(getRetryDelay(error, 1000)).toBe(30000);
    });

    test('should return base delay for other errors', () => {
      const error = new JamfAPIError('error', 500);
      expect(getRetryDelay(error, 2000)).toBe(2000);
    });

    test('should return base delay for plain errors', () => {
      const error = new Error('generic');
      expect(getRetryDelay(error, 1500)).toBe(1500);
    });
  });
});
