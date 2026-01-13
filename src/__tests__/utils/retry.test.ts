import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import {
  CircuitBreaker,
  RetryableCircuitBreaker,
  retryWithBackoff,
  batchRetryWithBreaker,
  withRetry,
  getRetryConfig,
} from '../../utils/retry.js';
import { JamfAPIError, NetworkError, RateLimitError } from '../../utils/errors.js';

describe('Retry Utilities', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables to known state
    delete process.env.JAMF_MAX_RETRIES;
    delete process.env.JAMF_RETRY_DELAY;
    delete process.env.JAMF_RETRY_MAX_DELAY;
    delete process.env.JAMF_RETRY_BACKOFF_MULTIPLIER;
    delete process.env.JAMF_DEBUG_MODE;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('getRetryConfig', () => {
    test('should return default configuration', () => {
      const config = getRetryConfig();
      expect(config.maxRetries).toBe(3);
      expect(config.initialDelay).toBe(1000);
      expect(config.maxDelay).toBe(10000);
      expect(config.backoffMultiplier).toBe(2);
      expect(config.debugMode).toBe(false);
    });

    test('should use environment variables when set', () => {
      process.env.JAMF_MAX_RETRIES = '5';
      process.env.JAMF_RETRY_DELAY = '500';
      process.env.JAMF_RETRY_MAX_DELAY = '5000';
      process.env.JAMF_RETRY_BACKOFF_MULTIPLIER = '1.5';
      process.env.JAMF_DEBUG_MODE = 'true';

      const config = getRetryConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.initialDelay).toBe(500);
      expect(config.maxDelay).toBe(5000);
      expect(config.backoffMultiplier).toBe(1.5);
      expect(config.debugMode).toBe(true);
    });
  });

  describe('CircuitBreaker', () => {
    describe('state transitions', () => {
      test('should start in CLOSED state', () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 3,
          resetTimeout: 1000,
          halfOpenRequests: 2,
        });
        expect(breaker.getState()).toBe('CLOSED');
        expect(breaker.getFailureCount()).toBe(0);
      });

      test('should remain CLOSED after successful calls', async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 3,
          resetTimeout: 1000,
          halfOpenRequests: 2,
        });

        const result = await breaker.execute(async () => 'success');
        expect(result).toBe('success');
        expect(breaker.getState()).toBe('CLOSED');
        expect(breaker.getFailureCount()).toBe(0);
      });

      test('should track failures but remain CLOSED below threshold', async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 3,
          resetTimeout: 1000,
          halfOpenRequests: 2,
        });

        // Fail twice (below threshold of 3)
        for (let i = 0; i < 2; i++) {
          await expect(
            breaker.execute(async () => {
              throw new Error('Test failure');
            })
          ).rejects.toThrow('Test failure');
        }

        expect(breaker.getState()).toBe('CLOSED');
        expect(breaker.getFailureCount()).toBe(2);
      });

      test('should transition to OPEN after reaching failure threshold', async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 3,
          resetTimeout: 1000,
          halfOpenRequests: 2,
        });

        // Fail three times (at threshold)
        for (let i = 0; i < 3; i++) {
          await expect(
            breaker.execute(async () => {
              throw new Error('Test failure');
            })
          ).rejects.toThrow('Test failure');
        }

        expect(breaker.getState()).toBe('OPEN');
        expect(breaker.getFailureCount()).toBe(3);
      });

      test('should reject calls immediately when OPEN', async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 2,
          resetTimeout: 5000, // Long timeout so we stay OPEN
          halfOpenRequests: 2,
        });

        // Trigger OPEN state
        for (let i = 0; i < 2; i++) {
          await expect(
            breaker.execute(async () => {
              throw new Error('Trigger open');
            })
          ).rejects.toThrow('Trigger open');
        }

        expect(breaker.getState()).toBe('OPEN');

        // Subsequent calls should fail with circuit breaker error
        await expect(
          breaker.execute(async () => 'should not run')
        ).rejects.toThrow('Circuit breaker is OPEN');
      });

      test('should throw JamfAPIError with wait time when OPEN', async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 1,
          resetTimeout: 5000,
          halfOpenRequests: 2,
        });

        // Trigger OPEN state
        await expect(
          breaker.execute(async () => {
            throw new Error('Trigger open');
          })
        ).rejects.toThrow('Trigger open');

        // Verify the JamfAPIError structure
        try {
          await breaker.execute(async () => 'should not run');
        } catch (error) {
          expect(error).toBeInstanceOf(JamfAPIError);
          expect((error as JamfAPIError).errorCode).toBe('CIRCUIT_OPEN');
          expect((error as JamfAPIError).suggestions.length).toBeGreaterThan(0);
          expect((error as JamfAPIError).suggestions[0]).toContain('Wait');
        }
      });

      test('should transition to HALF_OPEN after reset timeout', async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 1,
          resetTimeout: 50, // Short timeout for testing
          halfOpenRequests: 2,
        });

        // Trigger OPEN state
        await expect(
          breaker.execute(async () => {
            throw new Error('Trigger open');
          })
        ).rejects.toThrow('Trigger open');

        expect(breaker.getState()).toBe('OPEN');

        // Wait for reset timeout
        await new Promise((resolve) => setTimeout(resolve, 60));

        // Next call should transition to HALF_OPEN and execute
        const result = await breaker.execute(async () => 'recovered');
        expect(result).toBe('recovered');
        expect(breaker.getState()).toBe('HALF_OPEN');
      });

      test('should return to CLOSED after successful HALF_OPEN requests', async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 1,
          resetTimeout: 50,
          halfOpenRequests: 2,
        });

        // Trigger OPEN state
        await expect(
          breaker.execute(async () => {
            throw new Error('Trigger open');
          })
        ).rejects.toThrow('Trigger open');

        // Wait for reset timeout
        await new Promise((resolve) => setTimeout(resolve, 60));

        // Make halfOpenRequests successful calls
        await breaker.execute(async () => 'success1');
        expect(breaker.getState()).toBe('HALF_OPEN');

        await breaker.execute(async () => 'success2');
        expect(breaker.getState()).toBe('CLOSED');
        expect(breaker.getFailureCount()).toBe(0);
      });

      test('should return to OPEN on failure during HALF_OPEN', async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 1,
          resetTimeout: 50,
          halfOpenRequests: 3,
        });

        // Trigger OPEN state
        await expect(
          breaker.execute(async () => {
            throw new Error('Trigger open');
          })
        ).rejects.toThrow('Trigger open');

        // Wait for reset timeout
        await new Promise((resolve) => setTimeout(resolve, 60));

        // First success moves to HALF_OPEN
        await breaker.execute(async () => 'success');
        expect(breaker.getState()).toBe('HALF_OPEN');

        // Failure during HALF_OPEN returns to OPEN
        await expect(
          breaker.execute(async () => {
            throw new Error('Half-open failure');
          })
        ).rejects.toThrow('Half-open failure');

        expect(breaker.getState()).toBe('OPEN');
      });

      test('should reset failure count on success in CLOSED state', async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 3,
          resetTimeout: 1000,
          halfOpenRequests: 2,
        });

        // Fail twice
        for (let i = 0; i < 2; i++) {
          await expect(
            breaker.execute(async () => {
              throw new Error('Failure');
            })
          ).rejects.toThrow('Failure');
        }
        expect(breaker.getFailureCount()).toBe(2);

        // Success resets count
        await breaker.execute(async () => 'success');
        expect(breaker.getFailureCount()).toBe(0);
      });
    });
  });

  describe('retryWithBackoff', () => {
    test('should succeed on first attempt without retrying', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(fn as () => Promise<string>);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should retry on retryable errors', async () => {
      const networkError = new NetworkError('Connection failed');
      const fn = jest
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const result = await retryWithBackoff(fn as () => Promise<string>, {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test('should not retry on non-retryable errors', async () => {
      const validationError = new JamfAPIError('Validation failed', 400);
      const fn = jest.fn().mockRejectedValue(validationError);

      await expect(
        retryWithBackoff(fn as () => Promise<string>, {
          maxRetries: 3,
          initialDelay: 10,
        })
      ).rejects.toThrow('Validation failed');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should respect maxRetries limit', async () => {
      const networkError = new NetworkError('Connection failed');
      const fn = jest.fn().mockRejectedValue(networkError);

      await expect(
        retryWithBackoff(fn as () => Promise<string>, {
          maxRetries: 2,
          initialDelay: 10,
          maxDelay: 100,
        })
      ).rejects.toThrow('Connection failed');

      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test('should use custom retry condition', async () => {
      const customError = new Error('Custom error');
      const fn = jest
        .fn()
        .mockRejectedValueOnce(customError)
        .mockResolvedValue('success');

      const result = await retryWithBackoff(fn as () => Promise<string>, {
        maxRetries: 3,
        initialDelay: 10,
        retryCondition: (error) => error.message === 'Custom error',
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('should call onRetry callback', async () => {
      const networkError = new NetworkError('Connection failed');
      const fn = jest
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');
      const onRetry = jest.fn();

      await retryWithBackoff(fn as () => Promise<string>, {
        maxRetries: 3,
        initialDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(networkError, 1, expect.any(Number));
    });

    test('should handle RateLimitError with retry-after delay', async () => {
      const rateLimitError = new RateLimitError(1); // 1 second
      const fn = jest
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');

      const start = Date.now();
      await retryWithBackoff(fn as () => Promise<string>, {
        maxRetries: 3,
        initialDelay: 10,
      });
      const elapsed = Date.now() - start;

      expect(fn).toHaveBeenCalledTimes(2);
      // Should wait at least 1 second (1000ms) for rate limit
      expect(elapsed).toBeGreaterThanOrEqual(900); // Allow some tolerance
    });

    test('should retry on server errors (5xx)', async () => {
      const serverError = new JamfAPIError('Server Error', 503);
      const fn = jest
        .fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue('success');

      const result = await retryWithBackoff(fn as () => Promise<string>, {
        maxRetries: 2,
        initialDelay: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('RetryableCircuitBreaker', () => {
    test('should create separate circuit breakers per key', async () => {
      const rcb = new RetryableCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 5000,
        halfOpenRequests: 2,
      });

      // Trigger OPEN for key 'api-1'
      for (let i = 0; i < 2; i++) {
        await expect(
          rcb.executeWithRetry('api-1', async () => {
            throw new Error('Failure');
          })
        ).rejects.toThrow();
      }

      expect(rcb.getCircuitState('api-1')).toBe('OPEN');
      expect(rcb.getCircuitState('api-2')).toBeUndefined();

      // 'api-2' should still work
      const result = await rcb.executeWithRetry('api-2', async () => 'success');
      expect(result).toBe('success');
      expect(rcb.getCircuitState('api-2')).toBe('CLOSED');
    });

    test('should apply retry logic before circuit breaker', async () => {
      const rcb = new RetryableCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 5000,
        halfOpenRequests: 2,
      });

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new NetworkError('Retry me'))
        .mockResolvedValue('success');

      const result = await rcb.executeWithRetry('test', fn as () => Promise<string>, {
        maxRetries: 2,
        initialDelay: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(rcb.getCircuitState('test')).toBe('CLOSED');
    });

    test('should return failure count for a key', async () => {
      const rcb = new RetryableCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 5000,
        halfOpenRequests: 2,
      });

      // Cause some failures
      await expect(
        rcb.executeWithRetry(
          'failing',
          async () => {
            throw new JamfAPIError('Not retryable', 400);
          },
          { maxRetries: 0 }
        )
      ).rejects.toThrow();

      expect(rcb.getFailureCount('failing')).toBe(1);
      expect(rcb.getFailureCount('nonexistent')).toBeUndefined();
    });

    test('should reset individual circuit breaker by key', async () => {
      const rcb = new RetryableCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5000,
        halfOpenRequests: 2,
      });

      // Open circuit for 'key-1'
      await expect(
        rcb.executeWithRetry(
          'key-1',
          async () => {
            throw new JamfAPIError('Error', 400);
          },
          { maxRetries: 0 }
        )
      ).rejects.toThrow();

      expect(rcb.getCircuitState('key-1')).toBe('OPEN');

      // Reset only 'key-1'
      rcb.reset('key-1');
      expect(rcb.getCircuitState('key-1')).toBeUndefined();
    });

    test('should reset all circuit breakers', async () => {
      const rcb = new RetryableCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5000,
        halfOpenRequests: 2,
      });

      // Open circuits for multiple keys
      for (const key of ['key-1', 'key-2', 'key-3']) {
        await expect(
          rcb.executeWithRetry(
            key,
            async () => {
              throw new JamfAPIError('Error', 400);
            },
            { maxRetries: 0 }
          )
        ).rejects.toThrow();
      }

      expect(rcb.getCircuitState('key-1')).toBe('OPEN');
      expect(rcb.getCircuitState('key-2')).toBe('OPEN');
      expect(rcb.getCircuitState('key-3')).toBe('OPEN');

      // Reset all
      rcb.reset();
      expect(rcb.getCircuitState('key-1')).toBeUndefined();
      expect(rcb.getCircuitState('key-2')).toBeUndefined();
      expect(rcb.getCircuitState('key-3')).toBeUndefined();
    });

    test('should use default options when not provided', async () => {
      const rcb = new RetryableCircuitBreaker(); // No options

      // Should work with defaults (failureThreshold: 5, resetTimeout: 60000)
      const result = await rcb.executeWithRetry('default', async () => 'success');
      expect(result).toBe('success');
      expect(rcb.getCircuitState('default')).toBe('CLOSED');
    });
  });

  describe('withRetry', () => {
    test('should wrap function with retry logic', async () => {
      const originalFn = jest
        .fn()
        .mockRejectedValueOnce(new NetworkError('Temp failure'))
        .mockResolvedValue('success');

      const wrappedFn = withRetry(originalFn as () => Promise<string>, {
        maxRetries: 2,
        initialDelay: 10,
      });

      const result = await wrappedFn();
      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledTimes(2);
    });

    test('should pass arguments through to wrapped function', async () => {
      const originalFn = jest.fn().mockImplementation(async (a: number, b: number) => a + b);

      const wrappedFn = withRetry(originalFn as (a: number, b: number) => Promise<number>);

      const result = await wrappedFn(2, 3);
      expect(result).toBe(5);
      expect(originalFn).toHaveBeenCalledWith(2, 3);
    });
  });

  describe('batchRetryWithBreaker', () => {
    test('should execute all operations and return results', async () => {
      const breaker = new RetryableCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 5000,
        halfOpenRequests: 2,
      });

      const operations = [
        async () => 'result1',
        async () => 'result2',
        async () => 'result3',
      ];

      const results = await batchRetryWithBreaker(operations, breaker, 'test', {
        maxRetries: 2,
        initialDelay: 10,
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ success: true, result: 'result1' });
      expect(results[1]).toEqual({ success: true, result: 'result2' });
      expect(results[2]).toEqual({ success: true, result: 'result3' });
    });

    test('should handle mixed success and failure', async () => {
      const breaker = new RetryableCircuitBreaker({
        failureThreshold: 10,
        resetTimeout: 5000,
        halfOpenRequests: 2,
      });

      const operations = [
        async () => 'success',
        async () => {
          throw new JamfAPIError('Validation error', 400);
        },
        async () => 'another success',
      ];

      const results = await batchRetryWithBreaker(operations, breaker, 'mixed', {
        maxRetries: 0, // No retries for this test
        initialDelay: 10,
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ success: true, result: 'success' });
      expect(results[1].success).toBe(false);
      expect((results[1] as { success: false; error: Error }).error).toBeInstanceOf(JamfAPIError);
      expect(results[2]).toEqual({ success: true, result: 'another success' });
    });

    test('should use key prefix for circuit breakers', async () => {
      const breaker = new RetryableCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5000,
        halfOpenRequests: 2,
      });

      const operations = [
        async () => {
          throw new JamfAPIError('Error', 400);
        },
      ];

      await batchRetryWithBreaker(operations, breaker, 'custom-prefix', {
        maxRetries: 0,
      });

      // Circuit breaker created with custom prefix
      expect(breaker.getCircuitState('custom-prefix-0')).toBe('OPEN');
    });

    test('should handle empty operations array', async () => {
      const breaker = new RetryableCircuitBreaker();
      const results = await batchRetryWithBreaker([], breaker);
      expect(results).toEqual([]);
    });
  });
});
