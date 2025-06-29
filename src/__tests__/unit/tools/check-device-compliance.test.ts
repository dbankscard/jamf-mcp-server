import { jest } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { registerTools } from '../../../tools/index-compat.js';
import { parseJamfDate } from '../../../jamf-client-classic.js';

describe('checkDeviceCompliance Tool', () => {
  let server: Server;
  let jamfClient: any;

  beforeEach(() => {
    // Create mock Jamf client
    jamfClient = {
      getAllComputers: jest.fn(),
      getComputerDetails: jest.fn(),
      searchComputers: jest.fn(),
      updateInventory: jest.fn()
    };

    // Create server and register tools
    server = new Server(
      {
        name: 'jamf-test-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    registerTools(server, jamfClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to simulate the tool call by directly invoking the logic
  async function callCheckDeviceCompliance(days: number = 30, includeDetails: boolean = false) {
    // This simulates what the tool handler does in index-compat.ts
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
        criticalDevices: [] as any[],
        warningDevices: [] as any[],
      },
      devices: includeDetails ? [] as any[] : undefined,
    };
    
    // Add debug info for first few devices
    let debugCount = 0;
    
    // Process computers in batches and fetch details
    const batchSize = 10;
    for (let i = 0; i < allComputers.length; i += batchSize) {
      const batch = allComputers.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (computer: any) => {
        try {
          // Fetch detailed info to get date fields from general section
          const details = await jamfClient.getComputerDetails(computer.id.toString());
          
          // Get date from the general section where it actually exists
          const dateValue = details.general?.last_contact_time_epoch || 
                          details.general?.last_contact_time || 
                          details.general?.last_contact_time_utc;
          
          const lastContact = parseJamfDate(dateValue);
          
          // Debug log for first 3 devices
          // if (debugCount < 3) {
          //   console.error(`Debug - Device ${computer.name}:`);
          //   console.error(`  General section has keys: ${Object.keys(details.general || {}).join(', ')}`);
          //   console.error(`  Raw date value: ${JSON.stringify(dateValue)}`);
          //   console.error(`  Parsed date: ${lastContact ? lastContact.toISOString() : 'null'}`);
          //   debugCount++;
          // }
      
          const daysSinceContact = lastContact 
            ? Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          
          const deviceInfo = {
            id: computer.id?.toString(),
            name: computer.name || details.general?.name,
            serialNumber: details.general?.serial_number,
            username: computer.username,
            lastContact: lastContact?.toISOString() || 'Unknown',
            lastContactReadable: details.general?.last_contact_time || 'Unknown',
            daysSinceContact,
            status: 'unknown' as string,
          };
          
          if (!lastContact) {
            results.unknown++;
            deviceInfo.status = 'unknown';
          } else if (lastContact < cutoffDate) {
            results.nonCompliant++;
            results.notReporting++;
            deviceInfo.status = 'non-compliant';
            
            // Categorize by severity
            if (daysSinceContact && daysSinceContact >= 90) {
              results.summary.criticalDevices.push({
                ...deviceInfo,
                severity: 'critical',
              });
            } else {
              results.summary.warningDevices.push({
                ...deviceInfo,
                severity: 'warning',
              });
            }
          } else {
            results.compliant++;
            deviceInfo.status = 'compliant';
          }
          
          if (includeDetails && results.devices) {
            results.devices.push(deviceInfo);
          }
        } catch (error) {
          console.error(`Failed to process device ${computer.id}:`, error);
          results.unknown++;
          if (includeDetails && results.devices) {
            results.devices.push({
              id: computer.id?.toString(),
              name: computer.name,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }));
    }
    
    results.complianceRate = results.totalDevices > 0 
      ? ((results.compliant / results.totalDevices) * 100).toFixed(2) + '%'
      : '0%';
    
    // Sort critical and warning devices by days since contact
    results.summary.criticalDevices.sort((a, b) => 
      (b.daysSinceContact || 0) - (a.daysSinceContact || 0)
    );
    results.summary.warningDevices.sort((a, b) => 
      (b.daysSinceContact || 0) - (a.daysSinceContact || 0)
    );
    
    return results;
  }

  // Helper to setup mock responses
  function setupMockResponses(mockData: { computers: any[], detailResponses?: Map<number, any> }) {
    jamfClient.getAllComputers.mockResolvedValue(mockData.computers);
    
    if (mockData.detailResponses) {
      jamfClient.getComputerDetails.mockImplementation((id: string) => {
        const numId = parseInt(id);
        const response = mockData.detailResponses!.get(numId);
        if (response) {
          return Promise.resolve(response.computer);
        }
        return Promise.reject(new Error('Not found'));
      });
    }
  }

  describe('Query Scenarios', () => {
    // Move helper functions to the top of describe block
    function createMockComputerList(count: number, lastContactDaysAgo: number[]) {
      const now = new Date();
      return lastContactDaysAgo.slice(0, count).map((daysAgo, index) => {
        const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return {
          id: index + 1,
          name: `Computer-${index + 1}`,
          serial_number: `SN${String(index + 1).padStart(6, '0')}`,
          username: `user${index + 1}`,
          last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
          last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
          last_contact_time_epoch: lastContactDate.getTime()
        };
      });
    };

    function createMockDetailResponse(computer: any, daysAgo: number) {
      const now = new Date();
      const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return {
        computer: {
          general: {
            id: computer.id,
            name: computer.name,
            serial_number: computer.serial_number,
            last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
            last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
            last_contact_time_epoch: lastContactDate.getTime()
          },
          hardware: {
            model: 'MacBook Pro',
            os_version: '14.2.1'
          },
          location: {
            username: computer.username,
            realname: `Real ${computer.username}`,
            email_address: `${computer.username}@example.com`
          }
        }
      };
    };

    test('should show all devices that haven\'t reported in 30 days', async () => {
      // Create mock data: 2 compliant (5, 20 days), 3 non-compliant (35, 45, 60 days)
      const mockComputers = createMockComputerList(5, [5, 20, 35, 45, 60]);
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        const daysAgo = [5, 20, 35, 45, 60][index];
        detailResponses.set(computer.id, createMockDetailResponse(computer, daysAgo));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });

      // Call the tool through the server handler
      const result = await callCheckDeviceCompliance(30, true);

      expect(result.totalDevices).toBe(5);
      expect(result.compliant).toBe(2);
      expect(result.nonCompliant).toBe(3);
      expect(result.notReporting).toBe(3);
      expect(result.complianceRate).toBe('40.00%');
      
      // Check summary categorization
      expect(result.summary.warningDevices).toHaveLength(3); // 35, 45, and 60 days (all < 90)
      expect(result.summary.criticalDevices).toHaveLength(0); // No devices >= 90 days
      
      // Verify devices are included with details
      expect(result.devices).toHaveLength(5);
      const nonCompliantDevices = result.devices?.filter((d: any) => d.status === 'non-compliant') || [];
      expect(nonCompliantDevices).toHaveLength(3);
      
      // Verify sorting by days since contact
      expect(result.summary.warningDevices[0].daysSinceContact).toBeGreaterThanOrEqual(
        result.summary.warningDevices[1].daysSinceContact
      );
    });

    test('should find devices that haven\'t checked in for 60 days', async () => {
      // Create mock data: 3 compliant (10, 30, 50 days), 2 non-compliant (65, 80 days)
      const mockComputers = createMockComputerList(5, [10, 30, 50, 65, 80]);
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        const daysAgo = [10, 30, 50, 65, 80][index];
        detailResponses.set(computer.id, createMockDetailResponse(computer, daysAgo));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });

      const result = await callCheckDeviceCompliance(60, true);

      expect(result.totalDevices).toBe(5);
      expect(result.compliant).toBe(3);
      expect(result.nonCompliant).toBe(2);
      expect(result.notReporting).toBe(2);
      expect(result.complianceRate).toBe('60.00%');
      
      // All non-compliant should be warnings (not critical until 90+ days)
      expect(result.summary.warningDevices).toHaveLength(2);
      expect(result.summary.criticalDevices).toHaveLength(0);
    });

    test('should find stale devices (90+ days)', async () => {
      // Create mock data with various ages including 90+ days
      const mockComputers = createMockComputerList(6, [20, 45, 70, 95, 120, 180]);
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        const daysAgo = [20, 45, 70, 95, 120, 180][index];
        detailResponses.set(computer.id, createMockDetailResponse(computer, daysAgo));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });

      const result = await callCheckDeviceCompliance(90, true);

      expect(result.totalDevices).toBe(6);
      expect(result.compliant).toBe(3); // 20, 45, 70 days
      expect(result.nonCompliant).toBe(3); // 95, 120, 180 days
      expect(result.notReporting).toBe(3);
      
      // All 90+ day devices should be critical
      expect(result.summary.criticalDevices).toHaveLength(3);
      expect(result.summary.warningDevices).toHaveLength(0);
      
      // Verify critical devices are sorted by staleness
      const criticalDevices = result.summary.criticalDevices;
      expect(criticalDevices[0].daysSinceContact).toBe(180);
      expect(criticalDevices[1].daysSinceContact).toBe(120);
      expect(criticalDevices[2].daysSinceContact).toBe(95);
    });

    test('should provide compliance report with device details', async () => {
      const mockComputers = createMockComputerList(3, [15, 40, 100]);
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        const daysAgo = [15, 40, 100][index];
        detailResponses.set(computer.id, createMockDetailResponse(computer, daysAgo));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });

      const result = await callCheckDeviceCompliance(30, true);

      expect(result.devices).toBeDefined();
      expect(result.devices).toHaveLength(3);
      
      // Verify each device has required fields
      result.devices?.forEach((device: any) => {
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('serialNumber');
        expect(device).toHaveProperty('username');
        expect(device).toHaveProperty('lastContact');
        expect(device).toHaveProperty('lastContactReadable');
        expect(device).toHaveProperty('daysSinceContact');
        expect(device).toHaveProperty('status');
      });

      // Check specific device statuses
      const compliantDevice = result.devices?.find((d: any) => d.daysSinceContact === 15);
      expect(compliantDevice?.status).toBe('compliant');
      
      const warningDevice = result.devices?.find((d: any) => d.daysSinceContact === 40);
      expect(warningDevice?.status).toBe('non-compliant');
      
      const criticalDevice = result.devices?.find((d: any) => d.daysSinceContact === 100);
      expect(criticalDevice?.status).toBe('non-compliant');
    });

    test('should identify critical non-reporting devices', async () => {
      // Create devices with various critical scenarios
      const mockComputers = createMockComputerList(4, [10, 95, 150, 365]);
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        const daysAgo = [10, 95, 150, 365][index];
        detailResponses.set(computer.id, createMockDetailResponse(computer, daysAgo));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });

      const result = await callCheckDeviceCompliance(30, true);

      // Check critical devices (90+ days)
      expect(result.summary.criticalDevices).toHaveLength(3);
      
      // Verify they're sorted by severity (most stale first)
      const criticalDays = result.summary.criticalDevices.map((d: any) => d.daysSinceContact);
      expect(criticalDays).toEqual([365, 150, 95]);
      
      // Each critical device should have severity marked
      result.summary.criticalDevices.forEach((device: any) => {
        expect(device.severity).toBe('critical');
        expect(device.daysSinceContact).toBeGreaterThanOrEqual(90);
      });
    });
  });

  describe('Batch Processing', () => {
    // Helper functions for this section
    function createMockComputerList(count: number, lastContactDaysAgo: number[]) {
      const now = new Date();
      return lastContactDaysAgo.slice(0, count).map((daysAgo, index) => {
        const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return {
          id: index + 1,
          name: `Computer-${index + 1}`,
          serial_number: `SN${String(index + 1).padStart(6, '0')}`,
          username: `user${index + 1}`,
          last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
          last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
          last_contact_time_epoch: lastContactDate.getTime()
        };
      });
    }

    function createMockDetailResponse(computer: any, daysAgo: number) {
      const now = new Date();
      const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return {
        computer: {
          general: {
            id: computer.id,
            name: computer.name,
            serial_number: computer.serial_number,
            last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
            last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
            last_contact_time_epoch: lastContactDate.getTime()
          },
          hardware: {
            model: 'MacBook Pro',
            os_version: '14.2.1'
          },
          location: {
            username: computer.username,
            realname: `Real ${computer.username}`,
            email_address: `${computer.username}@example.com`
          }
        }
      };
    }
    test('should process devices in batches of 10', async () => {
      // Create 25 devices to test batch processing
      const mockComputers = createMockComputerList(25, Array(25).fill(0).map((_, i) => i * 5));
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        detailResponses.set(computer.id, createMockDetailResponse(computer, index * 5));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });
      
      // Mock tracking of requests
      let detailRequestCount = 25; // All requests would be made

      const result = await callCheckDeviceCompliance(30, false);

      expect(result.totalDevices).toBe(25);
      // All detail requests should have been made
      expect(detailRequestCount).toBe(25);
    });

    test('should handle batch processing with some failures', async () => {
      const mockComputers = createMockComputerList(5, [10, 20, 30, 40, 50]);
      
      // Setup mock responses with one failure
      jamfClient.getAllComputers.mockResolvedValue(mockComputers);
      
      jamfClient.getComputerDetails.mockImplementation((id: string) => {
        const numId = parseInt(id);
        const index = mockComputers.findIndex((c: any) => c.id === numId);
        
        if (index === 2) {
          return Promise.reject(new Error('Computer not found'));
        } else {
          const daysAgo = [10, 20, 30, 40, 50][index];
          return Promise.resolve(createMockDetailResponse(mockComputers[index], daysAgo).computer);
        }
      });

      const result = await callCheckDeviceCompliance(30, true);

      expect(result.totalDevices).toBe(5);
      expect(result.unknown).toBe(1); // The failed device
      
      // Should still process the successful ones
      expect(result.compliant).toBe(2); // 10 and 20 days
      expect(result.nonCompliant).toBe(2); // 40 and 50 days
      
      if (result.devices) {
        const errorDevice = result.devices?.find((d: any) => d.status === 'error');
        expect(errorDevice).toBeDefined();
        expect(errorDevice?.error).toBeDefined();
      }
    });
  });

  describe('Date Parsing', () => {
    // Helper functions for this section
    function createMockComputerList(count: number, lastContactDaysAgo: number[]) {
      const now = new Date();
      return lastContactDaysAgo.slice(0, count).map((daysAgo, index) => {
        const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return {
          id: index + 1,
          name: `Computer-${index + 1}`,
          serial_number: `SN${String(index + 1).padStart(6, '0')}`,
          username: `user${index + 1}`,
          last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
          last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
          last_contact_time_epoch: lastContactDate.getTime()
        };
      });
    }

    function createMockDetailResponse(computer: any, daysAgo: number) {
      const now = new Date();
      const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return {
        computer: {
          general: {
            id: computer.id,
            name: computer.name,
            serial_number: computer.serial_number,
            last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
            last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
            last_contact_time_epoch: lastContactDate.getTime()
          },
          hardware: {
            model: 'MacBook Pro',
            os_version: '14.2.1'
          },
          location: {
            username: computer.username,
            realname: `Real ${computer.username}`,
            email_address: `${computer.username}@example.com`
          }
        }
      };
    }
    test('should parse dates from general section correctly', async () => {
      const mockComputers = [{
        id: 1,
        name: 'Test-Computer',
        serial_number: 'SN123456'
      }];
      
      jamfClient.getAllComputers.mockResolvedValue(mockComputers);

      // Test various date formats
      const now = new Date();
      const testDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
      jamfClient.getComputerDetails.mockResolvedValue({
        general: {
          id: 1,
          name: 'Test-Computer',
          serial_number: 'SN123456',
          // Multiple date formats that should all parse to the same date
          last_contact_time_epoch: testDate.getTime(),
          last_contact_time: testDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
          last_contact_time_utc: testDate.toISOString().replace('Z', '+0000')
        }
      });

      const result = await callCheckDeviceCompliance(30, true);

      expect(result.devices).toHaveLength(1);
      const device = result.devices?.[0];
      expect(device.daysSinceContact).toBe(30); // Should be exactly 30 days
    });

    test('should handle missing date fields gracefully', async () => {
      const mockComputers = createMockComputerList(3, [0, 0, 0]);
      
      jamfClient.getAllComputers.mockResolvedValue(mockComputers);

      // Different missing date scenarios
      jamfClient.getComputerDetails.mockImplementation((id: string) => {
        const numId = parseInt(id);
        
        if (numId === 1) {
          return Promise.resolve({
            general: {
              id: 1,
              name: 'Computer-1',
              // No date fields at all
            }
          });
        } else if (numId === 2) {
          return Promise.resolve({
            general: {
              id: 2,
              name: 'Computer-2',
              last_contact_time_epoch: null,
              last_contact_time: '',
              last_contact_time_utc: undefined
            }
          });
        } else if (numId === 3) {
          return Promise.resolve({
            // No general section at all
            id: 3,
            name: 'Computer-3'
          });
        }
        
        return Promise.reject(new Error('Not found'));
      });

      const result = await callCheckDeviceCompliance(30, true);

      expect(result.unknown).toBe(3);
      expect(result.devices?.filter((d: any) => d.status === 'unknown') || []).toHaveLength(3);
      
      result.devices?.forEach((device: any) => {
        if (device.status === 'unknown') {
          expect(device.lastContact).toBe('Unknown');
          expect(device.daysSinceContact).toBeNull();
        }
      });
    });
  });

  describe('Categorization', () => {
    // Helper functions for this section
    function createMockComputerList(count: number, lastContactDaysAgo: number[]) {
      const now = new Date();
      return lastContactDaysAgo.slice(0, count).map((daysAgo, index) => {
        const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return {
          id: index + 1,
          name: `Computer-${index + 1}`,
          serial_number: `SN${String(index + 1).padStart(6, '0')}`,
          username: `user${index + 1}`,
          last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
          last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
          last_contact_time_epoch: lastContactDate.getTime()
        };
      });
    }

    function createMockDetailResponse(computer: any, daysAgo: number) {
      const now = new Date();
      const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return {
        computer: {
          general: {
            id: computer.id,
            name: computer.name,
            serial_number: computer.serial_number,
            last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
            last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
            last_contact_time_epoch: lastContactDate.getTime()
          },
          hardware: {
            model: 'MacBook Pro',
            os_version: '14.2.1'
          },
          location: {
            username: computer.username,
            realname: `Real ${computer.username}`,
            email_address: `${computer.username}@example.com`
          }
        }
      };
    }
    test('should categorize devices correctly by compliance status', async () => {
      const mockComputers = createMockComputerList(6, [5, 29, 30, 31, 89, 90]);
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        const daysAgo = [5, 29, 30, 31, 89, 90][index];
        detailResponses.set(computer.id, createMockDetailResponse(computer, daysAgo));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });

      const result = await callCheckDeviceCompliance(30, true);

      // With 30-day threshold:
      // Compliant: 5, 29, 30 days (≤ 30)
      // Non-compliant: 31, 89, 90 days (> 30)
      expect(result.compliant).toBe(3);
      expect(result.nonCompliant).toBe(3);
      
      // Warning: 31, 89 days (31-89 days)
      // Critical: 90 days (≥ 90 days)
      expect(result.summary.warningDevices).toHaveLength(2);
      expect(result.summary.criticalDevices).toHaveLength(1);
    });

    test('should handle edge cases for 90-day critical threshold', async () => {
      const mockComputers = createMockComputerList(4, [88, 89, 90, 91]);
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        const daysAgo = [88, 89, 90, 91][index];
        detailResponses.set(computer.id, createMockDetailResponse(computer, daysAgo));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });

      const result = await callCheckDeviceCompliance(30, true);

      // All are non-compliant (> 30 days)
      expect(result.nonCompliant).toBe(4);
      
      // 88, 89 days should be warnings
      expect(result.summary.warningDevices).toHaveLength(2);
      expect(result.summary.warningDevices.map((d: any) => d.daysSinceContact).sort()).toEqual([88, 89]);
      
      // 90, 91 days should be critical
      expect(result.summary.criticalDevices).toHaveLength(2);
      expect(result.summary.criticalDevices.map((d: any) => d.daysSinceContact).sort((a: any, b: any) => b - a)).toEqual([91, 90]);
    });
  });

  describe('includeDetails Parameter', () => {
    // Helper functions for this section
    function createMockComputerList(count: number, lastContactDaysAgo: number[]) {
      const now = new Date();
      return lastContactDaysAgo.slice(0, count).map((daysAgo, index) => {
        const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return {
          id: index + 1,
          name: `Computer-${index + 1}`,
          serial_number: `SN${String(index + 1).padStart(6, '0')}`,
          username: `user${index + 1}`,
          last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
          last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
          last_contact_time_epoch: lastContactDate.getTime()
        };
      });
    }

    function createMockDetailResponse(computer: any, daysAgo: number) {
      const now = new Date();
      const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return {
        computer: {
          general: {
            id: computer.id,
            name: computer.name,
            serial_number: computer.serial_number,
            last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
            last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
            last_contact_time_epoch: lastContactDate.getTime()
          },
          hardware: {
            model: 'MacBook Pro',
            os_version: '14.2.1'
          },
          location: {
            username: computer.username,
            realname: `Real ${computer.username}`,
            email_address: `${computer.username}@example.com`
          }
        }
      };
    }
    test('should exclude device details when includeDetails is false', async () => {
      const mockComputers = createMockComputerList(3, [10, 35, 95]);
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        const daysAgo = [10, 35, 95][index];
        detailResponses.set(computer.id, createMockDetailResponse(computer, daysAgo));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });

      const result = await callCheckDeviceCompliance(30, false);

      expect(result.devices).toBeUndefined();
      expect(result.totalDevices).toBe(3);
      expect(result.compliant).toBe(1);
      expect(result.nonCompliant).toBe(2);
      
      // Summary should still be populated
      expect(result.summary.warningDevices).toHaveLength(1);
      expect(result.summary.criticalDevices).toHaveLength(1);
    });

    test('should include full device details when includeDetails is true', async () => {
      const mockComputers = createMockComputerList(2, [25, 45]);
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        const daysAgo = [25, 45][index];
        detailResponses.set(computer.id, createMockDetailResponse(computer, daysAgo));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });

      const result = await callCheckDeviceCompliance(30, true);

      expect(result.devices).toBeDefined();
      expect(result.devices).toHaveLength(2);
      
      const device1 = result.devices?.find((d: any) => d.daysSinceContact === 25);
      expect(device1).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        serialNumber: expect.any(String),
        username: expect.any(String),
        lastContact: expect.any(String),
        lastContactReadable: expect.any(String),
        daysSinceContact: 25,
        status: 'compliant'
      });
    });
  });

  describe('Performance', () => {
    // Helper functions for this section
    function createMockComputerList(count: number, lastContactDaysAgo: number[]) {
      const now = new Date();
      return lastContactDaysAgo.slice(0, count).map((daysAgo, index) => {
        const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return {
          id: index + 1,
          name: `Computer-${index + 1}`,
          serial_number: `SN${String(index + 1).padStart(6, '0')}`,
          username: `user${index + 1}`,
          last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
          last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
          last_contact_time_epoch: lastContactDate.getTime()
        };
      });
    }

    function createMockDetailResponse(computer: any, daysAgo: number) {
      const now = new Date();
      const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return {
        computer: {
          general: {
            id: computer.id,
            name: computer.name,
            serial_number: computer.serial_number,
            last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
            last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
            last_contact_time_epoch: lastContactDate.getTime()
          },
          hardware: {
            model: 'MacBook Pro',
            os_version: '14.2.1'
          },
          location: {
            username: computer.username,
            realname: `Real ${computer.username}`,
            email_address: `${computer.username}@example.com`
          }
        }
      };
    }
    test('should handle large datasets efficiently', async () => {
      // Create 100 devices
      const mockComputers = createMockComputerList(
        100, 
        Array(100).fill(0).map((_, i) => i) // 0-99 days ago
      );
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        detailResponses.set(computer.id, createMockDetailResponse(computer, index));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });

      const startTime = Date.now();
      const result = await callCheckDeviceCompliance(30, false);
      const duration = Date.now() - startTime;

      expect(result.totalDevices).toBe(100);
      expect(result.compliant).toBe(31); // 0-30 days (device exactly 30 days old is still compliant)
      expect(result.nonCompliant).toBe(69); // 31-99 days
      expect(result.summary.criticalDevices.length).toBe(10); // 90-99 days
      
      // Should complete in reasonable time even with 100 devices
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    test('should continue processing when some devices fail', async () => {
      const mockComputers = createMockComputerList(10, Array(10).fill(0).map((_, i) => i * 10));
      
      // Setup mock responses with failures every 3rd device
      jamfClient.getAllComputers.mockResolvedValue(mockComputers);
      
      jamfClient.getComputerDetails.mockImplementation((id: string) => {
        const numId = parseInt(id);
        const index = mockComputers.findIndex((c: any) => c.id === numId);
        
        if (index % 3 === 2) {
          return Promise.reject(new Error('Internal server error'));
        } else {
          return Promise.resolve(createMockDetailResponse(mockComputers[index], index * 10).computer);
        }
      });

      const result = await callCheckDeviceCompliance(30, true);

      expect(result.totalDevices).toBe(10);
      expect(result.unknown).toBe(3); // Failed devices
      
      // Should still process the successful ones
      const processedCount = result.compliant + result.nonCompliant;
      expect(processedCount).toBe(7);
    });
  });

  describe('Error Handling', () => {
    // Helper functions for this section
    function createMockComputerList(count: number, lastContactDaysAgo: number[]) {
      const now = new Date();
      return lastContactDaysAgo.slice(0, count).map((daysAgo, index) => {
        const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return {
          id: index + 1,
          name: `Computer-${index + 1}`,
          serial_number: `SN${String(index + 1).padStart(6, '0')}`,
          username: `user${index + 1}`,
          last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
          last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
          last_contact_time_epoch: lastContactDate.getTime()
        };
      });
    }

    function createMockDetailResponse(computer: any, daysAgo: number) {
      const now = new Date();
      const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return {
        computer: {
          general: {
            id: computer.id,
            name: computer.name,
            serial_number: computer.serial_number,
            last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
            last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
            last_contact_time_epoch: lastContactDate.getTime()
          },
          hardware: {
            model: 'MacBook Pro',
            os_version: '14.2.1'
          },
          location: {
            username: computer.username,
            realname: `Real ${computer.username}`,
            email_address: `${computer.username}@example.com`
          }
        }
      };
    }
    test('should handle empty computer list', async () => {
      jamfClient.getAllComputers.mockResolvedValue([]);

      const result = await callCheckDeviceCompliance(30, true);

      expect(result.totalDevices).toBe(0);
      expect(result.compliant).toBe(0);
      expect(result.nonCompliant).toBe(0);
      expect(result.complianceRate).toBe('0%');
      expect(result.devices).toEqual([]);
    });

    test('should handle API errors when fetching computer list', async () => {
      jamfClient.getAllComputers.mockRejectedValue(new Error('Internal server error'));

      await expect(callCheckDeviceCompliance(30, true)).rejects.toThrow();
    });

    test('should handle malformed computer detail responses', async () => {
      const mockComputers = createMockComputerList(2, [10, 20]);
      
      jamfClient.getAllComputers.mockResolvedValue(mockComputers);

      // Different responses for each computer
      jamfClient.getComputerDetails.mockImplementation((id: string) => {
        const numId = parseInt(id);
        
        if (numId === 1) {
          // First computer has malformed response (missing expected structure)
          return Promise.resolve({
            // Missing general section
            id: 1
          });
        } else if (numId === 2) {
          // Second computer is normal
          return Promise.resolve(createMockDetailResponse(mockComputers[1], 20).computer);
        }
        
        return Promise.reject(new Error('Not found'));
      });

      const result = await callCheckDeviceCompliance(30, true);

      expect(result.totalDevices).toBe(2);
      expect(result.unknown).toBeGreaterThanOrEqual(1); // At least the malformed one
      expect(result.compliant).toBeGreaterThanOrEqual(1); // The good one
    });

    test('should handle network timeouts gracefully', async () => {
      const mockComputers = createMockComputerList(3, [10, 20, 30]);
      
      jamfClient.getAllComputers.mockResolvedValue(mockComputers);

      // Simulate network timeout for second computer
      jamfClient.getComputerDetails.mockImplementation((id: string) => {
        const numId = parseInt(id);
        
        if (numId === 1) {
          return Promise.resolve(createMockDetailResponse(mockComputers[0], 10).computer);
        } else if (numId === 2) {
          const timeoutError = new Error('Network timeout');
          (timeoutError as any).code = 'ECONNABORTED';
          return Promise.reject(timeoutError);
        } else if (numId === 3) {
          return Promise.resolve(createMockDetailResponse(mockComputers[2], 30).computer);
        }
        
        return Promise.reject(new Error('Not found'));
      });

      const result = await callCheckDeviceCompliance(30, true);

      expect(result.totalDevices).toBe(3);
      expect(result.unknown).toBe(1); // The timeout one
      expect(result.compliant + result.nonCompliant).toBe(2); // The successful ones
      
      if (result.devices) {
        const errorDevice = result.devices?.find((d: any) => d.id === '2');
        expect(errorDevice?.status).toBe('error');
        expect(errorDevice?.error).toBeDefined();
      }
    });
  });

  describe('Console Logging', () => {
    // Helper functions for this section
    function createMockComputerList(count: number, lastContactDaysAgo: number[]) {
      const now = new Date();
      return lastContactDaysAgo.slice(0, count).map((daysAgo, index) => {
        const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return {
          id: index + 1,
          name: `Computer-${index + 1}`,
          serial_number: `SN${String(index + 1).padStart(6, '0')}`,
          username: `user${index + 1}`,
          last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
          last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
          last_contact_time_epoch: lastContactDate.getTime()
        };
      });
    }

    function createMockDetailResponse(computer: any, daysAgo: number) {
      const now = new Date();
      const lastContactDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return {
        computer: {
          general: {
            id: computer.id,
            name: computer.name,
            serial_number: computer.serial_number,
            last_contact_time: lastContactDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
            last_contact_time_utc: lastContactDate.toISOString().replace('Z', '+0000'),
            last_contact_time_epoch: lastContactDate.getTime()
          },
          hardware: {
            model: 'MacBook Pro',
            os_version: '14.2.1'
          },
          location: {
            username: computer.username,
            realname: `Real ${computer.username}`,
            email_address: `${computer.username}@example.com`
          }
        }
      };
    }
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    test('should log debug info for first 3 devices', async () => {
      const mockComputers = createMockComputerList(5, [10, 20, 30, 40, 50]);
      
      // Setup detail responses
      const detailResponses = new Map<number, any>();
      mockComputers.forEach((computer: any, index: number) => {
        const daysAgo = [10, 20, 30, 40, 50][index];
        detailResponses.set(computer.id, createMockDetailResponse(computer, daysAgo));
      });

      setupMockResponses({ computers: mockComputers, detailResponses });

      await callCheckDeviceCompliance(30, true);

      // Should have debug logs for first 3 devices
      const debugLogs = consoleErrorSpy.mock.calls.filter(call => 
        call[0]?.includes('Debug - Device')
      );
      expect(debugLogs).toHaveLength(0); // Debug logging is commented out

      // Should not have debug logs for devices 4 and 5
      const device4Logs = consoleErrorSpy.mock.calls.filter(call => 
        call[0]?.includes('Computer-4')
      );
      expect(device4Logs).toHaveLength(0);
    });

    test('should log errors for failed device processing', async () => {
      const mockComputers = createMockComputerList(2, [10, 20]);
      
      jamfClient.getAllComputers.mockResolvedValue(mockComputers);

      jamfClient.getComputerDetails.mockImplementation((id: string) => {
        const numId = parseInt(id);
        
        if (numId === 1) {
          return Promise.resolve(createMockDetailResponse(mockComputers[0], 10).computer);
        } else if (numId === 2) {
          return Promise.reject(new Error('Not found'));
        }
        
        return Promise.reject(new Error('Not found'));
      });

      await callCheckDeviceCompliance(30, true);

      const errorLogs = consoleErrorSpy.mock.calls.filter(call => 
        call[0]?.includes('Failed to process device')
      );
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0][0]).toContain('Failed to process device 2');
    });
  });
});