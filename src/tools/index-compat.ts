import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DocumentationGenerator } from '../documentation/generator.js';
import { DocumentationOptions } from '../documentation/types.js';
import { createLogger } from '../server/logger.js';

const logger = createLogger('Tools');
// import { parseJamfDate } from '../jamf-client-classic.js';
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

// Documentation schemas
const DocumentJamfEnvironmentSchema = z.object({
  outputPath: z.string().optional().describe('Directory path where documentation files will be saved'),
  formats: z.array(z.enum(['markdown', 'json'])).optional().describe('Output formats to generate'),
  components: z.array(z.enum([
    'computers',
    'mobile-devices',
    'policies',
    'configuration-profiles',
    'scripts',
    'packages',
    'computer-groups',
    'mobile-device-groups',
  ])).optional().describe('Specific components to document'),
  detailLevel: z.enum(['summary', 'standard', 'full']).optional().describe('Level of detail to include'),
  includeScriptContent: z.boolean().optional().describe('Include full script content in documentation'),
  includeProfilePayloads: z.boolean().optional().describe('Include configuration profile payload details'),
});

export function registerTools(server: Server, jamfClient: any): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: 'searchDevices',
        description: 'Search for devices in Jamf Pro by name, serial number, IP address, username, or other criteria',
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
      },
      {
        name: 'getDeviceDetails',
        description: 'Get detailed information about a specific device including hardware, software, and user details',
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
      },
      {
        name: 'updateInventory',
        description: 'Force an inventory update on a specific device',
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
      },
      {
        name: 'checkDeviceCompliance',
        description: 'Check which devices have not reported within a specified number of days',
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
      },
      {
        name: 'getDevicesBatch',
        description: 'Get details for multiple devices in a single request',
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
      },
      {
        name: 'listPolicies',
        description: 'List all policies in Jamf Pro',
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
      },
      {
        name: 'getPolicyDetails',
        description: 'Get detailed information about a specific policy including scope, scripts, and packages. Can optionally include full script content.',
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
      },
      {
        name: 'searchPolicies',
        description: 'Search for policies by name, description, or other criteria',
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
      },
      {
        name: 'executePolicy',
        description: 'Execute a Jamf policy on one or more devices (requires confirmation)',
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
      },
      {
        name: 'deployScript',
        description: 'Deploy and execute a Jamf script on one or more devices (requires confirmation)',
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
      },
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
      },
      // Reporting and Analytics Tools
      {
        name: 'getInventorySummary',
        description: 'Get inventory summary report including total devices, OS version distribution, and model distribution',
        inputSchema: {
          type: 'object',
          properties: {},
        },
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
      },
      {
        name: 'getDeviceComplianceSummary',
        description: 'Get device compliance summary showing devices checking in regularly, devices with failed policies, and devices missing critical software',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      // Documentation Tools
      {
        name: 'documentJamfEnvironment',
        description: 'Generate comprehensive documentation of the Jamf Pro environment including computers, mobile devices, policies, configuration profiles, scripts, packages, and groups. Outputs both markdown and JSON formats to the specified directory.',
        inputSchema: {
          type: 'object',
          properties: {
            outputPath: {
              type: 'string',
              description: 'Directory path where documentation files will be saved',
              default: './jamf-documentation',
            },
            formats: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['markdown', 'json'],
              },
              description: 'Output formats to generate (markdown, json, or both)',
              default: ['markdown', 'json'],
            },
            components: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'computers',
                  'mobile-devices',
                  'policies',
                  'configuration-profiles',
                  'scripts',
                  'packages',
                  'computer-groups',
                  'mobile-device-groups',
                ],
              },
              description: 'Specific components to document. If not provided, all components will be documented.',
            },
            detailLevel: {
              type: 'string',
              enum: ['summary', 'standard', 'full'],
              description: 'Level of detail to include in documentation',
              default: 'full',
            },
            includeScriptContent: {
              type: 'boolean',
              description: 'Include full script content in documentation',
              default: true,
            },
            includeProfilePayloads: {
              type: 'boolean',
              description: 'Include configuration profile payload details',
              default: true,
            },
          },
        },
      },
    ];

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
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

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              count: devices.length,
              devices: formattedDevices,
            }, null, 2),
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
            text: JSON.stringify(formatted, null, 2),
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
          
          /** Device compliance info structure */
          interface ComplianceDeviceInfo {
            id: string | undefined;
            name: string | undefined;
            serialNumber: string | undefined;
            username: string | undefined;
            lastContact: string;
            lastContactReadable: string;
            daysSinceContact: number | null;
            status: string;
            severity?: string;
          }

          const results: {
            totalDevices: number;
            compliant: number;
            nonCompliant: number;
            notReporting: number;
            unknown: number;
            complianceRate: string;
            summary: {
              totalDevices: number;
              compliant: number;
              warning: number;
              critical: number;
              unknown: number;
              criticalDevices: ComplianceDeviceInfo[];
              warningDevices: ComplianceDeviceInfo[];
            };
            devices: ComplianceDeviceInfo[] | undefined;
          } = {
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
              criticalDevices: [],
              warningDevices: [],
            },
            devices: includeDetails ? [] : undefined,
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
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(results, null, 2),
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
          const { deviceIds, includeBasicOnly } = GetDevicesBatchSchema.parse(args);
          
          const devices = [];
          const errors = [];
          
          for (const deviceId of deviceIds) {
            try {
              const device = await jamfClient.getComputerDetails(deviceId);
              
              if (includeBasicOnly) {
                devices.push({
                  id: device.id?.toString(),
                  name: device.name || device.general?.name,
                  serialNumber: device.general?.serial_number || device.serialNumber,
                  lastContactTime: device.general?.last_contact_time || device.lastContactTime,
                  osVersion: device.hardware?.os_version || device.osVersion,
                  username: device.location?.username || device.username,
                });
              } else {
                devices.push(device);
              }
            } catch (error) {
              errors.push({
                deviceId,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              requested: deviceIds.length,
              successful: devices.length,
              failed: errors.length,
              devices,
              errors: errors.length > 0 ? errors : undefined,
            }, null, 2),
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
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalPolicies: policies.length,
              policies: policies.map((p: any) => ({
                id: p.id,
                name: p.name,
                category: p.category,
              })),
            }, null, 2),
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
                  logger.error('Failed to fetch script details', { scriptId: script.id, error });
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
          const devices = await jamfClient.searchMobileDevices(query, limit);
          
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
            text: JSON.stringify(report, null, 2),
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
          const summary = await jamfClient.getDeviceComplianceSummary();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
          };

          return { content: [content] };
        }

        case 'documentJamfEnvironment': {
          const options = DocumentJamfEnvironmentSchema.parse(args);

          const documentationOptions: DocumentationOptions = {
            outputPath: options.outputPath || './jamf-documentation',
            formats: options.formats || ['markdown', 'json'],
            components: options.components || [
              'computers',
              'mobile-devices',
              'policies',
              'configuration-profiles',
              'scripts',
              'packages',
              'computer-groups',
              'mobile-device-groups',
            ],
            detailLevel: options.detailLevel || 'full',
            includeScriptContent: options.includeScriptContent !== false,
            includeProfilePayloads: options.includeProfilePayloads !== false,
          };

          const generator = new DocumentationGenerator(jamfClient);
          const documentation = await generator.generateDocumentation(documentationOptions);
          const progress = generator.getProgress();

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Documentation generated successfully for ${progress.completedComponents.length}/${progress.totalComponents} components`,
                overview: documentation.overview,
                progress: {
                  completedComponents: progress.completedComponents,
                  errors: progress.errors,
                  duration: progress.endTime && progress.startTime
                    ? progress.endTime.getTime() - progress.startTime.getTime()
                    : 0,
                },
                outputPath: documentationOptions.outputPath,
                formats: documentationOptions.formats,
              },
              null,
              2
            ),
          };

          return { content: [content] };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
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