# Setting Up ngrok for ChatGPT Testing

## Quick Setup (5 minutes)

### 1. Sign up for free ngrok account
Go to: https://dashboard.ngrok.com/signup

### 2. Get your authtoken
After signing up, go to: https://dashboard.ngrok.com/get-started/your-authtoken

### 3. Configure ngrok
```bash
ngrok authtoken YOUR_AUTH_TOKEN
```

### 4. Start ngrok tunnel
```bash
# Make sure your MCP server is running on port 3000 first
ngrok http 3000
```

### 5. Get your public URL
ngrok will display something like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

## Configure ChatGPT Custom Connector

### 1. Update your environment
Add the ngrok URL to your allowed origins. Edit your `.env`:
```
ALLOWED_ORIGINS=https://chat.openai.com,https://chatgpt.com,http://localhost:3000,https://YOUR-NGROK-ID.ngrok.io
```

### 2. Restart your server
```bash
# Stop the server (Ctrl+C) and restart
npm run serve:http
```

### 3. In ChatGPT
1. Go to Settings → Custom GPTs → Create a GPT
2. Configure Actions:
   - **Schema**: Use OpenAPI spec (we'll generate this)
   - **Server URL**: `https://YOUR-NGROK-ID.ngrok.io`
   - **Authentication**: API Key
   - **Auth Type**: Bearer
   - **API Key**: Your JWT token

### 4. Test URLs with your ngrok domain
- Health: `https://YOUR-NGROK-ID.ngrok.io/health`
- MCP: `https://YOUR-NGROK-ID.ngrok.io/mcp`

## Alternative: Use Cloudflare Tunnel (Free, no signup)

If you prefer not to sign up for ngrok:

```bash
# Install cloudflared
brew install cloudflared

# Start tunnel
cloudflared tunnel --url http://localhost:3000
```

This will give you a URL like: `https://random-name.trycloudflare.com`

## Testing Your Connection

Once ngrok is running:

```bash
# Test health endpoint
curl https://YOUR-NGROK-ID.ngrok.io/health

# Test with auth
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://YOUR-NGROK-ID.ngrok.io/health
```

## ChatGPT Custom GPT Configuration

### Simple Test Configuration

1. **Name**: Jamf Device Manager (Dev)
2. **Description**: Manage Apple devices through Jamf Pro
3. **Instructions**: 
   ```
   You are a Jamf Pro device management assistant. You can search for devices, 
   check compliance, and manage Apple devices through the Jamf API.
   ```

4. **Actions**: Add custom action
   - Import from URL: `https://YOUR-NGROK-ID.ngrok.io/openapi.json`
   - Or manually configure the endpoints

### Authentication in ChatGPT
- Type: API Key
- Auth Type: Bearer
- API Key: `[Your JWT token from generate-dev-token.js]`

## Quick Commands Reference

```bash
# 1. Sign up and get authtoken from https://dashboard.ngrok.com

# 2. Configure ngrok
ngrok authtoken YOUR_TOKEN

# 3. Start tunnel
ngrok http 3000

# 4. Note your public URL (https://xxxxx.ngrok.io)

# 5. Test it
curl https://xxxxx.ngrok.io/health
```