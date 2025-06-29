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
import { JamfApiClient } from '../jamf-client.js';

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
                userApprovedMdm: d.userApprovedMdm,
              })),
            }, null, 2),
          };

          return { content: [content] };
        }

        case 'getDeviceDetails': {
          const { deviceId } = GetDeviceDetailsSchema.parse(args);
          const device = await jamfClient.getComputerDetails(deviceId);
          
          const storageInfo = device.storage?.disks?.map(disk => ({
            device: disk.device,
            sizeMB: disk.sizeMegabytes,
            partitions: disk.partitions?.map(p => ({
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