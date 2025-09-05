import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { 
  Tool, 
  Resource, 
  CallToolResult,
  ReadResourceResult,
  ListToolsResult,
  ListResourcesResult,
} from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from 'events';

export interface MCPConnectionOptions {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export class MCPClient extends EventEmitter {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;
  private tools: Map<string, Tool> = new Map();
  private resources: Map<string, Resource> = new Map();

  constructor(private options: MCPConnectionOptions) {
    super();
  }

  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('Already connected to MCP server');
    }

    try {
      console.error('Starting MCP server process...');
      
      // StdioClientTransport expects command and args in its constructor
      this.transport = new StdioClientTransport({
        command: this.options.command,
        args: this.options.args,
        env: { ...process.env, ...this.options.env },
      } as any);

      this.client = new Client(
        {
          name: 'jamf-agent',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await this.client.connect(this.transport);
      this.connected = true;
      
      console.error('Connected to MCP server');
      this.emit('connected');

      await this.discoverCapabilities();
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    this.connected = false;
    this.tools.clear();
    this.resources.clear();
    
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async discoverCapabilities(): Promise<void> {
    if (!this.client) throw new Error('Not connected to MCP server');

    try {
      const toolsResult = await this.client.listTools();
      for (const tool of toolsResult.tools) {
        this.tools.set(tool.name, tool);
      }
      console.error(`Discovered ${this.tools.size} tools`);

      const resourcesResult = await this.client.listResources();
      for (const resource of resourcesResult.resources) {
        this.resources.set(resource.uri, resource);
      }
      console.error(`Discovered ${this.resources.size} resources`);
    } catch (error) {
      console.error('Failed to discover capabilities:', error);
    }
  }

  async listTools(): Promise<Tool[]> {
    if (!this.client) throw new Error('Not connected to MCP server');
    
    const result = await this.client.listTools();
    return result.tools;
  }

  async listResources(): Promise<Resource[]> {
    if (!this.client) throw new Error('Not connected to MCP server');
    
    const result = await this.client.listResources();
    return result.resources;
  }

  async callTool(toolCall: MCPToolCall): Promise<CallToolResult> {
    if (!this.client) throw new Error('Not connected to MCP server');
    
    const tool = this.tools.get(toolCall.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolCall.name}`);
    }

    console.error(`Calling tool: ${toolCall.name}`, toolCall.arguments);
    
    try {
      const result = await this.client.callTool({
        name: toolCall.name,
        arguments: toolCall.arguments,
      });
      
      return result as CallToolResult;
    } catch (error) {
      console.error(`Tool call failed: ${toolCall.name}`, error);
      throw error;
    }
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    if (!this.client) throw new Error('Not connected to MCP server');
    
    const resource = this.resources.get(uri);
    if (!resource) {
      throw new Error(`Unknown resource: ${uri}`);
    }

    console.error(`Reading resource: ${uri}`);
    
    try {
      const result = await this.client.readResource({ uri });
      return result as ReadResourceResult;
    } catch (error) {
      console.error(`Resource read failed: ${uri}`, error);
      throw error;
    }
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getResource(uri: string): Resource | undefined {
    return this.resources.get(uri);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getAllResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  searchTools(query: string): Tool[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTools().filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description?.toLowerCase().includes(lowerQuery)
    );
  }

  searchResources(query: string): Resource[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllResources().filter(resource => 
      resource.uri.toLowerCase().includes(lowerQuery) ||
      resource.name.toLowerCase().includes(lowerQuery) ||
      resource.description?.toLowerCase().includes(lowerQuery)
    );
  }
}