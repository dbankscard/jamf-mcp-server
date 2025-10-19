#!/bin/bash

# Test MCP SSE connection

echo "🚀 Testing MCP Server-Sent Events Connection"
echo "==========================================="

# Get token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlci0wMDEiLCJlbWFpbCI6ImRldkBqYW1mLW1jcC5sb2NhbCIsIm5hbWUiOiJEZXZlbG9wbWVudCBVc2VyIiwic2NvcGUiOiJyZWFkOmphbWYgd3JpdGU6amFtZiIsInBlcm1pc3Npb25zIjpbInJlYWQ6amFtZiIsIndyaXRlOmphbWYiXSwiaWF0IjoxNzYwODk1MTYxLCJleHAiOjE3NjE0OTk5NjF9.U6Au2fzy7AewSsRKdjhgTRd8nVFdApVpHJGRxKgNERM"

echo "Connecting to MCP endpoint (SSE)..."
echo "Press Ctrl+C to stop"
echo ""

# Connect to SSE endpoint
curl -N -H "Authorization: Bearer $TOKEN" \
     -H "Accept: text/event-stream" \
     -H "Cache-Control: no-cache" \
     http://localhost:3000/mcp