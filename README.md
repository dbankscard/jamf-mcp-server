# Jamf MCP Server - ChatGPT Connector

Connect ChatGPT to your Jamf Pro instance using the Model Context Protocol (MCP). Query and manage Apple devices using natural language through ChatGPT's new MCP Connector feature (BETA).

<p align="center">
  <img src="docs/images/chatgpt-apps-connectors-page.png" alt="ChatGPT MCP Connector" width="600">
</p>

## 🚀 Quick Start

Get up and running in 5 minutes with our [Quick Start Guide](QUICK_START.md).

```bash
# Clone and run
git clone https://github.com/dbankscard/jamf-mcp-server.git
cd jamf-mcp-server
./start-chatgpt-poc.sh
```

## 🎯 What You Can Do

Ask ChatGPT natural language questions about your Jamf devices:
- "Find all MacBooks that haven't checked in for 7 days"
- "Show me device compliance statistics"
- "Search for devices assigned to the marketing department"
- "List computers with low disk space"

## 📋 Prerequisites

- Node.js 18+ installed
- Jamf Pro instance with API credentials
- ChatGPT Plus subscription (for MCP Connectors)
- Cloudflare or ngrok for tunneling

## 📚 Documentation

- [**Quick Start Guide**](QUICK_START.md) - Fork and deploy in 5 minutes
- [**Full Setup Guide**](CHATGPT_CONNECTOR_README.md) - Detailed setup instructions
- [**POC Setup**](PROOF_OF_CONCEPT_SETUP.md) - Local development with tunnels
- [**Architecture**](docs/CHATGPT_CONNECTOR_FLOW.md) - How it works
- [**Deployment Guide**](docs/CHATGPT_DEPLOYMENT.md) - Production deployment

## 🏗️ Architecture

```
ChatGPT MCP Connector ↔️ Tunnel (Cloudflare/ngrok) ↔️ MCP Server ↔️ Jamf Pro API
```

The server implements the Model Context Protocol with JSON-RPC, enabling ChatGPT to:
- Send natural language requests
- Execute MCP tools (search_computers, check_compliance)
- Receive formatted responses from your Jamf instance

## 🔧 Available MCP Tools

1. **search_computers** - Search devices by name, serial number, or user
2. **check_compliance** - Check device compliance based on check-in frequency

More tools can be easily added by extending the MCP tool definitions.

## 🛡️ Security

⚠️ **This POC uses development authentication for testing**

For production use:
- Implement proper OAuth2 authentication
- Deploy to a secure cloud environment
- Use HTTPS with valid certificates
- Enable rate limiting and access controls
- Use read-only Jamf API credentials

## 🤝 Contributing

This project is designed to be forked and extended. Feel free to:
- Add new MCP tools for different Jamf operations
- Implement additional security features
- Create connectors for other MDM systems
- Share your improvements with the community

## 📝 License

This project is open source and available under the MIT License.

## 🔗 Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Jamf Pro API Documentation](https://developer.jamf.com/)
- [ChatGPT MCP Connectors](https://help.openai.com/en/articles/9824990-using-connectors-in-chatgpt)

## 💬 Support

- [Create an Issue](https://github.com/dbankscard/jamf-mcp-server/issues)
- [View Documentation](docs/)
- [Fork this Repository](https://github.com/dbankscard/jamf-mcp-server/fork)

---

Built with ❤️ for the Jamf and ChatGPT communities
EOF < /dev/null