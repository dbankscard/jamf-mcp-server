# ChatGPT Connector Integration Flow

## Overview

This document explains how ChatGPT interacts with the Jamf MCP Server through custom connectors once deployed on AWS.

## Integration Architecture

```
┌─────────────────┐
│   ChatGPT User  │
└────────┬────────┘
         │ 1. Natural language request
         │    "Show me all Macs that haven't checked in for 30 days"
         ▼
┌─────────────────┐
│    ChatGPT      │
│   Connector     │
└────────┬────────┘
         │ 2. OAuth Authentication Flow
         ▼
┌─────────────────┐         ┌─────────────────┐
│  Auth0/Okta     │ ◄────► │     User        │
│  OAuth Provider │         │  Authentication │
└────────┬────────┘         └─────────────────┘
         │ 3. Access Token
         ▼
┌─────────────────────────────────────────────┐
│          AWS Application Load Balancer       │
│            (https://your-domain.com)         │
└────────┬─────────────────────────────────────┘
         │ 4. Authenticated MCP Request
         ▼
┌─────────────────────────────────────────────┐
│              MCP Server (ECS)                │
│  ┌─────────────────────────────────────┐    │
│  │   SSE Connection Handler            │    │
│  │   - Maintains persistent connection │    │
│  │   - Streams responses back         │    │
│  └──────────────┬─────────────────────┘    │
│                 │                           │
│  ┌──────────────▼─────────────────────┐    │
│  │   MCP Protocol Handler             │    │
│  │   - Parses natural language        │    │
│  │   - Routes to appropriate tool     │    │
│  └──────────────┬─────────────────────┘    │
│                 │                           │
│  ┌──────────────▼─────────────────────┐    │
│  │   Jamf API Client                  │    │
│  │   - Executes API calls             │    │
│  │   - Handles authentication         │    │
│  └──────────────┬─────────────────────┘    │
└─────────────────┼───────────────────────────┘
                  │ 5. API Request
                  ▼
         ┌─────────────────┐
         │   Jamf Pro      │
         │   Instance      │
         └─────────────────┘
```

## Step-by-Step Flow

### 1. User Interaction in ChatGPT

**User types:** "Show me all Macs that haven't checked in for 30 days"

ChatGPT recognizes this requires the Jamf MCP connector and initiates the connection.

### 2. Authentication Flow (First Time)

```
a. ChatGPT redirects user to:
   https://your-domain.com/auth/authorize

b. MCP Server redirects to Auth0/Okta:
   https://your-tenant.auth0.com/authorize?
     client_id=xxx&
     redirect_uri=https://chatgpt.com/auth/callback&
     response_type=code&
     scope=openid profile email&
     state=abc123

c. User logs in with their credentials

d. Auth0 redirects back to ChatGPT with authorization code

e. ChatGPT exchanges code for access token via:
   POST https://your-domain.com/auth/callback
   {
     "code": "authorization_code",
     "state": "abc123"
   }

f. MCP Server returns access token to ChatGPT
```

### 3. MCP Connection Establishment

**ChatGPT connects to MCP endpoint:**
```http
GET https://your-domain.com/mcp
Authorization: Bearer <access_token>
Accept: text/event-stream
```

**MCP Server responds with SSE stream:**
```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"connection","status":"ready"}

:ping
```

### 4. Natural Language Processing

**ChatGPT sends MCP command:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "checkDeviceCompliance",
    "arguments": {
      "daysSinceLastCheckin": 30
    }
  },
  "id": "1"
}
```

### 5. Tool Execution

The MCP server:
1. **Validates** the request against tool schema
2. **Authorizes** based on user scopes
3. **Executes** the Jamf API call
4. **Formats** the response

```javascript
// Inside the MCP server
async function checkDeviceCompliance({ daysSinceLastCheckin }) {
  // Query Jamf API
  const devices = await jamfClient.getComputers();
  
  // Process data
  const noncompliant = devices.filter(device => {
    const lastCheckin = new Date(device.last_contact_time);
    const daysSince = (Date.now() - lastCheckin) / (1000 * 60 * 60 * 24);
    return daysSince > daysSinceLastCheckin;
  });
  
  // Return formatted response
  return {
    summary: {
      total: devices.length,
      noncompliant: noncompliant.length
    },
    devices: noncompliant
  };
}
```

### 6. Response Streaming

**MCP Server streams response back:**
```
data: {"jsonrpc":"2.0","result":{"summary":{"total":500,"noncompliant":23},"devices":[...]},"id":"1"}

:ping
```

### 7. ChatGPT Presentation

ChatGPT receives the data and presents it conversationally:

> I found 23 Macs that haven't checked in for over 30 days out of 500 total devices. Here's the breakdown:
> 
> **Critical (90+ days):** 5 devices
> - MAC-001 (Marketing-MBP) - Last seen: 95 days ago
> - MAC-045 (Sales-Mac-02) - Last seen: 92 days ago
> 
> **Warning (30-90 days):** 18 devices
> ...

## Connection Persistence

### SSE (Server-Sent Events) Benefits
- **Persistent Connection**: Maintains connection for entire conversation
- **Real-time Updates**: Can stream progress for long operations
- **Efficient**: No polling required
- **Resilient**: Auto-reconnects if connection drops

### Keep-Alive Mechanism
```javascript
// Server sends ping every 30 seconds
setInterval(() => {
  res.write(':ping\n\n');
}, 30000);
```

## Security Flow

### Token Validation (Every Request)
```javascript
1. Extract Bearer token from Authorization header
2. Validate token signature with JWKS
3. Check token expiration
4. Verify audience and issuer
5. Extract user identity and scopes
6. Authorize based on required scopes
```

### Scope-Based Authorization
```javascript
// Example scope checking
const requiredScopes = ['read:jamf', 'write:jamf'];
const userScopes = decoded.scope.split(' ');

if (!requiredScopes.every(scope => userScopes.includes(scope))) {
  throw new Error('Insufficient permissions');
}
```

## Common Integration Scenarios

### 1. Device Search
**User:** "Find John Smith's MacBook"
```
ChatGPT → MCP: searchDevices({ searchTerm: "John Smith" })
MCP → Jamf: GET /api/v1/computers?search=John%20Smith
Jamf → MCP: [device data]
MCP → ChatGPT: Formatted results
```

### 2. Policy Execution
**User:** "Run the software update policy on device MAC-123"
```
ChatGPT → MCP: executePolicy({ 
  policyName: "software update",
  deviceIdentifier: "MAC-123" 
})
MCP → User: "⚠️ Confirmation required..."
User → MCP: Confirms
MCP → Jamf: POST /api/v1/computers/123/policy/45
```

### 3. Bulk Operations
**User:** "Update inventory on all marketing Macs"
```
ChatGPT → MCP: searchDevices({ department: "Marketing" })
MCP → Jamf: GET /api/v1/computers
ChatGPT → MCP: updateInventory({ deviceIds: [...] })
MCP → Jamf: Multiple API calls with progress updates
```

## Error Handling

### Connection Errors
```
data: {"error":{"code":-32603,"message":"Failed to connect to Jamf API"}}
```

### Authentication Errors
```
HTTP/1.1 401 Unauthorized
{"error":"Token expired","message":"Please re-authenticate"}
```

### Rate Limiting
```
HTTP/1.1 429 Too Many Requests
{"error":"Rate limit exceeded","retry_after":60}
```

## Performance Considerations

### Caching Strategy
- JWKS keys cached for 10 minutes
- OAuth tokens cached until expiry
- No device data caching (always fresh)

### Scaling Behavior
- Each ChatGPT session gets dedicated connection
- AWS Auto-scaling handles load
- ALB distributes across healthy instances
- Sticky sessions maintain connection affinity

## ChatGPT Configuration

### Setting Up the Connector

1. **In ChatGPT Settings:**
```
Name: Jamf Device Manager
Description: Manage Apple devices through Jamf Pro
Icon: [Upload icon]

Authentication:
  Type: OAuth
  Authorization URL: https://your-domain.com/auth/authorize
  Token URL: https://your-domain.com/auth/callback
  Scopes: openid profile email read:jamf write:jamf
  
Server Details:
  Base URL: https://your-domain.com
  MCP Endpoint: /mcp
```

2. **Test Connection:**
- Click "Test Connection"
- Authenticate when prompted
- Verify "Connection Successful"

### Usage Tips

1. **Natural Language Works Best:**
   - ✅ "Show me devices that need updates"
   - ❌ "GET /computers?outdated=true"

2. **Be Specific:**
   - ✅ "Find all iPads in the Sales department"
   - ❌ "Show me some devices"

3. **Confirm Destructive Actions:**
   - Always requires explicit confirmation
   - Cannot be bypassed

## Troubleshooting

### "Connection Failed"
1. Check AWS ALB is healthy
2. Verify OAuth credentials
3. Check CloudWatch logs
4. Test health endpoint: `curl https://your-domain.com/health`

### "Authentication Required"
1. Token may have expired
2. Re-authenticate through ChatGPT
3. Check Auth0/Okta for issues

### "No Response"
1. Check if request reached ALB (access logs)
2. Verify ECS tasks are running
3. Check for timeout issues (large requests)
4. Review CloudWatch for errors

## Monitoring the Integration

### Key Metrics
- **Connection Duration**: Average SSE connection time
- **Request Latency**: Time from request to first byte
- **Error Rate**: Failed requests / total requests
- **Active Connections**: Current connected ChatGPT sessions

### CloudWatch Dashboard
```sql
SELECT COUNT(*) as active_connections
FROM logs
WHERE message LIKE '%MCP connection established%'
  AND timestamp > ago(5m)
```

## Best Practices

1. **Session Management**
   - Let ChatGPT handle reconnections
   - Don't manually close connections
   - Use conversation context

2. **Error Recovery**
   - Retry transient failures
   - Re-authenticate on 401s
   - Report persistent errors

3. **Performance**
   - Batch related requests
   - Use search filters
   - Paginate large results

4. **Security**
   - Never share access tokens
   - Rotate OAuth secrets regularly
   - Monitor for suspicious activity