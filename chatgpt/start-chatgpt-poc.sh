#!/bin/bash

# Jamf MCP Server - ChatGPT POC Quick Start Script

echo "🚀 Jamf MCP Server - ChatGPT Connector POC"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Creating from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  Please edit .env with your Jamf credentials:"
    echo "   - JAMF_URL"
    echo "   - JAMF_CLIENT_ID"
    echo "   - JAMF_CLIENT_SECRET"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build if needed
if [ ! -d "dist" ]; then
    echo "🔨 Building project..."
    npm run build
fi

echo ""
echo "✅ Starting MCP server..."
echo "   Server will run on http://localhost:3000"
echo ""

# Start the server
npm run serve:http