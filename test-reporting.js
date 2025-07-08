#!/usr/bin/env node

/**
 * Test script for the new reporting and analytics features
 * This demonstrates how the new methods can be used
 */

import { JamfApiClientHybrid } from './dist/jamf-client-hybrid.js';

// Configuration - replace with your actual Jamf instance details
const config = {
  baseUrl: process.env.JAMF_BASE_URL || 'https://your-instance.jamfcloud.com',
  username: process.env.JAMF_USERNAME,
  password: process.env.JAMF_PASSWORD,
  clientId: process.env.JAMF_CLIENT_ID,
  clientSecret: process.env.JAMF_CLIENT_SECRET,
  readOnlyMode: true,
};

async function testReportingFeatures() {
  try {
    console.log('🚀 Testing Jamf MCP Server Reporting Features\n');
    
    // Initialize client
    const client = new JamfApiClientHybrid(config);
    
    // Test 1: Get Inventory Summary
    console.log('📊 Test 1: Getting Inventory Summary...');
    try {
      const inventorySummary = await client.getInventorySummary();
      console.log('✅ Inventory Summary:');
      console.log(`   Total Computers: ${inventorySummary.summary.totalComputers}`);
      console.log(`   Total Mobile Devices: ${inventorySummary.summary.totalMobileDevices}`);
      console.log(`   Total Devices: ${inventorySummary.summary.totalDevices}`);
      console.log(`   Top OS Versions: ${inventorySummary.computers.osVersionDistribution.slice(0, 3).map(v => `${v.version} (${v.percentage}%)`).join(', ')}`);
      console.log('');
    } catch (error) {
      console.error('❌ Failed to get inventory summary:', error.message);
    }
    
    // Test 2: Get Device Compliance Summary
    console.log('🔒 Test 2: Getting Device Compliance Summary...');
    try {
      const complianceSummary = await client.getDeviceComplianceSummary();
      console.log('✅ Device Compliance Summary:');
      console.log(`   Total Devices: ${complianceSummary.summary.totalDevices}`);
      console.log(`   Compliant Devices: ${complianceSummary.summary.compliantDevices} (${complianceSummary.summary.complianceRate}%)`);
      console.log(`   Devices Checked In Today: ${complianceSummary.checkInStatus.today.count}`);
      console.log(`   Devices Not Seen This Week: ${complianceSummary.checkInStatus.notSeenThisWeek.count}`);
      if (complianceSummary.recommendations.immediate) {
        console.log(`   ⚠️  ${complianceSummary.recommendations.immediate}`);
      }
      console.log('');
    } catch (error) {
      console.error('❌ Failed to get device compliance summary:', error.message);
    }
    
    // Test 3: Get Policy Compliance Report (requires a policy ID)
    console.log('📋 Test 3: Getting Policy Compliance Report...');
    console.log('   Note: This requires a valid policy ID. Skipping in demo mode.');
    console.log('   Example usage: await client.getPolicyComplianceReport("123");');
    console.log('');
    
    // Test 4: Get Package Deployment Statistics (requires a package ID)
    console.log('📦 Test 4: Getting Package Deployment Statistics...');
    console.log('   Note: This requires a valid package ID. Skipping in demo mode.');
    console.log('   Example usage: await client.getPackageDeploymentStats("456");');
    console.log('');
    
    // Test 5: Get Software Version Report
    console.log('💿 Test 5: Getting Software Version Report...');
    try {
      const softwareReport = await client.getSoftwareVersionReport('Chrome');
      console.log('✅ Software Version Report for "Chrome":');
      console.log(`   Computers Checked: ${softwareReport.search.computersChecked}`);
      console.log(`   Computers with Software: ${softwareReport.results.computersWithSoftware}`);
      console.log(`   Unique Versions Found: ${softwareReport.results.uniqueVersions}`);
      console.log(`   Latest Version Detected: ${softwareReport.results.latestVersionDetected}`);
      if (softwareReport.recommendations.updateNeeded) {
        console.log(`   ⚠️  ${softwareReport.recommendations.message}`);
      }
      console.log('');
    } catch (error) {
      console.error('❌ Failed to get software version report:', error.message);
    }
    
    console.log('✨ Testing complete!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  testReportingFeatures().catch(console.error);
}