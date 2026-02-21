/**
 * MCP Registration — Registers the 2 Code Mode tools with the MCP server.
 *
 * Tools:
 *   jamf_search  — Discover available SDK methods, helpers, and categories
 *   jamf_execute — Execute JavaScript code against the Jamf API in a sandbox
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { IJamfApiClient } from '../types/jamf-client.js';
import { search, getCategories } from './search-index.js';
import { execute } from './sandbox-runner.js';
import { ExecuteInput } from './types.js';

// ── Zod schemas for input validation ─────────────────────────────────

const SearchInputSchema = z.object({
  query: z.string().optional().describe(
    'Search query to find SDK methods. Matches against name, description, and category. Leave empty to list all methods.',
  ),
  category: z.string().optional().describe(
    'Filter results to a specific category (e.g. "computers", "policies", "scripts").',
  ),
});

const ExecuteInputSchema = z.object({
  code: z.string().describe(
    'JavaScript code to execute. Use `await jamf.methodName(args)` to call API methods. ' +
    'Use `return` to return data. Use `log()`, `warn()`, `error()` for logging. ' +
    'Helper functions: `helpers.paginate()`, `helpers.daysSince()`, `helpers.chunk()`.',
  ),
  mode: z.enum(['plan', 'apply']).describe(
    'Execution mode. "plan" previews write/command operations without executing them. ' +
    '"apply" executes all operations. Always run "plan" first to preview changes.',
  ),
  capabilities: z.array(z.string()).describe(
    'List of capabilities to grant. Format: "read:domain", "write:domain", or "command:domain". ' +
    'Examples: ["read:computers"], ["read:policies", "write:policies"], ["command:mdm"]. ' +
    'Only request capabilities you need — principle of least privilege.',
  ),
  approval: z.string().optional().describe(
    'Approval token from a previous execution that requires confirmation. ' +
    'Only needed when a plan-mode run returns approvalRequired.',
  ),
});

// ── Tool definitions ─────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'jamf_search',
    description:
      'Search the Jamf SDK to discover available API methods, their signatures, and required capabilities. ' +
      'Use this before writing code to find the right methods. ' +
      'Returns method name, TypeScript signature, description, category, required capabilities, and whether the method is read-only.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query to match method names, descriptions, or categories. Leave empty to list all.',
        },
        category: {
          type: 'string',
          description: `Filter by category. Available: ${getCategories().join(', ')}`,
        },
      },
    },
  },
  {
    name: 'jamf_execute',
    description:
      'Execute JavaScript code in a sandboxed environment with access to the Jamf API. ' +
      'The code runs as an async function body — use `await` and `return`. ' +
      'Available globals: `jamf` (API client), `helpers` (paginate, daysSince, chunk), ' +
      '`log/warn/error` (logging), and standard JS builtins. ' +
      'No access to require, import, fetch, fs, or process. ' +
      'Always run with mode="plan" first to preview changes, then mode="apply" to execute.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to execute. Use `await jamf.methodName()` for API calls.',
        },
        mode: {
          type: 'string',
          enum: ['plan', 'apply'],
          description: '"plan" previews writes without executing. "apply" executes all operations.',
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Capabilities to grant: ["read:computers", "write:policies", "command:mdm", ...]',
        },
        approval: {
          type: 'string',
          description: 'Approval token from a previous run that required confirmation.',
        },
      },
      required: ['code', 'mode', 'capabilities'],
    },
  },
];

// ── Registration ─────────────────────────────────────────────────────

export function registerCodeModeTools(
  server: Server,
  jamfClient: IJamfApiClient,
): void {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'jamf_search': {
        const parsed = SearchInputSchema.parse(args);
        let results = search(parsed.query ?? '');

        if (parsed.category) {
          const cat = parsed.category.toLowerCase();
          results = results.filter((r) => r.category === cat);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  count: results.length,
                  categories: getCategories(),
                  results,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case 'jamf_execute': {
        const parsed = ExecuteInputSchema.parse(args);
        const input: ExecuteInput = {
          code: parsed.code,
          mode: parsed.mode,
          capabilities: parsed.capabilities,
          approval: parsed.approval,
        };

        const result = await execute(jamfClient, input);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: !result.success,
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}
