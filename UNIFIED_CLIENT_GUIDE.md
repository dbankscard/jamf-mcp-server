# Jamf MCP Server - Unified Client Guide

## Overview

The Jamf MCP Server now supports a **Unified Client** that can seamlessly work with both Modern Jamf Pro API (OAuth2) and Classic Jamf API (Basic Auth). This provides maximum flexibility and compatibility with different Jamf Pro configurations.

## Authentication Methods

### 1. OAuth2 Only (Modern API)
- **Best for**: Jamf Cloud instances, API integrations
- **Requires**: Client ID and Client Secret
- **Features**: Modern API endpoints, Advanced Search fallback

### 2. Basic Auth Only (Classic API)
- **Best for**: On-premise Jamf Pro, full Classic API access
- **Requires**: Username and Password
- **Features**: Complete Classic API access, all computer details

### 3. Both OAuth2 + Basic Auth (Recommended)
- **Best for**: Maximum compatibility and performance
- **Requires**: Both credential sets
- **Features**: Automatic API selection, best performance

## Configuration

### Environment Variables

```bash
# Required
JAMF_URL=https://your-jamf-instance.jamfcloud.com

# OAuth2 Credentials (for Modern API)
JAMF_CLIENT_ID=your-client-id
JAMF_CLIENT_SECRET=your-client-secret

# Basic Auth Credentials (for Classic API)
JAMF_USERNAME=your-username
JAMF_PASSWORD=your-password

# Optional
JAMF_READ_ONLY=true  # Enable read-only mode
```

### Claude Desktop Configuration

#### OAuth2 Only (Current Setup)
```json
{
  "jamf-pro": {
    "command": "node",
    "args": ["/path/to/jamf-mcp-server/dist/index.js"],
    "env": {
      "JAMF_URL": "https://your-instance.jamfcloud.com",
      "JAMF_CLIENT_ID": "your-client-id-here",
      "JAMF_CLIENT_SECRET": "your-client-secret",
      "JAMF_READ_ONLY": "true"
    }
  }
}
```

#### OAuth2 + Basic Auth (Full Access)
```json
{
  "jamf-pro": {
    "command": "node",
    "args": ["/path/to/jamf-mcp-server/dist/index.js"],
    "env": {
      "JAMF_URL": "https://your-instance.jamfcloud.com",
      "JAMF_CLIENT_ID": "your-client-id-here",
      "JAMF_CLIENT_SECRET": "your-client-secret",
      "JAMF_USERNAME": "your-username",
      "JAMF_PASSWORD": "your-password",
      "JAMF_READ_ONLY": "true"
    }
  }
}
```

## How It Works

### API Selection Logic

1. **Check Available Credentials**
   - OAuth2: Checks for `JAMF_CLIENT_ID` and `JAMF_CLIENT_SECRET`
   - Basic Auth: Checks for `JAMF_USERNAME` and `JAMF_PASSWORD`

2. **Test API Availability**
   - Modern API: Tests `/api/v1/auth` endpoint
   - Classic API: Tests `/JSSResource/categories` endpoint

3. **Intelligent Routing**
   ```
   Search Computers:
   ├─ Try Modern API (/api/v1/computers-inventory)
   ├─ If fails → Try Classic API (/JSSResource/computers)
   └─ If fails → Fall back to Advanced Search
   
   Get Computer Details:
   ├─ Try Modern API (/api/v1/computers-inventory-detail/{id})
   └─ If fails → Try Classic API (/JSSResource/computers/id/{id})
   ```

### Performance Optimizations

- **API Detection Caching**: API availability is checked once and cached
- **Token Management**: OAuth2 tokens are automatically refreshed
- **Smart Fallbacks**: Automatically uses the best available API
- **Request Timeouts**: 10-second timeout prevents hanging requests

## Benefits

### With OAuth2 Only
- ✅ Works with limited API permissions
- ✅ Uses Advanced Search for computer inventory
- ✅ Fast compliance checking
- ⚠️  Limited computer details

### With Basic Auth Added
- ✅ Full access to Classic API
- ✅ Complete computer details
- ✅ All hardware/software information
- ✅ Faster individual device lookups

## Troubleshooting

### Common Issues

1. **"No authentication credentials provided"**
   - Ensure at least one auth method is configured
   - Check environment variable names

2. **"Classic API is not available"**
   - Verify Basic Auth credentials are correct
   - Check if user has API access permissions

3. **"Modern API is not available"**
   - Verify OAuth2 client credentials
   - Check API client permissions in Jamf Pro

### Debug Mode

The server logs which APIs are available at startup:
```
Starting Jamf MCP server...
Authentication methods available:
  ✅ OAuth2 (Modern API) - Client ID: your-client-xxx
  ✅ Basic Auth (Classic API) - Username: admin
Jamf Unified Client initialized with:
  - OAuth2 (Modern API): Available
  - Basic Auth (Classic API): Available
✅ Modern Jamf Pro API is available
✅ Classic Jamf API is available
```

## Migration Guide

### From Advanced Search Client

No changes needed! The unified client is backward compatible and will automatically use Advanced Search if needed.

### Adding Basic Auth

1. Add credentials to your Claude Desktop config:
   ```json
   "JAMF_USERNAME": "your-username",
   "JAMF_PASSWORD": "your-password"
   ```

2. Restart Claude Desktop

3. The server will automatically detect and use Classic API when beneficial

## Security Notes

- Credentials are only stored in your local Claude Desktop configuration
- OAuth2 tokens are refreshed automatically
- Basic Auth credentials are sent with each request (standard HTTP Basic Auth)
- Use read-only mode (`JAMF_READ_ONLY=true`) for safety

## API Endpoint Usage

| Operation | OAuth2 Only | With Basic Auth |
|-----------|-------------|-----------------|
| Search Computers | Advanced Search | Classic API |
| Get Details | Limited (Advanced Search) | Full (Classic API) |
| Compliance Check | Fast (cached) | Fast (cached) |
| Update Inventory | Modern API | Modern API → Classic API |
| Execute Policy | Modern API | Modern API |
| Deploy Script | Modern API | Modern API |