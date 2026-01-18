#!/bin/bash

# Set environment variables
# export OPENAI_API_KEY="your-openai-api-key-here"
export JAMF_URL="https://your-jamf-instance.jamfcloud.com"
export JAMF_CLIENT_ID="your-client-id-here"
export JAMF_CLIENT_SECRET="your-client-secret-here"

# Force mock AI provider
export AGENT_AI_PROVIDER="mock"

# Run the agent
npm run agent