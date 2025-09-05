import { z } from 'zod';
import { MCPToolCall } from '../mcp/MCPClient.js';
import { AgentConfig } from '../core/AgentConfig.js';

export const SafetyRuleSchema = z.object({
  id: z.string(),
  description: z.string(),
  toolPattern: z.string().optional(),
  argumentPattern: z.record(z.any()).optional(),
  condition: z.function().optional(),
  action: z.enum(['allow', 'deny', 'confirm']),
  priority: z.number().default(0),
});

export const SafetyCheckResultSchema = z.object({
  allowed: z.boolean(),
  requiresConfirmation: z.boolean(),
  reason: z.string().optional(),
  appliedRules: z.array(z.string()),
});

export type SafetyRule = z.infer<typeof SafetyRuleSchema>;
export type SafetyCheckResult = z.infer<typeof SafetyCheckResultSchema>;

export class SafetyChecker {
  private rules: SafetyRule[] = [];

  constructor(private config: AgentConfig) {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    const mode = this.config.safety.mode;

    if (mode === 'strict') {
      this.addStrictRules();
    } else if (mode === 'moderate') {
      this.addModerateRules();
    } else {
      this.addPermissiveRules();
    }

    if (this.config.safety.readOnlyMode) {
      this.addReadOnlyRules();
    }
  }

  private addStrictRules(): void {
    this.rules.push(
      {
        id: 'deny-wipe',
        description: 'Deny device wipe operations',
        toolPattern: 'sendMDMCommand',
        argumentPattern: { command: 'EraseDevice' },
        action: 'deny',
        priority: 100,
      },
      {
        id: 'confirm-policy-execution',
        description: 'Require confirmation for policy execution',
        toolPattern: 'executePolicy',
        action: 'confirm',
        priority: 90,
      },
      {
        id: 'confirm-script-deployment',
        description: 'Require confirmation for script deployment',
        toolPattern: 'deployScript',
        action: 'confirm',
        priority: 90,
      },
      {
        id: 'confirm-profile-deployment',
        description: 'Require confirmation for profile deployment',
        toolPattern: 'deployConfigurationProfile',
        action: 'confirm',
        priority: 90,
      },
      {
        id: 'confirm-group-modifications',
        description: 'Require confirmation for group modifications',
        toolPattern: '(create|update|delete).*Group',
        action: 'confirm',
        priority: 85,
      }
    );
  }

  private addModerateRules(): void {
    this.rules.push(
      {
        id: 'confirm-wipe',
        description: 'Require confirmation for device wipe',
        toolPattern: 'sendMDMCommand',
        argumentPattern: { command: 'EraseDevice' },
        action: 'confirm',
        priority: 100,
      },
      {
        id: 'confirm-mass-operations',
        description: 'Require confirmation for operations affecting multiple devices',
        condition: ((call: MCPToolCall) => {
          const deviceIds = call.arguments.deviceIds || call.arguments.devices;
          return Array.isArray(deviceIds) && deviceIds.length > 10;
        }) as any,
        action: 'confirm',
        priority: 80,
      }
    );
  }

  private addPermissiveRules(): void {
    this.rules.push(
      {
        id: 'confirm-destructive',
        description: 'Confirm only destructive operations',
        toolPattern: '(wipe|erase|delete|remove)',
        action: 'confirm',
        priority: 50,
      }
    );
  }

  private addReadOnlyRules(): void {
    this.rules.push(
      {
        id: 'deny-all-writes',
        description: 'Deny all write operations in read-only mode',
        toolPattern: '(execute|deploy|create|update|delete|send|remove)',
        action: 'deny',
        priority: 1000,
      },
      {
        id: 'allow-reads',
        description: 'Allow all read operations',
        toolPattern: '(get|list|search|check|read)',
        action: 'allow',
        priority: 999,
      }
    );
  }

  addRule(rule: SafetyRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  async checkToolCall(toolCall: MCPToolCall): Promise<SafetyCheckResult> {
    const appliedRules: string[] = [];
    let finalAction: 'allow' | 'deny' | 'confirm' = 'allow';
    let reason: string | undefined;

    for (const rule of this.rules) {
      if (this.ruleMatches(rule, toolCall)) {
        appliedRules.push(rule.id);
        
        if (rule.action === 'deny') {
          return {
            allowed: false,
            requiresConfirmation: false,
            reason: rule.description,
            appliedRules,
          };
        }
        
        if (rule.action === 'confirm') {
          finalAction = 'confirm';
          reason = rule.description;
        }
      }
    }

    return {
      allowed: true,
      requiresConfirmation: finalAction === 'confirm',
      reason,
      appliedRules,
    };
  }

  private ruleMatches(rule: SafetyRule, toolCall: MCPToolCall): boolean {
    if (rule.toolPattern) {
      const regex = new RegExp(rule.toolPattern, 'i');
      if (!regex.test(toolCall.name)) {
        return false;
      }
    }

    if (rule.argumentPattern) {
      for (const [key, value] of Object.entries(rule.argumentPattern)) {
        if (toolCall.arguments[key] !== value) {
          return false;
        }
      }
    }

    if (rule.condition) {
      try {
        return rule.condition(toolCall) as boolean;
      } catch {
        return false;
      }
    }

    return true;
  }

  getRules(): SafetyRule[] {
    return [...this.rules];
  }

  validateArguments(toolName: string, args: Record<string, any>): string[] {
    const errors: string[] = [];

    switch (toolName) {
      case 'sendMDMCommand':
        if (!args.deviceId && !args.deviceIds) {
          errors.push('Either deviceId or deviceIds must be provided');
        }
        if (!args.command) {
          errors.push('Command must be specified');
        }
        break;

      case 'executePolicy':
        if (!args.policyId) {
          errors.push('Policy ID is required');
        }
        if (!args.deviceId && !args.deviceIds) {
          errors.push('Target device(s) must be specified');
        }
        break;

      case 'deployScript':
        if (!args.scriptId) {
          errors.push('Script ID is required');
        }
        if (!args.deviceId && !args.deviceIds) {
          errors.push('Target device(s) must be specified');
        }
        break;
    }

    return errors;
  }
}