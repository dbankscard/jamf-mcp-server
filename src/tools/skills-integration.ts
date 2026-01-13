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
import { SkillContext } from '../skills/types.js';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import { createLogger } from '../server/logger.js';
import { logErrorWithContext, buildErrorContext } from '../utils/error-handler.js';

const skillLogger = createLogger('Skills');

// Store original handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let originalListToolsHandler: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let originalCallToolHandler: any = null;

export function integrateSkillsWithTools(
  server: Server,
  skillsManager: SkillsManager,
  jamfClient: JamfApiClientHybrid
): void {
  // Initialize the skills manager with a proper context
  const skillContext: SkillContext = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callTool: async (toolName: string, params: any): Promise<any> => {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      info: (message: string, meta?: any) => {
        skillLogger.info(message, meta);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      warn: (message: string, meta?: any) => {
        skillLogger.warn(message, meta);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (message: string, meta?: any) => {
        skillLogger.error(message, meta);
      }
    },
    client: jamfClient
  };

  skillsManager.context = skillContext;

  // Store the original handlers before overriding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        const result = await skillsManager.executeSkill(skillName, args || {});

        return {
          content: [
            {
              type: 'text',
              text: result.message
            } as TextContent
          ]
        };
      } catch (error: unknown) {
        const errorContext = logErrorWithContext(
          error,
          `Execute skill: ${skillName}`,
          'skills-integration',
          { skillName, args }
        );
        return {
          content: [
            {
              type: 'text',
              text: `Skill execution failed: ${errorContext.message}${errorContext.suggestions ? ` (${errorContext.suggestions[0]})` : ''}`
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).__handlers = {
    ...handlers,
    ['tools/list']: originalListToolsHandler,
    ['tools/call']: originalCallToolHandler
  };
}

export function getSkillTools(skillsManager: SkillsManager): Tool[] {
  return skillsManager.getMCPTools();
}