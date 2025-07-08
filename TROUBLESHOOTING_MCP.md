# Troubleshooting MCP Server Connection

## When Claude Doesn't Use MCP Tools

If Claude responds without using the available MCP tools, check these items:

### 1. Verify MCP Server is Running in Claude

In Claude Desktop, you should see the MCP server status. Check if:
- The Jamf MCP server shows as "Connected"
- There are no error messages in the server logs

### 2. Check Claude Desktop Configuration

Verify your config file at:
`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jamf-pro": {
      "command": "node",
      "args": ["/Users/dwight/jamf-mcp/jamf-mcp-server/dist/index.js"],
      "env": {
        "JAMF_URL": "https://your-instance.jamfcloud.com",
        "JAMF_CLIENT_ID": "your-client-id",
        "JAMF_CLIENT_SECRET": "your-secret",
        "JAMF_READ_ONLY": "false"
      }
    }
  }
}
```

Key points:
- The path in `args` must be absolute and point to the built `dist/index.js`
- Environment variables must be properly set
- No syntax errors in the JSON

### 3. Restart Process

1. Quit Claude Desktop completely (Cmd+Q)
2. Wait a few seconds
3. Relaunch Claude Desktop
4. Wait for MCP servers to initialize (check the server icon)

### 4. Test MCP Connection

Ask Claude explicitly to use a tool:
```
Use the listPackages tool to show packages in Jamf
```

Or:
```
What MCP tools are available for Jamf?
```

### 5. Check Server Logs

In Claude Desktop:
1. Click on the MCP server icon
2. View logs for the Jamf server
3. Look for:
   - "Jamf MCP server started successfully"
   - Any error messages
   - Tool registration confirmations

### 6. Common Issues

**Issue**: "Command not found" or "Cannot find module"
**Fix**: Ensure the path to `dist/index.js` is correct and the project is built

**Issue**: Server starts but tools don't work
**Fix**: Check that credentials are correct and have proper permissions

**Issue**: Server doesn't appear in Claude
**Fix**: Check JSON syntax in config file, ensure no trailing commas

### 7. Debug Mode

Add debug output to see what's happening:
```json
"env": {
  // ... other vars ...
  "JAMF_DEBUG_MODE": "true",
  "NODE_ENV": "development"
}
```

### 8. Manual Test

Test the server directly:
```bash
cd /Users/dwight/jamf-mcp/jamf-mcp-server
node dist/index.js
```

This should output:
```
Starting Jamf MCP server...
Jamf URL: https://your-instance.jamfcloud.com
Authentication methods available:
  ✅ OAuth2 (Modern API) - Client ID: xxx
Read-only mode: false
Jamf MCP server started successfully
```

### 9. Alternative Start Method

If the server won't start, try using the full path:
```json
"command": "/usr/local/bin/node",
"args": ["/Users/dwight/jamf-mcp/jamf-mcp-server/dist/index.js"]
```

### 10. Check Package.json

Ensure the main entry point is correct:
```bash
cat /Users/dwight/jamf-mcp/jamf-mcp-server/package.json | grep main
```

Should show: `"main": "dist/index.js",`