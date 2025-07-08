#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { JamfApiClientEnhanced } from './jamf-client-enhanced.js';
import { setupToolsEnhanced } from './tools/index-enhanced.js';
import { registerResources } from './resources/index-compat.js';
import { registerPrompts } from './prompts/index.js';
import { ConfigurationError } from './utils/errors.js';
import { getRetryConfig } from './utils/retry.js';

// Environment variables
const JAMF_URL = process.env.JAMF_URL;
const JAMF_CLIENT_ID = process.env.JAMF_CLIENT_ID;
const JAMF_CLIENT_SECRET = process.env.JAMF_CLIENT_SECRET;
const JAMF_USERNAME = process.env.JAMF_USERNAME;
const JAMF_PASSWORD = process.env.JAMF_PASSWORD;
const READ_ONLY_MODE = process.env.JAMF_READ_ONLY === 'true';

// Enhanced configuration options
const ENABLE_RETRY = process.env.JAMF_ENABLE_RETRY !== 'false'; // Default true
const ENABLE_RATE_LIMITING = process.env.JAMF_ENABLE_RATE_LIMITING === 'true'; // Default false
const ENABLE_CIRCUIT_BREAKER = process.env.JAMF_ENABLE_CIRCUIT_BREAKER === 'true'; // Default false

// Get retry configuration
const retryConfig = getRetryConfig();

// Validate configuration
if (!JAMF_URL) {
  console.error('Missing required environment variable: JAMF_URL');
  process.exit(1);
}

// Check for OAuth2 credentials (required for enhanced client)
if (!JAMF_CLIENT_ID || !JAMF_CLIENT_SECRET) {
  console.error('Missing required OAuth2 credentials for enhanced client:');
  console.error('  - JAMF_CLIENT_ID');
  console.error('  - JAMF_CLIENT_SECRET');
  process.exit(1);
}

const server = new Server(
  {
    name: 'jamf-mcp-server-enhanced',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

/**
 * Log configuration details
 */
function logConfiguration(): void {
  console.error('Starting Enhanced Jamf MCP server...');
  console.error(`Jamf URL: ${JAMF_URL}`);
  console.error(`Authentication: OAuth2 - Client ID: ${JAMF_CLIENT_ID}`);
  console.error(`Read-only mode: ${READ_ONLY_MODE}`);
  console.error('\nEnhanced Features:');
  console.error(`  Retry Logic: ${ENABLE_RETRY ? 'Enabled' : 'Disabled'}`);
  if (ENABLE_RETRY) {
    console.error(`    - Max Retries: ${retryConfig.maxRetries}`);
    console.error(`    - Initial Delay: ${retryConfig.initialDelay}ms`);
    console.error(`    - Max Delay: ${retryConfig.maxDelay}ms`);
    console.error(`    - Backoff Multiplier: ${retryConfig.backoffMultiplier}`);
  }
  console.error(`  Rate Limiting: ${ENABLE_RATE_LIMITING ? 'Enabled' : 'Disabled'}`);
  console.error(`  Circuit Breaker: ${ENABLE_CIRCUIT_BREAKER ? 'Enabled' : 'Disabled'}`);
  console.error(`  Debug Mode: ${retryConfig.debugMode ? 'Enabled' : 'Disabled'}`);
}

/**
 * Setup error handler for uncaught exceptions
 */
function setupErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (retryConfig.debugMode && error.stack) {
      console.error('Stack Trace:', error.stack);
    }
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    if (retryConfig.debugMode && reason instanceof Error && reason.stack) {
      console.error('Stack Trace:', reason.stack);
    }
    process.exit(1);
  });
}

async function run() {
  try {
    logConfiguration();
    setupErrorHandlers();
    
    // Initialize the enhanced client
    const jamfClient = new JamfApiClientEnhanced({
      baseUrl: JAMF_URL!,
      clientId: JAMF_CLIENT_ID!,
      clientSecret: JAMF_CLIENT_SECRET!,
      readOnlyMode: READ_ONLY_MODE,
      enableRetry: ENABLE_RETRY,
      enableRateLimiting: ENABLE_RATE_LIMITING,
      enableCircuitBreaker: ENABLE_CIRCUIT_BREAKER,
      interceptorOptions: {
        enableLogging: retryConfig.debugMode,
        retryOptions: {
          maxRetries: retryConfig.maxRetries,
          initialDelay: retryConfig.initialDelay,
          maxDelay: retryConfig.maxDelay,
        },
      },
    });
    
    // Test authentication
    try {
      console.error('\nTesting authentication...');
      await jamfClient.keepAlive();
      console.error('✅ Authentication successful');
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
    
    // Register handlers
    setupToolsEnhanced(server, jamfClient);
    registerResources(server, jamfClient as any);
    registerPrompts(server);
    
    // Add server-level error handler
    server.onerror = (error) => {
      console.error('[Server Error]', error);
      if (retryConfig.debugMode && error.stack) {
        console.error('Stack Trace:', error.stack);
      }
    };
    
    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('\n✅ Enhanced Jamf MCP server started successfully');
    
    // Log periodic status in debug mode
    if (retryConfig.debugMode) {
      setInterval(() => {
        const status = jamfClient.getCircuitBreakerStatus();
        if (status) {
          console.error('[Status] Circuit Breaker:', status);
        }
      }, 60000); // Every minute
    }
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error('\n❌ Configuration Error:', error.message);
      if (error.suggestions && error.suggestions.length > 0) {
        console.error('\nSuggestions:');
        error.suggestions.forEach((suggestion, index) => {
          console.error(`  ${index + 1}. ${suggestion}`);
        });
      }
    } else {
      console.error('\n❌ Failed to initialize Enhanced Jamf MCP server:', error);
    }
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});