# AWS Credentials Management for Jamf MCP Server

## Overview

This document explains how sensitive credentials are securely stored, managed, and used in the AWS architecture, following the principle of least privilege and defense in depth.

## Credential Types and Storage

### 1. Credentials Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Secrets Manager                       │
│                                                              │
│  Secret: jamf-mcp-server/production                         │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │   Jamf Credentials  │  │    OAuth Credentials        │  │
│  │ • JAMF_URL          │  │ • AUTH0_DOMAIN             │  │
│  │ • JAMF_CLIENT_ID    │  │ • AUTH0_CLIENT_ID          │  │
│  │ • JAMF_CLIENT_SECRET│  │ • AUTH0_CLIENT_SECRET      │  │
│  └─────────────────────┘  │ • AUTH0_AUDIENCE           │  │
│                           │ • REQUIRED_SCOPES           │  │
│                           └─────────────────────────────┘  │
│                                                              │
│  Encryption: AWS KMS (AES-256)                              │
│  Access: IAM Role-based only                                │
└──────────────────────────────────────────────────────────────┘
```

### 2. Credential Storage Locations

| Credential Type | Storage Location | Purpose | Rotation |
|----------------|------------------|---------|----------|
| Jamf API Credentials | AWS Secrets Manager | Access Jamf Pro APIs | 90 days |
| OAuth Provider Credentials | AWS Secrets Manager | ChatGPT authentication | 90 days |
| Database Credentials | Not used (stateless) | N/A | N/A |
| AWS Access Keys | IAM Roles (no keys) | AWS service access | Automatic |

## Credential Flow Architecture

```
┌─────────────────┐
│   Developer     │
│   (You)         │
└────────┬────────┘
         │ 1. Store credentials
         │    aws secretsmanager create-secret
         ▼
┌─────────────────────────────────────┐
│      AWS Secrets Manager            │
│   ┌─────────────────────────────┐  │
│   │  Encrypted with AWS KMS     │  │
│   │  • Automatic rotation       │  │
│   │  • Audit trail             │  │
│   │  • Version history         │  │
│   └─────────────────────────────┘  │
└────────────┬─────────────────────────┘
             │ 2. Grant access via IAM
             ▼
┌─────────────────────────────────────┐
│         IAM Task Role               │
│   Permissions:                      │
│   • secretsmanager:GetSecretValue   │
│   • Only for specific secret ARN    │
└────────────┬─────────────────────────┘
             │ 3. Assume role
             ▼
┌─────────────────────────────────────┐
│       ECS Task (Container)          │
│   ┌─────────────────────────────┐  │
│   │   Task Definition           │  │
│   │   secrets: [                │  │
│   │     {                       │  │
│   │       name: "JAMF_URL"     │  │
│   │       valueFrom: "arn:..." │  │
│   │     }                       │  │
│   │   ]                         │  │
│   └─────────────────────────────┘  │
└────────────┬─────────────────────────┘
             │ 4. Retrieve at runtime
             ▼
┌─────────────────────────────────────┐
│     Application Runtime             │
│   process.env.JAMF_URL             │
│   process.env.JAMF_CLIENT_SECRET   │
│   (Injected by ECS)                │
└─────────────────────────────────────┘
```

## Detailed Credential Management

### 1. Initial Setup (One-time)

```bash
# Create the secret in AWS Secrets Manager
aws secretsmanager create-secret \
    --name jamf-mcp-server/production \
    --description "Credentials for Jamf MCP Server" \
    --secret-string '{
        "JAMF_URL": "https://yourcompany.jamfcloud.com",
        "JAMF_CLIENT_ID": "abc123def456",
        "JAMF_CLIENT_SECRET": "super-secret-key-here",
        "AUTH0_DOMAIN": "yourcompany.auth0.com",
        "AUTH0_CLIENT_ID": "auth0-client-id",
        "AUTH0_CLIENT_SECRET": "auth0-secret",
        "AUTH0_AUDIENCE": "https://jamf-mcp.yourcompany.com",
        "REQUIRED_SCOPES": "read:jamf write:jamf"
    }'
```

### 2. IAM Role Configuration

**ECS Task Execution Role Policy:**
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
        "arn:aws:secretsmanager:us-east-1:123456789:secret:jamf-mcp-server/production-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "secretsmanager.us-east-1.amazonaws.com"
        }
      }
    }
  ]
}
```

### 3. ECS Task Definition Integration

```json
{
  "containerDefinitions": [
    {
      "name": "jamf-mcp-server",
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "JAMF_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:jamf-mcp-server/production:JAMF_URL::"
        },
        {
          "name": "JAMF_CLIENT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:jamf-mcp-server/production:JAMF_CLIENT_SECRET::"
        }
      ]
    }
  ]
}
```

### 4. Runtime Access in Application

```javascript
// In your application code (src/index.ts)
const jamfClient = new JamfApiClient({
  baseUrl: process.env.JAMF_URL,  // Injected by ECS from Secrets Manager
  clientId: process.env.JAMF_CLIENT_ID,
  clientSecret: process.env.JAMF_CLIENT_SECRET
});

// The credentials are available as environment variables
// but NEVER logged or exposed
```

## Security Layers

### Layer 1: AWS KMS Encryption
- All secrets encrypted at rest using AWS KMS
- Encryption keys managed by AWS
- Automatic key rotation available

### Layer 2: IAM Access Control
```
ECS Service → Assumes Task Role → Access Specific Secret → Decrypt with KMS
```

### Layer 3: Network Isolation
- ECS tasks run in private subnets
- No direct internet access (egress through NAT)
- Security groups restrict access

### Layer 4: Runtime Protection
- Credentials only in memory
- No logging of sensitive values
- Automatic credential refresh

## Credential Rotation Process

### Automated Rotation Setup

```bash
# Enable automatic rotation (every 90 days)
aws secretsmanager rotate-secret \
    --secret-id jamf-mcp-server/production \
    --rotation-rules '{
        "AutomaticallyAfterDays": 90
    }'
```

### Manual Rotation Process

1. **Update Secret in AWS:**
```bash
aws secretsmanager update-secret \
    --secret-id jamf-mcp-server/production \
    --secret-string '{
        "JAMF_CLIENT_SECRET": "new-secret-value"
    }'
```

2. **Force Service Update:**
```bash
aws ecs update-service \
    --cluster jamf-mcp-cluster \
    --service jamf-mcp-service \
    --force-new-deployment
```

3. **Verify New Deployment:**
```bash
aws ecs describe-services \
    --cluster jamf-mcp-cluster \
    --services jamf-mcp-service
```

## Monitoring and Auditing

### CloudTrail Logging
All secret access is logged:
```json
{
  "eventTime": "2024-01-01T12:00:00Z",
  "eventName": "GetSecretValue",
  "userIdentity": {
    "type": "AssumedRole",
    "principalId": "AIDAI23456789",
    "arn": "arn:aws:sts::123456789:assumed-role/ecsTaskExecutionRole/task-id"
  },
  "requestParameters": {
    "secretId": "jamf-mcp-server/production"
  }
}
```

### CloudWatch Alarms
Set up alarms for:
- Unauthorized secret access attempts
- Secret rotation failures
- Unusual access patterns

## Best Practices

### 1. Least Privilege Access
```yaml
# Good: Specific secret ARN
Resource: "arn:aws:secretsmanager:region:account:secret:jamf-mcp-server/production-*"

# Bad: All secrets
Resource: "*"
```

### 2. Environment Separation
```
Production: jamf-mcp-server/production
Staging: jamf-mcp-server/staging
Development: jamf-mcp-server/development
```

### 3. Secret Versioning
- AWS maintains version history
- Can rollback if needed
- Old versions auto-deleted after rotation

### 4. Emergency Access
```bash
# Break-glass procedure for emergency access
aws secretsmanager get-secret-value \
    --secret-id jamf-mcp-server/production \
    --query SecretString \
    --output json | jq '.'
```

## Common Scenarios

### Scenario 1: Adding New Credential
```bash
# Get current secret
CURRENT=$(aws secretsmanager get-secret-value \
    --secret-id jamf-mcp-server/production \
    --query SecretString --output text)

# Add new field
UPDATED=$(echo $CURRENT | jq '. + {"NEW_API_KEY": "new-value"}')

# Update secret
aws secretsmanager update-secret \
    --secret-id jamf-mcp-server/production \
    --secret-string "$UPDATED"
```

### Scenario 2: Debugging Credential Issues
```bash
# Check ECS task environment
aws ecs execute-command \
    --cluster jamf-mcp-cluster \
    --task task-id \
    --container jamf-mcp-server \
    --interactive \
    --command "/bin/sh"

# Inside container (never do in production!)
> env | grep -E "JAMF_|AUTH0_" | sed 's/=.*/=***/'
```

### Scenario 3: Credential Compromise
1. **Immediately rotate in Jamf/Auth0**
2. **Update AWS Secrets Manager**
3. **Force ECS deployment**
4. **Review CloudTrail logs**

## Cost Considerations

### AWS Secrets Manager Pricing
- $0.40 per secret per month
- $0.05 per 10,000 API calls
- No charge for rotation

### Example Monthly Cost
- 1 secret: $0.40
- 1000 container starts/day × 8 secrets = 240,000 API calls = $1.20
- **Total: ~$1.60/month**

## Security Compliance

### SOC 2 Compliance
✓ Encrypted at rest (AWS KMS)
✓ Encrypted in transit (TLS)
✓ Access logging (CloudTrail)
✓ Role-based access (IAM)
✓ Automatic rotation available

### HIPAA Compliance
✓ AWS Secrets Manager is HIPAA eligible
✓ Encryption meets requirements
✓ Audit trail maintained
✓ Access controls enforced

## Troubleshooting

### "AccessDenied" Error
```bash
# Check IAM role permissions
aws iam get-role-policy \
    --role-name ecsTaskExecutionRole \
    --policy-name SecretsAccess
```

### "SecretNotFound" Error
```bash
# Verify secret exists and ARN is correct
aws secretsmanager describe-secret \
    --secret-id jamf-mcp-server/production
```

### Container Not Starting
```bash
# Check ECS task stopped reason
aws ecs describe-tasks \
    --cluster jamf-mcp-cluster \
    --tasks task-arn \
    --query 'tasks[0].stoppedReason'
```

## Summary

Your credentials follow this secure path:
1. **You** → Store in AWS Secrets Manager (encrypted)
2. **ECS Task** → Assumes IAM role with specific permissions
3. **Container Start** → ECS injects secrets as environment variables
4. **Runtime** → Application accesses via `process.env`
5. **Never** → Logged, displayed, or stored in code

This approach ensures:
- Zero hardcoded credentials
- Encrypted storage and transit
- Auditable access
- Easy rotation
- Compliance with security standards