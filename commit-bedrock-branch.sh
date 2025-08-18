#!/bin/bash

# Script to commit and push the Bedrock AgentCore branch

echo "📝 Preparing to commit Bedrock AgentCore implementation..."

# Ensure we're in the right directory
cd /Users/dbanks/Projects/jamf-mcp-server

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "feature/bedrock-agentcore-slack" ]; then
    echo "⚠️  Not on the correct branch. Switching to feature/bedrock-agentcore-slack..."
    git checkout -b feature/bedrock-agentcore-slack
fi

# Add all the new Bedrock agent files
echo "➕ Adding new files..."
git add jamf-bedrock-agent/
git add CLAUDE.md  # Updated CLAUDE.md if modified

# Show what will be committed
echo ""
echo "📋 Files to be committed:"
git status --short

# Create commit
echo ""
echo "💾 Creating commit..."
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

# Push to remote
echo ""
echo "🚀 Pushing to remote..."
git push -u origin feature/bedrock-agentcore-slack

echo ""
echo "✅ Done! Branch pushed to remote."
echo ""
echo "📋 Next steps on your work computer:"
echo "1. git fetch origin"
echo "2. git checkout feature/bedrock-agentcore-slack"
echo "3. Continue with deployment!"