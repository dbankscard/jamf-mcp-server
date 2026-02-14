/**
 * Tool Implementations
 * Direct tool functions that can be called outside of MCP context
 */

import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import { SearchParams } from '../types/common.js';

// Helper function to parse Jamf dates
const parseJamfDate = (date: string | Date | undefined): Date => {
  if (!date) return new Date(0);
  if (date instanceof Date) return date;
  return new Date(date);
};

export interface DeviceSearchParams extends SearchParams {
  query: string;
  limit?: number;
}

export async function searchDevices(client: JamfApiClientHybrid, params: DeviceSearchParams) {
  const { query, limit = 50 } = params;
  const devices = await client.searchComputers(query);
  
  return {
    devices: devices.slice(0, limit),
    total: devices.length,
    query
  };
}

export interface ComplianceCheckParams {
  days: number;
  includeDetails?: boolean;
  deviceId?: string;
}

export async function checkDeviceCompliance(client: JamfApiClientHybrid, params: ComplianceCheckParams) {
  const { days, includeDetails = false } = params;
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

export async function updateInventory(client: JamfApiClientHybrid, params: any) {
  const { deviceId } = params;
  
  if ((client as any).readOnlyMode) {
    throw new Error('Cannot update inventory in read-only mode');
  }
  
  await client.updateInventory(deviceId);
  
  return {
    success: true,
    deviceId,
    message: 'Inventory update command sent successfully'
  };
}

export interface DeviceDetailsParams {
  deviceId: string;
}

export async function getDeviceDetails(client: JamfApiClientHybrid, params: DeviceDetailsParams) {
  const { deviceId } = params;
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

export async function executePolicy(client: JamfApiClientHybrid, params: any) {
  const { policyId, deviceIds, confirm = false } = params;
  
  if (!confirm) {
    throw new Error('Policy execution requires confirmation. Set confirm: true to proceed.');
  }
  
  if ((client as any).readOnlyMode) {
    throw new Error('Cannot execute policies in read-only mode');
  }
  
  const results = [];
  for (const deviceId of deviceIds) {
    try {
      await client.executePolicy(policyId, deviceId);
      results.push({ deviceId, status: 'success' });
    } catch (error: any) {
      results.push({ deviceId, status: 'failed', error: error.message });
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

export async function searchPolicies(client: JamfApiClientHybrid, params: any) {
  const { query, limit = 50 } = params;
  const policies = await client.searchPolicies(query);
  
  return {
    policies: policies.slice(0, limit).map((p: any) => ({
      id: p.id,
      name: p.name,
      enabled: p.general?.enabled,
      category: p.general?.category?.name || 'Uncategorized',
      scope: {
        allComputers: p.scope?.all_computers,
        computerGroups: p.scope?.computer_groups?.length || 0,
        computers: p.scope?.computers?.length || 0
      }
    })),
    total: policies.length
  };
}

export async function getPolicyDetails(client: JamfApiClientHybrid, params: any) {
  const { policyId, includeScriptContent: _includeScriptContent = false } = params;
  const policy = await client.getPolicyDetails(policyId);
  
  const result: any = {
    policy: {
      general: policy.policy?.general,
      scope: policy.policy?.scope,
      selfService: policy.policy?.self_service,
      packages: policy.policy?.package_configuration?.packages,
      scripts: policy.policy?.scripts?.map((s: any) => ({
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

export async function searchConfigurationProfiles(client: JamfApiClientHybrid, params: any) {
  const { query, type = 'computer' } = params;
  
  const profiles = await client.searchConfigurationProfiles(query, type);
  
  if (type === 'computer') {
    return {
      profiles: profiles.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.general?.description,
        level: p.general?.level,
        distribution_method: p.general?.distribution_method,
        payloads: p.general?.payloads?.length || 0
      })),
      type
    };
  } else {
    return {
      profiles: profiles.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.general?.description,
        level: p.general?.level,
        payloads: p.general?.payloads?.split(',').length || 0
      })),
      type
    };
  }
}