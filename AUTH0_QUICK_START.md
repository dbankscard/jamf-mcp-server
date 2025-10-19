# Auth0 Quick Start for Jamf MCP Server

## 🚀 5-Minute Setup

### 1. Create Auth0 Account
- Go to https://auth0.com → Sign up
- Your domain: `<choose-name>.auth0.com`

### 2. Create Application
- Dashboard → Applications → Create Application
- Name: `Jamf MCP Server`
- Type: `Regular Web Application`

### 3. Configure Application
Copy these URLs into your app settings:

**Allowed Callback URLs:**
```
https://chatgpt.com/auth/callback
https://chat.openai.com/auth/callback
http://localhost:3000/auth/callback
```
*Note: Add your AWS ALB URL after deployment*

**Allowed Web Origins:**
```
https://chatgpt.com
https://chat.openai.com
http://localhost:3000
```

### 4. Create API
- APIs → Create API
- Name: `Jamf MCP Server API`
- Identifier: `https://jamf-mcp-api`

### 5. Add Permissions
In your API → Permissions tab, add:
- `read:jamf`
- `write:jamf`

### 6. Save Your Credentials
From your application settings, copy:
```bash
AUTH0_DOMAIN="your-tenant.auth0.com"
AUTH0_CLIENT_ID="..."
AUTH0_CLIENT_SECRET="..."
AUTH0_AUDIENCE="https://jamf-mcp-api"
```

### 7. Update terraform.tfvars
```hcl
# Auth0 Configuration
auth0_domain        = "your-tenant.auth0.com"
auth0_client_id     = "your-client-id"
auth0_client_secret = "your-client-secret"
auth0_audience      = "https://jamf-mcp-api"
```

## ✅ Checklist
- [ ] Auth0 account created
- [ ] Application created (Regular Web App)
- [ ] Callback URLs configured
- [ ] API created with scopes
- [ ] Credentials saved
- [ ] terraform.tfvars updated

## 🔄 After AWS Deployment
Remember to:
1. Add your ALB URL to Auth0 callback URLs
2. Update terraform.tfvars with ALB URL
3. Test the OAuth flow

---
*Full guide: /docs/AUTH0_SETUP_GUIDE.md*