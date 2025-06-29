import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { registerPrompts } from '../../prompts/index.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

describe('Workflow Integration Tests', () => {
  let server: Server;
  let listPromptsHandler: any;
  let getPromptHandler: any;

  beforeEach(() => {
    server = new Server(
      {
        name: 'jamf-mcp-test',
        version: '1.0.0',
      },
      {
        capabilities: {
          prompts: {},
        },
      }
    );
    
    // Capture the handlers when they're registered
    const originalSetRequestHandler = server.setRequestHandler.bind(server);
    server.setRequestHandler = (schema: any, handler: any) => {
      if (schema === ListPromptsRequestSchema) {
        listPromptsHandler = handler;
      } else if (schema === GetPromptRequestSchema) {
        getPromptHandler = handler;
      }
      return originalSetRequestHandler(schema, handler);
    };
    
    registerPrompts(server);
  });

  describe('List Prompts', () => {
    it('should return all available prompts', async () => {
      const result = await listPromptsHandler({} as any);
      
      expect(result.prompts).toHaveLength(5);
      
      const promptNames = result.prompts.map((p: any) => p.name);
      expect(promptNames).toContain('troubleshoot-device');
      expect(promptNames).toContain('compliance-check');
      expect(promptNames).toContain('mass-update');
    });
  });

  describe('Troubleshoot Device Workflow', () => {
    it('should provide troubleshooting steps for a specific device', async () => {
      const result = await getPromptHandler({
        params: {
          name: 'troubleshoot-device',
          arguments: {
            deviceName: "John's MacBook",
          },
        },
      } as any);

      expect(result.prompt.name).toBe('troubleshoot-device');
      expect(result.prompt.messages).toHaveLength(2);
      
      // Check user message
      const userMessage = result.prompt.messages[0];
      expect(userMessage.role).toBe('user');
      expect(userMessage.content.type).toBe('text');
      expect(userMessage.content.text).toContain("John's MacBook");
      
      // Check assistant response
      const assistantMessage = result.prompt.messages[1];
      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.content.type).toBe('text');
      
      const assistantText = assistantMessage.content.text;
      expect(assistantText).toContain('help you troubleshoot the device');
      expect(assistantText).toContain("John's MacBook");
      expect(assistantText).toContain('searchDevices tool');
      expect(assistantText).toContain('Check the last contact time');
      expect(assistantText).toContain('Review the hardware specifications');
      expect(assistantText).toContain('Analyze storage usage');
      expect(assistantText).toContain('Check for any compliance issues');
      expect(assistantText).toContain('Provide recommendations');
    });

    it('should handle different device names correctly', async () => {
      const testCases = [
        'MacBook-Pro-123',
        'iPad_Finance_001',
        'iPhone 15 - Marketing',
      ];

      for (const deviceName of testCases) {
        const result = await getPromptHandler({
          params: {
            name: 'troubleshoot-device',
            arguments: { deviceName },
          },
        } as any);

        const userText = result.prompt.messages[0].content.text;
        const assistantText = result.prompt.messages[1].content.text;
        
        expect(userText).toContain(deviceName);
        expect(assistantText).toContain(deviceName);
      }
    });
  });

  describe('Compliance Check Workflow', () => {
    it('should provide a comprehensive compliance check workflow', async () => {
      const result = await getPromptHandler({
        params: {
          name: 'compliance-check',
          arguments: {
            criteria: 'all devices',
          },
        },
      } as any);

      expect(result.prompt.name).toBe('compliance-check');
      expect(result.prompt.messages).toHaveLength(2);
      
      const assistantText = result.prompt.messages[1].content.text;
      expect(assistantText).toContain('comprehensive compliance check');
      expect(assistantText).toContain('all devices');
      expect(assistantText).toContain('Devices not reporting in the last 30 days');
      expect(assistantText).toContain('Devices with critical storage issues');
      expect(assistantText).toContain('Devices missing required OS updates');
      expect(assistantText).toContain('Devices without proper MDM approval');
      expect(assistantText).toContain('jamf://reports/compliance');
      expect(assistantText).toContain('jamf://reports/storage');
      expect(assistantText).toContain('jamf://reports/os-versions');
    });

    it('should customize compliance check based on criteria', async () => {
      const testCriteria = [
        'manufacturing department',
        'devices with macOS 14+',
        'iPads in education',
      ];

      for (const criteria of testCriteria) {
        const result = await getPromptHandler({
          params: {
            name: 'compliance-check',
            arguments: { criteria },
          },
        } as any);

        const userText = result.prompt.messages[0].content.text;
        const assistantText = result.prompt.messages[1].content.text;
        
        expect(userText).toContain(criteria);
        expect(assistantText).toContain(criteria);
      }
    });
  });

  describe('Mass Update Workflow', () => {
    it('should provide a mass update workflow with safety measures', async () => {
      const result = await getPromptHandler({
        params: {
          name: 'mass-update',
          arguments: {
            action: 'update all devices',
            criteria: 'in manufacturing',
          },
        },
      } as any);

      expect(result.prompt.name).toBe('mass-update');
      expect(result.prompt.messages).toHaveLength(2);
      
      const userText = result.prompt.messages[0].content.text;
      expect(userText).toContain('update all devices');
      expect(userText).toContain('in manufacturing');
      
      const assistantText = result.prompt.messages[1].content.text;
      expect(assistantText).toContain('update all devices');
      expect(assistantText).toContain('in manufacturing');
      expect(assistantText).toContain('Search for all devices matching the criteria');
      expect(assistantText).toContain('Review the list of affected devices');
      expect(assistantText).toContain('Request your confirmation');
      expect(assistantText).toContain('Execute in batches');
      expect(assistantText).toContain('Safety measures');
      expect(assistantText).toContain('exact device count');
      expect(assistantText).toContain('Confirmation will be required');
    });

    it('should handle different mass update scenarios', async () => {
      const scenarios = [
        { action: 'deploy security patch', criteria: 'are running macOS 13' },
        { action: 'enable FileVault', criteria: 'have encryption disabled' },
        { action: 'restart', criteria: 'haven\'t checked in for 7 days' },
      ];

      for (const scenario of scenarios) {
        const result = await getPromptHandler({
          params: {
            name: 'mass-update',
            arguments: scenario,
          },
        } as any);

        const userText = result.prompt.messages[0].content.text;
        const assistantText = result.prompt.messages[1].content.text;
        
        expect(userText).toContain(scenario.action);
        expect(userText).toContain(scenario.criteria);
        expect(assistantText).toContain(scenario.action);
        expect(assistantText).toContain(scenario.criteria);
        expect(assistantText).toContain('Safety measures');
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent prompt', async () => {
      await expect(getPromptHandler({
        params: {
          name: 'non-existent-prompt',
          arguments: {},
        },
      } as any)).rejects.toThrow('Prompt not found: non-existent-prompt');
    });
  });

  describe('Template Variable Replacement', () => {
    it('should handle missing template variables gracefully', async () => {
      const result = await getPromptHandler({
        params: {
          name: 'troubleshoot-device',
          arguments: {}, // Missing deviceName
        },
      } as any);

      const userText = result.prompt.messages[0].content.text;
      const assistantText = result.prompt.messages[1].content.text;
      
      // Should keep the template variable unchanged
      expect(userText).toContain('{{deviceName}}');
      expect(assistantText).toContain('{{deviceName}}');
    });

    it('should replace multiple occurrences of the same variable', async () => {
      const result = await getPromptHandler({
        params: {
          name: 'deploy-software',
          arguments: {
            softwareName: 'Microsoft Office',
            targetDevices: 'all marketing devices',
          },
        },
      } as any);

      const assistantText = result.prompt.messages[1].content.text;
      
      // Count occurrences of replaced values
      const officeMatches = (assistantText.match(/Microsoft Office/g) || []).length;
      const devicesMatches = (assistantText.match(/all marketing devices/g) || []).length;
      
      // softwareName appears 3 times, targetDevices appears 1 time in the template
      expect(officeMatches).toBe(3);
      expect(devicesMatches).toBe(1);
      expect(assistantText).not.toContain('{{softwareName}}');
      expect(assistantText).not.toContain('{{targetDevices}}');
    });
  });
});