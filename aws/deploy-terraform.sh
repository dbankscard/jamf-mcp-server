#!/bin/bash
set -euo pipefail

# AWS Terraform Deployment Script for Jamf MCP Server
# This script guides you through deploying with Terraform

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Jamf MCP Server - AWS Terraform Deployment${NC}"
echo -e "${GREEN}============================================${NC}"

# Check prerequisites
command -v terraform >/dev/null 2>&1 || { echo -e "${RED}❌ Terraform is required but not installed.${NC}" >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo -e "${RED}❌ AWS CLI is required but not installed.${NC}" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker is required but not installed.${NC}" >&2; exit 1; }

# Change to terraform directory
cd "$(dirname "$0")/terraform"

echo -e "\n${YELLOW}📋 Prerequisites Check${NC}"
echo -e "✓ Terraform installed"
echo -e "✓ AWS CLI installed"
echo -e "✓ Docker installed"

# Check Docker daemon
if ! docker info > /dev/null 2>&1; then
    echo -e "\n${RED}❌ Docker daemon is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Get AWS account info
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
AWS_REGION="${AWS_REGION:-us-east-1}"

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "\n${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}🔍 AWS Configuration${NC}"
echo -e "   Account ID: ${AWS_ACCOUNT_ID}"
echo -e "   Region: ${AWS_REGION}"

# Initialize Terraform
echo -e "\n${YELLOW}📦 Initializing Terraform...${NC}"
terraform init

# Check if we need to collect sensitive data
echo -e "\n${YELLOW}🔐 Credential Configuration${NC}"
echo -e "You'll need to provide the following credentials:"
echo -e "   • Jamf Pro API credentials"
echo -e "   • Auth0/OAuth provider credentials"
echo -e "\n${BLUE}Note: These will be stored securely in AWS Secrets Manager${NC}"

# Create terraform.tfvars if it doesn't exist
if [ ! -f terraform.tfvars ]; then
    cp terraform.tfvars.example terraform.tfvars
    echo -e "\n${YELLOW}Created terraform.tfvars from template${NC}"
fi

echo -e "\n${YELLOW}⚠️  IMPORTANT: Before proceeding, you need to:${NC}"
echo -e "1. Edit terraform.tfvars with your actual configuration"
echo -e "2. Set up Auth0 or your OAuth provider"
echo -e "3. (Optional) Create an ACM certificate for HTTPS"
echo -e "\n${BLUE}Press Enter when ready to continue...${NC}"
read -r

# Validate Terraform configuration
echo -e "\n${YELLOW}✅ Validating Terraform configuration...${NC}"
if terraform validate; then
    echo -e "${GREEN}✓ Configuration is valid${NC}"
else
    echo -e "${RED}❌ Configuration validation failed${NC}"
    exit 1
fi

# Show Terraform plan
echo -e "\n${YELLOW}📋 Terraform Plan${NC}"
terraform plan -out=tfplan

echo -e "\n${YELLOW}🚨 Review the plan above carefully!${NC}"
echo -e "${BLUE}Do you want to apply this plan? (yes/no):${NC} "
read -r response

if [[ "$response" != "yes" ]]; then
    echo -e "${YELLOW}Deployment cancelled.${NC}"
    rm -f tfplan
    exit 0
fi

# Apply Terraform configuration
echo -e "\n${YELLOW}🚀 Applying Terraform configuration...${NC}"
terraform apply tfplan

# Clean up plan file
rm -f tfplan

# Get outputs
echo -e "\n${GREEN}✅ Deployment Complete!${NC}"
echo -e "\n${YELLOW}📊 Deployment Information:${NC}"

ALB_DNS=$(terraform output -raw alb_dns_name 2>/dev/null || echo "")
ECR_REPO=$(terraform output -raw ecr_repository_url 2>/dev/null || echo "")

if [ -n "$ALB_DNS" ]; then
    echo -e "   ALB URL: https://${ALB_DNS}"
fi

if [ -n "$ECR_REPO" ]; then
    echo -e "   ECR Repository: ${ECR_REPO}"
fi

echo -e "\n${YELLOW}📝 Next Steps:${NC}"
echo -e "1. Build and push Docker image:"
echo -e "   ${BLUE}cd ../../${NC}"
echo -e "   ${BLUE}docker build -t jamf-mcp-server .${NC}"
echo -e "   ${BLUE}aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com${NC}"
echo -e "   ${BLUE}docker tag jamf-mcp-server:latest ${ECR_REPO}:latest${NC}"
echo -e "   ${BLUE}docker push ${ECR_REPO}:latest${NC}"
echo -e ""
echo -e "2. Update ECS service to use new image:"
echo -e "   ${BLUE}aws ecs update-service --cluster jamf-mcp-server-cluster --service jamf-mcp-server-service --force-new-deployment${NC}"
echo -e ""
echo -e "3. Configure ChatGPT connector:"
echo -e "   - Server URL: https://${ALB_DNS}/mcp"
echo -e "   - OAuth Authorization URL: https://${ALB_DNS}/auth/authorize"
echo -e "   - OAuth Token URL: https://${ALB_DNS}/auth/callback"
echo -e ""
echo -e "4. (Optional) Set up custom domain:"
echo -e "   - Point your domain to: ${ALB_DNS}"
echo -e "   - Update certificate_arn in terraform.tfvars"
echo -e "   - Run terraform apply again"

echo -e "\n${GREEN}✨ Deployment script completed!${NC}"