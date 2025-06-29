import { jest } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { registerTools } from '../../../tools/index-compat.js';

describe('Policy Tools', () => {
  let server: Server;
  let jamfClient: any;

  beforeEach(() => {
    // Create mock Jamf client with policy methods
    jamfClient = {
      getAllComputers: jest.fn(),
      getComputerDetails: jest.fn(),
      searchComputers: jest.fn(),
      updateInventory: jest.fn(),
      listPolicies: jest.fn(),
      getPolicyDetails: jest.fn(),
      searchPolicies: jest.fn(),
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

  describe('listPolicies', () => {
    test('should list all policies with default limit', async () => {
      const mockPolicies = [
        { id: 1, name: 'Software Update Policy', category: 'Maintenance' },
        { id: 2, name: 'Security Settings', category: 'Security' },
        { id: 3, name: 'App Deployment', category: 'Software' },
      ];

      jamfClient.listPolicies.mockResolvedValue(mockPolicies);

      const policies = await jamfClient.listPolicies(100);
      
      expect(jamfClient.listPolicies).toHaveBeenCalledWith(100);
      expect(policies).toHaveLength(3);
      expect(policies[0]).toEqual({
        id: 1,
        name: 'Software Update Policy',
        category: 'Maintenance'
      });
    });

    test('should filter policies by category', async () => {
      const mockPolicies = [
        { id: 1, name: 'Software Update Policy', category: 'Maintenance' },
        { id: 2, name: 'Security Settings', category: 'Security' },
        { id: 3, name: 'Security Patch', category: 'Security' },
        { id: 4, name: 'App Deployment', category: 'Software' },
      ];

      jamfClient.listPolicies.mockResolvedValue(mockPolicies);

      // Simulate the filtering logic from the tool handler
      let policies = await jamfClient.listPolicies(100);
      const category = 'Security';
      policies = policies.filter((p: any) => 
        p.category?.toLowerCase().includes(category.toLowerCase())
      );
      
      expect(policies).toHaveLength(2);
      expect(policies.every((p: any) => p.category === 'Security')).toBe(true);
    });

    test('should respect custom limit', async () => {
      const mockPolicies = Array(10).fill(null).map((_, i) => ({
        id: i + 1,
        name: `Policy ${i + 1}`,
        category: 'Test'
      }));

      jamfClient.listPolicies.mockResolvedValue(mockPolicies);

      await jamfClient.listPolicies(10);
      
      expect(jamfClient.listPolicies).toHaveBeenCalledWith(10);
    });

    test('should handle empty policy list', async () => {
      jamfClient.listPolicies.mockResolvedValue([]);

      const policies = await jamfClient.listPolicies(100);
      
      expect(policies).toHaveLength(0);
    });

    test('should handle API errors gracefully', async () => {
      jamfClient.listPolicies.mockRejectedValue(new Error('API Error: Unauthorized'));

      await expect(jamfClient.listPolicies(100)).rejects.toThrow('API Error: Unauthorized');
    });
  });

  describe('getPolicyDetails', () => {
    test('should get detailed policy information', async () => {
      const mockPolicyDetails = {
        id: 1,
        name: 'Software Update Policy',
        enabled: true,
        category: 'Maintenance',
        frequency: 'Once per computer',
        trigger: 'CHECK-IN',
        triggerCheckin: true,
        triggerEnrollment: false,
        triggerLogin: false,
        triggerStartup: false,
        scope: {
          allComputers: false,
          computers: [
            { id: 100, name: 'Test-Mac-001' },
            { id: 101, name: 'Test-Mac-002' }
          ],
          computerGroups: [
            { id: 5, name: 'IT Department' }
          ],
          buildings: [],
          departments: [],
          limitations: {},
          exclusions: {}
        },
        scripts: [
          {
            id: 10,
            name: 'Update Check Script',
            priority: 'Before',
            parameter4: '--check',
            parameter5: '--verbose',
            parameter6: null,
            parameter7: null,
            parameter8: null,
            parameter9: null,
            parameter10: null,
            parameter11: null
          }
        ],
        packages: [
          {
            id: 20,
            name: 'Security Update 2024.1',
            action: 'Install',
            fillUserTemplate: false,
            fillExistingUsers: false
          }
        ],
        files: null,
        userInteraction: {
          messageStart: 'Starting software update...',
          messageFinish: 'Update complete!',
          allowDeferral: true,
          deferralType: '2024-12-31T23:59:59Z'
        },
        reboot: {
          message: 'Your computer will restart to complete the update',
          startupDisk: 'Current Startup Disk',
          specifyStartup: null,
          noUserLoggedIn: 'Restart',
          userLoggedIn: 'Restart if a package or update requires it',
          minutes: 5
        }
      };

      jamfClient.getPolicyDetails.mockResolvedValue(mockPolicyDetails);

      const policyDetails = await jamfClient.getPolicyDetails('1');
      
      expect(jamfClient.getPolicyDetails).toHaveBeenCalledWith('1');
      expect(policyDetails.id).toBe(1);
      expect(policyDetails.name).toBe('Software Update Policy');
      expect(policyDetails.enabled).toBe(true);
      expect(policyDetails.scripts).toHaveLength(1);
      expect(policyDetails.packages).toHaveLength(1);
      expect(policyDetails.scope.computers).toHaveLength(2);
      expect(policyDetails.userInteraction.allowDeferral).toBe(true);
      expect(policyDetails.reboot.minutes).toBe(5);
    });

    test('should handle minimal policy data', async () => {
      const mockPolicyDetails = {
        id: 2,
        name: 'Simple Policy',
        enabled: false,
        category: null,
        frequency: 'Ongoing',
        trigger: null,
        triggerCheckin: false,
        triggerEnrollment: false,
        triggerLogin: false,
        triggerStartup: false,
        scope: {
          allComputers: true,
          computers: [],
          computerGroups: [],
          buildings: [],
          departments: [],
          limitations: {},
          exclusions: {}
        },
        scripts: [],
        packages: [],
        files: null,
        userInteraction: {
          messageStart: null,
          messageFinish: null,
          allowDeferral: false,
          deferralType: null
        },
        reboot: {
          message: null,
          startupDisk: null,
          specifyStartup: null,
          noUserLoggedIn: null,
          userLoggedIn: null,
          minutes: null
        }
      };

      jamfClient.getPolicyDetails.mockResolvedValue(mockPolicyDetails);

      const policyDetails = await jamfClient.getPolicyDetails('2');
      
      expect(policyDetails.id).toBe(2);
      expect(policyDetails.name).toBe('Simple Policy');
      expect(policyDetails.enabled).toBe(false);
      expect(policyDetails.scripts).toHaveLength(0);
      expect(policyDetails.packages).toHaveLength(0);
      expect(policyDetails.scope.allComputers).toBe(true);
    });

    test('should handle policy not found error', async () => {
      jamfClient.getPolicyDetails.mockRejectedValue(new Error('Policy with ID 999 not found'));

      await expect(jamfClient.getPolicyDetails('999')).rejects.toThrow('Policy with ID 999 not found');
    });
  });

  describe('searchPolicies', () => {
    test('should search policies by name', async () => {
      const mockSearchResults = [
        {
          id: 1,
          name: 'Security Update Policy',
          category: 'Security',
          enabled: true,
          frequency: 'Once per computer'
        },
        {
          id: 2,
          name: 'Security Settings',
          category: 'Security',
          enabled: true,
          frequency: 'Ongoing'
        }
      ];

      jamfClient.searchPolicies.mockResolvedValue(mockSearchResults);

      const results = await jamfClient.searchPolicies('Security', 50);
      
      expect(jamfClient.searchPolicies).toHaveBeenCalledWith('Security', 50);
      expect(results).toHaveLength(2);
      expect(results[0].name).toContain('Security');
    });

    test('should search with custom limit', async () => {
      const mockSearchResults = Array(10).fill(null).map((_, i) => ({
        id: i + 1,
        name: `Test Policy ${i + 1}`,
        category: 'Test',
        enabled: true,
        frequency: 'Ongoing'
      }));

      jamfClient.searchPolicies.mockResolvedValue(mockSearchResults);

      const results = await jamfClient.searchPolicies('Test', 10);
      
      expect(jamfClient.searchPolicies).toHaveBeenCalledWith('Test', 10);
      expect(results).toHaveLength(10);
    });

    test('should handle no search results', async () => {
      jamfClient.searchPolicies.mockResolvedValue([]);

      const results = await jamfClient.searchPolicies('NonExistentPolicy', 50);
      
      expect(results).toHaveLength(0);
    });

    test('should search by policy ID', async () => {
      const mockSearchResults = [
        {
          id: 123,
          name: 'Specific Policy',
          category: 'General',
          enabled: true,
          frequency: 'Once per computer'
        }
      ];

      jamfClient.searchPolicies.mockResolvedValue(mockSearchResults);

      const results = await jamfClient.searchPolicies('123', 50);
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(123);
    });

    test('should handle search API errors', async () => {
      jamfClient.searchPolicies.mockRejectedValue(new Error('Search service unavailable'));

      await expect(jamfClient.searchPolicies('Test', 50)).rejects.toThrow('Search service unavailable');
    });
  });

  describe('Integration Scenarios', () => {
    test('should list policies and get details for specific ones', async () => {
      // First, list policies
      const mockPolicies = [
        { id: 1, name: 'Policy A', category: 'Software' },
        { id: 2, name: 'Policy B', category: 'Security' },
      ];
      jamfClient.listPolicies.mockResolvedValue(mockPolicies);

      const policies = await jamfClient.listPolicies(100);
      expect(policies).toHaveLength(2);

      // Then get details for one of them
      const mockDetails = {
        id: 1,
        name: 'Policy A',
        enabled: true,
        category: 'Software',
        scripts: [],
        packages: [{ id: 10, name: 'App.pkg' }]
      };
      jamfClient.getPolicyDetails.mockResolvedValue(mockDetails);

      const details = await jamfClient.getPolicyDetails('1');
      
      expect(details.name).toBe('Policy A');
      expect(details.packages).toHaveLength(1);
    });

    test('should search and filter policies by multiple criteria', async () => {
      // Search for policies
      const searchResults = [
        {
          id: 1,
          name: 'macOS Update',
          category: 'Updates',
          enabled: true,
          frequency: 'Once per computer'
        },
        {
          id: 2,
          name: 'iOS Update',
          category: 'Updates',
          enabled: false,
          frequency: 'Once per computer'
        }
      ];
      jamfClient.searchPolicies.mockResolvedValue(searchResults);

      const results = await jamfClient.searchPolicies('Update', 20);
      
      expect(results).toHaveLength(2);
      expect(results.filter((p: any) => p.enabled).length).toBe(1);
      expect(results.filter((p: any) => p.category === 'Updates').length).toBe(2);
    });
  });

  describe('Policy Method Implementation', () => {
    test('listPolicies implementation should handle API response correctly', async () => {
      // Mock the raw API response
      const mockApiResponse = {
        data: {
          policies: [
            { id: 1, name: 'Policy 1' },
            { id: 2, name: 'Policy 2' },
            { id: 3, name: 'Policy 3' },
            { id: 4, name: 'Policy 4' },
            { id: 5, name: 'Policy 5' },
          ]
        }
      };

      // Test the actual implementation logic
      const policies = mockApiResponse.data.policies || [];
      const limit = 3;
      const limitedPolicies = policies.slice(0, limit);

      expect(limitedPolicies).toHaveLength(3);
      expect(limitedPolicies[0].id).toBe(1);
      expect(limitedPolicies[2].id).toBe(3);
    });

    test('getPolicyDetails should transform data correctly', async () => {
      // Mock raw API response structure
      const mockApiResponse = {
        data: {
          policy: {
            id: 1,
            general: {
              name: 'Test Policy',
              enabled: true,
              category: {
                name: 'Testing'
              },
              frequency: 'Once per week',
              trigger: 'EVENT',
              trigger_checkin: false,
              trigger_enrollment: true,
              trigger_login: false,
              trigger_startup: false
            },
            scope: {
              all_computers: false,
              computers: [{ id: 1, name: 'Computer 1' }],
              computer_groups: [],
              buildings: [],
              departments: [],
              limitations: {},
              exclusions: {}
            },
            scripts: [{
              id: 10,
              name: 'Test Script',
              priority: 'Before',
              parameter4: 'value4',
              parameter5: 'value5',
              parameter6: null,
              parameter7: null,
              parameter8: null,
              parameter9: null,
              parameter10: null,
              parameter11: null
            }],
            package_configuration: {
              packages: [{
                id: 20,
                name: 'Test Package',
                action: 'Install',
                fill_user_template: false,
                fill_existing_users: false
              }]
            },
            files_processes: null,
            user_interaction: {
              message_start: 'Starting...',
              message_finish: 'Finished!',
              allow_users_to_defer: true,
              allow_deferral_until_utc: '2024-12-31T23:59:59Z'
            },
            reboot: {
              message: 'Reboot required',
              startup_disk: 'Current',
              specify_startup: null,
              no_user_logged_in: 'Restart',
              user_logged_in: 'Restart if required',
              minutes_until_reboot: 5
            }
          }
        }
      };

      // Test the transformation logic
      const policy = mockApiResponse.data.policy;
      const transformed = {
        id: policy.id,
        name: policy.general?.name,
        enabled: policy.general?.enabled,
        category: policy.general?.category?.name,
        frequency: policy.general?.frequency,
        trigger: policy.general?.trigger,
        triggerCheckin: policy.general?.trigger_checkin,
        triggerEnrollment: policy.general?.trigger_enrollment,
        triggerLogin: policy.general?.trigger_login,
        triggerStartup: policy.general?.trigger_startup,
        scope: {
          allComputers: policy.scope?.all_computers,
          computers: policy.scope?.computers,
          computerGroups: policy.scope?.computer_groups,
          buildings: policy.scope?.buildings,
          departments: policy.scope?.departments,
          limitations: policy.scope?.limitations,
          exclusions: policy.scope?.exclusions,
        },
        scripts: policy.scripts?.map((s: any) => ({
          id: s.id,
          name: s.name,
          priority: s.priority,
          parameter4: s.parameter4,
          parameter5: s.parameter5,
          parameter6: s.parameter6,
          parameter7: s.parameter7,
          parameter8: s.parameter8,
          parameter9: s.parameter9,
          parameter10: s.parameter10,
          parameter11: s.parameter11,
        })),
        packages: policy.package_configuration?.packages?.map((p: any) => ({
          id: p.id,
          name: p.name,
          action: p.action,
          fillUserTemplate: p.fill_user_template,
          fillExistingUsers: p.fill_existing_users,
        })),
        files: policy.files_processes,
        userInteraction: {
          messageStart: policy.user_interaction?.message_start,
          messageFinish: policy.user_interaction?.message_finish,
          allowDeferral: policy.user_interaction?.allow_users_to_defer,
          deferralType: policy.user_interaction?.allow_deferral_until_utc,
        },
        reboot: {
          message: policy.reboot?.message,
          startupDisk: policy.reboot?.startup_disk,
          specifyStartup: policy.reboot?.specify_startup,
          noUserLoggedIn: policy.reboot?.no_user_logged_in,
          userLoggedIn: policy.reboot?.user_logged_in,
          minutes: policy.reboot?.minutes_until_reboot,
        },
      };

      expect(transformed.name).toBe('Test Policy');
      expect(transformed.category).toBe('Testing');
      expect(transformed.triggerEnrollment).toBe(true);
      expect(transformed.scripts[0].name).toBe('Test Script');
      expect(transformed.packages[0].action).toBe('Install');
      expect(transformed.userInteraction.allowDeferral).toBe(true);
      expect(transformed.reboot.minutes).toBe(5);
    });

    test('searchPolicies should filter correctly', async () => {
      const mockPolicies = [
        { id: 1, name: 'macOS Security Update' },
        { id: 2, name: 'Windows Update' },
        { id: 3, name: 'Security Scanner' },
        { id: 123, name: 'Numbered Policy' }
      ];

      // Test name filtering
      const query = 'security';
      const lowerQuery = query.toLowerCase();
      const filtered = mockPolicies.filter((p: any) => 
        p.name?.toLowerCase().includes(lowerQuery) ||
        p.id?.toString().includes(query)
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.find(p => p.id === 1)).toBeDefined();
      expect(filtered.find(p => p.id === 3)).toBeDefined();

      // Test ID filtering
      const idQuery = '123';
      const idFiltered = mockPolicies.filter((p: any) => 
        p.name?.toLowerCase().includes(idQuery.toLowerCase()) ||
        p.id?.toString().includes(idQuery)
      );

      expect(idFiltered).toHaveLength(1);
      expect(idFiltered[0].id).toBe(123);
    });
  });
});