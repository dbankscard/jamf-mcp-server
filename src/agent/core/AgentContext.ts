import { z } from 'zod';

export const TaskResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
});

export const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.any()).optional(),
});

export const TaskHistoryItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  input: z.any(),
  result: TaskResultSchema,
  startTime: z.string(),
  endTime: z.string(),
  duration: z.number(),
});

export type TaskResult = z.infer<typeof TaskResultSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type TaskHistoryItem = z.infer<typeof TaskHistoryItemSchema>;

export class AgentContext {
  private conversationHistory: ConversationMessage[] = [];
  private taskHistory: Map<string, TaskHistoryItem> = new Map();
  private contextVariables: Map<string, any> = new Map();
  private activeTaskId: string | null = null;

  constructor() {
    this.initializeContext();
  }

  private initializeContext(): void {
    this.addSystemMessage('Agent context initialized');
  }

  addUserMessage(content: string, metadata?: Record<string, any>): void {
    this.conversationHistory.push({
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  addAssistantMessage(content: string, metadata?: Record<string, any>): void {
    this.conversationHistory.push({
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  addSystemMessage(content: string, metadata?: Record<string, any>): void {
    this.conversationHistory.push({
      role: 'system',
      content,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  getConversationHistory(limit?: number): ConversationMessage[] {
    if (limit) {
      return this.conversationHistory.slice(-limit);
    }
    return [...this.conversationHistory];
  }

  startTask(taskId: string, type: string, input: any): void {
    this.activeTaskId = taskId;
    const startTime = new Date().toISOString();
    
    this.taskHistory.set(taskId, {
      id: taskId,
      type,
      input,
      result: {
        success: false,
        timestamp: startTime,
      },
      startTime,
      endTime: startTime,
      duration: 0,
    });
  }

  completeTask(taskId: string, result: TaskResult): void {
    const task = this.taskHistory.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(task.startTime).getTime();

    this.taskHistory.set(taskId, {
      ...task,
      result,
      endTime,
      duration,
    });

    if (this.activeTaskId === taskId) {
      this.activeTaskId = null;
    }
  }

  getTaskHistory(): TaskHistoryItem[] {
    return Array.from(this.taskHistory.values());
  }

  getTask(taskId: string): TaskHistoryItem | undefined {
    return this.taskHistory.get(taskId);
  }

  getActiveTask(): TaskHistoryItem | null {
    if (!this.activeTaskId) return null;
    return this.taskHistory.get(this.activeTaskId) || null;
  }

  setVariable(key: string, value: any): void {
    this.contextVariables.set(key, value);
  }

  getVariable(key: string): any {
    return this.contextVariables.get(key);
  }

  getAllVariables(): Record<string, any> {
    const vars: Record<string, any> = {};
    this.contextVariables.forEach((value, key) => {
      vars[key] = value;
    });
    return vars;
  }

  clearVariable(key: string): void {
    this.contextVariables.delete(key);
  }

  reset(): void {
    this.conversationHistory = [];
    this.taskHistory.clear();
    this.contextVariables.clear();
    this.activeTaskId = null;
    this.initializeContext();
  }

  getContextSummary(): string {
    const recentMessages = this.getConversationHistory(10);
    const recentTasks = this.getTaskHistory().slice(-5);
    
    return `
Context Summary:
- Conversation: ${this.conversationHistory.length} messages (showing last ${recentMessages.length})
- Tasks: ${this.taskHistory.size} total (showing last ${recentTasks.length})
- Active Task: ${this.activeTaskId || 'None'}
- Variables: ${this.contextVariables.size} stored

Recent Conversation:
${recentMessages.map(m => `[${m.role}] ${m.content.substring(0, 100)}...`).join('\n')}

Recent Tasks:
${recentTasks.map(t => `[${t.id}] ${t.type} - ${t.result.success ? 'Success' : 'Failed'}`).join('\n')}
    `.trim();
  }

  toJSON(): object {
    return {
      conversationHistory: this.conversationHistory,
      taskHistory: Array.from(this.taskHistory.entries()),
      contextVariables: Array.from(this.contextVariables.entries()),
      activeTaskId: this.activeTaskId,
    };
  }

  static fromJSON(data: any): AgentContext {
    const context = new AgentContext();
    
    if (data.conversationHistory) {
      context.conversationHistory = data.conversationHistory;
    }
    
    if (data.taskHistory) {
      data.taskHistory.forEach(([key, value]: [string, TaskHistoryItem]) => {
        context.taskHistory.set(key, value);
      });
    }
    
    if (data.contextVariables) {
      data.contextVariables.forEach(([key, value]: [string, any]) => {
        context.contextVariables.set(key, value);
      });
    }
    
    if (data.activeTaskId) {
      context.activeTaskId = data.activeTaskId;
    }
    
    return context;
  }
}