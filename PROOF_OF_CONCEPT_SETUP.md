# Proof of Concept Setup - ChatGPT MCP Connector

This guide shows you how to quickly set up the Jamf MCP Server as a ChatGPT connector using tunnels for local development.

## Prerequisites

- Node.js 18+ installed
- Jamf Pro instance with API roles and clients configured
- ChatGPT Plus subscription (for MCP Connectors)
- Cloudflare or ngrok for tunneling

## Quick Setup (5 minutes)

### 1. Clone and Configure

```bash
# Clone the repository (use feature/chatgpt-connector branch)
git clone -b feature/chatgpt-connector https://github.com/dbankscard/jamf-mcp-server.git
cd jamf-mcp-server

# Copy environment template
cp .env.example .env
```

Edit `.env` with your Jamf credentials:

```bash
# Jamf Configuration (REQUIRED)
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_CLIENT_ID=your-jamf-client-id
JAMF_CLIENT_SECRET=your-jamf-client-secret

# Development Mode (for ChatGPT POC)
NODE_ENV=development
OAUTH_PROVIDER=dev
JWT_SECRET=your-secret-key-here
```

### 2. Start the Server

```bash
# Use the quick start script
./start-chatgpt-poc.sh

# Or manually:
npm install
npm run build
npm run serve:http
```

The server will start on `http://localhost:3000`

### 3. Create a Tunnel

In a new terminal, expose your local server to the internet:

**Option A: Cloudflare Tunnel (Recommended)**
```bash
# Install cloudflared if needed
brew install cloudflare/cloudflare/cloudflared

# Create tunnel
cloudflared tunnel --url http://localhost:3000
```

**Option B: ngrok**
```bash
# Install ngrok if needed
brew install ngrok

# Create tunnel
ngrok http 3000
```

Note the public URL provided (e.g., `https://example-name.trycloudflare.com`)

### 4. Configure ChatGPT MCP Connector

1. Go to [ChatGPT](https://chat.openai.com)
2. Click your profile → "Apps & Connectors"
3. Click "Create" → "New Connector BETA"
4. Fill in:
   - **Name**: Jamf MCP
   - **Description**: Connect to Jamf Pro device management
   - **MCP Server URL**: Your tunnel URL (e.g., `https://example-name.trycloudflare.com`)
   - **Authentication**: Select "None" for POC
5. Click "Create"

### 5. Test the Connection

Start a new ChatGPT conversation and try:
- "Search for devices named 'MacBook'"
- "Check device compliance for the last 30 days"
- "Find devices that haven't checked in recently"

## How It Works

```
ChatGPT MCP Connector <-> Tunnel (Cloudflare/ngrok) <-> Local Server <-> Jamf Pro API
```

The server implements the MCP protocol with JSON-RPC, allowing ChatGPT to:
1. Send natural language requests
2. Call MCP tools (search_computers, check_compliance)
3. Receive formatted responses from your Jamf instance

## Troubleshooting

### Tunnel Issues
- **Cloudflare**: If the tunnel disconnects, restart it with the same command
- **ngrok**: Free tier has session limits; consider paid tier for stability
- Both services provide a public URL that changes on restart

### ChatGPT Can't Connect
1. Check server is running: `curl http://localhost:3000/health`
2. Verify tunnel is active and accessible from the internet
3. Check server logs: Look for incoming requests from ChatGPT
4. Ensure MCP Server URL in ChatGPT settings matches your tunnel URL

### Authentication Errors
1. Verify `.env` has correct Jamf credentials
2. Ensure `NODE_ENV=development` and `OAUTH_PROVIDER=dev`
3. ChatGPT connector should use "None" authentication for POC

## Security Notes

⚠️ **This setup is for POC only!**

- Development authentication is enabled (no real auth required)
- Tunnel exposes your local server to the internet
- Use a read-only Jamf Pro API client if possible
- Don't leave the tunnel running when not testing

For production:
- Implement proper OAuth2 authentication
- Deploy to a secure cloud environment
- Use HTTPS with valid certificates
- Enable rate limiting and access controls

## Available MCP Tools

1. **search_computers**
   - Search devices by name, serial number, etc.
   - Returns device details and last contact time

2. **check_compliance**
   - Check devices based on check-in frequency
   - Returns compliance statistics

## Next Steps

- Review [Full Documentation](CHATGPT_CONNECTOR_README.md)
- Check [Architecture Overview](docs/CHATGPT_CONNECTOR_FLOW.md)
- For production deployment, see [Deployment Guide](docs/CHATGPT_DEPLOYMENT.md)