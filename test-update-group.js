#!/usr/bin/env node

import axios from 'axios';
import https from 'https';

const JAMF_URL = process.env.JAMF_URL;
const JAMF_USERNAME = process.env.JAMF_USERNAME;
const JAMF_PASSWORD = process.env.JAMF_PASSWORD;

if (!JAMF_URL || !JAMF_USERNAME || !JAMF_PASSWORD) {
  console.error('Missing required environment variables');
  process.exit(1);
}

async function getBearerToken() {
  try {
    const auth = Buffer.from(`${JAMF_USERNAME}:${JAMF_PASSWORD}`).toString('base64');
    
    const response = await axios.post(
      `${JAMF_URL}/api/v1/auth/token`,
      null,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      }
    );

    return response.data.token;
  } catch (error) {
    console.error('Failed to get bearer token:', error.message);
    return null;
  }
}

async function testUpdateGroup() {
  const token = await getBearerToken();
  if (!token) {
    console.error('No token available');
    return;
  }

  const groupId = '16';
  const computerIds = ['515', '755', '759'];

  console.log('Testing different update methods for group', groupId);
  
  // Test 1: JSON format with explicit headers
  try {
    console.log('\n1. Testing JSON format...');
    const payload = {
      computer_group: {
        name: 'Excluded Computers - Static',
        is_smart: false,
        computers: computerIds.map(id => ({ id: parseInt(id) }))
      }
    };
    
    const response = await axios.put(
      `${JAMF_URL}/JSSResource/computergroups/id/${groupId}`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      }
    );
    
    console.log('✅ JSON format worked!');
    console.log('Response:', response.status, response.statusText);
  } catch (error) {
    console.log('❌ JSON format failed:', error.response?.status, error.response?.statusText);
    console.log('Error details:', error.response?.data || error.message);
  }

  // Test 2: XML format
  try {
    console.log('\n2. Testing XML format...');
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<computer_group>
  <name>Excluded Computers - Static</name>
  <is_smart>false</is_smart>
  <computers>
    ${computerIds.map(id => `<computer><id>${id}</id></computer>`).join('\n    ')}
  </computers>
</computer_group>`;
    
    const response = await axios.put(
      `${JAMF_URL}/JSSResource/computergroups/id/${groupId}`,
      xmlPayload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/xml',
          'Accept': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      }
    );
    
    console.log('✅ XML format worked!');
    console.log('Response:', response.status, response.statusText);
  } catch (error) {
    console.log('❌ XML format failed:', error.response?.status, error.response?.statusText);
    console.log('Error details:', error.response?.data || error.message);
  }

  // Test 3: Get current group to see format
  try {
    console.log('\n3. Getting current group details...');
    const response = await axios.get(
      `${JAMF_URL}/JSSResource/computergroups/id/${groupId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      }
    );
    
    console.log('Current group structure:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('Failed to get group:', error.message);
  }
}

testUpdateGroup().catch(console.error);