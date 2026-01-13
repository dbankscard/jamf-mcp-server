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
  jamfClient: any;
  handleToolCall: (name: string, args: any) => Promise<CallToolResult>;
}

export function createSkillContext(server: JamfMCPServer): SkillContext {
  return {
    client: server.jamfClient,

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
      } catch (error: any) {
        throw new Error(`Tool execution failed: ${error.message}`);
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
}