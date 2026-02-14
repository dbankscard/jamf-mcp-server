/**
 * Public interface for the Jamf API Client.
 * Enables type-safe tool registration, mockability for testing,
 * and clear API contract documentation.
 */

import { Computer } from '../jamf-client-hybrid.js';

// Reusable inline types for complex method parameters
export interface ScriptData {
  name: string;
  script_contents: string;
  category?: string;
  info?: string;
  notes?: string;
  priority?: string;
  parameters?: {
    parameter4?: string;
    parameter5?: string;
    parameter6?: string;
    parameter7?: string;
    parameter8?: string;
    parameter9?: string;
    parameter10?: string;
    parameter11?: string;
  };
  os_requirements?: string;
  script_contents_encoded?: boolean;
}

export interface ScriptUpdateData {
  name?: string;
  script_contents?: string;
  category?: string;
  info?: string;
  notes?: string;
  priority?: string;
  parameters?: {
    parameter4?: string;
    parameter5?: string;
    parameter6?: string;
    parameter7?: string;
    parameter8?: string;
    parameter9?: string;
    parameter10?: string;
    parameter11?: string;
  };
  os_requirements?: string;
  script_contents_encoded?: boolean;
}

export interface PolicyScopeUpdates {
  addComputers?: string[];
  removeComputers?: string[];
  addComputerGroups?: string[];
  removeComputerGroups?: string[];
  replaceComputers?: string[];
  replaceComputerGroups?: string[];
}

export interface AdvancedSearchData {
  name: string;
  criteria?: Array<{
    name: string;
    priority: number;
    and_or: 'and' | 'or';
    search_type: string;
    value: string;
  }>;
  display_fields?: string[];
}

export interface RestrictedSoftwareData {
  displayName: string;
  processName: string;
  matchExactProcessName?: boolean;
  killProcess?: boolean;
  deleteExecutable?: boolean;
  sendNotification?: boolean;
}

export interface RestrictedSoftwareUpdateData {
  displayName?: string;
  processName?: string;
  matchExactProcessName?: boolean;
  killProcess?: boolean;
  deleteExecutable?: boolean;
  sendNotification?: boolean;
}

export type DeviceType = 'computer' | 'mobiledevice';
export type GroupType = 'smart' | 'static' | 'all';

export interface IJamfApiClient {
  // Connection & Auth
  testApiAccess(): Promise<void>;
  keepAlive(): Promise<void>;

  // Computers
  getComputerCount(): Promise<number>;
  searchComputers(query: string, limit?: number): Promise<Computer[]>;
  getComputerDetails(id: string): Promise<any>;
  getAllComputers(limit?: number): Promise<any[]>;
  updateInventory(deviceId: string): Promise<void>;

  // Policies
  listPolicies(limit?: number): Promise<any[]>;
  searchPolicies(query: string, limit?: number): Promise<any[]>;
  getPolicyDetails(policyId: string): Promise<any>;
  createPolicy(policyData: any): Promise<any>;
  updatePolicy(policyId: string, policyData: any): Promise<any>;
  clonePolicy(sourcePolicyId: string, newName: string): Promise<any>;
  setPolicyEnabled(policyId: string, enabled: boolean): Promise<any>;
  updatePolicyScope(policyId: string, scopeUpdates: PolicyScopeUpdates): Promise<any>;
  deletePolicy(policyId: string): Promise<void>;
  executePolicy(policyId: string, deviceIds: string[]): Promise<void>;

  // Scripts
  listScripts(limit?: number): Promise<any[]>;
  searchScripts(query: string, limit?: number): Promise<any[]>;
  getScriptDetails(scriptId: string): Promise<any>;
  createScript(scriptData: ScriptData): Promise<any>;
  updateScript(scriptId: string, scriptData: ScriptUpdateData): Promise<any>;
  deleteScript(scriptId: string): Promise<void>;
  deployScript(scriptId: string, deviceIds: string[]): Promise<void>;

  // Configuration Profiles
  listConfigurationProfiles(type?: DeviceType): Promise<any[]>;
  getConfigurationProfileDetails(profileId: string, type?: DeviceType): Promise<any>;
  searchConfigurationProfiles(query: string, type?: DeviceType): Promise<any[]>;
  deployConfigurationProfile(profileId: string, deviceIds: string[], type?: DeviceType): Promise<void>;
  removeConfigurationProfile(profileId: string, deviceIds: string[], type?: DeviceType): Promise<void>;
  deleteConfigurationProfile(profileId: string, type?: DeviceType): Promise<void>;

  // Packages
  listPackages(limit?: number): Promise<any[]>;
  getPackageDetails(packageId: string): Promise<any>;
  searchPackages(query: string, limit?: number): Promise<any[]>;
  getPackageDeploymentHistory(packageId: string): Promise<any>;
  getPoliciesUsingPackage(packageId: string): Promise<any[]>;

  // Computer Groups
  listComputerGroups(type?: GroupType): Promise<any[]>;
  getComputerGroupDetails(groupId: string): Promise<any>;
  searchComputerGroups(query: string): Promise<any[]>;
  getComputerGroupMembers(groupId: string): Promise<any[]>;
  createStaticComputerGroup(name: string, computerIds: string[]): Promise<any>;
  updateStaticComputerGroup(groupId: string, computerIds: string[]): Promise<any>;
  deleteComputerGroup(groupId: string): Promise<void>;

  // Mobile Devices
  searchMobileDevices(query: string, limit?: number): Promise<any[]>;
  getMobileDeviceDetails(deviceId: string): Promise<any>;
  listMobileDevices(limit?: number): Promise<any[]>;
  updateMobileDeviceInventory(deviceId: string): Promise<void>;
  sendMDMCommand(deviceId: string, command: string): Promise<void>;

  // Mobile Device Groups
  getMobileDeviceGroups(type?: GroupType): Promise<any[]>;
  getMobileDeviceGroupDetails(groupId: string): Promise<any>;

  // Reports & Analytics
  getInventorySummary(): Promise<any>;
  getPolicyComplianceReport(policyId: string): Promise<any>;
  getPackageDeploymentStats(packageId: string): Promise<any>;
  getSoftwareVersionReport(softwareName: string): Promise<any>;
  getDeviceComplianceSummary(): Promise<any>;
  getComplianceReport(days?: number): Promise<any>;
  getStorageReport(): Promise<any>;
  getOSVersionReport(): Promise<any>;

  // Advanced Computer Searches
  createAdvancedComputerSearch(searchData: AdvancedSearchData): Promise<any>;
  getAdvancedComputerSearchDetails(searchId: string): Promise<any>;
  deleteAdvancedComputerSearch(searchId: string): Promise<void>;
  listAdvancedComputerSearches(): Promise<any[]>;
  ensureComplianceSearch(): Promise<string>;

  // Computer History & MDM Commands
  getComputerHistory(deviceId: string, subset?: string): Promise<any>;
  getComputerPolicyLogs(deviceId: string): Promise<any>;
  getComputerMDMCommandHistory(deviceId: string): Promise<any>;
  sendComputerMDMCommand(deviceId: string, command: string): Promise<any>;
  flushMDMCommands(deviceId: string, commandStatus: string): Promise<void>;

  // Infrastructure
  listBuildings(): Promise<any[]>;
  getBuildingDetails(buildingId: string): Promise<any>;
  listDepartments(): Promise<any[]>;
  getDepartmentDetails(departmentId: string): Promise<any>;
  listCategories(): Promise<any[]>;
  getCategoryDetails(categoryId: string): Promise<any>;

  // LAPS (Local Admin Password Solution)
  getLocalAdminPassword(clientManagementId: string, username: string): Promise<any>;
  getLocalAdminPasswordAudit(clientManagementId: string, username: string): Promise<any>;
  getLocalAdminPasswordAccounts(clientManagementId: string): Promise<any>;

  // Patch Management
  listPatchSoftwareTitles(): Promise<any[]>;
  getPatchSoftwareTitleDetails(titleId: string): Promise<any>;
  listPatchPolicies(titleId?: string): Promise<any[]>;
  getPatchPolicyDashboard(policyId: string): Promise<any>;

  // Extension Attributes
  listComputerExtensionAttributes(): Promise<any[]>;
  getComputerExtensionAttributeDetails(attributeId: string): Promise<any>;
  createComputerExtensionAttribute(data: any): Promise<any>;
  updateComputerExtensionAttribute(attributeId: string, data: any): Promise<any>;
  deleteComputerExtensionAttribute(attributeId: string): Promise<void>;

  // Software Update Plans
  listSoftwareUpdatePlans(): Promise<any[]>;
  createSoftwareUpdatePlan(deviceIds: string[], updateAction: string, versionType: string, specificVersion?: string): Promise<any>;
  getSoftwareUpdatePlanDetails(planId: string): Promise<any>;

  // Prestages
  listComputerPrestages(): Promise<any[]>;
  getComputerPrestageDetails(prestageId: string): Promise<any>;
  getComputerPrestageScope(prestageId: string): Promise<any>;
  listMobilePrestages(): Promise<any[]>;
  getMobilePrestageDetails(prestageId: string): Promise<any>;

  // Network Segments
  listNetworkSegments(): Promise<any[]>;
  getNetworkSegmentDetails(segmentId: string): Promise<any>;

  // Accounts
  listAccounts(): Promise<any>;
  getAccountDetails(accountId: string): Promise<any>;
  getAccountGroupDetails(groupId: string): Promise<any>;

  // Users
  listUsers(): Promise<any[]>;
  getUserDetails(userId: string): Promise<any>;
  searchUsers(query: string): Promise<any[]>;

  // App Installers
  listAppInstallers(): Promise<any[]>;
  getAppInstallerDetails(titleId: string): Promise<any>;

  // Restricted Software
  listRestrictedSoftware(): Promise<any[]>;
  getRestrictedSoftwareDetails(softwareId: string): Promise<any>;
  createRestrictedSoftware(data: RestrictedSoftwareData): Promise<any>;
  updateRestrictedSoftware(softwareId: string, data: RestrictedSoftwareUpdateData): Promise<any>;
  deleteRestrictedSoftware(softwareId: string): Promise<void>;

  // Webhooks
  listWebhooks(): Promise<any[]>;
  getWebhookDetails(webhookId: string): Promise<any>;
}
