import { AIProvider, AIRequest, AIResponse, AIToolCall, AIProviderConfig } from '../AIProvider.js';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput
} from '@aws-sdk/client-bedrock-runtime';
import { createLogger } from '../../../server/logger.js';

const logger = createLogger('BedrockProvider');

interface BedrockConfig extends AIProviderConfig {
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

interface ClaudeResponse {
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, any>;
  }>;
  stop_reason: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class BedrockProvider extends AIProvider {
  private client: BedrockRuntimeClient;
  private model: string;
  private region: string;

  constructor(config: BedrockConfig) {
    super(config);
    
    this.region = config.awsRegion || process.env.AWS_REGION || 'us-east-1';
    this.model = config.model || 'anthropic.claude-3-sonnet-20240229-v1:0';
    
    // Configure AWS client
    const clientConfig: any = {
      region: this.region,
    };

    // Use explicit credentials if provided
    if (config.awsAccessKeyId && config.awsSecretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
        sessionToken: config.awsSessionToken,
      };
    }
    // Otherwise, SDK will use default credential chain (env vars, IAM role, etc.)

    this.client = new BedrockRuntimeClient(clientConfig);
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const messages = this.convertMessages(request.messages);
    
    // Build the request based on the model type
    const modelRequest = this.buildModelRequest(messages, request);
    
    const input: InvokeModelCommandInput = {
      modelId: this.model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(modelRequest),
    };

    try {
      const command = new InvokeModelCommand(input);
      const response = await this.client.send(command);
      
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return this.parseModelResponse(responseBody);
    } catch (error: unknown) {
      const errorName = (error as { name?: string }).name;
      const message = error instanceof Error ? error.message : String(error);
      if (errorName === 'ResourceNotFoundException') {
        throw new Error(`Model ${this.model} not found in region ${this.region}. Check model availability.`);
      }
      if (errorName === 'AccessDeniedException') {
        throw new Error('Access denied to Bedrock. Check IAM permissions for bedrock:InvokeModel.');
      }
      throw new Error(`Bedrock API error: ${message}`);
    }
  }

  private convertMessages(messages: AIRequest['messages']): ClaudeMessage[] {
    const claudeMessages: ClaudeMessage[] = [];
    
    // Combine system messages into the first user message for Claude
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    if (systemMessages.length > 0 && nonSystemMessages.length > 0) {
      const systemPrompt = systemMessages.map(m => m.content).join('\n\n');
      const firstUserMessage = nonSystemMessages[0];
      
      if (firstUserMessage.role === 'user') {
        claudeMessages.push({
          role: 'user',
          content: `${systemPrompt}\n\n${firstUserMessage.content}`,
        });
        
        // Add remaining messages
        nonSystemMessages.slice(1).forEach(msg => {
          claudeMessages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        });
      } else {
        // If first non-system message is not from user, add system as a user message
        claudeMessages.push({
          role: 'user',
          content: systemPrompt,
        });
        nonSystemMessages.forEach(msg => {
          claudeMessages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        });
      }
    } else {
      // No system messages or no other messages
      messages.forEach(msg => {
        if (msg.role === 'system') {
          claudeMessages.push({ role: 'user', content: msg.content });
        } else {
          claudeMessages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }
      });
    }
    
    return claudeMessages;
  }

  private buildModelRequest(messages: ClaudeMessage[], request: AIRequest): any {
    // Claude 3 format
    if (this.model.includes('claude-3')) {
      const modelRequest: any = {
        anthropic_version: 'bedrock-2023-05-31',
        messages: messages,
        max_tokens: request.maxTokens || this.config.maxTokens || 4000,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
      };

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        modelRequest.tools = request.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: {
            type: 'object',
            properties: tool.parameters.properties || tool.parameters || {},
            required: tool.parameters.required || [],
          },
        }));
      }

      return modelRequest;
    }
    
    // Claude 2 format (legacy)
    if (this.model.includes('claude-v2')) {
      let prompt = '';
      messages.forEach((msg, i) => {
        if (msg.role === 'user') {
          prompt += `\n\nHuman: ${msg.content}`;
        } else {
          prompt += `\n\nAssistant: ${msg.content}`;
        }
      });
      prompt += '\n\nAssistant:';
      
      return {
        prompt,
        max_tokens_to_sample: request.maxTokens || 4000,
        temperature: request.temperature ?? 0.7,
      };
    }

    // Llama 2 format
    if (this.model.includes('llama')) {
      let prompt = '<s>[INST] ';
      messages.forEach((msg, i) => {
        if (msg.role === 'user') {
          if (i > 0) prompt += ' [INST] ';
          prompt += msg.content;
          if (i < messages.length - 1) prompt += ' [/INST] ';
        } else {
          prompt += msg.content + ' </s>';
        }
      });
      if (!prompt.endsWith('[/INST] ')) prompt += ' [/INST]';
      
      return {
        prompt,
        max_gen_len: request.maxTokens || 4000,
        temperature: request.temperature ?? 0.7,
      };
    }

    throw new Error(`Unsupported model: ${this.model}`);
  }

  private parseModelResponse(response: any): AIResponse {
    // Claude 3 response
    if (response.content) {
      const claudeResponse = response as ClaudeResponse;
      let textContent = '';
      const toolCalls: AIToolCall[] = [];
      
      for (const content of claudeResponse.content) {
        if (content.type === 'text') {
          textContent += content.text || '';
        } else if (content.type === 'tool_use') {
          toolCalls.push({
            id: content.id!,
            name: content.name!,
            arguments: content.input!,
          });
        }
      }
      
      return {
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: claudeResponse.usage ? {
          promptTokens: claudeResponse.usage.input_tokens,
          completionTokens: claudeResponse.usage.output_tokens,
          totalTokens: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens,
        } : undefined,
      };
    }
    
    // Claude 2 response
    if (response.completion) {
      return {
        content: response.completion,
      };
    }
    
    // Llama response
    if (response.generation) {
      return {
        content: response.generation,
      };
    }

    throw new Error('Unexpected response format from Bedrock');
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Try a simple invocation to test credentials
      const testRequest: AIRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
        maxTokens: 10,
      };

      await this.complete(testRequest);
      return true;
    } catch (error) {
      logger.error('Bedrock config validation failed', { error });
      return false;
    }
  }

  getModelName(): string {
    return this.model;
  }
}