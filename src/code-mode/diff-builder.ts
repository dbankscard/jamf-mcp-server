/**
 * Diff Builder — Tracks operations for audit and plan-mode output.
 *
 * Records every API call made during an execution, classifying them
 * as read/write/command and extracting affected device IDs.
 */

import { DiffEntry, ExecutionMetrics, MethodClassification } from './types.js';

/** Methods whose first argument is a device ID. */
const DEVICE_ID_METHODS = new Set([
  'getComputerDetails', 'updateInventory',
  'getMobileDeviceDetails', 'updateMobileDeviceInventory', 'sendMDMCommand',
  'getComputerHistory', 'getComputerPolicyLogs', 'getComputerMDMCommandHistory',
  'sendComputerMDMCommand', 'flushMDMCommands',
]);

/** Methods whose argument contains an array of device IDs. */
const MULTI_DEVICE_METHODS = new Set([
  'executePolicy', 'deployScript', 'deployConfigurationProfile',
  'removeConfigurationProfile', 'createSoftwareUpdatePlan',
]);

/** Truncate long strings in args for diff output. */
function sanitizeArg(arg: unknown): unknown {
  if (typeof arg === 'string' && arg.length > 200) {
    return arg.slice(0, 200) + '...[truncated]';
  }
  if (Array.isArray(arg)) {
    if (arg.length > 20) {
      return [...arg.slice(0, 20), `...(${arg.length} total)`];
    }
    return arg.map(sanitizeArg);
  }
  if (arg && typeof arg === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(arg as Record<string, unknown>)) {
      // Never leak credentials
      if (/password|secret|token|credential/i.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeArg(v);
      }
    }
    return out;
  }
  return arg;
}

export class DiffBuilder {
  private entries: DiffEntry[] = [];
  private affectedDeviceIds = new Set<string>();

  record(
    action: MethodClassification,
    method: string,
    args: unknown[],
    result?: unknown,
  ): void {
    this.entries.push({
      action,
      method,
      args: args.map(sanitizeArg),
      result: action === 'read' ? undefined : sanitizeArg(result),
      timestamp: Date.now(),
    });

    this.extractDeviceIds(method, args);
  }

  getEntries(): DiffEntry[] {
    return [...this.entries];
  }

  getMetrics(durationMs: number): ExecutionMetrics {
    let reads = 0, writes = 0, commands = 0;
    for (const e of this.entries) {
      if (e.action === 'read') reads++;
      else if (e.action === 'write') writes++;
      else commands++;
    }
    return {
      reads,
      writes,
      commands,
      durationMs,
      affectedDeviceCount: this.affectedDeviceIds.size,
    };
  }

  private extractDeviceIds(method: string, args: unknown[]): void {
    if (DEVICE_ID_METHODS.has(method) && typeof args[0] === 'string') {
      this.affectedDeviceIds.add(args[0]);
    }

    if (MULTI_DEVICE_METHODS.has(method)) {
      // For executePolicy(policyId, deviceIds[]) — deviceIds is args[1]
      // For createSoftwareUpdatePlan(deviceIds[], ...) — deviceIds is args[0]
      const candidates = method === 'createSoftwareUpdatePlan' ? args[0] : args[1];
      if (Array.isArray(candidates)) {
        for (const id of candidates) {
          if (typeof id === 'string') {
            this.affectedDeviceIds.add(id);
          }
        }
      }
    }
  }
}
