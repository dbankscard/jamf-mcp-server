/**
 * Skills Manager
 * Unified skill loading and execution for both Claude MCP and ChatGPT HTTP
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SkillContext, SkillResult, SkillMetadata } from './types.js';
import { createSkillContext } from './context-provider.js';
import { buildErrorContext } from '../utils/error-handler.js';

// Import all skills
import { deviceSearchOptimized as deviceSearch, metadata as deviceSearchMetadata } from './device-management/device-search-optimized.js';
import { findOutdatedDevices, metadata as findOutdatedDevicesMetadata } from './device-management/find-outdated-devices.js';
import { batchInventoryUpdate, metadata as batchInventoryUpdateMetadata } from './device-management/batch-inventory-update.js';
import { deployPolicyByCriteria, metadata as deployPolicyByCriteriaMetadata } from './policy-management/deploy-policy-by-criteria.js';
import { scheduledComplianceCheck, metadata as scheduledComplianceCheckMetadata } from './automation/scheduled-compliance-check.js';
import { generateEnvironmentDocs, metadata as generateEnvironmentDocsMetadata } from './documentation/generate-environment-docs.js';

interface SkillDefinition {
  execute: (context: SkillContext, params: any) => Promise<SkillResult>;
  metadata: SkillMetadata;
}

export class SkillsManager {
  private skills: Map<string, SkillDefinition>;
  private _context: SkillContext | null = null;

  constructor() {
    this.skills = new Map();
    this.registerSkills();
  }

  /**
   * Set the context directly (for HTTP initialization)
   */
  set context(ctx: SkillContext | null) {
    this._context = ctx;
  }

  /**
   * Get the current context
   */
  get context(): SkillContext | null {
    return this._context;
  }

  private registerSkills(): void {
    // Register device management skills
    this.skills.set('device-search', {
      execute: deviceSearch,
      metadata: deviceSearchMetadata
    });
    
    this.skills.set('find-outdated-devices', {
      execute: findOutdatedDevices,
      metadata: findOutdatedDevicesMetadata
    });

    this.skills.set('batch-inventory-update', {
      execute: batchInventoryUpdate,
      metadata: batchInventoryUpdateMetadata
    });

    // Register policy management skills
    this.skills.set('deploy-policy-by-criteria', {
      execute: deployPolicyByCriteria,
      metadata: deployPolicyByCriteriaMetadata
    });

    // Register automation skills
    this.skills.set('scheduled-compliance-check', {
      execute: scheduledComplianceCheck,
      metadata: scheduledComplianceCheckMetadata
    });

    // Register documentation skills
    this.skills.set('generate-environment-docs', {
      execute: generateEnvironmentDocs,
      metadata: generateEnvironmentDocsMetadata
    });
  }

  /**
   * Initialize with server context (creates context from JamfMCPServer)
   */
  initialize(server: unknown): void {
    // Import createSkillContext expects JamfMCPServer interface
    this._context = createSkillContext(server as Parameters<typeof createSkillContext>[0]);
  }

  /**
   * Get all available skills
   */
  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get a specific skill
   */
  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * Execute a skill
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async executeSkill(name: string, params: any): Promise<SkillResult> {
    if (!this._context) {
      throw new Error('SkillsManager not initialized');
    }

    const skill = this.skills.get(name);
    if (!skill) {
      return {
        success: false,
        message: `Skill "${name}" not found`,
        data: {
          availableSkills: Array.from(this.skills.keys())
        }
      };
    }

    try {
      return await skill.execute(this._context, params);
    } catch (error: unknown) {
      const errorContext = buildErrorContext(
        error,
        `Execute skill: ${name}`,
        'skills-manager',
        { skillName: name, params }
      );
      return {
        success: false,
        message: `Skill execution failed: ${errorContext.message}${errorContext.suggestions ? ` (${errorContext.suggestions[0]})` : ''}`,
        error: error instanceof Error ? error : new Error(errorContext.message),
        data: {
          errorCode: errorContext.code,
          timestamp: errorContext.timestamp,
        }
      };
    }
  }

  /**
   * Register skills as MCP tools for Claude
   */
  getMCPTools(): Tool[] {
    const tools: Tool[] = [];

    for (const [name, skill] of this.skills) {
      // Create JSON Schema properties from skill metadata
      const properties: Record<string, Record<string, unknown>> = {};
      const required: string[] = [];

      for (const [paramName, paramDef] of Object.entries(skill.metadata.parameters)) {
        const propSchema: Record<string, unknown> = {
          type: paramDef.type === 'array' ? 'array' : paramDef.type,
          description: paramDef.description,
        };

        if (paramDef.enum) {
          propSchema.enum = paramDef.enum;
        }

        if (paramDef.default !== undefined) {
          propSchema.default = paramDef.default;
        }

        if (paramDef.type === 'array') {
          propSchema.items = { type: 'string' };
        }

        properties[paramName] = propSchema;

        if (paramDef.required) {
          required.push(paramName);
        }
      }

      tools.push({
        name: `skill_${name.replace(/-/g, '_')}`,
        description: skill.metadata.description,
        inputSchema: {
          type: 'object' as const,
          properties,
          required: required.length > 0 ? required : undefined,
        },
      });
    }

    return tools;
  }

  /**
   * Generate OpenAPI spec for ChatGPT
   */
  generateOpenAPISpec(): any {
    const paths: Record<string, any> = {};

    // Single execute endpoint that handles all skills
    paths['/api/v1/skills/execute'] = {
      post: {
        summary: 'Execute a Jamf management skill',
        operationId: 'executeSkill',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['skill', 'parameters'],
                properties: {
                  skill: {
                    type: 'string',
                    enum: Array.from(this.skills.keys()),
                    description: 'The skill to execute'
                  },
                  parameters: {
                    type: 'object',
                    description: 'Skill-specific parameters'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Skill execution result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: { type: 'object' },
                    nextActions: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    // Catalog endpoint for skill discovery
    paths['/api/v1/skills/catalog'] = {
      get: {
        summary: 'Get available skills catalog',
        operationId: 'getSkillsCatalog',
        responses: {
          '200': {
            description: 'Skills catalog',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      category: { type: 'string' },
                      parameters: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    return {
      openapi: '3.0.0',
      info: {
        title: 'Jamf MCP Skills API',
        version: '1.0.0',
        description: 'Execute high-level Jamf management skills'
      },
      servers: [
        {
          url: process.env.SERVER_URL || 'http://localhost:3000',
          description: 'Jamf MCP Server'
        }
      ],
      paths,
      components: {
        schemas: this.generateSkillSchemas()
      }
    };
  }

  private generateSkillSchemas(): Record<string, any> {
    const schemas: Record<string, any> = {};

    for (const [name, skill] of this.skills) {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [paramName, paramDef] of Object.entries(skill.metadata.parameters)) {
        const paramSchema: any = {
          type: paramDef.type === 'array' ? 'array' : paramDef.type,
          description: paramDef.description
        };

        if (paramDef.enum) {
          paramSchema.enum = paramDef.enum;
        }

        if (paramDef.default !== undefined) {
          paramSchema.default = paramDef.default;
        }

        if (paramDef.type === 'array') {
          paramSchema.items = { type: 'string' }; // Simplified, could be enhanced
        }

        properties[paramName] = paramSchema;

        if (paramDef.required) {
          required.push(paramName);
        }
      }

      schemas[`${name}Parameters`] = {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    }

    return schemas;
  }

  /**
   * Get skill catalog for discovery
   */
  getSkillCatalog(): any[] {
    const catalog: any[] = [];

    for (const [name, skill] of this.skills) {
      const category = name.includes('device') ? 'device-management' :
                      name.includes('policy') ? 'policy-management' :
                      name.includes('compliance') || name.includes('scheduled') ? 'automation' :
                      name.includes('documentation') || name.includes('environment-docs') ? 'documentation' :
                      'other';

      catalog.push({
        name,
        category,
        description: skill.metadata.description,
        parameters: skill.metadata.parameters,
        examples: skill.metadata.examples || []
      });
    }

    return catalog;
  }
}