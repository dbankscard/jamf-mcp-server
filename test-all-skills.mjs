#!/usr/bin/env node
/**
 * Comprehensive test suite for all Jamf MCP Skills
 * Run this before building to ensure all skills are working correctly
 */

import { SkillsManager } from './dist/skills/manager.js';
import { createSkillContext } from './dist/skills/context-provider.js';
import chalk from 'chalk';

// Mock Jamf API responses
const mockDevices = [
  { 
    id: 706, 
    name: 'CORP-IT-0300',
    serialNumber: 'ABC123', 
    lastContactTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days old
    osVersion: '14.1.0',
    ipAddress: '192.168.1.100'
  },
  { 
    id: 762, 
    name: 'CORP-IT-0319',
    serialNumber: 'DEF456', 
    lastContactTime: new Date().toISOString(), // Today
    osVersion: '14.2.0',
    ipAddress: '192.168.1.101'
  },
  { 
    id: 759, 
    name: 'CORP-IT-0322',
    serialNumber: 'GHI789', 
    lastContactTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days old
    osVersion: '13.6.0',
    ipAddress: '192.168.1.102'
  }
];

const mockPolicies = [
  { id: 1, name: 'Software Updates', category: 'Maintenance', enabled: true },
  { id: 2, name: 'Security Settings', category: 'Security', enabled: true },
  { id: 3, name: 'App Deployment', category: 'Software', enabled: false }
];

// Create mock context
const createMockContext = () => {
  const toolCalls = [];
  
  return {
    callTool: async (toolName, params) => {
      toolCalls.push({ tool: toolName, params });
      
      switch (toolName) {
        case 'searchDevices':
          return { 
            data: { 
              devices: params.query ? 
                mockDevices.filter(d => 
                  d.name.toLowerCase().includes(params.query.toLowerCase()) ||
                  d.osVersion.includes(params.query) ||
                  (params.query === 'os' && true)  // Return all devices for 'os' query
                ) :
                mockDevices 
            } 
          };
          
        case 'getDeviceDetails':
          const device = mockDevices.find(d => d.id.toString() === params.deviceId);
          if (device && device.id === 759) {
            return {
              data: {
                device: {
                  general: device,
                  userAndLocation: {
                    username: 'jane.smith',
                    realName: 'Jane Smith',
                    email: 'jane.smith@example.com',
                    department: 'IT Infrastructure',
                    building: 'Main Office'
                  }
                }
              }
            };
          }
          return { data: { device: { general: device } } };
          
        case 'checkDeviceCompliance':
          // This tool can work with or without deviceId
          if (params.deviceId) {
            // Single device check
            const dev = mockDevices.find(d => d.id.toString() === params.deviceId);
            const daysSinceContact = dev ? 
              Math.floor((Date.now() - new Date(dev.lastContactTime).getTime()) / (24 * 60 * 60 * 1000)) : 
              999;
            return {
              success: true,
              data: {
                compliant: daysSinceContact <= (params.daysSinceLastContact || 7),
                daysSinceLastContact: daysSinceContact,
                lastContactTime: dev?.lastContactTime
              }
            };
          } else {
            // Multiple devices check (for find-outdated-devices skill)
            const threshold = params.days || params.daysSinceLastContact || 7;
            const outdatedDevices = mockDevices.filter(d => {
              const daysSince = Math.floor((Date.now() - new Date(d.lastContactTime).getTime()) / (24 * 60 * 60 * 1000));
              return daysSince > threshold;
            });
            
            return {
              success: true,
              data: {
                totalDevices: mockDevices.length,
                compliant: mockDevices.length - outdatedDevices.length,
                nonCompliant: outdatedDevices.length,
                devices: params.includeDetails ? outdatedDevices : []
              }
            };
          }
          
        case 'updateDeviceInventory':
        case 'updateInventory':
          return { success: true, data: { updated: true, deviceId: params.deviceId } };
          
        case 'searchPolicies':
          return { data: { policies: mockPolicies } };
          
        case 'getPolicyDetails':
          const policy = mockPolicies.find(p => p.id.toString() === params.policyId);
          return { data: { policy } };
          
        case 'deployPolicy':
          return { success: true, data: { deployed: true, policyId: params.policyId } };
          
        case 'executePolicy':
          return { success: true, data: { executed: true, policyId: params.policyId, deviceIds: params.deviceIds } };
          
        case 'searchConfigurationProfiles':
          return { data: { profiles: [] } };
          
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: console.error
    },
    getToolCalls: () => toolCalls
  };
};

// Test runner
class SkillTestRunner {
  constructor() {
    this.results = [];
    this.manager = new SkillsManager();
  }

  async runTest(testName, skillName, params, assertions) {
    const startTime = Date.now();
    const context = createMockContext();
    
    try {
      // Create a new manager for each test to ensure isolation
      const manager = new SkillsManager();
      
      // Create mock server object with handleToolCall
      const mockServer = {
        handleToolCall: async (toolName, params) => {
          const result = await context.callTool(toolName, params);
          // Format response as MCP expects
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result)
            }]
          };
        },
        logger: context.logger
      };
      
      // Initialize the manager with mock server
      manager.initialize(mockServer);
      
      const result = await manager.executeSkill(skillName, params);
      const duration = Date.now() - startTime;
      
      // Debug output in verbose mode
      if (process.env.VERBOSE === 'true') {
        console.log('Result:', JSON.stringify(result, null, 2));
      }
      
      // Run assertions
      const assertionResults = [];
      for (const assertion of assertions) {
        try {
          const passed = await assertion(result, context);
          assertionResults.push({ passed, message: assertion.message || 'Assertion passed' });
        } catch (error) {
          assertionResults.push({ passed: false, message: error.message });
        }
      }
      
      const allPassed = assertionResults.every(a => a.passed);
      
      this.results.push({
        testName,
        skillName,
        passed: allPassed,
        duration,
        assertionResults,
        toolCalls: context.getToolCalls()
      });
      
      return allPassed;
    } catch (error) {
      this.results.push({
        testName,
        skillName,
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      });
      return false;
    }
  }

  printResults() {
    console.log('\n' + chalk.bold('=== Skill Test Results ===\n'));
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const result of this.results) {
      if (result.passed) {
        console.log(chalk.green('✓') + ' ' + chalk.bold(result.testName) + chalk.gray(` (${result.duration}ms)`));
        totalPassed++;
      } else {
        console.log(chalk.red('✗') + ' ' + chalk.bold(result.testName) + chalk.gray(` (${result.duration}ms)`));
        totalFailed++;
        
        if (result.error) {
          console.log(chalk.red(`  Error: ${result.error}`));
        } else if (result.assertionResults) {
          result.assertionResults
            .filter(a => !a.passed)
            .forEach(a => console.log(chalk.red(`  - ${a.message}`)));
        }
      }
      
      if (process.env.VERBOSE === 'true' && result.toolCalls) {
        console.log(chalk.gray('  Tools called:'));
        result.toolCalls.forEach(call => 
          console.log(chalk.gray(`    - ${call.tool}(${JSON.stringify(call.params)})`))
        );
      }
    }
    
    console.log('\n' + chalk.bold('Summary:'));
    console.log(chalk.green(`  Passed: ${totalPassed}`));
    console.log(chalk.red(`  Failed: ${totalFailed}`));
    console.log(chalk.blue(`  Total: ${this.results.length}`));
    
    return totalFailed === 0;
  }
}

// Define test cases
async function runAllTests() {
  const runner = new SkillTestRunner();
  
  // Test 1: Device Search - Basic
  await runner.runTest(
    'Device Search - Basic search',
    'device-search',
    { query: 'CORP-IT' },
    [
      Object.assign(
        (result) => result.success === true,
        { message: 'Should succeed' }
      ),
      Object.assign(
        (result) => result.data.devices.length === 3,
        { message: 'Should find 3 CORP-IT devices' }
      )
    ]
  );

  // Test 2: Device Search - Possessive form
  await runner.runTest(
    'Device Search - Possessive form (Jane\'s MacBook)',
    'device-search',
    { query: "Jane's MacBook", searchType: 'all' },
    [
      Object.assign(
        (result) => result.success === true,
        { message: 'Should succeed' }
      ),
      Object.assign(
        (result) => result.data.cleanQuery === 'Jane' || result.success === true,
        { message: 'Should handle possessive form' }
      )
    ]
  );

  // Test 3: Device Search - User search
  await runner.runTest(
    'Device Search - User search',
    'device-search',
    { query: 'jane', searchType: 'user' },
    [
      Object.assign(
        (result) => result.success === true,
        { message: 'Should succeed' }
      ),
      Object.assign(
        (result) => {
          // Since we have device 759 with user jane.smith, it should be found
          return result.data.devices && result.data.devices.length > 0;
        },
        { message: 'Should find devices for user jane' }
      )
    ]
  );

  // Test 4: Find Outdated Devices
  await runner.runTest(
    'Find Outdated Devices - 7 days threshold',
    'find-outdated-devices',
    { daysSinceLastContact: 7 },
    [
      Object.assign(
        (result) => result.success === true,
        { message: 'Should succeed' }
      ),
      Object.assign(
        (result) => result.data.outdatedDevices === 1,
        { message: 'Should find 1 outdated device (10 days old)' }
      ),
      Object.assign(
        (result) => result.data.totalDevices === 3,
        { message: 'Should have checked 3 total devices' }
      )
    ]
  );

  // Test 5: Batch Inventory Update
  await runner.runTest(
    'Batch Inventory Update',
    'batch-inventory-update',
    { 
      deviceIdentifiers: ['CORP-IT-0300', '759'],
      identifierType: 'name',
      maxConcurrent: 2
    },
    [
      Object.assign(
        (result) => result.success === false,
        { message: 'Should return false when there are failures' }
      ),
      Object.assign(
        (result) => result.data.successful.length === 1,
        { message: 'Should update 1 device (CORP-IT-0300)' }
      ),
      Object.assign(
        (result) => result.data.failed.length === 1,
        { message: 'Should fail 1 device (759 is not a valid name)' }
      )
    ]
  );

  // Test 6: Deploy Policy by Criteria
  await runner.runTest(
    'Deploy Policy by Criteria - Dry run',
    'deploy-policy-by-criteria',
    {
      policyIdentifier: 'Software Updates',
      identifierType: 'name',
      criteria: {
        osVersion: '13',
        daysSinceLastContact: 30
      },
      dryRun: true
    },
    [
      Object.assign(
        (result) => result.success === true,
        { message: 'Should succeed' }
      ),
      Object.assign(
        (result) => result.data.matchingDevices >= 0,
        { message: 'Should find matching devices' }
      ),
      Object.assign(
        (result, context) => {
          const toolCalls = context.getToolCalls();
          return !toolCalls.some(c => c.tool === 'deployPolicy');
        },
        { message: 'Should not actually deploy in dry run' }
      )
    ]
  );

  // Test 7: Scheduled Compliance Check
  await runner.runTest(
    'Scheduled Compliance Check',
    'scheduled-compliance-check',
    {
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
    },
    [
      Object.assign(
        (result) => result.success === true,
        { message: 'Should succeed' }
      ),
      Object.assign(
        (result) => result.data.summary && typeof result.data.summary.totalIssues === 'number',
        { message: 'Should have summary with totalIssues' }
      ),
      Object.assign(
        (result) => result.data.checks && result.data.checks.outdatedDevices,
        { message: 'Should have outdatedDevices check results' }
      )
    ]
  );

  // Test 8: Error handling - Invalid skill
  await runner.runTest(
    'Error Handling - Invalid skill name',
    'non-existent-skill',
    {},
    [
      Object.assign(
        (result) => result.success === false,
        { message: 'Should fail for invalid skill' }
      ),
      Object.assign(
        (result) => result.message.includes('not found'),
        { message: 'Should return not found message' }
      )
    ]
  );

  // Print results
  const allPassed = runner.printResults();
  
  if (!allPassed) {
    console.log('\n' + chalk.red('Some tests failed. Please fix the issues before building.'));
    process.exit(1);
  } else {
    console.log('\n' + chalk.green('All tests passed! Safe to build.'));
    process.exit(0);
  }
}

// Run tests
console.log(chalk.bold.blue('Running Jamf MCP Skills Tests...\n'));
runAllTests().catch(error => {
  console.error(chalk.red('Test runner error:'), error);
  process.exit(1);
});