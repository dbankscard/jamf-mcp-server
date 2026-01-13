/**
 * Tool Implementations
 * Direct tool functions that can be called outside of MCP context
 * All parameters are validated using Zod schemas before processing
 */

import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import { JamfPolicy } from '../types/jamf-api.js';
import {
  validateParams,
  DeviceSearchParamsSchema,
  DeviceDetailsParamsSchema,
  UpdateInventoryParamsSchema,
  ComplianceCheckParamsSchema,
  ExecutePolicyParamsSchema,
  SearchPoliciesParamsSchema,
  PolicyDetailsParamsSchema,
  SearchConfigProfilesParamsSchema,
  DeviceSearchParams,
  DeviceDetailsParams,
  UpdateInventoryParams,
  ComplianceCheckParams,
  ExecutePolicyParams,
  SearchPoliciesParams,
  PolicyDetailsParams,
  SearchConfigProfilesParams,
} from './validation-schemas.js';

// Re-export validation types for external use
export type {
  DeviceSearchParams,
  DeviceDetailsParams,
  UpdateInventoryParams,
  ComplianceCheckParams,
  ExecutePolicyParams,
  SearchPoliciesParams,
  PolicyDetailsParams,
  SearchConfigProfilesParams,
} from './validation-schemas.js';

// Re-export validation utilities
export { ToolValidationError, validateParams } from './validation-schemas.js';

// Helper function to parse Jamf dates
const parseJamfDate = (date: string | Date | undefined): Date => {
  if (!date) return new Date(0);
  if (date instanceof Date) return date;
  return new Date(date);
};

export interface ExecutionResult {
  deviceId: string;
  status: string;
  error?: string;
}

/**
 * Search for devices by name, serial number, IP address, username, etc.
 */
export async function searchDevices(client: JamfApiClientHybrid, params: unknown) {
  const validated = validateParams(DeviceSearchParamsSchema, params);
  const { query, limit } = validated;

  const devices = await client.searchComputers(query);

  return {
    devices: devices.slice(0, limit),
    total: devices.length,
    query
  };
}

/**
 * Get detailed information about a specific device
 */
export async function getDeviceDetails(client: JamfApiClientHybrid, params: unknown) {
  const validated = validateParams(DeviceDetailsParamsSchema, params);
  const { deviceId } = validated;

  const device = await client.getComputerDetails(deviceId);

  return {
    device: {
      general: device.general || device.computer?.general,
      hardware: device.hardware || device.computer?.hardware,
      operatingSystem: device.operatingSystem || device.computer?.operatingSystem,
      userAndLocation: device.userAndLocation || device.computer?.userAndLocation,
      configurationProfiles: device.configurationProfiles || device.computer?.configurationProfiles,
      applications: device.applications || device.computer?.applications?.applications?.slice(0, 10)
    }
  };
}

/**
 * Trigger an inventory update for a device
 */
export async function updateInventory(client: JamfApiClientHybrid, params: unknown) {
  const validated = validateParams(UpdateInventoryParamsSchema, params);
  const { deviceId } = validated;

  if (client.readOnlyMode) {
    throw new Error('Cannot update inventory in read-only mode');
  }

  await client.updateInventory(deviceId);

  return {
    success: true,
    deviceId,
    message: 'Inventory update command sent successfully'
  };
}

/**
 * Check device compliance based on last contact time
 */
export async function checkDeviceCompliance(client: JamfApiClientHybrid, params: unknown) {
  const validated = validateParams(ComplianceCheckParamsSchema, params);
  // days and includeDetails always have values due to schema defaults
  const days = validated.days ?? 30;
  const includeDetails = validated.includeDetails ?? false;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const allDevices = await client.searchComputers('');
  const compliantDevices = [];
  const nonCompliantDevices = [];

  for (const device of allDevices) {
    const lastContact = parseJamfDate(device.lastContactTime);
    if (lastContact >= cutoffDate) {
      compliantDevices.push(device);
    } else {
      nonCompliantDevices.push(device);
    }
  }

  return {
    totalDevices: allDevices.length,
    compliant: compliantDevices.length,
    nonCompliant: nonCompliantDevices.length,
    complianceRate: allDevices.length > 0
      ? ((compliantDevices.length / allDevices.length) * 100).toFixed(2) + '%'
      : '0%',
    devices: includeDetails ? nonCompliantDevices.map(d => ({
      id: d.id,
      name: d.name,
      serialNumber: d.serialNumber,
      lastContactTime: d.lastContactTime,
      daysSinceContact: Math.floor((Date.now() - parseJamfDate(d.lastContactTime).getTime()) / (1000 * 60 * 60 * 24))
    })) : undefined
  };
}

/**
 * Execute a policy on one or more devices
 */
export async function executePolicy(client: JamfApiClientHybrid, params: unknown) {
  const validated = validateParams(ExecutePolicyParamsSchema, params);
  const { policyId, deviceIds, confirm } = validated;

  if (!confirm) {
    throw new Error('Policy execution requires confirmation. Set confirm: true to proceed.');
  }

  if (client.readOnlyMode) {
    throw new Error('Cannot execute policies in read-only mode');
  }

  const results: ExecutionResult[] = [];
  for (const deviceId of deviceIds) {
    try {
      await client.executePolicy(policyId, [deviceId]);
      results.push({ deviceId, status: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ deviceId, status: 'failed', error: message });
    }
  }

  return {
    policyId,
    executionResults: results,
    summary: {
      total: deviceIds.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length
    }
  };
}

interface PolicyGeneral {
  enabled?: boolean;
  category?: {
    name?: string;
  };
}

/**
 * Search for policies by name or description
 */
export async function searchPolicies(client: JamfApiClientHybrid, params: unknown) {
  const validated = validateParams(SearchPoliciesParamsSchema, params);
  const { query, limit } = validated;

  const policies = await client.searchPolicies(query);

  return {
    policies: policies.slice(0, limit).map((p: JamfPolicy) => {
      const general = p.general as PolicyGeneral | undefined;
      return {
        id: p.id,
        name: p.name,
        enabled: general?.enabled ?? p.enabled,
        category: general?.category?.name || p.category || 'Uncategorized',
        scope: {
          allComputers: p.scope?.all_computers,
          computerGroups: p.scope?.computer_group_ids?.length || 0,
          computers: p.scope?.computer_ids?.length || 0
        }
      };
    }),
    total: policies.length
  };
}

interface PolicyScript {
  id: string | number;
  name: string;
  priority?: string | number;
  parameter4?: string;
  parameter5?: string;
  parameter6?: string;
  parameter7?: string;
  parameter8?: string;
  parameter9?: string;
  parameter10?: string;
  parameter11?: string;
}

interface PolicyDetailsResult {
  policy: {
    general?: unknown;
    scope?: unknown;
    selfService?: unknown;
    packages?: unknown;
    scripts?: Array<{
      id: string | number;
      name: string;
      priority?: string | number;
      parameter4?: string;
      parameter5?: string;
      parameter6?: string;
      parameter7?: string;
      parameter8?: string;
      parameter9?: string;
      parameter10?: string;
      parameter11?: string;
    }>;
  };
}

/**
 * Get detailed information about a specific policy
 */
export async function getPolicyDetails(client: JamfApiClientHybrid, params: unknown): Promise<PolicyDetailsResult> {
  const validated = validateParams(PolicyDetailsParamsSchema, params);
  const { policyId } = validated;

  const policy = await client.getPolicyDetails(policyId);

  const result: PolicyDetailsResult = {
    policy: {
      general: policy.policy?.general,
      scope: policy.policy?.scope,
      selfService: policy.policy?.self_service,
      packages: policy.policy?.package_configuration?.packages,
      scripts: policy.policy?.scripts?.map((s: PolicyScript) => ({
        id: s.id,
        name: s.name,
        priority: s.priority,
        parameter4: s.parameter4,
        parameter5: s.parameter5,
        parameter6: s.parameter6,
        parameter7: s.parameter7,
        parameter8: s.parameter8,
        parameter9: s.parameter9,
        parameter10: s.parameter10,
        parameter11: s.parameter11
      }))
    }
  };

  return result;
}

interface ComputerConfigProfile {
  id: string | number;
  name: string;
  general?: {
    description?: string;
    level?: string;
    distribution_method?: string;
    payloads?: unknown[] | string;
  };
}

interface MobileConfigProfile {
  id: string | number;
  name: string;
  general?: {
    description?: string;
    level?: string;
    payloads?: string;
  };
}

/**
 * Search for configuration profiles by name
 */
export async function searchConfigurationProfiles(client: JamfApiClientHybrid, params: unknown) {
  const validated = validateParams(SearchConfigProfilesParamsSchema, params);
  const { query, type } = validated;

  const profiles = await client.searchConfigurationProfiles(query, type);

  if (type === 'computer') {
    return {
      profiles: profiles.map((p: ComputerConfigProfile) => ({
        id: p.id,
        name: p.name,
        description: p.general?.description,
        level: p.general?.level,
        distribution_method: p.general?.distribution_method,
        payloads: Array.isArray(p.general?.payloads) ? p.general?.payloads.length : 0
      })),
      type
    };
  } else {
    return {
      profiles: profiles.map((p: MobileConfigProfile) => ({
        id: p.id,
        name: p.name,
        description: p.general?.description,
        level: p.general?.level,
        payloads: typeof p.general?.payloads === 'string' ? p.general?.payloads.split(',').length : 0
      })),
      type
    };
  }
}
