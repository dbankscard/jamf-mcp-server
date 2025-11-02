// Test setup file
import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Mock timers for tests that need them
global.setTimeout = jest.fn(setTimeout) as any;
global.clearTimeout = jest.fn(clearTimeout) as any;
global.setInterval = jest.fn(setInterval) as any;
global.clearInterval = jest.fn(clearInterval) as any;

// Global test timeout
jest.setTimeout(10000);

// Cleanup after tests
afterAll(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});