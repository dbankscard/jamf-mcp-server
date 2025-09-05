import { JamfAgent } from '../src/agent/index.js';

async function runAgentExample() {
  console.log('🤖 Jamf AI Agent Example\n');

  // Create agent with custom configuration
  const agent = new JamfAgent({
    config: {
      aiProvider: {
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4-turbo-preview',
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
      args: [`${process.cwd()}/dist/index.js`],
      env: {
        JAMF_URL: process.env.JAMF_URL!,
        JAMF_CLIENT_ID: process.env.JAMF_CLIENT_ID!,
        JAMF_CLIENT_SECRET: process.env.JAMF_CLIENT_SECRET!,
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
    console.log('In a real application, you would prompt the user here.');
    // Auto-confirm for this example
    setTimeout(() => {
      console.log('Auto-confirming for demo purposes...');
      agent.confirmTask(true);
    }, 1000);
  });

  try {
    // Initialize the agent
    await agent.initialize();

    // Example 1: Simple device search
    console.log('\n--- Example 1: Device Search ---');
    const result1 = await agent.execute(
      "Find all devices with 'Marketing' in the name"
    );
    console.log(`Result: ${result1.success ? 'Success' : 'Failed'}`);

    // Example 2: Compliance check
    console.log('\n--- Example 2: Compliance Check ---');
    const result2 = await agent.execute(
      "Check which devices haven't reported in the last 30 days and show me a summary"
    );
    console.log(`Result: ${result2.success ? 'Success' : 'Failed'}`);

    // Example 3: Complex multi-step task
    console.log('\n--- Example 3: Multi-Step Task ---');
    const result3 = await agent.execute(
      "Find all MacBooks in the Executive group, check their disk space, and create a report of devices with less than 20GB free"
    );
    console.log(`Result: ${result3.success ? 'Success' : 'Failed'}`);

    // Show conversation context
    console.log('\n--- Conversation Summary ---');
    const context = agent.getContext();
    console.log(context.getContextSummary());

    // Show available tools
    console.log('\n--- Available Tools ---');
    const tools = await agent.getAvailableTools();
    console.log(`Found ${tools.length} tools:`, tools.slice(0, 5).join(', '), '...');

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    // Cleanup
    await agent.shutdown();
    console.log('\n👋 Agent shutdown complete');
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  runAgentExample().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}