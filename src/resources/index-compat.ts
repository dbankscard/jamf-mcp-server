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