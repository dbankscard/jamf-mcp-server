import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { parseJamfDate } from '../jamf-client-classic.js';

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
        description: 'Get detailed information about a specific policy including scope, scripts, and packages',
        inputSchema: {
          type: 'object',
          properties: {
            policyId: {
              type: 'string',
              description: 'The Jamf policy ID',
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
          const { policyId } = GetPolicyDetailsSchema.parse(args);
          
          const policyDetails = await jamfClient.getPolicyDetails(policyId);
          
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