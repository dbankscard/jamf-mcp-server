#!/bin/bash
set -euo pipefail

# Quick deployment guide for Jamf MCP Server to AWS
# This provides step-by-step instructions without full automation

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Jamf MCP Server - AWS Deployment Guide${NC}"
echo -e "${GREEN}==========================================${NC}"

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "\n${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}📋 Step 1: Create AWS Secrets${NC}"
echo -e "First, we need to store your credentials securely in AWS Secrets Manager."
echo -e "\nRun this command with your actual values:"
echo -e "${BLUE}aws secretsmanager create-secret \\
    --name jamf-mcp-server/production \\
    --secret-string '{
        \"JAMF_URL\": \"https://your-instance.jamfcloud.com\",
        \"JAMF_CLIENT_ID\": \"your-client-id\",
        \"JAMF_CLIENT_SECRET\": \"your-client-secret\",
        \"AUTH0_DOMAIN\": \"your-tenant.auth0.com\",
        \"AUTH0_CLIENT_ID\": \"your-auth0-client-id\",
        \"AUTH0_CLIENT_SECRET\": \"your-auth0-client-secret\",
        \"AUTH0_AUDIENCE\": \"https://your-api-identifier\",
        \"REQUIRED_SCOPES\": \"read:jamf write:jamf\"
    }'${NC}"

echo -e "\n${YELLOW}📋 Step 2: Create ECR Repository${NC}"
echo -e "Create a repository to store your Docker image:"
echo -e "${BLUE}aws ecr create-repository --repository-name jamf-mcp-server --region ${AWS_REGION}${NC}"

echo -e "\n${YELLOW}📋 Step 3: Build and Push Docker Image${NC}"
echo -e "Make sure Docker is running, then:"
echo -e "${BLUE}# Login to ECR
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build the image (from project root)
docker build -t jamf-mcp-server .

# Tag the image
docker tag jamf-mcp-server:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/jamf-mcp-server:latest

# Push the image
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/jamf-mcp-server:latest${NC}"

echo -e "\n${YELLOW}📋 Step 4: Deploy Infrastructure${NC}"
echo -e "You have two options:"
echo -e "\n${GREEN}Option A: Use Terraform (Recommended)${NC}"
echo -e "${BLUE}cd aws/terraform
terraform init
# Edit terraform.tfvars with your configuration
terraform plan
terraform apply${NC}"

echo -e "\n${GREEN}Option B: Use the deployment script${NC}"
echo -e "${BLUE}./aws/deploy.sh${NC}"

echo -e "\n${YELLOW}📋 Step 5: Configure ChatGPT${NC}"
echo -e "After deployment, configure your ChatGPT custom connector with:"
echo -e "• Server URL: https://your-alb-dns.com/mcp"
echo -e "• OAuth Authorization URL: https://your-alb-dns.com/auth/authorize"
echo -e "• OAuth Token URL: https://your-alb-dns.com/auth/callback"
echo -e "• OAuth Scopes: openid profile email offline_access"

echo -e "\n${YELLOW}📝 Important Notes:${NC}"
echo -e "• Ensure your Auth0/OAuth provider is configured with the correct callback URLs"
echo -e "• The ALB DNS name will be shown after deployment"
echo -e "• Consider using a custom domain with ACM certificate for production"
echo -e "• Monitor CloudWatch logs for any issues"

echo -e "\n${BLUE}Press Enter to see current AWS resources...${NC}"
read -r

echo -e "\n${YELLOW}🔍 Current AWS Resources:${NC}"
echo -e "\n${GREEN}ECR Repositories:${NC}"
aws ecr describe-repositories --region ${AWS_REGION} 2>/dev/null | jq -r '.repositories[].repositoryName' || echo "None found"

echo -e "\n${GREEN}ECS Clusters:${NC}"
aws ecs list-clusters --region ${AWS_REGION} 2>/dev/null | jq -r '.clusterArns[]' | awk -F'/' '{print $NF}' || echo "None found"

echo -e "\n${GREEN}Secrets:${NC}"
aws secretsmanager list-secrets --region ${AWS_REGION} 2>/dev/null | jq -r '.SecretList[].Name' | grep jamf-mcp || echo "None found"

echo -e "\n${GREEN}✨ Ready to deploy!${NC}"