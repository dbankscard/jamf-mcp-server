# Jamf MCP Server - ChatGPT Connector POC

Connect ChatGPT to your Jamf Pro instance using the Model Context Protocol (MCP). Query devices using natural language!

## Features

- 🔍 Search devices by name, serial number, or user
- 📊 Check device compliance status  
- 🚀 No authentication required for POC
- 🔒 Secure tunnel support via Cloudflare

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Jamf Pro instance with API credentials
- ChatGPT Plus subscription (for custom GPTs)
- Cloudflare or ngrok account (for tunneling)

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/jamf-mcp-server.git
cd jamf-mcp-server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your Jamf credentials:

```env
# Jamf Configuration (REQUIRED)
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_CLIENT_ID=your-client-id
JAMF_CLIENT_SECRET=your-client-secret

# Development Mode (for ChatGPT)
NODE_ENV=development
OAUTH_PROVIDER=dev
JWT_SECRET=your-secret-key-here
```

### 3. Start the Server

```bash
# Start the HTTP server
npm run serve:http
```

The server will start on http://localhost:3000

### 4. Create a Tunnel

You need to expose your local server to the internet for ChatGPT to access it.

#### Using Cloudflare Tunnel (Recommended)

```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Create a tunnel
cloudflared tunnel --url http://localhost:3000
```

Note the URL provided (e.g., `https://example-name.trycloudflare.com`)

#### Using ngrok

```bash
# Install ngrok
brew install ngrok

# Create a tunnel
ngrok http 3000
```

### 5. Configure ChatGPT

1. Go to [ChatGPT](https://chat.openai.com)
2. Click on your profile → "My GPTs" → "Create a GPT"
3. Go to "Configure" tab
4. Under "Actions", click "Create new action"
5. Choose "Import from URL"
6. Enter: `https://your-tunnel-url.trycloudflare.com/chatgpt-openapi-schema.json`
7. Set Authentication to "None"
8. Save the GPT

### 6. Test the Connection

In your custom GPT, try these commands:
- "Search for devices named 'MacBook'"
- "Check device compliance for the last 30 days"
- "Find devices that haven't checked in recently"

## Available Endpoints

### For ChatGPT (No Auth Required in Dev Mode)

- `GET /` - Server information
- `POST /` - JSON-RPC endpoint for MCP protocol
- `GET /health` - Health check
- `GET /chatgpt/health` - ChatGPT-specific health check

### MCP Tools Available to ChatGPT

1. **search_computers**
   - Search for devices by name, serial number, etc.
   - Returns device ID, name, serial number, last contact time

2. **check_compliance**
   - Check device compliance based on check-in time
   - Parameters: `days` (optional, default: 30)
   - Returns compliance statistics and non-compliant devices

## Architecture

```
ChatGPT <-> Internet <-> Tunnel <-> MCP Server <-> Jamf Pro API
```

The server implements the MCP protocol with JSON-RPC, allowing ChatGPT to interact with your Jamf instance through natural language.

## Security Considerations

⚠️ **This POC uses development authentication** - DO NOT use in production!

For production use:
1. Implement proper OAuth2 authentication
2. Use HTTPS with valid certificates
3. Restrict CORS origins
4. Enable rate limiting
5. Use read-only Jamf API credentials
6. Deploy to a secure cloud environment

## Troubleshooting

### ChatGPT Can't Connect
1. Check server is running: `curl http://localhost:3000/health`
2. Check tunnel is active and URL is accessible
3. Verify CORS settings include ChatGPT domains
4. Check server logs for errors

### Authentication Errors
1. Verify Jamf credentials in `.env`
2. Check Jamf API client has necessary permissions
3. Ensure `NODE_ENV=development` for POC mode

### Tool Execution Fails
1. Check server logs for detailed error messages
2. Verify Jamf API is accessible
3. Test with manual curl commands

## Development

### Adding New Tools

To expose more Jamf functionality to ChatGPT, edit `/src/server/http-server.ts`:

```typescript
} else if (method === 'tools/list') {
  // Add new tools here
  tools: [
    {
      name: 'your_new_tool',
      description: 'What it does',
      inputSchema: {
        type: 'object',
        properties: {
          // Define parameters
        }
      }
    }
  ]
}
```

### Monitoring

Watch server logs in real-time:
```bash
tail -f server.log | grep -E "ChatGPT|openai-mcp|Tool call"
```

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check existing documentation in `/docs`
- Review server logs for detailed error information