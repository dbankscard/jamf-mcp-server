#!/bin/bash
set -euo pipefail

# AWS Deployment Script for Jamf MCP Server
# This script automates the deployment process to AWS ECS Fargate

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
CLUSTER_NAME="jamf-mcp-cluster"
SERVICE_NAME="jamf-mcp-service"
ECR_REPO_NAME="jamf-mcp-server"
STACK_PREFIX="jamf-mcp"

echo -e "${GREEN}🚀 Starting AWS deployment for Jamf MCP Server${NC}"

# Check prerequisites
command -v aws >/dev/null 2>&1 || { echo -e "${RED}❌ AWS CLI is required but not installed.${NC}" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker is required but not installed.${NC}" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${RED}❌ jq is required but not installed.${NC}" >&2; exit 1; }

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"
echo -e "${GREEN}✓ AWS Region: ${AWS_REGION}${NC}"

# Function to check if resource exists
resource_exists() {
    local resource_type=$1
    local resource_name=$2
    
    case $resource_type in
        "ecr")
            aws ecr describe-repositories --repository-names "$resource_name" --region "$AWS_REGION" >/dev/null 2>&1
            ;;
        "cluster")
            aws ecs describe-clusters --clusters "$resource_name" --region "$AWS_REGION" | jq -r '.clusters[0].status' | grep -q "ACTIVE"
            ;;
        "stack")
            aws cloudformation describe-stacks --stack-name "$resource_name" --region "$AWS_REGION" >/dev/null 2>&1
            ;;
    esac
}

# 1. Create ECR repository if it doesn't exist
echo -e "\n${YELLOW}📦 Setting up ECR repository...${NC}"
if ! resource_exists "ecr" "$ECR_REPO_NAME"; then
    aws ecr create-repository \
        --repository-name "$ECR_REPO_NAME" \
        --region "$AWS_REGION" \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256
    echo -e "${GREEN}✓ ECR repository created${NC}"
else
    echo -e "${GREEN}✓ ECR repository already exists${NC}"
fi

# 2. Build and push Docker image
echo -e "\n${YELLOW}🐳 Building and pushing Docker image...${NC}"

# Get ECR login
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin \
    "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build image
docker build -t "$ECR_REPO_NAME" .

# Tag image
IMAGE_TAG="latest"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"
docker tag "${ECR_REPO_NAME}:latest" "${ECR_URI}:${IMAGE_TAG}"
docker tag "${ECR_REPO_NAME}:latest" "${ECR_URI}:$(date +%Y%m%d-%H%M%S)"

# Push image
docker push "${ECR_URI}:${IMAGE_TAG}"
docker push "${ECR_URI}:$(date +%Y%m%d-%H%M%S)"
echo -e "${GREEN}✓ Docker image pushed to ECR${NC}"

# 3. Create/Update CloudFormation stacks
echo -e "\n${YELLOW}☁️  Setting up infrastructure...${NC}"

# Check if network stack exists
if ! resource_exists "stack" "${STACK_PREFIX}-network"; then
    echo -e "${YELLOW}Creating VPC and networking...${NC}"
    aws cloudformation create-stack \
        --stack-name "${STACK_PREFIX}-network" \
        --template-body file://aws/network-stack.yaml \
        --parameters ParameterKey=EnvironmentName,ParameterValue=production \
        --region "$AWS_REGION"
    
    echo -e "${YELLOW}⏳ Waiting for network stack to complete...${NC}"
    aws cloudformation wait stack-create-complete \
        --stack-name "${STACK_PREFIX}-network" \
        --region "$AWS_REGION"
    echo -e "${GREEN}✓ Network stack created${NC}"
else
    echo -e "${GREEN}✓ Network stack already exists${NC}"
fi

# Get certificate ARN
echo -e "\n${YELLOW}🔐 Enter your ACM certificate ARN (or press Enter to skip HTTPS):${NC}"
read -r CERTIFICATE_ARN

if [ -n "$CERTIFICATE_ARN" ]; then
    # Create ALB with HTTPS
    if ! resource_exists "stack" "${STACK_PREFIX}-alb"; then
        echo -e "${YELLOW}Creating Application Load Balancer...${NC}"
        aws cloudformation create-stack \
            --stack-name "${STACK_PREFIX}-alb" \
            --template-body file://aws/alb-stack.yaml \
            --parameters \
                ParameterKey=EnvironmentName,ParameterValue=production \
                ParameterKey=CertificateArn,ParameterValue="$CERTIFICATE_ARN" \
            --region "$AWS_REGION"
        
        echo -e "${YELLOW}⏳ Waiting for ALB stack to complete...${NC}"
        aws cloudformation wait stack-create-complete \
            --stack-name "${STACK_PREFIX}-alb" \
            --region "$AWS_REGION"
        echo -e "${GREEN}✓ ALB stack created${NC}"
    else
        echo -e "${GREEN}✓ ALB stack already exists${NC}"
    fi
fi

# 4. Create ECS cluster
echo -e "\n${YELLOW}🎯 Setting up ECS cluster...${NC}"
if ! resource_exists "cluster" "$CLUSTER_NAME"; then
    aws ecs create-cluster \
        --cluster-name "$CLUSTER_NAME" \
        --region "$AWS_REGION" \
        --settings name=containerInsights,value=enabled
    echo -e "${GREEN}✓ ECS cluster created${NC}"
else
    echo -e "${GREEN}✓ ECS cluster already exists${NC}"
fi

# 5. Create/Update task definition
echo -e "\n${YELLOW}📋 Registering task definition...${NC}"

# Update task definition with actual values
sed -e "s/\${AWS_ACCOUNT_ID}/${AWS_ACCOUNT_ID}/g" \
    -e "s/\${AWS_REGION}/${AWS_REGION}/g" \
    aws/task-definition.json > /tmp/task-definition.json

TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file:///tmp/task-definition.json \
    --region "$AWS_REGION" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)
echo -e "${GREEN}✓ Task definition registered: ${TASK_DEF_ARN}${NC}"

# 6. Create or update ECS service
echo -e "\n${YELLOW}🚀 Deploying ECS service...${NC}"

# Get subnet IDs
SUBNET_IDS=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_PREFIX}-network" \
    --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnets'].OutputValue" \
    --output text)

# Create security group for ECS tasks
SG_ID=$(aws ec2 create-security-group \
    --group-name "${STACK_PREFIX}-ecs-tasks-sg" \
    --description "Security group for ECS tasks" \
    --vpc-id "$(aws cloudformation describe-stacks \
        --stack-name "${STACK_PREFIX}-network" \
        --query "Stacks[0].Outputs[?OutputKey=='VPC'].OutputValue" \
        --output text)" \
    --query 'GroupId' \
    --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=${STACK_PREFIX}-ecs-tasks-sg" \
        --query 'SecurityGroups[0].GroupId' \
        --output text)

# Add ingress rule for ALB
aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 3000 \
    --source-group "$(aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=production-alb-sg" \
        --query 'SecurityGroups[0].GroupId' \
        --output text)" 2>/dev/null || true

# Check if service exists
if aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --region "$AWS_REGION" | jq -r '.services[0].status' | grep -q "ACTIVE"; then
    echo -e "${YELLOW}Updating existing service...${NC}"
    aws ecs update-service \
        --cluster "$CLUSTER_NAME" \
        --service "$SERVICE_NAME" \
        --task-definition "$TASK_DEF_ARN" \
        --force-new-deployment \
        --region "$AWS_REGION"
else
    echo -e "${YELLOW}Creating new service...${NC}"
    
    # Get target group ARN if ALB exists
    if [ -n "$CERTIFICATE_ARN" ]; then
        TARGET_GROUP_ARN=$(aws cloudformation describe-stacks \
            --stack-name "${STACK_PREFIX}-alb" \
            --query "Stacks[0].Outputs[?OutputKey=='TargetGroupArn'].OutputValue" \
            --output text)
        
        aws ecs create-service \
            --cluster "$CLUSTER_NAME" \
            --service-name "$SERVICE_NAME" \
            --task-definition "$TASK_DEF_ARN" \
            --desired-count 2 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_IDS//,/ }],securityGroups=[$SG_ID],assignPublicIp=DISABLED}" \
            --load-balancers "targetGroupArn=${TARGET_GROUP_ARN},containerName=jamf-mcp-server,containerPort=3000" \
            --region "$AWS_REGION"
    else
        aws ecs create-service \
            --cluster "$CLUSTER_NAME" \
            --service-name "$SERVICE_NAME" \
            --task-definition "$TASK_DEF_ARN" \
            --desired-count 2 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_IDS//,/ }],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
            --region "$AWS_REGION"
    fi
fi

echo -e "${GREEN}✓ ECS service deployed${NC}"

# 7. Set up auto-scaling
echo -e "\n${YELLOW}⚡ Configuring auto-scaling...${NC}"
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --resource-id "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
    --scalable-dimension ecs:service:DesiredCount \
    --min-capacity 2 \
    --max-capacity 10 \
    --region "$AWS_REGION" 2>/dev/null || true

aws application-autoscaling put-scaling-policy \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
    --policy-name "${SERVICE_NAME}-cpu-scaling" \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration '{
        "TargetValue": 70.0,
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
        },
        "ScaleInCooldown": 300,
        "ScaleOutCooldown": 60
    }' \
    --region "$AWS_REGION" 2>/dev/null || true

echo -e "${GREEN}✓ Auto-scaling configured${NC}"

# 8. Display deployment information
echo -e "\n${GREEN}🎉 Deployment complete!${NC}"
echo -e "\n${YELLOW}📊 Deployment Information:${NC}"
echo -e "   Cluster: ${CLUSTER_NAME}"
echo -e "   Service: ${SERVICE_NAME}"
echo -e "   Region: ${AWS_REGION}"

if [ -n "$CERTIFICATE_ARN" ]; then
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_PREFIX}-alb" \
        --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDNS'].OutputValue" \
        --output text)
    echo -e "   ALB URL: https://${ALB_DNS}"
    echo -e "\n${YELLOW}📝 Next steps:${NC}"
    echo -e "   1. Update your DNS to point to: ${ALB_DNS}"
    echo -e "   2. Update OAuth redirect URL in your provider"
    echo -e "   3. Configure ChatGPT connector with your domain"
fi

echo -e "\n${YELLOW}🔍 Useful commands:${NC}"
echo -e "   View logs: aws logs tail /ecs/jamf-mcp-server --follow"
echo -e "   Update service: aws ecs update-service --cluster ${CLUSTER_NAME} --service ${SERVICE_NAME} --force-new-deployment"
echo -e "   Scale service: aws ecs update-service --cluster ${CLUSTER_NAME} --service ${SERVICE_NAME} --desired-count 3"

echo -e "\n${GREEN}✨ Deployment script completed successfully!${NC}"