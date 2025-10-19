# ChatGPT Custom GPT Configuration

## Quick Setup Steps

### 1. Create a Custom GPT
1. Go to ChatGPT (https://chatgpt.com)
2. Click on your profile → "My GPTs"
3. Click "Create a GPT"

### 2. Configure Your GPT

#### Name & Description
- **Name**: Jamf Device Manager
- **Description**: Manage Apple devices through Jamf Pro API

#### Instructions
```
You are a Jamf Pro device management assistant with access to a real Jamf Pro instance. You can:

- Search for devices by name, serial number, or user
- Check device compliance and last check-in times
- View detailed device information
- List and execute policies
- View installed applications and configuration profiles
- Check device storage and OS versions
- Update device inventory

Always be helpful and explain what you're doing. When searching for devices, provide relevant details about what you find.
```

### 3. Configure Actions

Click on "Actions" and then "Create new action"

#### Authentication
- **Type**: API Key
- **Auth Type**: Bearer
- **API Key**: 
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlci0wMDEiLCJlbWFpbCI6ImRldkBqYW1mLW1jcC5sb2NhbCIsIm5hbW1lIjoiRGV2ZWxvcG1lbnQgVXNlciIsInNjb3BlIjoicmVhZDpqYW1mIHdyaXRlOmphbWYiLCJwZXJtaXNzaW9ucyI6WyJyZWFkOmphbWYiLCJ3cml0ZTpqYW1mIl0sImlhdCI6MTc2MDg5NTE2MSwiZXhwIjoxNzYxNDk5OTYxfQ.U6Au2fzy7AewSsRKdjhgTRd8nVFdApVpHJGRxKgNERM
```

#### Schema
Copy and paste this OpenAPI schema (replace YOUR-TUNNEL-URL with your actual Cloudflare tunnel URL):

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Jamf MCP Server",
    "version": "1.0.0",
    "description": "MCP server for Jamf Pro device management"
  },
  "servers": [
    {
      "url": "https://YOUR-TUNNEL-URL.trycloudflare.com"
    }
  ],
  "paths": {
    "/mcp": {
      "get": {
        "summary": "Connect to MCP server",
        "description": "Establishes SSE connection for MCP communication",
        "operationId": "connectMCP",
        "responses": {
          "200": {
            "description": "SSE stream established",
            "content": {
              "text/event-stream": {
                "schema": {
                  "type": "string"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/health": {
      "get": {
        "summary": "Health check",
        "description": "Check if the server is running",
        "operationId": "healthCheck",
        "responses": {
          "200": {
            "description": "Server is healthy",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string"
                    },
                    "service": {
                      "type": "string"
                    },
                    "version": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer"
      }
    }
  }
}
```

### 4. Test Your Connection

After saving the action:

1. In the GPT builder, try asking: "Check if the server is healthy"
2. It should call the health endpoint and show you the server status

### 5. Example Prompts to Test

Once connected, try these prompts:

- "Search for all Mac computers"
- "Find devices that haven't checked in for 30 days"
- "Show me details for device [serial number]"
- "List all policies"
- "Show me devices with less than 20GB free storage"

## Troubleshooting

### If ChatGPT can't connect:

1. **Check your tunnel is running**
   ```bash
   curl https://YOUR-TUNNEL-URL.trycloudflare.com/health
   ```

2. **Check the JWT token**
   Make sure you copied the entire token including all characters

3. **Check server logs**
   Look at your terminal where the MCP server is running for any errors

### Common Issues:

- **"Unauthorized"**: Token is incorrect or expired
- **"Cannot connect"**: Tunnel URL is wrong or tunnel stopped
- **"No response"**: The MCP endpoint uses SSE, ChatGPT might need time to establish connection

## Advanced Configuration

If ChatGPT has trouble with the SSE endpoint, you can create wrapper endpoints. Let me know if you need help with that!