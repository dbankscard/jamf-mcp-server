import { EventEmitter } from 'events';
import { MCPClient } from '../mcp/MCPClient.js';
import { AIProvider } from '../ai/AIProvider.js';
import { AgentConfig } from './AgentConfig.js';

export class SimpleAgent extends EventEmitter {
  private mcpClient: MCPClient;
  private aiProvider: AIProvider;
  private initialized: boolean = false;

  constructor(
    mcpClient: MCPClient,
    aiProvider: AIProvider,
    private config: AgentConfig
  ) {
    super();
    this.mcpClient = mcpClient;
    this.aiProvider = aiProvider;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.mcpClient.connect();
    await this.aiProvider.validateConfig();
    
    this.initialized = true;
    this.emit('initialized');
  }

  async processRequest(userInput: string): Promise<any> {
    if (!this.initialized) {
      throw new Error('Agent not initialized');
    }

    // Get available tools
    const tools = await this.mcpClient.listTools();
    
    // Create a simple prompt for Claude
    const systemPrompt = `You are a Jamf device management assistant. Convert natural language requests into MCP tool calls.

Available tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Instructions:
1. Understand what the user wants
2. Pick the most appropriate tool
3. Generate the correct arguments
4. For searches, the searchDevices tool takes a "query" parameter
5. Keep it simple - one tool call per request

Examples:
- "show dwight's computer" → searchDevices with query="dwight"
- "get details for device 759" → getDeviceDetails with deviceId="759"
- "list all policies" → listPolicies
`;

    // Ask Claude to generate the tool call
    const response = await this.aiProvider.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ],
      tools: tools.map(t => ({
        name: t.name,
        description: t.description || '',
        parameters: t.inputSchema || {}
      }))
    });

    // Execute the tool call if Claude generated one
    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolCall = response.toolCalls[0];
      
      console.log(`\n🔧 Calling tool: ${toolCall.name}`);
      console.log(`📊 Arguments:`, toolCall.arguments);
      
      try {
        const result = await this.mcpClient.callTool({
          name: toolCall.name,
          arguments: toolCall.arguments
        });
        
        // Display the result
        if (result.content && result.content[0]) {
          const content = result.content[0];
          if (content.type === 'text') {
            try {
              const data = JSON.parse(content.text);
              console.log('\n📋 Results:');
              console.log(JSON.stringify(data, null, 2));
            } catch {
              console.log('\n📋 Results:');
              console.log(content.text);
            }
          }
        }
        
        return result;
      } catch (error: any) {
        console.error(`\n❌ Tool execution failed: ${error.message}`);
        throw error;
      }
    } else {
      console.log('\n💬 Response:', response.content);
      return response;
    }
  }

  async shutdown(): Promise<void> {
    await this.mcpClient.disconnect();
    this.initialized = false;
  }
}