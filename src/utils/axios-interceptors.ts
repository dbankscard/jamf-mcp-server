import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { JamfAPIError, NetworkError, AuthenticationError, isRetryableError } from './errors.js';
import { retryWithBackoff, getRetryConfig } from './retry.js';

// Extend AxiosRequestConfig to include our custom properties
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime?: number;
      retryAttempt?: number;
    };
    isRetry?: boolean;
  }
}

export interface InterceptorOptions {
  enableRetry?: boolean;
  enableLogging?: boolean;
  enableErrorEnhancement?: boolean;
  onRequest?: (config: InternalAxiosRequestConfig) => void;
  onResponse?: (response: AxiosResponse) => void;
  onError?: (error: Error) => void;
  retryOptions?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
  };
}

/**
 * Setup axios interceptors with retry logic and enhanced error handling
 */
export function setupAxiosInterceptors(
  axiosInstance: AxiosInstance,
  options: InterceptorOptions = {}
): void {
  const config = getRetryConfig();
  const {
    enableRetry = true,
    enableLogging = config.debugMode,
    enableErrorEnhancement = true,
    onRequest,
    onResponse,
    onError,
    retryOptions = {}
  } = options;

  // Request interceptor
  axiosInstance.interceptors.request.use(
    (config) => {
      // Add request timestamp for timing
      config.metadata = { startTime: Date.now() };
      
      // Add request ID for tracking
      config.headers['X-Request-ID'] = generateRequestId();
      
      // Log request in debug mode
      if (enableLogging) {
        console.error('[HTTP Request]', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          headers: sanitizeHeaders(config.headers),
          data: config.data ? '[Data Present]' : undefined,
          requestId: config.headers['X-Request-ID']
        });
      }
      
      onRequest?.(config);
      return config;
    },
    (error) => {
      if (enableLogging) {
        console.error('[HTTP Request Error]', error.message);
      }
      return Promise.reject(enhanceError(error));
    }
  );

  // Response interceptor
  axiosInstance.interceptors.response.use(
    (response) => {
      // Calculate request duration
      const duration = response.config.metadata?.startTime 
        ? Date.now() - response.config.metadata.startTime 
        : undefined;
      
      // Log response in debug mode
      if (enableLogging) {
        console.error('[HTTP Response]', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
          duration: duration ? `${duration}ms` : undefined,
          requestId: response.config.headers?.['X-Request-ID'],
          dataSize: JSON.stringify(response.data).length
        });
      }
      
      onResponse?.(response);
      return response;
    },
    async (error: AxiosError) => {
      const enhancedError = enhanceError(error);
      
      // Log error in debug mode
      if (enableLogging) {
        console.error('[HTTP Error]', {
          message: enhancedError.message,
          status: error.response?.status,
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          requestId: error.config?.headers?.['X-Request-ID'],
          duration: error.config?.metadata?.startTime 
            ? `${Date.now() - error.config.metadata.startTime}ms` 
            : undefined
        });
      }
      
      onError?.(enhancedError);
      
      // Don't retry if retry is disabled or if we're already in a retry
      if (!enableRetry || error.config?.isRetry) {
        throw enhancedError;
      }
      
      // Check if error is retryable
      if (!isRetryableError(enhancedError)) {
        throw enhancedError;
      }
      
      // Retry the request
      try {
        const result = await retryWithBackoff(
          async () => {
            const retryConfig = {
              ...error.config!,
              isRetry: true,
              metadata: {
                ...error.config?.metadata,
                retryAttempt: (error.config?.metadata?.retryAttempt || 0) + 1
              }
            } as InternalAxiosRequestConfig;
            
            return axiosInstance.request(retryConfig);
          },
          {
            ...retryOptions,
            onRetry: (retryError, attempt, delay) => {
              if (enableLogging) {
                console.error('[HTTP Retry]', {
                  attempt,
                  delay: `${Math.round(delay)}ms`,
                  url: error.config?.url,
                  error: retryError.message
                });
              }
            }
          }
        );
        
        return result;
      } catch (retryError) {
        // If retry fails, throw the enhanced error
        throw enhanceError(retryError as AxiosError);
      }
    }
  );
}

/**
 * Enhance error with additional context and suggestions
 */
function enhanceError(error: any): Error {
  // Handle network errors
  if (error.code && ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'ECONNABORTED'].includes(error.code)) {
    return NetworkError.fromError(error, {
      url: error.config?.url,
      method: error.config?.method,
      timeout: error.config?.timeout
    });
  }
  
  // Handle Axios errors
  if (error.isAxiosError) {
    const axiosError = error as AxiosError;
    const context = {
      url: axiosError.config?.url,
      method: axiosError.config?.method,
      requestId: axiosError.config?.headers?.['X-Request-ID']
    };
    
    // Special handling for authentication errors
    if (axiosError.response?.status === 401) {
      return new AuthenticationError(
        `Authentication failed: ${(axiosError.response.data as any)?.message || 'Invalid or expired credentials'}`,
        context
      );
    }
    
    return JamfAPIError.fromAxiosError(axiosError, context);
  }
  
  // Return original error if not enhanced
  return error;
}

/**
 * Create an axios instance with interceptors pre-configured
 */
export function createAxiosInstanceWithInterceptors(
  baseConfig: AxiosRequestConfig = {},
  interceptorOptions: InterceptorOptions = {}
): AxiosInstance {
  const instance = axios.create({
    timeout: 30000, // 30 seconds default timeout
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    ...baseConfig
  });
  
  setupAxiosInterceptors(instance, interceptorOptions);
  
  return instance;
}

/**
 * Rate limit handler for axios
 */
export class RateLimitHandler {
  private requestQueue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  
  constructor(
    private minRequestInterval: number = 100, // Minimum ms between requests
    private maxConcurrent: number = 5
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      // Respect rate limit
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await sleep(this.minRequestInterval - timeSinceLastRequest);
      }
      
      // Process batch of requests
      const batch = this.requestQueue.splice(0, this.maxConcurrent);
      this.lastRequestTime = Date.now();
      
      await Promise.all(batch.map(fn => fn()));
    }
    
    this.processing = false;
  }
}

/**
 * Helper functions
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  
  // Remove sensitive headers from logs
  const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a rate-limited axios instance
 */
export function createRateLimitedAxios(
  baseConfig: AxiosRequestConfig = {},
  rateLimitOptions: { minRequestInterval?: number; maxConcurrent?: number } = {},
  interceptorOptions: InterceptorOptions = {}
): { instance: AxiosInstance; rateLimiter: RateLimitHandler } {
  const instance = createAxiosInstanceWithInterceptors(baseConfig, interceptorOptions);
  const rateLimiter = new RateLimitHandler(
    rateLimitOptions.minRequestInterval,
    rateLimitOptions.maxConcurrent
  );
  
  // Wrap the request method to use rate limiter
  const originalRequest = instance.request.bind(instance);
  instance.request = function(config: AxiosRequestConfig) {
    return rateLimiter.execute(() => originalRequest(config));
  };
  
  return { instance, rateLimiter };
}