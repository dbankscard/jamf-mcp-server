#!/usr/bin/env node

/**
 * Test script for Jamf MCP script management features
 * This tests the new script management capabilities
 */

const { JamfApiClientHybrid } = require('./dist/jamf-client-hybrid.js');

// Configuration from environment variables
const config = {
  baseUrl: process.env.JAMF_BASE_URL,
  username: process.env.JAMF_USERNAME,
  password: process.env.JAMF_PASSWORD,
  clientId: process.env.JAMF_CLIENT_ID,
  clientSecret: process.env.JAMF_CLIENT_SECRET,
  readOnlyMode: false // Set to false for testing write operations
};

if (!config.baseUrl) {
  console.error('Please set JAMF_BASE_URL environment variable');
  process.exit(1);
}

if ((!config.username || !config.password) && (!config.clientId || !config.clientSecret)) {
  console.error('Please set either JAMF_USERNAME/JAMF_PASSWORD or JAMF_CLIENT_ID/JAMF_CLIENT_SECRET');
  process.exit(1);
}

async function testScriptManagement() {
  const client = new JamfApiClientHybrid(config);
  
  try {
    console.log('Testing Jamf MCP Script Management Features\n');
    
    // 1. List scripts
    console.log('1. Listing scripts...');
    const scripts = await client.listScripts(10);
    console.log(`Found ${scripts.length} scripts`);
    if (scripts.length > 0) {
      console.log('Sample script:', JSON.stringify(scripts[0], null, 2));
    }
    
    // 2. Search scripts
    console.log('\n2. Searching scripts...');
    const searchResults = await client.searchScripts('test', 5);
    console.log(`Found ${searchResults.length} scripts matching "test"`);
    
    // 3. Create a test script (only if not in read-only mode)
    if (!config.readOnlyMode) {
      console.log('\n3. Creating a test script...');
      const testScript = {
        name: `Test Script ${Date.now()}`,
        script_contents: `#!/bin/bash
# Test script created by Jamf MCP
echo "Hello from Jamf MCP!"
echo "Parameter 4: $4"
echo "Parameter 5: $5"
exit 0`,
        category: 'Testing',
        info: 'Test script created by Jamf MCP Server',
        notes: 'This is a test script for demonstrating script management capabilities',
        priority: 'After',
        parameters: {
          parameter4: 'Message to display',
          parameter5: 'Optional value'
        }
      };
      
      try {
        const createdScript = await client.createScript(testScript);
        console.log('Created script:', JSON.stringify({
          id: createdScript.id,
          name: createdScript.name,
          category: createdScript.category
        }, null, 2));
        
        // 4. Update the script
        console.log('\n4. Updating the script...');
        const updateData = {
          notes: 'Updated notes - Script was modified by Jamf MCP',
          parameters: {
            parameter4: 'Updated message parameter',
            parameter5: 'Updated optional value',
            parameter6: 'New parameter added'
          }
        };
        
        const updatedScript = await client.updateScript(createdScript.id, updateData);
        console.log('Updated script notes:', updatedScript.notes);
        console.log('Updated parameters:', JSON.stringify(updatedScript.parameters, null, 2));
        
        // 5. Get script details using existing method
        console.log('\n5. Getting script details...');
        const scriptDetails = await client.getScriptDetails(createdScript.id);
        console.log('Script details:', JSON.stringify({
          id: scriptDetails.id,
          name: scriptDetails.name,
          category: scriptDetails.category,
          info: scriptDetails.info,
          notes: scriptDetails.notes,
          parameters: scriptDetails.parameters
        }, null, 2));
        
        // 6. Delete the test script
        console.log('\n6. Deleting the test script...');
        await client.deleteScript(createdScript.id);
        console.log('Script deleted successfully');
        
      } catch (error) {
        console.error('Error during script operations:', error.message);
      }
    } else {
      console.log('\n(Skipping create/update/delete tests - read-only mode)');
    }
    
    // 7. Test searching for a specific script by ID
    if (scripts.length > 0) {
      console.log('\n7. Searching for script by ID...');
      const firstScriptId = scripts[0].id.toString();
      const searchById = await client.searchScripts(firstScriptId, 1);
      console.log(`Found ${searchById.length} script(s) with ID ${firstScriptId}`);
    }
    
    console.log('\n✅ Script management tests completed!');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
testScriptManagement();