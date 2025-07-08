# Jamf MCP Server - Reporting and Analytics Features

This document describes the new reporting and analytics features added to the Jamf MCP Server.

## Overview

The Jamf MCP Server now includes five powerful reporting tools that provide read-only analytics and insights into your Jamf Pro environment:

1. **Inventory Summary** - Device counts, OS versions, and model distributions
2. **Policy Compliance Report** - Policy execution status and scope analysis
3. **Package Deployment Statistics** - Package usage across policies and devices
4. **Software Version Report** - Software version distribution and update needs
5. **Device Compliance Summary** - Device check-in status and compliance metrics

## Available Reporting Tools

### 1. getInventorySummary

Get a comprehensive overview of all devices in your Jamf Pro instance.

**Usage:**
```json
{
  "tool": "getInventorySummary"
}
```

**Returns:**
- Total computers and mobile devices
- OS version distribution with percentages
- Model distribution (top 20 models)
- Separate breakdowns for computers and mobile devices

### 2. getPolicyComplianceReport

Analyze policy deployment and compliance status.

**Usage:**
```json
{
  "tool": "getPolicyComplianceReport",
  "arguments": {
    "policyId": "123"
  }
}
```

**Returns:**
- Policy configuration details
- Scope information (targeted devices, groups, exclusions)
- Package and script payloads
- Self Service availability
- Compliance estimates

### 3. getPackageDeploymentStats

Get detailed statistics about package deployment across policies.

**Usage:**
```json
{
  "tool": "getPackageDeploymentStats",
  "arguments": {
    "packageId": "456"
  }
}
```

**Returns:**
- Package details (name, size, settings)
- Number of policies using the package
- Total target devices
- Policy breakdown by frequency and category
- Active vs inactive policy counts

### 4. getSoftwareVersionReport

Analyze software version distribution across your fleet.

**Usage:**
```json
{
  "tool": "getSoftwareVersionReport",
  "arguments": {
    "softwareName": "Google Chrome"
  }
}
```

**Returns:**
- Version distribution with counts and percentages
- Latest version detection
- Out-of-date installation counts
- Sample computers for each version
- Update recommendations

**Note:** For performance reasons, this tool samples up to 100 computers.

### 5. getDeviceComplianceSummary

Get an overview of device compliance and check-in status.

**Usage:**
```json
{
  "tool": "getDeviceComplianceSummary"
}
```

**Returns:**
- Total device counts and compliance rates
- Check-in status breakdown:
  - Devices checked in today
  - Devices checked in this week
  - Devices not seen this week
  - Devices not seen for 30+ days
- Critical policy monitoring
- Actionable recommendations

## Implementation Details

### Data Sources

All reporting tools use read-only API calls to gather data:
- Computer and mobile device inventories
- Policy configurations
- Package details
- Computer group memberships
- No write operations are performed

### Performance Considerations

1. **Inventory Summary** - May fetch up to 10,000 devices
2. **Software Version Report** - Samples up to 100 computers for detailed software inventory
3. **Policy Compliance** - May need to fetch computer group details for accurate scope calculations
4. **All reports** - Use caching where appropriate to minimize API calls

### Error Handling

All reporting methods include comprehensive error handling:
- Graceful fallback from Modern API to Classic API
- Clear error messages for troubleshooting
- Partial data returns when some API calls fail

## Example Integration

Here's how to use these reporting tools in your MCP client:

```python
# Python example using MCP SDK
async def generate_monthly_report(mcp_client):
    # Get inventory summary
    inventory = await mcp_client.call_tool(
        "getInventorySummary", 
        {}
    )
    
    # Check device compliance
    compliance = await mcp_client.call_tool(
        "getDeviceComplianceSummary",
        {}
    )
    
    # Analyze critical software
    chrome_report = await mcp_client.call_tool(
        "getSoftwareVersionReport",
        {"softwareName": "Google Chrome"}
    )
    
    # Combine reports for monthly summary
    return {
        "inventory": inventory,
        "compliance": compliance,
        "software_updates": chrome_report
    }
```

## Limitations

1. **Policy Logs** - Detailed policy execution history requires access to policy logs endpoint (not available in current Jamf API)
2. **Software Inventory** - Full software inventory scanning is limited to prevent performance issues
3. **Real-time Data** - Reports reflect data at the time of generation; consider caching for frequently accessed reports
4. **API Availability** - Some features may be limited based on your Jamf Pro version and API access

## Future Enhancements

Potential improvements for these reporting features:
- Integration with Jamf Pro webhooks for real-time updates
- Historical trend analysis with data persistence
- Custom report templates
- Scheduled report generation
- Export to various formats (PDF, CSV, etc.)