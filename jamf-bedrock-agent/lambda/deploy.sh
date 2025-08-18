#!/bin/bash

# Lambda deployment script for Slack handler
# This creates a deployment package with all dependencies

set -e

echo "🚀 Building Lambda deployment package..."

# Clean up any existing build
rm -rf build/
rm -f lambda-deployment.zip

# Create build directory
mkdir -p build/

# Copy Lambda handler
cp slack_handler.py build/

# Copy agent code (will be in Lambda layer)
mkdir -p build/agent/
cp ../agent/*.py build/agent/

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt -t build/ --upgrade

# Create deployment package
echo "📦 Creating deployment package..."
cd build/
zip -r ../lambda-deployment.zip . -x "*.pyc" -x "__pycache__/*"
cd ..

# Create Lambda layer for InlineAgent SDK
echo "📦 Creating Lambda layer for InlineAgent SDK..."
mkdir -p layer/python/
cp -r ../amazon-bedrock-agent-samples/src/InlineAgent layer/python/
cd layer/
zip -r ../inline-agent-layer.zip . -x "*.pyc" -x "__pycache__/*"
cd ..

# Clean up
rm -rf build/ layer/

echo "✅ Deployment packages created:"
echo "  - lambda-deployment.zip (Lambda function)"
echo "  - inline-agent-layer.zip (InlineAgent SDK layer)"
echo ""
echo "📋 Next steps:"
echo "1. Create Lambda layer: aws lambda publish-layer-version --layer-name inline-agent-sdk --zip-file fileb://inline-agent-layer.zip"
echo "2. Deploy Lambda function with the layer attached"
echo "3. Set up API Gateway for Slack webhook"
echo "4. Configure Slack app with webhook URL"