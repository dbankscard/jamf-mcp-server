import { jest } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { registerTools } from '../../../tools/index.js';
import { JamfApiClient } from '../../../jamf-client.js';
import axios from 'axios';

// Mock axios module
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('getDeviceDetails Tool', () => {
  let server: Server;
  let jamfClient: JamfApiClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Create a mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
      defaults: {
        headers: {
          common: {},
          get: {},
          post: {},
          put: {},
          delete: {}
        }
      },
      interceptors: {
        request: {
          use: jest.fn(),
          eject: jest.fn()
        },
        response: {
          use: jest.fn(),
          eject: jest.fn()
        }
      }
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create = jest.fn(() => mockAxiosInstance);
    
    // Setup auth token response
    mockAxiosInstance.post.mockImplementation((url: string) => {
      if (url === '/api/v1/auth/token') {
        return Promise.resolve({
          data: { token: 'test-token', expires: '2024-12-31T23:59:59.999Z' }
        });
      }
      if (url === '/api/v1/auth/keep-alive') {
        return Promise.resolve({ data: { message: 'Token extended' } });
      }
      return Promise.reject(new Error('Unexpected POST URL'));
    });

    // Create Jamf client
    jamfClient = new JamfApiClient({
      baseUrl: 'https://test.jamfcloud.com',
      username: 'testuser',
      password: 'testpass',
      readOnlyMode: true
    });

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

  describe('Example Question Scenarios', () => {
    test('should show details for device ID 123', async () => {
      // Mock the API response with full device details
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '123',
          name: 'MacBook-Pro-123',
          udid: '12345678-1234-1234-1234-123456789012',
          serialNumber: 'C02ABC123DEF',
          lastContactTime: '2024-12-24T18:27:00.000Z',
          lastReportDate: '2024-12-24T18:27:00.000Z',
          general: {
            name: 'MacBook-Pro-123',
            lastIpAddress: '192.168.1.123',
            lastReportedIp: '192.168.1.123',
            jamfBinaryVersion: '10.42.0',
            platform: 'Mac',
            barcode1: 'BC-123',
            barcode2: 'BC-124',
            assetTag: 'ASSET-123',
            remoteManagement: {
              managed: true,
              managementUsername: 'jamfadmin'
            },
            supervised: true,
            mdmCapable: {
              capable: true,
              capableUsers: ['user123']
            }
          },
          hardware: {
            make: 'Apple',
            model: 'MacBook Pro (16-inch, 2021)',
            modelIdentifier: 'MacBookPro18,1',
            osName: 'macOS',
            osVersion: '14.2.1',
            osBuild: '23C71',
            processorSpeedMhz: 3228,
            processorCount: 1,
            coreCount: 10,
            processorType: 'Apple M1 Pro',
            processorArchitecture: 'arm64',
            busSpeedMhz: 0,
            cacheSizeKilobytes: 0,
            networkAdapterType: 'Ethernet',
            macAddress: '00:11:22:33:44:55',
            altNetworkAdapterType: 'Wi-Fi',
            altMacAddress: '00:11:22:33:44:56',
            totalRamMegabytes: 32768,
            openRamSlots: 0,
            batteryCapacityPercent: 95,
            smcVersion: '',
            nicSpeed: '1000 Mb/s',
            opticalDrive: '',
            bootRom: '10151.61.2',
            bleCapable: true,
            supportsIosAppInstalls: true,
            appleSilicon: true,
            extensionAttributes: []
          },
          userAndLocation: {
            username: 'user123',
            realname: 'Test User 123',
            email: 'user123@example.com',
            position: 'Software Engineer',
            phone: '+1-555-0123',
            departmentId: '1',
            buildingId: '1',
            room: 'Room 123'
          },
          storage: {
            bootDriveAvailableSpaceMegabytes: 547064,
            disks: [
              {
                id: 'disk0',
                device: 'disk0',
                model: 'APPLE SSD AP1024Q',
                revision: '717.120.',
                serialNumber: 'ABC123DEF456',
                sizeMegabytes: 1000240,
                smartStatus: 'Verified',
                type: 'SSD',
                partitions: [
                  {
                    name: 'Macintosh HD',
                    sizeMegabytes: 994662,
                    availableMegabytes: 547064,
                    partitionType: 'APFS',
                    percentUsed: 45,
                    fileVault2State: 'Encrypted',
                    fileVault2ProgressPercent: 100,
                    lvgUuid: '',
                    lvUuid: '',
                    pvUuid: ''
                  }
                ]
              }
            ]
          }
        }
      });

      const result = await jamfClient.getComputerDetails('123');
      
      expect(result.id).toBe('123');
      expect(result.name).toBe('MacBook-Pro-123');
      expect(result.general?.platform).toBe('Mac');
      expect(result.general?.supervised).toBe(true);
      expect(result.hardware?.model).toBe('MacBook Pro (16-inch, 2021)');
      expect(result.userAndLocation?.username).toBe('user123');
      expect(result.storage?.disks?.[0].device).toBe('disk0');
      
      // Verify the request
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory-detail/123');
    });

    test('should show hardware configuration of device 456', async () => {
      // Mock the API response focusing on hardware details
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '456',
          name: 'MacBook-Air-456',
          udid: '45645645-4564-4564-4564-456456456456',
          serialNumber: 'C02DEF456GHI',
          general: {
            name: 'MacBook-Air-456',
            platform: 'Mac',
            supervised: false
          },
          hardware: {
            make: 'Apple',
            model: 'MacBook Air (M2, 2022)',
            modelIdentifier: 'Mac14,2',
            osName: 'macOS',
            osVersion: '14.2.0',
            osBuild: '23C64',
            processorSpeedMhz: 3490,
            processorCount: 1,
            coreCount: 8,
            processorType: 'Apple M2',
            processorArchitecture: 'arm64',
            totalRamMegabytes: 16384,
            batteryCapacityPercent: 87,
            appleSilicon: true,
            bleCapable: true,
            supportsIosAppInstalls: true
          },
          userAndLocation: {
            username: 'user456',
            realname: 'Test User 456',
            email: 'user456@example.com'
          },
          storage: {
            bootDriveAvailableSpaceMegabytes: 250000,
            disks: [
              {
                id: 'disk0',
                device: 'disk0',
                model: 'APPLE SSD AP0512R',
                sizeMegabytes: 500000,
                partitions: [
                  {
                    name: 'Macintosh HD',
                    sizeMegabytes: 494000,
                    availableMegabytes: 250000,
                    partitionType: 'APFS',
                    percentUsed: 49,
                    fileVault2State: 'Encrypted'
                  }
                ]
              }
            ]
          }
        }
      });

      const result = await jamfClient.getComputerDetails('456');
      
      // Verify hardware configuration details
      expect(result.hardware?.model).toBe('MacBook Air (M2, 2022)');
      expect(result.hardware?.processorType).toBe('Apple M2');
      expect(result.hardware?.coreCount).toBe(8);
      expect(result.hardware?.totalRamMegabytes).toBe(16384);
      expect(result.hardware?.batteryCapacityPercent).toBe(87);
      expect(result.hardware?.appleSilicon).toBe(true);
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory-detail/456');
    });

    test('should check storage status of device 789', async () => {
      // Mock the API response with various storage configurations
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '789',
          name: 'MacBook-Pro-789',
          udid: '78978978-7897-7897-7897-789789789789',
          serialNumber: 'C02GHI789JKL',
          general: {
            name: 'MacBook-Pro-789',
            platform: 'Mac'
          },
          hardware: {
            model: 'MacBook Pro (14-inch, 2021)',
            processorType: 'Apple M1 Pro',
            totalRamMegabytes: 32768
          },
          userAndLocation: {
            username: 'user789'
          },
          storage: {
            bootDriveAvailableSpaceMegabytes: 100000,
            disks: [
              {
                id: 'disk0',
                device: 'disk0',
                model: 'APPLE SSD AP2048Q',
                sizeMegabytes: 2000000,
                smartStatus: 'Verified',
                partitions: [
                  {
                    name: 'Macintosh HD',
                    sizeMegabytes: 1950000,
                    availableMegabytes: 100000,
                    percentUsed: 95,
                    partitionType: 'APFS',
                    fileVault2State: 'Encrypted',
                    fileVault2ProgressPercent: 100
                  },
                  {
                    name: 'Recovery',
                    sizeMegabytes: 50000,
                    availableMegabytes: 49000,
                    percentUsed: 2,
                    partitionType: 'APFS',
                    fileVault2State: 'Not Encrypted'
                  }
                ]
              }
            ]
          }
        }
      });

      const result = await jamfClient.getComputerDetails('789');
      
      // Verify storage status details
      expect(result.storage?.bootDriveAvailableSpaceMegabytes).toBe(100000);
      expect(result.storage?.disks).toHaveLength(1);
      expect(result.storage?.disks?.[0].sizeMegabytes).toBe(2000000);
      expect(result.storage?.disks?.[0].smartStatus).toBe('Verified');
      expect(result.storage?.disks?.[0].partitions).toHaveLength(2);
      expect(result.storage?.disks?.[0].partitions?.[0].percentUsed).toBe(95);
      expect(result.storage?.disks?.[0].partitions?.[0].fileVault2State).toBe('Encrypted');
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory-detail/789');
    });

    test('should show who is using device ID 234', async () => {
      // Mock the API response focusing on user information
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '234',
          name: 'MacBook-Pro-234',
          udid: '23423423-2342-2342-2342-234234234234',
          serialNumber: 'C02MNO234PQR',
          general: {
            name: 'MacBook-Pro-234',
            platform: 'Mac',
            remoteManagement: {
              managed: true,
              managementUsername: 'jamfadmin'
            }
          },
          hardware: {
            model: 'MacBook Pro (13-inch, 2020)',
            processorType: 'Intel Core i5'
          },
          userAndLocation: {
            username: 'jsmith',
            realname: 'John Smith',
            email: 'john.smith@example.com',
            position: 'Senior Developer',
            phone: '+1-555-0234',
            departmentId: '3',
            buildingId: '2',
            room: 'Room 234'
          },
          storage: {
            bootDriveAvailableSpaceMegabytes: 300000
          }
        }
      });

      const result = await jamfClient.getComputerDetails('234');
      
      // Verify user information
      expect(result.userAndLocation?.username).toBe('jsmith');
      expect(result.userAndLocation?.realname).toBe('John Smith');
      expect(result.userAndLocation?.email).toBe('john.smith@example.com');
      expect(result.userAndLocation?.position).toBe('Senior Developer');
      expect(result.userAndLocation?.phone).toBe('+1-555-0234');
      expect(result.userAndLocation?.room).toBe('Room 234');
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory-detail/234');
    });
  });

  describe('Flexible Schema Handling', () => {
    test('should handle storage field type variations', async () => {
      // Test with storage as a complex object (as seen in some responses)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '100',
          name: 'Test-Device',
          udid: '10010010-1001-1001-1001-100100100100',
          serialNumber: 'TEST100',
          general: {
            name: 'Test-Device',
            platform: 'Mac'
          },
          hardware: {
            model: 'MacBook Pro'
          },
          storage: {
            bootDriveAvailableSpaceMegabytes: 500000,
            disks: [
              {
                id: 'disk0',
                device: 'disk0',
                sizeMegabytes: 1000000,
                partitions: [
                  {
                    name: 'Macintosh HD',
                    sizeMegabytes: 995000,
                    availableMegabytes: 500000,
                    partitionType: 'APFS',
                    percentUsed: 50,
                    fileVault2State: 'Encrypted'
                  }
                ]
              }
            ]
          }
        }
      });

      const result = await jamfClient.getComputerDetails('100');
      
      expect(result.storage).toBeDefined();
      expect(result.storage?.bootDriveAvailableSpaceMegabytes).toBe(500000);
      expect(result.storage?.disks).toHaveLength(1);
    });

    test('should handle missing storage field gracefully', async () => {
      // Test with no storage field
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '101',
          name: 'Test-Device-No-Storage',
          udid: '10110110-1011-1011-1011-101101101101',
          serialNumber: 'TEST101',
          general: {
            name: 'Test-Device-No-Storage',
            platform: 'Mac'
          },
          hardware: {
            model: 'MacBook Pro',
            totalRamMegabytes: 16384
          },
          userAndLocation: {
            username: 'testuser'
          }
          // No storage field
        }
      });

      const result = await jamfClient.getComputerDetails('101');
      
      expect(result.storage).toBeUndefined();
      expect(result.general?.name).toBe('Test-Device-No-Storage');
      expect(result.hardware?.totalRamMegabytes).toBe(16384);
    });

    test('should handle storage with missing optional fields', async () => {
      // Test with minimal storage data
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '102',
          name: 'Test-Device-Minimal-Storage',
          udid: '10210210-1021-1021-1021-102102102102',
          serialNumber: 'TEST102',
          general: {
            name: 'Test-Device-Minimal-Storage'
          },
          storage: {
            disks: [
              {
                id: 'disk0',
                device: 'disk0',
                sizeMegabytes: 500000
                // No partitions, no other optional fields
              }
            ]
          }
        }
      });

      const result = await jamfClient.getComputerDetails('102');
      
      expect(result.storage?.disks).toHaveLength(1);
      expect(result.storage?.disks?.[0].sizeMegabytes).toBe(500000);
      expect(result.storage?.disks?.[0].partitions).toBeUndefined();
      expect(result.storage?.bootDriveAvailableSpaceMegabytes).toBeUndefined();
    });
  });

  describe('Missing Data Scenarios', () => {
    test('should handle device with minimal data', async () => {
      // Mock response with only required fields
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '999',
          name: 'Minimal-Device',
          udid: '99999999-9999-9999-9999-999999999999',
          serialNumber: 'MIN999999'
          // All other fields missing
        }
      });

      const result = await jamfClient.getComputerDetails('999');
      
      expect(result.id).toBe('999');
      expect(result.name).toBe('Minimal-Device');
      expect(result.serialNumber).toBe('MIN999999');
      expect(result.general).toBeUndefined();
      expect(result.hardware).toBeUndefined();
      expect(result.userAndLocation).toBeUndefined();
      expect(result.storage).toBeUndefined();
    });

    test('should handle device with partial general section', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '998',
          name: 'Partial-General-Device',
          udid: '99899899-9989-9989-9989-998998998998',
          serialNumber: 'TEST998',
          general: {
            name: 'Partial-General-Device',
            platform: 'Mac'
            // Missing many optional fields
          },
          hardware: {
            model: 'MacBook Pro'
          }
        }
      });

      const result = await jamfClient.getComputerDetails('998');
      
      expect(result.general?.name).toBe('Partial-General-Device');
      expect(result.general?.platform).toBe('Mac');
      expect(result.general?.supervised).toBeUndefined();
      expect(result.general?.remoteManagement).toBeUndefined();
    });

    test('should handle device with empty arrays', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '997',
          name: 'Empty-Arrays-Device',
          udid: '99799799-9979-9979-9979-997997997997',
          serialNumber: 'TEST997',
          general: {
            name: 'Empty-Arrays-Device',
            mdmCapable: {
              capable: true,
              capableUsers: []  // Empty array
            }
          },
          hardware: {
            model: 'MacBook Pro',
            extensionAttributes: []  // Empty array
          },
          storage: {
            disks: []  // Empty array
          }
        }
      });

      const result = await jamfClient.getComputerDetails('997');
      
      expect(result.general?.mdmCapable?.capableUsers).toEqual([]);
      expect(result.hardware?.extensionAttributes).toEqual([]);
      expect(result.storage?.disks).toEqual([]);
    });
  });

  describe('Error Cases', () => {
    test('should handle device not found (404)', async () => {
      // Mock 404 response
      const error = new Error('Request failed') as any;
      error.response = {
        status: 404,
        data: {
          httpStatus: 404,
          errors: [
            {
              code: 'RESOURCE_NOT_FOUND',
              description: 'Computer not found',
              id: '0',
              field: null
            }
          ]
        }
      };
      mockAxiosInstance.get.mockRejectedValueOnce(error);

      await expect(jamfClient.getComputerDetails('999999')).rejects.toThrow();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory-detail/999999');
    });

    test('should handle unauthorized error (401)', async () => {
      // Mock 401 response
      const error = new Error('Request failed') as any;
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
      mockAxiosInstance.get.mockRejectedValueOnce(error);

      await expect(jamfClient.getComputerDetails('123')).rejects.toThrow();
    });

    test('should handle forbidden error (403)', async () => {
      // Mock 403 response
      const error = new Error('Request failed') as any;
      error.response = {
        status: 403,
        data: {
          httpStatus: 403,
          errors: [
            {
              code: 'FORBIDDEN',
              description: 'Access denied to computer details'
            }
          ]
        }
      };
      mockAxiosInstance.get.mockRejectedValueOnce(error);

      await expect(jamfClient.getComputerDetails('123')).rejects.toThrow();
    });

    test('should handle server error (500)', async () => {
      // Mock 500 response
      const error = new Error('Request failed') as any;
      error.response = {
        status: 500,
        data: {
          httpStatus: 500,
          errors: [
            {
              code: 'INTERNAL_SERVER_ERROR',
              description: 'An unexpected error occurred'
            }
          ]
        }
      };
      mockAxiosInstance.get.mockRejectedValueOnce(error);

      await expect(jamfClient.getComputerDetails('123')).rejects.toThrow();
    });

    test('should handle network errors', async () => {
      // Mock network error
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(jamfClient.getComputerDetails('123')).rejects.toThrow('Network timeout');
    });

    test('should handle malformed response', async () => {
      // Mock malformed response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          // Missing required id field
          name: 'Malformed-Device'
        }
      });

      await expect(jamfClient.getComputerDetails('123')).rejects.toThrow();
    });
  });

  describe('General Section Fields', () => {
    test('should include all important general section fields', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '500',
          name: 'Full-General-Device',
          udid: '50050050-5005-5005-5005-500500500500',
          serialNumber: 'TEST500',
          general: {
            name: 'Full-General-Device',
            lastIpAddress: '192.168.1.100',
            lastReportedIp: '192.168.1.100',
            jamfBinaryVersion: '10.42.1',
            platform: 'Mac',
            barcode1: 'BC-001',
            barcode2: 'BC-002',
            assetTag: 'ASSET-500',
            remoteManagement: {
              managed: true,
              managementUsername: 'jamfadmin'
            },
            supervised: true,
            mdmCapable: {
              capable: true,
              capableUsers: ['user1', 'user2']
            }
          },
          hardware: {
            model: 'MacBook Pro'
          }
        }
      });

      const result = await jamfClient.getComputerDetails('500');
      
      // Verify all general fields are included
      expect(result.general?.name).toBe('Full-General-Device');
      expect(result.general?.lastIpAddress).toBe('192.168.1.100');
      expect(result.general?.lastReportedIp).toBe('192.168.1.100');
      expect(result.general?.jamfBinaryVersion).toBe('10.42.1');
      expect(result.general?.platform).toBe('Mac');
      expect(result.general?.barcode1).toBe('BC-001');
      expect(result.general?.barcode2).toBe('BC-002');
      expect(result.general?.assetTag).toBe('ASSET-500');
      expect(result.general?.remoteManagement?.managed).toBe(true);
      expect(result.general?.remoteManagement?.managementUsername).toBe('jamfadmin');
      expect(result.general?.supervised).toBe(true);
      expect(result.general?.mdmCapable?.capable).toBe(true);
      expect(result.general?.mdmCapable?.capableUsers).toEqual(['user1', 'user2']);
    });
  });

  describe('Tool Response Format', () => {
    test('should format response correctly for Claude', async () => {
      // Mock a complete response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: '777',
          name: 'Claude-Test-Device',
          udid: '77777777-7777-7777-7777-777777777777',
          serialNumber: 'CLAUDE777',
          general: {
            name: 'Claude-Test-Device',
            platform: 'Mac',
            supervised: true,
            remoteManagement: {
              managed: true,
              managementUsername: 'jamfadmin'
            }
          },
          hardware: {
            model: 'MacBook Pro (16-inch, 2021)',
            osVersion: '14.2.1',
            processorType: 'Apple M1 Pro',
            totalRamMegabytes: 32768,
            batteryCapacityPercent: 90,
            appleSilicon: true
          },
          userAndLocation: {
            username: 'claudeuser',
            realname: 'Claude User',
            email: 'claude@example.com',
            position: 'AI Assistant'
          },
          storage: {
            bootDriveAvailableSpaceMegabytes: 600000,
            disks: [
              {
                id: 'disk0',
                device: 'disk0',
                sizeMegabytes: 1000000,
                partitions: [
                  {
                    name: 'Macintosh HD',
                    sizeMegabytes: 995000,
                    availableMegabytes: 600000,
                    partitionType: 'APFS',
                    percentUsed: 40,
                    fileVault2State: 'Encrypted'
                  }
                ]
              }
            ]
          }
        }
      });

      // Get device details through the client
      const result = await jamfClient.getComputerDetails('777');
      
      // Verify the data structure matches what the tool would return
      expect(result.id).toBe('777');
      expect(result.name).toBe('Claude-Test-Device');
      expect(result.general?.platform).toBe('Mac');
      expect(result.general?.supervised).toBe(true);
      expect(result.general?.remoteManagement?.managementUsername).toBe('jamfadmin');
      expect(result.hardware?.model).toBe('MacBook Pro (16-inch, 2021)');
      expect(result.hardware?.osVersion).toBe('14.2.1');
      expect(result.hardware?.processorType).toBe('Apple M1 Pro');
      expect(result.hardware?.totalRamMegabytes).toBe(32768);
      expect(result.hardware?.batteryCapacityPercent).toBe(90);
      expect(result.hardware?.appleSilicon).toBe(true);
      expect(result.userAndLocation?.username).toBe('claudeuser');
      expect(result.userAndLocation?.realname).toBe('Claude User');
      expect(result.userAndLocation?.email).toBe('claude@example.com');
      expect(result.userAndLocation?.position).toBe('AI Assistant');
      expect(result.storage?.bootDriveAvailableSpaceMegabytes).toBe(600000);
      expect(result.storage?.disks).toHaveLength(1);
      expect(result.storage?.disks?.[0].device).toBe('disk0');
      expect(result.storage?.disks?.[0].sizeMegabytes).toBe(1000000);
      expect(result.storage?.disks?.[0].partitions?.[0].name).toBe('Macintosh HD');
      expect(result.storage?.disks?.[0].partitions?.[0].percentUsed).toBe(40);
    });

    test('should handle error responses gracefully', async () => {
      // Mock an error
      const error = new Error('Request failed') as any;
      error.response = {
        status: 404,
        data: {
          httpStatus: 404,
          errors: [
            {
              code: 'RESOURCE_NOT_FOUND',
              description: 'Computer not found'
            }
          ]
        }
      };
      mockAxiosInstance.get.mockRejectedValueOnce(error);

      // Verify error is thrown
      await expect(jamfClient.getComputerDetails('999')).rejects.toThrow();
    });
  });
});