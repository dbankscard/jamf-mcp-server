# Jamf Pro MCP Server

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.0.0-purple)](https://github.com/modelcontextprotocol/sdk)

A comprehensive MCP (Model Context Protocol) server that enables AI assistants to interact with Jamf Pro for complete Apple device management, including computers, mobile devices, policies, scripts, configuration profiles, packages, and reporting.

![Tests](https://github.com/dbankscard/jamf-mcp-server/actions/workflows/test.yml/badge.svg)

## 🔐 Security Notice

**IMPORTANT**: Before using this server:
1. Copy `.env.example` to `.env` and fill in your credentials
2. Never commit `.env` or any files containing credentials
3. Review and update any shell scripts with your own credentials
4. If credentials were accidentally exposed, rotate them immediately

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/dbankscard/jamf-mcp-server.git
cd jamf-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

Configure your credentials in Claude Desktop (see Configuration section below).

## Features

### Tools (Executable Functions)

#### Device Management
- **searchDevices**: Find devices by name, serial number, IP address, or username (supports partial matching)
- **getDeviceDetails**: Retrieve comprehensive device information by ID or name
- **checkDeviceCompliance**: Find devices that haven't reported in X days (optimized for large fleets)
- **getDevicesBatch**: Get details for multiple devices efficiently
- **updateInventory**: Force inventory update on devices

#### Policy Management
- **listPolicies**: List all policies in Jamf Pro
- **getPolicyDetails**: Get detailed information about a specific policy by ID or name (includes scope, scripts with full content, and packages - you can see exactly what scripts and packages are attached to any policy)
- **searchPolicies**: Search for policies by name or ID (supports partial matching)
- **executePolicy**: Run policies on specific devices (policy and device can be specified by ID or name, requires confirmation)

#### Script Management
- **deployScript**: Execute scripts for troubleshooting (with confirmation)
- **getScriptDetails**: Get full script content and metadata including parameters, notes, and OS requirements

#### Configuration Profile Management
- **listConfigurationProfiles**: List all configuration profiles (computer or mobile device)
- **getConfigurationProfileDetails**: Get detailed information about a specific configuration profile
- **searchConfigurationProfiles**: Search for configuration profiles by name
- **deployConfigurationProfile**: Deploy a configuration profile to one or more devices (with confirmation)
- **removeConfigurationProfile**: Remove a configuration profile from one or more devices (with confirmation)

#### Package Management
- **listPackages**: List all packages with name, version, category, and size
- **getPackageDetails**: Get detailed package information including metadata, requirements, and notes
- **searchPackages**: Search packages by name, filename, or category
- **getPackageDeploymentHistory**: Get deployment history and statistics for a package
- **getPoliciesUsingPackage**: Find all policies that use a specific package

#### Computer Group Management
- **listComputerGroups**: List computer groups (smart groups, static groups, or all)
- **getComputerGroupDetails**: Get detailed information about a specific group including membership and smart group criteria
- **searchComputerGroups**: Search for computer groups by name
- **getComputerGroupMembers**: Get all members of a specific computer group
- **createStaticComputerGroup**: Create a new static computer group with specified members (with confirmation)
- **updateStaticComputerGroup**: Update the membership of a static computer group (with confirmation)
- **deleteComputerGroup**: Delete a computer group (with confirmation)

#### Mobile Device Management
- **searchMobileDevices**: Search for mobile devices by name, serial number, UDID, or other criteria
- **getMobileDeviceDetails**: Get detailed information about a specific mobile device including hardware, OS, battery, and management status
- **listMobileDevices**: List all mobile devices in Jamf Pro with basic information
- **updateMobileDeviceInventory**: Force an inventory update on a specific mobile device
- **sendMDMCommand**: Send MDM commands to mobile devices (lock, wipe, clear passcode, etc.) with confirmation for destructive actions
- **listMobileDeviceGroups**: List mobile device groups (smart groups, static groups, or all)
- **getMobileDeviceGroupDetails**: Get detailed information about a specific mobile device group including membership and criteria

### Resources (Read-Only Data)
- **jamf://inventory/computers**: Paginated device list
- **jamf://inventory/mobile-devices**: Paginated mobile device list
- **jamf://reports/compliance**: Security and patch compliance report
- **jamf://reports/mobile-device-compliance**: Mobile device compliance report showing management status and issues
- **jamf://reports/storage**: Disk usage analytics
- **jamf://reports/os-versions**: OS version breakdown

### Prompts (Workflow Templates)
- **troubleshoot-device**: Step-by-step device troubleshooting
- **deploy-software**: Software deployment workflow
- **compliance-check**: Comprehensive compliance reporting
- **mass-update**: Bulk device operations
- **storage-cleanup**: Disk space management

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   cd jamf-mcp-server
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

### Setting up Jamf Pro API Authentication

1. In Jamf Pro, go to **Settings** > **System** > **API Roles and Clients**
2. Create a new API Role with necessary permissions
3. Create a new API Client:
   - Assign the API Role you created
   - Note the Client ID and generate a Client Secret
4. Use these credentials in your environment variables

### Claude Desktop Configuration

Add to your Claude Desktop config file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jamf-pro": {
      "command": "node",
      "args": ["/absolute/path/to/jamf-mcp-server/dist/index.js"],
      "env": {
        "JAMF_URL": "https://your-instance.jamfcloud.com",
        "JAMF_CLIENT_ID": "your-api-client-id",
        "JAMF_CLIENT_SECRET": "your-api-client-secret",
        "JAMF_READ_ONLY": "false",
        "JAMF_USE_ENHANCED_MODE": "true",
        "JAMF_DEBUG_MODE": "false"
      }
    }
  }
}
```

## Usage Examples

> **Note**: Most tools support searching by both ID and name. When searching by name, partial matches are supported. For example, you can search for "Chrome" to find all items containing that word in their name.

### Search for a Device
```
Can you find John Smith's MacBook?
Search for device GH-IT-0322
Find devices with "Marketing" in the name
```

### Check Device Details
```
Show me the details for device ID 123
```

### Check Device Compliance (NEW - Optimized)
```
Show me all devices that haven't reported in 30 days
```
This will use the new `checkDeviceCompliance` tool which efficiently processes all devices and provides:
- Summary statistics (compliant/non-compliant/unknown)
- Critical devices (90+ days)
- Warning devices (30-90 days)
- Optional detailed device list

### Policy Analysis - See Scripts and Packages
```
What packages are deployed by the 'Software Install' policy?
```

```
Show me the scripts that run in the 'Weekly Maintenance' policy
```

```
Get full details for policy 'macOS Updates' including all scripts and packages
```

### Configuration Profile Management
```
List all computer configuration profiles
```

```
Search for WiFi configuration profiles
```

```
Deploy configuration profile ID 5 to devices 123, 456, and 789
```

```
Remove mobile device configuration profile ID 10 from device 999
```

### Batch Device Operations (NEW)
```
Get details for devices 123, 456, and 789
```

### Deploy Software
```
Install Slack on all marketing team Macs
```

### Storage Analysis
```
Which devices have less than 10GB free space?
```

### Policy Operations (NEW)
```
List all policies
Show me all security-related policies
Get details for policy ID 123
Search for policies containing "update"
Get policy details with full script content
```

### Script Operations (NEW)
```
Get the content of script ID 42
Show me what script 123 does
Get policy 456 details including the actual script code
```

### Package Management (NEW)
```
List all packages
Search for packages containing "Office"
Get details for package ID 15
Show me the deployment history for package ID 20
Which policies use package ID 25?
Find all policies that deploy Chrome
```

### Computer Group Management (NEW)
```
List all computer groups
Show me only smart groups
Search for groups containing "marketing"
Get details for computer group ID 10
Show me all members of the "Executive Laptops" group
Create a static group called "Project Alpha" with computers 123, 456, and 789
Update the "Deployment Test" group to include computers 111, 222, and 333
Delete computer group ID 99
```

### Mobile Device Management (NEW)
```
Search for iPads
List all mobile devices
Get details for mobile device ID 456
Search for devices with serial number ABC123
Update inventory for mobile device 789
Lock mobile device 123
Wipe mobile device 456 (requires confirmation)
Clear passcode for device 789 (requires confirmation)
Enable Lost Mode on device 321
List all mobile device groups
Get details for mobile device group ID 15
Show me smart mobile device groups
```

### Supported MDM Commands
The following MDM commands are supported for mobile devices:
- **DeviceLock**: Lock the device immediately
- **EraseDevice**: Wipe the device (requires confirmation)
- **ClearPasscode**: Remove device passcode (requires confirmation)
- **RestartDevice**: Restart the device
- **ShutDownDevice**: Shut down the device
- **EnableLostMode**: Enable Lost Mode
- **DisableLostMode**: Disable Lost Mode
- **PlayLostModeSound**: Play sound on lost device
- **UpdateInventory**: Force inventory update
- **ClearRestrictionsPassword**: Clear restrictions password (requires confirmation)
- **Settings Commands**: Enable/disable Bluetooth, WiFi, Data Roaming, Voice Roaming, Personal Hotspot

## Safety Features

- **Read-Only Mode**: Set `JAMF_READ_ONLY=true` to prevent any modifications
- **Confirmation Required**: Destructive operations require explicit confirmation
- **Error Handling**: Comprehensive error messages and recovery
- **Rate Limiting**: Respects Jamf Pro API limits
- **Audit Trail**: All operations are logged

## Enhanced Error Handling (v1.1.0)

The server now includes comprehensive error handling and retry logic:

### Features
- **Automatic Retry**: Exponential backoff for transient failures
- **Circuit Breaker**: Prevents cascading failures
- **Enhanced Error Messages**: Detailed error information with actionable suggestions
- **Request/Response Logging**: Debug mode for troubleshooting
- **Rate Limiting**: Built-in rate limiter to prevent API throttling

### Configuration
Add these optional environment variables to your Claude Desktop config:

```json
{
  "env": {
    "JAMF_USE_ENHANCED_MODE": "true",      // Enable enhanced features (default: false)
    "JAMF_MAX_RETRIES": "3",               // Max retry attempts (default: 3)
    "JAMF_RETRY_DELAY": "1000",            // Initial retry delay in ms (default: 1000)
    "JAMF_RETRY_MAX_DELAY": "10000",       // Max retry delay in ms (default: 10000)
    "JAMF_DEBUG_MODE": "false",            // Enable debug logging (default: false)
    "JAMF_ENABLE_RETRY": "true",           // Enable automatic retries (default: true)
    "JAMF_ENABLE_RATE_LIMITING": "false",  // Enable rate limiting (default: false)
    "JAMF_ENABLE_CIRCUIT_BREAKER": "false" // Enable circuit breaker (default: false)
  }
}
```

### Error Types
The enhanced mode provides specific error types with helpful suggestions:
- **JamfAPIError**: General API errors with status codes and suggestions
- **NetworkError**: Connection issues with network troubleshooting tips
- **AuthenticationError**: Auth failures with credential verification steps
- **RateLimitError**: Rate limit errors with retry timing
- **ValidationError**: Input validation errors with field-specific feedback

See [docs/ERROR_HANDLING.md](docs/ERROR_HANDLING.md) for detailed documentation.

## Development

### Local Development Setup

For local development without Claude Desktop, create a `.env` file:

```bash
cp .env.example .env
# Edit .env with your Jamf Pro credentials:
# JAMF_URL=https://your-instance.jamfcloud.com
# JAMF_CLIENT_ID=your-api-client-id
# JAMF_CLIENT_SECRET=your-api-client-secret
# JAMF_READ_ONLY=false
```

### Running in Development Mode
```bash
npm run dev
```

### Testing with MCP Inspector
```bash
npm run inspector
```

### Running Tests
```bash
npm test
```

## API Requirements

This server requires:
- Jamf Pro version 10.35.0 or later
- API user with appropriate permissions
- Network access to your Jamf Pro instance

### Recommended API Permissions

For full functionality:
- Read access to computers, policies, scripts
- Update access for inventory updates
- Execute access for policies and scripts

For read-only mode:
- Read access to computers only

## Troubleshooting

### Authentication Issues
- Verify your API credentials
- Ensure the API user has the required permissions
- Check network connectivity to Jamf Pro

### Tool Execution Failures
- Verify device IDs are correct
- Ensure policies/scripts exist in Jamf Pro
- Check that devices are online and managed

### Performance
- Large inventory requests may take time
- Use search filters to limit results
- Consider implementing pagination for large datasets

### Configuration Profiles
- The Classic API returns computer configuration profiles under `os_x_configuration_profiles` (with underscores)
- Mobile device profiles are returned under `configuration_profiles`
- Profile details use `os_x_configuration_profile` (singular) for computers
- The API clients handle these field name variations automatically

## Security Considerations

- Store credentials securely (use environment variables)
- Use read-only mode when write access isn't needed
- Regularly rotate API credentials
- Monitor API usage for anomalies
- Implement IP allowlisting in Jamf Pro if possible

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT


[![MCP Badge](https://lobehub.com/badge/mcp/dbanks-gh-jamf-mcp-server)](https://lobehub.com/mcp/dbanks-gh-jamf-mcp-server)
