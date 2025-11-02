/**
 * Skills Manager
 * Unified skill loading and execution for both Claude MCP and ChatGPT HTTP
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SkillContext, SkillResult, SkillMetadata } from './types.js';
import { createSkillContext } from './context-provider.js';

// Import all skills
import { deviceSearchOptimized as deviceSearch, metadata as deviceSearchMetadata } from './device-management/device-search-optimized.js';
import { findOutdatedDevices, metadata as findOutdatedDevicesMetadata } from './device-management/find-outdated-devices.js';
import { batchInventoryUpdate, metadata as batchInventoryUpdateMetadata } from './device-management/batch-inventory-update.js';
import { deployPolicyByCriteria, metadata as deployPolicyByCriteriaMetadata } from './policy-management/deploy-policy-by-criteria.js';
import { scheduledComplianceCheck, metadata as scheduledComplianceCheckMetadata } from './automation/scheduled-compliance-check.js';

interface SkillDefinition {
  execute: (context: SkillContext, params: any) => Promise<SkillResult>;
  metadata: SkillMetadata;
}

export class SkillsManager {
  private skills: Map<string, SkillDefinition>;
  private context: SkillContext | null = null;

  constructor() {
    this.skills = new Map();
    this.registerSkills();
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
  }

  /**
   * Initialize with server context
   */
  initialize(server: any): void {
    this.context = createSkillContext(server);
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
  async executeSkill(name: string, params: any): Promise<SkillResult> {
    if (!this.context) {
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
      return await skill.execute(this.context, params);
    } catch (error: any) {
      return {
        success: false,
        message: `Skill execution failed: ${error.message}`,
        error
      };
    }
  }

  /**
   * Register skills as MCP tools for Claude
   */
  getMCPTools(): Tool[] {
    const tools: Tool[] = [];

    for (const [name, skill] of this.skills) {
      // Create Zod schema from skill metadata
      const schemaFields: Record<string, any> = {};
      
      for (const [paramName, paramDef] of Object.entries(skill.metadata.parameters)) {
        let zodType: any;
        
        switch (paramDef.type) {
          case 'string':
            zodType = z.string();
            break;
          case 'number':
            zodType = z.number();
            break;
          case 'boolean':
            zodType = z.boolean();
            break;
          case 'array':
            zodType = z.array(z.any());
            break;
          case 'object':
            zodType = z.record(z.any());
            break;
          default:
            zodType = z.any();
        }

        if (paramDef.enum) {
          zodType = z.enum(paramDef.enum as [string, ...string[]]);
        }

        if (paramDef.description) {
          zodType = zodType.describe(paramDef.description);
        }

        if (!paramDef.required && paramDef.default !== undefined) {
          zodType = zodType.optional().default(paramDef.default);
        } else if (!paramDef.required) {
          zodType = zodType.optional();
        }

        schemaFields[paramName] = zodType;
      }

      const inputSchema = z.object(schemaFields);

      tools.push({
        name: `skill_${name.replace(/-/g, '_')}`,
        description: skill.metadata.description,
        inputSchema: {
          type: 'object' as const,
          properties: inputSchema.shape
        } as any
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