#!/usr/bin/env node
/**
 * Code Mode entry point — exposes just 2 MCP tools (jamf_search + jamf_execute)
 * instead of the full 108-tool surface. The agent writes JavaScript code
 * against a typed SDK, executed in a sandboxed VM.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { JamfApiClientHybrid } from './jamf-client-hybrid.js';
import { registerCodeModeTools } from './code-mode/mcp-registration.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';
import { setupGlobalErrorHandlers } from './utils/error-handler.js';
import { createLogger } from './server/logger.js';
import { registerShutdownHandler, registerCommonHandlers } from './utils/shutdown-manager.js';
import { cleanupAuthMiddleware } from './server/auth-middleware.js';
import { cleanupAgentPool } from './utils/http-agent-pool.js';

const logger = createLogger('code-mode');

// Environment variables
const JAMF_URL = process.env.JAMF_URL;
const JAMF_CLIENT_ID = process.env.JAMF_CLIENT_ID;
const JAMF_CLIENT_SECRET = process.env.JAMF_CLIENT_SECRET;
const JAMF_USERNAME = process.env.JAMF_USERNAME;
const JAMF_PASSWORD = process.env.JAMF_PASSWORD;
const READ_ONLY_MODE = process.env.JAMF_READ_ONLY === 'true';

// Validate configuration
if (!JAMF_URL) {
  console.error('Missing required environment variable: JAMF_URL');
  process.exit(1);
}

const hasOAuth2 = !!(JAMF_CLIENT_ID && JAMF_CLIENT_SECRET);
const hasBasicAuth = !!(JAMF_USERNAME && JAMF_PASSWORD);

if (!hasOAuth2 && !hasBasicAuth) {
  console.error('Missing authentication credentials. Please provide either:');
  console.error('  - OAuth2: JAMF_CLIENT_ID and JAMF_CLIENT_SECRET');
  console.error('  - Basic Auth: JAMF_USERNAME and JAMF_PASSWORD');
  process.exit(1);
}

const server = new Server(
  {
    name: 'jamf-mcp-server',
    version: '2.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
    instructions: `You are connected to a Jamf Pro MDM server in **Code Mode**.

## How Code Mode Works

Instead of 108 individual tools, you have 2 tools:

1. **jamf_search** — Discover available API methods, their signatures, required capabilities, and categories.
2. **jamf_execute** — Execute JavaScript code in a sandbox with access to the full Jamf API.

## Workflow

1. Call \`jamf_search\` with a query (e.g. "computers", "policies") to discover available methods.
2. Write JavaScript code using \`await jamf.methodName(args)\` syntax.
3. Run with \`mode: "plan"\` first — this previews all write/command operations without executing them.
4. Review the diff and, if satisfied, run again with \`mode: "apply"\` to execute.
5. If approval is required (for high-impact commands), use the returned approval token.

## Code Environment

Your code runs as an async function body. Available globals:
- \`jamf\` — The Jamf API client. Call methods with \`await jamf.methodName(args)\`.
- \`helpers.paginate(fn, limit)\` — Auto-paginate list calls.
- \`helpers.daysSince(isoDate)\` — Days since an ISO date (returns Infinity for null).
- \`helpers.chunk(arr, size)\` — Split arrays into chunks.
- \`log(...args)\`, \`warn(...args)\`, \`error(...args)\` — Logging.
- Standard JS: JSON, Promise, Array, Object, Map, Set, Date, Math, RegExp, etc.
- NOT available: require, import, fetch, fs, process, setTimeout.

## Capabilities (Least Privilege)

You must declare the capabilities your code needs. Only request what you need:
- Read: \`read:computers\`, \`read:policies\`, \`read:scripts\`, \`read:reports\`, etc.
- Write: \`write:policies\`, \`write:scripts\`, \`write:groups\`, etc.
- Command: \`command:computers\`, \`command:mdm\`, \`command:policies\`, etc.

## Example

\`\`\`javascript
// Find all computers not checked in for 30 days
const computers = await jamf.getAllComputers(200);
const stale = computers.filter(c => helpers.daysSince(c.lastContactTime) > 30);
log(\`Found \${stale.length} stale computers\`);
return stale.map(c => ({ id: c.id, name: c.name, lastContact: c.lastContactTime }));
\`\`\`

## Performance Tips
- Chain multiple API calls in a single execution instead of separate tool calls.
- Use \`helpers.paginate()\` for large datasets.
- Resources (jamf://reports/*) are still available for pre-aggregated reports.`,
  },
);

async function run() {
  try {
    logger.info('Starting Jamf MCP server in Code Mode...');
    logger.info(`Jamf URL: ${JAMF_URL}`);
    logger.info('Authentication methods available:');
    if (hasOAuth2) {
      logger.info(`  OAuth2 (Jamf Pro API) - Client ID: ${JAMF_CLIENT_ID}`);
    }
    if (hasBasicAuth) {
      logger.info(`  Basic Auth (Bearer Token) - Username: ${JAMF_USERNAME}`);
    }
    logger.info(`Read-only mode: ${READ_ONLY_MODE}`);
    logger.info('Mode: CODE MODE (2 tools: jamf_search + jamf_execute)');

    const jamfClient = new JamfApiClientHybrid({
      baseUrl: JAMF_URL!,
      clientId: JAMF_CLIENT_ID,
      clientSecret: JAMF_CLIENT_SECRET,
      username: JAMF_USERNAME,
      password: JAMF_PASSWORD,
      readOnlyMode: READ_ONLY_MODE,
      rejectUnauthorized: process.env.JAMF_ALLOW_INSECURE !== 'true',
    });

    // Register Code Mode tools (2 tools instead of 108)
    registerCodeModeTools(server, jamfClient);

    // Resources and prompts are still available
    registerResources(server, jamfClient);
    registerPrompts(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Jamf MCP server started in Code Mode');
  } catch (error) {
    logger.error('Failed to initialize Jamf MCP server (Code Mode)', { error });
    process.exit(1);
  }
}

// Setup global error handlers
setupGlobalErrorHandlers();

// Register common shutdown handlers
registerCommonHandlers();

// Register cleanup handlers
registerShutdownHandler('auth-cleanup', cleanupAuthMiddleware, 20);
registerShutdownHandler('agent-pool-cleanup', cleanupAgentPool, 20);
registerShutdownHandler('server-transport-close', async () => {
  logger.info('Closing server transport...');
}, 40);

// Run the server
run().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
