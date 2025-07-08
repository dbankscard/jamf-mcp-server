# Jamf MCP Server - Tool Questions Guide

This guide provides example questions users can ask for each available tool in the Jamf MCP server.

## Device Management Tools

### searchDevices
- "Find all devices with 'MacBook' in the name"
- "Search for devices assigned to user john.doe"
- "Look for devices with serial number ABC123"
- "Find computers with IP address starting with 192.168"
- "Show me all devices with 'Pro' in their name"
- "Search for devices that have 'M1' or 'M2' in their info"

### getDeviceDetails
- "Get full details for device ID 123"
- "Show me everything about the device with ID 456"
- "What's the hardware configuration of device 789?"
- "Check the storage and FileVault status of device 234"
- "Show user information for device 567"
- "What OS version is device 890 running?"

### getDevicesBatch
- "Get details for devices 123, 456, and 789"
- "Show basic info for these 10 devices: [list of IDs]"
- "Fetch information for multiple devices at once"
- "Get hardware details for this batch of device IDs"
- "Check these 5 devices in one request"

### updateInventory
- "Force device 123 to update its inventory"
- "Trigger an inventory update on device 456"
- "Make device 789 report its current status to Jamf"
- "Refresh the inventory data for device 234"
- "Update device 567's information in Jamf"

### checkDeviceCompliance
- "Which devices haven't checked in for 30 days?"
- "Show me all devices that haven't reported in the last week"
- "Check device compliance for the last 14 days with details"
- "Find devices that haven't contacted Jamf in 60 days"
- "What's our current device compliance rate?"
- "List critical devices (90+ days without contact)"
- "Show me non-compliant devices with their last contact times"

### debugDeviceDates
- "Debug date fields for 5 random devices"
- "Show me raw date formats from Jamf for troubleshooting"
- "Check how dates are being parsed from devices"
- "Debug timestamp issues with device check-ins"
- "Verify date field parsing for a few devices"

## Policy Management Tools

### listPolicies
- "Show me all policies"
- "List the first 50 policies"
- "Show all policies in the 'Software Updates' category"
- "List policies filtered by 'Security' category"
- "Display all available Jamf policies"
- "Show me policies in the 'Maintenance' category"

### getPolicyDetails
- "Get full details for policy ID 100"
- "Show me what policy 200 does"
- "What devices are in scope for policy 300?"
- "List all scripts and packages in policy 400"
- "Check the configuration of policy 500"
- "Show trigger and frequency for policy 600"

### searchPolicies
- "Find all policies with 'update' in the name"
- "Search for policies related to 'security'"
- "Look for policies that deploy Chrome"
- "Find policies with 'restart' in their description"
- "Search for all Adobe-related policies"
- "Show policies that contain 'VPN'"

### executePolicy
- "Execute policy 123 on device 456 (confirm: true)"
- "Run the software update policy on these 5 devices"
- "Deploy policy 789 to devices 111, 222, 333 with confirmation"
- "Execute maintenance policy on this list of devices"
- "Run policy 100 on all these non-compliant devices"

## Script Management Tools

### deployScript
- "Deploy script 50 to device 123 (confirm: true)"
- "Run cleanup script on these 10 devices with confirmation"
- "Execute script 75 on devices 456, 789, 012"
- "Deploy the diagnostic script to this batch of devices"
- "Run script 100 on all devices having issues"

## Common Use Case Questions

### Compliance Monitoring
- "Show me all devices that are out of compliance"
- "Which devices need immediate attention (90+ days)?"
- "What's our overall compliance percentage?"
- "List devices by last contact time"
- "Find devices that might be lost or stolen"

### Troubleshooting
- "Why isn't device 123 checking in?"
- "Debug the last contact times for these devices"
- "Check if these devices are receiving policies"
- "Verify inventory data for problematic devices"

### Bulk Operations
- "Get details for all devices that haven't checked in"
- "Update inventory on all non-compliant devices"
- "Execute update policy on devices needing patches"
- "Check compliance and then update those that need it"

### Reporting
- "Generate a compliance report for the last 30 days"
- "Show me devices grouped by their last contact status"
- "List all critical devices with their assigned users"
- "Create a summary of device check-in patterns"

## Best Practices

1. **Always use specific IDs** when working with individual devices or policies
2. **Set appropriate limits** when searching to avoid overwhelming responses
3. **Use confirmation flags** carefully when executing policies or scripts
4. **Check compliance regularly** to maintain fleet health
5. **Batch operations** when possible to improve efficiency

## Safety Notes

- Tools that modify state (`executePolicy`, `deployScript`) require explicit confirmation
- Always verify device IDs before executing policies
- Use search tools to find correct IDs before taking actions
- Start with small batches when testing bulk operations