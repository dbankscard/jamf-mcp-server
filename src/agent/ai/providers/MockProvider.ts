import { AIProvider, AIRequest, AIResponse, AIProviderConfig } from '../AIProvider.js';

export class MockProvider extends AIProvider {
  constructor(config: AIProviderConfig) {
    super(config);
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    console.log('Mock AI Provider - Request:', {
      messages: request.messages.length,
      tools: request.tools?.length || 0,
    });

    // Simulate AI response based on the last user message
    const lastMessage = request.messages[request.messages.length - 1];
    
    if (request.tools && request.tools.length > 0) {
      // If tools are provided, create a mock tool call
      const mockToolCall = this.generateMockToolCall(lastMessage.content, request.tools);
      
      return {
        content: `I'll help you with: ${lastMessage.content}`,
        toolCalls: mockToolCall ? [mockToolCall] : undefined,
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      };
    }

    return {
      content: `Mock response to: ${lastMessage.content}`,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }

  async validateConfig(): Promise<boolean> {
    return true;
  }

  getModelName(): string {
    return 'mock-model';
  }

  private generateMockToolCall(userMessage: string, tools: any[]): any | null {
    const message = userMessage.toLowerCase();
    
    // Mock task planning
    if (tools.some(t => t.name === 'create_task_plan')) {
      return {
        id: 'mock-call-1',
        name: 'create_task_plan',
        arguments: {
          goal: `Process request: ${userMessage}`,
          steps: [
            {
              id: 'step-1',
              description: 'Search for devices',
              toolName: 'searchDevices',
              arguments: { query: 'marketing', limit: 10 },
              dependencies: [],
              optional: false,
            },
            {
              id: 'step-2',
              description: 'Get device details',
              toolName: 'getDeviceDetails',
              arguments: { deviceId: '123' },
              dependencies: ['step-1'],
              optional: false,
            },
          ],
          estimatedDuration: 30,
          requiresConfirmation: false,
        },
      };
    }

    // Mock other tool calls based on keywords
    if (message.includes('find') || message.includes('search')) {
      return {
        id: 'mock-call-2',
        name: 'searchDevices',
        arguments: {
          query: 'test',
          limit: 10,
        },
      };
    }

    if (message.includes('compliance') || message.includes('check')) {
      return {
        id: 'mock-call-3',
        name: 'checkDeviceCompliance',
        arguments: {
          days: 30,
          includeDetails: true,
        },
      };
    }

    return null;
  }
}