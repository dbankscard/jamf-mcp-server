/**
 * DocumentationGenerator Tests
 * Tests for the core documentation generation service
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { DocumentationGenerator } from '../../documentation/generator.js';
import type { JamfApiClientHybrid } from '../../jamf-client-hybrid.js';
import type {
  DocumentationOptions,
  ComponentType,
} from '../../documentation/types.js';

/**
 * Create a mock JamfApiClientHybrid
 */
function createMockJamfClient(overrides: Partial<Record<string, jest.Mock>> = {}): JamfApiClientHybrid {
  const mockClient = {
    config: { baseUrl: 'https://test.jamfcloud.com' },
    searchComputers: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      { id: '1', name: 'Computer 1', serialNumber: 'ABC123' },
      { id: '2', name: 'Computer 2', serialNumber: 'DEF456' },
    ]),
    getComputerDetails: jest.fn<() => Promise<any>>().mockResolvedValue({
      general: { id: '1', name: 'Computer 1', serialNumber: 'ABC123' },
    }),
    listMobileDevices: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      { id: '1', name: 'iPad 1', serialNumber: 'MOB123' },
    ]),
    getMobileDeviceDetails: jest.fn<() => Promise<any>>().mockResolvedValue({
      general: { id: '1', name: 'iPad 1', serialNumber: 'MOB123' },
    }),
    listPolicies: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      { id: '1', name: 'Policy 1' },
      { id: '2', name: 'Policy 2' },
    ]),
    getPolicyDetails: jest.fn<() => Promise<any>>().mockResolvedValue({
      general: { id: '1', name: 'Policy 1', enabled: true },
    }),
    listConfigurationProfiles: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      { id: '1', name: 'Profile 1' },
    ]),
    getConfigurationProfileDetails: jest.fn<() => Promise<any>>().mockResolvedValue({
      general: { id: '1', name: 'Profile 1' },
    }),
    listScripts: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      { id: '1', name: 'Script 1' },
    ]),
    getScriptDetails: jest.fn<() => Promise<any>>().mockResolvedValue({
      id: '1', name: 'Script 1', script_contents: '#!/bin/bash\necho "Hello"',
    }),
    listPackages: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      { id: '1', name: 'Package 1', filename: 'pkg1.pkg' },
    ]),
    getPackageDetails: jest.fn<() => Promise<any>>().mockResolvedValue({
      id: '1', name: 'Package 1', filename: 'pkg1.pkg',
    }),
    listComputerGroups: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      { id: '1', name: 'Group 1', is_smart: true },
    ]),
    getComputerGroupDetails: jest.fn<() => Promise<any>>().mockResolvedValue({
      id: '1', name: 'Group 1', is_smart: true,
    }),
    getMobileDeviceGroups: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      { id: '1', name: 'Mobile Group 1', is_smart: false },
    ]),
    getMobileDeviceGroupDetails: jest.fn<() => Promise<any>>().mockResolvedValue({
      id: '1', name: 'Mobile Group 1', is_smart: false,
    }),
    ...overrides,
  } as unknown as JamfApiClientHybrid;

  return mockClient;
}

describe('DocumentationGenerator', () => {
  let mockClient: JamfApiClientHybrid;
  let generator: DocumentationGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockJamfClient();
    generator = new DocumentationGenerator(mockClient);
  });

  describe('constructor', () => {
    test('should initialize with default progress state', () => {
      const progress = generator.getProgress();
      expect(progress.status).toBe('pending');
      expect(progress.completedComponents).toEqual([]);
      expect(progress.totalComponents).toBe(0);
      expect(progress.errors).toEqual([]);
    });

    test('should store the jamfClient reference', () => {
      expect(generator).toBeInstanceOf(DocumentationGenerator);
    });
  });

  describe('getProgress', () => {
    test('should return a copy of progress state', () => {
      const progress1 = generator.getProgress();
      const progress2 = generator.getProgress();

      expect(progress1).toEqual(progress2);
      expect(progress1).not.toBe(progress2); // Should be a copy, not same reference
    });

    test('should reflect pending status initially', () => {
      const progress = generator.getProgress();
      expect(progress.status).toBe('pending');
    });
  });

  describe('generateDocumentation', () => {
    test('should generate documentation for specific components', async () => {
      const options: DocumentationOptions = {
        formats: [], // Skip file writing to avoid fs operations
        components: ['computers', 'policies'],
      };

      const result = await generator.generateDocumentation(options);

      expect(result).toBeDefined();
      expect(result.overview).toBeDefined();
      expect(result.overview.jamfUrl).toBe('https://test.jamfcloud.com');
      expect(result.overview.generatedBy).toBe('jamf-mcp-server');
      expect(result.components.computers).toBeDefined();
      expect(result.components.policies).toBeDefined();
      expect(result.components.scripts).toBeUndefined();
    });

    test('should update overview statistics correctly', async () => {
      const options: DocumentationOptions = {
        formats: [],
        components: ['computers', 'policies'],
      };

      const result = await generator.generateDocumentation(options);

      expect(result.overview.totalComputers).toBe(2);
      expect(result.overview.totalPolicies).toBe(2);
    });

    test('should set progress to completed after generation', async () => {
      await generator.generateDocumentation({
        components: ['computers'],
        formats: [],
      });

      const progress = generator.getProgress();
      expect(progress.status).toBe('completed');
      expect(progress.completedComponents).toContain('computers');
    });

    test('should track completed components in progress', async () => {
      await generator.generateDocumentation({
        components: ['computers', 'policies', 'scripts'],
        formats: [],
      });

      const progress = generator.getProgress();
      expect(progress.completedComponents).toContain('computers');
      expect(progress.completedComponents).toContain('policies');
      expect(progress.completedComponents).toContain('scripts');
      expect(progress.totalComponents).toBe(3);
    });
  });

  describe('error handling', () => {
    test('should handle API errors gracefully and continue', async () => {
      const failingClient = createMockJamfClient({
        searchComputers: jest.fn<() => Promise<any[]>>().mockRejectedValue(new Error('API connection failed')),
      });

      const gen = new DocumentationGenerator(failingClient);
      const result = await gen.generateDocumentation({
        components: ['computers'],
        formats: [],
      });

      // Should complete with empty results for failed component
      const progress = gen.getProgress();
      expect(progress.status).toBe('completed');
      // Component errors are caught internally and result in empty items
      expect(result.components.computers?.totalCount).toBe(0);
    });

    test('should continue documenting other components when one fails', async () => {
      const partialFailClient = createMockJamfClient({
        searchComputers: jest.fn<() => Promise<any[]>>().mockRejectedValue(new Error('Computers API failed')),
        listPolicies: jest.fn<() => Promise<any[]>>().mockResolvedValue([{ id: '1', name: 'Policy 1' }]),
      });

      const gen = new DocumentationGenerator(partialFailClient);
      const result = await gen.generateDocumentation({
        components: ['computers', 'policies'],
        formats: [],
      });

      // Computers should fail, policies should succeed
      expect(result.components.computers?.totalCount).toBe(0);
      expect(result.components.policies?.totalCount).toBe(1);
    });

    test('should handle detail fetch errors for individual items', async () => {
      const failingDetailsClient = createMockJamfClient({
        searchComputers: jest.fn<() => Promise<any[]>>().mockResolvedValue([
          { id: '1', name: 'Computer 1' },
          { id: '2', name: 'Computer 2' },
        ]),
        getComputerDetails: jest.fn<() => Promise<any>>()
          .mockResolvedValueOnce({ general: { id: '1', name: 'Computer 1' } })
          .mockRejectedValueOnce(new Error('Details fetch failed')),
      });

      const gen = new DocumentationGenerator(failingDetailsClient);
      const result = await gen.generateDocumentation({
        components: ['computers'],
        detailLevel: 'full',
        formats: [],
      });

      // Should still have 2 items (one detailed, one summary)
      expect(result.components.computers?.totalCount).toBe(2);
    });

    test('should return empty component data when API fails', async () => {
      const failingClient = createMockJamfClient({
        searchComputers: jest.fn<() => Promise<any[]>>().mockRejectedValue(new Error('Network error')),
      });

      const gen = new DocumentationGenerator(failingClient);
      const result = await gen.generateDocumentation({
        components: ['computers'],
        formats: [],
      });

      // Failed components return empty items but still complete
      expect(result.components.computers?.totalCount).toBe(0);
      expect(result.components.computers?.items).toEqual([]);
    });
  });

  describe('component documentation', () => {
    test('should document computers with summary detail level', async () => {
      const result = await generator.generateDocumentation({
        components: ['computers'],
        detailLevel: 'summary',
        formats: [],
      });

      expect(result.components.computers).toBeDefined();
      expect(result.components.computers?.totalCount).toBe(2);
      // Summary level should not call getComputerDetails
      expect(mockClient.getComputerDetails).not.toHaveBeenCalled();
    });

    test('should document computers with full detail level', async () => {
      const result = await generator.generateDocumentation({
        components: ['computers'],
        detailLevel: 'full',
        formats: [],
      });

      expect(result.components.computers).toBeDefined();
      // Full level should call getComputerDetails for each computer
      expect(mockClient.getComputerDetails).toHaveBeenCalledTimes(2);
    });

    test('should document mobile devices', async () => {
      const result = await generator.generateDocumentation({
        components: ['mobile-devices'],
        formats: [],
      });

      expect(result.components['mobile-devices']).toBeDefined();
      expect(result.components['mobile-devices']?.totalCount).toBe(1);
    });

    test('should document policies', async () => {
      const result = await generator.generateDocumentation({
        components: ['policies'],
        formats: [],
      });

      expect(result.components.policies).toBeDefined();
      expect(result.components.policies?.totalCount).toBe(2);
    });

    test('should document configuration profiles for both device types', async () => {
      const result = await generator.generateDocumentation({
        components: ['configuration-profiles'],
        formats: [],
      });

      expect(result.components['configuration-profiles']).toBeDefined();
      // Should call list for both computer and mobile profiles
      expect(mockClient.listConfigurationProfiles).toHaveBeenCalledWith('computer');
      expect(mockClient.listConfigurationProfiles).toHaveBeenCalledWith('mobiledevice');
    });

    test('should document scripts with content when enabled', async () => {
      const result = await generator.generateDocumentation({
        components: ['scripts'],
        detailLevel: 'full',
        includeScriptContent: true,
        formats: [],
      });

      expect(result.components.scripts).toBeDefined();
      expect(mockClient.getScriptDetails).toHaveBeenCalled();
    });

    test('should document packages', async () => {
      const result = await generator.generateDocumentation({
        components: ['packages'],
        formats: [],
      });

      expect(result.components.packages).toBeDefined();
      expect(result.components.packages?.totalCount).toBe(1);
    });

    test('should document computer groups', async () => {
      const result = await generator.generateDocumentation({
        components: ['computer-groups'],
        formats: [],
      });

      expect(result.components['computer-groups']).toBeDefined();
      expect(result.components['computer-groups']?.totalCount).toBe(1);
    });

    test('should document mobile device groups', async () => {
      const result = await generator.generateDocumentation({
        components: ['mobile-device-groups'],
        formats: [],
      });

      expect(result.components['mobile-device-groups']).toBeDefined();
      expect(result.components['mobile-device-groups']?.totalCount).toBe(1);
    });
  });

  describe('metadata', () => {
    test('should include metadata in component documentation', async () => {
      const result = await generator.generateDocumentation({
        components: ['computers'],
        detailLevel: 'standard',
        formats: [],
      });

      const computerDoc = result.components.computers;
      expect(computerDoc?.metadata).toBeDefined();
      expect(computerDoc?.metadata.jamfUrl).toBe('https://test.jamfcloud.com');
      expect(computerDoc?.metadata.detailLevel).toBe('standard');
      expect(computerDoc?.metadata.generatedAt).toBeInstanceOf(Date);
    });

    test('should include generation timestamp in overview', async () => {
      const beforeGeneration = new Date();
      const result = await generator.generateDocumentation({
        components: ['computers'],
        formats: [],
      });
      const afterGeneration = new Date();

      expect(result.overview.generatedAt).toBeInstanceOf(Date);
      expect(result.overview.generatedAt.getTime()).toBeGreaterThanOrEqual(beforeGeneration.getTime());
      expect(result.overview.generatedAt.getTime()).toBeLessThanOrEqual(afterGeneration.getTime());
    });
  });

  describe('overview updates', () => {
    test('should update all component counts in overview', async () => {
      const result = await generator.generateDocumentation({
        components: [
          'computers',
          'mobile-devices',
          'policies',
          'configuration-profiles',
          'scripts',
          'packages',
          'computer-groups',
          'mobile-device-groups',
        ],
        formats: [],
      });

      expect(result.overview.totalComputers).toBe(2);
      expect(result.overview.totalMobileDevices).toBe(1);
      expect(result.overview.totalPolicies).toBe(2);
      expect(result.overview.totalConfigurationProfiles).toBe(2); // computer + mobile
      expect(result.overview.totalScripts).toBe(1);
      expect(result.overview.totalPackages).toBe(1);
      expect(result.overview.totalComputerGroups).toBe(1);
      expect(result.overview.totalMobileDeviceGroups).toBe(1);
    });
  });
});
