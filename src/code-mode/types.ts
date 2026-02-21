/**
 * Shared type definitions for Code Mode.
 */

export type ExecutionMode = 'plan' | 'apply';

export type MethodClassification = 'read' | 'write' | 'command';

export interface ExecuteInput {
  code: string;
  mode: ExecutionMode;
  capabilities: string[];
  approval?: string;
}

export interface ExecutionResult {
  success: boolean;
  mode: ExecutionMode;
  returnValue?: unknown;
  diff: DiffEntry[];
  logs: LogEntry[];
  metrics: ExecutionMetrics;
  approvalRequired?: {
    token: string;
    operations: DiffEntry[];
  };
}

export interface DiffEntry {
  action: MethodClassification;
  method: string;
  args: unknown[];
  result?: unknown;
  timestamp: number;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  msg: unknown[];
}

export interface ExecutionMetrics {
  reads: number;
  writes: number;
  commands: number;
  durationMs: number;
  affectedDeviceCount: number;
}

export interface SearchIndexEntry {
  name: string;
  signature: string;
  description: string;
  category: string;
  capabilities: string[];
  readOnly: boolean;
}
