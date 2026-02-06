# Quick Start - Fork & Deploy Your Own ChatGPT MCP Connector

This branch is optimized for quickly setting up your own ChatGPT MCP connector to Jamf Pro.

## 🚀 5-Minute Setup

1. **Fork this repository** (use the `feature/chatgpt-connector` branch)

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/jamf-mcp-server.git
   cd jamf-mcp-server
   ```

3. **Configure your Jamf credentials:**
   ```bash
   cp .env.example .env
   # Edit .env with your Jamf Pro credentials
   ```

4. **Run the quick start script:**
   ```bash
   ./start-chatgpt-poc.sh
   ```

5. **Create a tunnel** (in a new terminal):
   ```bash
   # Using Cloudflare (recommended)
   cloudflared tunnel --url http://localhost:3000
   
   # OR using ngrok
   ngrok http 3000
   ```

6. **Configure ChatGPT:**
   - Go to ChatGPT → Apps & Connectors → Create → New Connector
   - Set MCP Server URL to your tunnel URL
   - Choose "None" for authentication (POC mode)

That's it\! Start chatting with your Jamf data through ChatGPT.

## 📚 Documentation

- [Full Setup Guide](CHATGPT_CONNECTOR_README.md)
- [Configuration Options](CHATGPT_CONFIGURATION.md)
- [Architecture Overview](docs/CHATGPT_CONNECTOR_FLOW.md)

## 🔒 Security Note

This POC uses development authentication. For production:
- Implement proper OAuth2
- Use HTTPS certificates
- Deploy to a secure cloud environment
- Use a read-only Jamf Pro API client
EOF < /dev/null