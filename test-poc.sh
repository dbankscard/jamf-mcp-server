#!/bin/bash

# Test script for POC setup

echo "🚀 Jamf MCP Server POC Test"
echo "=========================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Generate token
echo -e "\n${YELLOW}Generating JWT token...${NC}"
TOKEN=$(node generate-dev-token.js | grep "^eyJ" | head -1)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to generate token${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Token generated${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
HEALTH=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/health)

if [[ $HEALTH == *"healthy"* ]] || [[ $HEALTH == *"ok"* ]]; then
    echo -e "${GREEN}✓ Server is healthy${NC}"
    echo "Response: $HEALTH"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Response: $HEALTH"
fi

# Test auth endpoint
echo -e "\n${YELLOW}Testing authentication...${NC}"
AUTH_TEST=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/mcp)

echo "Auth response: $AUTH_TEST"

echo -e "\n${YELLOW}Server endpoints:${NC}"
echo "  Health: http://localhost:3000/health"
echo "  MCP: http://localhost:3000/mcp"
echo "  Auth: http://localhost:3000/auth/authorize"

echo -e "\n${YELLOW}Your JWT Token for testing:${NC}"
echo "$TOKEN"

echo -e "\n${GREEN}Ready to test with ChatGPT!${NC}"