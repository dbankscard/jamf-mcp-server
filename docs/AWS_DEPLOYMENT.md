# AWS Deployment Guide for Jamf MCP Server

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Amazon        │         │   Amazon        │         │   Amazon        │
│   Route 53      │ ──────► │   CloudFront    │ ──────► │   ALB           │
│   (DNS)         │         │   (CDN/WAF)     │         │   (Load Balancer)│
└─────────────────┘         └─────────────────┘         └────────┬────────┘
                                                                  │
                                    ┌─────────────────────────────┼─────────────────────────────┐
                                    │                             │                             │
                            ┌───────▼────────┐           ┌────────▼────────┐           ┌────────▼────────┐
                            │   ECS Fargate  │           │   ECS Fargate   │           │   ECS Fargate   │
                            │   Task 1       │           │   Task 2        │           │   Task N        │
                            └───────┬────────┘           └────────┬────────┘           └────────┬────────┘
                                    │                             │                             │
                                    └─────────────────────────────┼─────────────────────────────┘
                                                                  │
                   ┌──────────────────────────────────────────────┼──────────────────────────────────────────┐
                   │                                              │                                          │
           ┌───────▼────────┐               ┌─────────────────────▼───────────────────┐           ┌─────────▼────────┐
           │   Amazon       │               │            Amazon VPC                    │           │   AWS Secrets    │
           │   ElastiCache  │               │  ┌─────────────┐  ┌─────────────────┐  │           │   Manager        │
           │   (Redis)      │               │  │Private      │  │  NAT Gateway    │  │           │   (Credentials)  │
           └────────────────┘               │  │Subnets      │  │                 │  │           └──────────────────┘
                                           │  └─────────────┘  └─────────────────┘  │
                                           └─────────────────────────────────────────┘
```

## Deployment Options

### Option 1: ECS Fargate (Recommended)
Serverless container hosting with automatic scaling.

### Option 2: EC2 with ECS
More control over the infrastructure but requires more management.

### Option 3: Elastic Beanstalk
Simple deployment but less flexibility.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured
3. **Docker** installed locally
4. **Domain name** (optional but recommended)
5. **OAuth Provider** configured (Auth0/Okta)

## Step-by-Step Deployment

### 1. Prepare AWS Environment

```bash
# Set your AWS region
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create ECR repository
aws ecr create-repository \
    --repository-name jamf-mcp-server \
    --region $AWS_REGION
```

### 2. Build and Push Docker Image

```bash
# Get ECR login token
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin \
    $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build image
docker build -t jamf-mcp-server .

# Tag image
docker tag jamf-mcp-server:latest \
    $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/jamf-mcp-server:latest

# Push image
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/jamf-mcp-server:latest
```

### 3. Store Secrets in AWS Secrets Manager

```bash
# Create secrets
aws secretsmanager create-secret \
    --name jamf-mcp-server/production \
    --secret-string '{
        "JAMF_URL": "https://your-instance.jamfcloud.com",
        "JAMF_CLIENT_ID": "your-client-id",
        "JAMF_CLIENT_SECRET": "your-client-secret",
        "AUTH0_DOMAIN": "your-tenant.auth0.com",
        "AUTH0_CLIENT_ID": "your-auth0-client-id",
        "AUTH0_CLIENT_SECRET": "your-auth0-client-secret",
        "AUTH0_AUDIENCE": "https://your-api-identifier",
        "JWT_SECRET": "your-jwt-secret"
    }'
```

### 4. Create VPC and Networking

```bash
# Use the CloudFormation template below or create manually
aws cloudformation create-stack \
    --stack-name jamf-mcp-network \
    --template-body file://aws/network-stack.yaml \
    --parameters ParameterKey=EnvironmentName,ParameterValue=production
```

### 5. Create ECS Cluster and Service

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name jamf-mcp-cluster

# Register task definition (use provided JSON)
aws ecs register-task-definition \
    --cli-input-json file://aws/task-definition.json

# Create ALB (use CloudFormation)
aws cloudformation create-stack \
    --stack-name jamf-mcp-alb \
    --template-body file://aws/alb-stack.yaml

# Create ECS service
aws ecs create-service \
    --cluster jamf-mcp-cluster \
    --service-name jamf-mcp-service \
    --task-definition jamf-mcp-server:1 \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={
        subnets=[subnet-xxx,subnet-yyy],
        securityGroups=[sg-xxx],
        assignPublicIp=ENABLED
    }" \
    --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:xxx,containerName=jamf-mcp-server,containerPort=3000
```

### 6. Configure Auto Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --resource-id service/jamf-mcp-cluster/jamf-mcp-service \
    --scalable-dimension ecs:service:DesiredCount \
    --min-capacity 2 \
    --max-capacity 10

# Create scaling policy
aws application-autoscaling put-scaling-policy \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/jamf-mcp-cluster/jamf-mcp-service \
    --policy-name jamf-mcp-scaling-policy \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration '{
        "TargetValue": 70.0,
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
        },
        "ScaleInCooldown": 300,
        "ScaleOutCooldown": 60
    }'
```

### 7. Set Up CloudFront (Optional but Recommended)

```bash
aws cloudformation create-stack \
    --stack-name jamf-mcp-cloudfront \
    --template-body file://aws/cloudfront-stack.yaml \
    --parameters \
        ParameterKey=ALBDomainName,ParameterValue=your-alb-dns-name \
        ParameterKey=CertificateArn,ParameterValue=your-acm-certificate-arn
```

### 8. Configure Route 53 (if using custom domain)

```bash
# Create hosted zone if needed
aws route53 create-hosted-zone \
    --name your-domain.com \
    --caller-reference $(date +%s)

# Create A record pointing to CloudFront
aws route53 change-resource-record-sets \
    --hosted-zone-id YOUR_ZONE_ID \
    --change-batch '{
        "Changes": [{
            "Action": "CREATE",
            "ResourceRecordSet": {
                "Name": "jamf-mcp.your-domain.com",
                "Type": "A",
                "AliasTarget": {
                    "HostedZoneId": "Z2FDTNDATAQYW2",
                    "DNSName": "your-cloudfront-distribution.cloudfront.net",
                    "EvaluateTargetHealth": false
                }
            }
        }]
    }'
```

## Infrastructure as Code

### ECS Task Definition (`aws/task-definition.json`)

```json
{
  "family": "jamf-mcp-server",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/jamf-mcp-task-role",
  "containerDefinitions": [
    {
      "name": "jamf-mcp-server",
      "image": "ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/jamf-mcp-server:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"},
        {"name": "OAUTH_PROVIDER", "value": "auth0"},
        {"name": "OAUTH_REDIRECT_URI", "value": "https://chatgpt.com/auth/callback"},
        {"name": "JAMF_READ_ONLY", "value": "false"},
        {"name": "JAMF_USE_ENHANCED_MODE", "value": "true"},
        {"name": "LOG_LEVEL", "value": "info"}
      ],
      "secrets": [
        {
          "name": "JAMF_URL",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:jamf-mcp-server/production:JAMF_URL::"
        },
        {
          "name": "JAMF_CLIENT_ID",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:jamf-mcp-server/production:JAMF_CLIENT_ID::"
        },
        {
          "name": "JAMF_CLIENT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:jamf-mcp-server/production:JAMF_CLIENT_SECRET::"
        },
        {
          "name": "AUTH0_DOMAIN",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:jamf-mcp-server/production:AUTH0_DOMAIN::"
        },
        {
          "name": "AUTH0_CLIENT_ID",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:jamf-mcp-server/production:AUTH0_CLIENT_ID::"
        },
        {
          "name": "AUTH0_CLIENT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:jamf-mcp-server/production:AUTH0_CLIENT_SECRET::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/jamf-mcp-server",
          "awslogs-region": "REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 40
      }
    }
  ]
}
```

### CloudFormation VPC Stack (`aws/network-stack.yaml`)

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: VPC and networking for Jamf MCP Server

Parameters:
  EnvironmentName:
    Description: Environment name prefix
    Type: String
    Default: production

Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-vpc

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.1.0/24
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-public-subnet-1

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.2.0/24
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-public-subnet-2

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.11.0/24
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-private-subnet-1

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.12.0/24
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-private-subnet-2

  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-igw

  InternetGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      InternetGatewayId: !Ref InternetGateway
      VpcId: !Ref VPC

  NatGateway1EIP:
    Type: AWS::EC2::EIP
    DependsOn: InternetGatewayAttachment
    Properties:
      Domain: vpc

  NatGateway1:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NatGateway1EIP.AllocationId
      SubnetId: !Ref PublicSubnet1

  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-public-routes

  DefaultPublicRoute:
    Type: AWS::EC2::Route
    DependsOn: InternetGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet1

  PublicSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet2

  PrivateRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-private-routes

  DefaultPrivateRoute:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway1

  PrivateSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PrivateRouteTable
      SubnetId: !Ref PrivateSubnet1

  PrivateSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PrivateRouteTable
      SubnetId: !Ref PrivateSubnet2

Outputs:
  VPC:
    Description: VPC ID
    Value: !Ref VPC
    Export:
      Name: !Sub ${EnvironmentName}-vpc

  PublicSubnets:
    Description: Public subnet IDs
    Value: !Join [',', [!Ref PublicSubnet1, !Ref PublicSubnet2]]
    Export:
      Name: !Sub ${EnvironmentName}-public-subnets

  PrivateSubnets:
    Description: Private subnet IDs
    Value: !Join [',', [!Ref PrivateSubnet1, !Ref PrivateSubnet2]]
    Export:
      Name: !Sub ${EnvironmentName}-private-subnets
```

### ALB CloudFormation Stack (`aws/alb-stack.yaml`)

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Application Load Balancer for Jamf MCP Server

Parameters:
  EnvironmentName:
    Type: String
    Default: production
  CertificateArn:
    Type: String
    Description: ACM certificate ARN for HTTPS

Resources:
  SecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: !Sub ${EnvironmentName}-alb-sg
      GroupDescription: Security group for ALB
      VpcId: !ImportValue 
        Fn::Sub: ${EnvironmentName}-vpc
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-alb-sg

  LoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub ${EnvironmentName}-alb
      Type: application
      Scheme: internet-facing
      Subnets: !Split 
        - ','
        - !ImportValue 
          Fn::Sub: ${EnvironmentName}-public-subnets
      SecurityGroups:
        - !Ref SecurityGroup
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-alb

  TargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: !Sub ${EnvironmentName}-tg
      Port: 3000
      Protocol: HTTP
      VpcId: !ImportValue 
        Fn::Sub: ${EnvironmentName}-vpc
      TargetType: ip
      HealthCheckEnabled: true
      HealthCheckIntervalSeconds: 30
      HealthCheckPath: /health
      HealthCheckProtocol: HTTP
      HealthCheckTimeoutSeconds: 10
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3
      Matcher:
        HttpCode: 200
      TargetGroupAttributes:
        - Key: stickiness.enabled
          Value: 'true'
        - Key: stickiness.type
          Value: app_cookie
        - Key: stickiness.app_cookie.cookie_name
          Value: JAMFMCP
        - Key: stickiness.app_cookie.duration_seconds
          Value: '86400'

  HTTPSListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref TargetGroup
      LoadBalancerArn: !Ref LoadBalancer
      Port: 443
      Protocol: HTTPS
      Certificates:
        - CertificateArn: !Ref CertificateArn

  HTTPListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      DefaultActions:
        - Type: redirect
          RedirectConfig:
            Protocol: HTTPS
            Port: '443'
            StatusCode: HTTP_301
      LoadBalancerArn: !Ref LoadBalancer
      Port: 80
      Protocol: HTTP

Outputs:
  LoadBalancerDNS:
    Description: ALB DNS name
    Value: !GetAtt LoadBalancer.DNSName
    Export:
      Name: !Sub ${EnvironmentName}-alb-dns
  
  TargetGroupArn:
    Description: Target Group ARN
    Value: !Ref TargetGroup
    Export:
      Name: !Sub ${EnvironmentName}-target-group-arn
```

## Security Best Practices

### 1. IAM Roles and Policies

Create minimal IAM roles:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:jamf-mcp-server/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:/ecs/jamf-mcp-server:*"
      ]
    }
  ]
}
```

### 2. Security Groups

Restrict access:
- ALB: Only ports 80/443 from internet
- ECS Tasks: Only port 3000 from ALB
- ElastiCache: Only from ECS tasks

### 3. Encryption

- Enable encryption at rest for all services
- Use AWS Certificate Manager for TLS
- Encrypt environment variables with KMS

### 4. Monitoring and Alerting

Set up CloudWatch alarms:
- High error rate
- High response time
- Low availability
- Failed authentication attempts

## Cost Optimization

### Estimated Monthly Costs (2 tasks, moderate traffic)
- ECS Fargate: ~$36
- ALB: ~$22
- CloudFront: ~$10
- ElastiCache (t3.micro): ~$13
- Data Transfer: Variable (~$10-50)
- **Total: ~$91-131/month**

### Cost Saving Tips
1. Use Fargate Spot for non-production
2. Enable auto-scaling with conservative settings
3. Use CloudFront caching for static responses
4. Consider Reserved Instances for ElastiCache
5. Monitor and optimize data transfer

## Troubleshooting

### Common Issues

1. **Task fails to start**
   - Check CloudWatch logs
   - Verify IAM permissions
   - Ensure secrets are accessible

2. **Health checks failing**
   - Verify security group rules
   - Check task definition port mappings
   - Review application logs

3. **OAuth errors**
   - Verify callback URL in OAuth provider
   - Check CORS configuration
   - Ensure secrets are correctly formatted

### Useful Commands

```bash
# View ECS service logs
aws logs tail /ecs/jamf-mcp-server --follow

# Check task status
aws ecs describe-tasks \
    --cluster jamf-mcp-cluster \
    --tasks $(aws ecs list-tasks --cluster jamf-mcp-cluster --query 'taskArns[0]' --output text)

# Update service
aws ecs update-service \
    --cluster jamf-mcp-cluster \
    --service jamf-mcp-service \
    --force-new-deployment
```

## Maintenance

### Regular Tasks
1. **Weekly**: Review CloudWatch metrics
2. **Monthly**: Update container image with security patches
3. **Quarterly**: Review and rotate secrets
4. **Yearly**: Review architecture for optimization

### Backup Strategy
- Secrets: Enable automatic rotation
- Logs: Ship to S3 for long-term storage
- Configuration: Store in version control

## Support

For AWS-specific issues:
- [AWS Support](https://aws.amazon.com/support/)
- [ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS Forums](https://forums.aws.amazon.com/)