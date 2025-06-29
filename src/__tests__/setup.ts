// Jest setup file for global test configuration

// Comment out custom matchers for now to fix the tests
// import { jamfMatchers } from './helpers/test-utils.js';
// expect.extend(jamfMatchers);

// Set up global test timeout
jest.setTimeout(30000); // 30 seconds for integration tests

// Mock console methods to reduce noise in tests
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug
};

beforeAll(() => {
  // Suppress console output in tests unless explicitly needed
  if (process.env.SHOW_TEST_LOGS !== 'true') {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.debug = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.debug = originalConsole.debug;
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection in test:', error);
  throw error;
});

// Set up test environment variables
process.env.NODE_ENV = 'test';

// Mock timers configuration
beforeEach(() => {
  // Clear all timers between tests
  jest.clearAllTimers();
});

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Restore mocked implementations
  jest.restoreAllMocks();
});

// Make this a module
export {};