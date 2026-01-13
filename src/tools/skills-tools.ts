/**
 * MCP Tools for Skills
 * Exposes skills as MCP tools for Claude
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, Tool, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { SkillsManager } from '../skills/manager.js';
import { logErrorWithContext } from '../utils/error-handler.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerSkillTools(server: Server & { handleToolCall?: any }, skillsManager: SkillsManager): void {
  // Initialize the skills manager with server context
  skillsManager.initialize(server);

  // Get all MCP tool definitions from skills
  const skillTools = skillsManager.getMCPTools();

  // Register handler for all skill tools
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
          'skills-tools',
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

    // Not a skill tool, let other handlers process it
    if (server.handleToolCall) {
      return await server.handleToolCall(name, args);
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  // Export skill tools for discovery (void function, no return)
}

/**
 * Get all skill tools for registration
 */
export function getSkillTools(skillsManager: SkillsManager): Tool[] {
  return skillsManager.getMCPTools();
}