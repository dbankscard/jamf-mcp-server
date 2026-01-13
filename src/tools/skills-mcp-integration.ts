/**
 * Skills MCP Integration
 * Integrates skills directly as MCP tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { SkillsManager } from '../skills/manager.js';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import {
  searchDevices,
  checkDeviceCompliance,
  updateInventory,
  getDeviceDetails,
  executePolicy,
  searchPolicies,
  getPolicyDetails,
  searchConfigurationProfiles
} from './tool-implementations.js';
import { createLogger } from '../server/logger.js';

const skillLogger = createLogger('Skills');

export function registerSkillsAsMCPTools(
  server: Server, 
  skillsManager: SkillsManager,
  jamfClient: JamfApiClientHybrid
): void {
  // Create a context for skills that can call tool implementations directly
  const skillContext = {
    callTool: async (toolName: string, params: any) => {
      try {
        let result: any;
        
        // Map tool names to implementations
        switch (toolName) {
          case 'searchDevices':
            result = await searchDevices(jamfClient, params);
            break;
          case 'checkDeviceCompliance':
            result = await checkDeviceCompliance(jamfClient, params);
            break;
          case 'updateInventory':
            result = await updateInventory(jamfClient, params);
            break;
          case 'getDeviceDetails':
            result = await getDeviceDetails(jamfClient, params);
            break;
          case 'executePolicy':
            result = await executePolicy(jamfClient, params);
            break;
          case 'searchPolicies':
            result = await searchPolicies(jamfClient, params);
            break;
          case 'getPolicyDetails':
            result = await getPolicyDetails(jamfClient, params);
            break;
          case 'searchConfigurationProfiles':
            result = await searchConfigurationProfiles(jamfClient, params);
            break;
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
        
        return { data: result };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Tool execution failed: ${message}`);
      }
    },
    
    env: {
      jamfUrl: process.env.JAMF_URL || '',
      jamfClientId: process.env.JAMF_CLIENT_ID || '',
    },
    
    logger: {
      info: (message: string, meta?: Record<string, unknown>) => {
        skillLogger.info(message, meta);
      },
      warn: (message: string, meta?: Record<string, unknown>) => {
        skillLogger.warn(message, meta);
      },
      error: (message: string, meta?: Record<string, unknown>) => {
        skillLogger.error(message, meta);
      }
    }
  };
  
  // Initialize the skills manager with this context
  (skillsManager as any).context = skillContext;

  // Get original handlers to extend them
  const originalListToolsHandler = (server as any).getHandler?.(ListToolsRequestSchema) || 
                                  (server as any).__handlers?.['tools/list'];
  const originalCallToolHandler = (server as any).getHandler?.(CallToolRequestSchema) ||
                                 (server as any).__handlers?.['tools/call'];

  // Register the list tools handler that includes skills
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    // Get original tools if handler exists
    let tools = [];
    if (originalListToolsHandler) {
      try {
        const result = await originalListToolsHandler(request);
        tools = result.tools || [];
      } catch (e) {
        // If no original handler, start with empty array
        tools = [];
      }
    }

    // Add skill tools
    const skillTools = skillsManager.getMCPTools();
    
    return {
      tools: [...tools, ...skillTools]
    };
  });

  // Register the call tool handler that handles both regular tools and skills
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Check if this is a skill tool
    if (name.startsWith('skill_')) {
      const skillName = name.substring(6).replace(/_/g, '-');
      
      try {
        const result = await skillsManager.executeSkill(skillName, args);
        
        return {
          content: [
            {
              type: 'text',
              text: result.message
            } as TextContent
          ]
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Skill execution failed: ${message}`
            } as TextContent
          ],
          isError: true
        };
      }
    }

    // Not a skill tool, pass to original handler if it exists
    if (originalCallToolHandler) {
      return await originalCallToolHandler(request);
    }
    
    throw new Error(`Unknown tool: ${name}`);
  });
}