# Jamf Pro MCP Server

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.0.0-purple)](https://github.com/modelcontextprotocol/sdk)
[![Tools](https://img.shields.io/badge/Tools-103-orange)]()
[![Resources](https://img.shields.io/badge/Resources-12-green)]()
[![Prompts](https://img.shields.io/badge/Prompts-12-blue)]()

A comprehensive MCP (Model Context Protocol) server that enables AI assistants to interact with Jamf Pro for complete Apple device management. Works with Claude Desktop, Cody, and **ChatGPT** (via MCP Connectors).

**103 tools** | **12 resources** | **12 workflow prompts** | **5 skills**

![Tests](https://github.com/dbankscard/jamf-mcp-server/actions/workflows/test.yml/badge.svg)

## Quick Start

### For Claude Desktop Users
```bash
git clone https://github.com/dbankscard/jamf-mcp-server.git
cd jamf-mcp-server
npm install
npm run build
```

Configure your credentials in Claude Desktop (see [Configuration](#configuration) below).

### For ChatGPT Users
```bash
git clone https://github.com/dbankscard/jamf-mcp-server.git
cd jamf-mcp-server
./start-chatgpt-poc.sh
```

See our [ChatGPT Quick Start Guide](QUICK_START.md) for 5-minute setup.

## What You Can Do

Ask natural language questions about your Jamf fleet:
- "How is my fleet doing?" — uses `getFleetOverview` for a single-call summary
- "Tell me about GH-ADM-0228" — uses `getDeviceFullProfile` to resolve by name, serial, or ID
- "What's our security posture?" — uses `getSecurityPosture` for encryption and compliance analysis
- "How is the Software Install policy performing?" — uses `getPolicyAnalysis` with auto-resolve by name
- "Find all devices that haven't checked in for 30 days"
- "Deploy software updates to the marketing team"
- "Retrieve the LAPS password for this device"
- "Show me patch compliance across the fleet"

## Tools (103)

### Compound Tools (Start Here)
These combine multiple API calls into a single operation:

- **getFleetOverview**: Comprehensive fleet summary — inventory counts, compliance rates, and mobile device status in one call
- **getDeviceFullProfile**: Complete device profile by name, serial, or ID — resolves automatically and fetches details, policy logs, and history in parallel
- **getSecurityPosture**: Fleet security analysis — FileVault encryption rates, compliance status, and OS version currency
- **getPolicyAnalysis**: Policy analysis by ID or name — configuration, scope, compliance, and performance

### Device Management
- **searchDevices**: Find devices by name, serial number, IP address, or username
- **getDeviceDetails**: Detailed device information by ID
- **checkDeviceCompliance**: Find devices that haven't reported in X days
- **getDevicesBatch**: Get details for multiple devices in a single request
- **updateInventory**: Force inventory update on a device
- **debugDeviceDates**: Debug tool for raw device date fields

### Computer History & MDM Commands
- **getComputerHistory**: Full computer history — policy logs, MDM commands, audit events, screen sharing, user/location changes
- **getComputerPolicyLogs**: Policy execution logs showing success/failure per device
- **getComputerMDMCommandHistory**: MDM command history with status and timestamps
- **sendComputerMDMCommand**: Send MDM commands to macOS — lock, wipe, restart, shutdown, remote desktop (requires confirmation)
- **flushMDMCommands**: Clear pending/failed MDM commands to unstick devices (requires confirmation)

### Policy Management
- **listPolicies**: List all policies with optional category filter
- **getPolicyDetails**: Detailed policy info including scope, scripts, and packages
- **searchPolicies**: Search policies by name
- **executePolicy**: Run a policy on specific devices (requires confirmation)
- **createPolicy**: Create a new policy with full configuration (requires confirmation)
- **updatePolicy**: Update an existing policy (requires confirmation)
- **clonePolicy**: Clone a policy with a new name (requires confirmation)
- **setPolicyEnabled**: Enable or disable a policy (requires confirmation)
- **updatePolicyScope**: Add/remove computers and groups from policy scope (requires confirmation)

### Script Management
- **listScripts**: List all scripts
- **searchScripts**: Search scripts by name
- **getScriptDetails**: Full script content, parameters, and metadata
- **deployScript**: Execute a script on devices (requires confirmation)
- **createScript**: Create a new script (requires confirmation)
- **updateScript**: Update an existing script (requires confirmation)
- **deleteScript**: Delete a script (requires confirmation)

### Configuration Profile Management
- **listConfigurationProfiles**: List profiles (computer or mobile device)
- **getConfigurationProfileDetails**: Detailed profile information
- **searchConfigurationProfiles**: Search profiles by name
- **deployConfigurationProfile**: Deploy a profile to devices (requires confirmation)
- **removeConfigurationProfile**: Remove a profile from devices (requires confirmation)

### Package Management
- **listPackages**: List all packages
- **searchPackages**: Search packages by name
- **getPackageDetails**: Detailed package information
- **getPackageDeploymentHistory**: Deployment history via policy analysis
- **getPoliciesUsingPackage**: Find all policies using a specific package
- **getPackageDeploymentStats**: Deployment statistics and scope analysis

### Computer Group Management
- **listComputerGroups**: List groups (smart, static, or all)
- **getComputerGroupDetails**: Group details including membership and smart group criteria
- **searchComputerGroups**: Search groups by name
- **getComputerGroupMembers**: List all members of a group
- **createStaticComputerGroup**: Create a static group (requires confirmation)
- **updateStaticComputerGroup**: Update group membership (requires confirmation)
- **deleteComputerGroup**: Delete a group (requires confirmation)

### Advanced Computer Searches
- **listAdvancedComputerSearches**: List all saved advanced searches
- **getAdvancedComputerSearchDetails**: Get search configuration and results
- **createAdvancedComputerSearch**: Create a new advanced search (requires confirmation)
- **deleteAdvancedComputerSearch**: Delete a saved search (requires confirmation)

### Mobile Device Management
- **searchMobileDevices**: Search mobile devices by name, serial, or UDID
- **getMobileDeviceDetails**: Detailed mobile device information
- **listMobileDevices**: List all mobile devices
- **updateMobileDeviceInventory**: Force inventory update on a mobile device
- **sendMDMCommand**: Send MDM commands — lock, wipe, clear passcode, lost mode, settings (requires confirmation)
- **listMobileDeviceGroups**: List mobile device groups
- **getMobileDeviceGroupDetails**: Group details including membership

### Reporting & Analytics
- **getInventorySummary**: Fleet inventory summary — device counts, OS distribution, model distribution
- **getDeviceComplianceSummary**: Compliance summary — check-in rates, failed policies, missing software
- **getPolicyComplianceReport**: Policy compliance — success/failure rates, scope coverage
- **getSoftwareVersionReport**: Software version distribution across devices
- **getPackageDeploymentStats**: Package deployment statistics and policy usage

### Buildings, Departments & Categories
- **listBuildings** / **getBuildingDetails**: Organizational buildings for multi-site scoping
- **listDepartments** / **getDepartmentDetails**: Departments for scoping and reporting
- **listCategories** / **getCategoryDetails**: Categories for organizing policies, scripts, and profiles

### Local Admin Password (LAPS)
- **getLocalAdminPassword**: Retrieve the current LAPS password for a device (requires confirmation)
- **getLocalAdminPasswordAudit**: Audit trail of password views and rotations
- **getLocalAdminPasswordAccounts**: List LAPS-managed accounts on a device

### Patch Management
- **listPatchSoftwareTitles**: List patch software title configurations
- **getPatchSoftwareTitleDetails**: Patch title details with versions and definitions
- **listPatchPolicies**: List patch policies with deployment status
- **getPatchPolicyDashboard**: Patch compliance dashboard — latest version, pending, failed

### Extension Attributes
- **listComputerExtensionAttributes**: List all custom extension attributes
- **getComputerExtensionAttributeDetails**: Full EA details including script content
- **createComputerExtensionAttribute**: Create a new extension attribute (requires confirmation)
- **updateComputerExtensionAttribute**: Update an extension attribute (requires confirmation)

### Managed Software Updates
- **listSoftwareUpdatePlans**: List active and completed OS update plans
- **createSoftwareUpdatePlan**: Create an OS update plan for specific devices (requires confirmation)
- **getSoftwareUpdatePlanDetails**: Update plan status and device progress

### Enrollment Prestages
- **listComputerPrestages** / **getComputerPrestageDetails** / **getComputerPrestageScope**: Computer enrollment prestage configuration and device assignments
- **listMobilePrestages** / **getMobilePrestageDetails**: Mobile device enrollment prestages

### Network Segments
- **listNetworkSegments**: List network segments for location-based management
- **getNetworkSegmentDetails**: Segment details including IP ranges and building assignment

### Accounts & Users
- **listAccounts** / **getAccountDetails** / **getAccountGroupDetails**: Jamf Pro admin accounts and groups with privileges
- **listUsers** / **getUserDetails** / **searchUsers**: End-user records (not admin accounts)

### App Installers
- **listAppInstallers**: List Jamf App Catalog titles
- **getAppInstallerDetails**: Detailed app installer information

### Restricted Software
- **listRestrictedSoftware**: List restricted software entries
- **getRestrictedSoftwareDetails**: Restricted software configuration details

### Webhooks
- **listWebhooks**: List configured webhooks
- **getWebhookDetails**: Webhook configuration details

## Resources (12)

| Resource URI | Description |
|---|---|
| `jamf://inventory/computers` | Paginated computer inventory |
| `jamf://inventory/mobile-devices` | Paginated mobile device inventory |
| `jamf://reports/compliance` | Security and patch compliance report |
| `jamf://reports/mobile-device-compliance` | Mobile device compliance and management status |
| `jamf://reports/storage` | Disk usage analytics |
| `jamf://reports/os-versions` | OS version breakdown |
| `jamf://reports/patch-compliance` | Fleet-wide patch compliance by software title |
| `jamf://reports/encryption-status` | FileVault encryption compliance |
| `jamf://reports/extension-attributes` | Extension attributes collection summary |
| `jamf://inventory/prestages` | Enrollment prestage assignments overview |
| `jamf://reports/failed-mdm-commands` | Devices with stuck or failed MDM commands |
| `jamf://reports/laps-audit` | LAPS password access audit trail |

## Prompts (12 Workflow Templates)

| Prompt | Description |
|---|---|
| `troubleshoot-device` | Step-by-step device troubleshooting |
| `deploy-software` | Software deployment workflow |
| `compliance-check` | Comprehensive compliance reporting |
| `mass-update` | Bulk device operations |
| `storage-cleanup` | Disk space management |
| `security-audit` | Full security posture audit — encryption, OS currency, compliance, failed policies |
| `new-device-onboarding` | Verify new device enrollment — profiles, policies, group memberships |
| `device-offboarding` | Device offboarding — unscope, wipe/lock, retire from inventory |
| `software-update-review` | OS version distribution review and update planning |
| `fleet-health-dashboard` | Comprehensive fleet health — devices, compliance, storage, OS, mobile |
| `investigate-device-issue` | Deep device investigation — profiles, policies, groups, scripts |
| `policy-rollout` | Staged policy rollout — clone, test group, verify, expand to production |

## Skills (ChatGPT Integration)

Advanced multi-step operations for the ChatGPT connector:

- **skill_device_search**: Intelligent device search with natural language processing
- **skill_find_outdated_devices**: Identify devices not checking in
- **skill_batch_inventory_update**: Update multiple devices efficiently
- **skill_deploy_policy_by_criteria**: Deploy policies based on device criteria
- **skill_scheduled_compliance_check**: Automated compliance reporting

## Configuration

### Jamf Pro API Authentication

1. In Jamf Pro, go to **Settings** > **System** > **API Roles and Clients**
2. Create a new API Role with necessary permissions
3. Create a new API Client — note the Client ID and generate a Client Secret

### Claude Desktop Configuration

Add to your Claude Desktop config file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jamf-pro": {
      "command": "node",
      "args": ["/absolute/path/to/jamf-mcp-server/dist/index-main.js"],
      "env": {
        "JAMF_URL": "https://your-instance.jamfcloud.com",
        "JAMF_CLIENT_ID": "your-api-client-id",
        "JAMF_CLIENT_SECRET": "your-api-client-secret"
      }
    }
  }
}
```

### ChatGPT Configuration

See [ChatGPT Connector Setup](CHATGPT_CONNECTOR_README.md) for detailed instructions.

### Enhanced Mode (Optional)

```json
{
  "env": {
    "JAMF_USE_ENHANCED_MODE": "true",
    "JAMF_MAX_RETRIES": "3",
    "JAMF_RETRY_DELAY": "1000",
    "JAMF_RETRY_MAX_DELAY": "10000",
    "JAMF_DEBUG_MODE": "false",
    "JAMF_ENABLE_RETRY": "true",
    "JAMF_ENABLE_RATE_LIMITING": "false",
    "JAMF_ENABLE_CIRCUIT_BREAKER": "false",
    "JAMF_READ_ONLY": "false"
  }
}
```

## Installation

```bash
git clone https://github.com/dbankscard/jamf-mcp-server.git
cd jamf-mcp-server
npm install
npm run build
```

### Development

```bash
npm run dev          # Run in development mode
npm run build:force  # Build without tests
npm test             # Run tests
```

## Security

- **Read-Only Mode**: Set `JAMF_READ_ONLY=true` to prevent any modifications
- **Confirmation Required**: All destructive operations require explicit `confirm: true`
- **Tool Annotations**: Each tool declares `readOnlyHint` and `destructiveHint` for client-side safety
- **OAuth2 Authentication**: Supports Jamf Pro API Client Credentials
- **Rate Limiting**: Optional built-in rate limiter
- **Circuit Breaker**: Optional circuit breaker for failure protection

### Recommended API Permissions

For full functionality:
- Read access to computers, policies, scripts, configuration profiles, packages, mobile devices, buildings, departments, categories, extension attributes, patch management, prestages, network segments, accounts, users, webhooks
- LAPS password access (for LAPS tools)
- Update access for inventory updates, policies, scripts, extension attributes
- Execute access for policies, scripts, and MDM commands

For read-only mode:
- Read access to all resources only

## Architecture

```
Claude Desktop  -->  MCP Server (stdio)  -->  Jamf Pro API
ChatGPT         -->  Tunnel (Cloudflare)  -->  MCP Server (HTTP)  -->  Jamf Pro API
```

The server uses a hybrid API client that supports both Jamf Pro Modern API (v1/v2/v3) and Classic API, with automatic fallback between them for maximum compatibility across Jamf Pro versions.

## Troubleshooting

### Authentication Issues
- Verify your API credentials (Client ID and Secret)
- Ensure the API client has the required permissions
- For Classic API endpoints, the server automatically uses Bearer tokens from OAuth2

### 503 Errors on Classic API
- If using OAuth2 only (no username/password), ensure you're running v2.0+ which supports Bearer tokens on Classic API endpoints

### Timeouts on Compound Tools
- The default request timeout is 30 seconds
- Compound tools like `getFleetOverview` make parallel API calls and may need more time on slower instances

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Jamf Pro API Documentation](https://developer.jamf.com/)
- [ChatGPT MCP Connectors](https://help.openai.com/en/articles/9824990-using-connectors-in-chatgpt)
- [Claude Desktop MCP Servers](https://modelcontextprotocol.io/clients/claude)

## Support

- [Create an Issue](https://github.com/dbankscard/jamf-mcp-server/issues)
- [View Documentation](docs/)
- [Fork this Repository](https://github.com/dbankscard/jamf-mcp-server/fork)

---

Built with the Jamf, Claude, and ChatGPT communities
