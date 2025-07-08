import { AxiosError } from 'axios';

/**
 * Base error class for all Jamf API errors
 */
export class JamfAPIError extends Error {
  public readonly statusCode?: number;
  public readonly errorCode?: string;
  public readonly suggestions: string[];
  public readonly context?: Record<string, any>;
  public readonly originalError?: Error;

  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    suggestions: string[] = [],
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message);
    this.name = 'JamfAPIError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.suggestions = suggestions;
    this.context = context;
    this.originalError = originalError;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, JamfAPIError);
    }
  }

  /**
   * Create JamfAPIError from an AxiosError
   */
  static fromAxiosError(error: AxiosError, context?: Record<string, any>): JamfAPIError {
    const statusCode = error.response?.status;
    const errorData = error.response?.data as any;
    
    let message = error.message;
    let errorCode = errorData?.errorCode || errorData?.code;
    let suggestions: string[] = [];

    // Handle common HTTP status codes with helpful suggestions
    switch (statusCode) {
      case 400:
        message = `Bad Request: ${errorData?.message || errorData?.error || error.message}`;
        suggestions = [
          'Check the request parameters and data format',
          'Ensure all required fields are provided',
          'Verify the data types match the API requirements'
        ];
        break;
      case 401:
        return new AuthenticationError(
          `Authentication failed: ${errorData?.message || 'Invalid or expired credentials'}`,
          context
        );
      case 403:
        message = `Forbidden: ${errorData?.message || 'Insufficient permissions'}`;
        suggestions = [
          'Verify your API client has the required permissions',
          'Check if the resource is restricted by Jamf Pro settings',
          'Ensure your API client has the correct scope'
        ];
        break;
      case 404:
        message = `Not Found: ${errorData?.message || 'The requested resource does not exist'}`;
        suggestions = [
          'Verify the resource ID is correct',
          'Check if the resource has been deleted',
          'Ensure you\'re using the correct API endpoint'
        ];
        break;
      case 409:
        message = `Conflict: ${errorData?.message || 'Resource conflict detected'}`;
        suggestions = [
          'Check for duplicate resources',
          'Verify unique constraints are satisfied',
          'Ensure no concurrent modifications are happening'
        ];
        break;
      case 429:
        return new RateLimitError(
          parseInt(error.response?.headers?.['retry-after'] || '60'),
          error.response?.headers?.['x-ratelimit-limit'],
          error.response?.headers?.['x-ratelimit-remaining'],
          context
        );
      case 500:
      case 502:
      case 503:
      case 504:
        message = `Server Error (${statusCode}): ${errorData?.message || 'Internal server error'}`;
        suggestions = [
          'This is likely a temporary issue, retry the request',
          'Check Jamf Pro server status',
          'If the problem persists, contact Jamf support'
        ];
        break;
    }

    // Add request details to error message
    if (error.config) {
      const { method, url } = error.config;
      message = `${message} [${method?.toUpperCase()} ${url}]`;
    }

    return new JamfAPIError(
      message,
      statusCode,
      errorCode,
      suggestions,
      context,
      error
    );
  }

  /**
   * Format error for display
   */
  toDetailedString(): string {
    let result = `${this.name}: ${this.message}`;
    
    if (this.statusCode) {
      result += `\nStatus Code: ${this.statusCode}`;
    }
    
    if (this.errorCode) {
      result += `\nError Code: ${this.errorCode}`;
    }
    
    if (this.suggestions.length > 0) {
      result += '\n\nSuggestions:';
      this.suggestions.forEach((suggestion, index) => {
        result += `\n  ${index + 1}. ${suggestion}`;
      });
    }
    
    if (this.context && Object.keys(this.context).length > 0) {
      result += '\n\nContext:';
      Object.entries(this.context).forEach(([key, value]) => {
        result += `\n  ${key}: ${JSON.stringify(value)}`;
      });
    }
    
    return result;
  }
}

/**
 * Network-related errors (connection failures, timeouts, etc.)
 */
export class NetworkError extends JamfAPIError {
  constructor(message: string, context?: Record<string, any>, originalError?: Error) {
    const suggestions = [
      'Check your network connection',
      'Verify the Jamf Pro server URL is correct',
      'Ensure the Jamf Pro server is accessible',
      'Check for firewall or proxy issues',
      'Try increasing the timeout duration'
    ];
    
    super(message, undefined, 'NETWORK_ERROR', suggestions, context, originalError);
    this.name = 'NetworkError';
  }

  static fromError(error: Error, context?: Record<string, any>): NetworkError {
    let message = 'Network error occurred';
    
    if (error.message.includes('ECONNREFUSED')) {
      message = 'Connection refused - unable to connect to Jamf Pro server';
    } else if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNABORTED')) {
      message = 'Request timed out - the server took too long to respond';
    } else if (error.message.includes('ENOTFOUND')) {
      message = 'Server not found - check the Jamf Pro URL';
    } else if (error.message.includes('ECONNRESET')) {
      message = 'Connection reset - the server closed the connection unexpectedly';
    } else {
      message = `Network error: ${error.message}`;
    }
    
    return new NetworkError(message, context, error);
  }
}

/**
 * Authentication-specific errors
 */
export class AuthenticationError extends JamfAPIError {
  constructor(message: string, context?: Record<string, any>) {
    const suggestions = [
      'Verify your API client ID and client secret are correct',
      'Check if the API client has been disabled',
      'Ensure the API client has not expired',
      'Try regenerating the API credentials',
      'Check if OAuth2 is properly configured in Jamf Pro'
    ];
    
    super(message, 401, 'AUTH_ERROR', suggestions, context);
    this.name = 'AuthenticationError';
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends JamfAPIError {
  public readonly retryAfter: number;
  public readonly limit?: string;
  public readonly remaining?: string;

  constructor(
    retryAfter: number,
    limit?: string,
    remaining?: string,
    context?: Record<string, any>
  ) {
    const message = `Rate limit exceeded. Retry after ${retryAfter} seconds`;
    const suggestions = [
      `Wait ${retryAfter} seconds before retrying`,
      'Implement request throttling to avoid rate limits',
      'Consider batching requests where possible',
      'Check if you can increase your API rate limits'
    ];
    
    super(message, 429, 'RATE_LIMIT', suggestions, context);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.remaining = remaining;
  }
}

/**
 * Validation errors for input data
 */
export class ValidationError extends JamfAPIError {
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    fieldErrors?: Record<string, string[]>,
    context?: Record<string, any>
  ) {
    const suggestions = [
      'Review the input data against the API documentation',
      'Check for missing required fields',
      'Ensure data types match the expected format',
      'Validate enum values are from the allowed set'
    ];
    
    super(message, 400, 'VALIDATION_ERROR', suggestions, context);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }

  toDetailedString(): string {
    let result = super.toDetailedString();
    
    if (this.fieldErrors && Object.keys(this.fieldErrors).length > 0) {
      result += '\n\nField Errors:';
      Object.entries(this.fieldErrors).forEach(([field, errors]) => {
        result += `\n  ${field}:`;
        errors.forEach(error => {
          result += `\n    - ${error}`;
        });
      });
    }
    
    return result;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends JamfAPIError {
  constructor(message: string, context?: Record<string, any>) {
    const suggestions = [
      'Check your environment variables are set correctly',
      'Verify the configuration file format',
      'Ensure all required configuration options are provided',
      'Check for typos in configuration keys'
    ];
    
    super(message, undefined, 'CONFIG_ERROR', suggestions, context);
    this.name = 'ConfigurationError';
  }
}

/**
 * Helper function to determine if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof NetworkError) {
    return true;
  }
  
  if (error instanceof JamfAPIError) {
    // Retry on server errors (5xx)
    if (error.statusCode && error.statusCode >= 500) {
      return true;
    }
    
    // Retry on rate limit errors (with appropriate delay)
    if (error instanceof RateLimitError) {
      return true;
    }
    
    // Retry on specific error codes that are known to be transient
    const retryableErrorCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED'];
    if (error.errorCode && retryableErrorCodes.includes(error.errorCode)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get retry delay for an error
 */
export function getRetryDelay(error: Error, baseDelay: number): number {
  if (error instanceof RateLimitError) {
    // Use the retry-after header value
    return error.retryAfter * 1000;
  }
  
  // Default exponential backoff
  return baseDelay;
}