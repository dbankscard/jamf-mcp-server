/**
 * Context Provider for Skills
 * Provides a unified interface for skills to access MCP tools and environment
 */

import { SkillContext } from './types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../server/logger.js';

const skillLogger = createLogger('Skills');

interface JamfMCPServer extends Server {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jamfClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleToolCall: (name: string, args: any) => Promise<CallToolResult>;
}

export function createSkillContext(server: JamfMCPServer): SkillContext {
  return {
    client: server.jamfClient,

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callTool: async (toolName: string, params: any): Promise<any> => {
      try {
        const result = await server.handleToolCall(toolName, params);

        if (result.content && result.content.length > 0) {
          const content = result.content[0];
          if (content.type === 'text') {
            try {
              // Try to parse JSON response
              return JSON.parse(content.text);
            } catch {
              // Return raw text if not JSON
              return { data: content.text };
            }
          }
        }

        return { error: 'No content in tool response' };
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
    }
  };
}