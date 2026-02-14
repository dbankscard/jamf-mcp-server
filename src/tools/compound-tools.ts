import { z } from 'zod';
import { createLogger } from '../server/logger.js';
import { IJamfApiClient } from '../types/jamf-client.js';

const logger = createLogger('compound-tools');

// ==========================================
// Response-size helpers
// ==========================================

function trimDeviceDetails(raw: any): any {
  return {
    id: raw.id,
    name: raw.name || raw.general?.name,
    serialNumber: raw.general?.serialNumber || raw.general?.serial_number,
    model: raw.hardware?.model || raw.hardware?.modelIdentifier,
    osVersion: raw.hardware?.os_version || raw.operatingSystem?.version,
    lastContactTime: raw.general?.lastContactTime || raw.general?.last_contact_time,
    username: raw.location?.username,
    email: raw.location?.emailAddress || raw.location?.email_address,
    ipAddress: raw.general?.lastIpAddress || raw.general?.ip_address,
    diskEncryption: raw.diskEncryption?.fileVault2Status || raw.security?.fileVault2Status,
    managementId: raw.general?.managementId,
  };
}

function trimPolicyDetails(raw: any): any {
  return {
    id: raw.id,
    name: raw.general?.name,
    enabled: raw.general?.enabled,
    category: raw.general?.category?.name,
    frequency: raw.general?.frequency,
    trigger: raw.general?.trigger,
    scope: {
      allComputers: raw.scope?.all_computers,
      computerCount: raw.scope?.computers?.length || 0,
      groupCount: raw.scope?.computer_groups?.length || 0,
      groups: (raw.scope?.computer_groups || []).map((g: any) => ({ id: g.id, name: g.name })),
    },
    selfService: {
      enabled: raw.self_service?.use_for_self_service || false,
      displayName: raw.self_service?.self_service_display_name,
    },
    packages: (raw.package_configuration?.packages || []).map((p: any) => ({ id: p.id, name: p.name })),
    scripts: (raw.scripts || []).map((s: any) => ({ id: s.id, name: s.name })),
  };
}

// ==========================================
// Schemas
// ==========================================

export const GetFleetOverviewSchema = z.object({});

export const GetDeviceFullProfileSchema = z.object({
  identifier: z.string().describe('Device name, serial number, or Jamf ID'),
  includePolicyLogs: z.boolean().optional().default(false).describe('Include recent policy execution logs'),
  includeHistory: z.boolean().optional().default(false).describe('Include device history events'),
});

export const GetSecurityPostureSchema = z.object({
  sampleSize: z.number().optional().default(20).describe('Number of devices to sample for encryption check'),
  complianceDays: z.number().optional().default(30).describe('Number of days for compliance check-in window'),
});

export const GetPolicyAnalysisSchema = z.object({
  policyId: z.string().optional().describe('The Jamf policy ID to analyze'),
  policyName: z.string().optional().describe('Policy name to search for (used if policyId not provided)'),
});

// ==========================================
// Compound Tool: getFleetOverview
// ==========================================

export async function executeGetFleetOverview(jamfClient: IJamfApiClient): Promise<any> {
  logger.info('Executing compound tool: getFleetOverview');

  const [inventorySummary, complianceSummary, mobileDevices] = await Promise.all([
    jamfClient.getInventorySummary().catch((e: Error) => ({ error: e.message })),
    jamfClient.getDeviceComplianceSummary().catch((e: Error) => ({ error: e.message })),
    jamfClient.searchMobileDevices('', 10).catch(() => []),
  ]);

  const computerCount = inventorySummary?.summary?.totalComputers
    ?? inventorySummary?.computers?.total
    ?? 'unknown';
  const mobileCount = Array.isArray(mobileDevices) ? mobileDevices.length : (inventorySummary?.summary?.totalMobileDevices ?? 'unknown');
  const complianceRate = complianceSummary?.summary?.complianceRate ?? 'unknown';

  const summary = `Fleet overview: ${computerCount} computers, ${mobileCount} mobile devices. Compliance rate: ${complianceRate}%.`;

  // Trim inventory to summary + distributions only (drop any raw device arrays)
  const trimmedInventory = inventorySummary?.error ? inventorySummary : {
    summary: inventorySummary?.summary,
    computers: inventorySummary?.computers
      ? { total: inventorySummary.computers.total, osVersionDistribution: inventorySummary.computers.osVersionDistribution, modelDistribution: inventorySummary.computers.modelDistribution }
      : undefined,
    mobileDevices: inventorySummary?.mobileDevices
      ? { total: inventorySummary.mobileDevices.total, osVersionDistribution: inventorySummary.mobileDevices.osVersionDistribution, modelDistribution: inventorySummary.mobileDevices.modelDistribution }
      : undefined,
  };

  // Trim compliance to summary + checkInStatus counts (drop device lists)
  const trimmedCompliance = complianceSummary?.error ? complianceSummary : {
    summary: complianceSummary?.summary,
    checkInStatus: complianceSummary?.checkInStatus,
    complianceRate: complianceSummary?.complianceRate,
  };

  return {
    summary,
    data: {
      inventory: trimmedInventory,
      compliance: trimmedCompliance,
      mobileDeviceSample: Array.isArray(mobileDevices) ? mobileDevices.slice(0, 5) : [],
    },
    suggestedNextActions: [
      'Use getDeviceComplianceSummary for detailed compliance breakdown',
      'Use searchDevices to find specific devices',
      'Use getSecurityPosture for encryption and security analysis',
      'Read jamf://reports/os-versions resource for OS version distribution',
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
    },
  };
}

// ==========================================
// Compound Tool: getDeviceFullProfile
// ==========================================

export async function executeGetDeviceFullProfile(
  jamfClient: IJamfApiClient,
  params: z.infer<typeof GetDeviceFullProfileSchema>,
): Promise<any> {
  const { identifier, includePolicyLogs, includeHistory } = params;
  logger.info(`Executing compound tool: getDeviceFullProfile for "${identifier}"`);

  // Step 1: Resolve identifier to device ID
  let deviceId = identifier;
  let deviceDetails: any = null;

  // Check if identifier looks like a numeric ID
  if (!/^\d+$/.test(identifier)) {
    // Search by name or serial
    const searchResults = await jamfClient.searchComputers(identifier, 5);
    if (!searchResults || searchResults.length === 0) {
      return {
        summary: `No device found matching "${identifier}".`,
        data: { searchResults: [] },
        suggestedNextActions: [
          'Try searchDevices with a different query',
          'Use listMobileDevices to check if this is a mobile device',
        ],
        metadata: { generatedAt: new Date().toISOString() },
      };
    }

    // Find best match
    const exactMatch = searchResults.find(
      (d: any) =>
        d.name?.toLowerCase() === identifier.toLowerCase() ||
        d.serialNumber?.toLowerCase() === identifier.toLowerCase(),
    );
    const device = exactMatch || searchResults[0];
    deviceId = device.id?.toString();
  }

  // Step 2: Parallel fetch of details + optional data
  const promises: Promise<any>[] = [
    jamfClient.getComputerDetails(deviceId),
  ];

  if (includePolicyLogs) {
    promises.push(
      jamfClient.getComputerPolicyLogs(deviceId).catch((e: Error) => ({ error: e.message })),
    );
  }
  if (includeHistory) {
    promises.push(
      jamfClient.getComputerHistory(deviceId).catch((e: Error) => ({ error: e.message })),
    );
  }

  const results = await Promise.all(promises);
  deviceDetails = results[0];
  const policyLogs = includePolicyLogs ? results[1] : undefined;
  const history = includeHistory ? results[includePolicyLogs ? 2 : 1] : undefined;

  // Build summary
  const name = deviceDetails?.name || deviceDetails?.general?.name || 'Unknown';
  const model = deviceDetails?.hardware?.model || deviceDetails?.hardware?.modelIdentifier || 'Unknown model';
  const osVersion = deviceDetails?.hardware?.os_version || deviceDetails?.operatingSystem?.version || deviceDetails?.hardware?.osVersion || 'Unknown OS';
  const lastContact = deviceDetails?.general?.lastContactTime || deviceDetails?.general?.last_contact_time || 'Unknown';
  const username = deviceDetails?.location?.username || deviceDetails?.userAndLocation?.username || 'No user assigned';

  let lastContactReadable = 'Unknown';
  if (lastContact && lastContact !== 'Unknown') {
    const contactDate = new Date(lastContact);
    const hoursAgo = Math.round((Date.now() - contactDate.getTime()) / (1000 * 60 * 60));
    if (hoursAgo < 1) lastContactReadable = 'less than 1h ago';
    else if (hoursAgo < 24) lastContactReadable = `${hoursAgo}h ago`;
    else lastContactReadable = `${Math.round(hoursAgo / 24)}d ago`;
  }

  const summary = `${name}: ${model}, ${osVersion}. Last contact: ${lastContactReadable}. User: ${username}.`;

  return {
    summary,
    data: {
      device: trimDeviceDetails(deviceDetails),
      policyLogs: policyLogs || undefined,
      history: history || undefined,
    },
    suggestedNextActions: [
      `Use sendComputerMDMCommand to send commands to device ${deviceId}`,
      `Use getComputerPolicyLogs for policy execution history`,
      `Use getComputerHistory for full device event timeline`,
      `Use getComputerMDMCommandHistory for MDM command status`,
    ],
    metadata: {
      deviceId,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ==========================================
// Compound Tool: getSecurityPosture
// ==========================================

export async function executeGetSecurityPosture(
  jamfClient: IJamfApiClient,
  params: z.infer<typeof GetSecurityPostureSchema>,
): Promise<any> {
  const { sampleSize, complianceDays } = params;
  logger.info(`Executing compound tool: getSecurityPosture (sample=${sampleSize}, days=${complianceDays})`);

  // Step 1: Parallel initial data fetch
  const [computers, complianceSummary] = await Promise.all([
    jamfClient.searchComputers('', 100).catch(() => []),
    jamfClient.getDeviceComplianceSummary().catch((e: Error) => ({ error: e.message })),
  ]);

  // Step 2: Parallel encryption check on sample
  const sample = (computers as any[]).slice(0, sampleSize);
  let encrypted = 0;
  let unencrypted = 0;
  let unknown = 0;

  const encryptionResults = await Promise.all(
    sample.map(async (computer: any) => {
      try {
        const detail = await jamfClient.getComputerDetails(computer.id);
        const diskEncryption = detail?.diskEncryption || detail?.disk_encryption;
        const fvStatus =
          diskEncryption?.fileVault2Status ||
          diskEncryption?.fileVault2_status ||
          detail?.fileVault2Status ||
          detail?.security?.fileVault2Status;

        if (
          fvStatus === 'ALL_ENCRYPTED' ||
          fvStatus === 'ENCRYPTED' ||
          fvStatus === 'allEncrypted'
        ) {
          return 'encrypted';
        } else if (fvStatus && fvStatus !== 'NOT_APPLICABLE') {
          return 'unencrypted';
        }
        return 'unknown';
      } catch {
        return 'unknown';
      }
    }),
  );

  for (const result of encryptionResults) {
    if (result === 'encrypted') encrypted++;
    else if (result === 'unencrypted') unencrypted++;
    else unknown++;
  }

  const totalSampled = encrypted + unencrypted + unknown;
  const encryptionRate = totalSampled > 0 ? ((encrypted / totalSampled) * 100).toFixed(1) : 'N/A';
  const complianceRate = complianceSummary?.summary?.complianceRate ?? 'unknown';

  // Build OS currency info from computers
  const osVersions = new Map<string, number>();
  for (const c of computers as any[]) {
    const os = c.osVersion || 'Unknown';
    osVersions.set(os, (osVersions.get(os) || 0) + 1);
  }
  const sortedOS = Array.from(osVersions.entries()).sort((a, b) => b[1] - a[1]);

  const summary = `Security posture: ${encryptionRate}% FileVault encrypted (${encrypted}/${totalSampled} sampled). Compliance rate: ${complianceRate}%. Fleet: ${(computers as any[]).length} computers across ${sortedOS.length} OS versions.`;

  return {
    summary,
    data: {
      encryption: {
        sampleSize: totalSampled,
        encrypted,
        unencrypted,
        unknown,
        encryptionRate: `${encryptionRate}%`,
      },
      compliance: complianceSummary,
      osVersionDistribution: sortedOS.slice(0, 10).map(([version, count]) => ({ version, count })),
      totalComputers: (computers as any[]).length,
    },
    suggestedNextActions: [
      unencrypted > 0
        ? `${unencrypted} devices not encrypted — use searchDevices to identify and remediate`
        : 'All sampled devices are encrypted',
      'Use checkDeviceCompliance for detailed non-compliant device list',
      'Read jamf://reports/encryption-status for full encryption report',
      'Read jamf://reports/os-versions for complete OS version breakdown',
    ],
    metadata: {
      sampleSize: totalSampled,
      totalFleet: (computers as any[]).length,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ==========================================
// Compound Tool: getPolicyAnalysis
// ==========================================

export async function executeGetPolicyAnalysis(
  jamfClient: IJamfApiClient,
  params: z.infer<typeof GetPolicyAnalysisSchema>,
): Promise<any> {
  let { policyId } = params;
  const { policyName } = params;
  logger.info(`Executing compound tool: getPolicyAnalysis (id=${policyId}, name=${policyName})`);

  if (!policyId && !policyName) {
    return {
      summary: 'Either policyId or policyName must be provided.',
      data: {},
      suggestedNextActions: ['Use listPolicies to see available policies', 'Use searchPolicies to find a policy by name'],
      metadata: { generatedAt: new Date().toISOString() },
    };
  }

  // Step 1: Resolve policy if name provided
  if (!policyId && policyName) {
    const searchResults = await jamfClient.searchPolicies(policyName, 5);
    if (!searchResults || searchResults.length === 0) {
      return {
        summary: `No policy found matching "${policyName}".`,
        data: { searchResults: [] },
        suggestedNextActions: ['Use listPolicies to see all policies', 'Use searchPolicies with a different query'],
        metadata: { generatedAt: new Date().toISOString() },
      };
    }
    policyId = searchResults[0].id?.toString();
  }

  // Step 2: Parallel fetch policy details and compliance
  const [policyDetails, complianceReport] = await Promise.all([
    jamfClient.getPolicyDetails(policyId!),
    jamfClient.getPolicyComplianceReport(policyId!).catch((e: Error) => ({ error: e.message })),
  ]);

  const name = policyDetails?.general?.name || 'Unknown';
  const enabled = policyDetails?.general?.enabled;
  const frequency = policyDetails?.general?.frequency || 'Unknown';
  const category = policyDetails?.general?.category?.name || 'Uncategorized';
  const scopeAll = policyDetails?.scope?.all_computers;
  const scopeComputers = policyDetails?.scope?.computers?.length || 0;
  const scopeGroups = policyDetails?.scope?.computer_groups?.length || 0;

  const scopeDesc = scopeAll
    ? 'all computers'
    : `${scopeComputers} computers, ${scopeGroups} groups`;

  const summary = `Policy "${name}" (${enabled ? 'enabled' : 'disabled'}): ${frequency} frequency, category: ${category}. Scope: ${scopeDesc}.`;

  return {
    summary,
    data: {
      policy: trimPolicyDetails(policyDetails),
      compliance: complianceReport,
    },
    suggestedNextActions: [
      `Use setPolicyEnabled to ${enabled ? 'disable' : 'enable'} this policy`,
      'Use updatePolicyScope to modify the policy scope',
      'Use clonePolicy to create a copy of this policy',
      'Use executePolicy to manually trigger this policy on specific devices',
    ],
    metadata: {
      policyId,
      generatedAt: new Date().toISOString(),
    },
  };
}
