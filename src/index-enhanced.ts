#!/usr/bin/env node
/**
 * Enhanced Mode Server with Advanced Error Handling and Skills
 *
 * This version includes:
 * - Automatic retries with exponential backoff
 * - Rate limiting
 * - Circuit breaker pattern
 * - Enhanced error messages
 * - Skills integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { JamfApiClientHybrid } from './jamf-client-hybrid.js';
import { registerTools } from './tools/index-compat.js';
import { registerResources } from './resources/index-compat.js';
import { registerPrompts } from './prompts/index.js';
import { SkillsManager } from './skills/manager.js';
import { registerSkillsAsMCPTools } from './tools/skills-mcp-integration.js';
import { createLogger } from './server/logger.js';
import { validateJamfConfig, validateEnhancedModeConfig } from './utils/env-validation.js';

const logger = createLogger('JamfMCPServerEnhanced');

// Validate environment variables using Zod schemas
const jamfConfigResult = validateJamfConfig(process.env);
if (!jamfConfigResult.valid) {
  logger.error('Environment validation failed:');
  logger.error(jamfConfigResult.error?.format() || 'Unknown validation error');
  process.exit(1);
}

const enhancedConfigResult = validateEnhancedModeConfig(process.env);
if (!enhancedConfigResult.valid) {
  logger.error('Enhanced mode configuration validation failed:');
  logger.error(enhancedConfigResult.error?.format() || 'Unknown validation error');
  process.exit(1);
}

const jamfConfig = jamfConfigResult.config!;
const enhancedConfig = enhancedConfigResult.config!;

const JAMF_URL = jamfConfig.JAMF_URL;
const JAMF_CLIENT_ID = jamfConfig.JAMF_CLIENT_ID;
const JAMF_CLIENT_SECRET = jamfConfig.JAMF_CLIENT_SECRET;
const READ_ONLY_MODE = jamfConfig.JAMF_READ_ONLY ?? false;

// Enhanced mode configuration - validated by Zod schema
const ENABLE_RETRY = enhancedConfig.JAMF_ENABLE_RETRY ?? true;
const ENABLE_RATE_LIMITING = enhancedConfig.JAMF_ENABLE_RATE_LIMITING ?? false;
const ENABLE_CIRCUIT_BREAKER = enhancedConfig.JAMF_ENABLE_CIRCUIT_BREAKER ?? false;
const DEBUG_MODE = enhancedConfig.JAMF_DEBUG_MODE ?? false;

// Enhanced mode requires OAuth2
if (!JAMF_CLIENT_ID || !JAMF_CLIENT_SECRET) {
  logger.error('Enhanced mode requires OAuth2 authentication.');
  logger.error('Please provide JAMF_CLIENT_ID and JAMF_CLIENT_SECRET.');
  process.exit(1);
}

const server = new Server(
  {
    name: 'jamf-mcp-server-enhanced',
    version: '1.2.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Initialize Skills Manager
const skillsManager = new SkillsManager();

async function run() {
  try {
    // MCP servers must not output to stdout/stderr - it breaks JSON-RPC parsing
    // These startup messages are commented out to fix Claude Desktop integration
    // console.error('Starting Jamf MCP server in ENHANCED MODE with Skills...');
    // console.error(`Jamf URL: ${JAMF_URL}`);
    // console.error(`Client ID: ${JAMF_CLIENT_ID}`);
    // console.error(`Read-only mode: ${READ_ONLY_MODE}`);
    // console.error('\nEnhanced features enabled:');
    // console.error(`  ${ENABLE_RETRY ? '✅' : '❌'} Automatic retries`);
    // console.error(`  ${ENABLE_RATE_LIMITING ? '✅' : '❌'} Rate limiting`);
    // console.error(`  ${ENABLE_CIRCUIT_BREAKER ? '✅' : '❌'} Circuit breaker`);
    // console.error(`  ${DEBUG_MODE ? '✅' : '❌'} Debug mode`);
    // console.error(`  ✅ Skills integration`);

    // Initialize the enhanced client with validated config values
    const jamfClient = new JamfApiClientHybrid({
      baseUrl: JAMF_URL,
      clientId: JAMF_CLIENT_ID,
      clientSecret: JAMF_CLIENT_SECRET,
      readOnlyMode: READ_ONLY_MODE,
      // TLS/SSL configuration - only disable for development with self-signed certs
      rejectUnauthorized: !(jamfConfig.JAMF_ALLOW_INSECURE ?? false),
      // Enhanced features - values validated by Zod schema
      enableRetry: ENABLE_RETRY,
      maxRetries: enhancedConfig.JAMF_MAX_RETRIES ?? 3,
      retryDelay: enhancedConfig.JAMF_RETRY_DELAY ?? 1000,
      retryMaxDelay: enhancedConfig.JAMF_RETRY_MAX_DELAY ?? 10000,
      retryBackoffMultiplier: enhancedConfig.JAMF_RETRY_BACKOFF_MULTIPLIER ?? 2,
      enableRateLimiting: ENABLE_RATE_LIMITING,
      enableCircuitBreaker: ENABLE_CIRCUIT_BREAKER,
      debugMode: DEBUG_MODE,
    } as any);

    // Register handlers
    registerTools(server, jamfClient);
    registerResources(server, jamfClient);
    registerPrompts(server);
    
    // Register skills as MCP tools
    registerSkillsAsMCPTools(server, skillsManager, jamfClient);

    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Server started successfully - no logging in MCP servers to avoid breaking JSON-RPC
  } catch (error) {
    logger.error('Failed to initialize enhanced Jamf MCP server', { error });
    process.exit(1);
  }
}

run().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});