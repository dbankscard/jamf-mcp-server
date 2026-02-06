#!/bin/bash

# Set environment variables for AWS Bedrock
export AWS_ACCESS_KEY_ID="YOUR_AWS_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET_ACCESS_KEY"
export AWS_REGION="us-east-1"

# Jamf credentials
export JAMF_URL="https://your-jamf-instance.jamfcloud.com"
export JAMF_CLIENT_ID="your-client-id-here"
export JAMF_CLIENT_SECRET="your-client-secret-here"
export JAMF_USERNAME="your-username"
export JAMF_PASSWORD="your-password"

# Run the simple agent
npm run agent:simple