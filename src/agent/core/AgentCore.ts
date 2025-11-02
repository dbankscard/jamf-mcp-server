import { EventEmitter } from 'events';
import { AgentConfig, AgentConfigManager } from './AgentConfig.js';
import { AgentContext } from './AgentContext.js';
import { TaskExecutor } from './TaskExecutor.js';
import { MCPClient, MCPConnectionOptions } from '../mcp/MCPClient.js';
import { AIProvider } from '../ai/AIProvider.js';
import { OpenAIProvider } from '../ai/providers/OpenAIProvider.js';
import { TaskPlanner, TaskPlan } from '../tasks/TaskPlanner.js';
import { SafetyChecker } from '../safety/SafetyRules.js';
import { AuditLogger } from '../safety/AuditLogger.js';

export interface AgentOptions {
  config?: Partial<AgentConfig>;
  mcpConnection?: MCPConnectionOptions;
}

export interface TaskExecutionResult {
  success: boolean;
  plan?: TaskPlan;
  executionResult?: any;
  error?: string;
}

export class JamfAgent extends EventEmitter {
  private configManager: AgentConfigManager;
  private context: AgentContext;
  private mcpClient: MCPClient;
  private aiProvider: AIProvider | null = null;
  private taskPlanner: TaskPlanner | null = null;
  private taskExecutor: TaskExecutor;
  private safetyChecker: SafetyChecker;
  private auditLogger: AuditLogger;
  private initialized: boolean = false;

  constructor(options: AgentOptions = {}) {
    super();
    
    this.configManager = new AgentConfigManager(options.config);
    this.context = new AgentContext();
    
    const mcpOptions = options.mcpConnection || this.getDefaultMCPConnection();
    this.mcpClient = new MCPClient(mcpOptions);
    
    this.safetyChecker = new SafetyChecker(this.configManager.get());
    this.auditLogger = new AuditLogger(this.configManager.get());
    
    this.taskExecutor = new TaskExecutor(this.mcpClient, this.context, this.safetyChecker);
    
    this.setupEventHandlers();
  }

  private getDefaultMCPConnection(): MCPConnectionOptions {
    const config = this.configManager.getMCPConfig();
    return {
      command: 'node',
      args: ['./dist/index.js'],
      env: {
        JAMF_URL: process.env.JAMF_URL || '',
        JAMF_CLIENT_ID: process.env.JAMF_CLIENT_ID || '',
        JAMF_CLIENT_SECRET: process.env.JAMF_CLIENT_SECRET || '',
        JAMF_READ_ONLY: this.configManager.isReadOnly() ? 'true' : 'false',
      },
    };
  }

  private async createAIProvider(): Promise<AIProvider> {
    const aiConfig = this.configManager.getAIConfig();
    
    switch (aiConfig.type) {
      case 'openai':
        return new OpenAIProvider(aiConfig);
      case 'anthropic':
        throw new Error('Anthropic provider not yet implemented');
      case 'local':
        throw new Error('Local provider not yet implemented');
      case 'mock':
        const { MockProvider } = await import('../ai/providers/MockProvider.js');
        return new MockProvider(aiConfig);
      case 'bedrock':
        const { BedrockProvider } = await import('../ai/providers/BedrockProvider.js');
        return new BedrockProvider(aiConfig);
      default:
        throw new Error(`Unknown AI provider type: ${aiConfig.type}`);
    }
  }

  private setupEventHandlers(): void {
    this.mcpClient.on('connected', () => {
      console.log('Connected to MCP server');
      this.emit('mcp:connected');
    });

    this.mcpClient.on('disconnected', (info) => {
      console.log('Disconnected from MCP server:', info);
      this.emit('mcp:disconnected', info);
    });

    this.mcpClient.on('error', (error) => {
      console.error('MCP client error:', error);
      this.emit('mcp:error', error);
    });

    this.taskExecutor.on('stepStart', (data) => {
      this.auditLogger.logTaskStep('start', data);
      this.emit('task:stepStart', data);
    });

    this.taskExecutor.on('stepComplete', (data) => {
      this.auditLogger.logTaskStep('complete', data);
      this.emit('task:stepComplete', data);
    });

    this.taskExecutor.on('stepError', (data) => {
      this.auditLogger.logTaskStep('error', data);
      this.emit('task:stepError', data);
    });

    this.taskExecutor.on('confirmationRequired', (data) => {
      this.emit('task:confirmationRequired', data);
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing Jamf Agent...');
    
    // Create AI provider
    this.aiProvider = await this.createAIProvider();
    this.taskPlanner = new TaskPlanner(this.aiProvider, this.mcpClient, this.context);
    
    // Connect to MCP server
    await this.mcpClient.connect();
    
    // Validate AI provider
    const valid = await this.aiProvider.validateConfig();
    if (!valid) {
      throw new Error('AI provider configuration is invalid');
    }

    this.initialized = true;
    console.log('Jamf Agent initialized successfully');
    this.emit('initialized');
  }

  async execute(userRequest: string): Promise<TaskExecutionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const taskId = `task-${Date.now()}`;
    this.auditLogger.logUserRequest(taskId, userRequest);
    
    try {
      this.context.addUserMessage(userRequest);
      
      if (!this.taskPlanner) {
        throw new Error('Task planner not initialized');
      }
      
      const plan = await this.taskPlanner.planTask(userRequest);
      this.emit('task:planCreated', { taskId, plan });
      
      const validationErrors = this.taskPlanner.validatePlan(plan);
      if (validationErrors.length > 0) {
        throw new Error(`Plan validation failed: ${validationErrors.join(', ')}`);
      }

      if (plan.requiresConfirmation && this.configManager.requiresConfirmation()) {
        this.emit('task:confirmationRequired', { taskId, plan });
        
        const confirmed = await this.waitForConfirmation(30000);
        if (!confirmed) {
          throw new Error('Task execution cancelled by user');
        }
      }

      const executionResult = await this.taskExecutor.executePlan(plan, {
        continueOnError: false,
        parallel: true,
      });

      const result: TaskExecutionResult = {
        success: executionResult.success,
        plan,
        executionResult,
      };

      this.context.addAssistantMessage(
        `Completed task with ${executionResult.completedSteps.length} successful steps and ${executionResult.failedSteps.length} failed steps.`
      );

      this.auditLogger.logTaskCompletion(taskId, result);
      this.emit('task:completed', { taskId, result });
      
      return result;
    } catch (error: any) {
      const result: TaskExecutionResult = {
        success: false,
        error: error.message,
      };

      this.context.addAssistantMessage(`Task failed: ${error.message}`);
      this.auditLogger.logTaskError(taskId, error);
      this.emit('task:failed', { taskId, error });
      
      return result;
    }
  }

  async scheduleTask(schedule: {
    type: string;
    schedule: string;
    actions: string[];
  }): Promise<void> {
    throw new Error('Scheduled tasks not yet implemented');
  }

  confirmTask(confirmed: boolean): void {
    this.taskExecutor.confirmStep(confirmed);
  }

  private waitForConfirmation(timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.removeAllListeners('user:confirmation');
        resolve(false);
      }, timeout);

      this.once('user:confirmation', (confirmed: boolean) => {
        clearTimeout(timer);
        resolve(confirmed);
      });
    });
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Jamf Agent...');
    
    await this.mcpClient.disconnect();
    await this.auditLogger.close();
    
    this.initialized = false;
    this.emit('shutdown');
  }

  getContext(): AgentContext {
    return this.context;
  }

  getConfig(): AgentConfig {
    return this.configManager.get();
  }

  async getAvailableTools(): Promise<string[]> {
    const tools = await this.mcpClient.listTools();
    return tools.map(t => t.name);
  }

  async getAvailableResources(): Promise<string[]> {
    const resources = await this.mcpClient.listResources();
    return resources.map(r => r.uri);
  }
}