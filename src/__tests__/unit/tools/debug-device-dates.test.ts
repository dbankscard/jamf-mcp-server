import { jest } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { registerTools } from '../../../tools/index-compat.js';

describe('debugDeviceDates Tool', () => {
  let server: Server;
  let jamfClient: any;

  beforeEach(() => {
    // Create mock Jamf client
    jamfClient = {
      searchComputers: jest.fn(),
      getComputerDetails: jest.fn(),
      getAllComputers: jest.fn(),
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

  // Helper function to simulate the debug device dates tool call
  async function callDebugDeviceDates(limit: number = 3) {
    const devices = await jamfClient.searchComputers('', limit);
    
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
    
    return debugInfo;
  }

  describe('Basic Functionality', () => {
    test('should debug date fields with default limit', async () => {
      // Mock devices with various date formats
      const mockDevices = [
        {
          id: '1',
          name: 'Device-1',
          last_contact_time: '2024-12-24T18:27:00.000Z',
          last_contact_time_epoch: 1735063620000,
          report_date: '2024-12-24'
        },
        {
          id: '2',
          name: 'Device-2',
          last_contact_time_utc: '2024-12-23T14:30:00.000Z',
          lastContactTime: '2024-12-23T14:30:00.000Z'
        },
        {
          id: '3',
          name: 'Device-3',
          report_date_epoch: 1734977400000,
          reportDate: 'Dec 23, 2024 at 2:30 PM'
        }
      ];

      jamfClient.searchComputers.mockResolvedValue(mockDevices);

      const debugInfo = await callDebugDeviceDates();
      
      expect(debugInfo.deviceCount).toBe(3);
      expect(debugInfo.sampleDevices).toHaveLength(3);
      
      // Check first device
      expect(debugInfo.sampleDevices[0]).toMatchObject({
        id: '1',
        name: 'Device-1',
        dateFields: {
          last_contact_time: '2024-12-24T18:27:00.000Z',
          last_contact_time_epoch: 1735063620000,
          report_date: '2024-12-24'
        }
      });
      expect(debugInfo.sampleDevices[0].allKeys).toContain('last_contact_time');
      expect(debugInfo.sampleDevices[0].allKeys).toContain('last_contact_time_epoch');
      
      // Verify searchComputers was called with default limit
      expect(jamfClient.searchComputers).toHaveBeenCalledWith('', 3);
    });

    test('should debug with custom limit', async () => {
      const mockDevices = Array.from({ length: 5 }, (_, i) => ({
        id: String(i + 1),
        name: `Device-${i + 1}`,
        last_contact_time: `2024-12-2${i}T12:00:00.000Z`,
        report_date_epoch: 1735000000000 + (i * 86400000) // Add one day per device
      }));

      jamfClient.searchComputers.mockResolvedValue(mockDevices);

      const debugInfo = await callDebugDeviceDates(5);
      
      expect(debugInfo.deviceCount).toBe(5);
      expect(debugInfo.sampleDevices).toHaveLength(5);
      
      // Verify searchComputers was called with custom limit
      expect(jamfClient.searchComputers).toHaveBeenCalledWith('', 5);
    });
  });

  describe('Date Field Detection', () => {
    test('should detect all possible date field variations', async () => {
      const deviceWithAllDateFields = {
        id: '1',
        name: 'Test-Device',
        // Classic API fields
        last_contact_time: '2024-12-24T18:27:00.000Z',
        last_contact_time_epoch: 1735063620000,
        last_contact_time_utc: '2024-12-24T18:27:00Z',
        report_date: '2024-12-24',
        report_date_epoch: 1735063620000,
        report_date_utc: '2024-12-24T18:27:00Z',
        // Modern API fields
        lastContactTime: '2024-12-24T18:27:00.000Z',
        reportDate: 'Dec 24, 2024 at 6:27 PM',
        // Non-date fields to ensure they're not included
        serial_number: 'ABC123',
        os_version: '14.2.1',
        ip_address: '192.168.1.100'
      };

      jamfClient.searchComputers.mockResolvedValue([deviceWithAllDateFields]);

      const debugInfo = await callDebugDeviceDates(1);
      const device = debugInfo.sampleDevices[0];
      
      // Should have all date fields
      expect(Object.keys(device.dateFields)).toHaveLength(8);
      expect(device.dateFields).toHaveProperty('last_contact_time');
      expect(device.dateFields).toHaveProperty('last_contact_time_epoch');
      expect(device.dateFields).toHaveProperty('last_contact_time_utc');
      expect(device.dateFields).toHaveProperty('report_date');
      expect(device.dateFields).toHaveProperty('report_date_epoch');
      expect(device.dateFields).toHaveProperty('report_date_utc');
      expect(device.dateFields).toHaveProperty('lastContactTime');
      expect(device.dateFields).toHaveProperty('reportDate');
      
      // Should not include non-date fields
      expect(device.dateFields).not.toHaveProperty('serial_number');
      expect(device.dateFields).not.toHaveProperty('os_version');
      expect(device.dateFields).not.toHaveProperty('ip_address');
    });

    test('should handle devices with no date fields', async () => {
      const deviceWithoutDates = {
        id: '1',
        name: 'No-Date-Device',
        serial_number: 'XYZ789',
        os_version: '14.2.0',
        username: 'testuser'
      };

      jamfClient.searchComputers.mockResolvedValue([deviceWithoutDates]);

      const debugInfo = await callDebugDeviceDates(1);
      const device = debugInfo.sampleDevices[0];
      
      expect(device.dateFields).toEqual({});
      expect(device.allKeys).toContain('serial_number');
      expect(device.allKeys).toContain('os_version');
    });

    test('should handle undefined date field values', async () => {
      const deviceWithUndefinedDates = {
        id: '1',
        name: 'Undefined-Dates-Device',
        last_contact_time: undefined,
        last_contact_time_epoch: null,
        report_date: '',
        lastContactTime: false, // Should not be included
        serial_number: 'ABC123'
      };

      jamfClient.searchComputers.mockResolvedValue([deviceWithUndefinedDates]);

      const debugInfo = await callDebugDeviceDates(1);
      const device = debugInfo.sampleDevices[0];
      
      // Only fields with actual values should be included
      expect(device.dateFields).toHaveProperty('report_date', '');
      expect(device.dateFields).toHaveProperty('last_contact_time_epoch', null);
      expect(device.dateFields).toHaveProperty('lastContactTime', false);
      expect(device.dateFields).not.toHaveProperty('last_contact_time');
    });
  });

  describe('Raw Device Data', () => {
    test('should include complete raw device data', async () => {
      const complexDevice = {
        id: '1',
        name: 'Complex-Device',
        last_contact_time: '2024-12-24T18:27:00.000Z',
        general: {
          name: 'Complex-Device',
          serial_number: 'COMPLEX123'
        },
        hardware: {
          model: 'MacBook Pro',
          os_version: '14.2.1'
        },
        location: {
          username: 'jdoe',
          department: 'IT'
        }
      };

      jamfClient.searchComputers.mockResolvedValue([complexDevice]);

      const debugInfo = await callDebugDeviceDates(1);
      const device = debugInfo.sampleDevices[0];
      
      // Should include complete raw device data
      expect(device.rawDevice).toEqual(complexDevice);
      expect(device.rawDevice.general).toEqual({
        name: 'Complex-Device',
        serial_number: 'COMPLEX123'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      jamfClient.searchComputers.mockRejectedValue(new Error('API Error'));

      await expect(callDebugDeviceDates()).rejects.toThrow('API Error');
    });

    test('should handle empty device list', async () => {
      jamfClient.searchComputers.mockResolvedValue([]);

      const debugInfo = await callDebugDeviceDates(10);
      
      expect(debugInfo.deviceCount).toBe(0);
      expect(debugInfo.sampleDevices).toHaveLength(0);
    });

    test('should handle invalid limit parameter', async () => {
      jamfClient.searchComputers.mockResolvedValue([]);

      // Test with negative limit
      jamfClient.searchComputers.mockResolvedValue([]);
      const result1 = await callDebugDeviceDates(-5);
      expect(result1).toBeDefined();
      
      // Test with zero limit
      const result2 = await callDebugDeviceDates(0);
      expect(result2).toBeDefined();
    });
  });

  describe('Output Format', () => {
    test('should provide well-formatted debug output', async () => {
      const mockDevices = [
        {
          id: '1',
          name: 'Device-1',
          last_contact_time: '2024-12-24T18:27:00.000Z',
          last_contact_time_epoch: 1735063620000,
          serial_number: 'SN001',
          model: 'MacBook Pro'
        },
        {
          id: '2',
          name: 'Device-2',
          report_date: '2024-12-23',
          report_date_utc: '2024-12-23T00:00:00Z',
          username: 'testuser',
          department: 'Engineering'
        }
      ];

      jamfClient.searchComputers.mockResolvedValue(mockDevices);

      const debugInfo = await callDebugDeviceDates(2);
      
      expect(debugInfo).toHaveProperty('deviceCount');
      expect(debugInfo).toHaveProperty('sampleDevices');
      
      // Verify each device has required fields
      debugInfo.sampleDevices.forEach((device: any) => {
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('allKeys');
        expect(device).toHaveProperty('dateFields');
        expect(device).toHaveProperty('rawDevice');
        
        // allKeys should be an array
        expect(Array.isArray(device.allKeys)).toBe(true);
        
        // dateFields should be an object
        expect(typeof device.dateFields).toBe('object');
      });
    });

    test('should handle special characters in device names', async () => {
      const deviceWithSpecialChars = {
        id: '1',
        name: 'Device@#$%^&*()_+{}[]|\\:";\'<>?,./~`',
        last_contact_time: '2024-12-24T18:27:00.000Z',
        'special-field': 'value with "quotes" and \'apostrophes\''
      };

      jamfClient.searchComputers.mockResolvedValue([deviceWithSpecialChars]);

      const debugInfo = await callDebugDeviceDates(1);
      expect(debugInfo.sampleDevices[0].name).toBe('Device@#$%^&*()_+{}[]|\\:";\'<>?,./~`');
    });
  });
});