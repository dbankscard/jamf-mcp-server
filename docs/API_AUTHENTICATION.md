# Jamf Pro API Authentication Guide

## Overview

The Jamf MCP Server supports two authentication methods:

1. **OAuth2 (Modern API)** - Recommended for most operations
2. **Basic Auth (Classic API)** - Required for some legacy endpoints

## Authentication Methods

### OAuth2 (Client Credentials)

**Best for:** Modern API endpoints, most operations, production use

**Setup:**
1. In Jamf Pro: Settings → System → API Roles and Clients
2. Create an API Role with required permissions
3. Create an API Client and note the Client ID and Secret

**Environment Variables:**
```bash
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_CLIENT_ID=your-api-client-id
JAMF_CLIENT_SECRET=your-api-client-secret
```

**Supported Operations:**
- ✅ Computers (search, details, inventory updates)
- ✅ Mobile Devices (search, details, MDM commands)
- ✅ Policies (list, details, execution)
- ✅ Mobile Device Groups
- ✅ Most Modern API endpoints

**Limited Operations (requires Classic API):**
- ⚠️ Configuration Profiles
- ⚠️ Scripts
- ⚠️ Packages
- ⚠️ Computer Groups
- ⚠️ Some advanced features

### Basic Auth (Classic API)

**Best for:** Legacy endpoints, scripts, configuration profiles, packages

**Setup:**
1. Create a Jamf Pro user account
2. Assign appropriate privileges

**Environment Variables:**
```bash
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_USERNAME=your-jamf-username
JAMF_PASSWORD=your-jamf-password
```

**Supported Operations:**
- ✅ All Classic API endpoints
- ✅ Configuration Profiles
- ✅ Scripts (with full content)
- ✅ Packages
- ✅ Computer Groups
- ✅ Legacy workflows

## Hybrid Mode (Recommended for Complete Documentation)

For **complete environment documentation**, use both authentication methods:

**Environment Variables:**
```bash
# Modern API (OAuth2)
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_CLIENT_ID=your-api-client-id
JAMF_CLIENT_SECRET=your-api-client-secret

# Classic API (Basic Auth) - Optional but recommended
JAMF_USERNAME=your-jamf-username
JAMF_PASSWORD=your-jamf-password
```

**Benefits:**
- ✅ Access to ALL Jamf Pro components
- ✅ Automatic fallback to Classic API when needed
- ✅ Best performance (uses Modern API where available)
- ✅ Complete documentation coverage

## API Coverage by Component

### Fully Supported with OAuth2 Only

| Component | Modern API | Classic API | OAuth2 Only |
|-----------|------------|-------------|-------------|
| Computers | ✅ | ✅ | ✅ |
| Mobile Devices | ✅ | ✅ | ✅ |
| Policies | ✅ | ✅ | ✅ |
| Mobile Device Groups | ✅ | ✅ | ✅ |

### Requires Classic API (Basic Auth)

| Component | Modern API | Classic API | OAuth2 Only |
|-----------|------------|-------------|-------------|
| Configuration Profiles | ⚠️ Limited | ✅ | ❌ |
| Scripts | ❌ | ✅ | ❌ |
| Packages | ❌ | ✅ | ❌ |
| Computer Groups | ⚠️ Limited | ✅ | ❌ |

## Troubleshooting

### "Classic API not accessible" Warning

**Symptom:**
```
2025-11-11 19:38:27 [jamf-client-hybrid] warn: Classic API not accessible
{"error":"Request failed with status code 401"}
```

**Solution:** Add Basic Auth credentials to your `.env`:
```bash
JAMF_USERNAME=your-username
JAMF_PASSWORD=your-password
```

### Some Components Return 0 Items

**Symptom:** Configuration profiles, scripts, or packages show 0 items even though they exist

**Cause:** These components require Classic API access

**Solution:** Add Basic Auth credentials as shown above

### Which Authentication Should I Use?

**For Production:**
- Use **OAuth2** for primary operations
- Add **Basic Auth** for complete access
- The server will automatically choose the best API for each operation

**For Testing/Development:**
- OAuth2 is sufficient for most testing
- Add Basic Auth only if you need to test specific components

**For Complete Documentation:**
- **Both** authentication methods recommended
- Ensures all components are documented
- No missing data

## Security Best Practices

1. **Use OAuth2 when possible** - More secure, better audit trail
2. **Rotate credentials regularly** - Especially for Basic Auth
3. **Use read-only permissions** for documentation generation
4. **Store credentials securely** - Use environment variables, not hard-coded values
5. **Never commit credentials** - Keep `.env` in `.gitignore`

## API Permissions Required

### For Full Documentation Generation

**OAuth2 API Role:**
- Read Computers
- Read Mobile Devices
- Read Policies
- Read Mobile Device Groups

**Basic Auth User Privileges:**
- Jamf Pro Server Objects: Read
- JSS Objects: Read (for Classic API)
- Scripts: Read
- Packages: Read

## Example Configurations

### Minimum (OAuth2 Only)
```bash
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_CLIENT_ID=abc123
JAMF_CLIENT_SECRET=secret123
```
✅ Documents: Computers, Mobile Devices, Policies
❌ Missing: Scripts, Packages, Configuration Profiles, Groups

### Complete (Hybrid)
```bash
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_CLIENT_ID=abc123
JAMF_CLIENT_SECRET=secret123
JAMF_USERNAME=jamf-api-user
JAMF_PASSWORD=password123
```
✅ Documents: Everything
✅ Full environment coverage

### Read-Only (Safest)
```bash
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_CLIENT_ID=abc123
JAMF_CLIENT_SECRET=secret123
JAMF_USERNAME=readonly-user
JAMF_PASSWORD=password123
JAMF_READ_ONLY=true  # Extra safety
```
✅ Cannot make changes
✅ Safe for regular documentation
✅ Prevents accidental modifications
