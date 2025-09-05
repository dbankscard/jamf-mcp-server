import { z } from 'zod';
import { AIProvider, AIMessage } from '../ai/AIProvider.js';
import { MCPClient } from '../mcp/MCPClient.js';
import { AgentContext } from '../core/AgentContext.js';

export const TaskStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  toolName: z.string(),
  arguments: z.record(z.any()),
  dependencies: z.array(z.string()).optional(),
  optional: z.boolean().optional(),
});

export const TaskPlanSchema = z.object({
  goal: z.string(),
  steps: z.array(TaskStepSchema),
  estimatedDuration: z.number().optional(),
  requiresConfirmation: z.boolean().optional(),
});

export type TaskStep = z.infer<typeof TaskStepSchema>;
export type TaskPlan = z.infer<typeof TaskPlanSchema>;

export class TaskPlanner {
  constructor(
    private aiProvider: AIProvider,
    private mcpClient: MCPClient,
    private context: AgentContext
  ) {}

  async planTask(userRequest: string): Promise<TaskPlan> {
    const tools = this.mcpClient.getAllTools();
    const systemPrompt = await this.buildPlanningPrompt(tools);
    
    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userRequest },
    ];

    const response = await this.aiProvider.complete({
      messages,
      temperature: 0.5,
      tools: [{
        name: 'create_task_plan',
        description: 'Create a detailed task plan',
        parameters: {
          properties: {
            goal: { type: 'string', description: 'The overall goal of the task' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique step ID' },
                  description: { type: 'string', description: 'What this step does' },
                  toolName: { type: 'string', description: 'The MCP tool to use' },
                  arguments: { type: 'object', description: 'Arguments for the tool' },
                  dependencies: { type: 'array', items: { type: 'string' }, description: 'IDs of steps this depends on' },
                  optional: { type: 'boolean', description: 'Whether this step is optional' },
                },
                required: ['id', 'description', 'toolName', 'arguments'],
              },
            },
            estimatedDuration: { type: 'number', description: 'Estimated duration in seconds' },
            requiresConfirmation: { type: 'boolean', description: 'Whether user confirmation is needed' },
          },
          required: ['goal', 'steps'],
        },
      }],
    });

    if (!response.toolCalls || response.toolCalls.length === 0) {
      throw new Error('AI did not generate a task plan');
    }

    const planCall = response.toolCalls[0];
    if (planCall.name !== 'create_task_plan') {
      throw new Error('Unexpected tool call from AI');
    }

    try {
      return TaskPlanSchema.parse(planCall.arguments);
    } catch (error: any) {
      console.error('Failed to parse task plan:', error.message);
      console.error('Raw plan data:', JSON.stringify(planCall.arguments, null, 2));
      throw error;
    }
  }

  async refinePlan(plan: TaskPlan, feedback: string): Promise<TaskPlan> {
    const messages: AIMessage[] = [
      { role: 'system', content: 'You are refining a task plan based on user feedback.' },
      { role: 'assistant', content: `Current plan:\n${JSON.stringify(plan, null, 2)}` },
      { role: 'user', content: `Please refine the plan based on this feedback: ${feedback}` },
    ];

    const response = await this.aiProvider.complete({
      messages,
      temperature: 0.5,
      tools: [{
        name: 'refine_task_plan',
        description: 'Refine the existing task plan',
        parameters: {
          properties: {
            goal: { type: 'string' },
            steps: { type: 'array', items: { type: 'object' } },
            estimatedDuration: { type: 'number' },
            requiresConfirmation: { type: 'boolean' },
          },
          required: ['goal', 'steps'],
        },
      }],
    });

    if (!response.toolCalls || response.toolCalls.length === 0) {
      throw new Error('AI did not generate a refined plan');
    }

    return TaskPlanSchema.parse(response.toolCalls[0].arguments);
  }

  private async buildPlanningPrompt(tools: any[]): Promise<string> {
    const toolDescriptions = tools.map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join('\n');

    return `You are a task planning assistant for Jamf device management operations.

Available MCP Tools (ONLY use these tools - do not create imaginary tools):
${toolDescriptions}

Your job is to analyze user requests and create efficient plans using ONLY the available tools listed above.

Guidelines for planning:
1. Keep plans as simple as possible - often one step is enough
2. Each step MUST use exactly one of the MCP tools listed above
3. For "show X's computer/device" requests - just use searchDevices. It returns device ID, name, and serial number which is usually sufficient
4. Only create multi-step plans when explicitly needed (e.g., user asks for "search then get full details")
5. Flag tasks that modify data as requiring confirmation

SIMPLE REQUESTS (one step only):
- "Show User's computer" → searchDevices with {"query": "jane"}
- "Find devices with Chrome" → searchDevices with {"query": "chrome"}
- "List all computers" → listDevices 

ONLY use getDeviceDetails when:
- User provides a specific device ID: "Show details for device 759"
- User explicitly asks for "full details" or "detailed information"

IMPORTANT - Tool Usage Rules:
1. searchDevices requires a "query" parameter, e.g., {"query": "jane"}
2. When searching for a user's device, use only searchDevices - it will return device details
3. Do NOT create multiple steps for simple searches - searchDevices returns enough information
4. Only use getDeviceDetails if the user specifically asks for detailed information about a known device ID
5. Keep plans simple - one step is often enough

For common requests:
- "Show User's computer" → Use searchDevices with {"query": "jane"} - this returns device ID, name, and serial number
- "Get details for device 123" → Use getDeviceDetails with {"deviceId": "123"}
- "List all computers" → Use listDevices with appropriate filters

The results will be automatically displayed to the user.

Current Context:
${this.context.getContextSummary()}

Create a plan using ONLY the available tools. Results will be automatically displayed to the user.`;
  }

  validatePlan(plan: TaskPlan): string[] {
    const errors: string[] = [];
    const stepIds = new Set(plan.steps.map(s => s.id));
    const availableTools = new Set(this.mcpClient.getAllTools().map(t => t.name));

    for (const step of plan.steps) {
      if (!availableTools.has(step.toolName)) {
        errors.push(`Step ${step.id}: Unknown tool '${step.toolName}'`);
      }

      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            errors.push(`Step ${step.id}: Unknown dependency '${dep}'`);
          }
        }
      }
    }

    const hasCycles = this.detectCycles(plan.steps);
    if (hasCycles) {
      errors.push('Plan contains circular dependencies');
    }

    return errors;
  }

  private detectCycles(steps: TaskStep[]): boolean {
    const adjacency: Map<string, string[]> = new Map();
    
    for (const step of steps) {
      adjacency.set(step.id, step.dependencies || []);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = adjacency.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        if (hasCycle(step.id)) return true;
      }
    }

    return false;
  }

  static getExecutionOrder(plan: TaskPlan): TaskStep[] {
    const steps = [...plan.steps];
    const executed = new Set<string>();
    const ordered: TaskStep[] = [];

    while (ordered.length < steps.length) {
      const ready = steps.filter(step => {
        if (executed.has(step.id)) return false;
        const deps = step.dependencies || [];
        return deps.every(dep => executed.has(dep));
      });

      if (ready.length === 0 && ordered.length < steps.length) {
        throw new Error('Unable to determine execution order - possible circular dependency');
      }

      for (const step of ready) {
        ordered.push(step);
        executed.add(step.id);
      }
    }

    return ordered;
  }
}