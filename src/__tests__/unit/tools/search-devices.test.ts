import { jest } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { registerTools } from '../../../tools/index.js';
import { JamfApiClient } from '../../../jamf-client.js';
import axios from 'axios';

// Mock axios module
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('searchDevices Tool', () => {
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

  describe('Search Scenarios', () => {
    test('should find all MacBooks', async () => {
      // Mock the API response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: '1',
              name: 'MacBook-Pro-001',
              udid: '12345678-1234-1234-1234-123456789012',
              serialNumber: 'C02ABC123DEF',
              lastContactTime: '2024-12-24T18:27:00.000Z',
              osVersion: '14.2.1',
              ipAddress: '192.168.1.100',
              userApprovedMdm: true
            },
            {
              id: '2',
              name: 'MacBook-Air-002',
              udid: '87654321-4321-4321-4321-210987654321',
              serialNumber: 'C02DEF456GHI',
              lastContactTime: '2024-12-23T14:30:00.000Z',
              osVersion: '14.2.0',
              ipAddress: '192.168.1.101',
              userApprovedMdm: true
            }
          ]
        }
      });

      const result = await jamfClient.searchComputers('MacBook');
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('MacBook-Pro-001');
      expect(result[1].name).toBe('MacBook-Air-002');
      
      // Verify the request
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory', {
        params: expect.objectContaining({
          'page-size': 100,
          'filter': expect.stringContaining('*MacBook*')
        })
      });
    });

    test('should search for John Smith\'s devices', async () => {
      // Mock the API response for user search
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: '3',
              name: 'John-Smith-MacBook',
              udid: '11111111-1111-1111-1111-111111111111',
              serialNumber: 'C02JOH123NSM',
              lastContactTime: '2024-12-24T12:00:00.000Z',
              osVersion: '14.2.1',
              ipAddress: '192.168.1.50',
              userApprovedMdm: true,
              userAndLocation: {
                username: 'jsmith',
                realname: 'John Smith',
                email: 'john.smith@example.com'
              }
            }
          ]
        }
      });

      const result = await jamfClient.searchComputers('John Smith');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John-Smith-MacBook');
      
      // Verify the request includes username and email in filter
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory', {
        params: expect.objectContaining({
          'filter': expect.stringContaining('*John Smith*')
        })
      });
    });

    test('should find device with serial number ABC123', async () => {
      // Mock the API response for serial number search
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: '4',
              name: 'Device-ABC123',
              udid: '22222222-2222-2222-2222-222222222222',
              serialNumber: 'ABC123',
              lastContactTime: '2024-12-24T10:00:00.000Z',
              osVersion: '14.1.0',
              ipAddress: '192.168.1.75',
              userApprovedMdm: true
            }
          ]
        }
      });

      const result = await jamfClient.searchComputers('ABC123');
      
      expect(result).toHaveLength(1);
      expect(result[0].serialNumber).toBe('ABC123');
      
      // Verify the request includes serialNumber in filter
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory', {
        params: expect.objectContaining({
          'filter': expect.stringContaining('general.serialNumber=="*ABC123*"')
        })
      });
    });

    test('should show devices with IP 192.168.1.50', async () => {
      // Mock the API response for IP address search
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: '5',
              name: 'Office-Mac-001',
              udid: '33333333-3333-3333-3333-333333333333',
              serialNumber: 'C02OFF001MAC',
              lastContactTime: '2024-12-24T09:00:00.000Z',
              osVersion: '14.2.1',
              ipAddress: '192.168.1.50',
              userApprovedMdm: true
            },
            {
              id: '6',
              name: 'Office-Mac-002',
              udid: '44444444-4444-4444-4444-444444444444',
              serialNumber: 'C02OFF002MAC',
              lastContactTime: '2024-12-24T09:30:00.000Z',
              osVersion: '14.2.0',
              ipAddress: '192.168.1.50',
              userApprovedMdm: false
            }
          ]
        }
      });

      const result = await jamfClient.searchComputers('192.168.1.50');
      
      expect(result).toHaveLength(2);
      expect(result[0].ipAddress).toBe('192.168.1.50');
      expect(result[1].ipAddress).toBe('192.168.1.50');
      
      // Verify the request includes IP in filter
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory', {
        params: expect.objectContaining({
          'filter': expect.stringContaining('general.lastReportedIp=="*192.168.1.50*"')
        })
      });
    });

    test('should find all devices in the IT department', async () => {
      // Mock the API response for department search
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: '7',
              name: 'IT-MacBook-001',
              udid: '55555555-5555-5555-5555-555555555555',
              serialNumber: 'C02IT001MAC',
              lastContactTime: '2024-12-24T08:00:00.000Z',
              osVersion: '14.2.1',
              ipAddress: '192.168.2.10',
              userApprovedMdm: true,
              userAndLocation: {
                department: 'IT',
                username: 'ituser1'
              }
            },
            {
              id: '8',
              name: 'IT-MacBook-002',
              udid: '66666666-6666-6666-6666-666666666666',
              serialNumber: 'C02IT002MAC',
              lastContactTime: '2024-12-24T08:30:00.000Z',
              osVersion: '14.2.1',
              ipAddress: '192.168.2.11',
              userApprovedMdm: true,
              userAndLocation: {
                department: 'IT',
                username: 'ituser2'
              }
            }
          ]
        }
      });

      const result = await jamfClient.searchComputers('IT department');
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toContain('IT');
      expect(result[1].name).toContain('IT');
    });
  });

  describe('Edge Cases', () => {
    test('should handle no results', async () => {
      // Mock empty response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: []
        }
      });

      const result = await jamfClient.searchComputers('NonExistentDevice');
      
      expect(result).toHaveLength(0);
    });

    test('should handle special characters in search query', async () => {
      // Mock response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: []
        }
      });

      const specialCharsQuery = 'Device@#$%^&*()';
      const result = await jamfClient.searchComputers(specialCharsQuery);
      
      // Verify the request was made with special characters
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory', {
        params: expect.objectContaining({
          'filter': expect.stringContaining(specialCharsQuery)
        })
      });
    });

    test('should handle empty search query', async () => {
      // Mock response with all devices
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: '1',
              name: 'MacBook-Pro-001',
              udid: '12345678-1234-1234-1234-123456789012',
              serialNumber: 'C02ABC123DEF',
              lastContactTime: '2024-12-24T18:27:00.000Z',
              osVersion: '14.2.1',
              ipAddress: '192.168.1.100',
              userApprovedMdm: true
            }
          ]
        }
      });

      const result = await jamfClient.searchComputers('');
      
      // Should return results without filter
      expect(result.length).toBeGreaterThan(0);
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory', {
        params: {
          'page-size': 100,
          'filter': undefined
        }
      });
    });
  });

  describe('Limit Parameter', () => {
    test('should respect default limit of 50', async () => {
      // Mock response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: Array(50).fill(null).map((_, i) => ({
            id: String(i + 1),
            name: `Device-${i + 1}`,
            udid: `${i + 1}0000000-0000-0000-0000-000000000000`,
            serialNumber: `SN${String(i + 1).padStart(6, '0')}`,
            lastContactTime: '2024-12-24T12:00:00.000Z',
            osVersion: '14.2.1',
            ipAddress: `192.168.1.${i + 1}`,
            userApprovedMdm: true
          }))
        }
      });

      // Search without specifying limit (should use default)
      const result = await jamfClient.searchComputers('Device', 50);
      
      expect(result).toHaveLength(50);
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory', {
        params: expect.objectContaining({
          'page-size': 50
        })
      });
    });

    test('should respect custom limit', async () => {
      // Mock response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: Array(10).fill(null).map((_, i) => ({
            id: String(i + 1),
            name: `Device-${i + 1}`,
            udid: `${i + 1}0000000-0000-0000-0000-000000000000`,
            serialNumber: `SN${String(i + 1).padStart(6, '0')}`,
            lastContactTime: '2024-12-24T12:00:00.000Z',
            osVersion: '14.2.1',
            ipAddress: `192.168.1.${i + 1}`,
            userApprovedMdm: true
          }))
        }
      });

      const result = await jamfClient.searchComputers('Device', 10);
      
      expect(result).toHaveLength(10);
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/computers-inventory', {
        params: expect.objectContaining({
          'page-size': 10
        })
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 401 unauthorized error', async () => {
      // Mock unauthorized response
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

      await expect(jamfClient.searchComputers('test')).rejects.toThrow();
    });

    test('should handle 403 forbidden error', async () => {
      // Mock forbidden response
      const error = new Error('Request failed') as any;
      error.response = {
        status: 403,
        data: {
          httpStatus: 403,
          errors: [
            {
              code: 'FORBIDDEN',
              description: 'Access denied'
            }
          ]
        }
      };
      mockAxiosInstance.get.mockRejectedValueOnce(error);

      await expect(jamfClient.searchComputers('test')).rejects.toThrow();
    });

    test('should handle 500 server error', async () => {
      // Mock server error
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

      await expect(jamfClient.searchComputers('test')).rejects.toThrow();
    });

    test('should handle network errors', async () => {
      // Mock network error
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(jamfClient.searchComputers('test')).rejects.toThrow('Network error');
    });
  });

  describe('Response Format', () => {
    test('should return correct format for Claude', async () => {
      // Mock response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: '100',
              name: 'Test-MacBook',
              udid: '99999999-9999-9999-9999-999999999999',
              serialNumber: 'TEST123456',
              lastContactTime: '2024-12-24T18:27:00.000Z',
              osVersion: '14.2.1',
              ipAddress: '192.168.1.200',
              userApprovedMdm: true
            }
          ]
        }
      });

      const result = await jamfClient.searchComputers('Test-MacBook');
      
      // Verify the response structure matches what searchDevices tool returns
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '100',
        name: 'Test-MacBook',
        serialNumber: 'TEST123456',
        lastContactTime: '2024-12-24T18:27:00.000Z',
        osVersion: '14.2.1',
        ipAddress: '192.168.1.200',
        userApprovedMdm: true
      });
    });

    test('should handle missing optional fields', async () => {
      // Mock response with minimal data
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: '101',
              name: 'Minimal-Device',
              udid: '88888888-8888-8888-8888-888888888888',
              serialNumber: 'MIN123456'
              // Missing optional fields: lastContactTime, osVersion, ipAddress, userApprovedMdm
            }
          ]
        }
      });

      const result = await jamfClient.searchComputers('Minimal-Device');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '101',
        name: 'Minimal-Device',
        serialNumber: 'MIN123456'
      });
      // Optional fields should be handled gracefully
      expect(result[0].lastContactTime).toBeUndefined();
      expect(result[0].osVersion).toBeUndefined();
      expect(result[0].ipAddress).toBeUndefined();
      expect(result[0].userApprovedMdm).toBeUndefined();
    });
  });
});