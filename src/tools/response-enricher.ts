/**
 * Response Enricher
 *
 * Wraps tool responses with human-readable summaries, suggested next actions,
 * and metadata. The raw data stays in the `data` field so nothing breaks.
 *
 * Also provides response truncation to stay under Claude Desktop's 1MB limit.
 */

// 800KB limit — well under the 1MB MCP maximum to leave headroom for framing
const MAX_RESPONSE_BYTES = 800 * 1024;

interface EnrichedResponse {
  summary: string;
  data: any;
  suggestedNextActions: string[];
  metadata: {
    toolName: string;
    resultCount?: number;
    generatedAt: string;
  };
}

/**
 * Ensure a tool response string stays under the MCP size limit.
 * Tries progressively more aggressive truncation strategies:
 * 1. If under limit, return as-is
 * 2. Try to parse as JSON and truncate arrays in `data` / top-level arrays
 * 3. Hard-truncate with a warning message
 */
export function truncateToolResponse(text: string): string {
  if (Buffer.byteLength(text, 'utf8') <= MAX_RESPONSE_BYTES) {
    return text;
  }

  // Try smart truncation on JSON
  try {
    const parsed = JSON.parse(text);
    const truncated = smartTruncate(parsed, MAX_RESPONSE_BYTES);
    const result = JSON.stringify(truncated, null, 2);
    if (Buffer.byteLength(result, 'utf8') <= MAX_RESPONSE_BYTES) {
      return result;
    }
  } catch {
    // Not valid JSON — fall through to hard truncation
  }

  // Hard truncation as last resort
  const limit = MAX_RESPONSE_BYTES - 200; // room for warning message
  let truncated = text;
  while (Buffer.byteLength(truncated, 'utf8') > limit) {
    // Cut roughly in half each iteration, then try a finer cut
    truncated = truncated.slice(0, Math.floor(truncated.length * 0.8));
  }
  return truncated + '\n\n[TRUNCATED — Response exceeded 800KB. Use more specific queries or add filters to reduce result size.]';
}

/**
 * Intelligently truncate a parsed JSON object to fit within a byte budget.
 */
function smartTruncate(obj: any, maxBytes: number): any {
  // If it has a summary + data structure (enriched response), truncate data
  if (obj && typeof obj === 'object' && obj.summary && obj.data) {
    const truncatedData = truncateDataField(obj.data, maxBytes);
    return {
      summary: obj.summary,
      data: truncatedData,
      suggestedNextActions: obj.suggestedNextActions,
      metadata: {
        ...obj.metadata,
        truncated: true,
        truncationNote: 'Response was too large. Data has been reduced. Use more specific queries for full details.',
      },
    };
  }

  // If it has array fields, truncate the largest ones
  if (obj && typeof obj === 'object') {
    return truncateDataField(obj, maxBytes);
  }

  return obj;
}

/**
 * Truncate arrays within a data object to fit within budget.
 */
function truncateDataField(data: any, maxBytes: number): any {
  if (!data || typeof data !== 'object') return data;

  // Clone to avoid mutating
  const clone = Array.isArray(data) ? [...data] : { ...data };

  // Find and truncate arrays (largest first)
  const arrayFields: { key: string; length: number }[] = [];

  if (Array.isArray(clone)) {
    // Top-level array
    const targetLength = findArrayLimit(clone, maxBytes);
    const truncated = clone.slice(0, targetLength);
    (truncated as any).truncatedFrom = clone.length;
    return {
      items: truncated,
      totalCount: clone.length,
      returnedCount: targetLength,
      truncated: true,
      note: `Showing ${targetLength} of ${clone.length} items. Use filters or smaller limits to get specific results.`,
    };
  }

  for (const [key, value] of Object.entries(clone)) {
    if (Array.isArray(value)) {
      arrayFields.push({ key, length: value.length });
    } else if (value && typeof value === 'object') {
      // Check nested objects for arrays too
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, any>)) {
        if (Array.isArray(nestedValue)) {
          arrayFields.push({ key: `${key}.${nestedKey}`, length: nestedValue.length });
        }
      }
    }
  }

  // Sort by size descending — truncate largest arrays first
  arrayFields.sort((a, b) => b.length - a.length);

  for (const field of arrayFields) {
    const currentSize = Buffer.byteLength(JSON.stringify(clone, null, 2), 'utf8');
    if (currentSize <= maxBytes) break;

    const parts = field.key.split('.');
    if (parts.length === 1) {
      const arr = clone[parts[0]];
      if (Array.isArray(arr)) {
        const limit = findArrayLimit(arr, Math.floor(maxBytes * 0.6));
        clone[parts[0]] = arr.slice(0, limit);
        clone[`${parts[0]}_truncated`] = {
          showing: limit,
          total: arr.length,
          note: 'Array truncated to fit response size limit.',
        };
      }
    } else if (parts.length === 2) {
      const parent = clone[parts[0]];
      if (parent && typeof parent === 'object') {
        const arr = parent[parts[1]];
        if (Array.isArray(arr)) {
          const limit = findArrayLimit(arr, Math.floor(maxBytes * 0.4));
          parent[parts[1]] = arr.slice(0, limit);
          parent[`${parts[1]}_truncated`] = {
            showing: limit,
            total: arr.length,
            note: 'Array truncated to fit response size limit.',
          };
        }
      }
    }
  }

  return clone;
}

/**
 * Binary search for the max number of array items that fits in a byte budget.
 */
function findArrayLimit(arr: any[], maxBytes: number): number {
  if (arr.length === 0) return 0;

  let low = 1;
  let high = arr.length;
  let best = Math.min(10, arr.length); // Default fallback

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const size = Buffer.byteLength(JSON.stringify(arr.slice(0, mid)), 'utf8');
    if (size <= maxBytes) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

/**
 * Enrich a tool response with summary, suggested actions, and metadata.
 * Returns the original data unchanged for tools without enrichment rules.
 */
export function enrichResponse(toolName: string, rawData: any): string {
  const enrichment = getEnrichment(toolName, rawData);
  if (!enrichment) {
    // No enrichment rule — return raw data as-is
    return typeof rawData === 'string' ? rawData : JSON.stringify(rawData, null, 2);
  }

  const enriched: EnrichedResponse = {
    summary: enrichment.summary,
    data: rawData,
    suggestedNextActions: enrichment.suggestedNextActions,
    metadata: {
      toolName,
      resultCount: enrichment.resultCount,
      generatedAt: new Date().toISOString(),
    },
  };

  return JSON.stringify(enriched, null, 2);
}

interface Enrichment {
  summary: string;
  suggestedNextActions: string[];
  resultCount?: number;
}

function getEnrichment(toolName: string, data: any): Enrichment | null {
  try {
    switch (toolName) {
      case 'searchDevices': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.count ?? parsed?.devices?.length ?? 0;
        const topDevices = (parsed?.devices || []).slice(0, 3).map((d: any) => d.name).filter(Boolean);
        const topStr = topDevices.length > 0 ? ` Top results: ${topDevices.join(', ')}.` : '';
        return {
          summary: `Found ${count} device${count !== 1 ? 's' : ''}.${topStr}`,
          suggestedNextActions: [
            'Use getDeviceDetails for full info on a specific device',
            'Use getDeviceFullProfile for a comprehensive device report',
            'Use getDevicesBatch to fetch details for multiple devices at once',
          ],
          resultCount: count,
        };
      }

      case 'listPolicies': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const total = parsed?.totalPolicies ?? parsed?.policies?.length ?? 0;
        const policies = parsed?.policies || [];
        const enabled = policies.filter((p: any) => p.enabled !== false).length;
        const disabled = total - enabled;
        return {
          summary: `${total} policies found${disabled > 0 ? ` (${enabled} enabled, ${disabled} disabled)` : ''}.`,
          suggestedNextActions: [
            'Use getPolicyDetails for a specific policy configuration',
            'Use getPolicyAnalysis for policy performance analysis',
            'Use searchPolicies to find policies by name',
          ],
          resultCount: total,
        };
      }

      case 'getDeviceDetails': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const name = parsed?.name || parsed?.general?.name || 'Unknown';
        const model = parsed?.hardware?.model || 'Unknown model';
        const osVersion = parsed?.hardware?.osVersion || parsed?.hardware?.os_version || 'Unknown OS';
        const serialNumber = parsed?.general?.serialNumber || parsed?.general?.serial_number || '';
        return {
          summary: `${name}: ${model}, ${osVersion}${serialNumber ? ` (S/N: ${serialNumber})` : ''}.`,
          suggestedNextActions: [
            'Use getComputerHistory for device event timeline',
            'Use getComputerPolicyLogs for policy execution history',
            'Use sendComputerMDMCommand to send MDM commands',
            'Use getComputerMDMCommandHistory for MDM command status',
          ],
        };
      }

      case 'checkDeviceCompliance': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const rate = parsed?.complianceRate || 'unknown';
        const nonCompliant = parsed?.nonCompliant || parsed?.notReporting || 0;
        const total = parsed?.totalDevices || 0;
        return {
          summary: `${rate} compliant. ${nonCompliant} device${nonCompliant !== 1 ? 's' : ''} non-compliant out of ${total} total.`,
          suggestedNextActions: [
            nonCompliant > 0 ? 'Use getDeviceDetails on non-compliant devices to investigate' : 'Fleet is fully compliant',
            'Use getSecurityPosture for encryption and security analysis',
            'Read jamf://reports/compliance resource for detailed compliance report',
          ],
          resultCount: total,
        };
      }

      case 'getInventorySummary': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const computers = parsed?.summary?.totalComputers ?? parsed?.computers?.total ?? 'unknown';
        const mobile = parsed?.summary?.totalMobileDevices ?? parsed?.mobileDevices?.total ?? 'unknown';
        return {
          summary: `Inventory: ${computers} computers, ${mobile} mobile devices.`,
          suggestedNextActions: [
            'Use getFleetOverview for a comprehensive fleet summary',
            'Use searchDevices to find specific devices',
            'Use getSecurityPosture for security analysis',
          ],
        };
      }

      case 'getDeviceComplianceSummary': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const rate = parsed?.summary?.complianceRate || 'unknown';
        const total = parsed?.summary?.totalDevices || 0;
        const nonCompliant = parsed?.summary?.nonCompliantDevices || 0;
        return {
          summary: `Compliance rate: ${rate}%. ${nonCompliant} non-compliant out of ${total} devices.`,
          suggestedNextActions: [
            'Use checkDeviceCompliance with includeDetails=true for device-level breakdown',
            'Use getDeviceDetails on non-compliant devices',
            'Use getSecurityPosture for full security analysis',
          ],
          resultCount: total,
        };
      }

      case 'listScripts': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.totalScripts ?? (Array.isArray(parsed?.scripts) ? parsed.scripts.length : 0);
        return {
          summary: `${count} scripts found.`,
          suggestedNextActions: [
            'Use getScriptDetails for script content and parameters',
            'Use searchScripts to find scripts by name',
            'Use deployScript to execute a script on devices',
          ],
          resultCount: count,
        };
      }

      case 'listConfigurationProfiles': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.totalProfiles ?? (Array.isArray(parsed?.profiles) ? parsed.profiles.length : 0);
        return {
          summary: `${count} configuration profiles found.`,
          suggestedNextActions: [
            'Use getConfigurationProfileDetails for profile payload details',
            'Use searchConfigurationProfiles to find profiles by name',
            'Use deployConfigurationProfile to deploy to devices',
          ],
          resultCount: count,
        };
      }

      case 'searchMobileDevices': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.count ?? (Array.isArray(parsed?.devices) ? parsed.devices.length : 0);
        const topDevices = (parsed?.devices || []).slice(0, 3).map((d: any) => d.name).filter(Boolean);
        const topStr = topDevices.length > 0 ? ` Top results: ${topDevices.join(', ')}.` : '';
        return {
          summary: `Found ${count} mobile device${count !== 1 ? 's' : ''}.${topStr}`,
          suggestedNextActions: [
            'Use getMobileDeviceDetails for full device info',
            'Use sendMDMCommand to send commands to a mobile device',
          ],
          resultCount: count,
        };
      }

      case 'listComputerGroups': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const groups = parsed?.groups || parsed?.computerGroups || [];
        const count = Array.isArray(groups) ? groups.length : 0;
        return {
          summary: `${count} computer groups found.`,
          suggestedNextActions: [
            'Use getComputerGroupDetails for group criteria and membership',
            'Use getComputerGroupMembers for full member list',
            'Use searchComputerGroups to find groups by name',
          ],
          resultCount: count,
        };
      }

      // --- Policy tools ---

      case 'getPolicyDetails': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const name = parsed?.general?.name || parsed?.name || 'Unknown';
        const enabled = parsed?.general?.enabled ?? parsed?.enabled;
        const trigger = parsed?.general?.trigger || parsed?.trigger || '';
        const frequency = parsed?.general?.frequency || parsed?.frequency || '';
        const statusStr = enabled === false ? ' (DISABLED)' : enabled === true ? ' (enabled)' : '';
        const triggerStr = trigger ? `, trigger: ${trigger}` : '';
        const freqStr = frequency ? `, frequency: ${frequency}` : '';
        return {
          summary: `Policy "${name}"${statusStr}${triggerStr}${freqStr}.`,
          suggestedNextActions: [
            'Use executePolicy to run this policy on specific devices',
            'Use updatePolicy to modify this policy',
            'Use deletePolicy to remove this policy',
            'Use getPolicyAnalysis for performance analysis',
          ],
        };
      }

      case 'searchPolicies': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.totalResults ?? parsed?.policies?.length ?? 0;
        const query = parsed?.query || '';
        return {
          summary: `Found ${count} polic${count !== 1 ? 'ies' : 'y'} matching "${query}".`,
          suggestedNextActions: [
            'Use getPolicyDetails for full policy configuration',
            'Use listPolicies to see all policies',
            'Use getPolicyAnalysis for policy performance analysis',
          ],
          resultCount: count,
        };
      }

      case 'createPolicy': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const id = parsed?.policy?.id || parsed?.id || 'unknown';
        const name = parsed?.policy?.name || parsed?.name || 'unnamed';
        return {
          summary: `Policy "${name}" created successfully (ID: ${id}).`,
          suggestedNextActions: [
            'Use getPolicyDetails to verify the policy configuration',
            'Use executePolicy to run the policy on devices',
            'Use listPolicies to see all policies',
          ],
        };
      }

      // --- Script tools ---

      case 'getScriptDetails': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const name = parsed?.name || 'Unknown';
        const category = parsed?.category || parsed?.categoryName || '';
        const catStr = category ? ` (category: ${category})` : '';
        return {
          summary: `Script "${name}"${catStr}.`,
          suggestedNextActions: [
            'Use deployScript to deploy this script to devices',
            'Use updateScript to modify this script',
            'Use deleteScript to remove this script',
          ],
        };
      }

      case 'searchScripts': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.totalResults ?? parsed?.scripts?.length ?? 0;
        const query = parsed?.query || '';
        return {
          summary: `Found ${count} script${count !== 1 ? 's' : ''} matching "${query}".`,
          suggestedNextActions: [
            'Use getScriptDetails for full script content and parameters',
            'Use listScripts to see all scripts',
          ],
          resultCount: count,
        };
      }

      case 'createScript': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const id = parsed?.script?.id || parsed?.id || 'unknown';
        const name = parsed?.script?.name || parsed?.name || 'unnamed';
        return {
          summary: `Script "${name}" created successfully (ID: ${id}).`,
          suggestedNextActions: [
            'Use getScriptDetails to verify the script',
            'Use deployScript to deploy to devices',
            'Use listScripts to see all scripts',
          ],
        };
      }

      // --- Group tools ---

      case 'getComputerGroupDetails': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const name = parsed?.name || 'Unknown';
        const isSmart = parsed?.isSmart ?? parsed?.is_smart;
        const memberCount = parsed?.memberCount ?? parsed?.computers?.length ?? 0;
        const typeStr = isSmart === true ? 'Smart' : isSmart === false ? 'Static' : '';
        return {
          summary: `${typeStr} group "${name}" with ${memberCount} member${memberCount !== 1 ? 's' : ''}.`,
          suggestedNextActions: [
            'Use getComputerGroupMembers for full member list with details',
            'Use searchDevices to find devices matching criteria',
            isSmart ? 'Use updateComputerGroup to modify group criteria' : 'Use updateStaticComputerGroup to modify membership',
          ],
        };
      }

      case 'getComputerGroupMembers': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.count ?? parsed?.members?.length ?? 0;
        return {
          summary: `Group has ${count} member${count !== 1 ? 's' : ''}.`,
          suggestedNextActions: [
            'Use getDeviceDetails for full info on a specific member',
            'Use sendComputerMDMCommand to send commands to a member',
            'Use getComputerGroupDetails for group criteria',
          ],
          resultCount: count,
        };
      }

      case 'searchComputerGroups': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.totalResults ?? parsed?.groups?.length ?? 0;
        const query = parsed?.query || '';
        return {
          summary: `Found ${count} group${count !== 1 ? 's' : ''} matching "${query}".`,
          suggestedNextActions: [
            'Use getComputerGroupDetails for group criteria and membership',
            'Use getComputerGroupMembers for full member list',
          ],
          resultCount: count,
        };
      }

      // --- MDM command tools ---

      case 'sendMDMCommand': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const msg = typeof parsed === 'string' ? parsed : (parsed?.message || `MDM command sent`);
        return {
          summary: msg,
          suggestedNextActions: [
            'Use getMobileDeviceDetails to verify device state after command',
            'Use searchMobileDevices to find other devices',
          ],
        };
      }

      case 'sendComputerMDMCommand': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const msg = parsed?.message || 'Computer MDM command sent';
        return {
          summary: msg,
          suggestedNextActions: [
            'Use getComputerMDMCommandHistory to check command status',
            'Use getDeviceDetails to verify device state after command',
            'Use getComputerHistory for full device event timeline',
          ],
        };
      }

      case 'flushMDMCommands': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const msg = parsed?.message || 'MDM commands flushed';
        return {
          summary: msg,
          suggestedNextActions: [
            'Use getComputerMDMCommandHistory to verify commands were flushed',
            'Use sendComputerMDMCommand to send new commands',
          ],
        };
      }

      // --- Mobile device tools ---

      case 'getMobileDeviceDetails': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const name = parsed?.name || 'Unknown';
        const model = parsed?.modelDisplay || parsed?.model || 'Unknown model';
        const osVersion = parsed?.osVersion || '';
        const serial = parsed?.serialNumber || '';
        const osStr = osVersion ? `, ${osVersion}` : '';
        const serialStr = serial ? ` (S/N: ${serial})` : '';
        return {
          summary: `${name}: ${model}${osStr}${serialStr}.`,
          suggestedNextActions: [
            'Use sendMDMCommand to send commands to this device',
            'Use searchMobileDevices to find other mobile devices',
            'Use listMobileDeviceGroups to see group membership',
          ],
        };
      }

      case 'listMobileDeviceGroups': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.count ?? parsed?.groups?.length ?? 0;
        return {
          summary: `${count} mobile device group${count !== 1 ? 's' : ''} found.`,
          suggestedNextActions: [
            'Use getMobileDeviceGroupDetails for group criteria and membership',
            'Use searchMobileDevices to find specific mobile devices',
          ],
          resultCount: count,
        };
      }

      // --- Package tools ---

      case 'listPackages': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.count ?? parsed?.packages?.length ?? 0;
        return {
          summary: `${count} package${count !== 1 ? 's' : ''} found.`,
          suggestedNextActions: [
            'Use searchPackages to find packages by name',
            'Use getPackageDetails for full package info',
            'Use getPackageDeploymentStats for deployment analytics',
          ],
          resultCount: count,
        };
      }

      case 'searchPackages': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.totalResults ?? parsed?.packages?.length ?? 0;
        const query = parsed?.query || '';
        return {
          summary: `Found ${count} package${count !== 1 ? 's' : ''} matching "${query}".`,
          suggestedNextActions: [
            'Use getPackageDetails for full package info',
            'Use listPackages to see all packages',
          ],
          resultCount: count,
        };
      }

      // --- Reporting / analytics tools ---

      case 'getFleetOverview': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const computers = parsed?.computers?.total ?? parsed?.totalComputers ?? '?';
        const mobile = parsed?.mobileDevices?.total ?? parsed?.totalMobileDevices ?? '?';
        return {
          summary: `Fleet overview: ${computers} computers, ${mobile} mobile devices.`,
          suggestedNextActions: [
            'Use getSecurityPosture for security analysis',
            'Use checkDeviceCompliance for compliance details',
            'Use searchDevices to drill into specific devices',
          ],
        };
      }

      case 'getSecurityPosture': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const encryption = parsed?.encryption?.rate || parsed?.encryptionRate || '?';
        const firewall = parsed?.firewall?.rate || parsed?.firewallRate || '?';
        return {
          summary: `Security posture: encryption ${encryption}, firewall ${firewall}.`,
          suggestedNextActions: [
            'Use getDeviceDetails on non-compliant devices to investigate',
            'Use checkDeviceCompliance for compliance breakdown',
            'Use getFleetOverview for full fleet summary',
          ],
        };
      }

      case 'getPolicyAnalysis': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const total = parsed?.totalPolicies ?? parsed?.analyzed ?? '?';
        return {
          summary: `Policy analysis: ${total} policies analyzed.`,
          suggestedNextActions: [
            'Use getPolicyDetails for specific policy configuration',
            'Use listPolicies to see all policies',
            'Use searchPolicies to find policies by name',
          ],
        };
      }

      // --- History tools ---

      case 'getComputerHistory': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        return {
          summary: 'Computer history retrieved.',
          suggestedNextActions: [
            'Use getComputerPolicyLogs for policy-specific execution history',
            'Use getComputerMDMCommandHistory for MDM command history',
            'Use getDeviceDetails for current device state',
          ],
        };
      }

      case 'getComputerPolicyLogs': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = Array.isArray(parsed) ? parsed.length : (parsed?.logs?.length ?? '?');
        return {
          summary: `${count} policy log entries retrieved.`,
          suggestedNextActions: [
            'Use getPolicyDetails to view the policy configuration',
            'Use getComputerHistory for full device event timeline',
            'Use getDeviceDetails for current device state',
          ],
          resultCount: typeof count === 'number' ? count : undefined,
        };
      }

      case 'getComputerMDMCommandHistory': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = Array.isArray(parsed) ? parsed.length : (parsed?.commands?.length ?? '?');
        return {
          summary: `${count} MDM command history entries retrieved.`,
          suggestedNextActions: [
            'Use sendComputerMDMCommand to send new commands',
            'Use flushMDMCommands to clear pending commands',
            'Use getDeviceDetails for current device state',
          ],
          resultCount: typeof count === 'number' ? count : undefined,
        };
      }

      // --- Configuration profile tools ---

      case 'getConfigurationProfileDetails': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const name = parsed?.general?.name || parsed?.name || 'Unknown';
        const level = parsed?.general?.level || parsed?.level || '';
        const levelStr = level ? ` (level: ${level})` : '';
        return {
          summary: `Configuration profile "${name}"${levelStr}.`,
          suggestedNextActions: [
            'Use deleteConfigurationProfile to remove this profile',
            'Use listConfigurationProfiles to see all profiles',
            'Use searchConfigurationProfiles to find profiles by name',
          ],
        };
      }

      case 'searchConfigurationProfiles': {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const count = parsed?.count ?? parsed?.profiles?.length ?? 0;
        const query = parsed?.query || '';
        return {
          summary: `Found ${count} configuration profile${count !== 1 ? 's' : ''} matching "${query}".`,
          suggestedNextActions: [
            'Use getConfigurationProfileDetails for profile payload details',
            'Use listConfigurationProfiles to see all profiles',
          ],
          resultCount: count,
        };
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}
