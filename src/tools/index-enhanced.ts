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
import { JamfApiClientEnhanced as JamfApiClient } from '../jamf-client-enhanced.js';
import { JamfAPIError, ValidationError } from '../utils/errors.js';
import { getRetryConfig } from '../utils/retry.js';

// Import all the schemas from the original file
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

const SearchMobileDevicesSchema = z.object({
  query: z.string().describe('Search query to find mobile devices'),
  limit: z.number().optional().default(50).describe('Maximum number of results to return'),
});

const GetMobileDeviceDetailsSchema = z.object({
  deviceId: z.string().describe('The mobile device ID'),
});

const UpdateMobileDeviceInventorySchema = z.object({
  deviceId: z.string().describe('The mobile device ID to update inventory for'),
});

const SendMDMCommandSchema = z.object({
  deviceId: z.string().describe('The mobile device ID'),
  command: z.string().describe('The MDM command to send'),
  confirm: z.boolean().optional().default(false).describe('Confirmation flag for destructive commands'),
});

const ListMobileDeviceGroupsSchema = z.object({
  type: z.enum(['smart', 'static', 'all']).optional().default('all').describe('Type of mobile device groups to list'),
});

const GetMobileDeviceGroupDetailsSchema = z.object({
  groupId: z.string().describe('The mobile device group ID'),
});

/**
 * Format error for better user feedback
 */
function formatError(error: Error): string {
  const config = getRetryConfig();
  
  if (error instanceof JamfAPIError) {
    let errorText = error.toDetailedString();
    
    // Add retry information if available
    if (error.context?.retryAttempts) {
      errorText += `\n\nRetry Information:`;
      errorText += `\n  Attempts: ${error.context.retryAttempts}`;
      errorText += `\n  Max Retries: ${config.maxRetries}`;
    }
    
    return errorText;
  }
  
  if (error instanceof ValidationError) {
    return error.toDetailedString();
  }
  
  // Generic error formatting
  let errorText = `Error: ${error.message}`;
  
  if (config.debugMode && error.stack) {
    errorText += '\n\nStack Trace:\n' + error.stack;
  }
  
  return errorText;
}

/**
 * Log error details in debug mode
 */
function logError(toolName: string, error: Error): void {
  const config = getRetryConfig();
  
  if (config.debugMode) {
    console.error(`[Tool Error - ${toolName}]`, {
      message: error.message,
      type: error.constructor.name,
      tool: toolName,
      timestamp: new Date().toISOString(),
      ...(error instanceof JamfAPIError ? {
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        suggestions: error.suggestions,
        context: error.context
      } : {})
    });
  }
}

export function setupToolsEnhanced(server: Server, jamfClient: JamfApiClient) {
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
              description: 'Search query to find devices by name, serial number, IP address, username, etc.',
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
        description: 'Get detailed information about a specific package including metadata and deployment info',
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
              description: 'Search query to find packages by name, filename, or category',
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
        name: 'searchMobileDevices',
        description: 'Search for mobile devices in Jamf Pro by name, serial number, or UDID',
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
        description: 'Get detailed information about a specific mobile device',
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
        description: 'Send an MDM command to a mobile device (some commands require confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The mobile device ID',
            },
            command: {
              type: 'string',
              description: 'The MDM command to send',
              enum: [
                'DeviceLock', 'EraseDevice', 'ClearPasscode', 'RestartDevice',
                'ShutDownDevice', 'EnableLostMode', 'DisableLostMode', 'PlayLostModeSound',
                'UpdateInventory', 'ClearRestrictionsPassword', 'SettingsEnableBluetooth',
                'SettingsDisableBluetooth', 'SettingsEnableWiFi', 'SettingsDisableWiFi',
                'SettingsEnableDataRoaming', 'SettingsDisableDataRoaming',
                'SettingsEnableVoiceRoaming', 'SettingsDisableVoiceRoaming',
                'SettingsEnablePersonalHotspot', 'SettingsDisablePersonalHotspot'
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

        case 'listPackages': {
          const { limit } = ListPackagesSchema.parse(args);
          const packages = await jamfClient.listPackages(limit);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              count: packages.length,
              packages: packages.map((p: any) => ({
                id: p.id,
                name: p.name || p.fileName,
                fileName: p.fileName,
                category: p.categoryId || p.category,
                size: p.size,
                fillUserTemplate: p.fillUserTemplate,
                fillExistingUsers: p.fillExistingUsers,
                swu: p.swu,
                priority: p.priority,
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
                name: p.name || p.fileName,
                fileName: p.fileName,
                category: p.categoryId || p.category,
                size: p.size,
              })),
            }, null, 2),
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
            text: JSON.stringify(device, null, 2),
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
          throw new ValidationError(`Unknown tool: ${name}`, { tool: [`'${name}' is not a valid tool`] });
      }
    } catch (error) {
      logError(name, error as Error);
      
      const errorMessage = formatError(error as Error);
      const content: TextContent = {
        type: 'text',
        text: errorMessage,
      };
      
      return { content: [content], isError: true };
    }
  });
}