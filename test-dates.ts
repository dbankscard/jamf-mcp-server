#!/usr/bin/env tsx

import { JamfApiClientClassic } from './src/jamf-client-classic.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const JAMF_URL = process.env.JAMF_URL;
const JAMF_USERNAME = process.env.JAMF_USERNAME;
const JAMF_PASSWORD = process.env.JAMF_PASSWORD;

if (!JAMF_URL || !JAMF_USERNAME || !JAMF_PASSWORD) {
  console.error('Missing required environment variables: JAMF_URL, JAMF_USERNAME, JAMF_PASSWORD');
  process.exit(1);
}

async function testDateFormats() {
  const client = new JamfApiClientClassic({
    baseUrl: JAMF_URL,
    username: JAMF_USERNAME,
    password: JAMF_PASSWORD,
    readOnlyMode: true,
  });

  try {
    console.log('Fetching devices with empty query to get all devices...\n');
    
    // First, search for devices (empty query should return all)
    const devices = await client.searchComputers('', 10); // Get first 10 devices
    
    console.log(`Found ${devices.length} devices\n`);
    
    // Show raw data for first few devices
    console.log('=== RAW DEVICE DATA FROM SEARCH ===');
    devices.slice(0, 3).forEach((device, index) => {
      console.log(`\nDevice ${index + 1}:`);
      console.log('ID:', device.id);
      console.log('Name:', device.name);
      console.log('Raw last_contact_time:', device.last_contact_time);
      console.log('Raw last_contact_time_utc:', device.last_contact_time_utc);
      console.log('Raw last_contact_time_epoch:', device.last_contact_time_epoch);
      console.log('Full raw data:', JSON.stringify(device, null, 2));
    });
    
    // Now get detailed info for 2-3 devices
    console.log('\n\n=== DETAILED DEVICE INFO ===');
    for (let i = 0; i < Math.min(3, devices.length); i++) {
      const device = devices[i];
      console.log(`\nFetching details for device: ${device.name} (ID: ${device.id})`);
      
      try {
        const details = await client.getComputerDetails(device.id.toString());
        
        console.log('\nGeneral section date fields:');
        if (details.general) {
          console.log('- last_contact_time:', details.general.last_contact_time);
          console.log('- last_contact_time_utc:', details.general.last_contact_time_utc);
          console.log('- last_contact_time_epoch:', details.general.last_contact_time_epoch);
          console.log('- report_date:', details.general.report_date);
          console.log('- report_date_utc:', details.general.report_date_utc);
          console.log('- report_date_epoch:', details.general.report_date_epoch);
        }
        
        console.log('\nFull general section:');
        console.log(JSON.stringify(details.general, null, 2));
        
      } catch (error) {
        console.error(`Failed to get details for device ${device.id}:`, error);
      }
    }
    
    // Test the date parsing function
    console.log('\n\n=== DATE PARSING TEST ===');
    const { parseJamfDate } = await import('./src/jamf-client-classic.js');
    
    const testDates = [
      1735074420,  // Epoch in seconds
      1735074420000,  // Epoch in milliseconds
      '2024-12-24 18:27:00',  // Jamf format
      '2024-12-24T18:27:00Z',  // ISO format
      '2024-12-24T18:27:00.000Z',  // ISO with milliseconds
      null,
      undefined,
      '',
    ];
    
    testDates.forEach(dateValue => {
      const parsed = parseJamfDate(dateValue);
      console.log(`\nInput: ${JSON.stringify(dateValue)}`);
      console.log(`Parsed: ${parsed ? parsed.toISOString() : 'null'}`);
    });
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testDateFormats();