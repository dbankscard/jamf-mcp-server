/**
 * Sandbox Runner — Executes agent-authored JavaScript in a node:vm sandbox.
 *
 * Creates a Proxy around IJamfApiClient that intercepts every call to:
 * 1. Check capability via policy engine
 * 2. Track call count / enforce budget
 * 3. In plan mode: record writes in diff but block execution
 * 4. In apply mode: execute and record in diff
 */

import * as vm from 'node:vm';
import * as crypto from 'node:crypto';
import { IJamfApiClient } from '../types/jamf-client.js';
import {
  ExecuteInput,
  ExecutionResult,
  LogEntry,
  ExecutionMode,
} from './types.js';
import {
  checkAccess,
  getClassification,
  BudgetTracker,
  requiresApproval,
  getAllMethodNames,
} from './policy-engine.js';
import { DiffBuilder } from './diff-builder.js';

const DEFAULT_TIMEOUT = 30_000;

/** Pending approval tokens: token → list of blocked operations. */
const pendingApprovals = new Map<string, { method: string; args: unknown[] }[]>();

function getTimeout(): number {
  const env = process.env.JAMF_CODE_MODE_TIMEOUT;
  return env ? parseInt(env, 10) || DEFAULT_TIMEOUT : DEFAULT_TIMEOUT;
}

// ── Helpers exposed in the sandbox ───────────────────────────────────

function createHelpers() {
  return {
    /**
     * Auto-paginate a list call.
     * Usage: await helpers.paginate(limit => jamf.getAllComputers(limit), 500)
     */
    paginate: async (
      fn: (limit: number) => Promise<unknown[]>,
      limit = 500,
    ): Promise<unknown[]> => {
      return fn(limit);
    },

    /** Days since an ISO date string (or null/undefined → Infinity). */
    daysSince: (isoDate?: string | null): number => {
      if (!isoDate) return Infinity;
      const ms = Date.now() - new Date(isoDate).getTime();
      return Math.floor(ms / 86_400_000);
    },

    /** Split an array into chunks of `size`. */
    chunk: <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    },
  };
}

// ── Proxy factory ────────────────────────────────────────────────────

function createProxiedClient(
  client: IJamfApiClient,
  mode: ExecutionMode,
  capabilities: string[],
  budget: BudgetTracker,
  diff: DiffBuilder,
  logs: LogEntry[],
  approvalToken?: string,
): IJamfApiClient {
  const knownMethods = new Set(getAllMethodNames());

  return new Proxy(client, {
    get(target, prop: string) {
      if (typeof prop !== 'string' || !knownMethods.has(prop)) {
        // Allow toString, Symbol.toPrimitive, etc.
        if (prop in target) {
          const val = (target as unknown as Record<string, unknown>)[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        }
        return undefined;
      }

      return async (...args: unknown[]) => {
        // 1. Capability check
        const access = checkAccess(prop, capabilities);
        if (!access.allowed) {
          throw new Error(`Access denied: ${access.reason}`);
        }

        // 2. Budget check
        const budgetCheck = budget.trackCall(prop);
        if (!budgetCheck.allowed) {
          throw new Error(`Budget exceeded: ${budgetCheck.reason}`);
        }

        const classification = getClassification(prop)!;

        // 3. Plan mode: block writes and commands
        if (mode === 'plan' && classification !== 'read') {
          diff.record(classification, prop, args);
          logs.push({
            level: 'info',
            msg: [`[plan] Blocked ${classification}: ${prop}(${args.length} args)`],
          });
          return { blocked: true, method: prop, args, classification };
        }

        // 4. Apply mode: check approval for high-impact methods
        if (
          mode === 'apply' &&
          classification === 'command' &&
          requiresApproval(prop)
        ) {
          if (!approvalToken) {
            // First run — collect all high-impact ops for approval
            diff.record(classification, prop, args);
            return { blocked: true, requiresApproval: true, method: prop, args };
          }
          // Approval token present — verify it's valid
          if (!pendingApprovals.has(approvalToken)) {
            throw new Error(
              `Invalid or expired approval token. Re-run with mode: "plan" to generate a new token.`,
            );
          }
        }

        // 5. Execute the real method
        const method = (target as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[prop];
        const result = await method.apply(target, args);
        diff.record(classification, prop, args, result);
        return result;
      };
    },
  });
}

// ── Main execution function ──────────────────────────────────────────

export async function execute(
  client: IJamfApiClient,
  input: ExecuteInput,
): Promise<ExecutionResult> {
  const { code, mode, capabilities, approval } = input;
  const logs: LogEntry[] = [];
  const diff = new DiffBuilder();
  const budget = new BudgetTracker();
  const start = Date.now();

  const proxiedClient = createProxiedClient(
    client, mode, capabilities, budget, diff, logs, approval,
  );

  const helpers = createHelpers();

  // Build the sandbox context
  const context = vm.createContext({
    jamf: proxiedClient,
    helpers,
    log: (...args: unknown[]) => logs.push({ level: 'info', msg: args }),
    warn: (...args: unknown[]) => logs.push({ level: 'warn', msg: args }),
    error: (...args: unknown[]) => logs.push({ level: 'error', msg: args }),
    console: {
      log: (...args: unknown[]) => logs.push({ level: 'info', msg: args }),
      warn: (...args: unknown[]) => logs.push({ level: 'warn', msg: args }),
      error: (...args: unknown[]) => logs.push({ level: 'error', msg: args }),
    },
    JSON,
    Promise,
    Array,
    Object,
    Map,
    Set,
    Date,
    Math,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    TypeError,
    RangeError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    // Explicitly blocked
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,
    fetch: undefined,
    require: undefined,
    process: undefined,
    globalThis: undefined,
  });

  try {
    // Wrap in async IIFE with strict mode
    const wrapped = `"use strict";\n(async () => {\n${code}\n})()`;
    const script = new vm.Script(wrapped, { filename: 'code-mode-execution.js' });
    const resultPromise = script.runInContext(context, {
      timeout: getTimeout(),
    });

    const returnValue = await resultPromise;
    const durationMs = Date.now() - start;

    // Check if any high-impact commands need approval
    const diffEntries = diff.getEntries();
    const blockedCommands = diffEntries.filter(
      (e) => e.action === 'command' && mode === 'apply',
    );

    // If we're in apply mode without an approval token and there were
    // high-impact blocked operations, generate an approval token
    if (mode === 'apply' && !approval) {
      const needsApproval = diffEntries.some(
        (e) => e.action === 'command',
      );
      if (needsApproval && blockedCommands.length > 0) {
        const token = crypto.randomUUID();
        pendingApprovals.set(token, blockedCommands.map((e) => ({
          method: e.method,
          args: e.args as unknown[],
        })));
        // Auto-expire after 5 minutes
        setTimeout(() => pendingApprovals.delete(token), 5 * 60 * 1000);

        return {
          success: true,
          mode,
          returnValue,
          diff: diffEntries,
          logs,
          metrics: diff.getMetrics(durationMs),
          approvalRequired: { token, operations: blockedCommands },
        };
      }
    }

    // If approval was used, clean it up
    if (approval) {
      pendingApprovals.delete(approval);
    }

    return {
      success: true,
      mode,
      returnValue,
      diff: diffEntries,
      logs,
      metrics: diff.getMetrics(durationMs),
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    logs.push({ level: 'error', msg: [message] });

    return {
      success: false,
      mode,
      diff: diff.getEntries(),
      logs,
      metrics: diff.getMetrics(durationMs),
    };
  }
}
