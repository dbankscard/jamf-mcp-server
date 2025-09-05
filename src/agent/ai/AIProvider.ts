import { z } from 'zod';

export const AIRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().optional(),
  tools: z.array(z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.any()),
  })).optional(),
});

export const AIResponseSchema = z.object({
  content: z.string(),
  toolCalls: z.array(z.object({
    id: z.string(),
    name: z.string(),
    arguments: z.record(z.any()),
  })).optional(),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }).optional(),
});

export type AIRequest = z.infer<typeof AIRequestSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;
export type AIMessage = AIRequest['messages'][0];
export type AITool = NonNullable<AIRequest['tools']>[0];
export type AIToolCall = NonNullable<AIResponse['toolCalls']>[0];

export interface AIProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
}

export abstract class AIProvider {
  protected config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  abstract complete(request: AIRequest): Promise<AIResponse>;
  
  abstract validateConfig(): Promise<boolean>;
  
  abstract getModelName(): string;
  
  async buildSystemPrompt(context: string): Promise<string> {
    return `You are an intelligent Jamf device management agent. You help manage Apple devices using the Jamf Pro MCP server.

Current Context:
${context}

Guidelines:
1. Analyze requests carefully and plan actions before execution
2. Use ONLY the available tools to interact with Jamf Pro - do not create imaginary tools
3. Each step in your plan must use exactly one of the provided tools with valid arguments
4. Do not include formatting or output steps - the results will be automatically displayed
5. Ensure all actions are safe and follow best practices
6. Ask for clarification when requests are ambiguous
7. Respect read-only mode and confirmation requirements

Important: When creating a task plan, only use tools that are actually provided. Do not create steps for formatting, displaying, or processing data - focus only on the data retrieval and actions.`;
  }

  formatToolsForProvider(tools: AITool[]): any {
    return tools;
  }

  parseToolCallsFromResponse(response: any): AIToolCall[] {
    return [];
  }

  protected sanitizeMessages(messages: AIMessage[]): AIMessage[] {
    return messages.map(msg => ({
      ...msg,
      content: msg.content.trim(),
    }));
  }

  protected enforceTokenLimit(messages: AIMessage[], maxTokens: number): AIMessage[] {
    const estimatedTokensPerMessage = 100;
    const maxMessages = Math.floor(maxTokens / estimatedTokensPerMessage);
    
    if (messages.length <= maxMessages) {
      return messages;
    }

    const systemMessages = messages.filter(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    const keepMessages = maxMessages - systemMessages.length;
    const trimmedOthers = otherMessages.slice(-keepMessages);
    
    return [...systemMessages, ...trimmedOthers];
  }
}