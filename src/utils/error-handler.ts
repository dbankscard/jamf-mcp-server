/**
 * Centralized error handling utilities
 */

import { createLogger } from '../server/logger.js';
import { JamfAPIError, NetworkError, AuthenticationError, ValidationError, RateLimitError } from './errors.js';
import { Request, Response, NextFunction } from 'express';

const logger = createLogger('error-handler');

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Convert any error to JamfAPIError
 */
export function normalizeError(error: any, context?: Record<string, any>): JamfAPIError {
  if (error instanceof JamfAPIError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for network errors
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('ETIMEDOUT') || 
        error.message.includes('ENOTFOUND')) {
      return NetworkError.fromError(error, context);
    }

    // Check for auth errors
    if (error.message.toLowerCase().includes('unauthorized') || 
        error.message.toLowerCase().includes('authentication')) {
      return new AuthenticationError(error.message, context);
    }

    // Generic error
    return new JamfAPIError(
      error.message,
      undefined,
      'UNKNOWN_ERROR',
      ['Check the logs for more details'],
      context,
      error
    );
  }

  // Not an Error object
  return new JamfAPIError(
    String(error),
    undefined,
    'UNKNOWN_ERROR',
    ['An unexpected error occurred'],
    context
  );
}

/**
 * Express async handler wrapper
 */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
): (req: T, res: Response, next: NextFunction) => void {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      const jamfError = normalizeError(error, {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });

      logger.error('Request failed', {
        error: jamfError.toDetailedString(),
        requestId: (req as any).id,
      });

      next(jamfError);
    });
  };
}

/**
 * Express error handling middleware
 */
export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const jamfError = normalizeError(error, {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // Log error details
  logger.error('Error middleware caught error', {
    error: jamfError.toDetailedString(),
    requestId: (req as any).id,
    statusCode: jamfError.statusCode || 500,
  });

  // Send error response
  const statusCode = jamfError.statusCode || 500;
  const errorResponse: ErrorResponse = {
    error: {
      code: jamfError.errorCode || 'INTERNAL_ERROR',
      message: jamfError.message,
      timestamp: new Date().toISOString(),
      requestId: (req as any).id,
    },
  };

  // Include details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = {
      suggestions: jamfError.suggestions,
      context: jamfError.context,
    };
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Unhandled rejection handler
 */
export function setupGlobalErrorHandlers(): void {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });

    // In production, exit gracefully
    if (process.env.NODE_ENV === 'production') {
      logger.error('Shutting down due to unhandled rejection');
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });

    // Always exit on uncaught exceptions
    logger.error('Shutting down due to uncaught exception');
    process.exit(1);
  });
}

/**
 * Async operation with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = 'Operation'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new NetworkError(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T = any>(
  json: string,
  defaultValue: T | null = null
): T | null {
  try {
    return JSON.parse(json);
  } catch (error) {
    logger.warn('Failed to parse JSON', {
      error: error instanceof Error ? error.message : String(error),
      json: json.substring(0, 100), // Log first 100 chars only
    });
    return defaultValue;
  }
}

/**
 * Execute async function with error logging
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  operationName: string,
  context?: Record<string, any>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const jamfError = normalizeError(error, context);
    logger.error(`${operationName} failed`, {
      error: jamfError.toDetailedString(),
      context,
    });
    throw jamfError;
  }
}

/**
 * Execute async function with fallback
 */
export async function executeWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    return await primary();
  } catch (primaryError) {
    logger.warn(`${operationName} primary failed, trying fallback`, {
      primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError),
    });

    try {
      return await fallback();
    } catch (fallbackError) {
      logger.error(`${operationName} fallback also failed`, {
        fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
      throw primaryError; // Throw original error
    }
  }
}

/**
 * Structured error context for capturing full error details
 */
export interface ErrorContext {
  /** The operation that was being performed */
  operation: string;
  /** Human-readable error message */
  message: string;
  /** Technical error code for programmatic handling */
  code?: string;
  /** The component/module where the error occurred */
  component?: string;
  /** Original stack trace, preserved through promise chains */
  stack?: string;
  /** Additional metadata about the error */
  metadata?: Record<string, unknown>;
  /** Suggestions for how to resolve the error */
  suggestions?: string[];
  /** Timestamp when the error occurred */
  timestamp: string;
}

/**
 * Structured error response with both user-friendly and technical details
 */
export interface StructuredErrorResponse {
  /** User-friendly error message */
  userMessage: string;
  /** Technical error details for debugging */
  technical: ErrorContext;
  /** Whether this error is recoverable */
  recoverable: boolean;
  /** Suggested retry delay in milliseconds (if recoverable) */
  retryAfterMs?: number;
}

/**
 * Build structured error context from an unknown error
 * Preserves stack traces through promise chains
 */
export function buildErrorContext(
  error: unknown,
  operation: string,
  component?: string,
  metadata?: Record<string, unknown>
): ErrorContext {
  const timestamp = new Date().toISOString();

  if (error instanceof JamfAPIError) {
    return {
      operation,
      message: error.message,
      code: error.errorCode || 'JAMF_API_ERROR',
      component,
      stack: error.stack || error.originalError?.stack,
      metadata: {
        ...metadata,
        statusCode: error.statusCode,
        originalContext: error.context,
      },
      suggestions: error.suggestions,
      timestamp,
    };
  }

  if (error instanceof Error) {
    // Check for Axios-style errors with response property
    const axiosError = error as { response?: { status?: number; data?: unknown } };
    const statusCode = axiosError.response?.status;

    return {
      operation,
      message: error.message,
      code: statusCode ? `HTTP_${statusCode}` : 'ERROR',
      component,
      stack: error.stack,
      metadata: {
        ...(metadata || {}),
        ...(statusCode ? { statusCode } : {}),
        ...(axiosError.response?.data ? { responseData: axiosError.response.data } : {}),
      },
      timestamp,
    };
  }

  // Handle non-Error thrown values
  return {
    operation,
    message: String(error),
    code: 'UNKNOWN_ERROR',
    component,
    metadata,
    timestamp,
  };
}

/**
 * Create a structured error response suitable for returning to callers
 */
export function createStructuredErrorResponse(
  error: unknown,
  operation: string,
  component?: string,
  metadata?: Record<string, unknown>
): StructuredErrorResponse {
  const context = buildErrorContext(error, operation, component, metadata);

  // Determine if error is recoverable
  let recoverable = false;
  let retryAfterMs: number | undefined;

  if (error instanceof NetworkError) {
    recoverable = true;
    retryAfterMs = 5000; // 5 seconds for network errors
  } else if (error instanceof RateLimitError) {
    recoverable = true;
    retryAfterMs = (error as RateLimitError).retryAfter * 1000;
  } else if (error instanceof JamfAPIError && error.statusCode && error.statusCode >= 500) {
    recoverable = true;
    retryAfterMs = 10000; // 10 seconds for server errors
  }

  // Create user-friendly message
  let userMessage = context.message;
  if (context.suggestions && context.suggestions.length > 0) {
    userMessage = `${context.message}. ${context.suggestions[0]}`;
  }

  return {
    userMessage,
    technical: context,
    recoverable,
    retryAfterMs,
  };
}

/**
 * Log error with full context
 * Useful for catch blocks to ensure consistent logging
 */
export function logErrorWithContext(
  error: unknown,
  operation: string,
  component?: string,
  metadata?: Record<string, unknown>
): ErrorContext {
  const context = buildErrorContext(error, operation, component, metadata);

  logger.error(`${operation} failed`, {
    error: context.message,
    code: context.code,
    component: context.component,
    stack: context.stack,
    metadata: context.metadata,
    suggestions: context.suggestions,
  });

  return context;
}

/**
 * Wrap an async function to preserve stack traces
 * Call this at the beginning of async functions to capture the call site
 */
export function captureStackTrace(): string {
  const obj = { stack: '' };
  Error.captureStackTrace(obj, captureStackTrace);
  return obj.stack;
}

/**
 * Create an error with combined stack traces
 * Useful when catching in promise chains to preserve the original call site
 */
export function combineStacks(error: Error, originalStack: string): Error {
  if (originalStack) {
    error.stack = `${error.stack}\n--- Original call site ---\n${originalStack}`;
  }
  return error;
}