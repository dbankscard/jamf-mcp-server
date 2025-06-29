# Debugging Instructions for Jamf MCP Date Parsing Issue

## Overview

The compliance check is showing all devices as "Unknown" because the date parsing was failing. I've implemented a fix that uses the robust `parseJamfDate` function which handles various date formats from Jamf.

## What Changed

1. **Updated `src/tools/index-compat.ts`**:
   - Added import for `parseJamfDate` function
   - Modified the compliance check to use this function instead of basic Date parsing
   - Added debug logging for the first 3 devices to help diagnose issues

## How to Test

### Method 1: Using MCP Inspector (Recommended)

1. Set up your environment variables:
   ```bash
   export JAMF_URL="https://your-instance.jamfcloud.com"
   export JAMF_USERNAME="your-api-username"
   export JAMF_PASSWORD="your-api-password"
   export JAMF_READ_ONLY=true
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Run the MCP Inspector:
   ```bash
   npm run inspector
   ```

4. In the Inspector UI:
   - First, test `searchDevices` with an empty query to see raw date formats:
     ```json
     {
       "query": "",
       "limit": 5
     }
     ```
   
   - Then test `getDeviceDetails` on one of the returned device IDs:
     ```json
     {
       "deviceId": "123"
     }
     ```
   
   - Finally, test `checkDeviceCompliance`:
     ```json
     {
       "days": 30,
       "includeDetails": true
     }
     ```

### Method 2: Direct Testing with Claude

1. Configure Claude to use your MCP server:
   - The server path should be: `/Users/dwight/jamf-mcp/jamf-mcp-server/dist/index.js`
   - Set the required environment variables in Claude's MCP configuration

2. Ask Claude to:
   - "Search for devices using an empty query"
   - "Get device details for device ID [xyz]"
   - "Check device compliance for the last 30 days"

## What to Look For

### In the Debug Output (stderr)

When you run `checkDeviceCompliance`, you'll see debug output for the first 3 devices:
```
Debug - Device MacBook Pro:
  Raw date value: 1735074420
  Parsed date: 2024-12-24T22:27:00.000Z
```

This will show you:
- The raw date value from Jamf (could be epoch timestamp, string, etc.)
- The parsed ISO date string (or "null" if parsing failed)

### Expected Date Formats

The `parseJamfDate` function handles these formats:
1. **Epoch timestamps**: `1735074420` (seconds) or `1735074420000` (milliseconds)
2. **Jamf string format**: `"2024-12-24 18:27:00"`
3. **ISO format**: `"2024-12-24T18:27:00Z"`
4. **Null/undefined**: Returns null for missing dates

### Troubleshooting

If devices are still showing as "Unknown":

1. Check the debug output to see what raw date values are being returned
2. Look for any error messages in the console
3. Verify that your Jamf instance is returning date fields in the expected locations:
   - `last_contact_time_epoch`
   - `last_contact_time`
   - `last_contact_time_utc`
   - `lastContactTime`

4. If none of these fields exist, you may need to check the full device data structure to find where dates are stored in your Jamf version

## Additional Debugging

If you need more detailed debugging:

1. Run the test script I created:
   ```bash
   npx tsx test-dates.ts
   ```
   (Note: This requires setting up a .env file with your Jamf credentials)

2. Or modify the debug logging in `index-compat.ts` to log the full computer object:
   ```typescript
   console.error(`Full computer data:`, JSON.stringify(computer, null, 2));
   ```

## The Fix Explained

The original code was trying to parse dates with the basic JavaScript `Date` constructor:
```typescript
lastContact = new Date(lastContactStr);
```

This fails for Jamf's "YYYY-MM-DD HH:MM:SS" format.

The new code uses `parseJamfDate` which:
1. Detects the date format (epoch, string, ISO)
2. Properly converts epoch timestamps (handling both seconds and milliseconds)
3. Parses Jamf's custom date string format
4. Returns null for invalid/missing dates instead of failing

This should resolve the "Unknown" status for all devices with valid date data.