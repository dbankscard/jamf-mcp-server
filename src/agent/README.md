# Jamf AI Agent

An intelligent agent that uses AI to interact with the Jamf MCP server for autonomous Apple device management.

## Overview

The Jamf AI Agent provides natural language interaction with Jamf Pro through the MCP protocol. It can understand complex requests, plan multi-step operations, and execute them safely with built-in safety checks and audit logging.

## Features

- **Natural Language Understanding**: Process requests like "Find all devices that haven't checked in for 30 days"
- **Intelligent Task Planning**: Breaks complex requests into executable steps
- **Safety First**: Built-in safety rules, confirmation prompts, and read-only mode
- **Comprehensive Audit Logging**: Tracks all operations for compliance
- **Flexible AI Providers**: Support for OpenAI, Anthropic (coming soon), and local models
- **Real-time Event System**: Monitor agent operations as they happen
- **CLI Interface**: Interactive command-line interface for direct usage

## Quick Start

### 1. Set Environment Variables

```bash
# Jamf Pro credentials
export JAMF_URL="https://your-instance.jamfcloud.com"
export JAMF_CLIENT_ID="your-client-id"
export JAMF_CLIENT_SECRET="your-client-secret"

# AI provider credentials
export OPENAI_API_KEY="your-openai-api-key"

# Agent configuration (optional)
export AGENT_SAFETY_MODE="moderate"  # strict, moderate, or permissive
export AGENT_READ_ONLY="false"
export AGENT_LOG_LEVEL="info"
```

### 2. Run the CLI

```bash
# Using the CLI interface
npx tsx src/agent/interface/CLIInterface.ts

# Or if compiled
node dist/agent/interface/CLIInterface.js
```

### 3. Use Natural Language

```
jamf-agent> Find all MacBooks that haven't reported in 30 days
jamf-agent> Deploy Chrome to the Marketing team
jamf-agent> Show me devices with less than 10GB free space
```

## Programmatic Usage

```typescript
import { JamfAgent } from './agent/index.js';

// Create and configure agent
const agent = new JamfAgent({
  config: {
    aiProvider: {
      type: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4-turbo-preview',
    },
    safety: {
      mode: 'moderate',
      requireConfirmation: true,
    },
  },
});

// Initialize
await agent.initialize();

// Execute natural language commands
const result = await agent.execute(
  "Find all devices in the Executive group and check their compliance status"
);

// Handle events
agent.on('task:stepComplete', (data) => {
  console.log('Step completed:', data);
});

// Shutdown when done
await agent.shutdown();
```

## Configuration

### Agent Configuration

```typescript
{
  mcpServer: {
    host: 'localhost',
    port: 3000,
    transport: 'stdio' | 'http' | 'websocket'
  },
  aiProvider: {
    type: 'openai' | 'anthropic' | 'local',
    apiKey: 'your-api-key',
    model: 'gpt-4-turbo-preview',
    temperature: 0.7,
    maxTokens: 4000
  },
  safety: {
    mode: 'strict' | 'moderate' | 'permissive',
    requireConfirmation: true,
    readOnlyMode: false,
    maxConcurrentTasks: 5,
    auditLogPath: './logs/agent-audit.log'
  },
  monitoring: {
    enableMetrics: true,
    metricsPort: 9090,
    logLevel: 'debug' | 'info' | 'warn' | 'error'
  }
}
```

### Safety Modes

- **Strict**: Denies destructive operations, requires confirmation for all modifications
- **Moderate**: Requires confirmation for destructive operations and bulk changes
- **Permissive**: Only requires confirmation for highly destructive operations

## Architecture

### Core Components

1. **AgentCore**: Main orchestrator that coordinates all components
2. **AgentContext**: Maintains conversation history and task state
3. **TaskExecutor**: Executes planned tasks with safety checks

### AI Integration

1. **AIProvider**: Abstract interface for different AI backends
2. **TaskPlanner**: Uses AI to create execution plans from natural language
3. **DecisionEngine**: Makes intelligent decisions during execution

### MCP Communication

1. **MCPClient**: Handles connection to Jamf MCP server
2. **ToolRegistry**: Maps available tools to capabilities
3. **ResponseHandler**: Processes MCP responses

### Safety & Compliance

1. **SafetyChecker**: Enforces safety rules before execution
2. **AuditLogger**: Logs all operations for compliance
3. **ConfirmationHandler**: Manages user confirmations

## Events

The agent emits various events during operation:

- `initialized`: Agent is ready to use
- `mcp:connected`: Connected to MCP server
- `mcp:disconnected`: Disconnected from MCP server
- `task:planCreated`: Task plan has been generated
- `task:confirmationRequired`: User confirmation needed
- `task:stepStart`: Starting a task step
- `task:stepComplete`: Task step completed
- `task:stepError`: Task step failed
- `task:completed`: Entire task completed
- `task:failed`: Task failed

## CLI Commands

- `help` - Show available commands
- `status` - Show agent status
- `tools` - List available MCP tools
- `resources` - List available MCP resources
- `context` - Show conversation context
- `clear` - Clear the screen
- `exit/quit` - Exit the CLI

## Examples

See the `examples/agent-example.ts` file for a complete working example.

## Safety Considerations

1. Always run in read-only mode when testing
2. Review audit logs regularly
3. Set appropriate safety mode for your environment
4. Implement proper authentication for production use
5. Monitor AI API usage and costs

## Roadmap

- [ ] Anthropic Claude support
- [ ] Local LLM support (Ollama, llama.cpp)
- [ ] Scheduled task execution
- [ ] Web UI dashboard
- [ ] Plugin system for custom tools
- [ ] Multi-tenant support
- [ ] Advanced analytics and reporting