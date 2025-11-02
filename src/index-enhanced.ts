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

// Environment variables
const JAMF_URL = process.env.JAMF_URL;
const JAMF_CLIENT_ID = process.env.JAMF_CLIENT_ID;
const JAMF_CLIENT_SECRET = process.env.JAMF_CLIENT_SECRET;
const READ_ONLY_MODE = process.env.JAMF_READ_ONLY === 'true';

// Enhanced mode configuration
const ENABLE_RETRY = process.env.JAMF_ENABLE_RETRY !== 'false';
const ENABLE_RATE_LIMITING = process.env.JAMF_ENABLE_RATE_LIMITING === 'true';
const ENABLE_CIRCUIT_BREAKER = process.env.JAMF_ENABLE_CIRCUIT_BREAKER === 'true';
const DEBUG_MODE = process.env.JAMF_DEBUG_MODE === 'true';

// Validate configuration
if (!JAMF_URL) {
  console.error('Missing required environment variable: JAMF_URL');
  process.exit(1);
}

// Enhanced mode requires OAuth2
if (!JAMF_CLIENT_ID || !JAMF_CLIENT_SECRET) {
  console.error('Enhanced mode requires OAuth2 authentication.');
  console.error('Please provide JAMF_CLIENT_ID and JAMF_CLIENT_SECRET.');
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

    // Initialize the enhanced client
    const jamfClient = new JamfApiClientHybrid({
      baseUrl: JAMF_URL!,
      clientId: JAMF_CLIENT_ID,
      clientSecret: JAMF_CLIENT_SECRET,
      readOnlyMode: READ_ONLY_MODE,
      // TLS/SSL configuration - only disable for development with self-signed certs
      rejectUnauthorized: process.env.JAMF_ALLOW_INSECURE !== 'true',
      // Enhanced features
      enableRetry: ENABLE_RETRY,
      maxRetries: parseInt(process.env.JAMF_MAX_RETRIES || '3'),
      retryDelay: parseInt(process.env.JAMF_RETRY_DELAY || '1000'),
      retryMaxDelay: parseInt(process.env.JAMF_RETRY_MAX_DELAY || '10000'),
      retryBackoffMultiplier: parseInt(process.env.JAMF_RETRY_BACKOFF_MULTIPLIER || '2'),
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
    
    // console.error('\nJamf MCP server (ENHANCED MODE) started successfully with skills');
    // console.error('Ready to handle requests with advanced error handling and skills...');
  } catch (error) {
    console.error('Failed to initialize enhanced Jamf MCP server:', error);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});