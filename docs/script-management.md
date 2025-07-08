# Jamf MCP Script Management Features

This document describes the script management capabilities added to the Jamf MCP Server.

## Overview

The Jamf MCP Server now supports comprehensive script management operations, allowing you to:
- List all scripts
- Search scripts by name or ID
- Create new scripts with parameters
- Update existing scripts
- Delete scripts

All script operations use the Classic API and XML format for maximum compatibility.

## Available Tools

### 1. listScripts

Lists all scripts in Jamf Pro.

**Parameters:**
- `limit` (optional, default: 100): Maximum number of scripts to return

**Example:**
```json
{
  "tool": "listScripts",
  "parameters": {
    "limit": 50
  }
}
```

### 2. searchScripts

Search for scripts by name or ID.

**Parameters:**
- `query` (required): Search query for script name
- `limit` (optional, default: 50): Maximum number of results

**Example:**
```json
{
  "tool": "searchScripts",
  "parameters": {
    "query": "install",
    "limit": 20
  }
}
```

### 3. getScriptDetails

Get detailed information about a specific script (existing method).

**Parameters:**
- `scriptId` (required): The Jamf script ID

**Example:**
```json
{
  "tool": "getScriptDetails",
  "parameters": {
    "scriptId": "123"
  }
}
```

### 4. createScript

Create a new script with contents and parameters.

**Parameters:**
- `scriptData` (required): Script configuration object containing:
  - `name` (required): Script name
  - `script_contents` (required): Script contents
  - `category` (optional): Script category
  - `info` (optional): Script info/description
  - `notes` (optional): Script notes
  - `priority` (optional): Script priority
  - `parameters` (optional): Object with parameter labels (parameter4-11)
  - `os_requirements` (optional): OS requirements
  - `script_contents_encoded` (optional): Whether script contents are encoded
- `confirm` (required): Confirmation flag for script creation

**Example:**
```json
{
  "tool": "createScript",
  "parameters": {
    "scriptData": {
      "name": "Software Installation Script",
      "script_contents": "#!/bin/bash\n# Install software\necho \"Installing $4\"\nexit 0",
      "category": "Software",
      "info": "Generic software installation script",
      "notes": "This script installs software packages",
      "priority": "After",
      "parameters": {
        "parameter4": "Software Name",
        "parameter5": "Version",
        "parameter6": "Install Location"
      }
    },
    "confirm": true
  }
}
```

### 5. updateScript

Update an existing script.

**Parameters:**
- `scriptId` (required): The script ID to update
- `scriptData` (required): Script configuration data to update (same fields as createScript, all optional)
- `confirm` (required): Confirmation flag for script update

**Example:**
```json
{
  "tool": "updateScript",
  "parameters": {
    "scriptId": "123",
    "scriptData": {
      "notes": "Updated script notes",
      "parameters": {
        "parameter4": "Updated parameter label"
      }
    },
    "confirm": true
  }
}
```

### 6. deleteScript

Delete a script.

**Parameters:**
- `scriptId` (required): The script ID to delete
- `confirm` (required): Confirmation flag for script deletion

**Example:**
```json
{
  "tool": "deleteScript",
  "parameters": {
    "scriptId": "123",
    "confirm": true
  }
}
```

## Script Parameters

Jamf scripts support parameters 4 through 11 (parameters 1-3 are reserved by Jamf):
- Parameter 1: Mount point of the target drive (reserved)
- Parameter 2: Computer name (reserved)
- Parameter 3: Username (reserved)
- Parameters 4-11: Custom parameters you can define

When creating or updating scripts, you can provide labels for these parameters that will be displayed in the Jamf Pro interface.

## Error Handling

All write operations (create, update, delete) include:
- Read-only mode checks
- Proper error messages with context
- XML escaping for special characters
- Authentication verification

## Security Considerations

1. **Confirmation Required**: All write operations require explicit confirmation (`confirm: true`)
2. **Read-Only Mode**: The client can be configured in read-only mode to prevent accidental modifications
3. **XML Escaping**: All script contents and parameters are properly XML-escaped to prevent injection
4. **Authentication**: Uses the same authentication methods as other Jamf MCP operations

## Testing

A test script is provided at `test-script-management.js` that demonstrates all script management capabilities. Run it with:

```bash
# Set environment variables
export JAMF_BASE_URL="https://your-instance.jamfcloud.com"
export JAMF_USERNAME="your-username"
export JAMF_PASSWORD="your-password"

# Run the test
node test-script-management.js
```

## Implementation Details

- Uses Classic API endpoints (`/JSSResource/scripts`)
- XML format for create/update operations
- Follows existing patterns in the codebase
- Proper error handling and logging
- Consistent with other Jamf MCP tools