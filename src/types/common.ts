/**
 * Common type definitions used across the application
 */

import { Request as ExpressRequest } from 'express';

// Extended Express Request with user info
export interface AuthenticatedRequest extends ExpressRequest {
  user?: {
    sub: string;
    permissions?: string[];
    scope?: string;
    [key: string]: unknown;
  };
  id?: string; // Request ID
}

// Tool execution types
export interface ToolCallResponse {
  content: Array<{
    type: string;
    text: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
}

// Server configuration
export interface ServerConfig {
  baseUrl: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  readOnlyMode?: boolean;
  rejectUnauthorized?: boolean;
  [key: string]: unknown;
}

// API Error response
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp?: string;
    requestId?: string;
  };
}

// Generic pagination
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Generic search params
export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, unknown>;
}

// HTTP Response helpers
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  metadata?: {
    total?: number;
    page?: number;
    pageSize?: number;
    [key: string]: unknown;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Logger interface
export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

// Environment configuration
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  JAMF_URL: string;
  JAMF_CLIENT_ID?: string;
  JAMF_CLIENT_SECRET?: string;
  JAMF_USERNAME?: string;
  JAMF_PASSWORD?: string;
  JAMF_READ_ONLY: boolean;
  JAMF_ALLOW_INSECURE: boolean;
  [key: string]: unknown;
}