/**
 * Search Index — Queryable catalog of all SDK symbols.
 *
 * Provides the backing data for the `jamf_search` tool. Each entry
 * contains the method name, TypeScript signature, human description,
 * category, required capabilities, and whether it's read-only.
 */

import { SearchIndexEntry } from './types.js';

const CATALOG: SearchIndexEntry[] = [
  // ── Connection & Auth ────────────────────────────────────────────
  { name: 'testApiAccess',  signature: '() => Promise<void>',  description: 'Test connectivity and authentication to the Jamf Pro server',  category: 'system',  capabilities: ['read:system'],  readOnly: true },
  { name: 'keepAlive',      signature: '() => Promise<void>',  description: 'Keep the API session alive / refresh token',                     category: 'system',  capabilities: ['read:system'],  readOnly: true },

  // ── Computers ────────────────────────────────────────────────────
  { name: 'getComputerCount',   signature: '() => Promise<number>',                                  description: 'Get total count of managed computers',                                   category: 'computers',  capabilities: ['read:computers'],    readOnly: true },
  { name: 'searchComputers',    signature: '(query: string, limit?: number) => Promise<Computer[]>',  description: 'Search computers by name, serial number, or other attributes',             category: 'computers',  capabilities: ['read:computers'],    readOnly: true },
  { name: 'getComputerDetails', signature: '(id: string) => Promise<any>',                            description: 'Get full details for a single computer by Jamf ID or serial number',      category: 'computers',  capabilities: ['read:computers'],    readOnly: true },
  { name: 'getAllComputers',    signature: '(limit?: number) => Promise<any[]>',                       description: 'List all computers (paginated). Default limit applies.',                  category: 'computers',  capabilities: ['read:computers'],    readOnly: true },
  { name: 'updateInventory',    signature: '(deviceId: string) => Promise<void>',                      description: 'Force an inventory update on a computer (sends BlankPush + UpdateInventory)', category: 'computers', capabilities: ['command:computers'], readOnly: false },

  // ── Policies ─────────────────────────────────────────────────────
  { name: 'listPolicies',      signature: '(limit?: number) => Promise<any[]>',                                              description: 'List all policies',                                          category: 'policies',  capabilities: ['read:policies'],    readOnly: true },
  { name: 'searchPolicies',    signature: '(query: string, limit?: number) => Promise<any[]>',                                description: 'Search policies by name or other criteria',                   category: 'policies',  capabilities: ['read:policies'],    readOnly: true },
  { name: 'getPolicyDetails',  signature: '(policyId: string) => Promise<any>',                                               description: 'Get full details for a policy by ID',                        category: 'policies',  capabilities: ['read:policies'],    readOnly: true },
  { name: 'createPolicy',      signature: '(policyData: any) => Promise<any>',                                                description: 'Create a new policy',                                        category: 'policies',  capabilities: ['write:policies'],   readOnly: false },
  { name: 'updatePolicy',      signature: '(policyId: string, policyData: any) => Promise<any>',                              description: 'Update an existing policy',                                   category: 'policies',  capabilities: ['write:policies'],   readOnly: false },
  { name: 'clonePolicy',       signature: '(sourcePolicyId: string, newName: string) => Promise<any>',                        description: 'Clone/duplicate an existing policy with a new name',          category: 'policies',  capabilities: ['write:policies'],   readOnly: false },
  { name: 'setPolicyEnabled',  signature: '(policyId: string, enabled: boolean) => Promise<any>',                             description: 'Enable or disable a policy',                                 category: 'policies',  capabilities: ['write:policies'],   readOnly: false },
  { name: 'updatePolicyScope', signature: '(policyId: string, scopeUpdates: PolicyScopeUpdates) => Promise<any>',             description: 'Update the scope (target computers/groups) of a policy',     category: 'policies',  capabilities: ['write:policies'],   readOnly: false },
  { name: 'deletePolicy',      signature: '(policyId: string) => Promise<void>',                                              description: 'Delete a policy',                                            category: 'policies',  capabilities: ['write:policies'],   readOnly: false },
  { name: 'executePolicy',     signature: '(policyId: string, deviceIds: string[]) => Promise<void>',                         description: 'Execute a policy on specific devices (sends MDM command)',    category: 'policies',  capabilities: ['command:policies'], readOnly: false },

  // ── Scripts ──────────────────────────────────────────────────────
  { name: 'listScripts',      signature: '(limit?: number) => Promise<any[]>',                                 description: 'List all scripts',                                   category: 'scripts',  capabilities: ['read:scripts'],    readOnly: true },
  { name: 'searchScripts',    signature: '(query: string, limit?: number) => Promise<any[]>',                  description: 'Search scripts by name',                              category: 'scripts',  capabilities: ['read:scripts'],    readOnly: true },
  { name: 'getScriptDetails', signature: '(scriptId: string) => Promise<any>',                                  description: 'Get full details for a script including contents',    category: 'scripts',  capabilities: ['read:scripts'],    readOnly: true },
  { name: 'createScript',     signature: '(scriptData: ScriptData) => Promise<any>',                            description: 'Create a new script',                                category: 'scripts',  capabilities: ['write:scripts'],   readOnly: false },
  { name: 'updateScript',     signature: '(scriptId: string, scriptData: ScriptUpdateData) => Promise<any>',    description: 'Update an existing script',                           category: 'scripts',  capabilities: ['write:scripts'],   readOnly: false },
  { name: 'deleteScript',     signature: '(scriptId: string) => Promise<void>',                                 description: 'Delete a script',                                    category: 'scripts',  capabilities: ['write:scripts'],   readOnly: false },
  { name: 'deployScript',     signature: '(scriptId: string, deviceIds: string[]) => Promise<void>',            description: 'Deploy/run a script on specific devices',            category: 'scripts',  capabilities: ['command:scripts'], readOnly: false },

  // ── Configuration Profiles ───────────────────────────────────────
  { name: 'listConfigurationProfiles',      signature: '(type?: DeviceType) => Promise<any[]>',                                       description: 'List all configuration profiles (computer or mobile)',         category: 'profiles',  capabilities: ['read:profiles'],    readOnly: true },
  { name: 'getConfigurationProfileDetails', signature: '(profileId: string, type?: DeviceType) => Promise<any>',                       description: 'Get details for a configuration profile',                      category: 'profiles',  capabilities: ['read:profiles'],    readOnly: true },
  { name: 'searchConfigurationProfiles',    signature: '(query: string, type?: DeviceType) => Promise<any[]>',                         description: 'Search configuration profiles by name',                        category: 'profiles',  capabilities: ['read:profiles'],    readOnly: true },
  { name: 'deployConfigurationProfile',     signature: '(profileId: string, deviceIds: string[], type?: DeviceType) => Promise<void>', description: 'Deploy a configuration profile to specific devices',           category: 'profiles',  capabilities: ['command:profiles'], readOnly: false },
  { name: 'removeConfigurationProfile',     signature: '(profileId: string, deviceIds: string[], type?: DeviceType) => Promise<void>', description: 'Remove a configuration profile from specific devices',         category: 'profiles',  capabilities: ['command:profiles'], readOnly: false },
  { name: 'deleteConfigurationProfile',     signature: '(profileId: string, type?: DeviceType) => Promise<void>',                      description: 'Delete a configuration profile definition',                    category: 'profiles',  capabilities: ['write:profiles'],   readOnly: false },

  // ── Packages ─────────────────────────────────────────────────────
  { name: 'listPackages',               signature: '(limit?: number) => Promise<any[]>',            description: 'List all packages',                                 category: 'packages', capabilities: ['read:packages'], readOnly: true },
  { name: 'getPackageDetails',          signature: '(packageId: string) => Promise<any>',            description: 'Get details for a package',                         category: 'packages', capabilities: ['read:packages'], readOnly: true },
  { name: 'searchPackages',             signature: '(query: string, limit?: number) => Promise<any[]>', description: 'Search packages by name',                        category: 'packages', capabilities: ['read:packages'], readOnly: true },
  { name: 'getPackageDeploymentHistory', signature: '(packageId: string) => Promise<any>',           description: 'Get deployment history for a package',              category: 'packages', capabilities: ['read:packages'], readOnly: true },
  { name: 'getPoliciesUsingPackage',    signature: '(packageId: string) => Promise<any[]>',          description: 'Find all policies that reference a package',        category: 'packages', capabilities: ['read:packages'], readOnly: true },

  // ── Computer Groups ──────────────────────────────────────────────
  { name: 'listComputerGroups',        signature: '(type?: GroupType) => Promise<any[]>',                        description: 'List computer groups (smart, static, or all)',      category: 'groups', capabilities: ['read:groups'],  readOnly: true },
  { name: 'getComputerGroupDetails',   signature: '(groupId: string) => Promise<any>',                           description: 'Get details for a computer group',                 category: 'groups', capabilities: ['read:groups'],  readOnly: true },
  { name: 'searchComputerGroups',      signature: '(query: string) => Promise<any[]>',                            description: 'Search computer groups by name',                   category: 'groups', capabilities: ['read:groups'],  readOnly: true },
  { name: 'getComputerGroupMembers',   signature: '(groupId: string) => Promise<any[]>',                          description: 'Get members of a computer group',                  category: 'groups', capabilities: ['read:groups'],  readOnly: true },
  { name: 'createStaticComputerGroup', signature: '(name: string, computerIds: string[]) => Promise<any>',        description: 'Create a new static computer group',               category: 'groups', capabilities: ['write:groups'], readOnly: false },
  { name: 'updateStaticComputerGroup', signature: '(groupId: string, computerIds: string[]) => Promise<any>',     description: 'Update membership of a static computer group',     category: 'groups', capabilities: ['write:groups'], readOnly: false },
  { name: 'deleteComputerGroup',       signature: '(groupId: string) => Promise<void>',                           description: 'Delete a computer group',                          category: 'groups', capabilities: ['write:groups'], readOnly: false },

  // ── Mobile Devices ───────────────────────────────────────────────
  { name: 'searchMobileDevices',        signature: '(query: string, limit?: number) => Promise<any[]>',  description: 'Search mobile devices by name, serial, etc.',        category: 'mobile_devices', capabilities: ['read:mobile_devices'],    readOnly: true },
  { name: 'getMobileDeviceDetails',     signature: '(deviceId: string) => Promise<any>',                  description: 'Get full details for a mobile device',               category: 'mobile_devices', capabilities: ['read:mobile_devices'],    readOnly: true },
  { name: 'listMobileDevices',          signature: '(limit?: number) => Promise<any[]>',                  description: 'List all mobile devices',                            category: 'mobile_devices', capabilities: ['read:mobile_devices'],    readOnly: true },
  { name: 'updateMobileDeviceInventory', signature: '(deviceId: string) => Promise<void>',                description: 'Force an inventory update on a mobile device',       category: 'mobile_devices', capabilities: ['command:mobile_devices'], readOnly: false },
  { name: 'sendMDMCommand',             signature: '(deviceId: string, command: string) => Promise<void>', description: 'Send an MDM command to a mobile device',            category: 'mobile_devices', capabilities: ['command:mobile_devices'], readOnly: false },

  // ── Mobile Device Groups ─────────────────────────────────────────
  { name: 'getMobileDeviceGroups',       signature: '(type?: GroupType) => Promise<any[]>',     description: 'List mobile device groups',               category: 'mobile_devices', capabilities: ['read:mobile_devices'], readOnly: true },
  { name: 'getMobileDeviceGroupDetails', signature: '(groupId: string) => Promise<any>',        description: 'Get details for a mobile device group',   category: 'mobile_devices', capabilities: ['read:mobile_devices'], readOnly: true },

  // ── Reports & Analytics ──────────────────────────────────────────
  { name: 'getInventorySummary',        signature: '() => Promise<any>',                             description: 'Get fleet-wide inventory summary (counts, OS versions, models)',   category: 'reports', capabilities: ['read:reports'], readOnly: true },
  { name: 'getPolicyComplianceReport',  signature: '(policyId: string) => Promise<any>',             description: 'Get compliance report for a specific policy',                      category: 'reports', capabilities: ['read:reports'], readOnly: true },
  { name: 'getPackageDeploymentStats',  signature: '(packageId: string) => Promise<any>',             description: 'Get deployment statistics for a package',                          category: 'reports', capabilities: ['read:reports'], readOnly: true },
  { name: 'getSoftwareVersionReport',   signature: '(softwareName: string) => Promise<any>',          description: 'Get version distribution report for an application',               category: 'reports', capabilities: ['read:reports'], readOnly: true },
  { name: 'getDeviceComplianceSummary', signature: '() => Promise<any>',                              description: 'Get overall device compliance summary',                            category: 'reports', capabilities: ['read:reports'], readOnly: true },
  { name: 'getComplianceReport',        signature: '(days?: number) => Promise<any>',                 description: 'Get compliance report for the fleet (optionally scoped to N days)', category: 'reports', capabilities: ['read:reports'], readOnly: true },
  { name: 'getStorageReport',           signature: '() => Promise<any>',                              description: 'Get storage utilization report across the fleet',                  category: 'reports', capabilities: ['read:reports'], readOnly: true },
  { name: 'getOSVersionReport',         signature: '() => Promise<any>',                              description: 'Get OS version distribution report',                              category: 'reports', capabilities: ['read:reports'], readOnly: true },

  // ── Advanced Computer Searches ───────────────────────────────────
  { name: 'createAdvancedComputerSearch',      signature: '(searchData: AdvancedSearchData) => Promise<any>',  description: 'Create an advanced computer search with criteria and display fields', category: 'advanced_searches', capabilities: ['write:advanced_searches'], readOnly: false },
  { name: 'getAdvancedComputerSearchDetails',  signature: '(searchId: string) => Promise<any>',                description: 'Get details and results of an advanced computer search',             category: 'advanced_searches', capabilities: ['read:advanced_searches'],  readOnly: true },
  { name: 'deleteAdvancedComputerSearch',      signature: '(searchId: string) => Promise<void>',               description: 'Delete an advanced computer search',                                category: 'advanced_searches', capabilities: ['write:advanced_searches'], readOnly: false },
  { name: 'listAdvancedComputerSearches',      signature: '() => Promise<any[]>',                              description: 'List all advanced computer searches',                                category: 'advanced_searches', capabilities: ['read:advanced_searches'],  readOnly: true },
  { name: 'ensureComplianceSearch',            signature: '() => Promise<string>',                             description: 'Ensure the compliance advanced search exists (idempotent)',          category: 'advanced_searches', capabilities: ['read:advanced_searches'],  readOnly: true },

  // ── Computer History & MDM ───────────────────────────────────────
  { name: 'getComputerHistory',           signature: '(deviceId: string, subset?: string) => Promise<any>',  description: 'Get history for a computer (usage, commands, policy logs)',    category: 'computers', capabilities: ['read:computers'],  readOnly: true },
  { name: 'getComputerPolicyLogs',        signature: '(deviceId: string) => Promise<any>',                    description: 'Get policy execution logs for a computer',                   category: 'computers', capabilities: ['read:computers'],  readOnly: true },
  { name: 'getComputerMDMCommandHistory', signature: '(deviceId: string) => Promise<any>',                    description: 'Get MDM command history for a computer',                     category: 'computers', capabilities: ['read:computers'],  readOnly: true },
  { name: 'sendComputerMDMCommand',       signature: '(deviceId: string, command: string) => Promise<any>',   description: 'Send an MDM command to a computer (Lock, Wipe, etc.)',       category: 'computers', capabilities: ['command:mdm'],     readOnly: false },
  { name: 'flushMDMCommands',             signature: '(deviceId: string, commandStatus: string) => Promise<void>', description: 'Flush pending/failed MDM commands for a device',        category: 'computers', capabilities: ['command:mdm'],     readOnly: false },

  // ── Infrastructure ───────────────────────────────────────────────
  { name: 'listBuildings',        signature: '() => Promise<any[]>',                   description: 'List all buildings',                 category: 'infrastructure', capabilities: ['read:infrastructure'], readOnly: true },
  { name: 'getBuildingDetails',    signature: '(buildingId: string) => Promise<any>',   description: 'Get details for a building',          category: 'infrastructure', capabilities: ['read:infrastructure'], readOnly: true },
  { name: 'listDepartments',      signature: '() => Promise<any[]>',                   description: 'List all departments',               category: 'infrastructure', capabilities: ['read:infrastructure'], readOnly: true },
  { name: 'getDepartmentDetails', signature: '(departmentId: string) => Promise<any>', description: 'Get details for a department',        category: 'infrastructure', capabilities: ['read:infrastructure'], readOnly: true },
  { name: 'listCategories',       signature: '() => Promise<any[]>',                   description: 'List all categories',                category: 'infrastructure', capabilities: ['read:infrastructure'], readOnly: true },
  { name: 'getCategoryDetails',   signature: '(categoryId: string) => Promise<any>',   description: 'Get details for a category',          category: 'infrastructure', capabilities: ['read:infrastructure'], readOnly: true },

  // ── LAPS ─────────────────────────────────────────────────────────
  { name: 'getLocalAdminPassword',         signature: '(clientManagementId: string, username: string) => Promise<any>', description: 'Get the current local admin password for a device',  category: 'laps', capabilities: ['read:laps'], readOnly: true },
  { name: 'getLocalAdminPasswordAudit',    signature: '(clientManagementId: string, username: string) => Promise<any>', description: 'Get LAPS audit history for a device',               category: 'laps', capabilities: ['read:laps'], readOnly: true },
  { name: 'getLocalAdminPasswordAccounts', signature: '(clientManagementId: string) => Promise<any>',                   description: 'List LAPS-managed accounts on a device',            category: 'laps', capabilities: ['read:laps'], readOnly: true },

  // ── Patch Management ─────────────────────────────────────────────
  { name: 'listPatchSoftwareTitles',      signature: '() => Promise<any[]>',                    description: 'List all patch management software titles',           category: 'patch', capabilities: ['read:patch'], readOnly: true },
  { name: 'getPatchSoftwareTitleDetails', signature: '(titleId: string) => Promise<any>',        description: 'Get details for a patch software title',              category: 'patch', capabilities: ['read:patch'], readOnly: true },
  { name: 'listPatchPolicies',            signature: '(titleId?: string) => Promise<any[]>',     description: 'List patch policies (optionally filtered by title)',   category: 'patch', capabilities: ['read:patch'], readOnly: true },
  { name: 'getPatchPolicyDashboard',      signature: '(policyId: string) => Promise<any>',       description: 'Get patch policy dashboard / compliance stats',       category: 'patch', capabilities: ['read:patch'], readOnly: true },

  // ── Extension Attributes ─────────────────────────────────────────
  { name: 'listComputerExtensionAttributes',      signature: '() => Promise<any[]>',                                    description: 'List all computer extension attributes',       category: 'extension_attributes', capabilities: ['read:extension_attributes'],  readOnly: true },
  { name: 'getComputerExtensionAttributeDetails', signature: '(attributeId: string) => Promise<any>',                    description: 'Get details for an extension attribute',       category: 'extension_attributes', capabilities: ['read:extension_attributes'],  readOnly: true },
  { name: 'createComputerExtensionAttribute',     signature: '(data: any) => Promise<any>',                              description: 'Create a new computer extension attribute',    category: 'extension_attributes', capabilities: ['write:extension_attributes'], readOnly: false },
  { name: 'updateComputerExtensionAttribute',     signature: '(attributeId: string, data: any) => Promise<any>',         description: 'Update a computer extension attribute',        category: 'extension_attributes', capabilities: ['write:extension_attributes'], readOnly: false },
  { name: 'deleteComputerExtensionAttribute',     signature: '(attributeId: string) => Promise<void>',                   description: 'Delete a computer extension attribute',        category: 'extension_attributes', capabilities: ['write:extension_attributes'], readOnly: false },

  // ── Software Update Plans ────────────────────────────────────────
  { name: 'listSoftwareUpdatePlans',      signature: '() => Promise<any[]>',                                                                                                description: 'List all software update plans',                  category: 'software_updates', capabilities: ['read:software_updates'],    readOnly: true },
  { name: 'createSoftwareUpdatePlan',     signature: '(deviceIds: string[], updateAction: string, versionType: string, specificVersion?: string) => Promise<any>',            description: 'Create a software update plan for devices',       category: 'software_updates', capabilities: ['command:software_updates'], readOnly: false },
  { name: 'getSoftwareUpdatePlanDetails', signature: '(planId: string) => Promise<any>',                                                                                     description: 'Get details and status of a software update plan', category: 'software_updates', capabilities: ['read:software_updates'],   readOnly: true },

  // ── Prestages ────────────────────────────────────────────────────
  { name: 'listComputerPrestages',      signature: '() => Promise<any[]>',                    description: 'List all computer prestage enrollments',          category: 'prestages', capabilities: ['read:prestages'], readOnly: true },
  { name: 'getComputerPrestageDetails', signature: '(prestageId: string) => Promise<any>',     description: 'Get details for a computer prestage enrollment',  category: 'prestages', capabilities: ['read:prestages'], readOnly: true },
  { name: 'getComputerPrestageScope',   signature: '(prestageId: string) => Promise<any>',     description: 'Get scope (assigned devices) of a prestage',      category: 'prestages', capabilities: ['read:prestages'], readOnly: true },
  { name: 'listMobilePrestages',        signature: '() => Promise<any[]>',                    description: 'List all mobile device prestage enrollments',     category: 'prestages', capabilities: ['read:prestages'], readOnly: true },
  { name: 'getMobilePrestageDetails',   signature: '(prestageId: string) => Promise<any>',     description: 'Get details for a mobile prestage enrollment',    category: 'prestages', capabilities: ['read:prestages'], readOnly: true },

  // ── Network Segments ─────────────────────────────────────────────
  { name: 'listNetworkSegments',      signature: '() => Promise<any[]>',                    description: 'List all network segments',              category: 'network_segments', capabilities: ['read:network_segments'], readOnly: true },
  { name: 'getNetworkSegmentDetails', signature: '(segmentId: string) => Promise<any>',      description: 'Get details for a network segment',      category: 'network_segments', capabilities: ['read:network_segments'], readOnly: true },

  // ── Accounts ─────────────────────────────────────────────────────
  { name: 'listAccounts',         signature: '() => Promise<any>',                   description: 'List all Jamf Pro user accounts and groups',  category: 'accounts', capabilities: ['read:accounts'], readOnly: true },
  { name: 'getAccountDetails',    signature: '(accountId: string) => Promise<any>',   description: 'Get details for a Jamf Pro user account',     category: 'accounts', capabilities: ['read:accounts'], readOnly: true },
  { name: 'getAccountGroupDetails', signature: '(groupId: string) => Promise<any>',   description: 'Get details for a Jamf Pro account group',    category: 'accounts', capabilities: ['read:accounts'], readOnly: true },

  // ── Users ────────────────────────────────────────────────────────
  { name: 'listUsers',    signature: '() => Promise<any[]>',                   description: 'List all users (end-users, not admin accounts)',  category: 'users', capabilities: ['read:users'], readOnly: true },
  { name: 'getUserDetails', signature: '(userId: string) => Promise<any>',      description: 'Get details for a user',                         category: 'users', capabilities: ['read:users'], readOnly: true },
  { name: 'searchUsers',  signature: '(query: string) => Promise<any[]>',       description: 'Search users by name or email',                  category: 'users', capabilities: ['read:users'], readOnly: true },

  // ── App Installers ───────────────────────────────────────────────
  { name: 'listAppInstallers',      signature: '() => Promise<any[]>',                description: 'List all app installers',              category: 'app_installers', capabilities: ['read:app_installers'], readOnly: true },
  { name: 'getAppInstallerDetails', signature: '(titleId: string) => Promise<any>',    description: 'Get details for an app installer',     category: 'app_installers', capabilities: ['read:app_installers'], readOnly: true },

  // ── Restricted Software ──────────────────────────────────────────
  { name: 'listRestrictedSoftware',       signature: '() => Promise<any[]>',                                                description: 'List all restricted software entries',          category: 'restricted_software', capabilities: ['read:restricted_software'],  readOnly: true },
  { name: 'getRestrictedSoftwareDetails', signature: '(softwareId: string) => Promise<any>',                                description: 'Get details for a restricted software entry',   category: 'restricted_software', capabilities: ['read:restricted_software'],  readOnly: true },
  { name: 'createRestrictedSoftware',     signature: '(data: RestrictedSoftwareData) => Promise<any>',                      description: 'Create a new restricted software entry',        category: 'restricted_software', capabilities: ['write:restricted_software'], readOnly: false },
  { name: 'updateRestrictedSoftware',     signature: '(softwareId: string, data: RestrictedSoftwareUpdateData) => Promise<any>', description: 'Update a restricted software entry',       category: 'restricted_software', capabilities: ['write:restricted_software'], readOnly: false },
  { name: 'deleteRestrictedSoftware',     signature: '(softwareId: string) => Promise<void>',                               description: 'Delete a restricted software entry',            category: 'restricted_software', capabilities: ['write:restricted_software'], readOnly: false },

  // ── Webhooks ─────────────────────────────────────────────────────
  { name: 'listWebhooks',       signature: '() => Promise<any[]>',                description: 'List all webhooks',              category: 'webhooks', capabilities: ['read:webhooks'], readOnly: true },
  { name: 'getWebhookDetails',  signature: '(webhookId: string) => Promise<any>',  description: 'Get details for a webhook',      category: 'webhooks', capabilities: ['read:webhooks'], readOnly: true },
];

// ── Helper entries ─────────────────────────────────────────────────

const HELPER_ENTRIES: SearchIndexEntry[] = [
  { name: 'helpers.paginate',  signature: '(fn: (limit: number) => Promise<any[]>, limit?: number) => Promise<any[]>', description: 'Auto-paginate a list call. Usage: await helpers.paginate(l => jamf.getAllComputers(l), 500)', category: 'helpers', capabilities: [], readOnly: true },
  { name: 'helpers.daysSince', signature: '(isoDate?: string | null) => number',                                       description: 'Calculate days since an ISO date string. Returns Infinity for null/undefined.',              category: 'helpers', capabilities: [], readOnly: true },
  { name: 'helpers.chunk',     signature: '<T>(arr: T[], size: number) => T[][]',                                       description: 'Split an array into chunks of the given size.',                                             category: 'helpers', capabilities: [], readOnly: true },
];

const ALL_ENTRIES = [...CATALOG, ...HELPER_ENTRIES];

// ── Search function ────────────────────────────────────────────────

export function search(query: string): SearchIndexEntry[] {
  if (!query || !query.trim()) {
    return ALL_ENTRIES;
  }

  const terms = query.toLowerCase().split(/\s+/);

  const scored = ALL_ENTRIES.map((entry) => {
    const haystack = `${entry.name} ${entry.description} ${entry.category}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (entry.name.toLowerCase() === term) {
        score += 10; // Exact name match
      } else if (entry.name.toLowerCase().includes(term)) {
        score += 5; // Partial name match
      } else if (entry.category.toLowerCase() === term) {
        score += 3; // Category match
      } else if (haystack.includes(term)) {
        score += 1; // Description match
      }
    }
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.entry);
}

export function getAllEntries(): SearchIndexEntry[] {
  return ALL_ENTRIES;
}

export function getCategories(): string[] {
  return [...new Set(ALL_ENTRIES.map((e) => e.category))];
}
