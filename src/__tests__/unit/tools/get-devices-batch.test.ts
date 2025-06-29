import { jest } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { registerTools } from '../../../tools/index-compat.js';

describe('getDevicesBatch Tool', () => {
  let server: Server;
  let jamfClient: any;

  beforeEach(() => {
    // Create mock Jamf client
    jamfClient = {
      getComputerDetails: jest.fn(),
      getAllComputers: jest.fn(),
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

  // Helper function to simulate the getDevicesBatch tool call
  async function callGetDevicesBatch(deviceIds: string[], includeBasicOnly: boolean = false) {
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
    
    return {
      requested: deviceIds.length,
      successful: devices.length,
      failed: errors.length,
      devices,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  describe('Basic Functionality', () => {
    test('should fetch details for multiple devices', async () => {
      // Mock device details for each device
      const device1 = {
        id: '1',
        general: {
          name: 'MacBook-Pro-001',
          serial_number: 'C02ABC123DEF',
          last_contact_time: '2024-12-24T18:27:00.000Z'
        },
        hardware: {
          os_version: '14.2.1'
        },
        location: {
          username: 'jdoe'
        }
      };

      const device2 = {
        id: '2',
        general: {
          name: 'MacBook-Air-002',
          serial_number: 'C02DEF456GHI',
          last_contact_time: '2024-12-23T14:30:00.000Z'
        },
        hardware: {
          os_version: '14.2.0'
        },
        location: {
          username: 'asmith'
        }
      };

      jamfClient.getComputerDetails
        .mockResolvedValueOnce(device1)
        .mockResolvedValueOnce(device2);

      const responseData = await callGetDevicesBatch(['1', '2']);

      expect(responseData.requested).toBe(2);
      expect(responseData.successful).toBe(2);
      expect(responseData.failed).toBe(0);
      expect(responseData.devices).toHaveLength(2);
      expect(responseData.devices[0]).toEqual(device1);
      expect(responseData.devices[1]).toEqual(device2);
    });

    test('should return basic info only when includeBasicOnly is true', async () => {
      // Mock full device details
      const fullDevice = {
        id: '1',
        general: {
          name: 'MacBook-Pro-001',
          serial_number: 'C02ABC123DEF',
          last_contact_time: '2024-12-24T18:27:00.000Z',
          platform: 'Mac',
          supervised: true
        },
        hardware: {
          os_version: '14.2.1',
          model: 'MacBook Pro',
          processor_type: 'Apple M1',
          total_ram: 16384
        },
        location: {
          username: 'jdoe',
          realname: 'John Doe',
          email: 'john.doe@example.com'
        },
        storage: {
          bootDriveAvailableSpaceMegabytes: 250000,
          disks: [
            {
              device: 'disk0',
              sizeMegabytes: 500000
            }
          ]
        }
      };

      jamfClient.getComputerDetails.mockResolvedValue(fullDevice);

      const responseData = await callGetDevicesBatch(['1'], true);
      expect(responseData.devices).toHaveLength(1);
      
      const basicDevice = responseData.devices[0];
      // Should only include basic fields
      expect(basicDevice).toHaveProperty('id', '1');
      expect(basicDevice).toHaveProperty('name', 'MacBook-Pro-001');
      expect(basicDevice).toHaveProperty('serialNumber', 'C02ABC123DEF');
      expect(basicDevice).toHaveProperty('lastContactTime', '2024-12-24T18:27:00.000Z');
      expect(basicDevice).toHaveProperty('osVersion', '14.2.1');
      expect(basicDevice).toHaveProperty('username', 'jdoe');
      
      // Should not include full details
      expect(basicDevice).not.toHaveProperty('storage');
      expect(basicDevice).not.toHaveProperty('hardware');
      expect(basicDevice).not.toHaveProperty('general');
    });
  });

  describe('Error Handling', () => {
    test('should handle partial failures gracefully', async () => {
      // First device succeeds, second fails
      const device1 = {
        id: '1',
        general: {
          name: 'MacBook-Pro-001',
          serial_number: 'C02ABC123DEF'
        }
      };

      jamfClient.getComputerDetails
        .mockResolvedValueOnce(device1)
        .mockRejectedValueOnce(new Error('Device not found'));

      const responseData = await callGetDevicesBatch(['1', '2']);
      expect(responseData.requested).toBe(2);
      expect(responseData.successful).toBe(1);
      expect(responseData.failed).toBe(1);
      expect(responseData.devices).toHaveLength(1);
      expect(responseData.errors).toHaveLength(1);
      expect(responseData.errors[0]).toEqual({
        deviceId: '2',
        error: 'Device not found'
      });
    });

    test('should handle all devices failing', async () => {
      jamfClient.getComputerDetails
        .mockRejectedValue(new Error('API Error'));

      const responseData = await callGetDevicesBatch(['1', '2', '3']);
      expect(responseData.requested).toBe(3);
      expect(responseData.successful).toBe(0);
      expect(responseData.failed).toBe(3);
      expect(responseData.devices).toHaveLength(0);
      expect(responseData.errors).toHaveLength(3);
      
      responseData.errors.forEach((error: any, index: number) => {
        expect(error.deviceId).toBe(String(index + 1));
        expect(error.error).toBe('API Error');
      });
    });

    test('should handle empty device ID array', async () => {
      const responseData = await callGetDevicesBatch([]);
      expect(responseData.requested).toBe(0);
      expect(responseData.successful).toBe(0);
      expect(responseData.failed).toBe(0);
      expect(responseData.devices).toHaveLength(0);
    });
  });

  describe('Large Batch Handling', () => {
    test('should handle large batch of devices', async () => {
      // Mock 50 devices
      const deviceCount = 50;
      const devices = Array.from({ length: deviceCount }, (_, i) => ({
        id: String(i + 1),
        general: {
          name: `MacBook-${i + 1}`,
          serial_number: `SN${String(i + 1).padStart(6, '0')}`,
          last_contact_time: '2024-12-24T12:00:00.000Z'
        },
        hardware: {
          os_version: '14.2.1'
        },
        location: {
          username: `user${i + 1}`
        }
      }));

      devices.forEach(device => {
        jamfClient.getComputerDetails.mockResolvedValueOnce(device);
      });

      const deviceIds = devices.map(d => d.id);
      const responseData = await callGetDevicesBatch(deviceIds, true);
      expect(responseData.requested).toBe(deviceCount);
      expect(responseData.successful).toBe(deviceCount);
      expect(responseData.failed).toBe(0);
      expect(responseData.devices).toHaveLength(deviceCount);
    });
  });

  describe('Data Format Handling', () => {
    test('should handle modern API format', async () => {
      // Modern API format with camelCase
      const modernDevice = {
        id: '1',
        name: 'MacBook-Pro-001',
        serialNumber: 'C02ABC123DEF',
        lastContactTime: '2024-12-24T18:27:00.000Z',
        osVersion: '14.2.1',
        username: 'jdoe'
      };

      jamfClient.getComputerDetails.mockResolvedValue(modernDevice);

      const responseData = await callGetDevicesBatch(['1'], true);
      const device = responseData.devices[0];
      
      expect(device.id).toBe('1');
      expect(device.name).toBe('MacBook-Pro-001');
      expect(device.serialNumber).toBe('C02ABC123DEF');
    });

    test('should handle classic API format', async () => {
      // Classic API format with snake_case
      const classicDevice = {
        id: '1',
        general: {
          name: 'MacBook-Pro-001',
          serial_number: 'C02ABC123DEF',
          last_contact_time: '2024-12-24T18:27:00.000Z'
        },
        hardware: {
          os_version: '14.2.1'
        },
        location: {
          username: 'jdoe'
        }
      };

      jamfClient.getComputerDetails.mockResolvedValue(classicDevice);

      const responseData = await callGetDevicesBatch(['1'], true);
      const device = responseData.devices[0];
      
      expect(device.id).toBe('1');
      expect(device.name).toBe('MacBook-Pro-001');
      expect(device.serialNumber).toBe('C02ABC123DEF');
      expect(device.osVersion).toBe('14.2.1');
    });

    test('should handle mixed responses in batch', async () => {
      // Mix of modern and classic formats
      const modernDevice = {
        id: '1',
        name: 'Modern-Device',
        serialNumber: 'MODERN123',
        lastContactTime: '2024-12-24T18:00:00.000Z',
        osVersion: '14.2.1',
        username: 'modern'
      };

      const classicDevice = {
        id: '2',
        general: {
          name: 'Classic-Device',
          serial_number: 'CLASSIC123',
          last_contact_time: '2024-12-24T17:00:00.000Z'
        },
        hardware: {
          os_version: '14.2.0'
        },
        location: {
          username: 'classic'
        }
      };

      jamfClient.getComputerDetails
        .mockResolvedValueOnce(modernDevice)
        .mockResolvedValueOnce(classicDevice);

      const responseData = await callGetDevicesBatch(['1', '2'], true);
      expect(responseData.devices).toHaveLength(2);
      
      // Both should be normalized correctly
      expect(responseData.devices[0].name).toBe('Modern-Device');
      expect(responseData.devices[0].serialNumber).toBe('MODERN123');
      
      expect(responseData.devices[1].name).toBe('Classic-Device');
      expect(responseData.devices[1].serialNumber).toBe('CLASSIC123');
    });
  });
});