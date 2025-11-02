# Jamf MCP Server - Claude Skills

This directory contains pre-built Claude skills for common Jamf management tasks. These skills provide high-level workflows that combine multiple MCP tools to accomplish complex operations.

## 📁 Directory Structure

```
skills/
├── device-management/      # Device-focused operations
├── policy-management/      # Policy deployment and management
├── automation/            # Scheduled tasks and compliance
├── reporting/            # Analytics and reporting (coming soon)
└── types.ts              # Common type definitions
```

## 🛠️ Available Skills

### Device Management

#### `find-outdated-devices`
Identify devices that haven't checked in recently.

**Example usage:**
```typescript
await findOutdatedDevices(context, {
  daysSinceLastContact: 30,
  includeDetails: true
});
```

#### `batch-inventory-update`
Update inventory for multiple devices efficiently.

**Example usage:**
```typescript
await batchInventoryUpdate(context, {
  deviceIdentifiers: ['C02XL1234567', 'C02XL2345678'],
  identifierType: 'serialNumber',
  maxConcurrent: 5
});
```

### Policy Management

#### `deploy-policy-by-criteria`
Deploy policies to devices based on specific criteria like OS version, department, or check-in status.

**Example usage:**
```typescript
await deployPolicyByCriteria(context, {
  policyIdentifier: 'Security Update',
  identifierType: 'name',
  criteria: {
    osVersion: '14',
    daysSinceLastContact: 7
  },
  dryRun: true
});
```

### Automation

#### `scheduled-compliance-check`
Perform comprehensive compliance audits with detailed reporting.

**Example usage:**
```typescript
await scheduledComplianceCheck(context, {
  checks: {
    outdatedDevices: { enabled: true, daysThreshold: 30 },
    osVersionCompliance: { enabled: true, minimumVersion: '14.0' },
    missingProfiles: { 
      enabled: true, 
      requiredProfiles: ['FileVault', 'Firewall'] 
    }
  },
  outputFormat: 'detailed'
});
```

## 🚀 Using Skills in Claude

### Basic Pattern

When using these skills with Claude, follow this pattern:

1. **Identify the task** - Determine which skill matches your need
2. **Gather parameters** - Collect necessary information (device IDs, policy names, etc.)
3. **Run with dry-run** - Test with `dryRun: true` first
4. **Execute** - Run with actual parameters and confirmation

### Example Conversations

**Finding outdated devices:**
```
User: "Show me all devices that haven't checked in for 2 weeks"
Claude: I'll use the find-outdated-devices skill to identify devices that haven't checked in for 14 days...
```

**Deploying policies:**
```
User: "Deploy the security update policy to all Engineering Macs running macOS 13"
Claude: I'll use the deploy-policy-by-criteria skill to target specific devices. Let me first do a dry run to show you which devices would be affected...
```

**Compliance checking:**
```
User: "Run a compliance check for outdated devices and OS versions"
Claude: I'll perform a comprehensive compliance check using the scheduled-compliance-check skill...
```

## 💡 Best Practices

### 1. Always Start with Dry Runs
Most skills support a `dryRun` parameter. Use it to preview actions before execution.

### 2. Use Specific Identifiers
When possible, use specific identifiers (IDs, serial numbers) rather than names for accuracy.

### 3. Batch Operations
For operations on multiple devices, use batch skills to avoid rate limiting and improve performance.

### 4. Check Results
Always review the skill's output, especially the `success` field and any error messages.

### 5. Follow Up Actions
Many skills provide `nextActions` suggestions. Use these to guide follow-up tasks.

## 🔧 Creating Custom Skills

To create a new skill:

1. Choose the appropriate category directory
2. Create a new TypeScript file following the naming pattern
3. Implement the skill function and metadata
4. Use the types from `types.ts`
5. Add comprehensive error handling
6. Include usage examples in metadata

### Skill Template

```typescript
import { SkillContext, SkillResult } from '../types';

interface YourSkillParams {
  // Define parameters
}

export async function yourSkillName(
  context: SkillContext,
  params: YourSkillParams
): Promise<SkillResult> {
  try {
    // Implementation
    return {
      success: true,
      message: 'Operation completed',
      data: { /* results */ }
    };
  } catch (error) {
    return {
      success: false,
      message: `Operation failed: ${error.message}`,
      error
    };
  }
}

export const metadata = {
  name: 'your-skill-name',
  description: 'What this skill does',
  parameters: {
    // Define parameter metadata
  },
  examples: [
    // Provide examples
  ]
};
```

## 📊 Skill Categories

### Device Management
- Device discovery and inventory
- Batch operations
- Health monitoring

### Policy Management
- Policy deployment
- Configuration management
- Software distribution

### Automation
- Scheduled tasks
- Compliance checking
- Automated remediation

### Reporting (Coming Soon)
- Analytics dashboards
- Executive summaries
- Trend analysis

## 🔗 Integration with MCP Tools

Skills are built on top of the core MCP tools:
- `searchDevices` - Find devices
- `checkDeviceCompliance` - Check device status
- `executePolicy` - Deploy policies
- `updateInventory` - Refresh device data
- And more...

Skills combine these tools to create powerful workflows while handling errors, validating inputs, and formatting outputs for better usability.