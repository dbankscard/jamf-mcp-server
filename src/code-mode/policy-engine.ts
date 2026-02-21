/**
 * Policy Engine — Capability gating, call budgets, and approval gates.
 *
 * Every IJamfApiClient method is classified as read/write/command and
 * mapped to a required capability. The proxy in sandbox-runner.ts calls
 * into this engine before forwarding any method call to the real client.
 */

import { MethodClassification } from './types.js';

// ── Method → classification ──────────────────────────────────────────

interface MethodPolicy {
  classification: MethodClassification;
  capability: string;
}

const METHOD_POLICIES: Record<string, MethodPolicy> = {
  // Connection & Auth
  testApiAccess:          { classification: 'read',    capability: 'read:system' },
  keepAlive:              { classification: 'read',    capability: 'read:system' },

  // Computers
  getComputerCount:       { classification: 'read',    capability: 'read:computers' },
  searchComputers:        { classification: 'read',    capability: 'read:computers' },
  getComputerDetails:     { classification: 'read',    capability: 'read:computers' },
  getAllComputers:         { classification: 'read',    capability: 'read:computers' },
  updateInventory:        { classification: 'command',  capability: 'command:computers' },

  // Policies
  listPolicies:           { classification: 'read',    capability: 'read:policies' },
  searchPolicies:         { classification: 'read',    capability: 'read:policies' },
  getPolicyDetails:       { classification: 'read',    capability: 'read:policies' },
  createPolicy:           { classification: 'write',   capability: 'write:policies' },
  updatePolicy:           { classification: 'write',   capability: 'write:policies' },
  clonePolicy:            { classification: 'write',   capability: 'write:policies' },
  setPolicyEnabled:       { classification: 'write',   capability: 'write:policies' },
  updatePolicyScope:      { classification: 'write',   capability: 'write:policies' },
  deletePolicy:           { classification: 'write',   capability: 'write:policies' },
  executePolicy:          { classification: 'command',  capability: 'command:policies' },

  // Scripts
  listScripts:            { classification: 'read',    capability: 'read:scripts' },
  searchScripts:          { classification: 'read',    capability: 'read:scripts' },
  getScriptDetails:       { classification: 'read',    capability: 'read:scripts' },
  createScript:           { classification: 'write',   capability: 'write:scripts' },
  updateScript:           { classification: 'write',   capability: 'write:scripts' },
  deleteScript:           { classification: 'write',   capability: 'write:scripts' },
  deployScript:           { classification: 'command',  capability: 'command:scripts' },

  // Configuration Profiles
  listConfigurationProfiles:        { classification: 'read',    capability: 'read:profiles' },
  getConfigurationProfileDetails:   { classification: 'read',    capability: 'read:profiles' },
  searchConfigurationProfiles:      { classification: 'read',    capability: 'read:profiles' },
  deployConfigurationProfile:       { classification: 'command',  capability: 'command:profiles' },
  removeConfigurationProfile:       { classification: 'command',  capability: 'command:profiles' },
  deleteConfigurationProfile:       { classification: 'write',   capability: 'write:profiles' },

  // Packages
  listPackages:                 { classification: 'read', capability: 'read:packages' },
  getPackageDetails:            { classification: 'read', capability: 'read:packages' },
  searchPackages:               { classification: 'read', capability: 'read:packages' },
  getPackageDeploymentHistory:  { classification: 'read', capability: 'read:packages' },
  getPoliciesUsingPackage:      { classification: 'read', capability: 'read:packages' },

  // Computer Groups
  listComputerGroups:           { classification: 'read',  capability: 'read:groups' },
  getComputerGroupDetails:      { classification: 'read',  capability: 'read:groups' },
  searchComputerGroups:         { classification: 'read',  capability: 'read:groups' },
  getComputerGroupMembers:      { classification: 'read',  capability: 'read:groups' },
  createStaticComputerGroup:    { classification: 'write', capability: 'write:groups' },
  updateStaticComputerGroup:    { classification: 'write', capability: 'write:groups' },
  deleteComputerGroup:          { classification: 'write', capability: 'write:groups' },

  // Mobile Devices
  searchMobileDevices:          { classification: 'read',    capability: 'read:mobile_devices' },
  getMobileDeviceDetails:       { classification: 'read',    capability: 'read:mobile_devices' },
  listMobileDevices:            { classification: 'read',    capability: 'read:mobile_devices' },
  updateMobileDeviceInventory:  { classification: 'command',  capability: 'command:mobile_devices' },
  sendMDMCommand:               { classification: 'command',  capability: 'command:mobile_devices' },

  // Mobile Device Groups
  getMobileDeviceGroups:        { classification: 'read', capability: 'read:mobile_devices' },
  getMobileDeviceGroupDetails:  { classification: 'read', capability: 'read:mobile_devices' },

  // Reports & Analytics
  getInventorySummary:          { classification: 'read', capability: 'read:reports' },
  getPolicyComplianceReport:    { classification: 'read', capability: 'read:reports' },
  getPackageDeploymentStats:    { classification: 'read', capability: 'read:reports' },
  getSoftwareVersionReport:     { classification: 'read', capability: 'read:reports' },
  getDeviceComplianceSummary:   { classification: 'read', capability: 'read:reports' },
  getComplianceReport:          { classification: 'read', capability: 'read:reports' },
  getStorageReport:             { classification: 'read', capability: 'read:reports' },
  getOSVersionReport:           { classification: 'read', capability: 'read:reports' },

  // Advanced Computer Searches
  createAdvancedComputerSearch:         { classification: 'write', capability: 'write:advanced_searches' },
  getAdvancedComputerSearchDetails:     { classification: 'read',  capability: 'read:advanced_searches' },
  deleteAdvancedComputerSearch:         { classification: 'write', capability: 'write:advanced_searches' },
  listAdvancedComputerSearches:         { classification: 'read',  capability: 'read:advanced_searches' },
  ensureComplianceSearch:               { classification: 'read',  capability: 'read:advanced_searches' },

  // Computer History & MDM Commands
  getComputerHistory:           { classification: 'read',    capability: 'read:computers' },
  getComputerPolicyLogs:        { classification: 'read',    capability: 'read:computers' },
  getComputerMDMCommandHistory: { classification: 'read',    capability: 'read:computers' },
  sendComputerMDMCommand:       { classification: 'command',  capability: 'command:mdm' },
  flushMDMCommands:             { classification: 'command',  capability: 'command:mdm' },

  // Infrastructure
  listBuildings:        { classification: 'read', capability: 'read:infrastructure' },
  getBuildingDetails:    { classification: 'read', capability: 'read:infrastructure' },
  listDepartments:      { classification: 'read', capability: 'read:infrastructure' },
  getDepartmentDetails: { classification: 'read', capability: 'read:infrastructure' },
  listCategories:       { classification: 'read', capability: 'read:infrastructure' },
  getCategoryDetails:   { classification: 'read', capability: 'read:infrastructure' },

  // LAPS
  getLocalAdminPassword:        { classification: 'read', capability: 'read:laps' },
  getLocalAdminPasswordAudit:   { classification: 'read', capability: 'read:laps' },
  getLocalAdminPasswordAccounts: { classification: 'read', capability: 'read:laps' },

  // Patch Management
  listPatchSoftwareTitles:      { classification: 'read', capability: 'read:patch' },
  getPatchSoftwareTitleDetails: { classification: 'read', capability: 'read:patch' },
  listPatchPolicies:            { classification: 'read', capability: 'read:patch' },
  getPatchPolicyDashboard:      { classification: 'read', capability: 'read:patch' },

  // Extension Attributes
  listComputerExtensionAttributes:          { classification: 'read',  capability: 'read:extension_attributes' },
  getComputerExtensionAttributeDetails:     { classification: 'read',  capability: 'read:extension_attributes' },
  createComputerExtensionAttribute:         { classification: 'write', capability: 'write:extension_attributes' },
  updateComputerExtensionAttribute:         { classification: 'write', capability: 'write:extension_attributes' },
  deleteComputerExtensionAttribute:         { classification: 'write', capability: 'write:extension_attributes' },

  // Software Update Plans
  listSoftwareUpdatePlans:      { classification: 'read',    capability: 'read:software_updates' },
  createSoftwareUpdatePlan:     { classification: 'command',  capability: 'command:software_updates' },
  getSoftwareUpdatePlanDetails: { classification: 'read',    capability: 'read:software_updates' },

  // Prestages
  listComputerPrestages:        { classification: 'read', capability: 'read:prestages' },
  getComputerPrestageDetails:   { classification: 'read', capability: 'read:prestages' },
  getComputerPrestageScope:     { classification: 'read', capability: 'read:prestages' },
  listMobilePrestages:          { classification: 'read', capability: 'read:prestages' },
  getMobilePrestageDetails:     { classification: 'read', capability: 'read:prestages' },

  // Network Segments
  listNetworkSegments:      { classification: 'read', capability: 'read:network_segments' },
  getNetworkSegmentDetails: { classification: 'read', capability: 'read:network_segments' },

  // Accounts
  listAccounts:         { classification: 'read', capability: 'read:accounts' },
  getAccountDetails:    { classification: 'read', capability: 'read:accounts' },
  getAccountGroupDetails: { classification: 'read', capability: 'read:accounts' },

  // Users
  listUsers:    { classification: 'read', capability: 'read:users' },
  getUserDetails: { classification: 'read', capability: 'read:users' },
  searchUsers:  { classification: 'read', capability: 'read:users' },

  // App Installers
  listAppInstallers:      { classification: 'read', capability: 'read:app_installers' },
  getAppInstallerDetails: { classification: 'read', capability: 'read:app_installers' },

  // Restricted Software
  listRestrictedSoftware:       { classification: 'read',  capability: 'read:restricted_software' },
  getRestrictedSoftwareDetails: { classification: 'read',  capability: 'read:restricted_software' },
  createRestrictedSoftware:     { classification: 'write', capability: 'write:restricted_software' },
  updateRestrictedSoftware:     { classification: 'write', capability: 'write:restricted_software' },
  deleteRestrictedSoftware:     { classification: 'write', capability: 'write:restricted_software' },

  // Webhooks
  listWebhooks:       { classification: 'read', capability: 'read:webhooks' },
  getWebhookDetails:  { classification: 'read', capability: 'read:webhooks' },
};

// ── Public API ───────────────────────────────────────────────────────

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
}

export function getMethodPolicy(method: string): MethodPolicy | undefined {
  return METHOD_POLICIES[method];
}

export function checkAccess(method: string, grantedCapabilities: string[]): AccessCheckResult {
  const policy = METHOD_POLICIES[method];
  if (!policy) {
    return { allowed: false, reason: `Unknown method: ${method}` };
  }
  if (!grantedCapabilities.includes(policy.capability)) {
    return {
      allowed: false,
      reason: `Method "${method}" requires capability "${policy.capability}" which was not granted. Granted: [${grantedCapabilities.join(', ')}]`,
    };
  }
  return { allowed: true };
}

export function getClassification(method: string): MethodClassification | undefined {
  return METHOD_POLICIES[method]?.classification;
}

// ── Call Budget Tracker ──────────────────────────────────────────────

export interface BudgetConfig {
  reads: number;
  writes: number;
  commands: number;
}

const DEFAULT_BUDGETS: BudgetConfig = {
  reads: 100,
  writes: 10,
  commands: 5,
};

export function getBudgetConfig(): BudgetConfig {
  return {
    reads: parseInt(process.env.JAMF_CODE_MODE_READ_BUDGET ?? '', 10) || DEFAULT_BUDGETS.reads,
    writes: parseInt(process.env.JAMF_CODE_MODE_WRITE_BUDGET ?? '', 10) || DEFAULT_BUDGETS.writes,
    commands: parseInt(process.env.JAMF_CODE_MODE_COMMAND_BUDGET ?? '', 10) || DEFAULT_BUDGETS.commands,
  };
}

export class BudgetTracker {
  private counts = { reads: 0, writes: 0, commands: 0 };
  private readonly limits: BudgetConfig;

  constructor(limits?: BudgetConfig) {
    this.limits = limits ?? getBudgetConfig();
  }

  trackCall(method: string): { allowed: boolean; reason?: string } {
    const classification = getClassification(method);
    if (!classification) {
      return { allowed: false, reason: `Unknown method: ${method}` };
    }

    const bucket = classification === 'read' ? 'reads'
      : classification === 'write' ? 'writes'
      : 'commands';

    if (this.counts[bucket] >= this.limits[bucket]) {
      return {
        allowed: false,
        reason: `${classification} budget exhausted (${this.counts[bucket]}/${this.limits[bucket]}). Method: ${method}`,
      };
    }

    this.counts[bucket]++;
    return { allowed: true };
  }

  getCounts() {
    return { ...this.counts };
  }
}

// ── Approval Gate ────────────────────────────────────────────────────

/** Methods that affect many devices or are particularly dangerous. */
const HIGH_IMPACT_METHODS = new Set([
  'executePolicy',
  'deployScript',
  'deployConfigurationProfile',
  'removeConfigurationProfile',
  'sendComputerMDMCommand',
  'sendMDMCommand',
  'flushMDMCommands',
  'createSoftwareUpdatePlan',
]);

export function requiresApproval(method: string): boolean {
  return HIGH_IMPACT_METHODS.has(method);
}

/** All known method names for validation. */
export function getAllMethodNames(): string[] {
  return Object.keys(METHOD_POLICIES);
}
