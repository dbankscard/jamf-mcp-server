# Jamf MCP Authentication Debugging Guide

## Authentication Error When Accessing Packages

If you're getting authentication errors when trying to list packages, here's how to debug:

### 1. Verify Environment Variables

Check that your Claude Desktop config has the correct credentials:

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`

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
        "JAMF_USERNAME": "your-username",
        "JAMF_PASSWORD": "your-password",
        "JAMF_READ_ONLY": "false"
      }
    }
  }
}
```

### 2. Authentication Methods

The Jamf MCP server supports two authentication methods:

#### OAuth2 (Modern API) - Recommended
- Uses `JAMF_CLIENT_ID` and `JAMF_CLIENT_SECRET`
- Works with Modern API endpoints
- More secure and recommended approach

#### Basic Auth (Classic API)
- Uses `JAMF_USERNAME` and `JAMF_PASSWORD`  
- Works with Classic API endpoints
- Legacy method but still supported

**You need at least ONE of these methods configured!**

### 3. Package Access Requirements

To access packages, your Jamf Pro API user needs:
- **Read** permission on Packages
- **Read** permission on Policies (for deployment history)

### 4. Test Authentication Directly

Create a test script to verify authentication:

```javascript
// test-auth.js
import { JamfApiClientHybrid } from './dist/jamf-client-hybrid.js';

const client = new JamfApiClientHybrid({
  baseUrl: process.env.JAMF_URL,
  clientId: process.env.JAMF_CLIENT_ID,
  clientSecret: process.env.JAMF_CLIENT_SECRET,
  username: process.env.JAMF_USERNAME,
  password: process.env.JAMF_PASSWORD,
  readOnlyMode: true
});

// Test authentication
client.testApiAccess()
  .then(() => console.log('✅ Authentication successful!'))
  .catch(err => console.error('❌ Authentication failed:', err));
```

### 5. Common Issues and Solutions

#### Issue: "Authentication failed: Invalid or expired credentials"
**Solution**: 
- Verify your credentials are correct
- For OAuth2: Check Client ID and Secret haven't been rotated
- For Basic Auth: Verify username/password are correct

#### Issue: "403 Forbidden" when accessing packages
**Solution**:
- Your API user lacks package read permissions
- In Jamf Pro: Settings > System > API Roles and Clients
- Ensure the role has "Read" permission for Packages

#### Issue: Both Modern and Classic API fail
**Solution**:
- The hybrid client tries Modern API first, then Classic
- If both fail, check network connectivity to Jamf Pro
- Verify the JAMF_URL is correct (no trailing slash)

### 6. Enable Debug Mode

Add this to your Claude Desktop config to see detailed logs:

```json
"env": {
  // ... other env vars ...
  "JAMF_DEBUG_MODE": "true"
}
```

This will show:
- Which authentication method is being used
- API endpoints being called
- Response codes and errors

### 7. Quick Checklist

- [ ] JAMF_URL is correct and accessible
- [ ] At least one auth method is configured (OAuth2 or Basic)
- [ ] Credentials are valid and not expired
- [ ] API user has package read permissions
- [ ] No typos in environment variable names
- [ ] Claude Desktop was restarted after config changes

### 8. Test in Claude

After fixing authentication, test with:
```
List all packages in Jamf
```

If it works, you should see a list of packages. If not, check the Claude Desktop logs for specific error messages.