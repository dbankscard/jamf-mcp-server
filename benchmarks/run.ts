#!/usr/bin/env tsx
/**
 * Benchmark: Code Mode vs Classic Mode
 *
 * Connects to both MCP server modes via StdioClientTransport and runs
 * identical tasks through each, measuring tool calls, wall-clock time,
 * and payload sizes.
 *
 * Requires a live Jamf Pro instance — reads credentials from env vars
 * (same ones used by the MCP server: JAMF_URL, JAMF_CLIENT_ID, JAMF_CLIENT_SECRET).
 *
 * Usage: npx tsx benchmarks/run.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BenchmarkResult {
  scenario: string;
  mode: 'classic' | 'code';
  toolCalls: number;
  wallTimeMs: number;
  payloadBytes: number;
}

type ScenarioFn = (
  client: Client,
  mode: 'classic' | 'code',
  ctx: RunContext,
) => Promise<BenchmarkResult>;

/** Shared state discovered once and reused across scenarios. */
interface RunContext {
  computerId: string;
  packageId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

function createTransport(entryPoint: string): StdioClientTransport {
  return new StdioClientTransport({
    command: 'node',
    args: [resolve(PROJECT_ROOT, entryPoint)],
    env: { ...process.env, MCP_MODE: 'true' },
    stderr: 'pipe',
  });
}

async function connectClient(entryPoint: string): Promise<Client> {
  const client = new Client({ name: 'benchmark-client', version: '1.0.0' });
  const transport = createTransport(entryPoint);
  await client.connect(transport);
  return client;
}

/** Call a single MCP tool and return the raw result. */
async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await client.callTool({ name, arguments: args });
  return result;
}

/** Measure a function, returning its result plus elapsed time in ms. */
async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, ms: Math.round(performance.now() - start) };
}

function payloadSize(value: unknown): number {
  return JSON.stringify(value).length;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

// ---------------------------------------------------------------------------
// Discovery — find a valid computer ID and package ID from the live instance
// ---------------------------------------------------------------------------

async function discover(client: Client, mode: 'classic' | 'code'): Promise<RunContext> {
  let computerId = '1';
  let packageId = '1';

  if (mode === 'classic') {
    // Use checkDeviceCompliance to grab a real computer ID
    const compResult = await callTool(client, 'checkDeviceCompliance', {
      days: 9999,
      includeDetails: true,
    }) as any;
    const compText = compResult?.content?.[0]?.text ?? '{}';
    try {
      const parsed = JSON.parse(compText);
      const devices = parsed.staleDevices ?? parsed.devices ?? [];
      if (devices.length > 0) {
        computerId = String(devices[0].id ?? devices[0].deviceId ?? '1');
      }
    } catch { /* use default */ }

    // Grab a package ID
    const pkgResult = await callTool(client, 'listPackages', {}) as any;
    const pkgText = pkgResult?.content?.[0]?.text ?? '{}';
    try {
      const parsed = JSON.parse(pkgText);
      const pkgs = parsed.packages ?? parsed ?? [];
      if (Array.isArray(pkgs) && pkgs.length > 0) {
        packageId = String(pkgs[0].id ?? '1');
      }
    } catch { /* use default */ }
  } else {
    // Code mode — discover via jamf_execute
    const compResult = await callTool(client, 'jamf_execute', {
      code: `const all = await jamf.getAllComputers(5);\nreturn all.map(c => ({ id: c.id }));`,
      mode: 'apply',
      capabilities: ['read:computers'],
    }) as any;
    const compText = compResult?.content?.[0]?.text ?? '[]';
    try {
      const parsed = JSON.parse(compText);
      const list = parsed.result ?? parsed ?? [];
      if (Array.isArray(list) && list.length > 0) {
        computerId = String(list[0].id ?? '1');
      }
    } catch { /* use default */ }

    const pkgResult = await callTool(client, 'jamf_execute', {
      code: `const pkgs = await jamf.listPackages(5);\nreturn pkgs.map(p => ({ id: p.id }));`,
      mode: 'apply',
      capabilities: ['read:packages'],
    }) as any;
    const pkgText = pkgResult?.content?.[0]?.text ?? '[]';
    try {
      const parsed = JSON.parse(pkgText);
      const list = parsed.result ?? parsed ?? [];
      if (Array.isArray(list) && list.length > 0) {
        packageId = String(list[0].id ?? '1');
      }
    } catch { /* use default */ }
  }

  return { computerId, packageId };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const scenario1: ScenarioFn = async (client, mode, ctx) => {
  const scenario = 'Device details';
  let toolCalls = 0;

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      toolCalls = 1;
      return callTool(client, 'getDeviceDetails', { deviceId: ctx.computerId });
    } else {
      toolCalls = 1;
      return callTool(client, 'jamf_execute', {
        code: `return await jamf.getComputerDetails("${ctx.computerId}");`,
        mode: 'apply',
        capabilities: ['read:computers'],
      });
    }
  });

  return { scenario, mode, toolCalls, wallTimeMs: ms, payloadBytes: payloadSize(result) };
};

const scenario2: ScenarioFn = async (client, mode, _ctx) => {
  const scenario = 'Stale computers (30d)';
  let toolCalls = 0;

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      toolCalls = 1;
      return callTool(client, 'checkDeviceCompliance', { days: 30, includeDetails: true });
    } else {
      toolCalls = 1;
      return callTool(client, 'jamf_execute', {
        code: [
          'const computers = await jamf.getAllComputers(200);',
          'const stale = computers.filter(c => helpers.daysSince(c.lastContactTime) > 30);',
          'return stale.map(c => ({ id: c.id, name: c.name, lastContact: c.lastContactTime }));',
        ].join('\n'),
        mode: 'apply',
        capabilities: ['read:computers'],
      });
    }
  });

  return { scenario, mode, toolCalls, wallTimeMs: ms, payloadBytes: payloadSize(result) };
};

const scenario3: ScenarioFn = async (client, mode, ctx) => {
  const scenario = 'Policies using package';
  let toolCalls = 0;

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      toolCalls = 1;
      return callTool(client, 'getPoliciesUsingPackage', { packageId: ctx.packageId });
    } else {
      toolCalls = 1;
      return callTool(client, 'jamf_execute', {
        code: `return await jamf.getPoliciesUsingPackage("${ctx.packageId}");`,
        mode: 'apply',
        capabilities: ['read:packages'],
      });
    }
  });

  return { scenario, mode, toolCalls, wallTimeMs: ms, payloadBytes: payloadSize(result) };
};

const scenario4: ScenarioFn = async (client, mode, _ctx) => {
  const scenario = 'Multi-step fleet analysis';
  let toolCalls = 0;

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      // Step 1: Fleet overview
      toolCalls++;
      await callTool(client, 'getFleetOverview', {});

      // Step 2: List all computers
      toolCalls++;
      const complianceResult = await callTool(client, 'checkDeviceCompliance', {
        days: 9999,
        includeDetails: true,
      }) as any;

      // Extract first 5 device IDs (use days=9999 to guarantee results)
      let deviceIds: string[] = [];
      try {
        const text = complianceResult?.content?.[0]?.text ?? '{}';
        const parsed = JSON.parse(text);
        const devices = parsed.staleDevices ?? parsed.devices ?? [];
        deviceIds = devices.slice(0, 5).map((d: any) => String(d.id ?? d.deviceId));
      } catch { /* empty */ }

      // Fallback: if we still got no IDs, use sequential IDs
      if (deviceIds.length === 0) {
        deviceIds = ['1', '2', '3', '4', '5'];
      }

      // Step 3: Get details for top 5 devices (sequential — simulates LLM round-trips)
      const detailResults: unknown[] = [];
      for (const id of deviceIds) {
        toolCalls++;
        detailResults.push(await callTool(client, 'getDeviceDetails', { deviceId: id }));
      }

      return { complianceResult, detailResults };
    } else {
      // Code mode: everything in one execution
      toolCalls = 1;
      return callTool(client, 'jamf_execute', {
        code: [
          '// Fleet overview',
          'const [inventory, compliance] = await Promise.all([',
          '  jamf.getInventorySummary(),',
          '  jamf.getDeviceComplianceSummary(),',
          ']);',
          '',
          '// All computers, take first 5',
          'const computers = await jamf.getAllComputers(200);',
          'const top5 = computers.slice(0, 5);',
          '',
          '// Get full details for top 5 (parallel)',
          'const details = await Promise.all(',
          '  top5.map(c => jamf.getComputerDetails(String(c.id)))',
          ');',
          '',
          'return {',
          '  fleet: { inventory, compliance },',
          '  totalComputers: computers.length,',
          '  topDevices: details.map(d => ({',
          '    id: d.id ?? d.general?.id,',
          '    name: d.name ?? d.general?.name,',
          '    lastContact: d.lastContactTime ?? d.general?.last_contact_time,',
          '  })),',
          '};',
        ].join('\n'),
        mode: 'apply',
        capabilities: ['read:computers', 'read:reports'],
      });
    }
  });

  return { scenario, mode, toolCalls, wallTimeMs: ms, payloadBytes: payloadSize(result) };
};

const SCENARIOS: ScenarioFn[] = [scenario1, scenario2, scenario3, scenario4];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Validate env
  if (!process.env.JAMF_URL) {
    console.error('Error: JAMF_URL is not set. Export Jamf credentials before running benchmarks.');
    process.exit(1);
  }

  console.log('Connecting to Classic Mode server...');
  const classicClient = await connectClient('dist/index.js');

  console.log('Connecting to Code Mode server...');
  const codeClient = await connectClient('dist/index-code.js');

  // Discover valid IDs from each mode
  console.log('Discovering valid resource IDs...');
  const classicCtx = await discover(classicClient, 'classic');
  const codeCtx = await discover(codeClient, 'code');
  console.log(`  Classic — computer: ${classicCtx.computerId}, package: ${classicCtx.packageId}`);
  console.log(`  Code    — computer: ${codeCtx.computerId}, package: ${codeCtx.packageId}`);

  // Warm-up pass (primes auth tokens & caches)
  console.log('\nWarm-up pass...');
  for (const scenarioFn of SCENARIOS) {
    try {
      await scenarioFn(classicClient, 'classic', classicCtx);
    } catch (e) {
      console.warn(`  Warm-up (classic) failed: ${(e as Error).message}`);
    }
    try {
      await scenarioFn(codeClient, 'code', codeCtx);
    } catch (e) {
      console.warn(`  Warm-up (code) failed: ${(e as Error).message}`);
    }
  }

  // Measured pass
  console.log('\nMeasured pass...');
  const results: BenchmarkResult[] = [];

  for (const scenarioFn of SCENARIOS) {
    try {
      const classicResult = await scenarioFn(classicClient, 'classic', classicCtx);
      results.push(classicResult);
      console.log(`  [classic] ${classicResult.scenario}: ${classicResult.wallTimeMs}ms`);
    } catch (e) {
      console.error(`  [classic] FAILED: ${(e as Error).message}`);
    }

    try {
      const codeResult = await scenarioFn(codeClient, 'code', codeCtx);
      results.push(codeResult);
      console.log(`  [code]    ${codeResult.scenario}: ${codeResult.wallTimeMs}ms`);
    } catch (e) {
      console.error(`  [code]    FAILED: ${(e as Error).message}`);
    }
  }

  // Close connections
  try { await classicClient.close(); } catch { /* ignore */ }
  try { await codeClient.close(); } catch { /* ignore */ }

  // Print results table
  console.log('\n## Benchmark Results\n');
  console.log(
    '| Scenario                     | Mode    | Tool Calls | Time (ms) | Payload (bytes) |',
  );
  console.log(
    '|------------------------------|---------|------------|-----------|-----------------|',
  );

  for (const r of results) {
    const scenario = r.scenario.padEnd(28);
    const mode = r.mode.padEnd(7);
    const calls = String(r.toolCalls).padStart(10);
    const time = fmt(r.wallTimeMs).padStart(9);
    const payload = fmt(r.payloadBytes).padStart(15);
    console.log(`| ${scenario} | ${mode} | ${calls} | ${time} | ${payload} |`);
  }

  // Summary
  const classic4 = results.find(r => r.scenario === 'Multi-step fleet analysis' && r.mode === 'classic');
  const code4 = results.find(r => r.scenario === 'Multi-step fleet analysis' && r.mode === 'code');
  if (classic4 && code4) {
    console.log('\n### Multi-step Scenario Comparison\n');
    console.log(`Classic Mode: ${classic4.toolCalls} tool calls (LLM round-trips), ${fmt(classic4.wallTimeMs)}ms`);
    console.log(`Code Mode:    ${code4.toolCalls} tool call,  ${fmt(code4.wallTimeMs)}ms`);
    const callReduction = Math.round((1 - code4.toolCalls / classic4.toolCalls) * 100);
    const timeChange = Math.round((1 - code4.wallTimeMs / classic4.wallTimeMs) * 100);
    console.log(`\nTool call reduction: ${callReduction}%`);
    if (timeChange > 0) {
      console.log(`Wall-clock speedup:  ${timeChange}%`);
    } else {
      console.log(`Wall-clock change:   ${-timeChange}% slower (single-call overhead)`);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
