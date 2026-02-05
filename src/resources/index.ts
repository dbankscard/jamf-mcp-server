import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Resource,
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
      {
        uri: 'jamf://reports/patch-compliance',
        name: 'Patch Compliance Report',
        description: 'Fleet-wide patch compliance summary including software titles and patch policies',
        mimeType: 'application/json',
      },
      {
        uri: 'jamf://reports/encryption-status',
        name: 'Encryption Status Report',
        description: 'FileVault encryption compliance across the fleet',
        mimeType: 'application/json',
      },
      {
        uri: 'jamf://reports/extension-attributes',
        name: 'Extension Attributes Summary',
        description: 'Summary of defined extension attributes and collection status',
        mimeType: 'application/json',
      },
      {
        uri: 'jamf://inventory/prestages',
        name: 'Enrollment Prestages',
        description: 'Enrollment prestage assignments overview for computers and mobile devices',
        mimeType: 'application/json',
      },
      {
        uri: 'jamf://reports/failed-mdm-commands',
        name: 'Failed MDM Commands Report',
        description: 'Devices with stuck or failed MDM commands',
        mimeType: 'application/json',
      },
      {
        uri: 'jamf://reports/laps-audit',
        name: 'LAPS Audit Summary',
        description: 'Recent LAPS password access audit trail and available LAPS tools',
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

          const content = {
            uri,
            mimeType: 'application/json',
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
          
          const content = {
            uri,
            mimeType: 'application/json',
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
          
          const content = {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              ...report,
              generated: new Date().toISOString(),
            }, null, 2),
          };

          return { contents: [content] };
        }

        case 'jamf://reports/os-versions': {
          const report = await jamfClient.getOSVersionReport();
          
          const content = {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              ...report,
              generated: new Date().toISOString(),
            }, null, 2),
          };

          return { contents: [content] };
        }

        case 'jamf://inventory/mobile-devices': {
          const mobileDevices = await jamfClient.searchMobileDevices('', 100);
          
          const content = {
            uri,
            mimeType: 'application/json',
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
          const mobileDevices = await jamfClient.searchMobileDevices('', 100);
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

          const MAX_ISSUES = 50;
          const totalIssues = compliance.issues.length;
          const cappedIssues = compliance.issues.slice(0, MAX_ISSUES);

          const content = {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              summary: {
                total: compliance.total,
                managed: compliance.managed,
                unmanaged: compliance.unmanaged,
                supervised: compliance.supervised,
                unsupervised: compliance.unsupervised,
                lowBattery: compliance.lowBattery,
                notReporting: compliance.notReporting,
                totalIssues,
                managementRate: ((compliance.managed / compliance.total) * 100).toFixed(2) + '%',
                supervisionRate: ((compliance.supervised / compliance.total) * 100).toFixed(2) + '%',
              },
              issues: cappedIssues,
              ...(totalIssues > MAX_ISSUES ? { truncatedNote: `Showing ${MAX_ISSUES} of ${totalIssues} issues.` } : {}),
              reportPeriodDays: 30,
              generated: new Date().toISOString(),
            }, null, 2),
          };

          return { contents: [content] };
        }

        case 'jamf://reports/patch-compliance': {
          try {
            const patchTitles = await jamfClient.listPatchSoftwareTitles();
            const patchPolicies = await jamfClient.listPatchPolicies();

            const content = {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                summary: {
                  totalSoftwareTitles: Array.isArray(patchTitles) ? patchTitles.length : 0,
                  totalPatchPolicies: Array.isArray(patchPolicies) ? patchPolicies.length : 0,
                },
                softwareTitles: Array.isArray(patchTitles) ? patchTitles.map((t: any) => ({
                  id: t.id,
                  name: t.name || t.softwareTitleName,
                  publisher: t.publisher,
                  currentVersion: t.currentVersion,
                  lastModified: t.lastModified,
                })) : [],
                patchPolicies: Array.isArray(patchPolicies) ? patchPolicies.map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  enabled: p.enabled,
                  targetVersion: p.targetVersion || p.softwareTitleConfigurationId,
                })) : [],
                generated: new Date().toISOString(),
              }, null, 2),
            };

            return { contents: [content] };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const content = {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: `Failed to retrieve patch compliance data: ${errorMessage}`,
                hint: 'Ensure listPatchSoftwareTitles and listPatchPolicies methods are available on the Jamf client.',
                generated: new Date().toISOString(),
              }, null, 2),
            };
            return { contents: [content] };
          }
        }

        case 'jamf://reports/encryption-status': {
          try {
            const computers = await jamfClient.searchComputers('', 100);
            const sampleSize = Math.min(computers.length, 20);
            const sample = computers.slice(0, sampleSize);

            let encrypted = 0;
            let unencrypted = 0;
            let unknown = 0;

            // Parallel fetch instead of sequential loop
            const detailResults = await Promise.all(
              sample.map(async (computer: any) => {
                try {
                  const detail = await jamfClient.getComputerDetails(computer.id);
                  const diskEncryption = detail?.diskEncryption || detail?.disk_encryption;
                  const fileVaultStatus = diskEncryption?.fileVault2Status
                    || diskEncryption?.fileVault2_status
                    || detail?.fileVault2Status
                    || detail?.security?.fileVault2Status;

                  if (fileVaultStatus === 'ALL_ENCRYPTED' || fileVaultStatus === 'ENCRYPTED' || fileVaultStatus === 'allEncrypted') {
                    return {
                      id: computer.id,
                      name: computer.name,
                      serialNumber: computer.serialNumber || computer.serial_number,
                      fileVaultStatus: fileVaultStatus,
                      status: 'encrypted' as const,
                    };
                  } else if (fileVaultStatus && fileVaultStatus !== 'NOT_APPLICABLE') {
                    return {
                      id: computer.id,
                      name: computer.name,
                      serialNumber: computer.serialNumber || computer.serial_number,
                      fileVaultStatus: fileVaultStatus,
                      status: 'not_encrypted' as const,
                    };
                  } else {
                    return {
                      id: computer.id,
                      name: computer.name,
                      serialNumber: computer.serialNumber || computer.serial_number,
                      fileVaultStatus: fileVaultStatus || 'unknown',
                      status: 'unknown' as const,
                    };
                  }
                } catch {
                  return {
                    id: computer.id,
                    name: computer.name,
                    status: 'error_fetching_details' as const,
                  };
                }
              }),
            );

            const details = detailResults;
            for (const d of details) {
              if (d.status === 'encrypted') encrypted++;
              else if (d.status === 'not_encrypted') unencrypted++;
              else unknown++;
            }

            const totalSampled = encrypted + unencrypted + unknown;
            const complianceRate = totalSampled > 0
              ? ((encrypted / totalSampled) * 100).toFixed(2) + '%'
              : 'N/A';

            const content = {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                summary: {
                  totalDevicesInFleet: computers.length,
                  devicesSampled: totalSampled,
                  encrypted: encrypted,
                  unencrypted: unencrypted,
                  unknown: unknown,
                  complianceRate: complianceRate,
                  note: totalSampled < computers.length
                    ? `Sample of ${totalSampled} out of ${computers.length} devices. Increase sample for full fleet assessment.`
                    : 'All devices checked.',
                },
                devices: details,
                generated: new Date().toISOString(),
              }, null, 2),
            };

            return { contents: [content] };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const content = {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: `Failed to retrieve encryption status: ${errorMessage}`,
                hint: 'Ensure searchComputers and getComputerDetails methods are available on the Jamf client.',
                generated: new Date().toISOString(),
              }, null, 2),
            };
            return { contents: [content] };
          }
        }

        case 'jamf://reports/extension-attributes': {
          try {
            const extensionAttributes = await jamfClient.listComputerExtensionAttributes();
            const eaList = Array.isArray(extensionAttributes) ? extensionAttributes : [];

            const content = {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                summary: {
                  totalExtensionAttributes: eaList.length,
                },
                extensionAttributes: eaList.map((ea: any) => ({
                  id: ea.id,
                  name: ea.name,
                  description: ea.description,
                  dataType: ea.dataType || ea.data_type || ea.inputType?.type,
                  enabled: ea.enabled,
                  inventoryDisplay: ea.inventoryDisplay || ea.inventory_display,
                })),
                generated: new Date().toISOString(),
              }, null, 2),
            };

            return { contents: [content] };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const content = {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: `Failed to retrieve extension attributes: ${errorMessage}`,
                hint: 'Ensure listComputerExtensionAttributes method is available on the Jamf client.',
                generated: new Date().toISOString(),
              }, null, 2),
            };
            return { contents: [content] };
          }
        }

        case 'jamf://inventory/prestages': {
          try {
            // Parallel fetch both prestage types
            const [cpResult, mpResult] = await Promise.all([
              jamfClient.listComputerPrestages().catch(() => []),
              jamfClient.listMobilePrestages().catch(() => []),
            ]);
            const computerPrestages: any[] = Array.isArray(cpResult) ? cpResult : (cpResult?.results || []);
            const mobilePrestages: any[] = Array.isArray(mpResult) ? mpResult : (mpResult?.results || []);

            const content = {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                summary: {
                  computerPrestageCount: computerPrestages.length,
                  mobilePrestageCount: mobilePrestages.length,
                  totalPrestages: computerPrestages.length + mobilePrestages.length,
                },
                computerPrestages: computerPrestages.map((p: any) => ({
                  id: p.id,
                  displayName: p.displayName || p.display_name || p.name,
                  mandatory: p.mandatory,
                  mdmRemovable: p.mdmRemovable,
                  profileUuid: p.profileUuid,
                  isDefault: p.isDefault || p.isDefaultPrestage,
                })),
                mobilePrestages: mobilePrestages.map((p: any) => ({
                  id: p.id,
                  displayName: p.displayName || p.display_name || p.name,
                  mandatory: p.mandatory,
                  mdmRemovable: p.mdmRemovable,
                  profileUuid: p.profileUuid,
                  isDefault: p.isDefault || p.isDefaultPrestage,
                })),
                generated: new Date().toISOString(),
              }, null, 2),
            };

            return { contents: [content] };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const content = {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: `Failed to retrieve prestage data: ${errorMessage}`,
                hint: 'Ensure listComputerPrestages and listMobilePrestages methods are available on the Jamf client.',
                generated: new Date().toISOString(),
              }, null, 2),
            };
            return { contents: [content] };
          }
        }

        case 'jamf://reports/failed-mdm-commands': {
          try {
            const computers = await jamfClient.searchComputers('', 50);
            const sampleSize = Math.min(computers.length, 20);
            const sample = computers.slice(0, sampleSize);

            // Parallel fetch instead of sequential loop
            const mdmResults = await Promise.all(
              sample.map(async (computer: any) => {
                try {
                  const commandHistory = await jamfClient.getComputerMDMCommandHistory(computer.id);
                  const commands = Array.isArray(commandHistory) ? commandHistory : (commandHistory?.results || []);

                  const failedCommands = commands.filter((cmd: any) => {
                    const status = (cmd.status || cmd.commandState || '').toLowerCase();
                    return status === 'failed' || status === 'error' || status === 'pending' || status === 'not_now';
                  });

                  if (failedCommands.length > 0) {
                    return {
                      deviceId: computer.id,
                      deviceName: computer.name,
                      serialNumber: computer.serialNumber || computer.serial_number,
                      failedCommandCount: failedCommands.length,
                      commands: failedCommands.slice(0, 10).map((cmd: any) => ({
                        commandUuid: cmd.commandUuid || cmd.uuid,
                        commandType: cmd.command || cmd.commandType || cmd.name,
                        status: cmd.status || cmd.commandState,
                        dateSent: cmd.dateSent || cmd.dateSentUtc,
                        dateCompleted: cmd.dateCompleted || cmd.dateCompletedUtc,
                      })),
                    };
                  }
                  return null;
                } catch {
                  // Skip devices where MDM command history is not available
                  return null;
                }
              }),
            );

            const devicesWithFailures = mdmResults.filter((r): r is NonNullable<typeof r> => r !== null);
            const devicesChecked = sample.length;

            const content = {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                summary: {
                  totalDevicesInFleet: computers.length,
                  devicesChecked: devicesChecked,
                  devicesWithFailures: devicesWithFailures.length,
                  note: devicesChecked < computers.length
                    ? `Checked ${devicesChecked} of ${computers.length} devices. Increase sample for full fleet assessment.`
                    : 'All devices checked.',
                },
                devicesWithFailures: devicesWithFailures,
                generated: new Date().toISOString(),
              }, null, 2),
            };

            return { contents: [content] };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const content = {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: `Failed to retrieve MDM command history: ${errorMessage}`,
                hint: 'Ensure searchComputers and getComputerMDMCommandHistory methods are available on the Jamf client.',
                generated: new Date().toISOString(),
              }, null, 2),
            };
            return { contents: [content] };
          }
        }

        case 'jamf://reports/laps-audit': {
          const content = {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              summary: {
                description: 'LAPS (Local Administrator Password Solution) audit information is available on a per-device basis.',
                usage: 'To audit LAPS activity, use the following tools with specific device IDs:',
                availableTools: [
                  {
                    tool: 'getLocalAdminPasswordAccounts',
                    description: 'List LAPS-capable accounts for a specific computer. Requires a Jamf Pro computer ID or management ID.',
                    example: 'Call with a computer management ID to see which local admin accounts have LAPS passwords managed.',
                  },
                  {
                    tool: 'getLocalAdminPasswordAudit',
                    description: 'View the audit trail of LAPS password views/retrievals for a specific account on a specific device. Shows who accessed the password and when.',
                    example: 'Call with a computer management ID and username to see the full audit history of password access events.',
                  },
                ],
                workflow: [
                  'Step 1: Use the computer inventory resource or searchComputers tool to identify target devices.',
                  'Step 2: Use getLocalAdminPasswordAccounts with the device management ID to list LAPS-managed accounts.',
                  'Step 3: Use getLocalAdminPasswordAudit with the device management ID and username to review access history.',
                ],
                note: 'LAPS audit data cannot be bulk-enumerated across the fleet. Each device must be queried individually.',
              },
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
      const content = {
        uri,
        mimeType: 'application/json',
        text: `Error: ${errorMessage}`,
      };
      return { contents: [content] };
    }
  });
}