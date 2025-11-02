/**
 * Jamf MCP Server Skills Registry
 *
 * Central export point for all Claude skills
 */
export { findOutdatedDevices } from './device-management/find-outdated-devices';
export { batchInventoryUpdate } from './device-management/batch-inventory-update';
export { deployPolicyByCriteria } from './policy-management/deploy-policy-by-criteria';
export { scheduledComplianceCheck } from './automation/scheduled-compliance-check';
export * from './types';
export declare const skillRegistry: {
    deviceManagement: {
        name: string;
        category: string;
        description: string;
    }[];
    policyManagement: {
        name: string;
        category: string;
        description: string;
    }[];
    automation: {
        name: string;
        category: string;
        description: string;
    }[];
};
//# sourceMappingURL=index.d.ts.map