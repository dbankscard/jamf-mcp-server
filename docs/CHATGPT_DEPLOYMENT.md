# Deploying Jamf MCP Server for ChatGPT Custom Connectors

This guide explains how to deploy the Jamf MCP server as a remote service that can be connected to ChatGPT using custom connectors.

## Prerequisites

- ChatGPT Pro, Team, or Enterprise account
- Cloud hosting platform (AWS, Google Cloud, Azure, Heroku, etc.)
- OAuth2 provider (Auth0, Okta, or similar)
- SSL certificate (provided by hosting platform or Let's Encrypt)

## Architecture Overview

```
ChatGPT <-> OAuth Provider <-> MCP Server <-> Jamf Pro API
```

## Step 1: Set Up OAuth Provider

### Using Auth0 (Recommended)

1. Create an Auth0 account at https://auth0.com
2. Create a new application:
   - Type: Regular Web Application
   - Name: Jamf MCP Server
3. Configure allowed callbacks:
   ```
   https://chatgpt.com/auth/callback
   ```
4. Configure allowed origins:
   ```
   https://chat.openai.com
   https://chatgpt.com
   ```
5. Note your credentials:
   - Domain: `your-tenant.auth0.com`
   - Client ID: `your-client-id`
   - Client Secret: `your-client-secret`

### Using Okta

1. Create an Okta developer account
2. Create a new OIDC Web application
3. Configure redirect URIs and origins similar to Auth0
4. Note your credentials

## Step 2: Deploy to Cloud Platform

### Option A: Deploy to Heroku

1. Install Heroku CLI
2. Create a new Heroku app:
   ```bash
   heroku create your-jamf-mcp-server
   ```

3. Set environment variables:
   ```bash
   heroku config:set JAMF_URL=https://your-instance.jamfcloud.com
   heroku config:set JAMF_CLIENT_ID=your-jamf-client-id
   heroku config:set JAMF_CLIENT_SECRET=your-jamf-client-secret
   heroku config:set AUTH0_DOMAIN=your-tenant.auth0.com
   heroku config:set AUTH0_CLIENT_ID=your-auth0-client-id
   heroku config:set AUTH0_CLIENT_SECRET=your-auth0-client-secret
   heroku config:set AUTH0_AUDIENCE=https://your-jamf-mcp-server.herokuapp.com
   heroku config:set OAUTH_PROVIDER=auth0
   ```

4. Deploy:
   ```bash
   git push heroku main
   ```

### Option B: Deploy to AWS EC2/ECS

1. Build Docker image:
   ```bash
   docker build -t jamf-mcp-server .
   ```

2. Push to ECR:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-ecr-uri
   docker tag jamf-mcp-server:latest your-ecr-uri/jamf-mcp-server:latest
   docker push your-ecr-uri/jamf-mcp-server:latest
   ```

3. Deploy using ECS or run on EC2 with Docker

### Option C: Deploy to Google Cloud Run

1. Build and push to Container Registry:
   ```bash
   gcloud builds submit --tag gcr.io/your-project/jamf-mcp-server
   ```

2. Deploy to Cloud Run:
   ```bash
   gcloud run deploy jamf-mcp-server \
     --image gcr.io/your-project/jamf-mcp-server \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars "JAMF_URL=https://your-instance.jamfcloud.com" \
     --set-env-vars "AUTH0_DOMAIN=your-tenant.auth0.com"
   ```

### Option D: Deploy to Azure Container Instances

1. Build and push to Azure Container Registry:
   ```bash
   az acr build --registry yourregistry --image jamf-mcp-server .
   ```

2. Deploy to Container Instances:
   ```bash
   az container create \
     --resource-group yourgroup \
     --name jamf-mcp-server \
     --image yourregistry.azurecr.io/jamf-mcp-server \
     --dns-name-label jamf-mcp-server \
     --ports 3000 \
     --environment-variables \
       JAMF_URL=https://your-instance.jamfcloud.com \
       AUTH0_DOMAIN=your-tenant.auth0.com
   ```

## Step 3: Configure SSL/TLS

Most cloud platforms provide SSL certificates automatically. If not:

1. Use Let's Encrypt with Certbot
2. Or use your cloud provider's certificate manager
3. Ensure HTTPS is properly configured

## Step 4: Connect to ChatGPT

1. In ChatGPT, go to Settings > Connectors
2. Click "Create" to add a custom connector
3. Configure the connector:
   - **Name**: Jamf MCP Server
   - **Description**: Manage Apple devices through Jamf Pro
   - **Server URL**: `https://your-deployment-url.com/mcp`
   - **Authentication**: OAuth
   - **OAuth Authorization URL**: `https://your-deployment-url.com/auth/authorize`
   - **OAuth Token URL**: `https://your-deployment-url.com/auth/callback`
   - **OAuth Scopes**: `openid profile email offline_access`

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JAMF_URL` | Your Jamf Pro instance URL | `https://company.jamfcloud.com` |
| `JAMF_CLIENT_ID` | Jamf Pro API client ID | `abc123...` |
| `JAMF_CLIENT_SECRET` | Jamf Pro API client secret | `xyz789...` |
| `OAUTH_PROVIDER` | OAuth provider type | `auth0` or `okta` |
| `AUTH0_DOMAIN` | Auth0 tenant domain | `your-tenant.auth0.com` |
| `AUTH0_CLIENT_ID` | OAuth client ID | `def456...` |
| `AUTH0_CLIENT_SECRET` | OAuth client secret | `ghi012...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `JAMF_READ_ONLY` | Enable read-only mode | `false` |
| `JAMF_USE_ENHANCED_MODE` | Enable enhanced error handling | `true` |
| `OAUTH_REDIRECT_URI` | OAuth callback URL | `https://chatgpt.com/auth/callback` |
| `REQUIRED_SCOPES` | Required OAuth scopes | `read:jamf write:jamf` |
| `JWT_SECRET` | JWT secret for dev mode | (generated) |

## Testing the Deployment

1. Test health endpoint:
   ```bash
   curl https://your-deployment-url.com/health
   ```

2. Test OAuth flow:
   - Visit `https://your-deployment-url.com/auth/authorize`
   - Should redirect to OAuth provider

3. Test in ChatGPT:
   - Enable the connector
   - Try a simple command like "List all policies in Jamf"

## Security Considerations

1. **API Keys**: Never expose Jamf Pro API credentials in client-side code
2. **OAuth Scopes**: Limit scopes to minimum required permissions
3. **CORS**: Only allow origins from OpenAI domains
4. **Rate Limiting**: Consider implementing rate limiting for production
5. **Monitoring**: Set up logging and monitoring for suspicious activity

## Troubleshooting

### Connection Issues

1. Check server logs:
   ```bash
   heroku logs --tail  # For Heroku
   docker logs container-id  # For Docker
   ```

2. Verify OAuth configuration:
   - Correct redirect URIs
   - Valid client credentials
   - Proper scopes

### Authentication Failures

1. Ensure OAuth provider is configured correctly
2. Check that tokens are being validated properly
3. Verify CORS headers are set correctly

### MCP Protocol Issues

1. Ensure the MCP SDK version is compatible
2. Check that all required tools are registered
3. Verify the SSE transport is working correctly

## Local Development

For local testing before deployment:

```bash
# Install dependencies
npm install

# Run the HTTP server locally
npm run serve:http

# Or with Docker
docker-compose up
```

## Support

- MCP Documentation: https://modelcontextprotocol.org
- Jamf API Documentation: https://developer.jamf.com
- ChatGPT Connectors: https://help.openai.com/en/articles/11487775-connectors-in-chatgpt