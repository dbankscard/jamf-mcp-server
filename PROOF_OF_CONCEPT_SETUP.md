# Proof of Concept Setup - No Auth0 Required!

This guide shows you how to deploy the Jamf MCP Server for proof of concept without needing Auth0.

## Option 1: Local Development Mode (Quickest)

### 1. Set Environment Variables
Create a `.env` file in the project root:

```bash
# Jamf Configuration
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_CLIENT_ID=your-jamf-client-id
JAMF_CLIENT_SECRET=your-jamf-client-secret

# Development Authentication
NODE_ENV=development
OAUTH_PROVIDER=dev
JWT_SECRET=your-super-secret-key-change-this
PORT=3000

# Optional settings
JAMF_READ_ONLY=false
JAMF_USE_ENHANCED_MODE=true
LOG_LEVEL=info
```

### 2. Run Locally
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the HTTP server
npm run serve:http
```

The server will be available at `http://localhost:3000`

### 3. Test the Endpoints
```bash
# Health check
curl http://localhost:3000/health

# Generate a dev token (you'll need to implement this endpoint or use a JWT generator)
```

## Option 2: Deploy to AWS with Simple Authentication

### 1. Modify the Terraform Configuration

Edit `aws/terraform/terraform.tfvars`:

```hcl
# AWS Configuration
aws_region   = "us-east-1"
environment  = "development"  # Changed to development
project_name = "jamf-mcp-poc"

# ECS Configuration
task_cpu      = "512"
task_memory   = "1024"
desired_count = 1  # Reduced for POC
min_capacity  = 1
max_capacity  = 2

# No SSL for POC
certificate_arn = ""

# Application Configuration
oauth_provider     = "dev"  # Use dev mode
oauth_redirect_uri = "https://chatgpt.com/auth/callback"
jamf_read_only     = false
log_level          = "info"

# Jamf Configuration
jamf_url           = "https://your-instance.jamfcloud.com"
jamf_client_id     = "your-jamf-client-id"
jamf_client_secret = "your-jamf-client-secret"

# Dev mode authentication
auth0_domain       = "dev.local"  # Dummy value
auth0_client_id    = "dev-client"
auth0_client_secret = "dev-secret"
auth0_audience      = "https://jamf-mcp-api"
required_scopes     = "read:jamf write:jamf"
```

### 2. Add JWT Secret to AWS Secrets Manager

```bash
aws secretsmanager create-secret \
    --name jamf-mcp-server/poc \
    --secret-string '{
        "JAMF_URL": "https://your-instance.jamfcloud.com",
        "JAMF_CLIENT_ID": "your-client-id",
        "JAMF_CLIENT_SECRET": "your-client-secret",
        "JWT_SECRET": "your-super-secret-key-change-this",
        "AUTH0_DOMAIN": "dev.local",
        "AUTH0_CLIENT_ID": "dev-client",
        "AUTH0_CLIENT_SECRET": "dev-secret",
        "AUTH0_AUDIENCE": "https://jamf-mcp-api",
        "REQUIRED_SCOPES": "read:jamf write:jamf"
    }'
```

### 3. Update Task Definition

We need to add NODE_ENV and JWT_SECRET to the task definition. Edit `aws/terraform/main.tf` and add to the environment section:

```hcl
environment = [
  {
    name  = "NODE_ENV"
    value = "development"  # For POC
  },
  {
    name  = "OAUTH_PROVIDER"
    value = "dev"
  },
  # ... other environment variables
]
```

And add to secrets:

```hcl
secrets = [
  # ... existing secrets
  {
    name      = "JWT_SECRET"
    valueFrom = "${aws_secretsmanager_secret.jamf_mcp.arn}:JWT_SECRET::"
  }
]
```

## Option 3: Simple API Key Authentication (Custom)

If you want even simpler authentication, I can help you create a basic API key middleware:

```typescript
// Simple API key authentication for POC
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey === process.env.API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
```

## Testing with ChatGPT

For ChatGPT integration in dev mode:

1. Deploy the server (locally or to AWS)
2. In ChatGPT custom connector settings:
   - Server URL: `http://localhost:3000/mcp` (or your AWS URL)
   - Authentication: You might need to generate a valid JWT token
   - Or modify the server to accept a simple Bearer token

## Generate a Test JWT Token

Here's a simple Node.js script to generate a dev JWT token:

```javascript
const jwt = require('jsonwebtoken');

const secret = 'your-super-secret-key-change-this';
const payload = {
  sub: 'test-user',
  email: 'test@example.com',
  scope: 'read:jamf write:jamf',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
};

const token = jwt.sign(payload, secret);
console.log('JWT Token:', token);
```

Use this token in your requests:
```
Authorization: Bearer <your-jwt-token>
```

## Quick Start Commands

```bash
# 1. Set up your .env file with Jamf credentials

# 2. Run locally
npm run build
npm run serve:http

# 3. Or deploy to AWS (after updating terraform.tfvars)
cd aws/terraform
terraform init
terraform plan
terraform apply

# 4. Test the deployment
curl -H "Authorization: Bearer <your-jwt-token>" https://your-alb-url/health
```

This approach bypasses the need for Auth0 entirely and lets you test the ChatGPT integration!