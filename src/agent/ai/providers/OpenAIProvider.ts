import { AIProvider, AIRequest, AIResponse, AIToolCall, AIProviderConfig } from '../AIProvider.js';
import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../../server/logger.js';

const logger = createLogger('OpenAIProvider');

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider extends AIProvider {
  private client: AxiosInstance;
  private model: string;

  constructor(config: AIProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.model = config.model || 'gpt-3.5-turbo';
    
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const messages = this.sanitizeMessages(request.messages);
    
    const requestBody: any = {
      model: this.model,
      messages: messages as OpenAIMessage[],
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4000,
    };

    if (request.tools && request.tools.length > 0) {
      requestBody.tools = this.formatToolsForProvider(request.tools);
      requestBody.tool_choice = 'auto';
    }

    try {
      const response = await this.client.post<OpenAIResponse>('/chat/completions', requestBody);
      
      const choice = response.data.choices[0];
      const message = choice.message;
      
      const toolCalls: AIToolCall[] = [];
      
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          try {
            toolCalls.push({
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments),
            });
          } catch (error) {
            logger.error('Failed to parse tool arguments', { error });
          }
        }
      }

      return {
        content: message.content || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: response.data.usage ? {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens,
        } : undefined,
      };
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: { message?: string } } } };
      if (axiosError.response) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`OpenAI API error: ${axiosError.response.data?.error?.message || message}`);
      }
      throw error;
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await this.client.get('/models');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  getModelName(): string {
    return this.model;
  }

  formatToolsForProvider(tools: any[]): OpenAITool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.properties || {},
          required: tool.parameters.required || [],
        },
      },
    }));
  }
}