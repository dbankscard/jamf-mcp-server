import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  GetFleetOverviewSchema,
  GetDeviceFullProfileSchema,
  GetSecurityPostureSchema,
  GetPolicyAnalysisSchema,
  executeGetFleetOverview,
  executeGetDeviceFullProfile,
  executeGetSecurityPosture,
  executeGetPolicyAnalysis,
} from './compound-tools.js';
import { enrichResponse, truncateToolResponse } from './response-enricher.js';

// Helper function to parse Jamf dates
const parseJamfDate = (date: string | Date | undefined): Date => {
  if (!date) return new Date(0);
  if (date instanceof Date) return date;
  return new Date(date);
};

const SearchDevicesSchema = z.object({
  query: z.string().describe('Search query to find devices by name, serial number, IP address, username, etc.'),
  limit: z.number().optional().default(50).describe('Maximum number of results to return'),
});

const GetDeviceDetailsSchema = z.object({
  deviceId: z.string().describe('The Jamf device ID'),
});

const UpdateInventorySchema = z.object({
  deviceId: z.string().describe('The device ID to update inventory for'),
});

const CheckDeviceComplianceSchema = z.object({
  days: z.number().optional().default(30).describe('Number of days to check for compliance'),
  includeDetails: z.boolean().optional().default(false).describe('Include detailed device list in response'),
});

const GetDevicesBatchSchema = z.object({
  deviceIds: z.array(z.string()).describe('Array of device IDs to fetch details for'),
  includeBasicOnly: z.boolean().optional().default(false).describe('Return only basic info to reduce response size'),
});

// Policy schemas
const ListPoliciesSchema = z.object({
  limit: z.number().optional().default(100).describe('Maximum number of policies to return'),
  category: z.string().optional().describe('Filter by policy category'),
});

const GetPolicyDetailsSchema = z.object({
  policyId: z.string().describe('The Jamf policy ID'),
  includeScriptContent: z.boolean().optional().default(false).describe('Include full script content for scripts in the policy'),
});

const SearchPoliciesSchema = z.object({
  query: z.string().describe('Search query for policy name or description'),
  limit: z.number().optional().default(50).describe('Maximum number of results'),
});

const ExecutePolicySchema = z.object({
  policyId: z.string().describe('The Jamf policy ID to execute'),
  deviceIds: z.array(z.string()).describe('Array of device IDs to execute the policy on'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for policy execution'),
});

const DeployScriptSchema = z.object({
  scriptId: z.string().describe('The Jamf script ID to deploy'),
  deviceIds: z.array(z.string()).describe('Array of device IDs to deploy the script to'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for script deployment'),
});

const GetScriptDetailsSchema = z.object({
  scriptId: z.string().describe('The Jamf script ID'),
});

const ListConfigurationProfilesSchema = z.object({
  type: z.enum(['computer', 'mobiledevice']).optional().default('computer').describe('Type of configuration profiles to list'),
});

const GetConfigurationProfileDetailsSchema = z.object({
  profileId: z.string().describe('The configuration profile ID'),
  type: z.enum(['computer', 'mobiledevice']).optional().default('computer').describe('Type of configuration profile'),
});

const SearchConfigurationProfilesSchema = z.object({
  query: z.string().describe('Search query to find configuration profiles by name'),
  type: z.enum(['computer', 'mobiledevice']).optional().default('computer').describe('Type of configuration profiles to search'),
});

const DeployConfigurationProfileSchema = z.object({
  profileId: z.string().describe('The configuration profile ID to deploy'),
  deviceIds: z.array(z.string()).describe('Array of device IDs to deploy the profile to'),
  type: z.enum(['computer', 'mobiledevice']).optional().default('computer').describe('Type of configuration profile'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for profile deployment'),
});

const RemoveConfigurationProfileSchema = z.object({
  profileId: z.string().describe('The configuration profile ID to remove'),
  deviceIds: z.array(z.string()).describe('Array of device IDs to remove the profile from'),
  type: z.enum(['computer', 'mobiledevice']).optional().default('computer').describe('Type of configuration profile'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for profile removal'),
});

const ListComputerGroupsSchema = z.object({
  type: z.enum(['smart', 'static', 'all']).optional().default('all').describe('Type of computer groups to list'),
});

const GetComputerGroupDetailsSchema = z.object({
  groupId: z.string().describe('The computer group ID'),
});

const SearchComputerGroupsSchema = z.object({
  query: z.string().describe('Search query to find computer groups by name'),
});

const GetComputerGroupMembersSchema = z.object({
  groupId: z.string().describe('The computer group ID to get members for'),
});

const CreateStaticComputerGroupSchema = z.object({
  name: z.string().describe('Name for the new static computer group'),
  computerIds: z.array(z.string()).describe('Array of computer IDs to add to the group'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for group creation'),
});

const UpdateStaticComputerGroupSchema = z.object({
  groupId: z.string().describe('The static computer group ID to update'),
  computerIds: z.array(z.string()).describe('Array of computer IDs to set as the group membership'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for group update'),
});

const DeleteComputerGroupSchema = z.object({
  groupId: z.string().describe('The computer group ID to delete'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for group deletion'),
});

const CreateAdvancedComputerSearchSchema = z.object({
  searchData: z.object({
    name: z.string().describe('Name for the advanced computer search'),
    criteria: z.array(z.object({
      name: z.string().describe('Criterion name (e.g., "Last Check-in")'),
      priority: z.number().describe('Criterion priority (0 = first)'),
      and_or: z.enum(['and', 'or']).describe('Logical operator for combining criteria'),
      search_type: z.string().describe('Search type (e.g., "more than x days ago")'),
      value: z.string().describe('Search value'),
    })).optional().describe('Search criteria'),
    display_fields: z.array(z.string()).optional().describe('Fields to display in search results'),
  }).describe('Advanced computer search configuration'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for search creation'),
});

const ListAdvancedComputerSearchesSchema = z.object({
  limit: z.number().optional().default(100).describe('Maximum number of searches to return'),
});

const GetAdvancedComputerSearchDetailsSchema = z.object({
  searchId: z.string().describe('The ID of the advanced computer search'),
});

const DeleteAdvancedComputerSearchSchema = z.object({
  searchId: z.string().describe('The ID of the advanced computer search to delete'),
  confirm: z.boolean().describe('Must be true to confirm deletion'),
});

const SearchMobileDevicesSchema = z.object({
  query: z.string().describe('Search query to find mobile devices by name, serial number, UDID, etc.'),
  limit: z.number().optional().default(50).describe('Maximum number of results to return'),
});

const GetMobileDeviceDetailsSchema = z.object({
  deviceId: z.string().describe('The mobile device ID'),
});

const ListMobileDevicesSchema = z.object({
  limit: z.number().optional().default(50).describe('Maximum number of mobile devices to return'),
});

const UpdateMobileDeviceInventorySchema = z.object({
  deviceId: z.string().describe('The mobile device ID to update inventory for'),
});

const SendMDMCommandSchema = z.object({
  deviceId: z.string().describe('The mobile device ID to send command to'),
  command: z.string().describe('The MDM command to send (e.g., DeviceLock, EraseDevice, ClearPasscode)'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for destructive commands'),
});

const ListMobileDeviceGroupsSchema = z.object({
  type: z.enum(['smart', 'static', 'all']).optional().default('all').describe('Type of mobile device groups to list'),
});

const GetMobileDeviceGroupDetailsSchema = z.object({
  groupId: z.string().describe('The mobile device group ID'),
});

// Package management schemas
const ListPackagesSchema = z.object({
  limit: z.number().optional().default(100).describe('Maximum number of packages to return'),
});

const SearchPackagesSchema = z.object({
  query: z.string().describe('Search query for package name'),
  limit: z.number().optional().default(50).describe('Maximum number of results'),
});

const GetPackageDetailsSchema = z.object({
  packageId: z.string().describe('The Jamf package ID'),
});

const GetPackageDeploymentHistorySchema = z.object({
  packageId: z.string().describe('The Jamf package ID'),
  limit: z.number().optional().default(50).describe('Maximum number of deployment records to return'),
});

const GetPoliciesUsingPackageSchema = z.object({
  packageId: z.string().describe('The Jamf package ID'),
});

// Policy management schemas
const CreatePolicySchema = z.object({
  policyData: z.object({
    general: z.object({
      name: z.string().describe('Policy name'),
      enabled: z.boolean().optional().describe('Whether the policy is enabled'),
      trigger: z.string().optional().describe('Policy trigger type'),
      trigger_checkin: z.boolean().optional().describe('Trigger on check-in'),
      trigger_enrollment_complete: z.boolean().optional().describe('Trigger on enrollment complete'),
      trigger_login: z.boolean().optional().describe('Trigger on login'),
      trigger_logout: z.boolean().optional().describe('Trigger on logout'),
      trigger_network_state_changed: z.boolean().optional().describe('Trigger on network state change'),
      trigger_startup: z.boolean().optional().describe('Trigger on startup'),
      trigger_other: z.string().optional().describe('Custom trigger name'),
      frequency: z.string().optional().describe('Execution frequency (Once per computer, Once per user, etc.)'),
      retry_event: z.string().optional().describe('Retry event type'),
      retry_attempts: z.number().optional().describe('Number of retry attempts'),
      notify_on_each_failed_retry: z.boolean().optional().describe('Notify on each failed retry'),
      location_user_only: z.boolean().optional().describe('Location information collected from user only'),
      target_drive: z.string().optional().describe('Target drive for installations'),
      offline: z.boolean().optional().describe('Make available offline'),
      category: z.string().optional().describe('Policy category'),
    }).describe('General policy settings'),
    scope: z.object({
      all_computers: z.boolean().optional().describe('Apply to all computers'),
      computers: z.array(z.object({ id: z.number() })).optional().describe('Specific computers'),
      computer_groups: z.array(z.object({ id: z.number() })).optional().describe('Computer groups'),
      buildings: z.array(z.object({ id: z.number() })).optional().describe('Buildings'),
      departments: z.array(z.object({ id: z.number() })).optional().describe('Departments'),
    }).optional().describe('Policy scope settings'),
    self_service: z.object({
      use_for_self_service: z.boolean().optional().describe('Make available in Self Service'),
      self_service_display_name: z.string().optional().describe('Display name in Self Service'),
      install_button_text: z.string().optional().describe('Install button text'),
      reinstall_button_text: z.string().optional().describe('Reinstall button text'),
      self_service_description: z.string().optional().describe('Description in Self Service'),
      force_users_to_view_description: z.boolean().optional().describe('Force users to view description'),
      feature_on_main_page: z.boolean().optional().describe('Feature on main page'),
    }).optional().describe('Self Service settings'),
    package_configuration: z.object({
      packages: z.array(z.object({
        id: z.number().describe('Package ID'),
        action: z.string().optional().describe('Install action'),
        fut: z.boolean().optional().describe('Fill user templates'),
        feu: z.boolean().optional().describe('Fill existing users'),
      })).optional().describe('Packages to deploy'),
    }).optional().describe('Package configuration'),
    scripts: z.array(z.object({
      id: z.number().describe('Script ID'),
      priority: z.string().optional().describe('Script priority (Before, After)'),
      parameter4: z.string().optional().describe('Script parameter 4'),
      parameter5: z.string().optional().describe('Script parameter 5'),
      parameter6: z.string().optional().describe('Script parameter 6'),
      parameter7: z.string().optional().describe('Script parameter 7'),
      parameter8: z.string().optional().describe('Script parameter 8'),
      parameter9: z.string().optional().describe('Script parameter 9'),
      parameter10: z.string().optional().describe('Script parameter 10'),
      parameter11: z.string().optional().describe('Script parameter 11'),
    })).optional().describe('Scripts to run'),
  }).describe('Policy configuration data'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for policy creation'),
});

const UpdatePolicySchema = z.object({
  policyId: z.string().describe('The policy ID to update'),
  policyData: z.object({
    general: z.object({
      name: z.string().optional().describe('Policy name'),
      enabled: z.boolean().optional().describe('Whether the policy is enabled'),
      trigger: z.string().optional().describe('Policy trigger type'),
      trigger_checkin: z.boolean().optional().describe('Trigger on check-in'),
      trigger_enrollment_complete: z.boolean().optional().describe('Trigger on enrollment complete'),
      trigger_login: z.boolean().optional().describe('Trigger on login'),
      trigger_logout: z.boolean().optional().describe('Trigger on logout'),
      trigger_network_state_changed: z.boolean().optional().describe('Trigger on network state change'),
      trigger_startup: z.boolean().optional().describe('Trigger on startup'),
      trigger_other: z.string().optional().describe('Custom trigger name'),
      frequency: z.string().optional().describe('Execution frequency'),
      retry_event: z.string().optional().describe('Retry event type'),
      retry_attempts: z.number().optional().describe('Number of retry attempts'),
      notify_on_each_failed_retry: z.boolean().optional().describe('Notify on each failed retry'),
      location_user_only: z.boolean().optional().describe('Location information collected from user only'),
      target_drive: z.string().optional().describe('Target drive for installations'),
      offline: z.boolean().optional().describe('Make available offline'),
      category: z.string().optional().describe('Policy category'),
    }).optional().describe('General policy settings to update'),
    scope: z.object({
      all_computers: z.boolean().optional().describe('Apply to all computers'),
      computers: z.array(z.object({ id: z.number() })).optional().describe('Specific computers'),
      computer_groups: z.array(z.object({ id: z.number() })).optional().describe('Computer groups'),
      buildings: z.array(z.object({ id: z.number() })).optional().describe('Buildings'),
      departments: z.array(z.object({ id: z.number() })).optional().describe('Departments'),
    }).optional().describe('Policy scope settings to update'),
    self_service: z.object({
      use_for_self_service: z.boolean().optional().describe('Make available in Self Service'),
      self_service_display_name: z.string().optional().describe('Display name in Self Service'),
      install_button_text: z.string().optional().describe('Install button text'),
      reinstall_button_text: z.string().optional().describe('Reinstall button text'),
      self_service_description: z.string().optional().describe('Description in Self Service'),
      force_users_to_view_description: z.boolean().optional().describe('Force users to view description'),
      feature_on_main_page: z.boolean().optional().describe('Feature on main page'),
    }).optional().describe('Self Service settings to update'),
    package_configuration: z.object({
      packages: z.array(z.object({
        id: z.number().describe('Package ID'),
        action: z.string().optional().describe('Install action'),
        fut: z.boolean().optional().describe('Fill user templates'),
        feu: z.boolean().optional().describe('Fill existing users'),
      })).optional().describe('Packages to deploy'),
    }).optional().describe('Package configuration to update'),
    scripts: z.array(z.object({
      id: z.number().describe('Script ID'),
      priority: z.string().optional().describe('Script priority (Before, After)'),
      parameter4: z.string().optional().describe('Script parameter 4'),
      parameter5: z.string().optional().describe('Script parameter 5'),
      parameter6: z.string().optional().describe('Script parameter 6'),
      parameter7: z.string().optional().describe('Script parameter 7'),
      parameter8: z.string().optional().describe('Script parameter 8'),
      parameter9: z.string().optional().describe('Script parameter 9'),
      parameter10: z.string().optional().describe('Script parameter 10'),
      parameter11: z.string().optional().describe('Script parameter 11'),
    })).optional().describe('Scripts to run'),
  }).describe('Policy configuration data to update'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for policy update'),
});

const ClonePolicySchema = z.object({
  sourcePolicyId: z.string().describe('The source policy ID to clone'),
  newName: z.string().describe('Name for the cloned policy'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for policy cloning'),
});

const SetPolicyEnabledSchema = z.object({
  policyId: z.string().describe('The policy ID'),
  enabled: z.boolean().describe('Whether to enable or disable the policy'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for enabling/disabling policy'),
});

const UpdatePolicyScopeSchema = z.object({
  policyId: z.string().describe('The policy ID to update scope for'),
  scopeUpdates: z.object({
    addComputers: z.array(z.string()).optional().describe('Computer IDs to add to scope'),
    removeComputers: z.array(z.string()).optional().describe('Computer IDs to remove from scope'),
    addComputerGroups: z.array(z.string()).optional().describe('Computer group IDs to add to scope'),
    removeComputerGroups: z.array(z.string()).optional().describe('Computer group IDs to remove from scope'),
    replaceComputers: z.array(z.string()).optional().describe('Replace all computers in scope with these IDs'),
    replaceComputerGroups: z.array(z.string()).optional().describe('Replace all computer groups in scope with these IDs'),
  }).describe('Scope update operations'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for scope update'),
});

// Script management schemas
const ListScriptsSchema = z.object({
  limit: z.number().optional().default(100).describe('Maximum number of scripts to return'),
});

const SearchScriptsSchema = z.object({
  query: z.string().describe('Search query for script name'),
  limit: z.number().optional().default(50).describe('Maximum number of results'),
});

const CreateScriptSchema = z.object({
  scriptData: z.object({
    name: z.string().describe('Script name'),
    script_contents: z.string().describe('Script contents'),
    category: z.string().optional().describe('Script category'),
    info: z.string().optional().describe('Script info/description'),
    notes: z.string().optional().describe('Script notes'),
    priority: z.string().optional().describe('Script priority'),
    parameters: z.object({
      parameter4: z.string().optional().describe('Parameter 4 label'),
      parameter5: z.string().optional().describe('Parameter 5 label'),
      parameter6: z.string().optional().describe('Parameter 6 label'),
      parameter7: z.string().optional().describe('Parameter 7 label'),
      parameter8: z.string().optional().describe('Parameter 8 label'),
      parameter9: z.string().optional().describe('Parameter 9 label'),
      parameter10: z.string().optional().describe('Parameter 10 label'),
      parameter11: z.string().optional().describe('Parameter 11 label'),
    }).optional().describe('Script parameter labels'),
    os_requirements: z.string().optional().describe('OS requirements'),
    script_contents_encoded: z.boolean().optional().describe('Whether script contents are encoded'),
  }).describe('Script configuration data'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for script creation'),
});

const UpdateScriptSchema = z.object({
  scriptId: z.string().describe('The script ID to update'),
  scriptData: z.object({
    name: z.string().optional().describe('Script name'),
    script_contents: z.string().optional().describe('Script contents'),
    category: z.string().optional().describe('Script category'),
    info: z.string().optional().describe('Script info/description'),
    notes: z.string().optional().describe('Script notes'),
    priority: z.string().optional().describe('Script priority'),
    parameters: z.object({
      parameter4: z.string().optional().describe('Parameter 4 label'),
      parameter5: z.string().optional().describe('Parameter 5 label'),
      parameter6: z.string().optional().describe('Parameter 6 label'),
      parameter7: z.string().optional().describe('Parameter 7 label'),
      parameter8: z.string().optional().describe('Parameter 8 label'),
      parameter9: z.string().optional().describe('Parameter 9 label'),
      parameter10: z.string().optional().describe('Parameter 10 label'),
      parameter11: z.string().optional().describe('Parameter 11 label'),
    }).optional().describe('Script parameter labels'),
    os_requirements: z.string().optional().describe('OS requirements'),
    script_contents_encoded: z.boolean().optional().describe('Whether script contents are encoded'),
  }).describe('Script configuration data to update'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for script update'),
});

const DeleteScriptSchema = z.object({
  scriptId: z.string().describe('The script ID to delete'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for script deletion'),
});

// Reporting and Analytics Schemas
const GetInventorySummarySchema = z.object({});

const GetPolicyComplianceReportSchema = z.object({
  policyId: z.string().describe('The Jamf policy ID to generate compliance report for'),
});

const GetPackageDeploymentStatsSchema = z.object({
  packageId: z.string().describe('The Jamf package ID to get deployment statistics for'),
});

const GetSoftwareVersionReportSchema = z.object({
  softwareName: z.string().describe('Name of the software to search for version information'),
});

const GetDeviceComplianceSummarySchema = z.object({});

// Computer History Schemas
const GetComputerHistorySchema = z.object({
  deviceId: z.string().describe('The Jamf computer ID to get history for'),
  subset: z.string().optional().describe('Optional subset to retrieve: General, PolicyLogs, Commands, ScreenSharing, Audits, UserLocation, MacAppStoreApplications, CasperRemote, CasperImagingLogs'),
});

const GetComputerPolicyLogsSchema = z.object({
  deviceId: z.string().describe('The Jamf computer ID to get policy logs for'),
});

const GetComputerMDMCommandHistorySchema = z.object({
  deviceId: z.string().describe('The Jamf computer ID to get MDM command history for'),
});

// Computer MDM Commands Schema
const SendComputerMDMCommandSchema = z.object({
  deviceId: z.string().describe('The Jamf computer ID (or management ID) to send the command to'),
  command: z.string().describe('The MDM command to send: DeviceLock, EraseDevice, RestartDevice, ShutDownDevice, EnableRemoteDesktop, DisableRemoteDesktop, SetRecoveryLock, UpdateInventory, UnmanageDevice'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag required for destructive commands (EraseDevice, DeviceLock, UnmanageDevice)'),
});

// Command Flush Schema
const FlushMDMCommandsSchema = z.object({
  deviceId: z.string().describe('The Jamf computer ID to flush commands for'),
  commandStatus: z.string().describe('Status of commands to flush: Pending, Failed, or Pending+Failed'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag required to flush commands'),
});

// Buildings Schemas
const ListBuildingsSchema = z.object({});

const GetBuildingDetailsSchema = z.object({
  buildingId: z.string().describe('The Jamf building ID'),
});

// Departments Schemas
const ListDepartmentsSchema = z.object({});

const GetDepartmentDetailsSchema = z.object({
  departmentId: z.string().describe('The Jamf department ID'),
});

// Categories Schemas
const ListCategoriesSchema = z.object({});

const GetCategoryDetailsSchema = z.object({
  categoryId: z.string().describe('The Jamf category ID'),
});

// LAPS Schemas
const GetLocalAdminPasswordSchema = z.object({
  clientManagementId: z.string().describe('The client management ID (UDID) of the device'),
  username: z.string().describe('The local admin account username'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag required to retrieve the password'),
});

const GetLocalAdminPasswordAuditSchema = z.object({
  clientManagementId: z.string().describe('The client management ID (UDID) of the device'),
  username: z.string().describe('The local admin account username'),
});

const GetLocalAdminPasswordAccountsSchema = z.object({
  clientManagementId: z.string().describe('The client management ID (UDID) of the device'),
});

// Patch Management Schemas
const ListPatchSoftwareTitlesSchema = z.object({});

const GetPatchSoftwareTitleDetailsSchema = z.object({
  titleId: z.string().describe('The patch software title configuration ID'),
});

const ListPatchPoliciesSchema = z.object({
  titleId: z.string().optional().describe('Optional software title configuration ID to filter by'),
});

const GetPatchPolicyDashboardSchema = z.object({
  policyId: z.string().describe('The patch policy ID'),
});

// Extension Attributes Schemas
const ListComputerExtensionAttributesSchema = z.object({});

const GetComputerExtensionAttributeDetailsSchema = z.object({
  attributeId: z.string().describe('The extension attribute ID'),
});

const CreateComputerExtensionAttributeSchema = z.object({
  name: z.string().describe('Name of the extension attribute'),
  description: z.string().optional().describe('Description of the extension attribute'),
  dataType: z.string().optional().default('String').describe('Data type: String, Integer, or Date'),
  inputType: z.string().optional().default('script').describe('Input type: script, Text Field, or Pop-up Menu'),
  scriptContents: z.string().optional().describe('Script content for script-type extension attributes'),
  inventoryDisplay: z.string().optional().default('Extension Attributes').describe('Inventory display category'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag required to create'),
});

const UpdateComputerExtensionAttributeSchema = z.object({
  attributeId: z.string().describe('The extension attribute ID to update'),
  name: z.string().optional().describe('Updated name'),
  description: z.string().optional().describe('Updated description'),
  dataType: z.string().optional().describe('Updated data type'),
  scriptContents: z.string().optional().describe('Updated script content'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag required to update'),
});

// Managed Software Updates Schemas
const ListSoftwareUpdatePlansSchema = z.object({});

const CreateSoftwareUpdatePlanSchema = z.object({
  deviceIds: z.array(z.string()).describe('Array of device IDs to target for the update'),
  updateAction: z.string().describe('Update action: DOWNLOAD_AND_INSTALL, DOWNLOAD_ONLY, or INSTALL_IMMEDIATELY'),
  versionType: z.string().describe('Version type: LATEST_MAJOR, LATEST_MINOR, or SPECIFIC_VERSION'),
  specificVersion: z.string().optional().describe('Specific OS version when versionType is SPECIFIC_VERSION'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag required to create the update plan'),
});

const GetSoftwareUpdatePlanDetailsSchema = z.object({
  planId: z.string().describe('The software update plan ID'),
});

// Computer Prestages Schemas
const ListComputerPrestagesSchema = z.object({});

const GetComputerPrestageDetailsSchema = z.object({
  prestageId: z.string().describe('The computer prestage ID'),
});

const GetComputerPrestageScopeSchema = z.object({
  prestageId: z.string().describe('The computer prestage ID'),
});

// Network Segments Schemas
const ListNetworkSegmentsSchema = z.object({});

const GetNetworkSegmentDetailsSchema = z.object({
  segmentId: z.string().describe('The network segment ID'),
});

// Mobile Prestages Schemas
const ListMobilePrestagesSchema = z.object({});

const GetMobilePrestageDetailsSchema = z.object({
  prestageId: z.string().describe('The mobile device prestage ID'),
});

// Accounts Schemas
const ListAccountsSchema = z.object({});

const GetAccountDetailsSchema = z.object({
  accountId: z.string().describe('The Jamf Pro admin account ID'),
});

const GetAccountGroupDetailsSchema = z.object({
  groupId: z.string().describe('The Jamf Pro admin group ID'),
});

// Users Schemas
const ListUsersSchema = z.object({});

const GetUserDetailsSchema = z.object({
  userId: z.string().describe('The user ID'),
});

const SearchUsersSchema = z.object({
  query: z.string().describe('Search query to match users by name or email'),
});

// App Installers Schemas
const ListAppInstallersSchema = z.object({});

const GetAppInstallerDetailsSchema = z.object({
  titleId: z.string().describe('The app installer title ID'),
});

// Restricted Software Schemas
const ListRestrictedSoftwareSchema = z.object({});

const GetRestrictedSoftwareDetailsSchema = z.object({
  softwareId: z.string().describe('The restricted software ID'),
});

// Webhooks Schemas
const ListWebhooksSchema = z.object({});

const GetWebhookDetailsSchema = z.object({
  webhookId: z.string().describe('The webhook ID'),
});

export function registerTools(server: Server, jamfClient: any): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      // ==========================================
      // Compound Tools (prefer these for common questions)
      // ==========================================
      {
        name: 'getFleetOverview',
        description: 'Get a comprehensive fleet overview in a single call. Returns inventory counts, compliance rates, and mobile device summary. Use this FIRST for fleet overview questions like "How is my fleet?" or "Give me a summary."',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getDeviceFullProfile',
        description: 'Get a complete device profile by name, serial number, or Jamf ID. Resolves the identifier automatically and fetches details, policy logs, and history in parallel. Use for "Tell me about device X" questions.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'Device name, serial number, or Jamf ID',
            },
            includePolicyLogs: {
              type: 'boolean',
              description: 'Include recent policy execution logs',
              default: false,
            },
            includeHistory: {
              type: 'boolean',
              description: 'Include device history events',
              default: false,
            },
          },
          required: ['identifier'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getSecurityPosture',
        description: 'Analyze fleet security posture: FileVault encryption rates, compliance status, and OS version currency. Samples devices in parallel for efficiency. Use for "What is our security posture?" questions.',
        inputSchema: {
          type: 'object',
          properties: {
            sampleSize: {
              type: 'number',
              description: 'Number of devices to sample for encryption check',
              default: 20,
            },
            complianceDays: {
              type: 'number',
              description: 'Number of days for compliance check-in window',
              default: 30,
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getPolicyAnalysis',
        description: 'Analyze a policy by ID or name: configuration, scope, compliance, and performance. Resolves policy name automatically. Use for "How is policy X performing?" questions.',
        inputSchema: {
          type: 'object',
          properties: {
            policyId: {
              type: 'string',
              description: 'The Jamf policy ID to analyze',
            },
            policyName: {
              type: 'string',
              description: 'Policy name to search for (used if policyId not provided)',
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      // ==========================================
      // Device Tools
      // ==========================================
      {
        name: 'searchDevices',
        description: 'Search for computers in Jamf Pro by name, serial number, IP address, username, or other criteria. For full details on a result, follow up with getDeviceDetails or getDeviceFullProfile. For batch details, use getDevicesBatch.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find devices',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 50,
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getDeviceDetails',
        description: 'Get detailed information about a specific computer including hardware, software, storage, and user details. Requires a Jamf device ID. For lookup by name or serial, use getDeviceFullProfile instead.',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The Jamf device ID',
            },
          },
          required: ['deviceId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'updateInventory',
        description: 'Force an inventory update on a specific device. This sends an MDM command to the device.',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The device ID to update inventory for',
            },
          },
          required: ['deviceId'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'checkDeviceCompliance',
        description: 'Check which devices have not reported within a specified number of days. Use this FIRST for fleet overview questions. For security-focused analysis, use getSecurityPosture instead.',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Number of days to check for compliance',
              default: 30,
            },
            includeDetails: {
              type: 'boolean',
              description: 'Include detailed device list in response',
              default: false,
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getDevicesBatch',
        description: 'Get details for multiple devices in a single request. Use INSTEAD of calling getDeviceDetails in a loop. Pass an array of device IDs.',
        inputSchema: {
          type: 'object',
          properties: {
            deviceIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of device IDs to fetch details for',
            },
            includeBasicOnly: {
              type: 'boolean',
              description: 'Return only basic info to reduce response size',
              default: false,
            },
          },
          required: ['deviceIds'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'debugDeviceDates',
        description: 'Debug tool to see raw date fields from devices',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of devices to check',
              default: 3,
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      // ==========================================
      // Policy Tools
      // ==========================================
      {
        name: 'listPolicies',
        description: 'List all policies in Jamf Pro. For policy performance analysis, use getPolicyAnalysis instead. Use searchPolicies to find by name.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of policies to return',
              default: 100,
            },
            category: {
              type: 'string',
              description: 'Filter by policy category',
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getPolicyDetails',
        description: 'Get detailed information about a specific policy including scope, scripts, and packages. For a full analysis with compliance data, use getPolicyAnalysis instead.',
        inputSchema: {
          type: 'object',
          properties: {
            policyId: {
              type: 'string',
              description: 'The Jamf policy ID',
            },
            includeScriptContent: {
              type: 'boolean',
              description: 'Include full script content for scripts in the policy',
              default: false,
            },
          },
          required: ['policyId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'searchPolicies',
        description: 'Search for policies by name or description. Returns matching policy IDs and names.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for policy name or description',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 50,
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'executePolicy',
        description: 'Execute a Jamf policy on one or more devices. DESTRUCTIVE: requires confirm=true. Use getPolicyDetails first to verify the policy configuration.',
        inputSchema: {
          type: 'object',
          properties: {
            policyId: {
              type: 'string',
              description: 'The Jamf policy ID to execute',
            },
            deviceIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of device IDs to execute the policy on',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for policy execution',
              default: false,
            },
          },
          required: ['policyId', 'deviceIds'],
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'deployScript',
        description: 'Deploy and execute a Jamf script on one or more devices. DESTRUCTIVE: requires confirm=true.',
        inputSchema: {
          type: 'object',
          properties: {
            scriptId: {
              type: 'string',
              description: 'The Jamf script ID to deploy',
            },
            deviceIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of device IDs to deploy the script to',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for script deployment',
              default: false,
            },
          },
          required: ['scriptId', 'deviceIds'],
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'getScriptDetails',
        description: 'Get detailed information about a specific script including its content, parameters, and metadata',
        inputSchema: {
          type: 'object',
          properties: {
            scriptId: {
              type: 'string',
              description: 'The Jamf script ID',
            },
          },
          required: ['scriptId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      // ==========================================
      // Configuration Profile Tools
      // ==========================================
      {
        name: 'listConfigurationProfiles',
        description: 'List all configuration profiles in Jamf Pro (computer or mobile device)',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['computer', 'mobiledevice'],
              description: 'Type of configuration profiles to list',
              default: 'computer',
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getConfigurationProfileDetails',
        description: 'Get detailed information about a specific configuration profile',
        inputSchema: {
          type: 'object',
          properties: {
            profileId: {
              type: 'string',
              description: 'The configuration profile ID',
            },
            type: {
              type: 'string',
              enum: ['computer', 'mobiledevice'],
              description: 'Type of configuration profile',
              default: 'computer',
            },
          },
          required: ['profileId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'searchConfigurationProfiles',
        description: 'Search for configuration profiles by name',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find configuration profiles by name',
            },
            type: {
              type: 'string',
              enum: ['computer', 'mobiledevice'],
              description: 'Type of configuration profiles to search',
              default: 'computer',
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'deployConfigurationProfile',
        description: 'Deploy a configuration profile to one or more devices (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            profileId: {
              type: 'string',
              description: 'The configuration profile ID to deploy',
            },
            deviceIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of device IDs to deploy the profile to',
            },
            type: {
              type: 'string',
              enum: ['computer', 'mobiledevice'],
              description: 'Type of configuration profile',
              default: 'computer',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for profile deployment',
              default: false,
            },
          },
          required: ['profileId', 'deviceIds'],
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'removeConfigurationProfile',
        description: 'Remove a configuration profile from one or more devices (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            profileId: {
              type: 'string',
              description: 'The configuration profile ID to remove',
            },
            deviceIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of device IDs to remove the profile from',
            },
            type: {
              type: 'string',
              enum: ['computer', 'mobiledevice'],
              description: 'Type of configuration profile',
              default: 'computer',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for profile removal',
              default: false,
            },
          },
          required: ['profileId', 'deviceIds'],
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'listComputerGroups',
        description: 'List computer groups in Jamf Pro (smart groups, static groups, or all)',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['smart', 'static', 'all'],
              description: 'Type of computer groups to list',
              default: 'all',
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getComputerGroupDetails',
        description: 'Get detailed information about a specific computer group including membership and criteria',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The computer group ID',
            },
          },
          required: ['groupId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'searchComputerGroups',
        description: 'Search for computer groups by name',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find computer groups by name',
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getComputerGroupMembers',
        description: 'Get all members of a specific computer group',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The computer group ID to get members for',
            },
          },
          required: ['groupId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'createStaticComputerGroup',
        description: 'Create a new static computer group with specified members (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name for the new static computer group',
            },
            computerIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of computer IDs to add to the group',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for group creation',
              default: false,
            },
          },
          required: ['name', 'computerIds'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'updateStaticComputerGroup',
        description: 'Update the membership of a static computer group (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The static computer group ID to update',
            },
            computerIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of computer IDs to set as the group membership',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for group update',
              default: false,
            },
          },
          required: ['groupId', 'computerIds'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'deleteComputerGroup',
        description: 'Delete a computer group (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The computer group ID to delete',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for group deletion',
              default: false,
            },
          },
          required: ['groupId'],
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'createAdvancedComputerSearch',
        description: 'Create an advanced computer search with custom criteria and display fields (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            searchData: {
              type: 'object',
              description: 'Advanced computer search configuration',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name for the advanced computer search',
                },
                criteria: {
                  type: 'array',
                  description: 'Search criteria',
                  items: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        description: 'Criterion name (e.g., "Last Check-in")',
                      },
                      priority: {
                        type: 'number',
                        description: 'Criterion priority (0 = first)',
                      },
                      and_or: {
                        type: 'string',
                        enum: ['and', 'or'],
                        description: 'Logical operator for combining criteria',
                      },
                      search_type: {
                        type: 'string',
                        description: 'Search type (e.g., "more than x days ago")',
                      },
                      value: {
                        type: 'string',
                        description: 'Search value',
                      },
                    },
                    required: ['name', 'priority', 'and_or', 'search_type', 'value'],
                  },
                },
                display_fields: {
                  type: 'array',
                  description: 'Fields to display in search results',
                  items: {
                    type: 'string',
                  },
                },
              },
              required: ['name'],
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for search creation',
              default: false,
            },
          },
          required: ['searchData'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'listAdvancedComputerSearches',
        description: 'List all advanced computer searches in Jamf Pro to see their names and IDs',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of searches to return',
              default: 100,
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getAdvancedComputerSearchDetails',
        description: 'Get detailed information about a specific advanced computer search including its configured fields',
        inputSchema: {
          type: 'object',
          properties: {
            searchId: {
              type: 'string',
              description: 'The ID of the advanced computer search',
            },
          },
          required: ['searchId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'deleteAdvancedComputerSearch',
        description: 'Delete an advanced computer search from Jamf Pro (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            searchId: {
              type: 'string',
              description: 'The ID of the advanced computer search to delete',
            },
            confirm: {
              type: 'boolean',
              description: 'Must be true to confirm deletion',
            },
          },
          required: ['searchId', 'confirm'],
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'searchMobileDevices',
        description: 'Search for mobile devices in Jamf Pro by name, serial number, UDID, or other criteria',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find mobile devices',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 50,
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getMobileDeviceDetails',
        description: 'Get detailed information about a specific mobile device including hardware, OS, battery, and management status',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The mobile device ID',
            },
          },
          required: ['deviceId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'listMobileDevices',
        description: 'List all mobile devices in Jamf Pro with basic information',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of mobile devices to return',
              default: 50,
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'updateMobileDeviceInventory',
        description: 'Force an inventory update on a specific mobile device',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The mobile device ID to update inventory for',
            },
          },
          required: ['deviceId'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'sendMDMCommand',
        description: 'Send an MDM command to a mobile device (e.g., lock, wipe, clear passcode) - requires confirmation for destructive actions',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The mobile device ID to send command to',
            },
            command: {
              type: 'string',
              description: 'The MDM command to send',
              enum: [
                'DeviceLock',
                'EraseDevice',
                'ClearPasscode',
                'RestartDevice',
                'ShutDownDevice',
                'EnableLostMode',
                'DisableLostMode',
                'PlayLostModeSound',
                'UpdateInventory',
                'ClearRestrictionsPassword',
                'SettingsEnableBluetooth',
                'SettingsDisableBluetooth',
                'SettingsEnableWiFi',
                'SettingsDisableWiFi',
                'SettingsEnableDataRoaming',
                'SettingsDisableDataRoaming',
                'SettingsEnableVoiceRoaming',
                'SettingsDisableVoiceRoaming',
                'SettingsEnablePersonalHotspot',
                'SettingsDisablePersonalHotspot',
              ],
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for destructive commands',
              default: false,
            },
          },
          required: ['deviceId', 'command'],
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'listMobileDeviceGroups',
        description: 'List mobile device groups in Jamf Pro (smart groups, static groups, or all)',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['smart', 'static', 'all'],
              description: 'Type of mobile device groups to list',
              default: 'all',
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getMobileDeviceGroupDetails',
        description: 'Get detailed information about a specific mobile device group including membership and criteria',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The mobile device group ID',
            },
          },
          required: ['groupId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'listPackages',
        description: 'List all packages in Jamf Pro',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of packages to return',
              default: 100,
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'searchPackages',
        description: 'Search for packages by name',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for package name',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 50,
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getPackageDetails',
        description: 'Get detailed information about a specific package',
        inputSchema: {
          type: 'object',
          properties: {
            packageId: {
              type: 'string',
              description: 'The Jamf package ID',
            },
          },
          required: ['packageId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getPackageDeploymentHistory',
        description: 'Get deployment history for a specific package',
        inputSchema: {
          type: 'object',
          properties: {
            packageId: {
              type: 'string',
              description: 'The Jamf package ID',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of deployment records to return',
              default: 50,
            },
          },
          required: ['packageId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getPoliciesUsingPackage',
        description: 'Find all policies that use a specific package',
        inputSchema: {
          type: 'object',
          properties: {
            packageId: {
              type: 'string',
              description: 'The Jamf package ID',
            },
          },
          required: ['packageId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'createPolicy',
        description: 'Create a new policy with configuration (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            policyData: {
              type: 'object',
              description: 'Policy configuration data',
              properties: {
                general: {
                  type: 'object',
                  description: 'General policy settings',
                  properties: {
                    name: { type: 'string', description: 'Policy name' },
                    enabled: { type: 'boolean', description: 'Whether the policy is enabled' },
                    trigger: { type: 'string', description: 'Policy trigger type' },
                    trigger_checkin: { type: 'boolean', description: 'Trigger on check-in' },
                    trigger_enrollment_complete: { type: 'boolean', description: 'Trigger on enrollment complete' },
                    trigger_login: { type: 'boolean', description: 'Trigger on login' },
                    trigger_logout: { type: 'boolean', description: 'Trigger on logout' },
                    trigger_network_state_changed: { type: 'boolean', description: 'Trigger on network state change' },
                    trigger_startup: { type: 'boolean', description: 'Trigger on startup' },
                    trigger_other: { type: 'string', description: 'Custom trigger name' },
                    frequency: { type: 'string', description: 'Execution frequency' },
                    category: { type: 'string', description: 'Policy category' },
                  },
                  required: ['name'],
                },
                scope: {
                  type: 'object',
                  description: 'Policy scope settings',
                  properties: {
                    all_computers: { type: 'boolean', description: 'Apply to all computers' },
                    computers: {
                      type: 'array',
                      items: { type: 'object', properties: { id: { type: 'number' } } },
                      description: 'Specific computers',
                    },
                    computer_groups: {
                      type: 'array',
                      items: { type: 'object', properties: { id: { type: 'number' } } },
                      description: 'Computer groups',
                    },
                  },
                },
                package_configuration: {
                  type: 'object',
                  description: 'Package configuration',
                  properties: {
                    packages: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'number', description: 'Package ID' },
                          action: { type: 'string', description: 'Install action' },
                        },
                        required: ['id'],
                      },
                    },
                  },
                },
                scripts: {
                  type: 'array',
                  description: 'Scripts to run',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'number', description: 'Script ID' },
                      priority: { type: 'string', description: 'Script priority (Before, After)' },
                    },
                    required: ['id'],
                  },
                },
              },
              required: ['general'],
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for policy creation',
              default: false,
            },
          },
          required: ['policyData'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'updatePolicy',
        description: 'Update an existing policy configuration (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            policyId: {
              type: 'string',
              description: 'The policy ID to update',
            },
            policyData: {
              type: 'object',
              description: 'Policy configuration data to update',
              properties: {
                general: {
                  type: 'object',
                  description: 'General policy settings to update',
                  properties: {
                    name: { type: 'string', description: 'Policy name' },
                    enabled: { type: 'boolean', description: 'Whether the policy is enabled' },
                    trigger: { type: 'string', description: 'Policy trigger type' },
                    frequency: { type: 'string', description: 'Execution frequency' },
                    category: { type: 'string', description: 'Policy category' },
                  },
                },
                scope: {
                  type: 'object',
                  description: 'Policy scope settings to update',
                },
                package_configuration: {
                  type: 'object',
                  description: 'Package configuration to update',
                },
                scripts: {
                  type: 'array',
                  description: 'Scripts to run',
                },
              },
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for policy update',
              default: false,
            },
          },
          required: ['policyId', 'policyData'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'clonePolicy',
        description: 'Clone an existing policy with a new name (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            sourcePolicyId: {
              type: 'string',
              description: 'The source policy ID to clone',
            },
            newName: {
              type: 'string',
              description: 'Name for the cloned policy',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for policy cloning',
              default: false,
            },
          },
          required: ['sourcePolicyId', 'newName'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'setPolicyEnabled',
        description: 'Enable or disable a policy (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            policyId: {
              type: 'string',
              description: 'The policy ID',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether to enable or disable the policy',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for enabling/disabling policy',
              default: false,
            },
          },
          required: ['policyId', 'enabled'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'updatePolicyScope',
        description: 'Update policy scope by adding/removing computers and groups (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            policyId: {
              type: 'string',
              description: 'The policy ID to update scope for',
            },
            scopeUpdates: {
              type: 'object',
              description: 'Scope update operations',
              properties: {
                addComputers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Computer IDs to add to scope',
                },
                removeComputers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Computer IDs to remove from scope',
                },
                addComputerGroups: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Computer group IDs to add to scope',
                },
                removeComputerGroups: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Computer group IDs to remove from scope',
                },
                replaceComputers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Replace all computers in scope with these IDs',
                },
                replaceComputerGroups: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Replace all computer groups in scope with these IDs',
                },
              },
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for scope update',
              default: false,
            },
          },
          required: ['policyId', 'scopeUpdates'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'listScripts',
        description: 'List all scripts in Jamf Pro',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of scripts to return',
              default: 100,
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'searchScripts',
        description: 'Search for scripts by name',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for script name',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 50,
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'createScript',
        description: 'Create a new script with contents and parameters (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            scriptData: {
              type: 'object',
              description: 'Script configuration data',
              properties: {
                name: {
                  type: 'string',
                  description: 'Script name',
                },
                script_contents: {
                  type: 'string',
                  description: 'Script contents',
                },
                category: {
                  type: 'string',
                  description: 'Script category',
                },
                info: {
                  type: 'string',
                  description: 'Script info/description',
                },
                notes: {
                  type: 'string',
                  description: 'Script notes',
                },
                priority: {
                  type: 'string',
                  description: 'Script priority',
                },
                parameters: {
                  type: 'object',
                  description: 'Script parameter labels',
                  properties: {
                    parameter4: { type: 'string', description: 'Parameter 4 label' },
                    parameter5: { type: 'string', description: 'Parameter 5 label' },
                    parameter6: { type: 'string', description: 'Parameter 6 label' },
                    parameter7: { type: 'string', description: 'Parameter 7 label' },
                    parameter8: { type: 'string', description: 'Parameter 8 label' },
                    parameter9: { type: 'string', description: 'Parameter 9 label' },
                    parameter10: { type: 'string', description: 'Parameter 10 label' },
                    parameter11: { type: 'string', description: 'Parameter 11 label' },
                  },
                },
                os_requirements: {
                  type: 'string',
                  description: 'OS requirements',
                },
                script_contents_encoded: {
                  type: 'boolean',
                  description: 'Whether script contents are encoded',
                },
              },
              required: ['name', 'script_contents'],
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for script creation',
              default: false,
            },
          },
          required: ['scriptData'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'updateScript',
        description: 'Update an existing script (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            scriptId: {
              type: 'string',
              description: 'The script ID to update',
            },
            scriptData: {
              type: 'object',
              description: 'Script configuration data to update',
              properties: {
                name: {
                  type: 'string',
                  description: 'Script name',
                },
                script_contents: {
                  type: 'string',
                  description: 'Script contents',
                },
                category: {
                  type: 'string',
                  description: 'Script category',
                },
                info: {
                  type: 'string',
                  description: 'Script info/description',
                },
                notes: {
                  type: 'string',
                  description: 'Script notes',
                },
                priority: {
                  type: 'string',
                  description: 'Script priority',
                },
                parameters: {
                  type: 'object',
                  description: 'Script parameter labels',
                  properties: {
                    parameter4: { type: 'string', description: 'Parameter 4 label' },
                    parameter5: { type: 'string', description: 'Parameter 5 label' },
                    parameter6: { type: 'string', description: 'Parameter 6 label' },
                    parameter7: { type: 'string', description: 'Parameter 7 label' },
                    parameter8: { type: 'string', description: 'Parameter 8 label' },
                    parameter9: { type: 'string', description: 'Parameter 9 label' },
                    parameter10: { type: 'string', description: 'Parameter 10 label' },
                    parameter11: { type: 'string', description: 'Parameter 11 label' },
                  },
                },
                os_requirements: {
                  type: 'string',
                  description: 'OS requirements',
                },
                script_contents_encoded: {
                  type: 'boolean',
                  description: 'Whether script contents are encoded',
                },
              },
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for script update',
              default: false,
            },
          },
          required: ['scriptId', 'scriptData'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'deleteScript',
        description: 'Delete a script (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            scriptId: {
              type: 'string',
              description: 'The script ID to delete',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag for script deletion',
              default: false,
            },
          },
          required: ['scriptId'],
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      // Reporting and Analytics Tools
      {
        name: 'getInventorySummary',
        description: 'Get inventory summary report including total devices, OS version distribution, and model distribution',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getPolicyComplianceReport',
        description: 'Get policy compliance report showing success/failure rates, computers in scope vs completed, and last execution times',
        inputSchema: {
          type: 'object',
          properties: {
            policyId: {
              type: 'string',
              description: 'The Jamf policy ID to generate compliance report for',
            },
          },
          required: ['policyId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getPackageDeploymentStats',
        description: 'Get package deployment statistics including policies using the package, deployment success rate, and target device count',
        inputSchema: {
          type: 'object',
          properties: {
            packageId: {
              type: 'string',
              description: 'The Jamf package ID to get deployment statistics for',
            },
          },
          required: ['packageId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getSoftwareVersionReport',
        description: 'Get software version report showing version distribution across devices and out-of-date installations',
        inputSchema: {
          type: 'object',
          properties: {
            softwareName: {
              type: 'string',
              description: 'Name of the software to search for version information',
            },
          },
          required: ['softwareName'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getDeviceComplianceSummary',
        description: 'Get device compliance summary showing devices checking in regularly, devices with failed policies, and devices missing critical software',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      // ==========================================
      // Computer History Tools
      // ==========================================
      {
        name: 'getComputerHistory',
        description: 'Get full computer history including policy logs, MDM commands, audit events, screen sharing sessions, and user/location changes',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The Jamf computer ID',
            },
            subset: {
              type: 'string',
              description: 'Optional subset: General, PolicyLogs, Commands, ScreenSharing, Audits, UserLocation, MacAppStoreApplications, CasperRemote, CasperImagingLogs',
            },
          },
          required: ['deviceId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getComputerPolicyLogs',
        description: 'Get policy execution logs for a specific computer showing which policies ran, when, and whether they succeeded or failed',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The Jamf computer ID',
            },
          },
          required: ['deviceId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getComputerMDMCommandHistory',
        description: 'Get MDM command history for a specific computer showing commands sent, their status, and timestamps',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The Jamf computer ID',
            },
          },
          required: ['deviceId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      // ==========================================
      // Computer MDM Commands
      // ==========================================
      {
        name: 'sendComputerMDMCommand',
        description: 'Send an MDM command to a macOS computer (lock, wipe, restart, shutdown, enable/disable remote desktop, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The Jamf computer ID or management ID',
            },
            command: {
              type: 'string',
              description: 'MDM command: DeviceLock, EraseDevice, RestartDevice, ShutDownDevice, EnableRemoteDesktop, DisableRemoteDesktop, SetRecoveryLock, UpdateInventory, UnmanageDevice',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation required for destructive commands',
              default: false,
            },
          },
          required: ['deviceId', 'command'],
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      // ==========================================
      // Command Flush
      // ==========================================
      {
        name: 'flushMDMCommands',
        description: 'Clear pending or failed MDM commands for a computer. Use this to unstick devices with stuck MDM command queues.',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The Jamf computer ID',
            },
            commandStatus: {
              type: 'string',
              description: 'Status of commands to flush: Pending, Failed, or Pending+Failed',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation required to flush commands',
              default: false,
            },
          },
          required: ['deviceId', 'commandStatus'],
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      // ==========================================
      // Buildings
      // ==========================================
      {
        name: 'listBuildings',
        description: 'List all buildings defined in Jamf Pro. Buildings are used for organizational scoping in multi-site deployments.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getBuildingDetails',
        description: 'Get details for a specific building including name, street address, and associated information',
        inputSchema: {
          type: 'object',
          properties: {
            buildingId: {
              type: 'string',
              description: 'The Jamf building ID',
            },
          },
          required: ['buildingId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      // ==========================================
      // Departments
      // ==========================================
      {
        name: 'listDepartments',
        description: 'List all departments defined in Jamf Pro. Departments are used for organizational scoping and reporting.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getDepartmentDetails',
        description: 'Get details for a specific department',
        inputSchema: {
          type: 'object',
          properties: {
            departmentId: {
              type: 'string',
              description: 'The Jamf department ID',
            },
          },
          required: ['departmentId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      // ==========================================
      // Categories
      // ==========================================
      {
        name: 'listCategories',
        description: 'List all categories defined in Jamf Pro. Categories are used to organize policies, scripts, packages, and configuration profiles.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getCategoryDetails',
        description: 'Get details for a specific category including its name and priority',
        inputSchema: {
          type: 'object',
          properties: {
            categoryId: {
              type: 'string',
              description: 'The Jamf category ID',
            },
          },
          required: ['categoryId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      // ==========================================
      // LAPS (Local Admin Password) Tools
      // ==========================================
      {
        name: 'getLocalAdminPassword',
        description: 'Retrieve the current local admin password (LAPS) for a device. This is a sensitive security operation that requires confirmation.',
        inputSchema: {
          type: 'object',
          properties: {
            clientManagementId: {
              type: 'string',
              description: 'The client management ID (UDID) of the device',
            },
            username: {
              type: 'string',
              description: 'The local admin account username',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation required to retrieve the password',
              default: false,
            },
          },
          required: ['clientManagementId', 'username'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getLocalAdminPasswordAudit',
        description: 'Get the audit trail of LAPS password views and rotations for a device account',
        inputSchema: {
          type: 'object',
          properties: {
            clientManagementId: {
              type: 'string',
              description: 'The client management ID (UDID) of the device',
            },
            username: {
              type: 'string',
              description: 'The local admin account username',
            },
          },
          required: ['clientManagementId', 'username'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getLocalAdminPasswordAccounts',
        description: 'List all LAPS-managed local admin accounts on a device',
        inputSchema: {
          type: 'object',
          properties: {
            clientManagementId: {
              type: 'string',
              description: 'The client management ID (UDID) of the device',
            },
          },
          required: ['clientManagementId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      // ==========================================
      // Patch Management Tools
      // ==========================================
      {
        name: 'listPatchSoftwareTitles',
        description: 'List all patch software title configurations in Jamf Pro for tracking patch compliance',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getPatchSoftwareTitleDetails',
        description: 'Get details for a specific patch software title including versions, patch definitions, and reporting data',
        inputSchema: {
          type: 'object',
          properties: {
            titleId: {
              type: 'string',
              description: 'The patch software title configuration ID',
            },
          },
          required: ['titleId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'listPatchPolicies',
        description: 'List patch policies with deployment status. Optionally filter by software title.',
        inputSchema: {
          type: 'object',
          properties: {
            titleId: {
              type: 'string',
              description: 'Optional software title configuration ID to filter by',
            },
          },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getPatchPolicyDashboard',
        description: 'Get patch policy compliance dashboard showing devices on latest version, pending updates, and failed patches',
        inputSchema: {
          type: 'object',
          properties: {
            policyId: {
              type: 'string',
              description: 'The patch policy ID',
            },
          },
          required: ['policyId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      // ==========================================
      // Extension Attributes Tools
      // ==========================================
      {
        name: 'listComputerExtensionAttributes',
        description: 'List all computer extension attributes defined in Jamf Pro. Extension attributes collect custom data via scripts.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getComputerExtensionAttributeDetails',
        description: 'Get full details for a specific extension attribute including script content, data type, and inventory display settings',
        inputSchema: {
          type: 'object',
          properties: {
            attributeId: {
              type: 'string',
              description: 'The extension attribute ID',
            },
          },
          required: ['attributeId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'createComputerExtensionAttribute',
        description: 'Create a new computer extension attribute for custom data collection',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the extension attribute',
            },
            description: {
              type: 'string',
              description: 'Description of what this EA collects',
            },
            dataType: {
              type: 'string',
              description: 'Data type: String, Integer, or Date',
              default: 'String',
            },
            inputType: {
              type: 'string',
              description: 'Input type: script, Text Field, or Pop-up Menu',
              default: 'script',
            },
            scriptContents: {
              type: 'string',
              description: 'Script content for script-type extension attributes',
            },
            inventoryDisplay: {
              type: 'string',
              description: 'Inventory display category',
              default: 'Extension Attributes',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation required to create',
              default: false,
            },
          },
          required: ['name'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'updateComputerExtensionAttribute',
        description: 'Update an existing computer extension attribute definition or script',
        inputSchema: {
          type: 'object',
          properties: {
            attributeId: {
              type: 'string',
              description: 'The extension attribute ID to update',
            },
            name: {
              type: 'string',
              description: 'Updated name',
            },
            description: {
              type: 'string',
              description: 'Updated description',
            },
            dataType: {
              type: 'string',
              description: 'Updated data type',
            },
            scriptContents: {
              type: 'string',
              description: 'Updated script content',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation required to update',
              default: false,
            },
          },
          required: ['attributeId'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },

      // ==========================================
      // Managed Software Updates Tools
      // ==========================================
      {
        name: 'listSoftwareUpdatePlans',
        description: 'List all managed software update plans in Jamf Pro including active and completed OS update plans',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'createSoftwareUpdatePlan',
        description: 'Create a managed software update plan to deploy OS updates to specific devices (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            deviceIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of device IDs to target for the update',
            },
            updateAction: {
              type: 'string',
              description: 'Update action: DOWNLOAD_AND_INSTALL, DOWNLOAD_ONLY, or INSTALL_IMMEDIATELY',
            },
            versionType: {
              type: 'string',
              description: 'Version type: LATEST_MAJOR, LATEST_MINOR, or SPECIFIC_VERSION',
            },
            specificVersion: {
              type: 'string',
              description: 'Specific OS version when versionType is SPECIFIC_VERSION',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation required to create the update plan',
              default: false,
            },
          },
          required: ['deviceIds', 'updateAction', 'versionType'],
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'getSoftwareUpdatePlanDetails',
        description: 'Get detailed status of a specific managed software update plan including target devices and progress',
        inputSchema: {
          type: 'object',
          properties: {
            planId: {
              type: 'string',
              description: 'The software update plan ID',
            },
          },
          required: ['planId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },

      // ==========================================
      // Computer Prestages Tools
      // ==========================================
      {
        name: 'listComputerPrestages',
        description: 'List all computer enrollment prestages in Jamf Pro for automated device enrollment configuration',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getComputerPrestageDetails',
        description: 'Get detailed configuration of a specific computer enrollment prestage',
        inputSchema: {
          type: 'object',
          properties: {
            prestageId: {
              type: 'string',
              description: 'The computer prestage ID',
            },
          },
          required: ['prestageId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getComputerPrestageScope',
        description: 'Get the list of devices assigned to a specific computer enrollment prestage',
        inputSchema: {
          type: 'object',
          properties: {
            prestageId: {
              type: 'string',
              description: 'The computer prestage ID',
            },
          },
          required: ['prestageId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },

      // ==========================================
      // Network Segments Tools
      // ==========================================
      {
        name: 'listNetworkSegments',
        description: 'List all network segments configured in Jamf Pro for location-based management',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getNetworkSegmentDetails',
        description: 'Get detailed information about a specific network segment including IP ranges and building assignment',
        inputSchema: {
          type: 'object',
          properties: {
            segmentId: {
              type: 'string',
              description: 'The network segment ID',
            },
          },
          required: ['segmentId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },

      // ==========================================
      // Mobile Prestages Tools
      // ==========================================
      {
        name: 'listMobilePrestages',
        description: 'List all mobile device enrollment prestages in Jamf Pro for automated mobile device enrollment',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getMobilePrestageDetails',
        description: 'Get detailed configuration of a specific mobile device enrollment prestage',
        inputSchema: {
          type: 'object',
          properties: {
            prestageId: {
              type: 'string',
              description: 'The mobile device prestage ID',
            },
          },
          required: ['prestageId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },

      // ==========================================
      // Accounts Tools
      // ==========================================
      {
        name: 'listAccounts',
        description: 'List all Jamf Pro admin accounts and groups',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getAccountDetails',
        description: 'Get details of a specific Jamf Pro admin account including privileges',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'The Jamf Pro admin account ID',
            },
          },
          required: ['accountId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getAccountGroupDetails',
        description: 'Get details of a specific Jamf Pro admin group including privileges',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The Jamf Pro admin group ID',
            },
          },
          required: ['groupId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },

      // ==========================================
      // Users Tools
      // ==========================================
      {
        name: 'listUsers',
        description: 'List all end-user records in Jamf Pro (not admin accounts)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getUserDetails',
        description: 'Get detailed information about a specific end-user record',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID',
            },
          },
          required: ['userId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'searchUsers',
        description: 'Search for end-user records by name or email address',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to match users by name or email',
            },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },

      // ==========================================
      // App Installers Tools
      // ==========================================
      {
        name: 'listAppInstallers',
        description: 'List all Jamf App Catalog installer titles',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getAppInstallerDetails',
        description: 'Get detailed information about a specific Jamf App Catalog installer title',
        inputSchema: {
          type: 'object',
          properties: {
            titleId: {
              type: 'string',
              description: 'The app installer title ID',
            },
          },
          required: ['titleId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },

      // ==========================================
      // Restricted Software Tools
      // ==========================================
      {
        name: 'listRestrictedSoftware',
        description: 'List all restricted software entries configured in Jamf Pro',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getRestrictedSoftwareDetails',
        description: 'Get detailed configuration of a specific restricted software entry',
        inputSchema: {
          type: 'object',
          properties: {
            softwareId: {
              type: 'string',
              description: 'The restricted software ID',
            },
          },
          required: ['softwareId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },

      // ==========================================
      // Webhooks Tools
      // ==========================================
      {
        name: 'listWebhooks',
        description: 'List all configured webhooks in Jamf Pro',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        name: 'getWebhookDetails',
        description: 'Get detailed configuration of a specific webhook',
        inputSchema: {
          type: 'object',
          properties: {
            webhookId: {
              type: 'string',
              description: 'The webhook ID',
            },
          },
          required: ['webhookId'],
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
    ];

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const toolResult = await (async () => {
      switch (name) {
        // ==========================================
        // Compound Tools
        // ==========================================
        case 'getFleetOverview': {
          GetFleetOverviewSchema.parse(args);
          const result = await executeGetFleetOverview(jamfClient);
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          };
          return { content: [content] };
        }

        case 'getDeviceFullProfile': {
          const params = GetDeviceFullProfileSchema.parse(args);
          const result = await executeGetDeviceFullProfile(jamfClient, params);
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          };
          return { content: [content] };
        }

        case 'getSecurityPosture': {
          const params = GetSecurityPostureSchema.parse(args);
          const result = await executeGetSecurityPosture(jamfClient, params);
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          };
          return { content: [content] };
        }

        case 'getPolicyAnalysis': {
          const params = GetPolicyAnalysisSchema.parse(args);
          const result = await executeGetPolicyAnalysis(jamfClient, params);
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          };
          return { content: [content] };
        }

        // ==========================================
        // Device Tools
        // ==========================================
        case 'searchDevices': {
          const { query, limit } = SearchDevicesSchema.parse(args);
          const devices = await jamfClient.searchComputers(query, limit);

          // Handle both modern and classic API response formats
          const formattedDevices = devices.map((d: any) => ({
            id: d.id?.toString(),
            name: d.name,
            serialNumber: d.serialNumber || d.serial_number,
            lastContactTime: d.lastContactTime || d.last_contact_time || d.last_contact_time_utc,
            osVersion: d.osVersion || d.os_version,
            ipAddress: d.ipAddress || d.ip_address || d.reported_ip_address,
            username: d.username,
            email: d.email || d.email_address,
          }));

          const rawResult = {
            count: devices.length,
            devices: formattedDevices,
          };

          const content: TextContent = {
            type: 'text',
            text: enrichResponse('searchDevices', rawResult),
          };

          return { content: [content] };
        }

        case 'getDeviceDetails': {
          const { deviceId } = GetDeviceDetailsSchema.parse(args);
          const device = await jamfClient.getComputerDetails(deviceId);
          
          // Handle both API formats
          const formatStorage = (storage: any) => {
            if (!storage) return undefined;
            
            // Modern API format
            if (storage.disks) {
              return {
                bootDriveAvailableMB: storage.bootDriveAvailableSpaceMegabytes,
                disks: storage.disks.map((disk: any) => ({
                  device: disk.device,
                  sizeMB: disk.sizeMegabytes,
                  partitions: disk.partitions?.map((p: any) => ({
                    name: p.name,
                    sizeMB: p.sizeMegabytes,
                    availableMB: p.availableMegabytes,
                    percentUsed: p.percentUsed,
                    fileVault2State: p.fileVault2State,
                  })),
                })),
              };
            }
            
            // Classic API format
            if (Array.isArray(storage)) {
              const disks = storage.map((item: any) => {
                if (item.disk) {
                  return {
                    device: item.disk.device,
                    sizeMB: item.disk.drive_capacity_mb,
                    model: item.disk.model,
                  };
                }
                if (item.partition) {
                  return {
                    partitionName: item.partition.name,
                    availableMB: item.partition.available_mb,
                    percentUsed: item.partition.percentage_full,
                    fileVault2State: item.partition.filevault2_status,
                  };
                }
                return item;
              });
              
              const bootPartition = storage.find((s: any) => 
                s.partition?.boot_drive_available_mb !== undefined
              );
              
              return {
                bootDriveAvailableMB: bootPartition?.partition?.boot_drive_available_mb,
                disks: disks,
              };
            }
            
            return storage;
          };

          const formatted = {
            id: device.id?.toString(),
            name: device.name || device.general?.name,
            general: {
              platform: device.general?.platform || device.platform,
              supervised: device.general?.supervised,
              managementUsername: device.general?.remote_management?.management_username ||
                                 device.general?.remoteManagement?.managementUsername,
              serialNumber: device.general?.serial_number || device.general?.serialNumber,
              lastContactTime: device.general?.last_contact_time || device.general?.lastContactTime,
            },
            hardware: {
              model: device.hardware?.model,
              osVersion: device.hardware?.os_version || device.hardware?.osVersion,
              processorType: device.hardware?.processor_type || device.hardware?.processorType,
              totalRamMB: device.hardware?.total_ram || device.hardware?.totalRamMegabytes,
              batteryPercent: device.hardware?.battery_capacity || device.hardware?.batteryCapacityPercent,
              appleSilicon: device.hardware?.apple_silicon || device.hardware?.appleSilicon,
            },
            userAndLocation: {
              username: device.location?.username || device.userAndLocation?.username,
              realname: device.location?.realname || device.location?.real_name || device.userAndLocation?.realname,
              email: device.location?.email_address || device.userAndLocation?.email,
              position: device.location?.position || device.userAndLocation?.position,
            },
            storage: formatStorage(device.hardware?.storage || device.storage),
          };

          const content: TextContent = {
            type: 'text',
            text: enrichResponse('getDeviceDetails', formatted),
          };

          return { content: [content] };
        }

        case 'updateInventory': {
          const { deviceId } = UpdateInventorySchema.parse(args);
          await jamfClient.updateInventory(deviceId);
          
          const content: TextContent = {
            type: 'text',
            text: `Successfully triggered inventory update for device ${deviceId}`,
          };

          return { content: [content] };
        }

        case 'checkDeviceCompliance': {
          const { days, includeDetails } = CheckDeviceComplianceSchema.parse(args);
          
          // Get all computers (with date info already included)
          const allComputers = await jamfClient.getAllComputers();
          
          const now = new Date();
          const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
          
          const results = {
            totalDevices: allComputers.length,
            compliant: 0,
            nonCompliant: 0,
            notReporting: 0,
            unknown: 0,
            complianceRate: '0%',
            summary: {
              totalDevices: allComputers.length,
              compliant: 0,
              warning: 0,
              critical: 0,
              unknown: 0,
              criticalDevices: [] as any[],
              warningDevices: [] as any[],
            },
            devices: includeDetails ? [] as any[] : undefined,
          };
          
          // Process all computers without fetching individual details
          for (const computer of allComputers) {
            // Get date from the data we already have
            const dateValue = computer.general?.last_contact_time || 
                              computer.general?.last_contact_time_utc ||
                              computer.Last_Check_in;
            
            const lastContact = parseJamfDate(dateValue);
                
            const daysSinceContact = lastContact 
              ? Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24))
              : null;
            
            const deviceInfo = {
              id: computer.id?.toString(),
              name: computer.name || computer.general?.name || computer.Computer_Name,
              serialNumber: computer.general?.serial_number || computer.Serial_Number,
              username: computer.username || computer.Full_Name,
              lastContact: lastContact?.toISOString() || 'Unknown',
              lastContactReadable: dateValue || 'Unknown',
              daysSinceContact,
              status: 'unknown' as string,
            };
            
            if (!lastContact) {
              results.unknown++;
              results.summary.unknown++;
              deviceInfo.status = 'unknown';
            } else if (lastContact < cutoffDate) {
              results.nonCompliant++;
              results.notReporting++;
              deviceInfo.status = 'non-compliant';
              
              // Categorize by severity
              if (daysSinceContact && daysSinceContact > 90) {
                results.summary.critical++;
                if (includeDetails) {
                  results.summary.criticalDevices.push({
                    ...deviceInfo,
                    severity: 'critical',
                  });
                }
              } else {
                results.summary.warning++;
                if (includeDetails) {
                  results.summary.warningDevices.push({
                    ...deviceInfo,
                    severity: 'warning',
                  });
                }
              }
            } else {
              results.compliant++;
              results.summary.compliant++;
              deviceInfo.status = 'compliant';
            }
            
            if (includeDetails && results.devices) {
              results.devices.push(deviceInfo);
            }
          }
          
          // Calculate compliance rate
          const complianceRate = results.totalDevices > 0 
            ? ((results.compliant / results.totalDevices) * 100).toFixed(1)
            : '0.0';
          results.complianceRate = `${complianceRate}%`;
          
          // Sort devices by last contact time if details included
          if (includeDetails && results.devices) {
            results.devices.sort((a, b) => {
              const dateA = new Date(a.lastContact).getTime();
              const dateB = new Date(b.lastContact).getTime();
              return dateB - dateA;
            });
          }

          // Cap output arrays to keep response size reasonable
          const MAX_CRITICAL = 50;
          const MAX_WARNING = 50;
          const MAX_DEVICES = 200;
          let truncatedNote: string | undefined;

          if (results.summary.criticalDevices.length > MAX_CRITICAL) {
            truncatedNote = `Critical devices capped to ${MAX_CRITICAL} of ${results.summary.criticalDevices.length}.`;
            results.summary.criticalDevices = results.summary.criticalDevices.slice(0, MAX_CRITICAL);
          }
          if (results.summary.warningDevices.length > MAX_WARNING) {
            truncatedNote = (truncatedNote ? truncatedNote + ' ' : '') +
              `Warning devices capped to ${MAX_WARNING} of ${results.summary.warningDevices.length}.`;
            results.summary.warningDevices = results.summary.warningDevices.slice(0, MAX_WARNING);
          }
          if (results.devices && results.devices.length > MAX_DEVICES) {
            truncatedNote = (truncatedNote ? truncatedNote + ' ' : '') +
              `Device list capped to ${MAX_DEVICES} of ${results.devices.length}.`;
            results.devices = results.devices.slice(0, MAX_DEVICES);
          }
          if (truncatedNote) {
            (results as any).truncatedNote = truncatedNote;
          }

          const content: TextContent = {
            type: 'text',
            text: enrichResponse('checkDeviceCompliance', results),
          };

          return { content: [content] };
        }

        case 'debugDeviceDates': {
          const { limit } = args as { limit?: number };
          const devices = await jamfClient.searchComputers('', limit || 3);
          
          const debugInfo = {
            deviceCount: devices.length,
            sampleDevices: devices.map((device: any) => {
              const dateFields: any = {};
              
              // Check all possible date field names
              const possibleDateFields = [
                'last_contact_time',
                'last_contact_time_epoch', 
                'last_contact_time_utc',
                'lastContactTime',
                'report_date',
                'report_date_epoch',
                'report_date_utc',
                'reportDate'
              ];
              
              possibleDateFields.forEach(field => {
                if (device[field] !== undefined) {
                  dateFields[field] = device[field];
                }
              });
              
              return {
                id: device.id,
                name: device.name,
                allKeys: Object.keys(device),
                dateFields: dateFields,
                rawDevice: device
              };
            })
          };
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(debugInfo, null, 2),
          };
          
          return { content: [content] };
        }

        case 'getDevicesBatch': {
          const { deviceIds } = GetDevicesBatchSchema.parse(args);

          const MAX_BATCH = 25;
          const cappedIds = deviceIds.slice(0, MAX_BATCH);
          const devices = [];
          const errors = [];

          for (const deviceId of cappedIds) {
            try {
              const device = await jamfClient.getComputerDetails(deviceId);

              // Always return trimmed fields to keep response small
              devices.push({
                id: device.id?.toString(),
                name: device.name || device.general?.name,
                serialNumber: device.general?.serial_number || device.serialNumber,
                lastContactTime: device.general?.last_contact_time || device.lastContactTime,
                osVersion: device.hardware?.os_version || device.osVersion,
                username: device.location?.username || device.username,
                model: device.hardware?.model || device.hardware?.modelIdentifier,
              });
            } catch (error) {
              errors.push({
                deviceId,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }

          const result: any = {
            requested: deviceIds.length,
            returned: devices.length,
            successful: devices.length,
            failed: errors.length,
            devices,
            errors: errors.length > 0 ? errors : undefined,
          };
          if (deviceIds.length > MAX_BATCH) {
            result.note = `Capped to ${MAX_BATCH} devices. Use multiple calls for larger batches.`;
          }

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          };

          return { content: [content] };
        }

        case 'listPolicies': {
          const { limit, category } = ListPoliciesSchema.parse(args);
          
          let policies = await jamfClient.listPolicies(limit);
          
          // Filter by category if provided
          if (category) {
            policies = policies.filter((p: any) => 
              p.category?.toLowerCase().includes(category.toLowerCase())
            );
          }
          
          const policyListResult = {
            totalPolicies: policies.length,
            policies: policies.map((p: any) => ({
              id: p.id,
              name: p.name,
              category: p.category,
            })),
          };

          const content: TextContent = {
            type: 'text',
            text: enrichResponse('listPolicies', policyListResult),
          };

          return { content: [content] };
        }

        case 'getPolicyDetails': {
          const { policyId, includeScriptContent } = GetPolicyDetailsSchema.parse(args);
          
          const policyDetails = await jamfClient.getPolicyDetails(policyId);
          
          // If includeScriptContent is true, fetch full script details for each script
          if (includeScriptContent && policyDetails.scripts && policyDetails.scripts.length > 0) {
            for (let i = 0; i < policyDetails.scripts.length; i++) {
              const script = policyDetails.scripts[i];
              if (script.id) {
                try {
                  const scriptDetails = await jamfClient.getScriptDetails(script.id.toString());
                  policyDetails.scripts[i] = {
                    ...script,
                    scriptContent: scriptDetails.scriptContents || scriptDetails.script_contents,
                    fullDetails: scriptDetails,
                  };
                } catch (error) {
                  console.error(`Failed to fetch script details for script ${script.id}:`, error);
                  policyDetails.scripts[i] = {
                    ...script,
                    scriptContentError: `Failed to fetch script content: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  };
                }
              }
            }
          }
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(policyDetails, null, 2),
          };

          return { content: [content] };
        }

        case 'searchPolicies': {
          const { query, limit } = SearchPoliciesSchema.parse(args);
          
          const policies = await jamfClient.searchPolicies(query, limit);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              query,
              totalResults: policies.length,
              policies,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'executePolicy': {
          const { policyId, deviceIds, confirm } = ExecutePolicySchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Policy execution requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          await jamfClient.executePolicy(policyId, deviceIds);
          
          const content: TextContent = {
            type: 'text',
            text: `Successfully triggered policy ${policyId} on ${deviceIds.length} device(s)`,
          };

          return { content: [content] };
        }

        case 'deployScript': {
          const { scriptId, deviceIds, confirm } = DeployScriptSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Script deployment requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          try {
            await jamfClient.deployScript(scriptId, deviceIds);
            
            const content: TextContent = {
              type: 'text',
              text: `Successfully deployed script ${scriptId} to ${deviceIds.length} device(s)`,
            };

            return { content: [content] };
          } catch (error) {
            // Check if it's the not implemented error
            if (error instanceof Error && error.message.includes('not implemented for Classic API')) {
              const content: TextContent = {
                type: 'text',
                text: 'Script deployment is not available in the Classic API. Please use policies to deploy scripts instead.',
              };
              return { content: [content] };
            }
            throw error;
          }
        }

        case 'getScriptDetails': {
          const { scriptId } = GetScriptDetailsSchema.parse(args);
          const scriptDetails = await jamfClient.getScriptDetails(scriptId);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(scriptDetails, null, 2),
          };

          return { content: [content] };
        }

        case 'listConfigurationProfiles': {
          const { type } = ListConfigurationProfilesSchema.parse(args);
          const profiles = await jamfClient.listConfigurationProfiles(type);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              type: type,
              count: profiles.length,
              profiles: profiles.map((p: any) => ({
                id: p.id,
                name: p.name || p.displayName,
                description: p.description,
                category: p.category?.name || p.category_name,
                level: p.level || p.distribution_method,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getConfigurationProfileDetails': {
          const { profileId, type } = GetConfigurationProfileDetailsSchema.parse(args);
          const profile = await jamfClient.getConfigurationProfileDetails(profileId, type);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(profile, null, 2),
          };

          return { content: [content] };
        }

        case 'searchConfigurationProfiles': {
          const { query, type } = SearchConfigurationProfilesSchema.parse(args);
          const profiles = await jamfClient.searchConfigurationProfiles(query, type);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              type: type,
              query: query,
              count: profiles.length,
              profiles: profiles.map((p: any) => ({
                id: p.id,
                name: p.name || p.displayName,
                description: p.description,
                category: p.category?.name || p.category_name,
                level: p.level || p.distribution_method,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'deployConfigurationProfile': {
          const { profileId, deviceIds, type, confirm } = DeployConfigurationProfileSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Configuration profile deployment requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          await jamfClient.deployConfigurationProfile(profileId, deviceIds, type);
          
          const content: TextContent = {
            type: 'text',
            text: `Successfully deployed ${type} configuration profile ${profileId} to ${deviceIds.length} device(s)`,
          };

          return { content: [content] };
        }

        case 'removeConfigurationProfile': {
          const { profileId, deviceIds, type, confirm } = RemoveConfigurationProfileSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Configuration profile removal requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          await jamfClient.removeConfigurationProfile(profileId, deviceIds, type);
          
          const content: TextContent = {
            type: 'text',
            text: `Successfully removed ${type} configuration profile ${profileId} from ${deviceIds.length} device(s)`,
          };

          return { content: [content] };
        }

        case 'listComputerGroups': {
          const { type } = ListComputerGroupsSchema.parse(args);
          const groups = await jamfClient.listComputerGroups(type);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              type: type,
              count: groups.length,
              groups: groups.map((g: any) => ({
                id: g.id,
                name: g.name,
                isSmart: g.is_smart ?? g.isSmart,
                memberCount: g.size || g.computers?.length || 0,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getComputerGroupDetails': {
          const { groupId } = GetComputerGroupDetailsSchema.parse(args);
          const group = await jamfClient.getComputerGroupDetails(groupId);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              id: group.id,
              name: group.name,
              isSmart: group.is_smart ?? group.isSmart,
              memberCount: group.memberCount || group.computers?.length || 0,
              criteria: group.criteria,
              site: group.site,
              computers: group.computers?.map((c: any) => ({
                id: c.id,
                name: c.name,
                serialNumber: c.serial_number || c.serialNumber,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'searchComputerGroups': {
          const { query } = SearchComputerGroupsSchema.parse(args);
          const groups = await jamfClient.searchComputerGroups(query);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              query: query,
              count: groups.length,
              groups: groups.map((g: any) => ({
                id: g.id,
                name: g.name,
                isSmart: g.is_smart ?? g.isSmart,
                memberCount: g.size || g.computers?.length || 0,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getComputerGroupMembers': {
          const { groupId } = GetComputerGroupMembersSchema.parse(args);
          const members = await jamfClient.getComputerGroupMembers(groupId);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              groupId: groupId,
              count: members.length,
              members: members.map((m: any) => ({
                id: m.id,
                name: m.name,
                serialNumber: m.serial_number || m.serialNumber,
                macAddress: m.mac_address || m.macAddress,
                username: m.username,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'createStaticComputerGroup': {
          const { name, computerIds, confirm } = CreateStaticComputerGroupSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Static computer group creation requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const group = await jamfClient.createStaticComputerGroup(name, computerIds);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: `Successfully created static computer group "${name}"`,
              group: {
                id: group.id,
                name: group.name,
                memberCount: computerIds.length,
              },
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'updateStaticComputerGroup': {
          const { groupId, computerIds, confirm } = UpdateStaticComputerGroupSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Static computer group update requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const group = await jamfClient.updateStaticComputerGroup(groupId, computerIds);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: `Successfully updated static computer group ${groupId}`,
              group: {
                id: group.id,
                name: group.name,
                memberCount: computerIds.length,
              },
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'deleteComputerGroup': {
          const { groupId, confirm } = DeleteComputerGroupSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Computer group deletion requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          await jamfClient.deleteComputerGroup(groupId);
          
          const content: TextContent = {
            type: 'text',
            text: `Successfully deleted computer group ${groupId}`,
          };

          return { content: [content] };
        }

        case 'createAdvancedComputerSearch': {
          const { searchData, confirm } = CreateAdvancedComputerSearchSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Advanced computer search creation requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const result = await jamfClient.createAdvancedComputerSearch(searchData);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: `Successfully created advanced computer search "${searchData.name}"`,
              search: {
                id: result.id,
                name: result.name,
                criteria: result.criteria,
                displayFields: result.display_fields,
              },
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'listAdvancedComputerSearches': {
          const { limit } = ListAdvancedComputerSearchesSchema.parse(args);
          const searches = await jamfClient.listAdvancedComputerSearches(limit);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              count: searches.length,
              searches: searches.map((s: any) => ({
                id: s.id,
                name: s.name,
                criteriaCount: s.criteria?.length || 0,
                displayFieldsCount: s.display_fields?.length || 0,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getAdvancedComputerSearchDetails': {
          const { searchId } = GetAdvancedComputerSearchDetailsSchema.parse(args);
          const searchDetails = await jamfClient.getAdvancedComputerSearchDetails(searchId);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              id: searchDetails.id,
              name: searchDetails.name,
              criteria: searchDetails.criteria,
              displayFields: searchDetails.display_fields,
              site: searchDetails.site,
              sort: searchDetails.sort,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'deleteAdvancedComputerSearch': {
          const { searchId, confirm } = DeleteAdvancedComputerSearchSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Advanced computer search deletion requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          await jamfClient.deleteAdvancedComputerSearch(searchId);
          
          const content: TextContent = {
            type: 'text',
            text: `Successfully deleted advanced computer search ${searchId}`,
          };

          return { content: [content] };
        }

        case 'searchMobileDevices': {
          const { query, limit } = SearchMobileDevicesSchema.parse(args);
          const mobileResults = await jamfClient.searchMobileDevices(query, limit);

          const mobileData = {
            count: mobileResults.length,
            devices: mobileResults.map((d: any) => ({
              id: d.id,
              name: d.name,
              serialNumber: d.serial_number || d.serialNumber,
              udid: d.udid,
              model: d.model || d.modelDisplay,
              osVersion: d.os_version || d.osVersion,
              batteryLevel: d.battery_level || d.batteryLevel,
              managed: d.managed,
              supervised: d.supervised,
            })),
          };

          const content: TextContent = {
            type: 'text',
            text: enrichResponse('searchMobileDevices', mobileData),
          };

          return { content: [content] };
        }

        case 'getMobileDeviceDetails': {
          const { deviceId } = GetMobileDeviceDetailsSchema.parse(args);
          const device = await jamfClient.getMobileDeviceDetails(deviceId);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              id: device.id,
              name: device.name || device.general?.name,
              udid: device.udid || device.general?.udid,
              serialNumber: device.serial_number || device.general?.serialNumber,
              model: device.model || device.hardware?.model,
              modelDisplay: device.model_display || device.hardware?.modelDisplay,
              osVersion: device.os_version || device.general?.osVersion,
              osType: device.os_type || device.general?.osType,
              batteryLevel: device.battery_level || device.general?.batteryLevel,
              deviceCapacity: device.device_capacity_mb || device.general?.deviceCapacityMb,
              availableCapacity: device.available_device_capacity_mb || device.general?.availableDeviceCapacityMb,
              managed: device.managed || device.general?.managed,
              supervised: device.supervised || device.general?.supervised,
              deviceOwnershipLevel: device.device_ownership_level || device.general?.deviceOwnershipLevel,
              lastInventoryUpdate: device.last_inventory_update || device.general?.lastInventoryUpdate,
              ipAddress: device.ip_address || device.general?.ipAddress,
              wifiMacAddress: device.wifi_mac_address || device.general?.wifiMacAddress,
              bluetoothMacAddress: device.bluetooth_mac_address || device.general?.bluetoothMacAddress,
              user: {
                username: device.location?.username || device.userAndLocation?.username,
                realName: device.location?.real_name || device.userAndLocation?.realName,
                email: device.location?.email_address || device.userAndLocation?.email,
                position: device.location?.position || device.userAndLocation?.position,
                phoneNumber: device.location?.phone_number || device.userAndLocation?.phoneNumber,
              },
              applications: device.applications?.length || 0,
              certificates: device.certificates?.length || 0,
              configurationProfiles: device.configuration_profiles?.length || 0,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'listMobileDevices': {
          const { limit } = ListMobileDevicesSchema.parse(args);
          const devices = await jamfClient.listMobileDevices(limit);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              count: devices.length,
              devices: devices.map((d: any) => ({
                id: d.id,
                name: d.name,
                serialNumber: d.serial_number || d.serialNumber,
                udid: d.udid,
                model: d.model || d.modelDisplay,
                osVersion: d.os_version || d.osVersion,
                batteryLevel: d.battery_level || d.batteryLevel,
                managed: d.managed,
                supervised: d.supervised,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'updateMobileDeviceInventory': {
          const { deviceId } = UpdateMobileDeviceInventorySchema.parse(args);
          await jamfClient.updateMobileDeviceInventory(deviceId);
          
          const content: TextContent = {
            type: 'text',
            text: `Successfully triggered inventory update for mobile device ${deviceId}`,
          };

          return { content: [content] };
        }

        case 'sendMDMCommand': {
          const { deviceId, command, confirm } = SendMDMCommandSchema.parse(args);
          
          // Destructive commands require confirmation
          const destructiveCommands = ['EraseDevice', 'ClearPasscode', 'ClearRestrictionsPassword'];
          if (destructiveCommands.includes(command) && !confirm) {
            const content: TextContent = {
              type: 'text',
              text: `MDM command '${command}' is destructive and requires confirmation. Please set confirm: true to proceed.`,
            };
            return { content: [content] };
          }

          await jamfClient.sendMDMCommand(deviceId, command);
          
          const content: TextContent = {
            type: 'text',
            text: `Successfully sent MDM command '${command}' to mobile device ${deviceId}`,
          };

          return { content: [content] };
        }

        case 'listMobileDeviceGroups': {
          const { type } = ListMobileDeviceGroupsSchema.parse(args);
          const groups = await jamfClient.getMobileDeviceGroups(type);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              type: type,
              count: groups.length,
              groups: groups.map((g: any) => ({
                id: g.id,
                name: g.name,
                isSmart: g.is_smart ?? g.isSmart,
                memberCount: g.size || g.mobile_devices?.length || 0,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getMobileDeviceGroupDetails': {
          const { groupId } = GetMobileDeviceGroupDetailsSchema.parse(args);
          const group = await jamfClient.getMobileDeviceGroupDetails(groupId);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              id: group.id,
              name: group.name,
              isSmart: group.is_smart ?? group.isSmart,
              memberCount: group.memberCount || group.mobile_devices?.length || 0,
              criteria: group.criteria,
              site: group.site,
              mobileDevices: group.mobile_devices?.map((d: any) => ({
                id: d.id,
                name: d.name,
                serialNumber: d.serial_number || d.serialNumber,
                udid: d.udid,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'listPackages': {
          const { limit } = ListPackagesSchema.parse(args);
          const packages = await jamfClient.listPackages(limit);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              count: packages.length,
              packages: packages.map((p: any) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                filename: p.filename,
                size: p.size,
                priority: p.priority,
                fillUserTemplate: p.fill_user_template,
                fillExistingUsers: p.fill_existing_users,
                rebootRequired: p.reboot_required,
                osRequirements: p.os_requirements,
                requiredProcessor: p.required_processor,
                info: p.info,
                notes: p.notes,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'searchPackages': {
          const { query, limit } = SearchPackagesSchema.parse(args);
          const packages = await jamfClient.searchPackages(query, limit);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              query: query,
              count: packages.length,
              packages: packages.map((p: any) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                filename: p.filename,
                size: p.size,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getPackageDetails': {
          const { packageId } = GetPackageDetailsSchema.parse(args);
          const packageDetails = await jamfClient.getPackageDetails(packageId);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(packageDetails, null, 2),
          };

          return { content: [content] };
        }

        case 'getPackageDeploymentHistory': {
          const { packageId, limit } = GetPackageDeploymentHistorySchema.parse(args);
          const history = await jamfClient.getPackageDeploymentHistory(packageId, limit);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              packageId: packageId,
              deploymentCount: history.length,
              deployments: history.map((d: any) => ({
                date: d.date_completed_utc || d.date_completed,
                status: d.status,
                deviceName: d.computer_name || d.device_name,
                deviceId: d.computer_id || d.device_id,
                username: d.username,
                policyName: d.policy_name,
                policyId: d.policy_id,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getPoliciesUsingPackage': {
          const { packageId } = GetPoliciesUsingPackageSchema.parse(args);
          const policies = await jamfClient.getPoliciesUsingPackage(packageId);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              packageId: packageId,
              policyCount: policies.length,
              policies: policies.map((p: any) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                enabled: p.enabled,
                frequency: p.frequency,
                targetDrive: p.target_drive,
                scope: {
                  allComputers: p.scope?.all_computers,
                  computerCount: p.scope?.computers?.length || 0,
                  groupCount: p.scope?.computer_groups?.length || 0,
                },
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'createPolicy': {
          const { policyData, confirm } = CreatePolicySchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Policy creation requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const createdPolicy = await jamfClient.createPolicy(policyData);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: 'Policy created successfully',
              policy: {
                id: createdPolicy.id,
                name: createdPolicy.general?.name || policyData.general.name,
                enabled: createdPolicy.general?.enabled,
                trigger: createdPolicy.general?.trigger,
                frequency: createdPolicy.general?.frequency,
                category: createdPolicy.general?.category,
              },
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'updatePolicy': {
          const { policyId, policyData, confirm } = UpdatePolicySchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Policy update requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const updatedPolicy = await jamfClient.updatePolicy(policyId, policyData);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: 'Policy updated successfully',
              policy: {
                id: updatedPolicy.id,
                name: updatedPolicy.general?.name,
                enabled: updatedPolicy.general?.enabled,
                trigger: updatedPolicy.general?.trigger,
                frequency: updatedPolicy.general?.frequency,
                category: updatedPolicy.general?.category,
              },
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'clonePolicy': {
          const { sourcePolicyId, newName, confirm } = ClonePolicySchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Policy cloning requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const clonedPolicy = await jamfClient.clonePolicy(sourcePolicyId, newName);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: 'Policy cloned successfully',
              originalPolicyId: sourcePolicyId,
              clonedPolicy: {
                id: clonedPolicy.id,
                name: clonedPolicy.general?.name || newName,
                enabled: clonedPolicy.general?.enabled,
                trigger: clonedPolicy.general?.trigger,
                frequency: clonedPolicy.general?.frequency,
                category: clonedPolicy.general?.category,
              },
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'setPolicyEnabled': {
          const { policyId, enabled, confirm } = SetPolicyEnabledSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: `${enabled ? 'Enabling' : 'Disabling'} policy requires confirmation. Please set confirm: true to proceed.`,
            };
            return { content: [content] };
          }

          const updatedPolicy = await jamfClient.setPolicyEnabled(policyId, enabled);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: `Policy ${enabled ? 'enabled' : 'disabled'} successfully`,
              policy: {
                id: updatedPolicy.id,
                name: updatedPolicy.general?.name,
                enabled: updatedPolicy.general?.enabled,
              },
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'updatePolicyScope': {
          const { policyId, scopeUpdates, confirm } = UpdatePolicyScopeSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Policy scope update requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const updatedPolicy = await jamfClient.updatePolicyScope(policyId, scopeUpdates);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: 'Policy scope updated successfully',
              policy: {
                id: updatedPolicy.id,
                name: updatedPolicy.general?.name,
                scope: {
                  all_computers: updatedPolicy.scope?.all_computers,
                  computerCount: updatedPolicy.scope?.computers?.length || 0,
                  computerGroupCount: updatedPolicy.scope?.computer_groups?.length || 0,
                  buildingCount: updatedPolicy.scope?.buildings?.length || 0,
                  departmentCount: updatedPolicy.scope?.departments?.length || 0,
                },
              },
              scopeUpdates: scopeUpdates,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'listScripts': {
          const { limit } = ListScriptsSchema.parse(args);
          const scripts = await jamfClient.listScripts(limit);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              count: scripts.length,
              scripts: scripts.map((s: any) => ({
                id: s.id,
                name: s.name,
                category: s.category,
                filename: s.filename,
                priority: s.priority,
                info: s.info,
                notes: s.notes,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'searchScripts': {
          const { query, limit } = SearchScriptsSchema.parse(args);
          const scripts = await jamfClient.searchScripts(query, limit);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              query: query,
              count: scripts.length,
              scripts: scripts.map((s: any) => ({
                id: s.id,
                name: s.name,
                category: s.category,
                filename: s.filename,
                priority: s.priority,
                info: s.info,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'createScript': {
          const { scriptData, confirm } = CreateScriptSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Script creation requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const createdScript = await jamfClient.createScript(scriptData);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: 'Script created successfully',
              script: {
                id: createdScript.id,
                name: createdScript.name,
                category: createdScript.category,
                filename: createdScript.filename,
                priority: createdScript.priority,
                info: createdScript.info,
                notes: createdScript.notes,
                parameters: createdScript.parameters,
                osRequirements: createdScript.osRequirements,
              },
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'updateScript': {
          const { scriptId, scriptData, confirm } = UpdateScriptSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Script update requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const updatedScript = await jamfClient.updateScript(scriptId, scriptData);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: 'Script updated successfully',
              script: {
                id: updatedScript.id,
                name: updatedScript.name,
                category: updatedScript.category,
                filename: updatedScript.filename,
                priority: updatedScript.priority,
                info: updatedScript.info,
                notes: updatedScript.notes,
                parameters: updatedScript.parameters,
                osRequirements: updatedScript.osRequirements,
              },
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'deleteScript': {
          const { scriptId, confirm } = DeleteScriptSchema.parse(args);
          
          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Script deletion requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          await jamfClient.deleteScript(scriptId);
          
          const content: TextContent = {
            type: 'text',
            text: `Successfully deleted script ${scriptId}`,
          };

          return { content: [content] };
        }

        // Reporting and Analytics Tools
        case 'getInventorySummary': {
          GetInventorySummarySchema.parse(args);
          const report = await jamfClient.getInventorySummary();

          const content: TextContent = {
            type: 'text',
            text: enrichResponse('getInventorySummary', report),
          };

          return { content: [content] };
        }

        case 'getPolicyComplianceReport': {
          const { policyId } = GetPolicyComplianceReportSchema.parse(args);
          const report = await jamfClient.getPolicyComplianceReport(policyId);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(report, null, 2),
          };

          return { content: [content] };
        }

        case 'getPackageDeploymentStats': {
          const { packageId } = GetPackageDeploymentStatsSchema.parse(args);
          const stats = await jamfClient.getPackageDeploymentStats(packageId);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(stats, null, 2),
          };

          return { content: [content] };
        }

        case 'getSoftwareVersionReport': {
          const { softwareName } = GetSoftwareVersionReportSchema.parse(args);
          const report = await jamfClient.getSoftwareVersionReport(softwareName);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(report, null, 2),
          };

          return { content: [content] };
        }

        case 'getDeviceComplianceSummary': {
          GetDeviceComplianceSummarySchema.parse(args);
          const compSummary = await jamfClient.getDeviceComplianceSummary();

          const content: TextContent = {
            type: 'text',
            text: enrichResponse('getDeviceComplianceSummary', compSummary),
          };

          return { content: [content] };
        }

        // ==========================================
        // Computer History Tools
        // ==========================================

        case 'getComputerHistory': {
          const { deviceId, subset } = GetComputerHistorySchema.parse(args);
          const history = await jamfClient.getComputerHistory(deviceId, subset);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(history, null, 2),
          };

          return { content: [content] };
        }

        case 'getComputerPolicyLogs': {
          const { deviceId } = GetComputerPolicyLogsSchema.parse(args);
          const policyLogs = await jamfClient.getComputerPolicyLogs(deviceId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(policyLogs, null, 2),
          };

          return { content: [content] };
        }

        case 'getComputerMDMCommandHistory': {
          const { deviceId } = GetComputerMDMCommandHistorySchema.parse(args);
          const commandHistory = await jamfClient.getComputerMDMCommandHistory(deviceId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(commandHistory, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Computer MDM Commands
        // ==========================================

        case 'sendComputerMDMCommand': {
          const { deviceId, command, confirm } = SendComputerMDMCommandSchema.parse(args);

          const destructiveCommands = ['EraseDevice', 'DeviceLock', 'UnmanageDevice'];
          if (destructiveCommands.includes(command) && !confirm) {
            const content: TextContent = {
              type: 'text',
              text: `Computer MDM command '${command}' is destructive and requires confirmation. Please set confirm: true to proceed.`,
            };
            return { content: [content] };
          }

          const result = await jamfClient.sendComputerMDMCommand(deviceId, command);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: `Successfully sent MDM command '${command}' to computer ${deviceId}`,
              result,
            }, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Command Flush
        // ==========================================

        case 'flushMDMCommands': {
          const { deviceId, commandStatus, confirm } = FlushMDMCommandsSchema.parse(args);

          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: `Flushing ${commandStatus} MDM commands requires confirmation. Please set confirm: true to proceed.`,
            };
            return { content: [content] };
          }

          await jamfClient.flushMDMCommands(deviceId, commandStatus);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: `Successfully flushed ${commandStatus} MDM commands for computer ${deviceId}`,
            }, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Buildings
        // ==========================================

        case 'listBuildings': {
          ListBuildingsSchema.parse(args);
          const buildings = await jamfClient.listBuildings();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalBuildings: buildings.length,
              buildings,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getBuildingDetails': {
          const { buildingId } = GetBuildingDetailsSchema.parse(args);
          const building = await jamfClient.getBuildingDetails(buildingId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(building, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Departments
        // ==========================================

        case 'listDepartments': {
          ListDepartmentsSchema.parse(args);
          const departments = await jamfClient.listDepartments();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalDepartments: departments.length,
              departments,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getDepartmentDetails': {
          const { departmentId } = GetDepartmentDetailsSchema.parse(args);
          const department = await jamfClient.getDepartmentDetails(departmentId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(department, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Categories
        // ==========================================

        case 'listCategories': {
          ListCategoriesSchema.parse(args);
          const categories = await jamfClient.listCategories();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalCategories: categories.length,
              categories,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getCategoryDetails': {
          const { categoryId } = GetCategoryDetailsSchema.parse(args);
          const category = await jamfClient.getCategoryDetails(categoryId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(category, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // LAPS (Local Admin Password) Tools
        // ==========================================

        case 'getLocalAdminPassword': {
          const { clientManagementId, username, confirm } = GetLocalAdminPasswordSchema.parse(args);

          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Retrieving a LAPS password is a sensitive security operation. This action will be logged in the audit trail. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const password = await jamfClient.getLocalAdminPassword(clientManagementId, username);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: `LAPS password retrieved for account '${username}' on device ${clientManagementId}. This access has been logged.`,
              ...password,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getLocalAdminPasswordAudit': {
          const { clientManagementId, username } = GetLocalAdminPasswordAuditSchema.parse(args);
          const audit = await jamfClient.getLocalAdminPasswordAudit(clientManagementId, username);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(audit, null, 2),
          };

          return { content: [content] };
        }

        case 'getLocalAdminPasswordAccounts': {
          const { clientManagementId } = GetLocalAdminPasswordAccountsSchema.parse(args);
          const accounts = await jamfClient.getLocalAdminPasswordAccounts(clientManagementId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(accounts, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Patch Management Tools
        // ==========================================

        case 'listPatchSoftwareTitles': {
          ListPatchSoftwareTitlesSchema.parse(args);
          const titles = await jamfClient.listPatchSoftwareTitles();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalTitles: titles.length,
              titles,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getPatchSoftwareTitleDetails': {
          const { titleId } = GetPatchSoftwareTitleDetailsSchema.parse(args);
          const title = await jamfClient.getPatchSoftwareTitleDetails(titleId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(title, null, 2),
          };

          return { content: [content] };
        }

        case 'listPatchPolicies': {
          const { titleId } = ListPatchPoliciesSchema.parse(args);
          const policies = await jamfClient.listPatchPolicies(titleId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalPolicies: policies.length,
              policies,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getPatchPolicyDashboard': {
          const { policyId } = GetPatchPolicyDashboardSchema.parse(args);
          const dashboard = await jamfClient.getPatchPolicyDashboard(policyId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(dashboard, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Extension Attributes Tools
        // ==========================================

        case 'listComputerExtensionAttributes': {
          ListComputerExtensionAttributesSchema.parse(args);
          const attributes = await jamfClient.listComputerExtensionAttributes();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalAttributes: attributes.length,
              attributes,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getComputerExtensionAttributeDetails': {
          const { attributeId } = GetComputerExtensionAttributeDetailsSchema.parse(args);
          const attribute = await jamfClient.getComputerExtensionAttributeDetails(attributeId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(attribute, null, 2),
          };

          return { content: [content] };
        }

        case 'createComputerExtensionAttribute': {
          const { name, description, dataType, inputType, scriptContents, inventoryDisplay, confirm } = CreateComputerExtensionAttributeSchema.parse(args);

          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Creating an extension attribute requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const result = await jamfClient.createComputerExtensionAttribute({
            name,
            description,
            dataType,
            inputType,
            scriptContents,
            inventoryDisplay,
          });

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: `Successfully created extension attribute "${name}"`,
              result,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'updateComputerExtensionAttribute': {
          const { attributeId, name, description, dataType, scriptContents, confirm } = UpdateComputerExtensionAttributeSchema.parse(args);

          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Updating an extension attribute requires confirmation. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const updateData: any = {};
          if (name) updateData.name = name;
          if (description !== undefined) updateData.description = description;
          if (dataType) updateData.dataType = dataType;
          if (scriptContents) updateData.scriptContents = scriptContents;

          const result = await jamfClient.updateComputerExtensionAttribute(attributeId, updateData);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: `Successfully updated extension attribute ${attributeId}`,
              result,
            }, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Managed Software Updates Tools
        // ==========================================

        case 'listSoftwareUpdatePlans': {
          ListSoftwareUpdatePlansSchema.parse(args);
          const plans = await jamfClient.listSoftwareUpdatePlans();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalPlans: plans.length,
              plans,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'createSoftwareUpdatePlan': {
          const { deviceIds, updateAction, versionType, specificVersion, confirm } = CreateSoftwareUpdatePlanSchema.parse(args);

          if (!confirm) {
            const content: TextContent = {
              type: 'text',
              text: 'Creating a software update plan requires confirmation. This will initiate OS updates on the specified devices. Please set confirm: true to proceed.',
            };
            return { content: [content] };
          }

          const result = await jamfClient.createSoftwareUpdatePlan(deviceIds, updateAction, versionType, specificVersion);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              message: `Successfully created software update plan for ${deviceIds.length} device(s)`,
              result,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getSoftwareUpdatePlanDetails': {
          const { planId } = GetSoftwareUpdatePlanDetailsSchema.parse(args);
          const plan = await jamfClient.getSoftwareUpdatePlanDetails(planId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(plan, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Computer Prestages Tools
        // ==========================================

        case 'listComputerPrestages': {
          ListComputerPrestagesSchema.parse(args);
          const prestages = await jamfClient.listComputerPrestages();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalPrestages: prestages.length,
              prestages,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getComputerPrestageDetails': {
          const { prestageId } = GetComputerPrestageDetailsSchema.parse(args);
          const prestage = await jamfClient.getComputerPrestageDetails(prestageId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(prestage, null, 2),
          };

          return { content: [content] };
        }

        case 'getComputerPrestageScope': {
          const { prestageId } = GetComputerPrestageScopeSchema.parse(args);
          const scope = await jamfClient.getComputerPrestageScope(prestageId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(scope, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Network Segments Tools
        // ==========================================

        case 'listNetworkSegments': {
          ListNetworkSegmentsSchema.parse(args);
          const segments = await jamfClient.listNetworkSegments();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalSegments: segments.length,
              segments,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getNetworkSegmentDetails': {
          const { segmentId } = GetNetworkSegmentDetailsSchema.parse(args);
          const segment = await jamfClient.getNetworkSegmentDetails(segmentId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(segment, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Mobile Prestages Tools
        // ==========================================

        case 'listMobilePrestages': {
          ListMobilePrestagesSchema.parse(args);
          const mobilePrestages = await jamfClient.listMobilePrestages();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalPrestages: mobilePrestages.length,
              prestages: mobilePrestages,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getMobilePrestageDetails': {
          const { prestageId } = GetMobilePrestageDetailsSchema.parse(args);
          const mobilePrestage = await jamfClient.getMobilePrestageDetails(prestageId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(mobilePrestage, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Accounts Tools
        // ==========================================

        case 'listAccounts': {
          ListAccountsSchema.parse(args);
          const accounts = await jamfClient.listAccounts();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalAccounts: accounts.users ? accounts.users.length : 0,
              totalGroups: accounts.groups ? accounts.groups.length : 0,
              accounts,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getAccountDetails': {
          const { accountId } = GetAccountDetailsSchema.parse(args);
          const account = await jamfClient.getAccountDetails(accountId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(account, null, 2),
          };

          return { content: [content] };
        }

        case 'getAccountGroupDetails': {
          const { groupId } = GetAccountGroupDetailsSchema.parse(args);
          const group = await jamfClient.getAccountGroupDetails(groupId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(group, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Users Tools
        // ==========================================

        case 'listUsers': {
          ListUsersSchema.parse(args);
          const users = await jamfClient.listUsers();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalUsers: users.length,
              users,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getUserDetails': {
          const { userId } = GetUserDetailsSchema.parse(args);
          const user = await jamfClient.getUserDetails(userId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(user, null, 2),
          };

          return { content: [content] };
        }

        case 'searchUsers': {
          const { query } = SearchUsersSchema.parse(args);
          const users = await jamfClient.searchUsers(query);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalUsers: users.length,
              query,
              users,
            }, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // App Installers Tools
        // ==========================================

        case 'listAppInstallers': {
          ListAppInstallersSchema.parse(args);
          const appInstallers = await jamfClient.listAppInstallers();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalAppInstallers: appInstallers.length,
              appInstallers,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getAppInstallerDetails': {
          const { titleId } = GetAppInstallerDetailsSchema.parse(args);
          const appInstaller = await jamfClient.getAppInstallerDetails(titleId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(appInstaller, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Restricted Software Tools
        // ==========================================

        case 'listRestrictedSoftware': {
          ListRestrictedSoftwareSchema.parse(args);
          const restrictedSoftware = await jamfClient.listRestrictedSoftware();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalRestrictedSoftware: restrictedSoftware.length,
              restrictedSoftware,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getRestrictedSoftwareDetails': {
          const { softwareId } = GetRestrictedSoftwareDetailsSchema.parse(args);
          const restrictedSoftware = await jamfClient.getRestrictedSoftwareDetails(softwareId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(restrictedSoftware, null, 2),
          };

          return { content: [content] };
        }

        // ==========================================
        // Webhooks Tools
        // ==========================================

        case 'listWebhooks': {
          ListWebhooksSchema.parse(args);
          const webhooks = await jamfClient.listWebhooks();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalWebhooks: webhooks.length,
              webhooks,
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getWebhookDetails': {
          const { webhookId } = GetWebhookDetailsSchema.parse(args);
          const webhook = await jamfClient.getWebhookDetails(webhookId);

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(webhook, null, 2),
          };

          return { content: [content] };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      })();

      // Apply response size guard to prevent "Tool result is too large" errors
      if (toolResult?.content) {
        for (const item of toolResult.content) {
          if (item.type === 'text' && typeof item.text === 'string') {
            item.text = truncateToolResponse(item.text);
          }
        }
      }

      return toolResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const content: TextContent = {
        type: 'text',
        text: `Error: ${errorMessage}`,
      };
      return { content: [content], isError: true };
    }
  });
}