"""
Setup script for Jamf InlineAgent following AWS Bedrock Agent samples

This sets up the InlineAgent SDK from the official AWS samples repository.
"""

import os
import subprocess
import sys


def setup_inline_agent():
    """
    Set up the InlineAgent SDK following the official AWS pattern.
    
    Based on: https://github.com/awslabs/amazon-bedrock-agent-samples
    """
    
    print("🚀 Setting up Jamf InlineAgent following AWS Bedrock samples...")
    
    # Step 1: Clone the AWS samples repository if needed
    if not os.path.exists("amazon-bedrock-agent-samples"):
        print("📥 Cloning AWS Bedrock Agent samples...")
        subprocess.run([
            "git", "clone", 
            "https://github.com/awslabs/amazon-bedrock-agent-samples.git"
        ], check=True)
    
    # Step 2: Install InlineAgent from the samples
    print("📦 Installing InlineAgent SDK...")
    inline_agent_path = "amazon-bedrock-agent-samples/src/InlineAgent"
    
    if os.path.exists(inline_agent_path):
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-e", inline_agent_path
        ], check=True)
    else:
        print("❌ InlineAgent not found in samples. Please check the repository structure.")
        return False
    
    # Step 3: Install other dependencies
    print("📦 Installing additional dependencies...")
    dependencies = [
        "boto3>=1.28.0",
        "httpx",  # For MCP HTTP client
        "mcp",    # For MCP protocol
        "asyncio",
        "python-dotenv"
    ]
    
    subprocess.run([
        sys.executable, "-m", "pip", "install"
    ] + dependencies, check=True)
    
    # Step 4: Create environment template
    print("📝 Creating environment template...")
    env_template = """# Jamf MCP Server Configuration
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_CLIENT_ID=your-client-id
JAMF_CLIENT_SECRET=your-client-secret

# AWS Configuration
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
SUPERVISOR_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0

# MCP Server Configuration
MCP_SERVER_URL=http://localhost:3000  # For local development
ENVIRONMENT=development

# Slack Configuration (for production)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_ID=your-app-id
"""
    
    with open(".env.template", "w") as f:
        f.write(env_template)
    
    print("✅ Setup complete!")
    print("\n📋 Next steps:")
    print("1. Copy .env.template to .env and fill in your credentials")
    print("2. Run the MCP server: npm run serve (in the parent directory)")
    print("3. Test the agent: python agent/jamf_inline_agent.py")
    
    return True


def create_requirements_txt():
    """Create requirements.txt for the project"""
    
    requirements = """# Jamf Bedrock Agent Requirements

# AWS Bedrock Agent Samples (installed from git)
# git+https://github.com/awslabs/amazon-bedrock-agent-samples.git#subdirectory=src/InlineAgent

# AWS SDK
boto3>=1.28.0
botocore>=1.31.0

# MCP Integration
mcp>=0.1.0
httpx>=0.24.0

# Async support
asyncio
aiohttp>=3.8.0

# Slack integration
slack-sdk>=3.26.0

# Utilities
python-dotenv>=1.0.0
pydantic>=2.0.0

# Development
pytest>=7.0.0
pytest-asyncio>=0.21.0
black>=23.0.0
"""
    
    with open("requirements.txt", "w") as f:
        f.write(requirements)
    
    print("📄 Created requirements.txt")


if __name__ == "__main__":
    # Create requirements file
    create_requirements_txt()
    
    # Run setup
    if setup_inline_agent():
        print("\n🎉 Jamf InlineAgent is ready to use!")
        print("Follow the AWS Bedrock Agent samples pattern for best practices.")
    else:
        print("\n❌ Setup failed. Please check the errors above.")