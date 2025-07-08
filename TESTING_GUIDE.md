# Testing Guide for Enhanced Jamf MCP Server

## Quick Start

1. **Restart Claude Desktop** to load the new build:
   - Quit Claude Desktop completely (Cmd+Q on macOS)
   - Relaunch Claude Desktop

2. **Test the new features** by asking Claude to:

### Configuration Profiles
```
List all configuration profiles
Search for profiles containing "wifi"
Get details for profile ID 123
Deploy profile 456 to devices 789,101 (requires confirmation)
```

### Package Management
```
List all packages
Search for packages containing "chrome"
Get package details for ID 42
Show deployment history for package 42
Find policies using package 42
```

### Smart Groups
```
List all computer groups
Show smart groups only
Get details for group ID 10
List members of group "Marketing Macs"
Create a static group with devices 1,2,3 (requires confirmation)
```

### Mobile Device Support
```
Search for John's iPad
List all mobile devices
Get details for mobile device 555
Send MDM command to lock device 555 (requires confirmation)
List mobile device groups
```

### Enhanced Error Handling
To test enhanced mode, set the environment variable before starting:
```bash
export JAMF_USE_ENHANCED_MODE=true
export JAMF_DEBUG_MODE=true
```

Then test:
- Trigger errors (invalid IDs, network issues)
- Watch for retry attempts in debug mode
- See enhanced error messages with suggestions

## Running Test Scripts

From the terminal:
```bash
cd /path/to/jamf-mcp-server

# Test all enhancements
node test-scripts/test-all-enhancements.js

# Test enhanced mode features
node test-scripts/test-enhanced-mode.js

# Run all tests
./test-scripts/run-all-tests.sh
```

## What to Look For

1. **New Tools Available**: Claude should now have access to 33+ new tools
2. **Better Error Messages**: Errors should include suggestions and context
3. **Retry Logic**: Failed requests should retry automatically (in enhanced mode)
4. **Mobile Device Support**: Full iOS/iPadOS device management
5. **Package & Profile Management**: Complete lifecycle management

## Troubleshooting

If features aren't working:
1. Check Claude Desktop was fully restarted
2. Verify environment variables are set correctly
3. Check the server logs in Claude Desktop
4. Run the test scripts to validate functionality

## Read-Only Safety

All destructive operations require:
1. `confirm: true` parameter
2. Read-only mode disabled (`JAMF_READ_ONLY=false`)

This ensures no accidental modifications to your Jamf environment.