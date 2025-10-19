# Auth0 Setup Guide for Jamf MCP Server

This guide walks you through setting up Auth0 for your ChatGPT connector integration.

## Step 1: Create Auth0 Account

1. Go to [https://auth0.com](https://auth0.com)
2. Click **"Sign up"** for a free account
3. Choose your region (e.g., US, EU)
4. Your Auth0 domain will be created: `your-tenant-name.auth0.com`

## Step 2: Create a New Application

1. In the Auth0 Dashboard, navigate to **Applications** → **Applications**
2. Click **"Create Application"**
3. Configure:
   - **Name**: `Jamf MCP Server`
   - **Application Type**: Select **"Regular Web Application"**
   - Click **"Create"**

## Step 3: Configure Application Settings

### Basic Information
1. In your application settings, note down:
   - **Domain**: `your-tenant-name.auth0.com`
   - **Client ID**: (auto-generated, looks like `Dv2...`)
   - **Client Secret**: (click to reveal and copy)

### Application URIs
Configure these URLs (replace `your-alb-dns.com` with your actual AWS ALB DNS after deployment):

1. **Allowed Callback URLs**:
   ```
   https://chatgpt.com/auth/callback
   https://chat.openai.com/auth/callback
   https://your-alb-dns.com/auth/callback
   http://localhost:3000/auth/callback
   ```

2. **Allowed Logout URLs**:
   ```
   https://chatgpt.com
   https://chat.openai.com
   https://your-alb-dns.com
   http://localhost:3000
   ```

3. **Allowed Web Origins**:
   ```
   https://chatgpt.com
   https://chat.openai.com
   https://your-alb-dns.com
   http://localhost:3000
   ```

4. **Allowed Origins (CORS)**:
   ```
   https://chatgpt.com
   https://chat.openai.com
   https://your-alb-dns.com
   http://localhost:3000
   ```

### Grant Types
Ensure these are enabled:
- ✅ Authorization Code
- ✅ Refresh Token
- ✅ Client Credentials (for machine-to-machine)

### Refresh Token Settings
1. Scroll to **Refresh Token** section
2. Enable **"Rotation"**
3. Set **"Reuse Interval"** to 0

Click **"Save Changes"**

## Step 4: Create an API

1. Navigate to **Applications** → **APIs**
2. Click **"Create API"**
3. Configure:
   - **Name**: `Jamf MCP Server API`
   - **Identifier**: `https://jamf-mcp-api` (this will be your audience)
   - **Signing Algorithm**: `RS256`
   - Click **"Create"**

## Step 5: Configure API Scopes

1. In your API settings, go to the **"Permissions"** tab
2. Add these scopes:
   - `read:jamf` - Description: "Read access to Jamf resources"
   - `write:jamf` - Description: "Write access to Jamf resources"

## Step 6: Enable Connections

1. Go to **Authentication** → **Database**
2. Ensure **"Username-Password-Authentication"** is enabled
3. (Optional) Enable social connections like Google, Microsoft, etc.

## Step 7: Create a Test User (Optional)

1. Go to **User Management** → **Users**
2. Click **"Create User"**
3. Configure:
   - Email: `test@example.com`
   - Password: (secure password)
   - Connection: `Username-Password-Authentication`

## Step 8: Configure Rules (Optional but Recommended)

1. Go to **Auth Pipeline** → **Rules**
2. Click **"Create Rule"**
3. Select **"Empty Rule"**
4. Name it: `Add Jamf Scopes`
5. Add this code:

```javascript
function addJamfScopes(user, context, callback) {
  // Add custom claims
  const namespace = 'https://jamf-mcp/';
  
  // Add user metadata
  context.idToken[namespace + 'email'] = user.email;
  context.idToken[namespace + 'name'] = user.name;
  
  // Add default scopes
  context.accessToken.scope = context.accessToken.scope || [];
  if (!context.accessToken.scope.includes('read:jamf')) {
    context.accessToken.scope.push('read:jamf');
  }
  
  callback(null, user, context);
}
```

## Step 9: Get Your Configuration Values

After setup, you'll have these values for your deployment:

```bash
# Auth0 Configuration
AUTH0_DOMAIN="your-tenant-name.auth0.com"
AUTH0_CLIENT_ID="your-client-id-here"
AUTH0_CLIENT_SECRET="your-client-secret-here"
AUTH0_AUDIENCE="https://jamf-mcp-api"
REQUIRED_SCOPES="openid profile email read:jamf write:jamf"
```

## Step 10: Update Your Terraform Configuration

Edit `/aws/terraform/terraform.tfvars`:

```hcl
# Auth0 Configuration
auth0_domain        = "your-tenant-name.auth0.com"
auth0_client_id     = "your-client-id-here"
auth0_client_secret = "your-client-secret-here"
auth0_audience      = "https://jamf-mcp-api"
required_scopes     = "openid profile email read:jamf write:jamf"
```

## Step 11: Test Auth0 Configuration (After Deployment)

After deploying to AWS, you can test the OAuth flow:

1. Navigate to: `https://your-alb-dns.com/auth/authorize`
2. You should be redirected to Auth0 login
3. After login, you'll be redirected to ChatGPT

## Troubleshooting

### Common Issues

1. **"Callback URL mismatch"**
   - Ensure the callback URL in Auth0 matches exactly
   - Check for trailing slashes
   - Verify the protocol (http vs https)

2. **"Invalid audience"**
   - Make sure the audience in your app matches the API identifier
   - Check that the API is enabled

3. **"Scope not allowed"**
   - Verify the scopes are defined in the API
   - Check that the application is authorized for the API

### Testing with cURL

Test your Auth0 configuration:

```bash
# Get the OpenID configuration
curl https://your-tenant-name.auth0.com/.well-known/openid-configuration

# Test the authorization endpoint
curl "https://your-tenant-name.auth0.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=https://chatgpt.com/auth/callback&scope=openid%20profile%20email"
```

## Security Best Practices

1. **Rotate Secrets Regularly**
   - Change your client secret every 90 days
   - Update in AWS Secrets Manager

2. **Use Least Privilege**
   - Only grant necessary scopes
   - Restrict callback URLs to specific domains

3. **Enable MFA**
   - Go to **Security** → **Multi-factor Auth**
   - Enable for all users

4. **Monitor Activity**
   - Check **Monitoring** → **Logs** regularly
   - Set up alerts for suspicious activity

## Next Steps

After configuring Auth0:

1. Complete your Jamf API credentials configuration
2. Deploy to AWS using Terraform or the deployment script
3. Update Auth0 callback URLs with your actual ALB DNS
4. Configure ChatGPT custom connector with your endpoints

## Additional Resources

- [Auth0 Documentation](https://auth0.com/docs)
- [Auth0 Regular Web App Quickstart](https://auth0.com/docs/quickstart/webapp)
- [OAuth 2.0 Authorization Framework](https://oauth.net/2/)