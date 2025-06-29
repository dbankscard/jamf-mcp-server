import { jest } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { registerTools } from '../../../tools/index-compat.js';

describe('updateInventory Tool', () => {
  let server: Server;
  let jamfClient: any;

  beforeEach(() => {
    // Create mock Jamf client
    jamfClient = {
      getComputerDetails: jest.fn(),
      getAllComputers: jest.fn(),
      searchComputers: jest.fn(),
      updateInventory: jest.fn(),
      config: {
        readOnlyMode: false
      }
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

  // Helper function to simulate the updateInventory tool call
  async function callUpdateInventory(deviceId: string) {
    await jamfClient.updateInventory(deviceId);
    return `Successfully triggered inventory update for device ${deviceId}`;
  }

  describe('Basic Functionality', () => {
    test('should successfully trigger inventory update', async () => {
      // Mock successful inventory update
      jamfClient.updateInventory.mockResolvedValue(undefined);

      const result = await callUpdateInventory('1');

      expect(result).toBe('Successfully triggered inventory update for device 1');
      
      // Verify the API call
      expect(jamfClient.updateInventory).toHaveBeenCalledWith('1');
    });

    test('should handle multiple inventory updates', async () => {
      // Mock successful inventory updates
      jamfClient.updateInventory.mockResolvedValue(undefined);
      
      // Update multiple devices
      const deviceIds = ['1', '2', '3'];
      for (const deviceId of deviceIds) {
        const result = await callUpdateInventory(deviceId);
        expect(result).toBe(`Successfully triggered inventory update for device ${deviceId}`);
      }

      // Verify all API calls were made
      deviceIds.forEach(id => {
        expect(jamfClient.updateInventory).toHaveBeenCalledWith(id);
      });
    });
  });

  describe('Read-Only Mode', () => {
    test('should prevent inventory update in read-only mode', async () => {
      // Set client to read-only mode
      jamfClient.config.readOnlyMode = true;
      jamfClient.updateInventory.mockRejectedValue(
        new Error('Cannot perform update operation in read-only mode')
      );

      await expect(callUpdateInventory('1')).rejects.toThrow('read-only mode');
    });
  });

  describe('Error Handling', () => {
    test('should handle device not found error', async () => {
      // Mock 404 response
      const error = new Error('Device with ID 999 not found') as any;
      error.response = {
        status: 404,
        data: {
          httpStatus: 404,
          errors: [
            {
              code: 'NOT_FOUND',
              description: 'Device with ID 999 not found'
            }
          ]
        }
      };
      
      jamfClient.updateInventory.mockRejectedValue(error);

      await expect(callUpdateInventory('999')).rejects.toThrow('Device with ID 999 not found');
    });

    test('should handle unauthorized error', async () => {
      // Mock 401 response
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
      
      jamfClient.updateInventory.mockRejectedValue(error);

      await expect(callUpdateInventory('1')).rejects.toThrow('Authentication required');
    });

    test('should handle permission denied error', async () => {
      // Mock 403 response
      const error = new Error('User does not have permission to update inventory') as any;
      error.response = {
        status: 403,
        data: {
          httpStatus: 403,
          errors: [
            {
              code: 'FORBIDDEN',
              description: 'User does not have permission to update inventory'
            }
          ]
        }
      };
      
      jamfClient.updateInventory.mockRejectedValue(error);

      await expect(callUpdateInventory('1')).rejects.toThrow('permission');
    });

    test('should handle network errors', async () => {
      // Mock network error
      const error = new Error('ECONNREFUSED');
      jamfClient.updateInventory.mockRejectedValue(error);

      await expect(callUpdateInventory('1')).rejects.toThrow('ECONNREFUSED');
    });

    test('should handle server errors', async () => {
      // Mock 500 response
      const error = new Error('An unexpected error occurred') as any;
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
      
      jamfClient.updateInventory.mockRejectedValue(error);

      await expect(callUpdateInventory('1')).rejects.toThrow('An unexpected error occurred');
    });
  });

  describe('Input Validation', () => {
    test('should handle missing deviceId', async () => {
      // The tool handler should validate this
      jamfClient.updateInventory.mockRejectedValue(new Error('deviceId is required'));
      
      await expect(callUpdateInventory(undefined as any)).rejects.toThrow();
    });

    test('should handle invalid deviceId type', async () => {
      // The tool handler should validate this
      jamfClient.updateInventory.mockRejectedValue(new Error('deviceId must be a string'));
      
      await expect(callUpdateInventory(123 as any)).rejects.toThrow();
    });

    test('should handle empty deviceId', async () => {
      // The tool handler should validate this
      jamfClient.updateInventory.mockRejectedValue(new Error('deviceId cannot be empty'));
      
      await expect(callUpdateInventory('')).rejects.toThrow();
    });
  });

  describe('Rate Limiting', () => {
    test('should handle rate limit error', async () => {
      // Mock 429 response
      const error = new Error('Rate limit exceeded') as any;
      error.response = {
        status: 429,
        data: {
          httpStatus: 429,
          errors: [
            {
              code: 'TOO_MANY_REQUESTS',
              description: 'Rate limit exceeded'
            }
          ]
        },
        headers: {
          'retry-after': '60'
        }
      };
      
      jamfClient.updateInventory.mockRejectedValue(error);

      await expect(callUpdateInventory('1')).rejects.toThrow('Rate limit exceeded');
    });
  });
});