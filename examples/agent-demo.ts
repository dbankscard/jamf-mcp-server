import { JamfAgent } from '../src/agent/index.js';

async function runAgentDemo() {
  console.log('🤖 Jamf AI Agent Demo (using Mock Provider)\n');

  // Create agent with mock provider for demonstration
  const agent = new JamfAgent({
    config: {
      mcpServer: {
        host: 'localhost',
        port: 3000,
        transport: 'stdio',
      },
      aiProvider: {
        type: 'mock',
        model: 'mock-model',
        temperature: 0.7,
      },
      safety: {
        mode: 'moderate',
        requireConfirmation: true,
        readOnlyMode: false,
      },
      monitoring: {
        logLevel: 'info',
      },
    },
    mcpConnection: {
      command: 'node',
      args: ['./dist/index.js'],
      env: {
        JAMF_URL: process.env.JAMF_URL || 'https://demo.jamfcloud.com',
        JAMF_CLIENT_ID: process.env.JAMF_CLIENT_ID || 'demo-client',
        JAMF_CLIENT_SECRET: process.env.JAMF_CLIENT_SECRET || 'demo-secret',
        JAMF_READ_ONLY: 'true', // Demo mode - read only
      },
    },
  });

  // Set up event handlers
  agent.on('mcp:connected', () => {
    console.log('✅ Connected to Jamf MCP server');
  });

  agent.on('task:planCreated', ({ plan }) => {
    console.log('\n📋 Task Plan:');
    console.log(`Goal: ${plan.goal}`);
    console.log(`Steps: ${plan.steps.length}`);
    plan.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.description}`);
    });
  });

  agent.on('task:stepStart', ({ step }) => {
    console.log(`\n▶️  Executing: ${step.description}`);
  });

  agent.on('task:stepComplete', ({ stepId }) => {
    console.log(`✅ Completed step: ${stepId}`);
  });

  agent.on('task:confirmationRequired', ({ plan }) => {
    console.log('\n⚠️  This operation requires confirmation.');
    console.log('Auto-confirming for demo purposes...');
    setTimeout(() => {
      agent.confirmTask(true);
    }, 1000);
  });

  agent.on('mcp:error', (error) => {
    console.log('\n⚠️  MCP Connection Error (expected in demo mode):', error.message);
    console.log('Continuing with mock data...\n');
  });

  try {
    // Initialize the agent
    console.log('Initializing agent...');
    await agent.initialize().catch((error) => {
      console.log('⚠️  MCP initialization failed (expected in demo mode)');
      console.log('The agent will continue with limited functionality\n');
    });

    // Example 1: Simple device search
    console.log('\n--- Example 1: Device Search ---');
    const result1 = await agent.execute(
      "Find all devices with 'Marketing' in the name"
    );
    console.log(`Result: ${result1.success ? 'Success' : 'Failed'}`);
    if (!result1.success) {
      console.log(`Reason: ${result1.error}`);
    }

    // Show conversation context
    console.log('\n--- Conversation Summary ---');
    const context = agent.getContext();
    const history = context.getConversationHistory();
    console.log(`Messages: ${history.length}`);
    history.slice(-3).forEach(msg => {
      console.log(`[${msg.role}] ${msg.content.substring(0, 100)}...`);
    });

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    // Cleanup
    console.log('\n👋 Shutting down agent...');
    await agent.shutdown().catch(() => {
      console.log('Agent shutdown complete');
    });
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runAgentDemo().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}