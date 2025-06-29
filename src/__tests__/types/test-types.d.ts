// Test-specific type definitions

import { AxiosInstance } from 'axios';
import { MockAxiosAdapter } from '../helpers/mock-axios';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      JAMF_URL?: string;
      JAMF_USERNAME?: string;
      JAMF_PASSWORD?: string;
      NODE_ENV?: string;
    }
  }
}

// Extended test context types
export interface TestContext {
  axios: AxiosInstance;
  mockAdapter: MockAxiosAdapter;
  cleanup: () => void;
}

// Mock data factory types
export interface MockDataFactoryOptions {
  count?: number;
  startDate?: Date;
  endDate?: Date;
  includeErrors?: boolean;
  customFields?: Record<string, any>;
}

// Test scenario types
export type TestScenario = 'success' | 'auth-failure' | 'network-error' | 'validation-error' | 'not-found';

export interface TestScenarioConfig {
  scenario: TestScenario;
  customResponses?: Record<string, any>;
  delayMs?: number;
  errorRate?: number;
}

// Assertion helper types
export interface DateAssertionOptions {
  tolerance?: number; // milliseconds tolerance for date comparisons
  format?: 'iso' | 'jamf' | 'epoch';
}

export interface ComputerAssertionOptions {
  ignoreFields?: string[];
  dateOptions?: DateAssertionOptions;
}

// Mock response builder types
export interface MockResponseBuilder<T> {
  withStatus(status: number): this;
  withData(data: T): this;
  withHeaders(headers: Record<string, string>): this;
  withDelay(ms: number): this;
  build(): MockResponse;
}

// Test fixture loader types
export interface FixtureLoader {
  loadComputers(scenario?: string): any[];
  loadComputerDetail(id: string): any;
  loadAuthResponse(type?: 'success' | 'failure'): any;
  loadErrorResponse(type: string): any;
}

// Performance testing types
export interface PerformanceMetrics {
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  requestCount: number;
  errorCount: number;
}

export interface PerformanceTestOptions {
  iterations: number;
  concurrency: number;
  warmup?: boolean;
  collectMetrics?: boolean;
}

// Integration test helpers
export interface IntegrationTestConfig {
  useRealApi?: boolean;
  apiUrl?: string;
  credentials?: {
    username: string;
    password: string;
  };
  readOnly?: boolean;
  timeout?: number;
}

// Custom error types for testing
export class TestTimeoutError extends Error {
  constructor(message: string, public timeout: number) {
    super(message);
    this.name = 'TestTimeoutError';
  }
}

export class MockNotConfiguredError extends Error {
  constructor(public endpoint: string, public method: string) {
    super(`No mock configured for ${method} ${endpoint}`);
    this.name = 'MockNotConfiguredError';
  }
}

// Utility type for partial deep mocking
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

// Test data snapshot types
export interface TestDataSnapshot {
  timestamp: Date;
  description: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface SnapshotManager {
  save(name: string, data: any, description?: string): void;
  load(name: string): TestDataSnapshot | null;
  list(): string[];
  clear(): void;
}