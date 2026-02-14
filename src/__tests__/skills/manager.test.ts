import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { SkillsManager } from '../../skills/manager.js';
import { SkillContext, SkillResult } from '../../skills/types.js';

describe('SkillsManager', () => {
  let manager: SkillsManager;
  let mockContext: SkillContext;

  beforeEach(() => {
    manager = new SkillsManager();

    // Create mock context
    mockContext = {
      callTool: jest.fn(),
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    };
  });

  describe('initialization', () => {
    test('should register all skills on construction', () => {
      const skills = manager.getAllSkills();
      expect(skills.length).toBeGreaterThan(0);

      // Check for specific skills by map key (getSkill uses map key, not metadata.name)
      expect(manager.getSkill('device-search')).toBeDefined();
      expect(manager.getSkill('find-outdated-devices')).toBeDefined();
      expect(manager.getSkill('batch-inventory-update')).toBeDefined();
      expect(manager.getSkill('deploy-policy-by-criteria')).toBeDefined();
      expect(manager.getSkill('scheduled-compliance-check')).toBeDefined();
    });

    test('should throw error when not initialized', async () => {
      const uninitializedManager = new SkillsManager();

      await expect(uninitializedManager.executeSkill('test', {}))
        .rejects
        .toThrow('SkillsManager not initialized');
    });
  });

  describe('skill execution', () => {
    beforeEach(() => {
      // Initialize with mock server
      const mockServer = {
        handleToolCall: async (toolName: string, params: any) => {
          const result = await mockContext.callTool(toolName, params);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result)
            }]
          };
        },
        logger: mockContext.logger
      };
      manager.initialize(mockServer as any);
    });

    test('should execute device search skill', async () => {
      const mockDevices = [
        { id: '1', name: 'Test Device', serialNumber: 'ABC123' }
      ];

      mockContext.callTool = jest.fn().mockResolvedValue({
        data: { devices: mockDevices }
      });

      const result = await manager.executeSkill('device-search', {
        query: 'Test',
        searchType: 'device'
      });

      expect(result.success).toBe(true);
      expect(result.data.devices).toEqual(mockDevices);
      expect(mockContext.callTool).toHaveBeenCalledWith('searchDevices', expect.any(Object));
    });

    test('should handle skill not found', async () => {
      const result = await manager.executeSkill('non-existent-skill', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
      expect(result.data.availableSkills).toContain('device-search');
    });

    test('should handle skill execution errors', async () => {
      mockContext.callTool = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await manager.executeSkill('find-outdated-devices', {
        daysSinceLastContact: 7
      });

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('MCP tools conversion', () => {
    test('should convert skills to MCP tools format', () => {
      const tools = manager.getMCPTools();

      expect(tools.length).toBeGreaterThan(0);

      // 'device-search' becomes 'skill_device_search' (hyphens replaced with underscores)
      const deviceSearchTool = tools.find(t => t.name === 'skill_device_search');
      expect(deviceSearchTool).toBeDefined();
      expect(deviceSearchTool?.description).toBeDefined();
      expect(deviceSearchTool?.inputSchema).toBeDefined();
      expect(deviceSearchTool?.inputSchema.type).toBe('object');
    });
  });

  describe('OpenAPI schema generation', () => {
    test('should generate valid OpenAPI schema', () => {
      const schema = manager.generateOpenAPISpec();

      expect(schema.openapi).toBe('3.0.0');
      expect(schema.info.title).toBe('Jamf MCP Skills API');
      expect(schema.servers).toBeDefined();
      expect(schema.paths['/api/v1/skills/execute']).toBeDefined();

      const executeEndpoint = schema.paths['/api/v1/skills/execute'];
      expect(executeEndpoint.post).toBeDefined();
      expect(executeEndpoint.post.requestBody).toBeDefined();
      expect(executeEndpoint.post.responses['200']).toBeDefined();
    });

    test('should include all skills in components schema', () => {
      const schema = manager.generateOpenAPISpec();
      const components = schema.components.schemas;

      // Skills use 'Parameters' suffix in the schema
      expect(components['device-searchParameters']).toBeDefined();
      expect(components['find-outdated-devicesParameters']).toBeDefined();
      expect(components['batch-inventory-updateParameters']).toBeDefined();
      expect(components['deploy-policy-by-criteriaParameters']).toBeDefined();
      expect(components['scheduled-compliance-checkParameters']).toBeDefined();
    });
  });

  describe('specific skills', () => {
    beforeEach(() => {
      const mockServer = {
        handleToolCall: async (toolName: string, params: any) => {
          const result = await mockContext.callTool(toolName, params);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result)
            }]
          };
        },
        logger: mockContext.logger
      };
      manager.initialize(mockServer as any);
    });

    test('should find outdated devices', async () => {
      mockContext.callTool = jest.fn().mockResolvedValue({
        success: true,
        data: {
          totalDevices: 100,
          compliant: 90,
          nonCompliant: 10,
          devices: []
        }
      });

      const result = await manager.executeSkill('find-outdated-devices', {
        daysSinceLastContact: 7,
        includeDetails: false
      });

      expect(result.success).toBe(true);
      expect(result.data.totalDevices).toBe(100);
      expect(result.data.outdatedDevices).toBe(10);
      expect(mockContext.callTool).toHaveBeenCalledWith(
        'checkDeviceCompliance',
        expect.objectContaining({
          days: 7,
          includeDetails: false
        })
      );
    });

    test('should execute scheduled compliance check', async () => {
      // Mock searchDevices for outdated check
      mockContext.callTool = jest.fn()
        .mockImplementation((toolName: string) => {
          if (toolName === 'searchDevices') {
            return Promise.resolve({
              data: {
                devices: [
                  { id: '1', name: 'Device1', osVersion: '13.0' },
                  { id: '2', name: 'Device2', osVersion: '14.0' }
                ]
              }
            });
          }
          return Promise.resolve({ success: true, data: {} });
        });

      const result = await manager.executeSkill('scheduled-compliance-check', {
        checks: {
          outdatedDevices: {
            enabled: true,
            daysThreshold: 7
          },
          osVersionCompliance: {
            enabled: true,
            minimumVersion: '14.0.0'
          }
        },
        outputFormat: 'summary'
      });

      expect(result.success).toBe(true);
      expect(result.data.summary).toBeDefined();
      expect(result.data.checks).toBeDefined();
    });
  });
});
