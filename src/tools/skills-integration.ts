/**
 * Skills Integration for MCP Tools
 * Properly integrates skills with existing tool infrastructure
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { SkillsManager } from '../skills/manager.js';
import { IJamfApiClient } from '../types/jamf-client.js';

// Store original handlers
let originalListToolsHandler: any = null;
let originalCallToolHandler: any = null;

export function integrateSkillsWithTools(
  server: Server,
  skillsManager: SkillsManager,
  jamfClient: IJamfApiClient
): void {
  // Initialize the skills manager with a proper context
  const skillContext = {
    callTool: async (toolName: string, params: any) => {
      // Call the original tool handler
      if (originalCallToolHandler) {
        const request = {
          params: {
            name: toolName,
            arguments: params
          }
        };
        return await originalCallToolHandler(request);
      }
      throw new Error(`Tool ${toolName} not found`);
    },
    env: {
      jamfUrl: process.env.JAMF_URL || '',
      jamfClientId: process.env.JAMF_CLIENT_ID || '',
    },
    logger: {
      info: (message: string, meta?: any) => {
        console.log(`[SKILL INFO] ${message}`, meta || '');
      },
      warn: (message: string, meta?: any) => {
        console.warn(`[SKILL WARN] ${message}`, meta || '');
      },
      error: (message: string, meta?: any) => {
        console.error(`[SKILL ERROR] ${message}`, meta || '');
      }
    },
    jamfClient // Add jamfClient to context for direct access if needed
  };
  
  skillsManager.initialize(skillContext as any);

  // Store the original handlers before overriding
  const handlers = (server as any).__handlers || {};
  originalListToolsHandler = handlers['tools/list'];
  originalCallToolHandler = handlers['tools/call'];

  // Override the ListTools handler to include skills
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Get original tools
    let originalTools: Tool[] = [];
    if (originalListToolsHandler) {
      const result = await originalListToolsHandler({});
      originalTools = result.tools || [];
    }

    // Get skill tools
    const skillTools = skillsManager.getMCPTools();

    // Combine and return
    return {
      tools: [...originalTools, ...skillTools]
    };
  });

  // Override the CallTool handler to include skills
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
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Skill execution failed: ${error.message}`
            } as TextContent
          ],
          isError: true
        };
      }
    }

    // Not a skill tool, use original handler
    if (originalCallToolHandler) {
      return await originalCallToolHandler(request);
    }
    
    throw new Error(`Unknown tool: ${name}`);
  });

  // Store handlers for future reference
  (server as any).__handlers = {
    ...handlers,
    ['tools/list']: originalListToolsHandler,
    ['tools/call']: originalCallToolHandler
  };
}

export function getSkillTools(skillsManager: SkillsManager): Tool[] {
  return skillsManager.getMCPTools();
}