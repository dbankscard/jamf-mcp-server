# Security Configuration

## TLS/SSL Certificate Verification

By default, the Jamf MCP Server enforces strict TLS certificate verification for all HTTPS connections. This is a critical security feature that prevents man-in-the-middle attacks.

### Production Environment

In production, **ALWAYS** keep certificate verification enabled (default):

```bash
# Default - Certificate verification ENABLED
JAMF_ALLOW_INSECURE=false
```

### Development with Self-Signed Certificates

If you're testing with a Jamf instance that uses self-signed certificates, you can temporarily disable certificate verification:

```bash
# DEVELOPMENT ONLY - Disables certificate verification
JAMF_ALLOW_INSECURE=true
```

**⚠️ WARNING**: Never use `JAMF_ALLOW_INSECURE=true` in production environments. This setting:
- Disables SSL/TLS certificate verification
- Makes your connection vulnerable to man-in-the-middle attacks
- Should only be used in isolated development environments

### Recommended Approach for Self-Signed Certificates

Instead of disabling certificate verification, we recommend:

1. **Add the certificate to your trust store**:
   ```bash
   # macOS
   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain path/to/cert.pem
   
   # Linux
   sudo cp path/to/cert.pem /usr/local/share/ca-certificates/
   sudo update-ca-certificates
   ```

2. **Use a proper certificate** from a trusted Certificate Authority (CA)

3. **Use environment-specific certificates** with proper validation

## Authentication Security

The MCP server supports multiple authentication methods:

- **OAuth2 Client Credentials**: Recommended for production
- **Basic Authentication**: For backward compatibility with Classic API

### Secure Credential Storage

Never commit credentials to version control. Use environment variables or secure secret management services:

```bash
# Use a .env file (add to .gitignore)
JAMF_CLIENT_ID=your-client-id
JAMF_CLIENT_SECRET=your-client-secret

# Or use a secrets manager
export JAMF_CLIENT_SECRET=$(aws secretsmanager get-secret-value --secret-id jamf-api-secret --query SecretString --output text)
```

## API Security Best Practices

1. **Use Read-Only Mode** when possible:
   ```bash
   JAMF_READ_ONLY=true
   ```

2. **Implement Rate Limiting**:
   ```bash
   JAMF_ENABLE_RATE_LIMITING=true
   RATE_LIMIT_MAX=100
   RATE_LIMIT_WINDOW=900000
   ```

3. **Enable Circuit Breaker** for resilience:
   ```bash
   JAMF_ENABLE_CIRCUIT_BREAKER=true
   ```

4. **Use HTTPS** for all communications
5. **Validate all inputs** to prevent injection attacks
6. **Log security events** but never log sensitive data

## Deployment Security Checklist

- [ ] Certificate verification enabled (`JAMF_ALLOW_INSECURE=false`)
- [ ] Credentials stored securely (not in code)
- [ ] HTTPS enforced for all endpoints
- [ ] Rate limiting configured
- [ ] Monitoring and alerting configured
- [ ] Regular security updates applied
- [ ] Access logs reviewed regularly
- [ ] Principle of least privilege applied to API credentials