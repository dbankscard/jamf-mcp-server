# Jamf MCP Server - Feature Documentation

This document provides detailed information about all features available in the Jamf MCP Server, including example commands and use cases.

## Table of Contents
- [Device Management](#device-management)
- [Configuration Profile Management](#configuration-profile-management)
- [Package Management](#package-management)
- [Policy Management](#policy-management)
- [Script Management](#script-management)
- [Computer Group Management](#computer-group-management)
- [Mobile Device Management](#mobile-device-management)
- [Reporting Features](#reporting-features)
- [Workflow Prompts](#workflow-prompts)
- [Common Use Cases](#common-use-cases)
- [Troubleshooting Tips](#troubleshooting-tips)

## Device Management

### Search Devices
Find devices using various criteria (supports partial name matching):
```
# Search by user
"Find all devices assigned to John Smith"
"Search for Dwight Banks computer"

# Search by serial number
"Search for device with serial number FVFXL0ZXJ1WK"

# Search by IP address
"Find devices on IP 192.168.1.100"

# Search by device name (partial match supported)
"Look for MacBook Pro devices"
"Search for GH-IT-0322"
"Find computers with 'Marketing' in the name"
```

### Get Device Details
Retrieve comprehensive information about specific devices (by ID or name):
```
# By device ID
"Show me details for device ID 123"

# By device name
"Get details for device GH-IT-0322"
"Show me information for John's MacBook"

# With inventory information (ID or name)
"Get full inventory for computer 456"
"Get inventory for Marketing-Mac-01"
```

### Check Device Compliance
Efficiently check device compliance status:
```
# Standard compliance check
"Show me all devices that haven't reported in 30 days"

# Critical compliance
"Find devices offline for more than 90 days"

# With detailed list
"Check device compliance and show me the full list of non-compliant devices"
```

### Batch Operations
Process multiple devices at once:
```
# Get details for multiple devices
"Get details for devices 123, 456, and 789"

# Update inventory on multiple devices
"Force inventory update on devices 100, 200, 300"
```

## Configuration Profile Management

### List Configuration Profiles
```
# List all computer profiles
"List all computer configuration profiles"

# List mobile device profiles
"Show me all mobile device configuration profiles"

# Filter by platform
"List iOS configuration profiles"
```

### Search Configuration Profiles
```
# Search by name
"Search for WiFi configuration profiles"

# Search for security profiles
"Find all FileVault configuration profiles"

# Search MDM profiles
"Look for device restriction profiles"
```

### Deploy Configuration Profiles
```
# Deploy to single device (by ID or name)
"Deploy configuration profile ID 5 to device 123"
"Deploy WiFi profile to device GH-IT-0322"
"Deploy profile 'Corporate Settings' to John's MacBook"

# Deploy to multiple devices
"Deploy WiFi profile 10 to devices 123, 456, and 789"

# Deploy mobile profile
"Deploy iOS restrictions profile 15 to mobile device 999"
```

### Remove Configuration Profiles
```
# Remove from single device
"Remove configuration profile ID 5 from device 123"

# Remove from multiple devices
"Remove WiFi profile from devices 456, 789, and 012"

# Remove mobile profile
"Remove restrictions profile 20 from iPad 555"
```

## Package Management

### List Packages
```
# List all packages
"Show me all packages in Jamf"

# List with details
"List all packages with their versions and sizes"
```

### Search Packages
```
# Search by name (partial match supported)
"Search for packages containing Office"
"Find package named 'Google Chrome'"
"Search for Chrome installer"

# Search by filename
"Find package with filename chrome.pkg"

# Search by category
"Show me all packages in the Productivity category"
```

### Get Package Details
```
# By package ID
"Get details for package ID 15"

# By package name
"Show details for package 'Microsoft Office'"
"Get info about Chrome package"

# With requirements (ID or name)
"Show me package 20 including OS requirements"
"Get 'Adobe Creative Cloud' package with requirements"
```

### Package Deployment Analysis
```
# Deployment history
"Show me the deployment history for package ID 25"

# Find policies using package
"Which policies use package ID 30?"

# Find all Chrome deployments
"Find all policies that deploy Chrome"
```

## Policy Management

### List and Search Policies
```
# List all policies
"List all policies"

# Search by name (partial match supported)
"Search for policies containing 'software update'"
"Find policy named 'Install Chrome'"
"Search for 'FileVault' policies"

# Search security policies
"Show me all security-related policies"

# Find specific policy (exact or partial name)
"Find the Adobe Creative Cloud installation policy"
"Search for Weekly Maintenance policy"
```

### Get Policy Details
```
# By policy ID
"Get details for policy ID 123"

# By policy name
"Show details for policy 'Software Updates'"
"Get info about 'Install Microsoft Office' policy"

# With script content (ID or name)
"Show me policy 456 including the actual script code"
"Get 'Disk Cleanup' policy with script contents"

# Full policy information
"Get complete details for the 'Weekly Maintenance' policy"
```

### Execute Policies
```
# Run on single device (policy and device can be ID or name)
"Execute policy ID 100 on device 500"
"Run 'Software Update' policy on GH-IT-0322"
"Execute 'Install Chrome' on John's MacBook"

# Run on multiple devices
"Run the 'Software Update' policy on devices 123, 456, and 789"
"Execute 'Cleanup' policy on Marketing-Mac-01 and Sales-Mac-02"

# Trigger by event
"Execute all policies with trigger 'startup' on device 999"
"Run startup policies on GH-IT-0322"
```

## Script Management

### Get Script Details
```
# View script content
"Show me the content of script ID 42"

# With parameters
"Get script 50 including all parameters and default values"

# Full details
"Show me everything about the 'Disk Cleanup' script"
```

### Deploy Scripts
```
# Run diagnostic script
"Run the diagnostic script on device 123"

# Execute with parameters
"Deploy script 75 with parameter 'cleanup=true' on device 456"
```

## Computer Group Management

### List Computer Groups
```
# List all groups
"List all computer groups"

# Smart groups only
"Show me only smart computer groups"

# Static groups only
"List all static computer groups"
```

### Search Computer Groups
```
# Search by name
"Search for groups containing 'marketing'"

# Find department groups
"Find all groups for the IT department"

# Search smart groups
"Search for smart groups with macOS criteria"
```

### Get Group Details
```
# Basic details
"Get details for computer group ID 10"

# With membership
"Show me all members of the 'Executive Laptops' group"

# Smart group criteria
"Show me the criteria for smart group 'Non-Compliant Devices'"
```

### Manage Static Groups
```
# Create new group
"Create a static group called 'Project Alpha' with computers 123, 456, and 789"

# Update membership
"Update the 'Deployment Test' group to include computers 111, 222, and 333"

# Remove members
"Remove computers 444 and 555 from the 'Beta Testing' group"

# Delete group
"Delete computer group ID 99"
```

## Mobile Device Management

### Search Mobile Devices
```
# Search by type
"Search for all iPads"

# Search by user
"Find mobile devices assigned to Sarah Johnson"

# Search by serial
"Find mobile device with serial number ABC123DEF"

# Search by OS version
"Show me all devices running iOS 17"
```

### Mobile Device Details
```
# Basic details
"Get details for mobile device ID 456"

# With apps
"Show me device 789 including installed apps"

# Security status
"Check security status for iPad 321"
```

### MDM Commands
```
# Device lock
"Lock mobile device 123"

# Clear passcode (requires confirmation)
"Clear the passcode on device 456"

# Enable Lost Mode
"Enable Lost Mode on device 789"

# Play sound
"Play Lost Mode sound on device 321"

# Device wipe (requires confirmation)
"Wipe mobile device 999"

# Update inventory
"Force inventory update on iPad 555"

# Device settings
"Disable Bluetooth on device 777"
"Enable WiFi on all executive iPads"
```

### Mobile Device Groups
```
# List groups
"List all mobile device groups"

# Smart groups
"Show me smart mobile device groups"

# Group details
"Get details for mobile device group ID 15"

# Group members
"Show me all devices in the 'Sales iPads' group"
```

## Reporting Features

### Computer Compliance Report
Access via: `jamf://reports/compliance`
```
"Show me the device compliance report"
"Generate a security compliance report for all computers"
```

### Mobile Device Compliance Report
Access via: `jamf://reports/mobile-device-compliance`
```
"Show me mobile device compliance status"
"Generate iPad compliance report"
```

### Storage Report
Access via: `jamf://reports/storage`
```
"Show me devices with low disk space"
"Which computers have less than 10GB free?"
```

### OS Version Report
Access via: `jamf://reports/os-versions`
```
"Show me OS version breakdown"
"How many devices are running macOS Sonoma?"
```

## Workflow Prompts

### Troubleshoot Device
```
"Help me troubleshoot John's MacBook"
"Walk me through diagnosing device connectivity issues"
```

### Deploy Software
```
"Deploy Microsoft Office to the Marketing team"
"Help me install Slack on all developer machines"
```

### Compliance Check
```
"Run a comprehensive compliance check"
"Check all devices for security compliance"
```

### Mass Update
```
"Update all devices in the Sales department"
"Deploy latest security updates to all computers"
```

### Storage Cleanup
```
"Help me free up disk space on low-storage devices"
"Run storage cleanup on devices with less than 20GB free"
```

## Common Use Cases

### New Employee Setup
```
1. "Create a static group called 'New Employees Q1 2024'"
2. "Add computer 123 to the 'New Employees Q1 2024' group"
3. "Deploy standard configuration profiles to the group"
4. "Install required software packages"
5. "Verify device compliance"
```

### Security Audit
```
1. "List all devices that haven't checked in for 30 days"
2. "Show me devices without FileVault enabled"
3. "Find computers missing critical security updates"
4. "Generate compliance report for executive review"
```

### Software Deployment
```
1. "Search for Adobe Creative Cloud package"
2. "Find policies that deploy Adobe CC"
3. "Create test group for deployment"
4. "Deploy to test group first"
5. "Check deployment history"
6. "Deploy to production groups"
```

### Mobile Device Management
```
1. "List all iPads in the organization"
2. "Check for non-compliant mobile devices"
3. "Deploy WiFi profile to all mobile devices"
4. "Enable restrictions on student iPads"
5. "Generate mobile device compliance report"
```

## Troubleshooting Tips

### Authentication Issues
- Verify API credentials are correct
- Check API role permissions in Jamf Pro
- Ensure client ID and secret are properly configured
- Test with read-only mode first

### Performance Optimization
- Use specific search criteria to limit results
- Batch operations when processing multiple devices
- Use compliance check tool for large fleet analysis
- Enable debug mode to identify slow operations

### Common Errors

#### "Device not found"
- Verify device ID is correct
- Check if device is still in Jamf Pro
- Ensure proper API permissions

#### "Policy execution failed"
- Verify device is online and checking in
- Check policy scope includes the device
- Ensure policy is enabled
- Review policy logs in Jamf Pro

#### "Configuration profile deployment failed"
- Check if profile is already installed
- Verify device platform compatibility
- Ensure profile is not restricted by scope
- Check for conflicting profiles

#### "Package deployment issues"
- Verify package exists in distribution point
- Check package size and device storage
- Ensure proper deployment policies
- Review package requirements

### API Limitations
- Classic API returns XML format (automatically parsed)
- Field names may vary between API versions
- Some operations require specific API permissions
- Rate limiting may apply for bulk operations

### Best Practices
1. Always test operations on a small group first
2. Use read-only mode when exploring
3. Keep audit logs of all changes
4. Regular backup of critical configurations
5. Monitor API usage and limits
6. Use search filters to improve performance
7. Batch similar operations together
8. Verify destructive actions before confirming