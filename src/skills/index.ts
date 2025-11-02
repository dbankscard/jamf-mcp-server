/**
 * Jamf MCP Server Skills Registry
 * 
 * Central export point for all Claude skills
 */

// Device Management Skills
export { findOutdatedDevices } from './device-management/find-outdated-devices.js';
export { batchInventoryUpdate } from './device-management/batch-inventory-update.js';
export { deviceSearch } from './device-management/device-search.js';

// Policy Management Skills  
export { deployPolicyByCriteria } from './policy-management/deploy-policy-by-criteria.js';

// Automation Skills
export { scheduledComplianceCheck } from './automation/scheduled-compliance-check.js';

// Export types
export * from './types.js';

// Skill Registry for discovery
export const skillRegistry = {
  deviceManagement: [
    {
      name: 'device-search',
      category: 'device-management',
      description: 'Enhanced device search with filtering and sorting'
    },
    {
      name: 'find-outdated-devices',
      category: 'device-management',
      description: 'Identify devices that haven\'t checked in recently'
    },
    {
      name: 'batch-inventory-update', 
      category: 'device-management',
      description: 'Update inventory for multiple devices at once'
    }
  ],
  policyManagement: [
    {
      name: 'deploy-policy-by-criteria',
      category: 'policy-management', 
      description: 'Deploy policies based on device criteria'
    }
  ],
  automation: [
    {
      name: 'scheduled-compliance-check',
      category: 'automation',
      description: 'Comprehensive compliance audit with reporting'
    }
  ]
};