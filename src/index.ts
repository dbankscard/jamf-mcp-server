#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { JamfApiClientHybrid } from './jamf-client-hybrid.js';
import { registerTools } from './tools/index-compat.js';
import { registerResources } from './resources/index-compat.js';
import { registerPrompts } from './prompts/index.js';
import { SkillsManager } from './skills/manager.js';
import { registerSkillsAsMCPTools } from './tools/skills-mcp-integration.js';
import { setupGlobalErrorHandlers } from './utils/error-handler.js';
import { createLogger } from './server/logger.js';
import { registerShutdownHandler, registerCommonHandlers } from './utils/shutdown-manager.js';
import { cleanupAuthMiddleware } from './server/auth-middleware.js';
import { cleanupAgentPool } from './utils/http-agent-pool.js';

const logger = createLogger('main');

// Environment variables
const JAMF_URL = process.env.JAMF_URL;
const JAMF_CLIENT_ID = process.env.JAMF_CLIENT_ID;
const JAMF_CLIENT_SECRET = process.env.JAMF_CLIENT_SECRET;
const JAMF_USERNAME = process.env.JAMF_USERNAME;
const JAMF_PASSWORD = process.env.JAMF_PASSWORD;
const READ_ONLY_MODE = process.env.JAMF_READ_ONLY === 'true';

// Validate configuration
if (!JAMF_URL) {
  logger.error('Missing required environment variable: JAMF_URL');
  process.exit(1);
}

// Check for at least one auth method
const hasOAuth2 = !!(JAMF_CLIENT_ID && JAMF_CLIENT_SECRET);
const hasBasicAuth = !!(JAMF_USERNAME && JAMF_PASSWORD);

if (!hasOAuth2 && !hasBasicAuth) {
  logger.error('Missing authentication credentials. Please provide either:');
  logger.error('  - OAuth2: JAMF_CLIENT_ID and JAMF_CLIENT_SECRET');
  logger.error('  - Basic Auth: JAMF_USERNAME and JAMF_PASSWORD');
  process.exit(1);
}

const server = new Server(
  {
    name: 'jamf-mcp-server',
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
    logger.info('Starting Jamf MCP server with Skills...');
    logger.info(`Jamf URL: ${JAMF_URL}`);
    logger.info('Authentication methods available:');
    if (hasOAuth2) {
      logger.info(`  ✅ OAuth2 (Modern API) - Client ID: ${JAMF_CLIENT_ID}`);
    }
    if (hasBasicAuth) {
      logger.info(`  ✅ Basic Auth (Classic API) - Username: ${JAMF_USERNAME}`);
    }
    logger.info(`Read-only mode: ${READ_ONLY_MODE}`);
    logger.info('Skills integration: ✅ Enabled');

    // Initialize the hybrid client
    const jamfClient = new JamfApiClientHybrid({
      baseUrl: JAMF_URL!,
      clientId: JAMF_CLIENT_ID,
      clientSecret: JAMF_CLIENT_SECRET,
      username: JAMF_USERNAME,
      password: JAMF_PASSWORD,
      readOnlyMode: READ_ONLY_MODE,
      // TLS/SSL configuration - only disable for development with self-signed certs
      rejectUnauthorized: process.env.JAMF_ALLOW_INSECURE !== 'true',
    });

    // Register handlers
    registerTools(server, jamfClient);
    registerResources(server, jamfClient);
    registerPrompts(server);
    
    // Register skills as MCP tools
    registerSkillsAsMCPTools(server, skillsManager, jamfClient);

    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('Jamf MCP server started successfully with skills');
  } catch (error) {
    logger.error('Failed to initialize Jamf MCP server', { error });
    process.exit(1);
  }
}

// Setup global error handlers
setupGlobalErrorHandlers();

// Register common shutdown handlers
registerCommonHandlers();

// Register cleanup handlers
registerShutdownHandler('auth-cleanup', cleanupAuthMiddleware, 20);
registerShutdownHandler('agent-pool-cleanup', cleanupAgentPool, 20);
registerShutdownHandler('server-transport-close', async () => {
  logger.info('Closing server transport...');
  // Transport will be closed automatically
}, 40);

// Run the server
run().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});