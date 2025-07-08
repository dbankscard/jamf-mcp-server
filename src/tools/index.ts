import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
  ImageContent,
  EmbeddedResource,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { JamfApiClientHybrid as JamfApiClient } from '../jamf-client-hybrid.js';

const SearchDevicesSchema = z.object({
  query: z.string().describe('Search query to find devices by name, serial number, IP address, username, etc.'),
  limit: z.number().optional().default(50).describe('Maximum number of results to return'),
});

const GetDeviceDetailsSchema = z.object({
  deviceId: z.string().describe('The Jamf device ID'),
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

const UpdateInventorySchema = z.object({
  deviceId: z.string().describe('The device ID to update inventory for'),
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

const ListPackagesSchema = z.object({
  limit: z.number().optional().default(100).describe('Maximum number of packages to return'),
});

const GetPackageDetailsSchema = z.object({
  packageId: z.string().describe('The package ID'),
});

const SearchPackagesSchema = z.object({
  query: z.string().describe('Search query to find packages by name, filename, or category'),
  limit: z.number().optional().default(100).describe('Maximum number of results to return'),
});

const GetPackageDeploymentHistorySchema = z.object({
  packageId: z.string().describe('The package ID to get deployment history for'),
});

const GetPoliciesUsingPackageSchema = z.object({
  packageId: z.string().describe('The package ID to find policies for'),
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

export function registerTools(server: Server, jamfClient: JamfApiClient): void {
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
        name: 'listPackages',
        description: 'List all packages in Jamf Pro with their name, version, category, and size',
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
        name: 'getPackageDetails',
        description: 'Get detailed information about a specific package including metadata, requirements, and notes',
        inputSchema: {
          type: 'object',
          properties: {
            packageId: {
              type: 'string',
              description: 'The package ID',
            },
          },
          required: ['packageId'],
        },
      },
      {
        name: 'searchPackages',
        description: 'Search for packages by name, filename, or category',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find packages',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 100,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'getPackageDeploymentHistory',
        description: 'Get deployment history and statistics for a specific package',
        inputSchema: {
          type: 'object',
          properties: {
            packageId: {
              type: 'string',
              description: 'The package ID to get deployment history for',
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
              description: 'The package ID to find policies for',
            },
          },
          required: ['packageId'],
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
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              count: devices.length,
              devices: devices.map(d => ({
                id: d.id,
                name: d.name,
                serialNumber: d.serialNumber,
                lastContactTime: d.lastContactTime,
                osVersion: d.osVersion,
                ipAddress: d.ipAddress,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getDeviceDetails': {
          const { deviceId } = GetDeviceDetailsSchema.parse(args);
          const device = await jamfClient.getComputerDetails(deviceId);
          
          const storageInfo = device.storage?.disks?.map((disk: any) => ({
            device: disk.device,
            sizeMB: disk.sizeMegabytes,
            partitions: disk.partitions?.map((p: any) => ({
              name: p.name,
              sizeMB: p.sizeMegabytes,
              availableMB: p.availableMegabytes,
              percentUsed: p.percentUsed,
              fileVault2State: p.fileVault2State,
            })),
          }));

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              id: device.id,
              name: device.name,
              general: {
                platform: device.general?.platform,
                supervised: device.general?.supervised,
                managementUsername: device.general?.remoteManagement?.managementUsername,
              },
              hardware: {
                model: device.hardware?.model,
                osVersion: device.hardware?.osVersion,
                processorType: device.hardware?.processorType,
                totalRamMB: device.hardware?.totalRamMegabytes,
                batteryPercent: device.hardware?.batteryCapacityPercent,
                appleSilicon: device.hardware?.appleSilicon,
              },
              userAndLocation: {
                username: device.userAndLocation?.username,
                realname: device.userAndLocation?.realname,
                email: device.userAndLocation?.email,
                position: device.userAndLocation?.position,
              },
              storage: {
                bootDriveAvailableMB: device.storage?.bootDriveAvailableSpaceMegabytes,
                disks: storageInfo,
              },
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

          await jamfClient.deployScript(scriptId, deviceIds);
          
          const content: TextContent = {
            type: 'text',
            text: `Successfully deployed script ${scriptId} to ${deviceIds.length} device(s)`,
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

        case 'listPackages': {
          const { limit } = ListPackagesSchema.parse(args);
          const packages = await jamfClient.listPackages(limit);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              count: packages.length,
              packages: packages.map((p: any) => ({
                id: p.id,
                name: p.name || p.filename,
                filename: p.filename || p.fileName,
                category: p.category || p.categoryName,
                size: p.size,
                priority: p.priority,
                fillUserTemplate: p.fillUserTemplate,
                fillExistingUsers: p.fillExistingUsers,
                osRequirements: p.osRequirements,
                swu: p.swu,
                rebootRequired: p.rebootRequired,
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
                name: p.name || p.filename,
                filename: p.filename || p.fileName,
                category: p.category || p.categoryName,
                size: p.size,
                priority: p.priority,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getPackageDeploymentHistory': {
          const { packageId } = GetPackageDeploymentHistorySchema.parse(args);
          const history = await jamfClient.getPackageDeploymentHistory(packageId);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify(history, null, 2),
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
              count: policies.length,
              policies: policies,
            }, null, 2),
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