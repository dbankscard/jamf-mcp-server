#!/usr/bin/env node

import * as readline from 'readline';
import { MCPClient } from './mcp/MCPClient.js';
import { AIProvider } from './ai/AIProvider.js';
import { BedrockProvider } from './ai/providers/BedrockProvider.js';
import { OpenAIProvider } from './ai/providers/OpenAIProvider.js';
import { MockProvider } from './ai/providers/MockProvider.js';
import { SimpleAgent } from './core/SimpleAgent.js';
import { print, printError } from './output.js';

async function main() {
  print('🤖 Jamf AI Agent - Simple Natural Language Interface\n');

  // Check for required environment variables
  if (!process.env.JAMF_URL || !process.env.JAMF_CLIENT_ID || !process.env.JAMF_CLIENT_SECRET) {
    printError('❌ Missing required Jamf credentials');
    printError('Please set JAMF_URL, JAMF_CLIENT_ID, and JAMF_CLIENT_SECRET');
    process.exit(1);
  }

  // Create MCP client
  const mcpClient = new MCPClient({
    command: 'node',
    args: [`${process.cwd()}/dist/index.js`],
    env: {
      JAMF_URL: process.env.JAMF_URL,
      JAMF_CLIENT_ID: process.env.JAMF_CLIENT_ID,
      JAMF_CLIENT_SECRET: process.env.JAMF_CLIENT_SECRET,
      JAMF_USERNAME: process.env.JAMF_USERNAME || '',
      JAMF_PASSWORD: process.env.JAMF_PASSWORD || '',
      JAMF_READ_ONLY: process.env.JAMF_READ_ONLY || 'false',
    },
  });

  // Create AI provider
  let aiProvider: AIProvider;

  if (process.env.AWS_ACCESS_KEY_ID) {
    print('Using AWS Bedrock (Claude)...');
    aiProvider = new BedrockProvider({
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      model: process.env.AGENT_AI_MODEL || 'anthropic.claude-3-sonnet-20240229-v1:0',
    });
  } else if (process.env.OPENAI_API_KEY) {
    print('Using OpenAI...');
    aiProvider = new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.AGENT_AI_MODEL || 'gpt-3.5-turbo',
    });
  } else {
    print('Using Mock AI provider...');
    aiProvider = new MockProvider({});
  }

  // Create simple agent
  const agent = new SimpleAgent(mcpClient, aiProvider, {} as any);

  // Set up event handlers
  mcpClient.on('connected', () => {
    print('✅ Connected to Jamf MCP server\n');
  });

  // Initialize
  try {
    await agent.initialize();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    printError(`❌ Failed to initialize: ${message}`);
    process.exit(1);
  }

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'jamf> ',
  });

  print('Type your requests in natural language. Type "exit" to quit.\n');
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input === 'exit' || input === 'quit') {
      rl.close();
      return;
    }

    try {
      await agent.processRequest(input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      printError(`❌ Error: ${message}`);
    }

    print(''); // Add spacing
    rl.prompt();
  });

  rl.on('close', async () => {
    print('\n👋 Goodbye!');
    await agent.shutdown();
    process.exit(0);
  });
}

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    printError(`Fatal error: ${error}`);
    process.exit(1);
  });
}