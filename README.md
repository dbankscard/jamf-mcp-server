# Jamf Pro MCP Server

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.0.0-purple)](https://github.com/modelcontextprotocol/sdk)
[![MCP Badge](https://lobehub.com/badge/mcp-full/dbankscard-jamf-mcp-server)]

A comprehensive MCP (Model Context Protocol) server that enables AI assistants to interact with Jamf Pro for complete Apple device management. Works with Claude Desktop, Cody, and now **ChatGPT** (via MCP Connectors).

![Tests](https://github.com/dbankscard/jamf-mcp-server/actions/workflows/test.yml/badge.svg)

<p align="center">
  <img src="docs/images/chatgpt-apps-connectors-page.png" alt="ChatGPT MCP Connector" width="600">
</p>

## 🚀 Quick Start

### For ChatGPT Users (NEW!)
Connect ChatGPT to your Jamf Pro instance using natural language:

```bash
# Clone and run
git clone https://github.com/dbankscard/jamf-mcp-server.git
cd jamf-mcp-server
./start-chatgpt-poc.sh
```

See our [ChatGPT Quick Start Guide](QUICK_START.md) for 5-minute setup.

### For Claude Desktop Users
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

## 🎯 What You Can Do

### With ChatGPT (Beta)
Ask natural language questions about your Jamf devices:
- "Find all MacBooks that haven't checked in for 7 days"
- "Show me device compliance statistics"
- "Deploy software updates to the marketing team"
- "Generate a compliance report for all iOS devices"

**Powered by Skills**: Complex multi-step operations are handled automatically through our skills system, providing intelligent device search, batch operations, and automated workflows.
- "Search for devices assigned to the marketing department"
- "List computers with low disk space"

<p align="center">
  <img src="docs/images/chatgpt-jamf-query-example.png" alt="ChatGPT querying Jamf for a device" width="600">
</p>

### With Claude Desktop
Full device management capabilities including:
- Search and manage devices
- Deploy software and policies
- Manage configuration profiles
- Execute scripts and packages
- Generate compliance reports
- And much more...

## 🔐 Security Notice

**IMPORTANT**: Before using this server:
1. Copy `.env.example` to `.env` and fill in your credentials
2. Never commit `.env` or any files containing credentials
3. Review and update any shell scripts with your own credentials
4. If credentials were accidentally exposed, rotate them immediately

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
- **getPolicyDetails**: Get detailed information about a specific policy by ID or name (includes scope, scripts with full content, and packages)
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

### Skills (ChatGPT Integration)
Advanced multi-step operations powered by the skills system:
- **skill_device_search**: Intelligent device search with natural language processing
- **skill_find_outdated_devices**: Identify devices not checking in
- **skill_batch_inventory_update**: Update multiple devices efficiently
- **skill_deploy_policy_by_criteria**: Deploy policies based on device criteria
- **skill_scheduled_compliance_check**: Automated compliance reporting

### Prompts (Workflow Templates)
- **troubleshoot-device**: Step-by-step device troubleshooting
- **deploy-software**: Software deployment workflow
- **compliance-check**: Comprehensive compliance reporting
- **mass-update**: Bulk device operations
- **storage-cleanup**: Disk space management

## Installation

### For ChatGPT Users
See our detailed guides:
- [**Quick Start Guide**](QUICK_START.md) - Fork and deploy in 5 minutes
- [**Full Setup Guide**](CHATGPT_CONNECTOR_README.md) - Detailed setup instructions
- [**POC Setup**](PROOF_OF_CONCEPT_SETUP.md) - Local development with tunnels
- [**Architecture**](docs/CHATGPT_CONNECTOR_FLOW.md) - How it works
- [**Deployment Guide**](docs/CHATGPT_DEPLOYMENT.md) - Production deployment

### For Claude Desktop Users

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

### ChatGPT Configuration

For ChatGPT, you'll need to:
1. Set up a tunnel (Cloudflare or ngrok)
2. Configure the MCP connector in ChatGPT settings
3. Add your server URL and authentication

See [ChatGPT Connector Setup](CHATGPT_CONNECTOR_README.md) for detailed instructions.

## Usage Examples

> **Note**: Most tools support searching by both ID and name. When searching by name, partial matches are supported.

### Natural Language Queries (ChatGPT)
```
"Find all devices that haven't checked in for 30 days"
"Show me MacBooks with less than 10GB free space"
"Search for iPads in the marketing department"
"Get compliance statistics for our fleet"
```

### Direct Tool Usage (Claude Desktop)

#### Search for a Device
```
Can you find John Smith's MacBook?
Search for device GH-IT-0322
Find devices with "Marketing" in the name
```

#### Check Device Details
```
Show me the details for device ID 123
```

#### Check Device Compliance
```
Show me all devices that haven't reported in 30 days
```

#### Policy Analysis
```
What packages are deployed by the 'Software Install' policy?
Show me the scripts that run in the 'Weekly Maintenance' policy
Get full details for policy 'macOS Updates' including all scripts and packages
```

#### Configuration Profile Management
```
List all computer configuration profiles
Search for WiFi configuration profiles
Deploy configuration profile ID 5 to devices 123, 456, and 789
Remove mobile device configuration profile ID 10 from device 999
```

#### Package Management
```
List all packages
Search for packages containing "Office"
Get details for package ID 15
Show me the deployment history for package ID 20
Which policies use package ID 25?
```

#### Mobile Device Management
```
Search for iPads
List all mobile devices
Get details for mobile device ID 456
Lock mobile device 123
Enable Lost Mode on device 321
```

## 🏗️ Architecture

### ChatGPT Integration
```
ChatGPT MCP Connector ↔️ Tunnel (Cloudflare/ngrok) ↔️ MCP Server ↔️ Jamf Pro API
```

### Claude Desktop Integration
```
Claude Desktop ↔️ MCP Server (local) ↔️ Jamf Pro API
```

## Safety Features

- **Read-Only Mode**: Set `JAMF_READ_ONLY=true` to prevent any modifications
- **Confirmation Required**: Destructive operations require explicit confirmation
- **Error Handling**: Comprehensive error messages and recovery
- **Rate Limiting**: Respects Jamf Pro API limits
- **Audit Trail**: All operations are logged

## Enhanced Error Handling (v1.1.0)

The server includes comprehensive error handling and retry logic:

### Features
- **Automatic Retry**: Exponential backoff for transient failures
- **Circuit Breaker**: Prevents cascading failures
- **Enhanced Error Messages**: Detailed error information with actionable suggestions
- **Request/Response Logging**: Debug mode for troubleshooting
- **Rate Limiting**: Built-in rate limiter to prevent API throttling

### Configuration
Add these optional environment variables:

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

## Development

### Local Development Setup

For local development, create a `.env` file:

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
- Read access to computers, policies, scripts, configuration profiles, packages, mobile devices
- Update access for inventory updates
- Execute access for policies and scripts

For read-only mode:
- Read access to all resources only

## 🛡️ Security Considerations

### For Production Use
- Implement proper OAuth2 authentication (ChatGPT integration)
- Deploy to a secure cloud environment
- Use HTTPS with valid certificates
- Enable rate limiting and access controls
- Use read-only Jamf API credentials where possible
- Store credentials securely (use environment variables)
- Regularly rotate API credentials
- Monitor API usage for anomalies
- Implement IP allowlisting in Jamf Pro if possible

⚠️ **Note**: The ChatGPT POC uses development authentication for testing. For production use, implement proper security measures.

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

### ChatGPT Connection Issues
- Ensure your tunnel is running (Cloudflare/ngrok)
- Verify the MCP connector URL in ChatGPT settings
- Check server logs for connection errors

## 🤝 Contributing

Contributions are welcome! This project is designed to be forked and extended. Feel free to:
- Add new MCP tools for different Jamf operations
- Implement additional security features
- Create connectors for other MDM systems
- Improve ChatGPT integration
- Share your improvements with the community

Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📝 License

MIT

## 🔗 Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Jamf Pro API Documentation](https://developer.jamf.com/)
- [ChatGPT MCP Connectors](https://help.openai.com/en/articles/9824990-using-connectors-in-chatgpt)
- [Claude Desktop MCP Servers](https://modelcontextprotocol.io/clients/claude)

## 💬 Support

- [Create an Issue](https://github.com/dbankscard/jamf-mcp-server/issues)
- [View Documentation](docs/)
- [Fork this Repository](https://github.com/dbankscard/jamf-mcp-server/fork)

---

Built with ❤️ for the Jamf, Claude, and ChatGPT communities
