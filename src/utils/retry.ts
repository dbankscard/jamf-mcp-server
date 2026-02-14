import { isRetryableError, getRetryDelay, JamfAPIError } from './errors.js';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (error: Error, retryCount: number, delay: number) => void;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenRequests?: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  debugMode: boolean;
}

/**
 * Get retry configuration from environment variables
 */
export function getRetryConfig(): RetryConfig {
  return {
    maxRetries: parseInt(process.env.JAMF_MAX_RETRIES || '3'),
    initialDelay: parseInt(process.env.JAMF_RETRY_DELAY || '1000'),
    maxDelay: parseInt(process.env.JAMF_RETRY_MAX_DELAY || '10000'),
    backoffMultiplier: parseFloat(process.env.JAMF_RETRY_BACKOFF_MULTIPLIER || '2'),
    debugMode: process.env.JAMF_DEBUG_MODE === 'true'
  };
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private halfOpenAttempts = 0;
  
  constructor(private options: Required<CircuitBreakerOptions>) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      const now = new Date();
      const timeSinceLastFailure = this.lastFailureTime 
        ? now.getTime() - this.lastFailureTime.getTime()
        : 0;
      
      if (timeSinceLastFailure < this.options.resetTimeout) {
        throw new JamfAPIError(
          'Circuit breaker is OPEN - too many failures',
          undefined,
          'CIRCUIT_OPEN',
          [`Wait ${Math.ceil((this.options.resetTimeout - timeSinceLastFailure) / 1000)} seconds before retrying`]
        );
      }
      
      // Move to half-open state
      this.state = 'HALF_OPEN';
      this.halfOpenAttempts = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.options.halfOpenRequests) {
        // Circuit recovered
        this.state = 'CLOSED';
        this.failures = 0;
        this.halfOpenAttempts = 0;
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.state === 'HALF_OPEN' || this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = getRetryConfig();
  const {
    maxRetries = config.maxRetries,
    initialDelay = config.initialDelay,
    maxDelay = config.maxDelay,
    backoffMultiplier = config.backoffMultiplier,
    retryCondition = isRetryableError,
    onRetry
  } = options;

  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry
      if (attempt === maxRetries || !retryCondition(lastError)) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const baseDelay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * baseDelay;
      const delay = getRetryDelay(lastError, baseDelay) + jitter;
      
      // Log retry attempt
      if (config.debugMode || onRetry) {
        const message = `Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`;
        if (config.debugMode) {
          console.error(`[RETRY] ${message}`, {
            error: lastError.message,
            attempt: attempt + 1,
            delay: Math.round(delay)
          });
        }
        onRetry?.(lastError, attempt + 1, delay);
      }
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Circuit breaker with retry
 */
export class RetryableCircuitBreaker {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  
  constructor(
    private circuitBreakerOptions: CircuitBreakerOptions = {}
  ) {}

  async executeWithRetry<T>(
    key: string,
    fn: () => Promise<T>,
    retryOptions?: RetryOptions
  ): Promise<T> {
    const breaker = this.getOrCreateBreaker(key);
    
    return retryWithBackoff(
      () => breaker.execute(fn),
      retryOptions
    );
  }

  private getOrCreateBreaker(key: string): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker({
        failureThreshold: this.circuitBreakerOptions.failureThreshold || 5,
        resetTimeout: this.circuitBreakerOptions.resetTimeout || 60000, // 60 seconds
        halfOpenRequests: this.circuitBreakerOptions.halfOpenRequests || 3
      }));
    }
    
    return this.circuitBreakers.get(key)!;
  }

  getCircuitState(key: string): string | undefined {
    return this.circuitBreakers.get(key)?.getState();
  }

  getFailureCount(key: string): number | undefined {
    return this.circuitBreakers.get(key)?.getFailureCount();
  }

  reset(key?: string): void {
    if (key) {
      this.circuitBreakers.delete(key);
    } else {
      this.circuitBreakers.clear();
    }
  }
}

/**
 * Helper sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a retry wrapper for a function
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: RetryOptions
): T {
  return (async (...args: Parameters<T>) => {
    return retryWithBackoff(() => fn(...args), options);
  }) as T;
}

/**
 * Batch retry operations with circuit breaker
 */
export async function batchRetryWithBreaker<T>(
  operations: Array<() => Promise<T>>,
  breaker: RetryableCircuitBreaker,
  keyPrefix: string = 'batch',
  options?: RetryOptions
): Promise<Array<{ success: true; result: T } | { success: false; error: Error }>> {
  const results = await Promise.allSettled(
    operations.map((op, index) =>
      breaker.executeWithRetry(`${keyPrefix}-${index}`, op, options)
    )
  );
  
  return results.map(result => {
    if (result.status === 'fulfilled') {
      return { success: true, result: result.value };
    } else {
      return { success: false, error: result.reason };
    }
  });
}