#!/usr/bin/env node

// Test script for configuration profiles
const { JamfApiClientHybrid } = require('./dist/jamf-client-hybrid');
const { JamfApiClientClassic } = require('./dist/jamf-client-classic');
const { JamfApiClientUnified } = require('./dist/jamf-client-unified');

async function testConfigProfiles(client, clientName) {
  console.log(`\n===== Testing ${clientName} =====`);
  
  try {
    // Test listing computer configuration profiles
    console.log('\nListing computer configuration profiles...');
    const computerProfiles = await client.listConfigurationProfiles('computer');
    console.log(`Found ${computerProfiles.length} computer configuration profiles`);
    
    if (computerProfiles.length > 0) {
      console.log('First profile:', {
        id: computerProfiles[0].id,
        name: computerProfiles[0].name,
      });
      
      // Test getting profile details
      const profileId = computerProfiles[0].id;
      console.log(`\nGetting details for profile ${profileId}...`);
      const profileDetails = await client.getConfigurationProfileDetails(profileId, 'computer');
      console.log('Profile details retrieved successfully');
      console.log('Profile name:', profileDetails.name || profileDetails.general?.name);
    }
    
    // Test listing mobile device configuration profiles
    console.log('\nListing mobile device configuration profiles...');
    const mobileProfiles = await client.listConfigurationProfiles('mobiledevice');
    console.log(`Found ${mobileProfiles.length} mobile device configuration profiles`);
    
  } catch (error) {
    console.error(`Error in ${clientName}:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

async function main() {
  // Get config from environment or command line
  const config = {
    baseUrl: process.env.JAMF_BASE_URL || process.argv[2],
    clientId: process.env.JAMF_CLIENT_ID,
    clientSecret: process.env.JAMF_CLIENT_SECRET,
    username: process.env.JAMF_USERNAME,
    password: process.env.JAMF_PASSWORD,
    readOnlyMode: true,
  };
  
  if (!config.baseUrl) {
    console.error('Usage: node test-config-profiles.js <JAMF_BASE_URL>');
    console.error('Or set environment variables: JAMF_BASE_URL, JAMF_CLIENT_ID, JAMF_CLIENT_SECRET, JAMF_USERNAME, JAMF_PASSWORD');
    process.exit(1);
  }
  
  console.log('Testing configuration profiles with Jamf instance:', config.baseUrl);
  
  // Test Hybrid client
  if ((config.clientId && config.clientSecret) || (config.username && config.password)) {
    const hybridClient = new JamfApiClientHybrid(config);
    await testConfigProfiles(hybridClient, 'Hybrid Client');
  }
  
  // Test Classic client (OAuth2 only)
  if (config.clientId && config.clientSecret) {
    const classicClient = new JamfApiClientClassic({
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      readOnlyMode: true,
    });
    await testConfigProfiles(classicClient, 'Classic Client');
  }
  
  // Test Unified client
  if ((config.clientId && config.clientSecret) || (config.username && config.password)) {
    const unifiedClient = new JamfApiClientUnified(config);
    await testConfigProfiles(unifiedClient, 'Unified Client');
  }
}

main().catch(console.error);