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

import { JamfApiClient } from './jamf-client.js';
import { JamfApiClientClassic } from './jamf-client-classic.js';
import { JamfApiClientAdvancedSearch } from './jamf-client-advanced-search.js';
import { registerTools } from './tools/index-compat.js';
import { registerResources } from './resources/index-compat.js';
import { registerPrompts } from './prompts/index.js';

const JAMF_URL = process.env.JAMF_URL;
const JAMF_CLIENT_ID = process.env.JAMF_CLIENT_ID;
const JAMF_CLIENT_SECRET = process.env.JAMF_CLIENT_SECRET;
const READ_ONLY_MODE = process.env.JAMF_READ_ONLY === 'true';
const USE_ADVANCED_SEARCH = process.env.JAMF_USE_ADVANCED_SEARCH === 'true';

if (!JAMF_URL || !JAMF_CLIENT_ID || !JAMF_CLIENT_SECRET) {
  console.error('Missing required environment variables: JAMF_URL, JAMF_CLIENT_ID, JAMF_CLIENT_SECRET');
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

// Function to check API permissions
async function checkApiPermissions(config: any): Promise<string> {
  try {
    const testClient = new JamfApiClient(config);
    
    // Try to access computers inventory
    try {
      await testClient.searchComputers('test', 1);
      console.error('✅ Direct computer inventory access available');
      return 'modern';
    } catch (error: any) {
      if (error?.response?.status === 403) {
        console.error('⚠️  No direct computer inventory access, checking Classic API...');
        
        // Try classic API
        const classicClient = new JamfApiClientClassic(config);
        try {
          await classicClient.searchComputers('test', 1);
          console.error('✅ Classic API computer access available');
          return 'classic';
        } catch (classicError: any) {
          if (classicError?.response?.status === 401 || classicError?.response?.status === 403) {
            console.error('⚠️  No Classic API computer access, will use Advanced Search');
            return 'advanced-search';
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking API permissions:', error);
  }
  
  // Default to advanced search if we can't determine
  return 'advanced-search';
}

// Initialize the appropriate client based on permissions
async function initializeClient() {
  const config = {
    baseUrl: JAMF_URL!,
    clientId: JAMF_CLIENT_ID!,
    clientSecret: JAMF_CLIENT_SECRET!,
    readOnlyMode: READ_ONLY_MODE,
  };

  // If explicitly set to use advanced search, use it
  if (USE_ADVANCED_SEARCH) {
    console.error('Using Advanced Search API (forced by environment variable)');
    return new JamfApiClientAdvancedSearch(config);
  }

  // Otherwise, detect the best API to use
  const apiType = await checkApiPermissions(config);
  
  switch (apiType) {
    case 'modern':
      console.error('Using Modern Jamf API');
      return new JamfApiClient(config);
    case 'classic':
      console.error('Using Classic Jamf API');
      return new JamfApiClientClassic(config);
    case 'advanced-search':
    default:
      console.error('Using Advanced Search API for computer inventory');
      return new JamfApiClientAdvancedSearch(config);
  }
}

async function run() {
  try {
    // Initialize the appropriate client
    const jamfClient = await initializeClient();
    
    // Register handlers
    registerTools(server, jamfClient as any);
    registerResources(server, jamfClient as any);
    registerPrompts(server);
    
    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('Jamf MCP server started successfully');
    console.error(`Connected to: ${JAMF_URL}`);
    console.error(`Read-only mode: ${READ_ONLY_MODE}`);
  } catch (error) {
    console.error('Failed to initialize Jamf MCP server:', error);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});