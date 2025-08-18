# Git Commit Instructions for Bedrock AgentCore Branch

Run these commands in your terminal to commit and push the branch:

```bash
# 1. Navigate to the project directory
cd /Users/dbanks/Projects/jamf-mcp-server

# 2. Verify you're on the correct branch
git branch --show-current
# Should show: feature/bedrock-agentcore-slack

# 3. If not on the correct branch, switch to it
git checkout feature/bedrock-agentcore-slack

# 4. Add all the new Bedrock agent files
git add jamf-bedrock-agent/
git add CLAUDE.md
git add commit-bedrock-branch.sh
git add COMMIT_INSTRUCTIONS.md

# 5. Check what will be committed
git status

# 6. Create the commit
git commit -m "Add AWS Bedrock AgentCore implementation with Slack integration

- Implement InlineAgent pattern following official AWS samples
- Create Lambda handler for Slack integration
- Add CloudFormation templates for AWS deployment
- Configure MCP server integration via tool wrappers
- Add comprehensive documentation and setup guides
- Include test scripts for MCP connection validation

This enables natural language Jamf device management through Slack
using AWS Bedrock agents that connect to the MCP server.

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# 7. Push to remote with upstream tracking
git push -u origin feature/bedrock-agentcore-slack
```

## On your work computer:

```bash
# 1. Fetch the latest branches
git fetch origin

# 2. Checkout the feature branch
git checkout feature/bedrock-agentcore-slack

# 3. Verify you have all the files
ls -la jamf-bedrock-agent/
```

## Files created in this session:

- `jamf-bedrock-agent/agent/jamf_inline_agent.py` - Main InlineAgent implementation
- `jamf-bedrock-agent/lambda/slack_handler.py` - Slack integration Lambda
- `jamf-bedrock-agent/lambda/requirements.txt` - Lambda dependencies
- `jamf-bedrock-agent/lambda/deploy.sh` - Deployment script
- `jamf-bedrock-agent/cloudformation/slack-integration.yaml` - Slack infrastructure
- `jamf-bedrock-agent/docs/slack-setup.md` - Slack setup guide
- `jamf-bedrock-agent/examples/simple_jamf_agent.py` - Simple example
- `jamf-bedrock-agent/setup_inline_agent.py` - Setup script
- `jamf-bedrock-agent/test_mcp_connection.py` - Connection tester
- `jamf-bedrock-agent/README.md` - Project documentation