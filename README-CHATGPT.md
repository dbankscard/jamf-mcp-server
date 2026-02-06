# Jamf MCP Server - ChatGPT Connector

Production-ready MCP server for connecting ChatGPT to Jamf Pro via custom connectors.

## Security Features

- **OAuth2 Authentication**: Support for Auth0, Okta, and custom providers
- **Token Validation**: JWKS-based token verification with caching
- **Rate Limiting**: Configurable per-endpoint rate limits
- **Input Validation**: Zod-based schema validation for all inputs
- **CORS Protection**: Strict origin validation for ChatGPT domains
- **CSRF Protection**: State parameter validation for OAuth flows
- **Helmet.js**: Security headers and CSP policies
- **Non-root Docker**: Runs as unprivileged user
- **Request Logging**: Structured logging with Winston
- **Health Checks**: Built-in health monitoring endpoint

## Quick Start

1. **Clone and Install**
   ```bash
   git clone https://github.com/dbankscard/jamf-mcp-server.git
   cd jamf-mcp-server
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.chatgpt .env
   # Edit .env with your credentials
   ```

3. **Build and Run**
   ```bash
   npm run build
   npm run serve:http:prod
   ```

## Docker Deployment

```bash
# Build image
docker build -t jamf-mcp-server .

# Run with environment file
docker run -d \
  --name jamf-mcp-server \
  -p 3000:3000 \
  --env-file .env \
  jamf-mcp-server
```

## Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JAMF_URL` | Jamf Pro instance URL | Yes |
| `JAMF_CLIENT_ID` | Jamf Pro API client ID | Yes* |
| `JAMF_CLIENT_SECRET` | Jamf Pro API client secret | Yes* |
| `OAUTH_PROVIDER` | OAuth provider (auth0/okta) | Yes |
| `AUTH0_DOMAIN` | Auth0 tenant domain | If auth0 |
| `AUTH0_CLIENT_ID` | Auth0 application client ID | If auth0 |
| `AUTH0_CLIENT_SECRET` | Auth0 application secret | If auth0 |

\* Or provide `JAMF_USERNAME` and `JAMF_PASSWORD` for basic auth

## ChatGPT Configuration

1. Go to ChatGPT Settings > Connectors
2. Click "Create" custom connector
3. Configure:
   - **Name**: Jamf MCP Server
   - **Server URL**: `https://your-domain.com/mcp`
   - **OAuth Auth URL**: `https://your-domain.com/auth/authorize`
   - **OAuth Token URL**: `https://your-domain.com/auth/callback`
   - **Scopes**: `openid profile email offline_access`

## API Endpoints

- `GET /health` - Health check
- `GET /auth/authorize` - OAuth authorization
- `GET /auth/callback` - OAuth callback
- `POST /auth/token` - Token refresh
- `GET /mcp` - MCP SSE connection (requires auth)

## Security Considerations

1. **SSL/TLS Required**: Always use HTTPS in production
2. **Environment Variables**: Never commit credentials
3. **Rate Limiting**: Adjust limits based on your needs
4. **Monitoring**: Enable logging and monitoring
5. **Updates**: Keep dependencies updated

## Monitoring

The server provides structured JSON logs suitable for aggregation:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "label": "http-server",
  "message": "Request completed",
  "metadata": {
    "method": "GET",
    "url": "/health",
    "status": 200,
    "duration": 5,
    "requestId": "abc123"
  }
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error type",
  "message": "Human-readable message",
  "requestId": "abc123"
}
```

## Support

- [Documentation](docs/CHATGPT_DEPLOYMENT.md)
- [Issues](https://github.com/dbankscard/jamf-mcp-server/issues)
- [Security](SECURITY.md)