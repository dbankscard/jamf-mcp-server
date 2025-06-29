#!/bin/bash

# Simple script to check actual Jamf API response
echo "This script will help check the actual Jamf Classic API response"
echo "Make sure you have set these environment variables:"
echo "- JAMF_URL"
echo "- JAMF_USERNAME" 
echo "- JAMF_PASSWORD"
echo ""

if [ -z "$JAMF_URL" ] || [ -z "$JAMF_USERNAME" ] || [ -z "$JAMF_PASSWORD" ]; then
    echo "ERROR: Missing required environment variables"
    exit 1
fi

echo "Getting auth token..."
TOKEN=$(curl -s -X POST "$JAMF_URL/api/v1/auth/token" \
    -u "$JAMF_USERNAME:$JAMF_PASSWORD" \
    -H "Accept: application/json" | jq -r '.token')

if [ -z "$TOKEN" ]; then
    echo "ERROR: Failed to get auth token"
    exit 1
fi

echo "Fetching first computer from Classic API..."
echo ""

# Get list of computers
RESPONSE=$(curl -s -X GET "$JAMF_URL/JSSResource/computers" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/json")

# Extract first computer ID
FIRST_ID=$(echo "$RESPONSE" | jq -r '.computers[0].id')

if [ -z "$FIRST_ID" ]; then
    echo "ERROR: No computers found"
    echo "Response: $RESPONSE"
    exit 1
fi

echo "Found computer ID: $FIRST_ID"
echo ""
echo "Getting computer details..."
echo ""

# Get computer details
DETAILS=$(curl -s -X GET "$JAMF_URL/JSSResource/computers/id/$FIRST_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/json")

# Show relevant date fields
echo "=== Date-related fields from computer $FIRST_ID ==="
echo ""
echo "From list response:"
echo "$RESPONSE" | jq '.computers[0]' | grep -E "(date|time|Date|Time|epoch)"
echo ""
echo "From details response (general section):"
echo "$DETAILS" | jq '.computer.general' | grep -E "(date|time|Date|Time|epoch)"
echo ""
echo "All keys in general section:"
echo "$DETAILS" | jq '.computer.general | keys'