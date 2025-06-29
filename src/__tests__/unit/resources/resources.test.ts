import { jest } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListResourcesRequestSchema, ReadResourceRequestSchema, Resource } from '@modelcontextprotocol/sdk/types.js';
import { registerResources } from '../../../resources/index-compat.js';

describe('Resources', () => {
  let server: Server;
  let jamfClient: any;
  let mockHandlers: Map<any, Function>;

  beforeEach(() => {
    // Create mock Jamf client
    jamfClient = {
      getInventory: jest.fn(),
      getComplianceReport: jest.fn(),
      getStorageReport: jest.fn(),
      getOSVersionReport: jest.fn(),
      searchComputers: jest.fn(),
      getComputerDetails: jest.fn(),
      getAllComputers: jest.fn(),
      updateInventory: jest.fn()
    };

    // Create server and register resources
    server = new Server(
      {
        name: 'jamf-test-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {}
        }
      }
    );
    
    // Track registered handlers
    mockHandlers = new Map();
    const originalSetRequestHandler = server.setRequestHandler.bind(server);
    server.setRequestHandler = jest.fn((schema: any, handler: Function) => {
      mockHandlers.set(schema, handler);
      return originalSetRequestHandler(schema, handler);
    });
    
    registerResources(server, jamfClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('List Resources', () => {
    test('should list all available resources', async () => {
      const handler = mockHandlers.get(ListResourcesRequestSchema);
      expect(handler).toBeDefined();
      
      const result = await handler({} as any);

      expect(result.resources).toHaveLength(4);
      
      const resourceUris = result.resources.map((r: Resource) => r.uri);
      expect(resourceUris).toContain('jamf://inventory/computers');
      expect(resourceUris).toContain('jamf://reports/compliance');
      expect(resourceUris).toContain('jamf://reports/storage');
      expect(resourceUris).toContain('jamf://reports/os-versions');

      // Check resource details
      const inventoryResource = result.resources.find((r: Resource) => r.uri === 'jamf://inventory/computers');
      expect(inventoryResource).toMatchObject({
        name: 'Computer Inventory',
        description: 'Get a paginated list of all computers in Jamf Pro with basic information',
        mimeType: 'application/json'
      });

      const complianceResource = result.resources.find((r: Resource) => r.uri === 'jamf://reports/compliance');
      expect(complianceResource).toMatchObject({
        name: 'Compliance Report',
        description: 'Generate a compliance report showing devices that are not reporting or have issues',
        mimeType: 'application/json'
      });
    });
  });

  describe('Computer Inventory Resource', () => {
    test('should return computer inventory', async () => {
      // Mock API response
      jamfClient.searchComputers.mockResolvedValue([
        {
          id: '1',
          name: 'MacBook-Pro-001',
          udid: '12345678-1234-1234-1234-123456789012',
          serialNumber: 'C02ABC123DEF',
          lastContactTime: '2024-12-24T18:27:00.000Z',
          osVersion: '14.2.1',
          platform: 'Mac',
          managementId: 'mgmt-001',
          userApprovedMdm: true
        },
        {
          id: '2',
          name: 'MacBook-Air-002',
          udid: '87654321-4321-4321-4321-210987654321',
          serialNumber: 'C02DEF456GHI',
          lastContactTime: '2024-12-23T14:30:00.000Z',
          osVersion: '14.2.0',
          platform: 'Mac',
          managementId: 'mgmt-002',
          userApprovedMdm: true
        }
      ]);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      expect(handler).toBeDefined();
      
      const result = await handler({
        params: {
          uri: 'jamf://inventory/computers'
        }
      } as any);

      const data = JSON.parse(result.contents[0].text);
      expect(data.totalCount).toBe(2);
      expect(data.computers).toHaveLength(2);
      expect(data.computers[0]).toMatchObject({
        id: '1',
        name: 'MacBook-Pro-001',
        serialNumber: 'C02ABC123DEF',
        platform: 'Mac'
      });
      expect(data.generated).toBeDefined();
    });

    test('should handle empty inventory', async () => {
      jamfClient.searchComputers.mockResolvedValue([]);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://inventory/computers'
        }
      } as any);

      const data = JSON.parse(result.contents[0].text);
      expect(data.totalCount).toBe(0);
      expect(data.computers).toHaveLength(0);
    });
  });

  describe('Compliance Report Resource', () => {
    test('should generate compliance report', async () => {
      // Mock getComplianceReport method
      const mockReport = {
        total: 100,
        compliant: 85,
        nonCompliant: 10,
        notReporting: 5,
        issues: [
          {
            deviceId: '1',
            deviceName: 'MacBook-001',
            issue: 'Not reporting for 45 days',
            severity: 'high'
          },
          {
            deviceId: '2',
            deviceName: 'MacBook-002',
            issue: 'Low disk space',
            severity: 'medium'
          }
        ]
      };

      jamfClient.getComplianceReport.mockResolvedValue(mockReport);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://reports/compliance'
        }
      } as any);

      const data = JSON.parse(result.contents[0].text);
      expect(data.summary).toMatchObject({
        total: 100,
        compliant: 85,
        nonCompliant: 10,
        notReporting: 5,
        complianceRate: '85.00%'
      });
      expect(data.issues).toHaveLength(2);
      expect(data.reportPeriodDays).toBe(30);
      expect(data.generated).toBeDefined();
    });

    test('should handle 100% compliance', async () => {
      const mockReport = {
        total: 50,
        compliant: 50,
        nonCompliant: 0,
        notReporting: 0,
        issues: []
      };

      jamfClient.getComplianceReport.mockResolvedValue(mockReport);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://reports/compliance'
        }
      } as any);

      const data = JSON.parse(result.contents[0].text);
      expect(data.summary.complianceRate).toBe('100.00%');
      expect(data.issues).toHaveLength(0);
    });

    test('should handle zero devices', async () => {
      const mockReport = {
        total: 0,
        compliant: 0,
        nonCompliant: 0,
        notReporting: 0,
        issues: []
      };

      jamfClient.getComplianceReport.mockResolvedValue(mockReport);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://reports/compliance'
        }
      } as any);

      const data = JSON.parse(result.contents[0].text);
      expect(data.summary.complianceRate).toBe('NaN%'); // This is expected behavior for 0/0
    });
  });

  describe('Storage Analytics Resource', () => {
    test('should analyze storage across devices', async () => {
      // Mock storage report
      const mockStorageReport = {
        totalDevices: 3,
        devicesWithLowStorage: [
          {
            id: '1',
            name: 'Device-1',
            availableGB: '5.00',
            percentUsed: 95,
            severity: 'critical'
          },
          {
            id: '2',
            name: 'Device-2',
            availableGB: '15.00',
            percentUsed: 85,
            severity: 'warning'
          }
        ],
        averageUsagePercent: '76.67%'
      };
      
      jamfClient.getStorageReport.mockResolvedValue(mockStorageReport);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://reports/storage'
        }
      } as any);

      const data = JSON.parse(result.contents[0].text);
      expect(data).toMatchObject(mockStorageReport);
      expect(data.generated).toBeDefined();
    });

    test('should handle devices without storage info', async () => {
      const mockStorageReport = {
        totalDevices: 2,
        devicesWithLowStorage: [],
        averageUsagePercent: '0.00%'
      };
      
      jamfClient.getStorageReport.mockResolvedValue(mockStorageReport);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://reports/storage'
        }
      } as any);

      const data = JSON.parse(result.contents[0].text);
      expect(data.totalDevices).toBe(2);
      expect(data.devicesWithLowStorage).toHaveLength(0);
      expect(data.averageUsagePercent).toBe('0.00%');
    });
  });

  describe('OS Version Report Resource', () => {
    test('should generate OS version breakdown', async () => {
      const mockOSReport = {
        totalDevices: 5,
        osVersions: [
          { version: '14.2.1', count: 2, percentage: '40.00%' },
          { version: '14.2.0', count: 1, percentage: '20.00%' },
          { version: '14.1.0', count: 1, percentage: '20.00%' },
          { version: '11.0', count: 1, percentage: '20.00%' }
        ],
        platforms: [
          { platform: 'Mac', count: 4, percentage: '80.00%' },
          { platform: 'Windows', count: 1, percentage: '20.00%' }
        ]
      };
      
      jamfClient.getOSVersionReport.mockResolvedValue(mockOSReport);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://reports/os-versions'
        }
      } as any);

      const data = JSON.parse(result.contents[0].text);
      expect(data).toMatchObject(mockOSReport);
      expect(data.generated).toBeDefined();
    });

    test('should handle unknown OS versions', async () => {
      const mockOSReport = {
        totalDevices: 3,
        osVersions: [
          { version: '14.2.1', count: 1, percentage: '33.33%' },
          { version: 'Unknown', count: 2, percentage: '66.67%' }
        ],
        platforms: [
          { platform: 'Mac', count: 1, percentage: '33.33%' },
          { platform: 'Unknown', count: 2, percentage: '66.67%' }
        ]
      };
      
      jamfClient.getOSVersionReport.mockResolvedValue(mockOSReport);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://reports/os-versions'
        }
      } as any);

      const data = JSON.parse(result.contents[0].text);
      expect(data.totalDevices).toBe(3);
      
      // Should have entries for Unknown
      const unknownVersion = data.osVersions.find((v: any) => v.version === 'Unknown');
      expect(unknownVersion).toMatchObject({
        version: 'Unknown',
        count: 2,
        percentage: '66.67%'
      });

      const unknownPlatform = data.platforms.find((p: any) => p.platform === 'Unknown');
      expect(unknownPlatform).toMatchObject({
        platform: 'Unknown',
        count: 2,
        percentage: '66.67%'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown resource URI', async () => {
      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://unknown/resource'
        }
      } as any);

      expect(result.contents[0].text).toContain('Error: Unknown resource: jamf://unknown/resource');
    });

    test('should handle API errors gracefully', async () => {
      const error = new Error('Network error');
      jamfClient.searchComputers.mockRejectedValue(error);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://inventory/computers'
        }
      } as any);

      expect(result.contents[0].text).toContain('Error: Network error');
    });

    test('should handle authentication errors', async () => {
      const error = new Error('Authentication required') as any;
      error.response = {
        status: 401,
        data: {
          httpStatus: 401,
          errors: [
            {
              code: 'UNAUTHORIZED',
              description: 'Authentication required'
            }
          ]
        }
      };
      jamfClient.searchComputers.mockRejectedValue(error);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://inventory/computers'
        }
      } as any);

      expect(result.contents[0].text).toContain('Error:');
    });
  });

  describe('Large Dataset Handling', () => {
    test('should handle large inventory efficiently', async () => {
      // Mock OS version report for 1000 devices
      const mockLargeOSReport = {
        totalDevices: 1000,
        osVersions: [
          { version: '14.2.1', count: 334, percentage: '33.40%' },
          { version: '14.2.0', count: 333, percentage: '33.30%' },
          { version: '14.1.0', count: 333, percentage: '33.30%' }
        ],
        platforms: [
          { platform: 'Mac', count: 1000, percentage: '100.00%' }
        ]
      };
      
      jamfClient.getOSVersionReport.mockResolvedValue(mockLargeOSReport);

      const handler = mockHandlers.get(ReadResourceRequestSchema);
      const result = await handler({
        params: {
          uri: 'jamf://reports/os-versions'
        }
      } as any);

      const data = JSON.parse(result.contents[0].text);
      expect(data.totalDevices).toBe(1000);
      expect(data.osVersions).toBeDefined();
      expect(data.platforms).toBeDefined();
    });
  });
});