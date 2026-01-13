import { EventEmitter } from 'events';
import { MCPClient, MCPToolCall } from '../mcp/MCPClient.js';
import { AgentContext, TaskResult } from './AgentContext.js';
import { TaskPlan, TaskStep, TaskPlanner } from '../tasks/TaskPlanner.js';
import { SafetyChecker } from '../safety/SafetyRules.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../../server/logger.js';

const logger = createLogger('TaskExecutor');

export interface TaskExecutionOptions {
  dryRun?: boolean;
  parallel?: boolean;
  continueOnError?: boolean;
  timeout?: number;
}

export interface StepExecutionResult {
  stepId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

export interface PlanExecutionResult {
  success: boolean;
  completedSteps: string[];
  failedSteps: string[];
  results: Map<string, StepExecutionResult>;
  duration: number;
}

export class TaskExecutor extends EventEmitter {
  constructor(
    private mcpClient: MCPClient,
    private context: AgentContext,
    private safetyChecker: SafetyChecker
  ) {
    super();
  }

  async executePlan(
    plan: TaskPlan,
    options: TaskExecutionOptions = {}
  ): Promise<PlanExecutionResult> {
    const startTime = Date.now();
    const results = new Map<string, StepExecutionResult>();
    const completedSteps: string[] = [];
    const failedSteps: string[] = [];

    this.emit('planStart', { plan, options });

    try {
      const steps = this.getExecutableSteps(plan);
      
      if (options.parallel) {
        await this.executeParallel(steps, results, completedSteps, failedSteps, options);
      } else {
        await this.executeSequential(steps, results, completedSteps, failedSteps, options);
      }
    } catch (error: unknown) {
      this.emit('planError', { plan, error });
      throw error;
    }

    const duration = Date.now() - startTime;
    const success = failedSteps.length === 0;

    const result: PlanExecutionResult = {
      success,
      completedSteps,
      failedSteps,
      results,
      duration,
    };

    this.emit('planComplete', result);
    return result;
  }

  async executeStep(
    step: TaskStep,
    options: TaskExecutionOptions = {}
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    const taskId = `${step.id}-${Date.now()}`;

    this.emit('stepStart', { step, taskId });
    this.context.startTask(taskId, step.toolName, step.arguments);

    try {
      if (options.dryRun) {
        const result: StepExecutionResult = {
          stepId: step.id,
          success: true,
          result: { dryRun: true, wouldExecute: step },
          duration: 0,
        };
        
        this.context.completeTask(taskId, {
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
        
        this.emit('stepComplete', result);
        return result;
      }

      const safetyCheck = await this.safetyChecker.checkToolCall({
        name: step.toolName,
        arguments: step.arguments,
      });

      if (!safetyCheck.allowed) {
        throw new Error(`Safety check failed: ${safetyCheck.reason}`);
      }

      if (safetyCheck.requiresConfirmation && !options.dryRun) {
        const confirmed = await this.requestConfirmation(step);
        if (!confirmed) {
          throw new Error('User declined confirmation');
        }
      }

      const toolResult = await this.executeToolCall({
        name: step.toolName,
        arguments: step.arguments,
      }, options.timeout);

      const duration = Date.now() - startTime;
      const result: StepExecutionResult = {
        stepId: step.id,
        success: true,
        result: toolResult,
        duration,
      };

      this.context.completeTask(taskId, {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });

      // Log the result for debugging
      if (result.result?.content?.length > 0) {
        logger.debug('Step results', {
          stepId: step.id,
          result: JSON.stringify(result.result.content[0], null, 2).substring(0, 500),
        });
      }
      
      this.emit('stepComplete', result);
      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      const result: StepExecutionResult = {
        stepId: step.id,
        success: false,
        error: message,
        duration,
      };

      this.context.completeTask(taskId, {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      });

      this.emit('stepError', { step, error });

      if (!options.continueOnError) {
        throw error;
      }

      return result;
    }
  }

  private async executeToolCall(
    toolCall: MCPToolCall,
    timeout?: number
  ): Promise<CallToolResult> {
    if (timeout) {
      return Promise.race([
        this.mcpClient.callTool(toolCall),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Tool call timeout')), timeout)
        ),
      ]);
    }
    
    return this.mcpClient.callTool(toolCall);
  }

  private async executeSequential(
    steps: TaskStep[],
    results: Map<string, StepExecutionResult>,
    completedSteps: string[],
    failedSteps: string[],
    options: TaskExecutionOptions
  ): Promise<void> {
    for (const step of steps) {
      if (this.canExecuteStep(step, results)) {
        const result = await this.executeStep(step, options);
        results.set(step.id, result);
        
        if (result.success) {
          completedSteps.push(step.id);
        } else {
          failedSteps.push(step.id);
          if (!options.continueOnError && !step.optional) {
            break;
          }
        }
      }
    }
  }

  private async executeParallel(
    steps: TaskStep[],
    results: Map<string, StepExecutionResult>,
    completedSteps: string[],
    failedSteps: string[],
    options: TaskExecutionOptions
  ): Promise<void> {
    const executing = new Set<string>();
    
    while (completedSteps.length + failedSteps.length < steps.length) {
      const ready = steps.filter(step => 
        !results.has(step.id) &&
        !executing.has(step.id) &&
        this.canExecuteStep(step, results)
      );

      if (ready.length === 0 && executing.size === 0) {
        break;
      }

      const promises = ready.map(async (step) => {
        executing.add(step.id);
        try {
          const result = await this.executeStep(step, options);
          results.set(step.id, result);
          
          if (result.success) {
            completedSteps.push(step.id);
          } else {
            failedSteps.push(step.id);
          }
        } finally {
          executing.delete(step.id);
        }
      });

      await Promise.race(promises);
    }
  }

  private canExecuteStep(
    step: TaskStep,
    results: Map<string, StepExecutionResult>
  ): boolean {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true;
    }

    return step.dependencies.every(depId => {
      const depResult = results.get(depId);
      return depResult && depResult.success;
    });
  }

  private getExecutableSteps(plan: TaskPlan): TaskStep[] {
    return TaskPlanner.getExecutionOrder(plan);
  }

  private async requestConfirmation(step: TaskStep): Promise<boolean> {
    this.emit('confirmationRequired', { step });
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.removeAllListeners('confirmationResponse');
        resolve(false);
      }, 30000);

      this.once('confirmationResponse', (confirmed: boolean) => {
        clearTimeout(timeout);
        resolve(confirmed);
      });
    });
  }

  confirmStep(confirmed: boolean): void {
    this.emit('confirmationResponse', confirmed);
  }
}