# Jamf Bedrock Agent

AWS Bedrock-powered natural language interface for Jamf Pro device management. This agent enables conversational interactions with Jamf Pro through Slack, allowing IT teams to manage Apple devices using natural language commands.

## Features

- 🤖 Natural language device management through Slack
- 🔍 Intelligent device search and discovery
- 📊 Real-time device status and compliance reporting
- 🚀 Policy execution with safety confirmations
- 📱 Multi-device management capabilities
- 🔐 Secure AWS Bedrock integration
- 💬 Conversational context maintained across interactions
- ⚡ Streaming responses for real-time updates
- 🎯 Slash commands for quick actions

## Architecture

The system follows the official AWS Bedrock Agent samples pattern using InlineAgent:

1. **Slack Integration** - API Gateway + Lambda handler for Slack events
2. **InlineAgent System** - Orchestrates natural language processing
3. **MCP Server** - Provides secure access to Jamf Pro APIs
4. **Tool Functions** - Python functions that wrap MCP server tools

The implementation uses the InlineAgent pattern from AWS samples for proper Bedrock integration.

## Quick Start

### Prerequisites

- AWS account with Bedrock access
- Jamf Pro instance with API credentials
- Slack workspace admin access
- Python 3.11+
- Node.js 18+ (for MCP server)

### Installation

1. **Clone and setup**:
```bash
# Clone the repository
git clone <your-repo>
cd jamf-mcp-server/jamf-bedrock-agent

# Install InlineAgent SDK
python setup_inline_agent.py

# Copy and configure environment
cp .env.template .env
# Edit .env with your credentials
```

2. **Test MCP connection**:
```bash
# Start MCP server (in parent directory)
cd ..
npm install
npm run serve

# In another terminal, test connection
cd jamf-bedrock-agent
python test_mcp_connection.py
```

3. **Deploy to AWS**:
```bash
# Build Lambda packages
cd lambda
./deploy.sh

# Deploy infrastructure (see docs/deployment.md)
```

## Usage Examples

### Slack Commands

```
/jamf find MacBooks in engineering
/jamf show device with serial ABC123
/jamf update inventory for device 42
/jamf check compliance for all devices
```

### Natural Language Queries

Ask questions like:
- "Which devices haven't checked in for 30 days?"
- "Show me all iPads with less than 20% storage"
- "What's the OS distribution across our Mac fleet?"
- "Execute the 'Update Software' policy on John's MacBook"

## Project Structure

```
jamf-bedrock-agent/
├── agent/                    # InlineAgent implementation
│   └── jamf_inline_agent.py # Main agent system
├── lambda/                   # Slack integration
│   ├── slack_handler.py     # Lambda handler
│   └── deploy.sh            # Deployment script
├── cloudformation/          # AWS infrastructure
│   ├── mcp-server.yaml     # MCP server on ECS
│   └── slack-integration.yaml # Slack Lambda
├── examples/                # Usage examples
│   └── simple_jamf_agent.py # Basic example
├── docs/                    # Documentation
│   ├── deployment.md       # Full deployment guide
│   └── slack-setup.md      # Slack configuration
└── test_mcp_connection.py  # Connection tester
```

## Key Components

### InlineAgent System

The core agent system (`agent/jamf_inline_agent.py`) implements:
- Tool function wrappers for MCP server integration
- Multi-agent architecture with specialized agents
- Session management for conversation continuity
- Streaming response support

### MCP Server Integration

Tool functions wrap MCP server calls:
```python
async def search_devices(query: str, limit: int = 50) -> dict:
    """Search for devices in Jamf Pro"""
    mcp_result = await mcp_client.call_tool("searchDevices", {
        "query": query,
        "limit": limit
    })
    return json.loads(mcp_result.content[0].text)
```

### Slack Handler

Lambda function (`lambda/slack_handler.py`) handles:
- Slash commands (`/jamf`)
- App mentions (`@Jamf Assistant`)
- Direct messages
- Interactive components
- Request verification

## Security

- **Authentication**: OAuth2 for Jamf, HMAC for Slack
- **Secrets**: AWS Secrets Manager for credentials
- **Network**: VPC isolation, security groups
- **Permissions**: Least privilege IAM roles
- **Validation**: Input validation and safety checks

## Deployment

See [docs/deployment.md](docs/deployment.md) for full deployment instructions.

Quick deployment:
```bash
# Deploy MCP server to ECS
aws cloudformation create-stack \
  --stack-name jamf-mcp-infrastructure \
  --template-body file://cloudformation/mcp-server.yaml

# Deploy Slack integration
aws cloudformation create-stack \
  --stack-name jamf-slack-integration \
  --template-body file://cloudformation/slack-integration.yaml
```

## Cost Optimization

- **Fargate Spot**: 70% savings on ECS tasks
- **DynamoDB On-Demand**: Pay only for usage
- **Lambda**: Billed per invocation
- **VPC Endpoints**: Reduce data transfer costs

Estimated monthly cost: ~$50-100 for moderate usage

## Monitoring

- CloudWatch dashboards for all components
- Alarms for errors and throttling
- X-Ray tracing for request flow
- Slack notifications for critical issues

## Troubleshooting

### Common Issues

1. **Slack timeout errors**
   - Increase Lambda timeout
   - Check MCP server response time

2. **MCP connection failures**
   - Verify security groups
   - Check environment variables
   - Test with `test_mcp_connection.py`

3. **Agent not responding**
   - Check CloudWatch logs
   - Verify Bedrock model access
   - Ensure IAM permissions

## Future Enhancements

See [TODO.md](TODO.md) for planned features:
- Knowledge base integration
- Advanced analytics
- Custom workflows
- Multi-language support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

[Your License]

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](your-repo/issues)
- Slack: #jamf-automation channel