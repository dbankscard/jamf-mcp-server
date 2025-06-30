# Jamf Pro MCP Server

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.0.0-purple)](https://github.com/modelcontextprotocol/sdk)

An MCP (Model Context Protocol) server that enables AI assistants to interact with Jamf Pro for Apple device management tasks.

![Tests](https://github.com/dbankscard/jamf-mcp-server/actions/workflows/test.yml/badge.svg)

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
- **searchDevices**: Find devices by name, serial number, IP address, or username
- **getDeviceDetails**: Retrieve comprehensive device information
- **checkDeviceCompliance**: Find devices that haven't reported in X days (optimized for large fleets)
- **getDevicesBatch**: Get details for multiple devices efficiently
- **updateInventory**: Force inventory update on devices

#### Policy Management
- **listPolicies**: List all policies in Jamf Pro
- **getPolicyDetails**: Get detailed information about a specific policy including scope, scripts, and packages
- **searchPolicies**: Search for policies by name or ID
- **executePolicy**: Run policies on specific devices (with confirmation)

#### Script Management
- **deployScript**: Execute scripts for troubleshooting (with confirmation)

### Resources (Read-Only Data)
- **jamf://inventory/computers**: Paginated device list
- **jamf://reports/compliance**: Security and patch compliance report
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
        "JAMF_READ_ONLY": "false"
      }
    }
  }
}
```

## Usage Examples

### Search for a Device
```
Can you find John Smith's MacBook?
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
```

## Safety Features

- **Read-Only Mode**: Set `JAMF_READ_ONLY=true` to prevent any modifications
- **Confirmation Required**: Destructive operations require explicit confirmation
- **Error Handling**: Comprehensive error messages and recovery
- **Rate Limiting**: Respects Jamf Pro API limits
- **Audit Trail**: All operations are logged

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