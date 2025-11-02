# Debugging Jamf MCP Server Connection Issues

## Overview
This guide helps debug connection issues between the MCP server and your Jamf Pro instance.

## Common Issues and Solutions

### 1. SSL/TLS Certificate Issues

The MCP server is configured to accept self-signed certificates by default. In the `jamf-client-hybrid.ts` file, the axios client is initialized with:

```typescript
httpsAgent: new https.Agent({ rejectUnauthorized: false })
```

This allows connections to Jamf Pro instances with self-signed certificates.

### 2. Authentication Failures

The server supports two authentication methods:
- **OAuth2 (Modern API)**: Uses client credentials flow
- **Basic Auth**: For getting bearer tokens (Classic API)

Check your `.env` file has the correct credentials:
```bash
JAMF_URL=https://your-instance:8443
JAMF_CLIENT_ID=your-client-id
JAMF_CLIENT_SECRET=your-client-secret
JAMF_USERNAME=your-username
JAMF_PASSWORD=your-password
```

### 3. API Search Filter Syntax (Fixed)

The Modern API search was using incorrect filter syntax. The correct syntax is:
- `=~` for contains/partial match
- `or` for combining multiple conditions

Fixed filter: `general.name=~"query" or general.serialNumber=~"query"`

### 4. HTTP 400 Errors

Common causes:
- Incorrect filter syntax (now fixed)
- Invalid API endpoint
- Malformed request parameters

## Testing Your Connection

### Method 1: Use the Test Script

Run the included test script to verify your connection:

```bash
node test-jamf-connection.js
```

This script will:
1. Test OAuth2 authentication
2. Test Basic Auth
3. Verify Modern API access
4. Verify Classic API access
5. Test search functionality with correct filter syntax

### Method 2: Check Server Logs

The HTTP server logs provide detailed information:

```bash
# View recent logs
tail -f server.log

# Search for errors
grep -i error server.log
```

### Method 3: Test with curl

Test your Jamf API directly:

```bash
# Test with self-signed certificate (-k flag)
curl -k https://your-instance.jamfcloud.com/api/v1/auth/token \
  -H "Accept: application/json" \
  -u "api:your-password"
```

## Claude Desktop Console

To view MCP server logs in Claude Desktop:
1. Open Claude Desktop
2. Go to Settings → Developer
3. Look for console output from the jamf-mcp-server

Common log patterns:
- `✅ OAuth2 token obtained successfully` - Good authentication
- `Modern API search failed: Request failed with status code 400` - Bad request (usually filter syntax)
- `Searching computers using Classic API...` - Fallback to Classic API

## Firewall and Network Issues

Ensure your firewall allows:
- Outbound HTTPS traffic on port 8443 (or your Jamf port)
- Connection to your Jamf Pro URL

Test network connectivity:
```bash
# Test if host is reachable
ping your-instance.jamfcloud.com

# Test if port is open
nc -zv your-instance.jamfcloud.com 8443
```

## Rebuilding After Changes

After fixing any issues:

```bash
# Rebuild the project
npm run build

# Restart the HTTP server
npm run serve:http

# Or for MCP mode
npm run serve
```

## Additional Debugging Tips

1. **Enable debug mode** in `.env`:
   ```
   JAMF_DEBUG_MODE=true
   ```

2. **Check API permissions** in Jamf Pro:
   - Ensure your API client has necessary permissions
   - Verify OAuth2 scopes are correctly configured

3. **Test individual endpoints**:
   - Start with simple endpoints like `/api/v1/jamf-pro-version`
   - Gradually test more complex operations

4. **Monitor rate limits**:
   - Jamf Pro may throttle requests
   - Check for 429 (Too Many Requests) errors

## Need More Help?

If you're still experiencing issues:
1. Check the [Jamf Pro API Documentation](https://developer.jamf.com/jamf-pro/reference/jamf-pro-api)
2. Verify your Jamf Pro version supports the API endpoints
3. Check Jamf Pro logs for authentication/authorization issues