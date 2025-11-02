#!/usr/bin/env node

import * as readline from 'readline';
import { JamfAgent } from '../core/AgentCore.js';
import { TaskPlan } from '../tasks/TaskPlanner.js';

export class AgentCLI {
  private agent: JamfAgent;
  private rl: readline.Interface;
  private running: boolean = false;

  constructor() {
    // Create agent with default configuration
    this.agent = new JamfAgent({
      config: {
        mcpServer: {
          host: 'localhost',
          port: 3000,
          transport: 'stdio',
        },
        aiProvider: {
          type: (process.env.AGENT_AI_PROVIDER || 
                (process.env.AWS_ACCESS_KEY_ID ? 'bedrock' : 
                (process.env.OPENAI_API_KEY ? 'openai' : 'mock'))) as 'openai' | 'anthropic' | 'local' | 'mock' | 'bedrock',
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.AGENT_AI_MODEL || 
                 (process.env.AWS_ACCESS_KEY_ID ? 'anthropic.claude-3-sonnet-20240229-v1:0' : 'gpt-3.5-turbo'),
          temperature: 0.7,
          maxTokens: 4000,
          awsRegion: process.env.AWS_REGION,
          awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
          awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          awsSessionToken: process.env.AWS_SESSION_TOKEN,
        },
        safety: {
          mode: 'moderate',
          requireConfirmation: true,
          readOnlyMode: process.env.JAMF_READ_ONLY === 'true',
          maxConcurrentTasks: 5,
          auditLogPath: './logs/agent-audit.log',
        },
        monitoring: {
          enableMetrics: true,
          metricsPort: 9090,
          logLevel: 'info',
        },
      },
      mcpConnection: {
        command: 'node',
        args: [`${process.cwd()}/dist/index.js`],
        env: {
          JAMF_URL: process.env.JAMF_URL || '',
          JAMF_CLIENT_ID: process.env.JAMF_CLIENT_ID || '',
          JAMF_CLIENT_SECRET: process.env.JAMF_CLIENT_SECRET || '',
          JAMF_READ_ONLY: process.env.JAMF_READ_ONLY || 'false',
        },
      },
    });
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'jamf-agent> ',
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.agent.on('initialized', () => {
      console.log('✅ Agent initialized successfully');
    });

    this.agent.on('mcp:connected', () => {
      console.log('🔌 Connected to Jamf MCP server');
    });

    this.agent.on('mcp:disconnected', () => {
      console.log('🔌 Disconnected from Jamf MCP server');
    });

    this.agent.on('task:planCreated', ({ plan }: { plan: TaskPlan }) => {
      console.log('\n📋 Task Plan Created:');
      console.log(`Goal: ${plan.goal}`);
      console.log(`Steps: ${plan.steps.length}`);
      plan.steps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step.description} (${step.toolName})`);
      });
      console.log('');
    });

    this.agent.on('task:confirmationRequired', ({ plan }: { plan: TaskPlan }) => {
      console.log('\n⚠️  Confirmation Required:');
      console.log(`This task will: ${plan.goal}`);
      this.rl.question('Do you want to proceed? (yes/no): ', (answer) => {
        const confirmed = answer.toLowerCase().startsWith('y');
        this.agent.confirmTask(confirmed);
        if (!confirmed) {
          console.log('❌ Task cancelled');
        }
      });
    });

    this.agent.on('task:stepStart', ({ step }) => {
      console.log(`▶️  Starting: ${step.description}`);
    });

    this.agent.on('task:stepComplete', ({ stepId, success }) => {
      console.log(`✅ Completed: Step ${stepId}`);
    });

    this.agent.on('task:stepError', ({ step, error }) => {
      console.log(`❌ Failed: ${step.description} - ${error.message}`);
    });

    this.agent.on('task:completed', ({ result }) => {
      console.log('\n✅ Task Completed Successfully');
      if (result.executionResult) {
        console.log(`  Completed: ${result.executionResult.completedSteps.length} steps`);
        console.log(`  Failed: ${result.executionResult.failedSteps.length} steps`);
        console.log(`  Duration: ${result.executionResult.duration}ms`);
      }
    });

    this.agent.on('task:failed', ({ error }) => {
      console.log(`\n❌ Task Failed: ${error.message}`);
    });
  }

  async start(): Promise<void> {
    console.log('🤖 Jamf AI Agent CLI');
    console.log('Type "help" for commands or enter a natural language request\n');

    // Check for required environment variables
    const missingVars = [];
    if (!process.env.JAMF_URL) missingVars.push('JAMF_URL');
    if (!process.env.JAMF_CLIENT_ID) missingVars.push('JAMF_CLIENT_ID');
    if (!process.env.JAMF_CLIENT_SECRET) missingVars.push('JAMF_CLIENT_SECRET');
    
    if (missingVars.length > 0) {
      console.log('⚠️  Missing required environment variables:');
      missingVars.forEach(v => console.log(`   - ${v}`));
      console.log('\nTo run the agent, set these environment variables:');
      console.log('export JAMF_URL="https://your-instance.jamfcloud.com"');
      console.log('export JAMF_CLIENT_ID="your-client-id"');
      console.log('export JAMF_CLIENT_SECRET="your-client-secret"');
      
      if (!process.env.OPENAI_API_KEY && !process.env.AWS_ACCESS_KEY_ID) {
        console.log('\n📝 Optional: Set AI provider credentials for natural language features:');
        console.log('\nOption 1 - AWS Bedrock (Claude, Llama):');
        console.log('export AWS_ACCESS_KEY_ID="your-access-key"');
        console.log('export AWS_SECRET_ACCESS_KEY="your-secret-key"');
        console.log('export AWS_REGION="us-east-1"');
        console.log('\nOption 2 - OpenAI:');
        console.log('export OPENAI_API_KEY="your-openai-api-key"');
        console.log('\n(Currently running with mock AI provider)');
      } else if (process.env.AWS_ACCESS_KEY_ID) {
        console.log('\n✅ Using AWS Bedrock for AI features');
      } else if (process.env.OPENAI_API_KEY) {
        console.log('\n✅ Using OpenAI for AI features');
      }
      console.log('');
    }

    try {
      await this.agent.initialize();
    } catch (error: any) {
      console.error(`\n❌ Failed to initialize agent: ${error.message}`);
      
      if (error.message.includes('Connection closed') && missingVars.length > 0) {
        console.error('\nThe MCP server failed to start due to missing configuration.');
        console.error('Please set the required environment variables and try again.');
      }
      
      process.exit(1);
    }

    this.running = true;
    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const command = line.trim();

      if (!command) {
        this.rl.prompt();
        return;
      }

      try {
        await this.handleCommand(command);
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
      }

      if (this.running) {
        this.rl.prompt();
      }
    });

    this.rl.on('close', () => {
      this.stop();
    });
  }

  private async handleCommand(command: string): Promise<void> {
    const lowerCommand = command.toLowerCase();

    switch (lowerCommand) {
      case 'help':
        this.showHelp();
        break;

      case 'status':
        await this.showStatus();
        break;

      case 'tools':
        await this.listTools();
        break;

      case 'resources':
        await this.listResources();
        break;

      case 'context':
        this.showContext();
        break;

      case 'clear':
        console.clear();
        break;

      case 'exit':
      case 'quit':
        this.stop();
        break;

      default:
        await this.executeRequest(command);
        break;
    }
  }

  private showHelp(): void {
    console.log(`
Available Commands:
  help      - Show this help message
  status    - Show agent status
  tools     - List available MCP tools
  resources - List available MCP resources
  context   - Show current conversation context
  clear     - Clear the screen
  exit/quit - Exit the CLI

Or enter any natural language request like:
  - "Find all devices that haven't checked in for 30 days"
  - "Deploy Chrome to the Marketing team"
  - "Show me the compliance status of executive devices"
    `);
  }

  private async showStatus(): Promise<void> {
    const config = this.agent.getConfig();
    console.log(`
Agent Status:
  AI Provider: ${config.aiProvider.type}
  AI Model: ${config.aiProvider.model || 'default'}
  Safety Mode: ${config.safety.mode}
  Read-Only: ${config.safety.readOnlyMode}
  MCP Connected: ${this.agent['mcpClient'].isConnected()}
    `);
  }

  private async listTools(): Promise<void> {
    const tools = await this.agent.getAvailableTools();
    console.log('\nAvailable Tools:');
    tools.forEach(tool => console.log(`  - ${tool}`));
  }

  private async listResources(): Promise<void> {
    const resources = await this.agent.getAvailableResources();
    console.log('\nAvailable Resources:');
    resources.forEach(resource => console.log(`  - ${resource}`));
  }

  private showContext(): void {
    const context = this.agent.getContext();
    console.log('\n' + context.getContextSummary());
  }

  private async executeRequest(request: string): Promise<void> {
    console.log('\n🤔 Processing your request...\n');
    const result = await this.agent.execute(request);
    
    if (!result.success && result.error) {
      console.log(`\n❌ Error: ${result.error}`);
    }
  }

  private stop(): void {
    this.running = false;
    console.log('\n👋 Shutting down agent...');
    
    this.agent.shutdown().then(() => {
      console.log('Goodbye!');
      process.exit(0);
    }).catch((error) => {
      console.error('Error during shutdown:', error);
      process.exit(1);
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new AgentCLI();
  cli.start().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}