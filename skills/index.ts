/**
 * Jamf MCP Server Skills Registry
 * 
 * Central export point for all Claude skills
 */

// Device Management Skills
export { findOutdatedDevices } from './device-management/find-outdated-devices';
export { batchInventoryUpdate } from './device-management/batch-inventory-update';

// Policy Management Skills  
export { deployPolicyByCriteria } from './policy-management/deploy-policy-by-criteria';

// Automation Skills
export { scheduledComplianceCheck } from './automation/scheduled-compliance-check';

// Export types
export * from './types';

// Skill Registry for discovery
export const skillRegistry = {
  deviceManagement: [
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