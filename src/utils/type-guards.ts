/**
 * Type guard utilities for safer type checking
 */

import { AxiosError } from 'axios';

/**
 * Check if error is an AxiosError
 */
export function isAxiosError(error: unknown): error is AxiosError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  );
}

/**
 * Check if value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Get error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}

/**
 * Get Axios error status safely
 */
export function getAxiosErrorStatus(error: unknown): number | undefined {
  if (isAxiosError(error)) {
    return error.response?.status;
  }
  return undefined;
}

/**
 * Get Axios error data safely
 */
export function getAxiosErrorData(error: unknown): unknown {
  if (isAxiosError(error)) {
    return error.response?.data;
  }
  return undefined;
}