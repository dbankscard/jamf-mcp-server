import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import {
  retryWithBackoff,
  CircuitBreaker,
  RetryableCircuitBreaker,
  getRetryConfig,
  withRetry,
  batchRetryWithBreaker
} from '../../utils/retry.js';
import { JamfAPIError, NetworkError } from '../../utils/errors.js';

describe('Retry Utilities', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getRetryConfig', () => {
    test('should return defaults when no env vars set', () => {
      delete process.env.JAMF_MAX_RETRIES;
      delete process.env.JAMF_RETRY_DELAY;
      delete process.env.JAMF_RETRY_MAX_DELAY;
      delete process.env.JAMF_RETRY_BACKOFF_MULTIPLIER;
      delete process.env.JAMF_DEBUG_MODE;

      const config = getRetryConfig();
      expect(config.maxRetries).toBe(3);
      expect(config.initialDelay).toBe(1000);
      expect(config.maxDelay).toBe(10000);
      expect(config.backoffMultiplier).toBe(2);
      expect(config.debugMode).toBe(false);
    });

    test('should read from environment variables', () => {
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

  describe('retryWithBackoff', () => {
    test('should return result on immediate success', async () => {
      const fn = jest.fn<() => Promise<string>>().mockResolvedValue('success');

      const result = await retryWithBackoff(fn, { maxRetries: 3, initialDelay: 1 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should retry on retryable error and eventually succeed', async () => {
      const fn = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new NetworkError('connection failed'))
        .mockRejectedValueOnce(new NetworkError('connection failed'))
        .mockResolvedValue('recovered');

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 1,
        maxDelay: 10
      });

      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test('should throw after max retries exceeded', async () => {
      const fn = jest.fn<() => Promise<string>>()
        .mockRejectedValue(new NetworkError('always fails'));

      await expect(retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelay: 1,
        maxDelay: 10
      })).rejects.toThrow('always fails');

      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    test('should not retry non-retryable errors', async () => {
      const fn = jest.fn<() => Promise<string>>()
        .mockRejectedValue(new JamfAPIError('bad request', 400));

      await expect(retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 1
      })).rejects.toThrow('bad request');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should use custom retry condition', async () => {
      const fn = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('custom retryable'))
        .mockResolvedValue('ok');

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 1,
        retryCondition: (err) => err.message.includes('custom retryable')
      });

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const fn = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new NetworkError('fail'))
        .mockResolvedValue('ok');

      await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 1,
        maxDelay: 10,
        onRetry
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(NetworkError),
        1,
        expect.any(Number)
      );
    });

    test('should work with zero retries (no retry)', async () => {
      const fn = jest.fn<() => Promise<string>>()
        .mockRejectedValue(new NetworkError('fail'));

      await expect(retryWithBackoff(fn, {
        maxRetries: 0,
        initialDelay: 1
      })).rejects.toThrow('fail');

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('CircuitBreaker', () => {
    test('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
        halfOpenRequests: 2
      });

      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getFailureCount()).toBe(0);
    });

    test('should allow successful calls in CLOSED state', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
        halfOpenRequests: 2
      });

      const result = await breaker.execute(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
      expect(breaker.getState()).toBe('CLOSED');
    });

    test('should open after failure threshold is reached', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 60000,
        halfOpenRequests: 1
      });

      // Fail twice to hit threshold
      await expect(breaker.execute(() => Promise.reject(new Error('fail 1')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail 2')))).rejects.toThrow();

      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.getFailureCount()).toBe(2);
    });

    test('should reject calls when OPEN', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 60000,
        halfOpenRequests: 1
      });

      // Open the circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Should reject without calling the function
      await expect(breaker.execute(() => Promise.resolve('should not run')))
        .rejects.toThrow('Circuit breaker is OPEN');
    });

    test('should transition to HALF_OPEN after reset timeout', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 50, // 50ms for testing
        halfOpenRequests: 1
      });

      // Open the circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should transition to HALF_OPEN and allow the call
      const result = await breaker.execute(() => Promise.resolve('recovered'));
      expect(result).toBe('recovered');
      expect(breaker.getState()).toBe('CLOSED'); // With halfOpenRequests=1, one success closes it
    });

    test('should return to OPEN from HALF_OPEN on failure', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 50,
        halfOpenRequests: 2
      });

      // Open the circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));

      // Fail in HALF_OPEN state
      await expect(breaker.execute(() => Promise.reject(new Error('fail again')))).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');
    });

    test('should require multiple successes in HALF_OPEN before closing', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 50,
        halfOpenRequests: 3
      });

      // Open the circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));

      // First success in HALF_OPEN
      await breaker.execute(() => Promise.resolve('ok'));
      expect(breaker.getState()).toBe('HALF_OPEN');

      // Second success
      await breaker.execute(() => Promise.resolve('ok'));
      expect(breaker.getState()).toBe('HALF_OPEN');

      // Third success -- should close
      await breaker.execute(() => Promise.resolve('ok'));
      expect(breaker.getState()).toBe('CLOSED');
    });

    test('should reset failure count on success in CLOSED state', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60000,
        halfOpenRequests: 1
      });

      // One failure
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      expect(breaker.getFailureCount()).toBe(1);

      // Success resets counter
      await breaker.execute(() => Promise.resolve('ok'));
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe('RetryableCircuitBreaker', () => {
    test('should create circuit breakers per key', async () => {
      const rcb = new RetryableCircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60000,
        halfOpenRequests: 1
      });

      await rcb.executeWithRetry('key1', () => Promise.resolve('ok'), {
        maxRetries: 0,
        initialDelay: 1
      });

      expect(rcb.getCircuitState('key1')).toBe('CLOSED');
      expect(rcb.getCircuitState('key2')).toBeUndefined();
    });

    test('should return failure count for key', async () => {
      const rcb = new RetryableCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000,
        halfOpenRequests: 1
      });

      try {
        await rcb.executeWithRetry('api', () => Promise.reject(new Error('fail')), {
          maxRetries: 0,
          initialDelay: 1
        });
      } catch {
        // expected
      }

      expect(rcb.getFailureCount('api')).toBe(1);
    });

    test('should reset specific key', async () => {
      const rcb = new RetryableCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000,
        halfOpenRequests: 1
      });

      await rcb.executeWithRetry('key1', () => Promise.resolve('ok'), {
        maxRetries: 0,
        initialDelay: 1
      });
      await rcb.executeWithRetry('key2', () => Promise.resolve('ok'), {
        maxRetries: 0,
        initialDelay: 1
      });

      rcb.reset('key1');
      expect(rcb.getCircuitState('key1')).toBeUndefined();
      expect(rcb.getCircuitState('key2')).toBe('CLOSED');
    });

    test('should reset all keys', async () => {
      const rcb = new RetryableCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000,
        halfOpenRequests: 1
      });

      await rcb.executeWithRetry('key1', () => Promise.resolve('ok'), {
        maxRetries: 0,
        initialDelay: 1
      });
      await rcb.executeWithRetry('key2', () => Promise.resolve('ok'), {
        maxRetries: 0,
        initialDelay: 1
      });

      rcb.reset();
      expect(rcb.getCircuitState('key1')).toBeUndefined();
      expect(rcb.getCircuitState('key2')).toBeUndefined();
    });
  });

  describe('withRetry', () => {
    test('should wrap a function with retry behavior', async () => {
      let calls = 0;
      const fn = async (x: number): Promise<number> => {
        calls++;
        if (calls < 3) throw new NetworkError('fail');
        return x * 2;
      };

      const retried = withRetry(fn, { maxRetries: 3, initialDelay: 1, maxDelay: 10 });
      const result = await retried(5);

      expect(result).toBe(10);
      expect(calls).toBe(3);
    });
  });

  describe('batchRetryWithBreaker', () => {
    test('should execute batch of operations and return results', async () => {
      const breaker = new RetryableCircuitBreaker({
        failureThreshold: 10,
        resetTimeout: 60000,
        halfOpenRequests: 1
      });

      const operations = [
        () => Promise.resolve('a'),
        () => Promise.resolve('b'),
        () => Promise.reject(new Error('c failed')),
      ];

      const results = await batchRetryWithBreaker(operations, breaker, 'test', {
        maxRetries: 0,
        initialDelay: 1
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ success: true, result: 'a' });
      expect(results[1]).toEqual({ success: true, result: 'b' });
      expect(results[2].success).toBe(false);
      expect((results[2] as any).error.message).toBe('c failed');
    });
  });
});
