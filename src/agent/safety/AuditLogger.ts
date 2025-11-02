import { createWriteStream, WriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { AgentConfig } from '../core/AgentConfig.js';

export interface AuditLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  taskId?: string;
  userId?: string;
  details: any;
}

export class AuditLogger {
  private stream: WriteStream | null = null;
  private logPath: string;
  private buffer: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(private config: AgentConfig) {
    this.logPath = config.safety.auditLogPath;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await mkdir(dirname(this.logPath), { recursive: true });
      
      this.stream = createWriteStream(this.logPath, {
        flags: 'a',
        encoding: 'utf8',
      });

      this.stream.on('error', (error) => {
        console.error('Audit log stream error:', error);
      });

      this.flushInterval = setInterval(() => {
        this.flush();
      }, 5000);

      this.log('info', 'audit_logger_initialized', {
        logPath: this.logPath,
        config: {
          safetyMode: this.config.safety.mode,
          readOnly: this.config.safety.readOnlyMode,
        },
      });
    } catch (error) {
      console.error('Failed to initialize audit logger:', error);
    }
  }

  private log(
    level: AuditLogEntry['level'],
    event: string,
    details: any,
    taskId?: string,
    userId?: string
  ): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      taskId,
      userId,
      details,
    };

    this.buffer.push(entry);

    if (this.buffer.length >= 100) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.buffer.length === 0 || !this.stream) return;

    const entries = this.buffer.splice(0, this.buffer.length);
    
    for (const entry of entries) {
      const line = JSON.stringify(entry) + '\n';
      this.stream.write(line);
    }
  }

  logUserRequest(taskId: string, request: string, userId?: string): void {
    this.log('info', 'user_request', {
      request,
      requestLength: request.length,
    }, taskId, userId);
  }

  logTaskStep(
    event: 'start' | 'complete' | 'error',
    data: any,
    taskId?: string
  ): void {
    const level = event === 'error' ? 'error' : 'info';
    this.log(level, `task_step_${event}`, data, taskId);
  }

  logTaskCompletion(taskId: string, result: any): void {
    this.log('info', 'task_completed', {
      success: result.success,
      completedSteps: result.executionResult?.completedSteps?.length || 0,
      failedSteps: result.executionResult?.failedSteps?.length || 0,
      duration: result.executionResult?.duration,
    }, taskId);
  }

  logTaskError(taskId: string, error: Error): void {
    this.log('error', 'task_failed', {
      error: error.message,
      stack: error.stack,
    }, taskId);
  }

  logSafetyViolation(
    toolCall: any,
    rule: string,
    taskId?: string
  ): void {
    this.log('warn', 'safety_violation', {
      toolCall,
      violatedRule: rule,
    }, taskId);
  }

  logConfirmationRequest(
    step: any,
    taskId?: string
  ): void {
    this.log('info', 'confirmation_requested', {
      step,
    }, taskId);
  }

  logConfirmationResponse(
    confirmed: boolean,
    taskId?: string,
    userId?: string
  ): void {
    this.log('info', 'confirmation_response', {
      confirmed,
    }, taskId, userId);
  }

  logAPICall(
    provider: string,
    request: any,
    response: any,
    duration: number
  ): void {
    this.log('info', 'api_call', {
      provider,
      model: request.model,
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
      duration,
    });
  }

  logMCPToolCall(
    toolName: string,
    args: any,
    result: any,
    duration: number,
    taskId?: string
  ): void {
    this.log('info', 'mcp_tool_call', {
      toolName,
      arguments: args,
      success: !result.error,
      error: result.error,
      duration,
    }, taskId);
  }

  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.flush();

    if (this.stream) {
      await new Promise<void>((resolve) => {
        this.stream!.end(() => resolve());
      });
      this.stream = null;
    }
  }

  async query(filters: {
    startTime?: Date;
    endTime?: Date;
    event?: string;
    taskId?: string;
    userId?: string;
    level?: AuditLogEntry['level'];
  }): Promise<AuditLogEntry[]> {
    throw new Error('Query functionality not yet implemented');
  }
}