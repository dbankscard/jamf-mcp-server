# Slack Integration Setup Guide

This guide walks through setting up the Slack integration for the Jamf Bedrock Agent.

## Prerequisites

- AWS account with Bedrock access
- Deployed MCP server (via ECS)
- Slack workspace with admin permissions
- AWS CLI configured

## Step 1: Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name: "Jamf Assistant"
4. Select your workspace

### Configure Bot Token Scopes

In OAuth & Permissions, add these bot token scopes:
- `chat:write` - Send messages
- `chat:write.public` - Send to public channels
- `commands` - Register slash commands
- `app_mentions:read` - Respond to mentions
- `im:history` - Read DM history
- `im:write` - Send DMs
- `users:read` - Get user info

### Enable Events

In Event Subscriptions:
1. Enable Events
2. Add bot event subscriptions:
   - `app_mention` - When someone mentions the bot
   - `message.im` - Direct messages

### Create Slash Command

In Slash Commands, create:
- Command: `/jamf`
- Request URL: (will be filled after deployment)
- Short Description: "Manage Apple devices with Jamf"
- Usage Hint: "find devices in conference room"

## Step 2: Prepare InlineAgent SDK

```bash
cd jamf-bedrock-agent

# Run setup script to get InlineAgent SDK
python setup_inline_agent.py

# This will:
# - Clone AWS Bedrock Agent samples
# - Install InlineAgent SDK
# - Create environment template
```

## Step 3: Build Lambda Deployment Package

```bash
cd lambda

# Make deploy script executable
chmod +x deploy.sh

# Build deployment packages
./deploy.sh

# This creates:
# - lambda-deployment.zip (Lambda function)
# - inline-agent-layer.zip (InlineAgent SDK layer)
```

## Step 4: Upload to S3

```bash
# Create S3 bucket for deployment
aws s3 mb s3://jamf-slack-deployment-${AWS_ACCOUNT_ID}

# Upload Lambda deployment package
aws s3 cp lambda-deployment.zip s3://jamf-slack-deployment-${AWS_ACCOUNT_ID}/lambda/slack-handler.zip

# Upload layer
aws s3 cp inline-agent-layer.zip s3://jamf-slack-deployment-${AWS_ACCOUNT_ID}/layers/inline-agent-layer.zip
```

## Step 5: Deploy CloudFormation Stack

```bash
# Deploy the Slack integration stack
aws cloudformation create-stack \
  --stack-name jamf-slack-integration \
  --template-body file://cloudformation/slack-integration.yaml \
  --parameters \
    ParameterKey=SlackBotToken,ParameterValue=xoxb-your-bot-token \
    ParameterKey=SlackSigningSecret,ParameterValue=your-signing-secret \
    ParameterKey=SlackAppId,ParameterValue=your-app-id \
    ParameterKey=MCPServerUrl,ParameterValue=http://jamf-mcp-alb.internal:3000 \
  --capabilities CAPABILITY_IAM

# Wait for stack creation
aws cloudformation wait stack-create-complete \
  --stack-name jamf-slack-integration

# Get the webhook URLs
aws cloudformation describe-stacks \
  --stack-name jamf-slack-integration \
  --query 'Stacks[0].Outputs'
```

## Step 6: Configure Slack Webhooks

1. Copy the webhook URLs from CloudFormation outputs
2. In your Slack app settings:
   - Slash Commands → Edit `/jamf` → Request URL: `{SlashCommandUrl}`
   - Event Subscriptions → Request URL: `{EventsUrl}`
   - Interactivity & Shortcuts → Request URL: `{InteractiveUrl}`

3. Verify each URL (Slack will send a challenge)

## Step 7: Install App to Workspace

1. In your Slack app settings, go to "Install App"
2. Click "Install to Workspace"
3. Review and authorize permissions
4. Copy the Bot User OAuth Token (starts with `xoxb-`)

## Step 8: Test the Integration

### Test Slash Command
```
/jamf help
/jamf find MacBooks in engineering
/jamf show device ABC123
```

### Test App Mention
```
@Jamf Assistant show me devices with low storage
```

### Test Direct Message
Open a DM with the bot and type:
```
What's the status of the conference room iPad?
```

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│    Slack    │────▶│ API Gateway  │────▶│   Lambda    │
│  Workspace  │     │   (HTTPS)    │     │  Handler    │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │ InlineAgent │
                                          │   System    │
                                          └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │ MCP Server  │
                                          │   (ECS)     │
                                          └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  Jamf Pro   │
                                          │    API      │
                                          └─────────────┘
```

## Security Considerations

1. **Request Verification**: All Slack requests are verified using HMAC
2. **Secrets Management**: Credentials stored in AWS Secrets Manager
3. **Network Isolation**: Lambda runs in VPC with access only to MCP server
4. **Least Privilege**: IAM roles have minimal required permissions
5. **Audit Logging**: All actions logged to CloudWatch

## Monitoring

### CloudWatch Dashboards
The deployment creates alarms for:
- Lambda errors
- Lambda throttling
- API Gateway 4xx/5xx errors

### Logs
- Lambda logs: `/aws/lambda/jamf-slack-handler`
- API Gateway logs: Available in CloudWatch

### Metrics to Monitor
- Lambda invocation count
- Lambda duration
- Lambda concurrent executions
- API Gateway request count
- DynamoDB consumed capacity

## Troubleshooting

### Slack Request Timeout
If Slack shows timeout errors:
1. Check Lambda timeout (should be 300s)
2. Ensure Lambda has enough memory (1024MB+)
3. Check MCP server response times

### Authentication Errors
1. Verify Slack tokens in Secrets Manager
2. Check Lambda environment variables
3. Ensure signing secret is correct

### MCP Connection Issues
1. Verify security groups allow Lambda → ECS
2. Check MCP server is running
3. Verify MCP_SERVER_URL environment variable

### Agent Not Responding
1. Check CloudWatch logs for errors
2. Verify Bedrock model access
3. Check InlineAgent layer is attached

## Cost Optimization

1. **Use Fargate Spot** for MCP server (70% savings)
2. **DynamoDB On-Demand** for variable workload
3. **Lambda Reserved Concurrency** to control costs
4. **CloudWatch Log Retention** set to 30 days

## Next Steps

1. Set up monitoring dashboards
2. Configure alerting for critical errors
3. Implement rate limiting if needed
4. Add custom Slack workflows
5. Enable knowledge bases (see TODO.md)