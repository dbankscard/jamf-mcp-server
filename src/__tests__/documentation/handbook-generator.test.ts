/**
 * HandbookGenerator Tests
 * Tests for the handbook generation service that creates human-readable markdown documentation
 */

import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import type {
  EnvironmentDocumentation,
  ComponentDocumentation,
} from '../../documentation/types.js';

// Store mock implementations
const mockMkdir = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockWriteFile = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

// Must mock before importing HandbookGenerator
jest.unstable_mockModule('fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

// Import after mocking
const { HandbookGenerator } = await import('../../documentation/handbook-generator.js');

/**
 * Create a mock EnvironmentDocumentation
 */
function createMockEnvironmentDoc(overrides: Partial<EnvironmentDocumentation> = {}): EnvironmentDocumentation {
  return {
    overview: {
      jamfUrl: 'https://test.jamfcloud.com',
      generatedAt: new Date('2026-01-07T12:00:00Z'),
      generatedBy: 'jamf-mcp-server',
      totalComputers: 10,
      totalMobileDevices: 5,
      totalPolicies: 3,
      totalConfigurationProfiles: 2,
      totalScripts: 4,
      totalPackages: 6,
      totalComputerGroups: 2,
      totalMobileDeviceGroups: 1,
      ...overrides.overview,
    },
    components: {
      ...overrides.components,
    },
    ...overrides,
  } as EnvironmentDocumentation;
}

/**
 * Create mock component documentation
 */
function createMockComponentDoc(
  component: string,
  items: any[] = [],
  overrides: Partial<ComponentDocumentation> = {}
): ComponentDocumentation {
  return {
    component: component as any,
    totalCount: items.length,
    items,
    metadata: {
      generatedAt: new Date('2026-01-07T12:00:00Z'),
      jamfUrl: 'https://test.jamfcloud.com',
      detailLevel: 'standard',
    },
    ...overrides,
  };
}

/**
 * Helper to find a writeFile call by filename suffix
 */
function findWriteCall(suffix: string): [string, string] | undefined {
  const call = mockWriteFile.mock.calls.find(
    (c) => (c[0] as string).endsWith(suffix)
  );
  return call ? [call[0] as string, call[1] as string] : undefined;
}

describe('HandbookGenerator', () => {
  let generator: HandbookGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new HandbookGenerator();
  });

  describe('constructor', () => {
    test('should create an instance', () => {
      expect(generator).toBeInstanceOf(HandbookGenerator);
    });
  });

  describe('generateHandbook', () => {
    test('should create handbook directory', async () => {
      const doc = createMockEnvironmentDoc();
      const outputPath = '/tmp/test-output';

      await generator.generateHandbook(doc, outputPath);

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('handbook'),
        { recursive: true }
      );
    });

    test('should generate table of contents README.md', async () => {
      const doc = createMockEnvironmentDoc();
      const outputPath = '/tmp/test-output';

      await generator.generateHandbook(doc, outputPath);

      const readmeCall = findWriteCall('README.md');
      expect(readmeCall).toBeDefined();
      const [, content] = readmeCall!;
      expect(content).toContain('# Jamf Pro Environment Handbook');
      expect(content).toContain('https://test.jamfcloud.com');
    });

    test('should generate master handbook', async () => {
      const doc = createMockEnvironmentDoc();
      const outputPath = '/tmp/test-output';

      await generator.generateHandbook(doc, outputPath);

      const masterCall = findWriteCall('MASTER-HANDBOOK.md');
      expect(masterCall).toBeDefined();
      const [, content] = masterCall!;
      expect(content).toContain('# Jamf Pro Environment - Complete Handbook');
    });

    test('should skip components with zero items', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', []),
        },
      });
      const outputPath = '/tmp/test-output';

      await generator.generateHandbook(doc, outputPath);

      const policiesCall = findWriteCall('policies-handbook.md');
      expect(policiesCall).toBeUndefined();
    });

    test('should generate policies handbook when policies exist', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', [
            { general: { id: '1', name: 'Test Policy', enabled: true } },
          ]),
        },
      });
      const outputPath = '/tmp/test-output';

      await generator.generateHandbook(doc, outputPath);

      const policiesCall = findWriteCall('policies-handbook.md');
      expect(policiesCall).toBeDefined();
      const [, content] = policiesCall!;
      expect(content).toContain('# Policies Handbook');
      expect(content).toContain('Test Policy');
    });

    test('should generate scripts handbook when scripts exist', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          scripts: createMockComponentDoc('scripts', [
            { id: '1', name: 'Test Script', script_contents: '#!/bin/bash\necho hello' },
          ]),
        },
      });
      const outputPath = '/tmp/test-output';

      await generator.generateHandbook(doc, outputPath);

      const scriptsCall = findWriteCall('scripts-handbook.md');
      expect(scriptsCall).toBeDefined();
      const [, content] = scriptsCall!;
      expect(content).toContain('# Scripts Handbook');
      expect(content).toContain('Test Script');
    });
  });

  describe('generateTableOfContents', () => {
    test('should include environment URL', async () => {
      const doc = createMockEnvironmentDoc();
      await generator.generateHandbook(doc, '/tmp/test');

      const readmeCall = findWriteCall('README.md');
      const [, content] = readmeCall!;
      expect(content).toContain('**Environment:** https://test.jamfcloud.com');
    });

    test('should include statistics table', async () => {
      const doc = createMockEnvironmentDoc();
      await generator.generateHandbook(doc, '/tmp/test');

      const readmeCall = findWriteCall('README.md');
      const [, content] = readmeCall!;
      expect(content).toContain('## Environment Statistics');
      expect(content).toContain('| Computers | 10 |');
      expect(content).toContain('| Mobile Devices | 5 |');
      expect(content).toContain('| Policies | 3 |');
    });

    test('should include section links for non-zero components', async () => {
      const doc = createMockEnvironmentDoc();
      await generator.generateHandbook(doc, '/tmp/test');

      const readmeCall = findWriteCall('README.md');
      const [, content] = readmeCall!;
      expect(content).toContain('### Policies (3)');
      expect(content).toContain('[Policy Overview](policies-handbook.md)');
      expect(content).toContain('### Scripts (4)');
      expect(content).toContain('[Script Overview](scripts-handbook.md)');
    });

    test('should include executive summary', async () => {
      const doc = createMockEnvironmentDoc();
      await generator.generateHandbook(doc, '/tmp/test');

      const readmeCall = findWriteCall('README.md');
      const [, content] = readmeCall!;
      expect(content).toContain('## Executive Summary');
      expect(content).toContain('Operations Manual');
      expect(content).toContain('Training Resource');
    });
  });

  describe('policies handbook generation', () => {
    test('should include policy details with triggers', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', [
            {
              general: {
                id: '1',
                name: 'Software Update Policy',
                enabled: true,
                trigger_checkin: true,
                trigger_login: false,
                frequency: 'Once per computer',
                category: { name: 'Maintenance' },
              },
            },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const policiesCall = findWriteCall('policies-handbook.md');
      const [, content] = policiesCall!;
      expect(content).toContain('### Software Update Policy');
      expect(content).toContain('✅ Enabled');
      expect(content).toContain('Maintenance');
      expect(content).toContain('Once per computer');
    });

    test('should include scope information', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', [
            {
              general: { id: '1', name: 'Scoped Policy', enabled: true },
              scope: {
                all_computers: false,
                computer_groups: [
                  { id: '1', name: 'Engineering Macs' },
                ],
              },
            },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const policiesCall = findWriteCall('policies-handbook.md');
      const [, content] = policiesCall!;
      expect(content).toContain('#### Scope');
      expect(content).toContain('Engineering Macs');
    });

    test('should include packages in policy', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', [
            {
              general: { id: '1', name: 'Install Package Policy', enabled: true },
              package_configuration: {
                packages: [
                  { id: '1', name: 'MyApp.pkg', action: 'Install' },
                ],
              },
            },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const policiesCall = findWriteCall('policies-handbook.md');
      const [, content] = policiesCall!;
      expect(content).toContain('#### Packages');
      expect(content).toContain('MyApp.pkg');
    });

    test('should include scripts in policy', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', [
            {
              general: { id: '1', name: 'Script Policy', enabled: true },
              scripts: [
                { id: '1', name: 'Install Script', priority: 'Before' },
              ],
            },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const policiesCall = findWriteCall('policies-handbook.md');
      const [, content] = policiesCall!;
      expect(content).toContain('#### Scripts');
      expect(content).toContain('Install Script');
      expect(content).toContain('Before');
    });

    test('should include self-service configuration', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', [
            {
              general: { id: '1', name: 'Self Service Policy', enabled: true },
              self_service: {
                use_for_self_service: true,
                self_service_display_name: 'My App Installer',
                install_button_text: 'Install Now',
              },
            },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const policiesCall = findWriteCall('policies-handbook.md');
      const [, content] = policiesCall!;
      expect(content).toContain('#### Self-Service');
      expect(content).toContain('My App Installer');
      expect(content).toContain('Install Now');
    });

    test('should include exclusions when present', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', [
            {
              general: { id: '1', name: 'Policy with Exclusions', enabled: true },
              scope: {
                all_computers: true,
                exclusions: {
                  computer_groups: [
                    { id: '1', name: 'Test Machines' },
                  ],
                },
              },
            },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const policiesCall = findWriteCall('policies-handbook.md');
      const [, content] = policiesCall!;
      expect(content).toContain('#### Exclusions');
      expect(content).toContain('Test Machines');
    });
  });

  describe('scripts handbook generation', () => {
    test('should include script code', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          scripts: createMockComponentDoc('scripts', [
            {
              id: '1',
              name: 'Hello Script',
              script_contents: '#!/bin/bash\necho "Hello World"',
              info: 'A simple hello world script',
            },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const scriptsCall = findWriteCall('scripts-handbook.md');
      const [, content] = scriptsCall!;
      expect(content).toContain('#### Script Code');
      expect(content).toContain('```bash');
      expect(content).toContain('echo "Hello World"');
    });

    test('should include script parameters', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          scripts: createMockComponentDoc('scripts', [
            {
              id: '1',
              name: 'Parameterized Script',
              parameter4: 'Username',
              parameter5: 'Password',
            },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const scriptsCall = findWriteCall('scripts-handbook.md');
      const [, content] = scriptsCall!;
      expect(content).toContain('#### Parameters');
      expect(content).toContain('$4');
      expect(content).toContain('Username');
      expect(content).toContain('$5');
      expect(content).toContain('Password');
    });

    test('should show policies using the script', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          scripts: createMockComponentDoc('scripts', [
            { id: '1', name: 'Shared Script' },
          ]),
          policies: createMockComponentDoc('policies', [
            {
              general: { id: '10', name: 'Policy Using Script' },
              scripts: [{ id: '1', name: 'Shared Script' }],
            },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const scriptsCall = findWriteCall('scripts-handbook.md');
      const [, content] = scriptsCall!;
      expect(content).toContain('#### Used By');
      expect(content).toContain('Policy Using Script');
    });
  });

  describe('packages handbook generation', () => {
    test('should generate packages index table', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          packages: createMockComponentDoc('packages', [
            { id: '1', name: 'Chrome', filename: 'chrome.pkg', category: 'Browsers' },
            { id: '2', name: 'Firefox', filename: 'firefox.pkg', category: 'Browsers' },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const packagesCall = findWriteCall('packages-handbook.md');
      const [, content] = packagesCall!;
      expect(content).toContain('# Packages Handbook');
      expect(content).toContain('Chrome');
      expect(content).toContain('Firefox');
      expect(content).toContain('chrome.pkg');
      expect(content).toContain('Browsers');
    });
  });

  describe('groups handbook generation', () => {
    test('should separate smart and static groups', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          'computer-groups': createMockComponentDoc('computer-groups', [
            { id: '1', name: 'Smart Group', is_smart: true },
            { id: '2', name: 'Static Group', is_smart: false },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const groupsCall = findWriteCall('computer-groups-handbook.md');
      const [, content] = groupsCall!;
      expect(content).toContain('## Smart Groups');
      expect(content).toContain('Smart Group');
      expect(content).toContain('**Smart Groups**: 1');
      expect(content).toContain('**Static Groups**: 1');
    });

    test('should include smart group criteria', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          'computer-groups': createMockComponentDoc('computer-groups', [
            {
              id: '1',
              name: 'macOS Sonoma Macs',
              is_smart: true,
              criteria: [
                { name: 'Operating System Version', search_type: 'like', value: '14.' },
              ],
            },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const groupsCall = findWriteCall('computer-groups-handbook.md');
      const [, content] = groupsCall!;
      expect(content).toContain('#### Membership Criteria');
      expect(content).toContain('Operating System Version');
      expect(content).toContain('14.');
    });
  });

  describe('configuration profiles handbook generation', () => {
    test('should generate profiles handbook', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          'configuration-profiles': createMockComponentDoc('configuration-profiles', [
            { id: '1', name: 'WiFi Profile' },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const profilesCall = findWriteCall('configuration-profiles-handbook.md');
      expect(profilesCall).toBeDefined();
      const [, content] = profilesCall!;
      expect(content).toContain('# Configuration Profiles Handbook');
    });
  });

  describe('helper methods', () => {
    test('should calculate total assets correctly', async () => {
      const doc = createMockEnvironmentDoc({
        overview: {
          jamfUrl: 'https://test.jamfcloud.com',
          generatedAt: new Date(),
          generatedBy: 'jamf-mcp-server',
          totalComputers: 100,
          totalMobileDevices: 50,
          totalPolicies: 20,
          totalConfigurationProfiles: 10,
          totalScripts: 5,
          totalPackages: 15,
          totalComputerGroups: 8,
          totalMobileDeviceGroups: 3,
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const readmeCall = findWriteCall('README.md');
      const [, content] = readmeCall!;
      // Total should be 100+50+20+10+5+15+8+3 = 211
      expect(content).toContain('211 items');
    });

    test('should create valid anchors from text', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', [
            {
              general: { id: '1', name: 'Install Software (v2.0)', enabled: true },
            },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const policiesCall = findWriteCall('policies-handbook.md');
      const [, content] = policiesCall!;
      // Anchor should be lowercase, no special chars
      expect(content).toContain('#install-software-v20');
    });

    test('should sort items alphabetically in index', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', [
            { general: { id: '1', name: 'Zebra Policy', enabled: true } },
            { general: { id: '2', name: 'Alpha Policy', enabled: true } },
            { general: { id: '3', name: 'Middle Policy', enabled: true } },
          ]),
        },
      });
      await generator.generateHandbook(doc, '/tmp/test');

      const policiesCall = findWriteCall('policies-handbook.md');
      const [, content] = policiesCall!;

      const alphaIndex = content.indexOf('Alpha Policy');
      const middleIndex = content.indexOf('Middle Policy');
      const zebraIndex = content.indexOf('Zebra Policy');

      expect(alphaIndex).toBeLessThan(middleIndex);
      expect(middleIndex).toBeLessThan(zebraIndex);
    });
  });

  describe('edge cases', () => {
    test('should handle empty documentation gracefully', async () => {
      const doc = createMockEnvironmentDoc({
        overview: {
          jamfUrl: 'https://test.jamfcloud.com',
          generatedAt: new Date(),
          generatedBy: 'jamf-mcp-server',
          totalComputers: 0,
          totalMobileDevices: 0,
          totalPolicies: 0,
          totalConfigurationProfiles: 0,
          totalScripts: 0,
          totalPackages: 0,
          totalComputerGroups: 0,
          totalMobileDeviceGroups: 0,
        },
        components: {},
      });

      await expect(generator.generateHandbook(doc, '/tmp/test')).resolves.not.toThrow();
    });

    test('should handle missing optional fields', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', [
            {
              // Minimal policy with missing optional fields
              general: { id: '1', name: 'Minimal Policy' },
            },
          ]),
        },
      });

      await expect(generator.generateHandbook(doc, '/tmp/test')).resolves.not.toThrow();
    });

    test('should handle policies without general field', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          policies: createMockComponentDoc('policies', [
            { id: '1', name: 'Flat Policy' }, // No general wrapper
          ]),
        },
      });

      await generator.generateHandbook(doc, '/tmp/test');

      const policiesCall = findWriteCall('policies-handbook.md');
      const [, content] = policiesCall!;
      // Should still generate without error
      expect(content).toContain('# Policies Handbook');
    });

    test('should not generate inventory handbooks for computers/mobile-devices', async () => {
      const doc = createMockEnvironmentDoc({
        components: {
          computers: createMockComponentDoc('computers', [
            { id: '1', name: 'Computer 1' },
          ]),
          'mobile-devices': createMockComponentDoc('mobile-devices', [
            { id: '1', name: 'iPad 1' },
          ]),
        },
      });

      await generator.generateHandbook(doc, '/tmp/test');

      // Should not write individual handbook files for inventory
      const computersCall = findWriteCall('computers-handbook.md');
      const mobileCall = findWriteCall('mobile-devices-handbook.md');

      expect(computersCall).toBeUndefined();
      expect(mobileCall).toBeUndefined();
    });
  });
});
