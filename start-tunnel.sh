#!/bin/bash

# Start a public tunnel for ChatGPT testing

echo "🚀 Starting Public Tunnel for ChatGPT Testing"
echo "==========================================="

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "cloudflared not found. Installing..."
    brew install cloudflared
fi

echo ""
echo "Starting Cloudflare Tunnel (no account needed)..."
echo "This will give you a public URL for testing."
echo ""

# Start the tunnel
cloudflared tunnel --url http://localhost:3000