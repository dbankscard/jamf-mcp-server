import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Resource,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';

export function registerResources(server: Server, jamfClient: any): void {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources: Resource[] = [
      {
        uri: 'jamf://inventory/computers',
        name: 'Computer Inventory',
        description: 'Get a paginated list of all computers in Jamf Pro with basic information',
        mimeType: 'application/json',
      },
      {
        uri: 'jamf://reports/compliance',
        name: 'Compliance Report',
        description: 'Generate a compliance report showing devices that are not reporting or have issues',
        mimeType: 'application/json',
      },
      {
        uri: 'jamf://reports/storage',
        name: 'Storage Analytics',
        description: 'Analyze storage usage across all managed devices',
        mimeType: 'application/json',
      },
      {
        uri: 'jamf://reports/os-versions',
        name: 'OS Version Report',
        description: 'Get a breakdown of operating system versions across all devices',
        mimeType: 'application/json',
      },
      {
        uri: 'jamf://inventory/mobile-devices',
        name: 'Mobile Device Inventory',
        description: 'Get a paginated list of all mobile devices in Jamf Pro with basic information',
        mimeType: 'application/json',
      },
      {
        uri: 'jamf://reports/mobile-device-compliance',
        name: 'Mobile Device Compliance Report',
        description: 'Generate a compliance report for mobile devices showing management status and issues',
        mimeType: 'application/json',
      },
    ];

    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      switch (uri) {
        case 'jamf://inventory/computers': {
          const computers = await jamfClient.searchComputers('', 100);
          
          // Handle both API formats
          const formattedComputers = computers.map((c: any) => ({
            id: c.id?.toString(),
            name: c.name,
            serialNumber: c.serialNumber || c.serial_number,
            lastContactTime: c.lastContactTime || c.last_contact_time || c.last_contact_time_utc,
            osVersion: c.osVersion || c.os_version,
            platform: c.platform,
            username: c.username,
            email: c.email || c.email_address,
            ipAddress: c.ipAddress || c.ip_address || c.reported_ip_address,
          }));

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalCount: computers.length,
              computers: formattedComputers,
              generated: new Date().toISOString(),
            }, null, 2),
          };

          return { contents: [content] };
        }

        case 'jamf://reports/compliance': {
          const report = await jamfClient.getComplianceReport(30);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              summary: {
                total: report.total,
                compliant: report.compliant,
                nonCompliant: report.nonCompliant,
                notReporting: report.notReporting,
                complianceRate: ((report.compliant / report.total) * 100).toFixed(2) + '%',
              },
              issues: report.issues,
              reportPeriodDays: 30,
              generated: new Date().toISOString(),
            }, null, 2),
          };

          return { contents: [content] };
        }

        case 'jamf://reports/storage': {
          const report = await jamfClient.getStorageReport();
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              ...report,
              generated: new Date().toISOString(),
            }, null, 2),
          };

          return { contents: [content] };
        }

        case 'jamf://reports/os-versions': {
          const report = await jamfClient.getOSVersionReport();
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              ...report,
              generated: new Date().toISOString(),
            }, null, 2),
          };

          return { contents: [content] };
        }

        case 'jamf://inventory/mobile-devices': {
          const mobileDevices = await jamfClient.searchMobileDevices('', 100);
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalCount: mobileDevices.length,
              mobileDevices: mobileDevices.map((d: any) => ({
                id: d.id,
                name: d.name,
                serialNumber: d.serial_number || d.serialNumber,
                udid: d.udid,
                model: d.model || d.modelDisplay,
                osVersion: d.os_version || d.osVersion,
                batteryLevel: d.battery_level || d.batteryLevel,
                managed: d.managed,
                supervised: d.supervised,
                lastInventoryUpdate: d.last_inventory_update || d.lastInventoryUpdate,
              })),
              generated: new Date().toISOString(),
            }, null, 2),
          };

          return { contents: [content] };
        }

        case 'jamf://reports/mobile-device-compliance': {
          const mobileDevices = await jamfClient.searchMobileDevices('', 500);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const compliance = {
            total: mobileDevices.length,
            managed: 0,
            unmanaged: 0,
            supervised: 0,
            unsupervised: 0,
            lowBattery: 0,
            notReporting: 0,
            issues: [] as any[],
          };

          for (const device of mobileDevices) {
            // Check management status
            if (device.managed) {
              compliance.managed++;
            } else {
              compliance.unmanaged++;
              compliance.issues.push({
                deviceId: device.id,
                deviceName: device.name,
                issue: 'Not managed',
                serialNumber: device.serial_number || device.serialNumber,
              });
            }

            // Check supervision status
            if (device.supervised) {
              compliance.supervised++;
            } else {
              compliance.unsupervised++;
            }

            // Check battery level
            const batteryLevel = device.battery_level || device.batteryLevel;
            if (batteryLevel && batteryLevel < 20) {
              compliance.lowBattery++;
              compliance.issues.push({
                deviceId: device.id,
                deviceName: device.name,
                issue: `Low battery (${batteryLevel}%)`,
                serialNumber: device.serial_number || device.serialNumber,
              });
            }

            // Check last inventory update
            const lastUpdate = device.last_inventory_update || device.lastInventoryUpdate;
            if (lastUpdate) {
              const updateDate = new Date(lastUpdate);
              if (updateDate < thirtyDaysAgo) {
                compliance.notReporting++;
                compliance.issues.push({
                  deviceId: device.id,
                  deviceName: device.name,
                  issue: 'Not reporting (>30 days)',
                  lastUpdate: lastUpdate,
                  serialNumber: device.serial_number || device.serialNumber,
                });
              }
            }
          }

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              summary: {
                total: compliance.total,
                managed: compliance.managed,
                unmanaged: compliance.unmanaged,
                supervised: compliance.supervised,
                unsupervised: compliance.unsupervised,
                lowBattery: compliance.lowBattery,
                notReporting: compliance.notReporting,
                managementRate: ((compliance.managed / compliance.total) * 100).toFixed(2) + '%',
                supervisionRate: ((compliance.supervised / compliance.total) * 100).toFixed(2) + '%',
              },
              issues: compliance.issues,
              reportPeriodDays: 30,
              generated: new Date().toISOString(),
            }, null, 2),
          };

          return { contents: [content] };
        }

        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const content: TextContent = {
        type: 'text',
        text: `Error: ${errorMessage}`,
      };
      return { contents: [content] };
    }
  });
}