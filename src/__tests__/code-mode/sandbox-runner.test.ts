import { describe, expect, it, jest, afterAll } from '@jest/globals';
import { execute } from '../../code-mode/sandbox-runner.js';
import { IJamfApiClient } from '../../types/jamf-client.js';

// Create a mock client with all methods
function createMockClient(overrides: Partial<IJamfApiClient> = {}): IJamfApiClient {
  const base: IJamfApiClient = {
    testApiAccess: jest.fn().mockResolvedValue(undefined),
    keepAlive: jest.fn().mockResolvedValue(undefined),
    getComputerCount: jest.fn().mockResolvedValue(42),
    searchComputers: jest.fn().mockResolvedValue([{ id: '1', name: 'Mac-1' }]),
    getComputerDetails: jest.fn().mockResolvedValue({ id: '1', name: 'Mac-1' }),
    getAllComputers: jest.fn().mockResolvedValue([
      { id: '1', name: 'Mac-1' },
      { id: '2', name: 'Mac-2' },
    ]),
    updateInventory: jest.fn().mockResolvedValue(undefined),
    listPolicies: jest.fn().mockResolvedValue([{ id: '1', name: 'Policy 1' }]),
    searchPolicies: jest.fn().mockResolvedValue([]),
    getPolicyDetails: jest.fn().mockResolvedValue({ id: '1', name: 'Policy 1' }),
    createPolicy: jest.fn().mockResolvedValue({ id: '2' }),
    updatePolicy: jest.fn().mockResolvedValue({ id: '1' }),
    clonePolicy: jest.fn().mockResolvedValue({ id: '3' }),
    setPolicyEnabled: jest.fn().mockResolvedValue({ id: '1' }),
    updatePolicyScope: jest.fn().mockResolvedValue({ id: '1' }),
    deletePolicy: jest.fn().mockResolvedValue(undefined),
    executePolicy: jest.fn().mockResolvedValue(undefined),
    listScripts: jest.fn().mockResolvedValue([]),
    searchScripts: jest.fn().mockResolvedValue([]),
    getScriptDetails: jest.fn().mockResolvedValue({}),
    createScript: jest.fn().mockResolvedValue({ id: '1' }),
    updateScript: jest.fn().mockResolvedValue({ id: '1' }),
    deleteScript: jest.fn().mockResolvedValue(undefined),
    deployScript: jest.fn().mockResolvedValue(undefined),
    listConfigurationProfiles: jest.fn().mockResolvedValue([]),
    getConfigurationProfileDetails: jest.fn().mockResolvedValue({}),
    searchConfigurationProfiles: jest.fn().mockResolvedValue([]),
    deployConfigurationProfile: jest.fn().mockResolvedValue(undefined),
    removeConfigurationProfile: jest.fn().mockResolvedValue(undefined),
    deleteConfigurationProfile: jest.fn().mockResolvedValue(undefined),
    listPackages: jest.fn().mockResolvedValue([]),
    getPackageDetails: jest.fn().mockResolvedValue({}),
    searchPackages: jest.fn().mockResolvedValue([]),
    getPackageDeploymentHistory: jest.fn().mockResolvedValue({}),
    getPoliciesUsingPackage: jest.fn().mockResolvedValue([]),
    listComputerGroups: jest.fn().mockResolvedValue([]),
    getComputerGroupDetails: jest.fn().mockResolvedValue({}),
    searchComputerGroups: jest.fn().mockResolvedValue([]),
    getComputerGroupMembers: jest.fn().mockResolvedValue([]),
    createStaticComputerGroup: jest.fn().mockResolvedValue({ id: '1' }),
    updateStaticComputerGroup: jest.fn().mockResolvedValue({ id: '1' }),
    deleteComputerGroup: jest.fn().mockResolvedValue(undefined),
    searchMobileDevices: jest.fn().mockResolvedValue([]),
    getMobileDeviceDetails: jest.fn().mockResolvedValue({}),
    listMobileDevices: jest.fn().mockResolvedValue([]),
    updateMobileDeviceInventory: jest.fn().mockResolvedValue(undefined),
    sendMDMCommand: jest.fn().mockResolvedValue(undefined),
    getMobileDeviceGroups: jest.fn().mockResolvedValue([]),
    getMobileDeviceGroupDetails: jest.fn().mockResolvedValue({}),
    getInventorySummary: jest.fn().mockResolvedValue({}),
    getPolicyComplianceReport: jest.fn().mockResolvedValue({}),
    getPackageDeploymentStats: jest.fn().mockResolvedValue({}),
    getSoftwareVersionReport: jest.fn().mockResolvedValue({}),
    getDeviceComplianceSummary: jest.fn().mockResolvedValue({}),
    getComplianceReport: jest.fn().mockResolvedValue({}),
    getStorageReport: jest.fn().mockResolvedValue({}),
    getOSVersionReport: jest.fn().mockResolvedValue({}),
    createAdvancedComputerSearch: jest.fn().mockResolvedValue({ id: '1' }),
    getAdvancedComputerSearchDetails: jest.fn().mockResolvedValue({}),
    deleteAdvancedComputerSearch: jest.fn().mockResolvedValue(undefined),
    listAdvancedComputerSearches: jest.fn().mockResolvedValue([]),
    ensureComplianceSearch: jest.fn().mockResolvedValue('1'),
    getComputerHistory: jest.fn().mockResolvedValue({}),
    getComputerPolicyLogs: jest.fn().mockResolvedValue({}),
    getComputerMDMCommandHistory: jest.fn().mockResolvedValue({}),
    sendComputerMDMCommand: jest.fn().mockResolvedValue({}),
    flushMDMCommands: jest.fn().mockResolvedValue(undefined),
    listBuildings: jest.fn().mockResolvedValue([]),
    getBuildingDetails: jest.fn().mockResolvedValue({}),
    listDepartments: jest.fn().mockResolvedValue([]),
    getDepartmentDetails: jest.fn().mockResolvedValue({}),
    listCategories: jest.fn().mockResolvedValue([]),
    getCategoryDetails: jest.fn().mockResolvedValue({}),
    getLocalAdminPassword: jest.fn().mockResolvedValue({}),
    getLocalAdminPasswordAudit: jest.fn().mockResolvedValue({}),
    getLocalAdminPasswordAccounts: jest.fn().mockResolvedValue({}),
    listPatchSoftwareTitles: jest.fn().mockResolvedValue([]),
    getPatchSoftwareTitleDetails: jest.fn().mockResolvedValue({}),
    listPatchPolicies: jest.fn().mockResolvedValue([]),
    getPatchPolicyDashboard: jest.fn().mockResolvedValue({}),
    listComputerExtensionAttributes: jest.fn().mockResolvedValue([]),
    getComputerExtensionAttributeDetails: jest.fn().mockResolvedValue({}),
    createComputerExtensionAttribute: jest.fn().mockResolvedValue({ id: '1' }),
    updateComputerExtensionAttribute: jest.fn().mockResolvedValue({ id: '1' }),
    deleteComputerExtensionAttribute: jest.fn().mockResolvedValue(undefined),
    listSoftwareUpdatePlans: jest.fn().mockResolvedValue([]),
    createSoftwareUpdatePlan: jest.fn().mockResolvedValue({ id: '1' }),
    getSoftwareUpdatePlanDetails: jest.fn().mockResolvedValue({}),
    listComputerPrestages: jest.fn().mockResolvedValue([]),
    getComputerPrestageDetails: jest.fn().mockResolvedValue({}),
    getComputerPrestageScope: jest.fn().mockResolvedValue({}),
    listMobilePrestages: jest.fn().mockResolvedValue([]),
    getMobilePrestageDetails: jest.fn().mockResolvedValue({}),
    listNetworkSegments: jest.fn().mockResolvedValue([]),
    getNetworkSegmentDetails: jest.fn().mockResolvedValue({}),
    listAccounts: jest.fn().mockResolvedValue({}),
    getAccountDetails: jest.fn().mockResolvedValue({}),
    getAccountGroupDetails: jest.fn().mockResolvedValue({}),
    listUsers: jest.fn().mockResolvedValue([]),
    getUserDetails: jest.fn().mockResolvedValue({}),
    searchUsers: jest.fn().mockResolvedValue([]),
    listAppInstallers: jest.fn().mockResolvedValue([]),
    getAppInstallerDetails: jest.fn().mockResolvedValue({}),
    listRestrictedSoftware: jest.fn().mockResolvedValue([]),
    getRestrictedSoftwareDetails: jest.fn().mockResolvedValue({}),
    createRestrictedSoftware: jest.fn().mockResolvedValue({ id: '1' }),
    updateRestrictedSoftware: jest.fn().mockResolvedValue({ id: '1' }),
    deleteRestrictedSoftware: jest.fn().mockResolvedValue(undefined),
    listWebhooks: jest.fn().mockResolvedValue([]),
    getWebhookDetails: jest.fn().mockResolvedValue({}),
  };
  return { ...base, ...overrides };
}

describe('SandboxRunner', () => {
  describe('execute — read operations', () => {
    it('executes read code and returns results', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: 'return await jamf.getAllComputers(5);',
        mode: 'plan',
        capabilities: ['read:computers'],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toEqual([
        { id: '1', name: 'Mac-1' },
        { id: '2', name: 'Mac-2' },
      ]);
      expect(result.metrics.reads).toBe(1);
      expect(client.getAllComputers).toHaveBeenCalledWith(5);
    });

    it('denies access without required capability', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: 'return await jamf.getAllComputers();',
        mode: 'plan',
        capabilities: ['read:policies'],
      });

      expect(result.success).toBe(false);
      expect(result.logs.some(l => l.msg.some(m =>
        typeof m === 'string' && m.includes('Access denied'),
      ))).toBe(true);
    });
  });

  describe('execute — plan mode', () => {
    it('blocks write operations in plan mode', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: 'return await jamf.createPolicy({ name: "Test" });',
        mode: 'plan',
        capabilities: ['write:policies'],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toMatchObject({ blocked: true, method: 'createPolicy' });
      expect(client.createPolicy).not.toHaveBeenCalled();
      expect(result.diff.length).toBe(1);
      expect(result.diff[0].action).toBe('write');
    });

    it('blocks command operations in plan mode', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: 'return await jamf.executePolicy("1", ["d1"]);',
        mode: 'plan',
        capabilities: ['command:policies'],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toMatchObject({ blocked: true, method: 'executePolicy' });
      expect(client.executePolicy).not.toHaveBeenCalled();
    });

    it('allows read operations in plan mode', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: 'return await jamf.getComputerCount();',
        mode: 'plan',
        capabilities: ['read:computers'],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toBe(42);
      expect(client.getComputerCount).toHaveBeenCalled();
    });
  });

  describe('execute — apply mode', () => {
    it('executes write operations in apply mode', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: 'return await jamf.createPolicy({ name: "Test" });',
        mode: 'apply',
        capabilities: ['write:policies'],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toEqual({ id: '2' });
      expect(client.createPolicy).toHaveBeenCalledWith({ name: 'Test' });
    });
  });

  describe('execute — logging', () => {
    it('captures log/warn/error calls', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: `
          log("hello", 42);
          warn("caution");
          error("oops");
          return true;
        `,
        mode: 'plan',
        capabilities: [],
      });

      expect(result.success).toBe(true);
      expect(result.logs).toEqual([
        { level: 'info', msg: ['hello', 42] },
        { level: 'warn', msg: ['caution'] },
        { level: 'error', msg: ['oops'] },
      ]);
    });
  });

  describe('execute — helpers', () => {
    it('provides daysSince helper', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: `
          const days = helpers.daysSince(null);
          return days;
        `,
        mode: 'plan',
        capabilities: [],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toBe(Infinity);
    });

    it('provides chunk helper', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: `
          return helpers.chunk([1,2,3,4,5], 2);
        `,
        mode: 'plan',
        capabilities: [],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toEqual([[1, 2], [3, 4], [5]]);
    });
  });

  describe('execute — budget enforcement', () => {
    it('enforces read budget', async () => {
      const client = createMockClient();
      // Set a very low budget via env
      const origBudget = process.env.JAMF_CODE_MODE_READ_BUDGET;
      process.env.JAMF_CODE_MODE_READ_BUDGET = '2';

      try {
        const result = await execute(client, {
          code: `
            await jamf.getAllComputers();
            await jamf.listPolicies();
            await jamf.listScripts();
          `,
          mode: 'plan',
          capabilities: ['read:computers', 'read:policies', 'read:scripts'],
        });

        expect(result.success).toBe(false);
        expect(result.logs.some(l => l.msg.some(m =>
          typeof m === 'string' && m.includes('Budget exceeded'),
        ))).toBe(true);
      } finally {
        if (origBudget === undefined) {
          delete process.env.JAMF_CODE_MODE_READ_BUDGET;
        } else {
          process.env.JAMF_CODE_MODE_READ_BUDGET = origBudget;
        }
      }
    });
  });

  describe('execute — sandbox restrictions', () => {
    it('does not expose require', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: 'return typeof require;',
        mode: 'plan',
        capabilities: [],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toBe('undefined');
    });

    it('does not expose process', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: 'return typeof process;',
        mode: 'plan',
        capabilities: [],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toBe('undefined');
    });

    it('does not expose fetch', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: 'return typeof fetch;',
        mode: 'plan',
        capabilities: [],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toBe('undefined');
    });

    it('exposes standard builtins', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: `
          const arr = [3, 1, 2];
          const m = new Map([["a", 1]]);
          const s = new Set([1, 2, 3]);
          return {
            sorted: arr.sort(),
            mapSize: m.size,
            setSize: s.size,
            pi: Math.PI,
            parsed: parseInt("42"),
            encoded: encodeURIComponent("hello world"),
          };
        `,
        mode: 'plan',
        capabilities: [],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toEqual({
        sorted: [1, 2, 3],
        mapSize: 1,
        setSize: 3,
        pi: Math.PI,
        parsed: 42,
        encoded: 'hello%20world',
      });
    });
  });

  describe('execute — error handling', () => {
    it('catches runtime errors', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: 'throw new Error("boom");',
        mode: 'plan',
        capabilities: [],
      });

      expect(result.success).toBe(false);
      expect(result.logs.some(l => l.msg.some(m =>
        typeof m === 'string' && m.includes('boom'),
      ))).toBe(true);
    });

    it('catches API errors', async () => {
      const client = createMockClient({
        getAllComputers: jest.fn().mockRejectedValue(new Error('API timeout')),
      });
      const result = await execute(client, {
        code: 'return await jamf.getAllComputers();',
        mode: 'plan',
        capabilities: ['read:computers'],
      });

      expect(result.success).toBe(false);
      expect(result.logs.some(l => l.msg.some(m =>
        typeof m === 'string' && m.includes('API timeout'),
      ))).toBe(true);
    });
  });

  describe('execute — metrics', () => {
    it('reports execution metrics', async () => {
      const client = createMockClient();
      const result = await execute(client, {
        code: `
          await jamf.getAllComputers();
          await jamf.getComputerDetails("1");
          return true;
        `,
        mode: 'plan',
        capabilities: ['read:computers'],
      });

      expect(result.success).toBe(true);
      expect(result.metrics.reads).toBe(2);
      expect(result.metrics.writes).toBe(0);
      expect(result.metrics.commands).toBe(0);
      expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
