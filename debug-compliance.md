# Debugging Jamf MCP Compliance Check

## The Issue

The compliance check is showing all devices as "Unknown" because the date parsing is failing. Here's what I found:

## Root Cause Analysis

1. **Date Field Confusion**: The Jamf Classic API returns date fields in different formats:
   - `last_contact_time`: String format like "2024-12-24 18:27:00"
   - `last_contact_time_utc`: UTC string format
   - `last_contact_time_epoch`: Unix timestamp (seconds since 1970)

2. **The Compliance Check Logic**: In `tools/index-compat.ts` (lines 292-310), the code tries to parse dates:
   ```typescript
   // Try multiple date fields
   const lastContactStr = computer.last_contact_time || 
                        computer.last_contact_time_utc || 
                        computer.lastContactTime;
   const lastContactEpoch = computer.last_contact_time_epoch;
   
   let lastContact: Date | null = null;
   
   if (lastContactEpoch) {
     // Handle epoch timestamp (seconds since 1970)
     lastContact = new Date(lastContactEpoch * 1000);
   } else if (lastContactStr) {
     // Try parsing the date string
     lastContact = new Date(lastContactStr);
     if (isNaN(lastContact.getTime())) {
       lastContact = null;
     }
   }
   ```

3. **The Problem**: The code doesn't use the `parseJamfDate` utility function that was specifically designed to handle various Jamf date formats.

## How to Test This

You can test the MCP server tools using the MCP Inspector. Here's how:

1. First, set up your environment variables:
   ```bash
   export JAMF_URL="https://your-instance.jamfcloud.com"
   export JAMF_USERNAME="your-api-username"
   export JAMF_PASSWORD="your-api-password"
   export JAMF_READ_ONLY=true
   ```

2. Run the MCP Inspector:
   ```bash
   npm run inspector
   ```

3. Test the searchDevices tool with an empty query:
   ```json
   {
     "query": "",
     "limit": 5
   }
   ```

4. Look at the raw response to see what date fields are actually being returned.

5. Then test getDeviceDetails on one of the device IDs:
   ```json
   {
     "deviceId": "123"
   }
   ```

## The Fix

The compliance check should be updated to use the `parseJamfDate` function from `jamf-client-classic.ts`. This function properly handles:
- Epoch timestamps (both seconds and milliseconds)
- String dates in "YYYY-MM-DD HH:MM:SS" format
- ISO date strings
- Null/undefined values

Here's what needs to be changed in `tools/index-compat.ts` around line 299:

```typescript
// Import the parseJamfDate function at the top
import { parseJamfDate } from '../jamf-client-classic.js';

// Then in the checkDeviceCompliance case:
const lastContact = parseJamfDate(
  computer.last_contact_time_epoch || 
  computer.last_contact_time || 
  computer.last_contact_time_utc
);
```

This will properly parse all the different date formats that Jamf returns.

## Manual Testing

To see the raw date values from your Jamf instance:

1. Use the searchDevices tool with an empty query
2. Check the raw JSON response for fields like:
   - `last_contact_time`
   - `last_contact_time_utc`
   - `last_contact_time_epoch`
   - `lastContactTime`

3. Use getDeviceDetails on specific devices to see the full date information in the `general` section

This will help you understand exactly what format your Jamf instance is returning dates in, and why the current parsing is failing.