#!/usr/bin/env tsx
/**
 * Benchmark: Code Mode vs Classic Mode
 *
 * Connects to both MCP server modes via StdioClientTransport and runs
 * 10 scenarios measuring tool calls, LLM round-trips, wall-clock time,
 * payload sizes, and completability.
 *
 * Requires a live Jamf Pro instance — reads credentials from env vars
 * (same ones used by the MCP server: JAMF_URL, JAMF_CLIENT_ID, JAMF_CLIENT_SECRET).
 *
 * Usage:
 *   npx tsx benchmarks/run.ts
 *   npx tsx benchmarks/run.ts --scenarios 1,3,8
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
  llmRoundTrips: number;
  wallTimeMs: number;
  payloadBytes: number;
  completable: boolean;
}

type ScenarioFn = (
  client: Client,
  mode: 'classic' | 'code',
  ctx: RunContext,
) => Promise<BenchmarkResult>;

interface RunContext {
  computerId: string;
  packageId: string;
  groupId: string;
  policyIdA: string;
  policyIdB: string;
}

interface ToolOverhead {
  mode: 'classic' | 'code';
  toolCount: number;
  defSizeBytes: number;
  estTokens: number;
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

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return client.callTool({ name, arguments: args });
}

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

function extractText(result: unknown): string {
  return (result as any)?.content?.[0]?.text ?? '{}';
}

function parseResult(result: unknown): any {
  try {
    return JSON.parse(extractText(result));
  } catch {
    return {};
  }
}

/** Build a result for Classic-impossible scenarios. */
function impossibleClassic(scenario: string): BenchmarkResult {
  return {
    scenario,
    mode: 'classic',
    toolCalls: 0,
    llmRoundTrips: 0,
    wallTimeMs: 0,
    payloadBytes: 0,
    completable: false,
  };
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseScenarioFilter(): Set<number> | null {
  const idx = process.argv.indexOf('--scenarios');
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  const raw = process.argv[idx + 1];
  const nums = raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  return nums.length > 0 ? new Set(nums) : null;
}

// ---------------------------------------------------------------------------
// Tool Definition Overhead
// ---------------------------------------------------------------------------

async function measureToolOverhead(
  classicClient: Client,
  codeClient: Client,
): Promise<ToolOverhead[]> {
  const classicTools = await classicClient.listTools();
  const codeTools = await codeClient.listTools();

  const classicJson = JSON.stringify(classicTools.tools);
  const codeJson = JSON.stringify(codeTools.tools);

  // Rough estimate: ~4 chars per token for JSON tool definitions
  const CHARS_PER_TOKEN = 4;

  return [
    {
      mode: 'classic',
      toolCount: classicTools.tools.length,
      defSizeBytes: classicJson.length,
      estTokens: Math.round(classicJson.length / CHARS_PER_TOKEN),
    },
    {
      mode: 'code',
      toolCount: codeTools.tools.length,
      defSizeBytes: codeJson.length,
      estTokens: Math.round(codeJson.length / CHARS_PER_TOKEN),
    },
  ];
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

async function discover(client: Client, mode: 'classic' | 'code'): Promise<RunContext> {
  let computerId = '1';
  let packageId = '1';
  let groupId = '1';
  let policyIdA = '1';
  let policyIdB = '2';

  if (mode === 'classic') {
    // Discover computer ID
    try {
      const parsed = parseResult(
        await callTool(client, 'checkDeviceCompliance', { days: 9999, includeDetails: true }),
      );
      const devices = parsed.staleDevices ?? parsed.devices ?? [];
      if (devices.length > 0) computerId = String(devices[0].id ?? devices[0].deviceId ?? '1');
    } catch { /* use default */ }

    // Discover package ID
    try {
      const parsed = parseResult(await callTool(client, 'listPackages', {}));
      const pkgs = parsed.packages ?? parsed ?? [];
      if (Array.isArray(pkgs) && pkgs.length > 0) packageId = String(pkgs[0].id ?? '1');
    } catch { /* use default */ }

    // Discover group ID
    try {
      const parsed = parseResult(await callTool(client, 'listComputerGroups', {}));
      const groups = parsed.groups ?? parsed ?? [];
      if (Array.isArray(groups) && groups.length > 0) groupId = String(groups[0].id ?? '1');
    } catch { /* use default */ }

    // Discover two policy IDs
    try {
      const parsed = parseResult(await callTool(client, 'listPolicies', {}));
      const policies = parsed.policies ?? parsed ?? [];
      if (Array.isArray(policies) && policies.length >= 2) {
        policyIdA = String(policies[0].id ?? '1');
        policyIdB = String(policies[1].id ?? '2');
      } else if (Array.isArray(policies) && policies.length >= 1) {
        policyIdA = String(policies[0].id ?? '1');
      }
    } catch { /* use default */ }
  } else {
    // Code mode discovery
    try {
      const parsed = parseResult(
        await callTool(client, 'jamf_execute', {
          code: `const all = await jamf.getAllComputers(5);\nreturn all.map(c => ({ id: c.id }));`,
          mode: 'apply',
          capabilities: ['read:computers'],
        }),
      );
      const list = parsed.result ?? parsed ?? [];
      if (Array.isArray(list) && list.length > 0) computerId = String(list[0].id ?? '1');
    } catch { /* use default */ }

    try {
      const parsed = parseResult(
        await callTool(client, 'jamf_execute', {
          code: `const pkgs = await jamf.listPackages(5);\nreturn pkgs.map(p => ({ id: p.id }));`,
          mode: 'apply',
          capabilities: ['read:packages'],
        }),
      );
      const list = parsed.result ?? parsed ?? [];
      if (Array.isArray(list) && list.length > 0) packageId = String(list[0].id ?? '1');
    } catch { /* use default */ }

    try {
      const parsed = parseResult(
        await callTool(client, 'jamf_execute', {
          code: `const groups = await jamf.listComputerGroups();\nreturn groups.slice(0, 1).map(g => ({ id: g.id }));`,
          mode: 'apply',
          capabilities: ['read:groups'],
        }),
      );
      const list = parsed.result ?? parsed ?? [];
      if (Array.isArray(list) && list.length > 0) groupId = String(list[0].id ?? '1');
    } catch { /* use default */ }

    try {
      const parsed = parseResult(
        await callTool(client, 'jamf_execute', {
          code: `const policies = await jamf.listPolicies(5);\nreturn policies.slice(0, 2).map(p => ({ id: p.id }));`,
          mode: 'apply',
          capabilities: ['read:policies'],
        }),
      );
      const list = parsed.result ?? parsed ?? [];
      if (Array.isArray(list) && list.length >= 2) {
        policyIdA = String(list[0].id ?? '1');
        policyIdB = String(list[1].id ?? '2');
      } else if (Array.isArray(list) && list.length >= 1) {
        policyIdA = String(list[0].id ?? '1');
      }
    } catch { /* use default */ }
  }

  return { computerId, packageId, groupId, policyIdA, policyIdB };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

// S1: Single device lookup — baseline parity
const scenario1: ScenarioFn = async (client, mode, ctx) => {
  const scenario = 'Single device lookup';

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      return callTool(client, 'getDeviceDetails', { deviceId: ctx.computerId });
    } else {
      return callTool(client, 'jamf_execute', {
        code: `return await jamf.getComputerDetails("${ctx.computerId}");`,
        mode: 'apply',
        capabilities: ['read:computers'],
      });
    }
  });

  return {
    scenario, mode, toolCalls: 1, llmRoundTrips: 1,
    wallTimeMs: ms, payloadBytes: payloadSize(result), completable: true,
  };
};

// S2: Device profile + policy logs — compound tool comparison
const scenario2: ScenarioFn = async (client, mode, ctx) => {
  const scenario = 'Device profile + policy logs';

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      return callTool(client, 'getDeviceFullProfile', {
        identifier: ctx.computerId,
        includePolicyLogs: true,
      });
    } else {
      return callTool(client, 'jamf_execute', {
        code: [
          `const details = await jamf.getComputerDetails("${ctx.computerId}");`,
          `const logs = await jamf.getComputerPolicyLogs("${ctx.computerId}");`,
          'return { details, logs };',
        ].join('\n'),
        mode: 'apply',
        capabilities: ['read:computers'],
      });
    }
  });

  return {
    scenario, mode, toolCalls: 1, llmRoundTrips: 1,
    wallTimeMs: ms, payloadBytes: payloadSize(result), completable: true,
  };
};

// S3: Orphaned scripts audit — cross-domain join
const scenario3: ScenarioFn = async (client, mode, _ctx) => {
  const scenario = 'Orphaned scripts audit';
  let toolCalls = 0;
  let llmRoundTrips = 0;

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      // Step 1: list scripts
      toolCalls++;
      llmRoundTrips++;
      const scriptsRaw = await callTool(client, 'listScripts', {});
      const scripts = parseResult(scriptsRaw);
      const scriptList = scripts.scripts ?? scripts ?? [];
      const scriptIds = Array.isArray(scriptList)
        ? scriptList.map((s: any) => String(s.id)).slice(0, 50)
        : [];

      // Step 2: list policies
      toolCalls++;
      llmRoundTrips++;
      const policiesRaw = await callTool(client, 'listPolicies', {});
      const policies = parseResult(policiesRaw);
      const policyList = policies.policies ?? policies ?? [];
      const policyIds = Array.isArray(policyList)
        ? policyList.map((p: any) => String(p.id)).slice(0, 20)
        : [];

      // Step 3: get details for each policy (truncated at 20)
      const policyDetails: unknown[] = [];
      for (const pid of policyIds) {
        toolCalls++;
        llmRoundTrips++;
        policyDetails.push(await callTool(client, 'getPolicyDetails', { policyId: pid }));
      }

      // The LLM would need to parse all policy details to find script references
      // and compare with scriptIds — this is the cross-domain join
      return { scriptIds, policyDetails };
    } else {
      toolCalls = 1;
      llmRoundTrips = 1;
      return callTool(client, 'jamf_execute', {
        code: [
          'const [scripts, policies] = await Promise.all([',
          '  jamf.listScripts(100),',
          '  jamf.listPolicies(200),',
          ']);',
          '',
          '// Get all policy details in parallel to find script references',
          'const details = await Promise.all(',
          '  policies.map(p => jamf.getPolicyDetails(String(p.id)))',
          ');',
          '',
          '// Build set of script IDs referenced by any policy',
          'const usedScriptIds = new Set();',
          'for (const d of details) {',
          '  const scriptItems = d?.scripts ?? [];',
          '  for (const s of scriptItems) usedScriptIds.add(String(s.id));',
          '}',
          '',
          '// Find orphaned scripts',
          'const orphaned = scripts.filter(s => !usedScriptIds.has(String(s.id)));',
          'return { totalScripts: scripts.length, orphaned: orphaned.length, orphanedScripts: orphaned };',
        ].join('\n'),
        mode: 'apply',
        capabilities: ['read:scripts', 'read:policies'],
      });
    }
  });

  return {
    scenario, mode, toolCalls, llmRoundTrips,
    wallTimeMs: ms, payloadBytes: payloadSize(result), completable: true,
  };
};

// S4: Policies targeting a group — scope cross-reference
const scenario4: ScenarioFn = async (client, mode, ctx) => {
  const scenario = 'Policies targeting a group';
  let toolCalls = 0;
  let llmRoundTrips = 0;

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      // Step 1: get group details to know its name
      toolCalls++;
      llmRoundTrips++;
      const groupRaw = await callTool(client, 'getComputerGroupDetails', { groupId: ctx.groupId });
      const group = parseResult(groupRaw);
      const groupName = group.name ?? `Group ${ctx.groupId}`;

      // Step 2: list all policies
      toolCalls++;
      llmRoundTrips++;
      const policiesRaw = await callTool(client, 'listPolicies', {});
      const policies = parseResult(policiesRaw);
      const policyList = policies.policies ?? policies ?? [];
      const policyIds = Array.isArray(policyList)
        ? policyList.map((p: any) => String(p.id)).slice(0, 20)
        : [];

      // Step 3: get each policy detail to check scope (truncated at 20)
      const policyDetails: unknown[] = [];
      for (const pid of policyIds) {
        toolCalls++;
        llmRoundTrips++;
        policyDetails.push(await callTool(client, 'getPolicyDetails', { policyId: pid }));
      }

      return { groupName, policyDetails };
    } else {
      toolCalls = 1;
      llmRoundTrips = 1;
      return callTool(client, 'jamf_execute', {
        code: [
          `const group = await jamf.getComputerGroupDetails("${ctx.groupId}");`,
          'const policies = await jamf.listPolicies(200);',
          'const details = await Promise.all(',
          '  policies.map(p => jamf.getPolicyDetails(String(p.id)))',
          ');',
          '',
          '// Filter policies that target this group',
          'const targeting = details.filter(d => {',
          '  const groups = d?.scope?.computer_groups ?? [];',
          `  return groups.some(g => String(g.id) === "${ctx.groupId}" || g.name === group.name);`,
          '});',
          '',
          'return {',
          '  group: group.name,',
          '  totalPolicies: policies.length,',
          '  targetingGroup: targeting.length,',
          '  policies: targeting.map(d => ({ id: d.id, name: d.general?.name ?? d.name }))',
          '};',
        ].join('\n'),
        mode: 'apply',
        capabilities: ['read:groups', 'read:policies'],
      });
    }
  });

  return {
    scenario, mode, toolCalls, llmRoundTrips,
    wallTimeMs: ms, payloadBytes: payloadSize(result), completable: true,
  };
};

// S5: OS version by department — impossible in Classic
const scenario5: ScenarioFn = async (client, mode, _ctx) => {
  const scenario = 'OS version by department';

  if (mode === 'classic') {
    return impossibleClassic(scenario);
  }

  const { result, ms } = await timed(async () => {
    return callTool(client, 'jamf_execute', {
      code: [
        'const computers = await jamf.searchComputers("", 500);',
        '',
        '// Build department → OS version breakdown',
        'const deptMap = {};',
        'for (const c of computers) {',
        '  const dept = c.department || "Unknown";',
        '  const os = c.osVersion || "Unknown";',
        '  if (!deptMap[dept]) deptMap[dept] = {};',
        '  deptMap[dept][os] = (deptMap[dept][os] || 0) + 1;',
        '}',
        '',
        'return {',
        '  totalDevices: computers.length,',
        '  departments: Object.entries(deptMap).map(([dept, versions]) => ({',
        '    department: dept,',
        '    osVersions: versions,',
        '    deviceCount: Object.values(versions).reduce((a, b) => a + b, 0),',
        '  })),',
        '};',
      ].join('\n'),
      mode: 'apply',
      capabilities: ['read:computers'],
    });
  });

  return {
    scenario, mode: 'code', toolCalls: 1, llmRoundTrips: 1,
    wallTimeMs: ms, payloadBytes: payloadSize(result), completable: true,
  };
};

// S6: Full security audit — multi-source parallel
const scenario6: ScenarioFn = async (client, mode, _ctx) => {
  const scenario = 'Full security audit';
  let toolCalls = 0;
  let llmRoundTrips = 0;

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      toolCalls = 4;
      // Each call is a sequential LLM round-trip
      llmRoundTrips = 4;
      const fleet = await callTool(client, 'getFleetOverview', {});
      const security = await callTool(client, 'getSecurityPosture', {});
      const compliance = await callTool(client, 'checkDeviceCompliance', { days: 30, includeDetails: true });
      const inventory = await callTool(client, 'getInventorySummary', {});
      return { fleet, security, compliance, inventory };
    } else {
      toolCalls = 1;
      llmRoundTrips = 1;
      return callTool(client, 'jamf_execute', {
        code: [
          'const [inventory, compliance, computers] = await Promise.all([',
          '  jamf.getInventorySummary(),',
          '  jamf.getDeviceComplianceSummary(),',
          '  jamf.searchComputers("", 200),',
          ']);',
          '',
          '// Compute security metrics from computer sample',
          'const sample = computers.slice(0, 20);',
          'const details = await Promise.all(',
          '  sample.map(c => jamf.getComputerDetails(String(c.id)))',
          ');',
          '',
          'let encrypted = 0;',
          'for (const d of details) {',
          '  const fv = d?.security?.filevault2_status ?? d?.hardware?.filevault2_status;',
          '  if (fv === "Encrypted" || fv === "FileVault 2 Encrypted") encrypted++;',
          '}',
          '',
          'return {',
          '  inventory,',
          '  compliance,',
          '  encryption: { sampled: sample.length, encrypted, rate: (encrypted / sample.length * 100).toFixed(1) + "%" },',
          '  totalDevices: computers.length,',
          '};',
        ].join('\n'),
        mode: 'apply',
        capabilities: ['read:computers', 'read:reports'],
      });
    }
  });

  return {
    scenario, mode, toolCalls, llmRoundTrips,
    wallTimeMs: ms, payloadBytes: payloadSize(result), completable: true,
  };
};

// S7: Policy comparison — simple parallel
const scenario7: ScenarioFn = async (client, mode, ctx) => {
  const scenario = 'Policy comparison';
  let toolCalls = 0;
  let llmRoundTrips = 0;

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      toolCalls = 2;
      llmRoundTrips = 2;
      const a = await callTool(client, 'getPolicyDetails', { policyId: ctx.policyIdA });
      const b = await callTool(client, 'getPolicyDetails', { policyId: ctx.policyIdB });
      return { policyA: a, policyB: b };
    } else {
      toolCalls = 1;
      llmRoundTrips = 1;
      return callTool(client, 'jamf_execute', {
        code: [
          'const [a, b] = await Promise.all([',
          `  jamf.getPolicyDetails("${ctx.policyIdA}"),`,
          `  jamf.getPolicyDetails("${ctx.policyIdB}"),`,
          ']);',
          '',
          '// Compare key fields',
          'const fields = ["general", "scope", "scripts", "packages", "self_service"];',
          'const diff = {};',
          'for (const f of fields) {',
          '  const aVal = JSON.stringify(a?.[f]);',
          '  const bVal = JSON.stringify(b?.[f]);',
          '  diff[f] = aVal === bVal ? "identical" : "different";',
          '}',
          '',
          'return {',
          '  policyA: { id: a?.general?.id, name: a?.general?.name },',
          '  policyB: { id: b?.general?.id, name: b?.general?.name },',
          '  comparison: diff,',
          '};',
        ].join('\n'),
        mode: 'apply',
        capabilities: ['read:policies'],
      });
    }
  });

  return {
    scenario, mode, toolCalls, llmRoundTrips,
    wallTimeMs: ms, payloadBytes: payloadSize(result), completable: true,
  };
};

// S8: Stale devices + details (top 10) — sequential LLM loop
const scenario8: ScenarioFn = async (client, mode, _ctx) => {
  const scenario = 'Stale devices + details (top 10)';
  let toolCalls = 0;
  let llmRoundTrips = 0;

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      // Step 1: get stale devices
      toolCalls++;
      llmRoundTrips++;
      const complianceRaw = await callTool(client, 'checkDeviceCompliance', {
        days: 30,
        includeDetails: true,
      });
      const compliance = parseResult(complianceRaw);
      const devices = compliance.staleDevices ?? compliance.devices ?? [];

      // Step 2: get details for top 10 (sequential LLM round-trips)
      const top10 = Array.isArray(devices) ? devices.slice(0, 10) : [];
      const detailResults: unknown[] = [];
      for (const d of top10) {
        const id = String(d.id ?? d.deviceId ?? '1');
        toolCalls++;
        llmRoundTrips++;
        detailResults.push(await callTool(client, 'getDeviceDetails', { deviceId: id }));
      }

      return { staleCount: devices.length, details: detailResults };
    } else {
      toolCalls = 1;
      llmRoundTrips = 1;
      return callTool(client, 'jamf_execute', {
        code: [
          'const computers = await jamf.getAllComputers(200);',
          'const stale = computers.filter(c => helpers.daysSince(c.lastContactTime) > 30);',
          '',
          '// Get details for top 10 stale devices in parallel',
          'const top10 = stale.slice(0, 10);',
          'const details = await Promise.all(',
          '  top10.map(c => jamf.getComputerDetails(String(c.id)))',
          ');',
          '',
          'return {',
          '  totalStale: stale.length,',
          '  top10: details.map(d => ({',
          '    id: d.id ?? d.general?.id,',
          '    name: d.name ?? d.general?.name,',
          '    lastContact: d.lastContactTime ?? d.general?.last_contact_time,',
          '    os: d.operatingSystem?.version ?? d.hardware?.os_version,',
          '  })),',
          '};',
        ].join('\n'),
        mode: 'apply',
        capabilities: ['read:computers'],
      });
    }
  });

  return {
    scenario, mode, toolCalls, llmRoundTrips,
    wallTimeMs: ms, payloadBytes: payloadSize(result), completable: true,
  };
};

// S9: Package dependency audit — nested joins
const scenario9: ScenarioFn = async (client, mode, ctx) => {
  const scenario = 'Package dependency audit';
  let toolCalls = 0;
  let llmRoundTrips = 0;

  const { result, ms } = await timed(async () => {
    if (mode === 'classic') {
      // Step 1: get policies using the package
      toolCalls++;
      llmRoundTrips++;
      const policiesRaw = await callTool(client, 'getPoliciesUsingPackage', { packageId: ctx.packageId });
      const policiesResult = parseResult(policiesRaw);
      const policyList = policiesResult.policies ?? policiesResult ?? [];
      const policyIds = Array.isArray(policyList)
        ? policyList.map((p: any) => String(p.id)).slice(0, 10)
        : [];

      // Step 2: get each policy detail (to find scoped groups)
      const policyDetails: any[] = [];
      for (const pid of policyIds) {
        toolCalls++;
        llmRoundTrips++;
        const raw = await callTool(client, 'getPolicyDetails', { policyId: pid });
        policyDetails.push(parseResult(raw));
      }

      // Step 3: get group details for any scoped groups
      const groupIds = new Set<string>();
      for (const pd of policyDetails) {
        const groups = pd?.scope?.computer_groups ?? [];
        for (const g of groups) groupIds.add(String(g.id));
      }
      const groupDetails: unknown[] = [];
      for (const gid of Array.from(groupIds).slice(0, 5)) {
        toolCalls++;
        llmRoundTrips++;
        groupDetails.push(await callTool(client, 'getComputerGroupDetails', { groupId: gid }));
      }

      return { policyDetails, groupDetails };
    } else {
      toolCalls = 1;
      llmRoundTrips = 1;
      return callTool(client, 'jamf_execute', {
        code: [
          `const policies = await jamf.getPoliciesUsingPackage("${ctx.packageId}");`,
          '',
          '// Get full details for each policy',
          'const details = await Promise.all(',
          '  policies.map(p => jamf.getPolicyDetails(String(p.id)))',
          ');',
          '',
          '// Collect all scoped group IDs',
          'const groupIds = new Set();',
          'for (const d of details) {',
          '  for (const g of (d?.scope?.computer_groups ?? [])) groupIds.add(String(g.id));',
          '}',
          '',
          '// Get group details in parallel',
          'const groups = await Promise.all(',
          '  [...groupIds].map(id => jamf.getComputerGroupDetails(id))',
          ');',
          '',
          'return {',
          '  packageId: ' + JSON.stringify(ctx.packageId) + ',',
          '  policiesUsingPackage: policies.length,',
          '  policies: details.map(d => ({',
          '    id: d.id ?? d.general?.id,',
          '    name: d.general?.name ?? d.name,',
          '    enabled: d.general?.enabled,',
          '  })),',
          '  scopedGroups: groups.map(g => ({ id: g.id, name: g.name, memberCount: g.computers?.length ?? 0 })),',
          '};',
        ].join('\n'),
        mode: 'apply',
        capabilities: ['read:packages', 'read:policies', 'read:groups'],
      });
    }
  });

  return {
    scenario, mode, toolCalls, llmRoundTrips,
    wallTimeMs: ms, payloadBytes: payloadSize(result), completable: true,
  };
};

// S10: Group + FileVault + OS filter — impossible at scale in Classic
const scenario10: ScenarioFn = async (client, mode, ctx) => {
  const scenario = 'Group + FileVault + OS filter';

  if (mode === 'classic') {
    return impossibleClassic(scenario);
  }

  const { result, ms } = await timed(async () => {
    return callTool(client, 'jamf_execute', {
      code: [
        `const group = await jamf.getComputerGroupDetails("${ctx.groupId}");`,
        'const memberIds = (group.computers ?? []).map(c => String(c.id));',
        '',
        '// Fetch details for all group members in parallel',
        'const details = await Promise.all(',
        '  memberIds.map(id => jamf.getComputerDetails(id))',
        ');',
        '',
        '// Filter: FileVault enabled + macOS 14+',
        'const filtered = details.filter(d => {',
        '  const fv = d?.security?.filevault2_status ?? d?.hardware?.filevault2_status ?? "";',
        '  const os = d?.operatingSystem?.version ?? d?.hardware?.os_version ?? "0";',
        '  const major = parseInt(os.split(".")[0], 10);',
        '  return fv.includes("Encrypted") && major >= 14;',
        '});',
        '',
        'return {',
        '  group: group.name,',
        '  totalMembers: memberIds.length,',
        '  matchingFilter: filtered.length,',
        '  devices: filtered.map(d => ({',
        '    id: d.id ?? d.general?.id,',
        '    name: d.name ?? d.general?.name,',
        '    os: d.operatingSystem?.version ?? d.hardware?.os_version,',
        '  })),',
        '};',
      ].join('\n'),
      mode: 'apply',
      capabilities: ['read:groups', 'read:computers'],
    });
  });

  return {
    scenario, mode: 'code', toolCalls: 1, llmRoundTrips: 1,
    wallTimeMs: ms, payloadBytes: payloadSize(result), completable: true,
  };
};

// ---------------------------------------------------------------------------
// Scenario registry
// ---------------------------------------------------------------------------

const SCENARIOS: { num: number; name: string; fn: ScenarioFn }[] = [
  { num: 1, name: 'Single device lookup', fn: scenario1 },
  { num: 2, name: 'Device profile + policy logs', fn: scenario2 },
  { num: 3, name: 'Orphaned scripts audit', fn: scenario3 },
  { num: 4, name: 'Policies targeting a group', fn: scenario4 },
  { num: 5, name: 'OS version by department', fn: scenario5 },
  { num: 6, name: 'Full security audit', fn: scenario6 },
  { num: 7, name: 'Policy comparison', fn: scenario7 },
  { num: 8, name: 'Stale devices + details (top 10)', fn: scenario8 },
  { num: 9, name: 'Package dependency audit', fn: scenario9 },
  { num: 10, name: 'Group + FileVault + OS filter', fn: scenario10 },
];

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function printToolOverhead(overhead: ToolOverhead[]): void {
  console.log('\n## Tool Definition Overhead\n');
  console.log('| Mode    | Tools | Def. Size (bytes) | Est. Tokens |');
  console.log('|---------|-------|--------------------|-------------|');
  for (const o of overhead) {
    const mode = o.mode.padEnd(7);
    const tools = String(o.toolCount).padStart(5);
    const size = fmt(o.defSizeBytes).padStart(18);
    const tokens = fmt(o.estTokens).padStart(11);
    console.log(`| ${mode} | ${tools} | ${size} | ${tokens} |`);
  }
}

function printResults(results: BenchmarkResult[]): void {
  console.log('\n## Scenario Results\n');
  console.log(
    '| #  | Scenario                       | Mode    | LLM Trips | Time (ms) | Payload   | Completable |',
  );
  console.log(
    '|----|--------------------------------|---------|-----------|-----------|-----------|-------------|',
  );

  for (const r of results) {
    const num = results.indexOf(r) === 0
      ? findScenarioNum(r.scenario).toString().padStart(2)
      : findScenarioNum(r.scenario).toString().padStart(2);

    const scenarioNum = findScenarioNum(r.scenario).toString().padStart(2);
    const scenario = r.scenario.padEnd(30);
    const mode = r.mode.padEnd(7);

    let trips: string;
    let time: string;
    let payload: string;
    let completable: string;

    if (!r.completable) {
      trips = 'N/A'.padStart(9);
      time = 'N/A'.padStart(9);
      payload = 'N/A'.padStart(9);
      completable = 'No'.padEnd(11);
    } else {
      trips = fmt(r.llmRoundTrips).padStart(9);
      time = fmt(r.wallTimeMs).padStart(9);
      payload = fmt(r.payloadBytes).padStart(9);
      completable = 'Yes'.padEnd(11);
    }

    console.log(`| ${scenarioNum} | ${scenario} | ${mode} | ${trips} | ${time} | ${payload} | ${completable} |`);
  }
}

function findScenarioNum(scenarioName: string): number {
  const entry = SCENARIOS.find(s => s.name === scenarioName);
  return entry?.num ?? 0;
}

function printSummary(results: BenchmarkResult[]): void {
  console.log('\n## Summary\n');

  const totalScenarios = new Set(results.map(r => r.scenario)).size;
  const codeCompletable = results.filter(r => r.mode === 'code' && r.completable).length;
  const classicCompletable = results.filter(r => r.mode === 'classic' && r.completable).length;

  console.log(`Total scenarios: ${totalScenarios}`);
  console.log(`Code Mode completable: ${codeCompletable}/${totalScenarios}`);
  console.log(`Classic Mode completable: ${classicCompletable}/${totalScenarios}`);

  // Compute average LLM round-trip reduction where both modes can complete
  const bothComplete = new Set<string>();
  for (const r of results) {
    if (r.completable) {
      const scenarioName = r.scenario;
      const partner = results.find(
        p => p.scenario === scenarioName && p.mode !== r.mode && p.completable,
      );
      if (partner) bothComplete.add(scenarioName);
    }
  }

  if (bothComplete.size > 0) {
    let totalReduction = 0;
    for (const name of bothComplete) {
      const classic = results.find(r => r.scenario === name && r.mode === 'classic')!;
      const code = results.find(r => r.scenario === name && r.mode === 'code')!;
      if (classic.llmRoundTrips > 0) {
        totalReduction += (1 - code.llmRoundTrips / classic.llmRoundTrips) * 100;
      }
    }
    const avgReduction = Math.round(totalReduction / bothComplete.size);
    console.log(`Average LLM round-trip reduction: ${avgReduction}% (where both modes can complete)`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.JAMF_URL) {
    console.error('Error: JAMF_URL is not set. Export Jamf credentials before running benchmarks.');
    process.exit(1);
  }

  const scenarioFilter = parseScenarioFilter();
  const selectedScenarios = scenarioFilter
    ? SCENARIOS.filter(s => scenarioFilter.has(s.num))
    : SCENARIOS;

  if (selectedScenarios.length === 0) {
    console.error('Error: No matching scenarios for the given filter.');
    process.exit(1);
  }

  if (scenarioFilter) {
    console.log(`Running scenarios: ${selectedScenarios.map(s => s.num).join(', ')}`);
  }

  console.log('Connecting to Classic Mode server...');
  const classicClient = await connectClient('dist/index.js');

  console.log('Connecting to Code Mode server...');
  const codeClient = await connectClient('dist/index-code.js');

  // Tool definition overhead
  console.log('Measuring tool definition overhead...');
  const overhead = await measureToolOverhead(classicClient, codeClient);
  printToolOverhead(overhead);

  // Discovery
  console.log('\nDiscovering valid resource IDs...');
  const classicCtx = await discover(classicClient, 'classic');
  const codeCtx = await discover(codeClient, 'code');
  console.log(`  Classic — computer: ${classicCtx.computerId}, package: ${classicCtx.packageId}, group: ${classicCtx.groupId}, policies: ${classicCtx.policyIdA}/${classicCtx.policyIdB}`);
  console.log(`  Code    — computer: ${codeCtx.computerId}, package: ${codeCtx.packageId}, group: ${codeCtx.groupId}, policies: ${codeCtx.policyIdA}/${codeCtx.policyIdB}`);

  // Warmup — one lightweight call per server to prime auth tokens
  console.log('\nWarm-up...');
  try {
    await callTool(classicClient, 'getInventorySummary', {});
  } catch (e) {
    console.warn(`  Warm-up (classic) failed: ${(e as Error).message}`);
  }
  try {
    await callTool(codeClient, 'jamf_execute', {
      code: 'return "warm";',
      mode: 'apply',
      capabilities: ['read:computers'],
    });
  } catch (e) {
    console.warn(`  Warm-up (code) failed: ${(e as Error).message}`);
  }

  // Measured pass
  console.log('\nMeasured pass...');
  const results: BenchmarkResult[] = [];

  for (const { num, name, fn } of selectedScenarios) {
    // Classic
    try {
      const classicResult = await fn(classicClient, 'classic', classicCtx);
      results.push(classicResult);
      if (classicResult.completable) {
        console.log(`  [classic] S${num} ${name}: ${classicResult.llmRoundTrips} trips, ${classicResult.wallTimeMs}ms`);
      } else {
        console.log(`  [classic] S${num} ${name}: N/A (not completable)`);
      }
    } catch (e) {
      console.error(`  [classic] S${num} ${name}: FAILED — ${(e as Error).message}`);
    }

    // Code
    try {
      const codeResult = await fn(codeClient, 'code', codeCtx);
      results.push(codeResult);
      console.log(`  [code]    S${num} ${name}: ${codeResult.llmRoundTrips} trip, ${codeResult.wallTimeMs}ms`);
    } catch (e) {
      console.error(`  [code]    S${num} ${name}: FAILED — ${(e as Error).message}`);
    }
  }

  // Close connections
  try { await classicClient.close(); } catch { /* ignore */ }
  try { await codeClient.close(); } catch { /* ignore */ }

  // Print results
  printResults(results);
  printSummary(results);

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
