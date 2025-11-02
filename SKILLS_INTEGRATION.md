# Jamf MCP Server - Skills Integration

## Overview

The Jamf MCP Server now includes high-level "skills" that combine multiple tools to perform complex management tasks. These skills are available to both Claude (via MCP tools) and ChatGPT (via HTTP API).

## Available Skills

### 1. Device Management Skills

#### `find-outdated-devices`
Identifies devices that haven't checked in recently.
- **For Claude**: Use tool `skill_find_outdated_devices`
- **For ChatGPT**: POST to `/api/v1/skills/execute` with `skill: "find-outdated-devices"`

#### `batch-inventory-update`
Updates inventory for multiple devices efficiently.
- **For Claude**: Use tool `skill_batch_inventory_update`
- **For ChatGPT**: POST to `/api/v1/skills/execute` with `skill: "batch-inventory-update"`

### 2. Policy Management Skills

#### `deploy-policy-by-criteria`
Deploys policies to devices based on criteria like OS version, department, etc.
- **For Claude**: Use tool `skill_deploy_policy_by_criteria`
- **For ChatGPT**: POST to `/api/v1/skills/execute` with `skill: "deploy-policy-by-criteria"`

### 3. Automation Skills

#### `scheduled-compliance-check`
Performs comprehensive compliance audits with detailed reporting.
- **For Claude**: Use tool `skill_scheduled_compliance_check`
- **For ChatGPT**: POST to `/api/v1/skills/execute` with `skill: "scheduled-compliance-check"`

## Integration Architecture

```
┌─────────────┐         ┌─────────────┐
│   Claude    │         │   ChatGPT   │
└──────┬──────┘         └──────┬──────┘
       │                       │
       │ MCP Protocol          │ HTTP API
       │                       │
┌──────▼──────────────────────▼──────┐
│         Skills Manager              │
│  - Unified skill execution          │
│  - Parameter validation             │
│  - Response formatting              │
└──────┬──────────────────────┬──────┘
       │                      │
┌──────▼──────┐        ┌──────▼──────┐
│ MCP Tools   │        │ HTTP Routes │
│ Integration │        │   /api/v1/  │
└─────────────┘        └─────────────┘
```

## For Claude Users

Skills appear as MCP tools with the prefix `skill_`. They can be discovered via the standard tools list:
- `skill_find_outdated_devices`
- `skill_batch_inventory_update`
- `skill_deploy_policy_by_criteria`
- `skill_scheduled_compliance_check`

Example usage:
```
Use the skill_find_outdated_devices tool with parameters:
{
  "daysSinceLastContact": 30,
  "includeDetails": true
}
```

## For ChatGPT Users

Skills are available via REST API endpoints:

### Execute a Skill
```
POST /api/v1/skills/execute
{
  "skill": "find-outdated-devices",
  "parameters": {
    "daysSinceLastContact": 30,
    "includeDetails": true
  }
}
```

### Get Skills Catalog
```
GET /api/v1/skills/catalog
```

### Get Skill Details
```
GET /api/v1/skills/{skillName}
```

### OpenAPI Specification
Available at: `/chatgpt-skills-openapi.json`

## Benefits

1. **Simplified Operations**: Complex multi-step tasks are now single operations
2. **Consistent Interface**: Same skills work for both Claude and ChatGPT
3. **Better Error Handling**: Skills provide structured error messages and recovery suggestions
4. **Dry Run Support**: Test operations before executing them
5. **Detailed Reporting**: Skills format output for easy reading and action

## Adding New Skills

1. Create a new skill file in the appropriate `skills/` subdirectory
2. Implement the skill function and metadata
3. Add the skill to `skills/index.ts`
4. The skill will automatically be available to both Claude and ChatGPT

## Security Considerations

- All skills respect the same authentication and authorization as the underlying tools
- Skills can be configured with `dryRun` and `confirm` parameters for safety
- Rate limiting applies to skill execution endpoints
- All actions are logged for audit purposes