import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Resource,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { JamfApiClient } from '../jamf-client.js';

export function registerResources(server: Server, jamfClient: JamfApiClient): void {
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
          
          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalCount: computers.length,
              computers: computers.map(c => ({
                id: c.id,
                name: c.name,
                serialNumber: c.serialNumber,
                lastContactTime: c.lastContactTime,
                osVersion: c.osVersion,
                platform: c.platform,
                managementId: c.managementId,
                userApprovedMdm: c.userApprovedMdm,
              })),
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
          const computers = await jamfClient.searchComputers('', 500);
          const storageAnalytics = {
            totalDevices: 0,
            devicesWithLowStorage: [] as any[],
            averageUsagePercent: 0,
            criticalStorageThreshold: 10, // GB
            warningStorageThreshold: 20, // GB
          };

          let totalUsagePercent = 0;
          let devicesWithStorageInfo = 0;

          for (const computer of computers) {
            try {
              const details = await jamfClient.getComputerDetails(computer.id);
              
              if (details.storage?.bootDriveAvailableSpaceMegabytes) {
                const availableGB = details.storage.bootDriveAvailableSpaceMegabytes / 1024;
                
                const bootDisk = details.storage.disks?.find(d => 
                  d.partitions?.some(p => p.partitionType === 'boot')
                );
                
                if (bootDisk) {
                  const bootPartition = bootDisk.partitions?.find(p => p.partitionType === 'boot');
                  if (bootPartition) {
                    devicesWithStorageInfo++;
                    totalUsagePercent += bootPartition.percentUsed || 0;
                    
                    if (availableGB < storageAnalytics.criticalStorageThreshold) {
                      storageAnalytics.devicesWithLowStorage.push({
                        id: computer.id,
                        name: computer.name,
                        availableGB: availableGB.toFixed(2),
                        percentUsed: bootPartition.percentUsed,
                        severity: 'critical',
                      });
                    } else if (availableGB < storageAnalytics.warningStorageThreshold) {
                      storageAnalytics.devicesWithLowStorage.push({
                        id: computer.id,
                        name: computer.name,
                        availableGB: availableGB.toFixed(2),
                        percentUsed: bootPartition.percentUsed,
                        severity: 'warning',
                      });
                    }
                  }
                }
              }
            } catch (error) {
              // Skip devices that fail to fetch details
              continue;
            }
          }

          storageAnalytics.totalDevices = computers.length;
          storageAnalytics.averageUsagePercent = devicesWithStorageInfo > 0 
            ? totalUsagePercent / devicesWithStorageInfo 
            : 0;

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              ...storageAnalytics,
              averageUsagePercent: storageAnalytics.averageUsagePercent.toFixed(2) + '%',
              generated: new Date().toISOString(),
            }, null, 2),
          };

          return { contents: [content] };
        }

        case 'jamf://reports/os-versions': {
          const computers = await jamfClient.searchComputers('', 1000);
          const osVersions = new Map<string, number>();
          const platformBreakdown = new Map<string, number>();

          for (const computer of computers) {
            const osVersion = computer.osVersion || 'Unknown';
            const platform = computer.platform || 'Unknown';
            
            osVersions.set(osVersion, (osVersions.get(osVersion) || 0) + 1);
            platformBreakdown.set(platform, (platformBreakdown.get(platform) || 0) + 1);
          }

          const sortedVersions = Array.from(osVersions.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([version, count]) => ({
              version,
              count,
              percentage: ((count / computers.length) * 100).toFixed(2) + '%',
            }));

          const sortedPlatforms = Array.from(platformBreakdown.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([platform, count]) => ({
              platform,
              count,
              percentage: ((count / computers.length) * 100).toFixed(2) + '%',
            }));

          const content: TextContent = {
            type: 'text',
            text: JSON.stringify({
              totalDevices: computers.length,
              osVersions: sortedVersions,
              platforms: sortedPlatforms,
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