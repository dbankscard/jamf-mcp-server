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
import { registerTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
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
    instructions: `You are connected to a Jamf Pro MDM server managing Apple devices (macOS, iOS, iPadOS, tvOS). This is the enhanced server with automatic retries, rate limiting, and circuit breaker.

## Quick Start — Common Questions
- "How's my fleet?" → Use \`getFleetOverview\` (single call replaces 4-6 individual calls)
- "Tell me about device X" → Use \`getDeviceFullProfile\` with name, serial, or ID
- "What's our security posture?" → Use \`getSecurityPosture\` for encryption, compliance, OS currency
- "How is policy X performing?" → Use \`getPolicyAnalysis\` with policy ID or name

## Tool Categories (by prefix)
- **Read-only (safe):** \`search*\`, \`list*\`, \`get*\`, \`check*\` — no side effects
- **Write/create:** \`create*\`, \`clone*\`, \`update*\`, \`set*\` — modifies configuration
- **Destructive (confirm required):** \`execute*\`, \`deploy*\`, \`send*\`, \`delete*\`, \`flush*\`, \`remove*\` — affects devices or deletes data

## Performance Tips
1. **Prefer compound tools** (\`getFleetOverview\`, \`getDeviceFullProfile\`, \`getSecurityPosture\`, \`getPolicyAnalysis\`) — they run parallel API calls internally
2. **Use \`getDevicesBatch\`** instead of calling \`getDeviceDetails\` in a loop
3. **Use resources** (jamf://reports/*) for pre-aggregated reports like compliance, encryption, OS versions
4. **Use \`getInventorySummary\`** for fleet-wide inventory stats without fetching individual devices

## Response Format
Many tools return enriched responses with:
- \`summary\`: Human-readable 1-2 sentence overview
- \`suggestedNextActions\`: Array of recommended follow-up tool calls
- \`data\`: The full API response data
- \`metadata\`: Result count, timestamp

## Important Notes
- All destructive tools require \`confirm: true\` parameter
- Device identifiers can be Jamf IDs, serial numbers, or device names (compound tools resolve automatically)
- The server supports both Jamf Pro Modern API and Classic API with automatic fallback`,
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