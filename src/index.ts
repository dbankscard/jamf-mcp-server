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

import { JamfApiClientHybrid } from './jamf-client-hybrid.js';
import { registerTools } from './tools/index-compat.js';
import { registerResources } from './resources/index-compat.js';
import { registerPrompts } from './prompts/index.js';

// Environment variables
const JAMF_URL = process.env.JAMF_URL;
const JAMF_CLIENT_ID = process.env.JAMF_CLIENT_ID;
const JAMF_CLIENT_SECRET = process.env.JAMF_CLIENT_SECRET;
const JAMF_USERNAME = process.env.JAMF_USERNAME;
const JAMF_PASSWORD = process.env.JAMF_PASSWORD;
const READ_ONLY_MODE = process.env.JAMF_READ_ONLY === 'true';

// Validate configuration
if (!JAMF_URL) {
  console.error('Missing required environment variable: JAMF_URL');
  process.exit(1);
}

// Check for at least one auth method
const hasOAuth2 = !!(JAMF_CLIENT_ID && JAMF_CLIENT_SECRET);
const hasBasicAuth = !!(JAMF_USERNAME && JAMF_PASSWORD);

if (!hasOAuth2 && !hasBasicAuth) {
  console.error('Missing authentication credentials. Please provide either:');
  console.error('  - OAuth2: JAMF_CLIENT_ID and JAMF_CLIENT_SECRET');
  console.error('  - Basic Auth: JAMF_USERNAME and JAMF_PASSWORD');
  process.exit(1);
}

const server = new Server(
  {
    name: 'jamf-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

async function run() {
  try {
    console.error('Starting Jamf MCP server...');
    console.error(`Jamf URL: ${JAMF_URL}`);
    console.error(`Authentication methods available:`);
    if (hasOAuth2) {
      console.error(`  ✅ OAuth2 (Modern API) - Client ID: ${JAMF_CLIENT_ID}`);
    }
    if (hasBasicAuth) {
      console.error(`  ✅ Basic Auth (Classic API) - Username: ${JAMF_USERNAME}`);
    }
    console.error(`Read-only mode: ${READ_ONLY_MODE}`);
    
    // Initialize the hybrid client
    const jamfClient = new JamfApiClientHybrid({
      baseUrl: JAMF_URL!,
      clientId: JAMF_CLIENT_ID,
      clientSecret: JAMF_CLIENT_SECRET,
      username: JAMF_USERNAME,
      password: JAMF_PASSWORD,
      readOnlyMode: READ_ONLY_MODE,
    });
    
    // Register handlers
    registerTools(server, jamfClient as any);
    registerResources(server, jamfClient as any);
    registerPrompts(server);
    
    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('Jamf MCP server started successfully');
  } catch (error) {
    console.error('Failed to initialize Jamf MCP server:', error);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});