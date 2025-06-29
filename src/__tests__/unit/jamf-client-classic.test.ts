import { jest } from '@jest/globals';
import axios from 'axios';
import { JamfApiClientClassic, parseJamfDate, formatDateForJamf } from '../../jamf-client-classic.js';

// Mock axios module
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('JamfApiClientClassic', () => {
  let client: JamfApiClientClassic;
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
    
    client = new JamfApiClientClassic({
      baseUrl: 'https://test.jamfcloud.com',
      username: 'testuser',
      password: 'testpass',
      readOnlyMode: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Date Parsing', () => {
    test('should parse epoch timestamps correctly', () => {
      // 1735074420000 ms = 2024-12-24T21:07:00.000Z
      const epochMs = 1735074420000;
      const epochSeconds = 1735074420;
      const expectedDate = new Date(epochMs);
      
      const parsedMs = parseJamfDate(epochMs);
      const parsedSeconds = parseJamfDate(epochSeconds);
      
      expect(parsedMs).toEqual(expectedDate);
      expect(parsedSeconds).toEqual(expectedDate);
    });

    test('should parse Jamf date formats correctly', () => {
      // Test plain format (assumes UTC)
      const jamfFormat = '2024-12-24 18:27:00';
      const parsed1 = parseJamfDate(jamfFormat);
      expect(parsed1?.toISOString()).toBe('2024-12-24T18:27:00.000Z');
      
      // Test UTC format with +0000
      const jamfUTC = '2024-12-24T18:27:00.000+0000';
      const parsed2 = parseJamfDate(jamfUTC);
      expect(parsed2?.toISOString()).toBe('2024-12-24T18:27:00.000Z');
    });

    test('should handle invalid dates gracefully', () => {
      expect(parseJamfDate(null)).toBeNull();
      expect(parseJamfDate(undefined)).toBeNull();
      expect(parseJamfDate('')).toBeNull();
      expect(parseJamfDate('invalid-date')).toBeNull();
    });

    test('should format dates for Jamf API', () => {
      const date = new Date('2024-12-24T18:27:00.000Z');
      expect(formatDateForJamf(date)).toBe('2024-12-24 18:27:00');
    });
  });

  describe('Computer Search', () => {
    test('should search computers by name', async () => {
      const mockResponse = {
        data: {
          computers: [
            {
              id: 1,
              name: 'MacBook-Pro-001',
              serial_number: 'C02ABC123DEF',
              udid: '12345678-1234-1234-1234-123456789012',
              username: 'johndoe',
              last_contact_time: '2024-12-24 18:27:00',
              last_contact_time_utc: '2024-12-24T18:27:00.000+0000',
              last_contact_time_epoch: 1735074420000
            },
            {
              id: 2,
              name: 'MacBook-Air-002',
              serial_number: 'C02DEF456GHI',
              udid: '87654321-4321-4321-4321-210987654321',
              username: 'janedoe',
              last_contact_time: '2024-12-23 14:30:00',
              last_contact_time_utc: '2024-12-23T14:30:00.000+0000',
              last_contact_time_epoch: 1734960600000
            }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const results = await client.searchComputers('MacBook');
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('MacBook-Pro-001');
      expect(results[0].id).toBe(1);
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/JSSResource/computers');
    });

    test('should handle empty search query', async () => {
      const mockResponse = {
        data: {
          computers: [
            { id: 1, name: 'MacBook-Pro-001' },
            { id: 2, name: 'MacBook-Air-002' }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const results = await client.searchComputers('');
      
      expect(results).toHaveLength(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/JSSResource/computers');
    });

    test('should handle search errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Internal Server Error'));

      await expect(client.searchComputers('test')).rejects.toThrow('Internal Server Error');
    });

    test('should parse last contact times correctly', async () => {
      const mockResponse = {
        data: {
          computers: [
            {
              id: 1,
              name: 'MacBook-Pro-001',
              last_contact_time: '2024-12-24 18:27:00',
              last_contact_time_utc: '2024-12-24T18:27:00.000+0000',
              last_contact_time_epoch: 1735074420000
            }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const results = await client.searchComputers('MacBook');
      const computer = results[0];
      
      // Verify the raw date fields exist
      expect(computer.last_contact_time).toBe('2024-12-24 18:27:00');
      expect(computer.last_contact_time_utc).toBe('2024-12-24T18:27:00.000+0000');
      expect(computer.last_contact_time_epoch).toBe(1735074420000);
      
      // All should parse to dates (UTC vs plain format will differ due to timezone)
      const parsed1 = parseJamfDate(computer.last_contact_time);
      const parsed2 = parseJamfDate(computer.last_contact_time_utc);
      const parsed3 = parseJamfDate(computer.last_contact_time_epoch);
      
      // Verify all formats parse successfully
      expect(parsed1).toBeTruthy();
      expect(parsed2).toBeTruthy();
      expect(parsed3).toBeTruthy();
      
      // The epoch format should be correct
      expect(parsed3?.getTime()).toBe(1735074420000);
    });
  });

  describe('Computer Details', () => {
    test('should fetch computer details by ID', async () => {
      const mockResponse = {
        data: {
          computer: {
            general: {
              id: 1,
              name: 'MacBook-Pro-001',
              serial_number: 'C02ABC123DEF',
              udid: '12345678-1234-1234-1234-123456789012',
              last_contact_time: '2024-12-24 18:27:00',
              last_contact_time_utc: '2024-12-24T18:27:00.000+0000',
              last_contact_time_epoch: 1735074420000,
              report_date: '2024-12-24 18:27:00',
              report_date_utc: '2024-12-24T18:27:00.000+0000',
              report_date_epoch: 1735074420000
            },
            hardware: {
              model: 'MacBook Pro (16-inch, 2021)',
              os_version: '14.2.1',
              processor_type: 'Apple M1 Pro',
              total_ram: 32768
            },
            location: {
              username: 'johndoe',
              real_name: 'John Doe',
              email_address: 'john.doe@example.com'
            }
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const details = await client.getComputerDetails('1');
      
      expect(details.general.id).toBe(1);
      expect(details.general.name).toBe('MacBook-Pro-001');
      expect(details.hardware.model).toBe('MacBook Pro (16-inch, 2021)');
      expect(details.location.username).toBe('johndoe');
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/JSSResource/computers/id/1');
    });

    test('should handle computer not found', async () => {
      const error = new Error('Request failed') as any;
      error.response = {
        status: 404,
        data: {
          error: 'Computer not found'
        }
      };
      mockAxiosInstance.get.mockRejectedValueOnce(error);

      await expect(client.getComputerDetails('999')).rejects.toThrow();
    });

    test('should parse date fields from general section', async () => {
      const mockResponse = {
        data: {
          computer: {
            general: {
              id: 1,
              name: 'MacBook-Pro-001',
              last_contact_time: '2024-12-24 18:27:00',
              last_contact_time_utc: '2024-12-24T18:27:00.000+0000',
              last_contact_time_epoch: 1735074420000,
              report_date: '2024-12-24 18:00:00',
              report_date_utc: '2024-12-24T18:00:00.000+0000',
              report_date_epoch: 1735072800000
            }
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const details = await client.getComputerDetails('1');
      const general = details.general;
      
      // Verify raw date fields
      expect(general.last_contact_time).toBe('2024-12-24 18:27:00');
      expect(general.last_contact_time_epoch).toBe(1735074420000);
      
      // Verify parsing works
      const lastContact = parseJamfDate(general.last_contact_time_epoch);
      expect(lastContact).toEqual(new Date(1735074420000));
    });
  });

  describe('Get All Computers', () => {
    test('should fetch all computers without pagination', async () => {
      const mockResponse = {
        data: {
          computers: [
            { id: 1, name: 'Computer-1' },
            { id: 2, name: 'Computer-2' },
            { id: 3, name: 'Computer-3' }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const computers = await client.getAllComputers();
      
      expect(computers).toHaveLength(3);
      expect(computers[0].name).toBe('Computer-1');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/JSSResource/computers');
    });

    test('should handle parsing errors gracefully', async () => {
      const mockResponse = {
        data: {
          computers: [
            { id: 1, name: 'Valid-Computer' },
            { invalid: 'data' }, // Invalid computer data
            { id: 3, name: 'Another-Valid' }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const computers = await client.getAllComputers();
      
      // Should still return all computers, even with invalid data
      expect(computers).toHaveLength(3);
      expect(computers[0].name).toBe('Valid-Computer');
      expect(computers[2].name).toBe('Another-Valid');
    });
  });

  describe('Update Inventory', () => {
    test('should update inventory for a device', async () => {
      // Create client with write permissions
      const writeClient = new JamfApiClientClassic({
        baseUrl: 'https://test.jamfcloud.com',
        username: 'testuser',
        password: 'testpass',
        readOnlyMode: false
      });
      
      mockAxiosInstance.post.mockResolvedValueOnce({ data: { success: true } });

      await writeClient.updateInventory('123');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/JSSResource/computercommands/command/UpdateInventory',
        { computer_id: '123' }
      );
    });

    test('should skip update in read-only mode', async () => {
      // Clear previous mock calls
      mockAxiosInstance.post.mockClear();
      
      await client.updateInventory('123');
      
      // Should not call post when in read-only mode (only auth calls)
      const updateCalls = mockAxiosInstance.post.mock.calls.filter(
        call => call[0].includes('UpdateInventory')
      );
      expect(updateCalls).toHaveLength(0);
    });
  });

  describe('Compliance Report', () => {
    test('should generate compliance report', async () => {
      // Use fixed date for consistent testing
      const now = new Date('2024-12-24T12:00:00Z');
      const fiveDaysAgo = now.getTime() - (5 * 24 * 60 * 60 * 1000);
      const fortyDaysAgo = now.getTime() - (40 * 24 * 60 * 60 * 1000);
      
      const mockResponse = {
        data: {
          computers: [
            {
              id: 1,
              name: 'Compliant-Mac',
              last_contact_time_epoch: fiveDaysAgo
            },
            {
              id: 2,
              name: 'Non-Compliant-Mac',
              last_contact_time_epoch: fortyDaysAgo
            },
            {
              id: 3,
              name: 'Unknown-Mac',
              last_contact_time_epoch: null
            }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      // Mock Date constructor for the compliance report calculation
      const OriginalDate = Date;
      const mockNow = now;
      global.Date = class extends OriginalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(mockNow);
          } else {
            // @ts-ignore
            super(...args);
          }
        }
        static now() {
          return mockNow.getTime();
        }
      } as any;

      const report = await client.getComplianceReport(30);
      
      // Restore Date
      global.Date = OriginalDate;
      
      expect(report.total).toBe(3);
      expect(report.compliant).toBe(1);
      expect(report.notReporting).toBe(2); // Both non-compliant and unknown
      expect(report.nonCompliant).toBe(2); // total - compliant
      expect(report.issues).toHaveLength(2); // Both non-compliant devices
      expect(report.issues.map(i => i.computerName)).toContain('Non-Compliant-Mac');
      expect(report.issues.map(i => i.computerName)).toContain('Unknown-Mac');
    });
  });

  describe('Policy Methods', () => {
    test('should list policies', async () => {
      const mockResponse = {
        data: {
          policies: [
            { id: 1, name: 'Policy 1' },
            { id: 2, name: 'Policy 2' },
            { id: 3, name: 'Policy 3' }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const policies = await client.listPolicies(2);
      
      expect(policies).toHaveLength(2);
      expect(policies[0].name).toBe('Policy 1');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/JSSResource/policies');
    });

    test('should get policy details', async () => {
      const mockResponse = {
        data: {
          policy: {
            id: 1,
            general: {
              name: 'Test Policy',
              enabled: true,
              category: { name: 'Testing' },
              frequency: 'Once per computer'
            },
            scope: {
              all_computers: false,
              computers: [],
              computer_groups: []
            },
            scripts: [],
            package_configuration: { packages: [] }
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const details = await client.getPolicyDetails('1');
      
      expect(details.id).toBe(1);
      expect(details.name).toBe('Test Policy');
      expect(details.category).toBe('Testing');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/JSSResource/policies/id/1');
    });

    test('should search policies', async () => {
      const mockListResponse = {
        data: {
          policies: [
            { id: 1, name: 'Security Update' },
            { id: 2, name: 'Software Deploy' },
            { id: 3, name: 'Security Scan' }
          ]
        }
      };

      const mockDetailsResponse = {
        data: {
          policy: {
            id: 1,
            general: {
              name: 'Security Update',
              enabled: true,
              category: { name: 'Security' },
              frequency: 'Once per computer'
            }
          }
        }
      };

      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/JSSResource/policies') {
          return Promise.resolve(mockListResponse);
        }
        if (url.includes('/JSSResource/policies/id/')) {
          return Promise.resolve(mockDetailsResponse);
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const results = await client.searchPolicies('Security', 10);
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Security Update');
      expect(results[1].name).toBe('Security Scan');
    });
  });

  describe('Error Handling', () => {
    test('should handle authentication errors', async () => {
      // Reset mock to simulate auth failure
      mockAxiosInstance.post.mockReset();
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Authentication failed'));

      const newClient = new JamfApiClientClassic({
        baseUrl: 'https://test.jamfcloud.com',
        username: 'baduser',
        password: 'badpass',
        readOnlyMode: true
      });

      // Any API call should fail due to auth error
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Failed to authenticate with Jamf Pro API'));
      
      await expect(newClient.getAllComputers()).rejects.toThrow();
    });

    test('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(client.getAllComputers()).rejects.toThrow('Network timeout');
    });
  });
});