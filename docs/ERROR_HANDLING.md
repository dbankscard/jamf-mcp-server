# Enhanced Error Handling and Retry Logic

This document describes the comprehensive error handling and retry features added to the Jamf MCP Server.

## Overview

The enhanced error handling system provides:
- Exponential backoff retry logic for transient failures
- Circuit breaker pattern to prevent cascading failures
- Detailed error messages with actionable suggestions
- Request/response logging in debug mode
- Rate limiting capabilities
- Enhanced error classes for better error categorization

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JAMF_USE_ENHANCED_MODE` | `false` | Enable enhanced error handling features |
| `JAMF_MAX_RETRIES` | `3` | Maximum number of retry attempts |
| `JAMF_RETRY_DELAY` | `1000` | Initial retry delay in milliseconds |
| `JAMF_RETRY_MAX_DELAY` | `10000` | Maximum retry delay in milliseconds |
| `JAMF_RETRY_BACKOFF_MULTIPLIER` | `2` | Exponential backoff multiplier |
| `JAMF_DEBUG_MODE` | `false` | Enable debug logging |
| `JAMF_ENABLE_RETRY` | `true` | Enable automatic retries |
| `JAMF_ENABLE_RATE_LIMITING` | `false` | Enable rate limiting |
| `JAMF_ENABLE_CIRCUIT_BREAKER` | `false` | Enable circuit breaker |

### Example Configuration

```bash
# Basic enhanced mode
export JAMF_USE_ENHANCED_MODE=true
export JAMF_DEBUG_MODE=true

# Custom retry settings
export JAMF_MAX_RETRIES=5
export JAMF_RETRY_DELAY=2000
export JAMF_RETRY_MAX_DELAY=30000

# Enable all features
export JAMF_USE_ENHANCED_MODE=true
export JAMF_ENABLE_RETRY=true
export JAMF_ENABLE_RATE_LIMITING=true
export JAMF_ENABLE_CIRCUIT_BREAKER=true
export JAMF_DEBUG_MODE=true
```

## Error Classes

### JamfAPIError
Base error class for all Jamf API errors. Includes:
- Status code
- Error code
- Suggestions for resolution
- Context information

### NetworkError
For network-related issues:
- Connection refused
- Timeouts
- DNS resolution failures
- Connection resets

### AuthenticationError
For authentication failures:
- Invalid credentials
- Expired tokens
- Missing permissions

### RateLimitError
For rate limiting:
- Includes retry-after information
- Rate limit details

### ValidationError
For input validation:
- Field-level error details
- Schema validation failures

### ConfigurationError
For configuration issues:
- Missing environment variables
- Invalid configuration values

## Retry Logic

### Automatic Retries
The system automatically retries failed requests for:
- Network errors (timeouts, connection issues)
- Server errors (5xx status codes)
- Rate limit errors (with appropriate delays)

### Exponential Backoff
Retry delays increase exponentially:
```
delay = min(initialDelay * (backoffMultiplier ^ attemptNumber), maxDelay)
```

### Jitter
A random jitter (0-10% of delay) is added to prevent thundering herd problems.

## Circuit Breaker

The circuit breaker prevents cascading failures by:
1. **Closed State**: Normal operation
2. **Open State**: Fails fast after threshold failures
3. **Half-Open State**: Allows limited requests to test recovery

### Configuration
- **Failure Threshold**: 5 consecutive failures
- **Reset Timeout**: 60 seconds
- **Half-Open Requests**: 3 successful requests to close

## Usage Examples

### Basic Usage (Enhanced Mode)
```typescript
// Automatically uses enhanced error handling
const client = new JamfApiClientEnhanced({
  baseUrl: process.env.JAMF_URL,
  clientId: process.env.JAMF_CLIENT_ID,
  clientSecret: process.env.JAMF_CLIENT_SECRET,
});

// Errors will be automatically retried and enhanced
try {
  const computers = await client.searchComputers('macbook');
} catch (error) {
  if (error instanceof JamfAPIError) {
    console.error(error.toDetailedString());
  }
}
```

### Custom Retry Logic
```typescript
import { retryWithBackoff } from './utils/retry.js';

const result = await retryWithBackoff(
  async () => {
    return await someApiCall();
  },
  {
    maxRetries: 5,
    initialDelay: 2000,
    onRetry: (error, attempt, delay) => {
      console.log(`Retry attempt ${attempt} after ${delay}ms`);
    }
  }
);
```

### Circuit Breaker Usage
```typescript
import { RetryableCircuitBreaker } from './utils/retry.js';

const breaker = new RetryableCircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000,
});

try {
  const result = await breaker.executeWithRetry(
    'api-endpoint',
    async () => await apiCall()
  );
} catch (error) {
  if (error.errorCode === 'CIRCUIT_OPEN') {
    // Circuit is open, service is unavailable
  }
}
```

## Error Message Format

Enhanced error messages include:
```
JamfAPIError: Bad Request: Invalid device ID format [GET /api/v1/computers-inventory-detail/invalid]
Status Code: 400
Error Code: VALIDATION_ERROR

Suggestions:
  1. Check the request parameters and data format
  2. Ensure all required fields are provided
  3. Verify the data types match the API requirements

Context:
  computerId: "invalid"
  requestId: "1234567890-abc"
```

## Debug Mode

When `JAMF_DEBUG_MODE=true`:
- All HTTP requests and responses are logged
- Retry attempts are logged with delays
- Circuit breaker state changes are logged
- Stack traces are included in error output

### Debug Log Format
```
[HTTP Request] {
  method: 'GET',
  url: '/api/v1/computers-inventory',
  requestId: '1234567890-abc',
  headers: { Authorization: '[REDACTED]' }
}

[HTTP Response] {
  status: 200,
  duration: '245ms',
  requestId: '1234567890-abc',
  dataSize: 15234
}

[HTTP Retry] {
  attempt: 1,
  delay: '2000ms',
  url: '/api/v1/computers-inventory',
  error: 'Request timeout'
}
```

## Best Practices

1. **Use Enhanced Mode for Production**
   - Provides better reliability and error handling
   - Automatic retry for transient failures
   - Better error messages for debugging

2. **Configure Retry Settings Appropriately**
   - Increase retries for critical operations
   - Adjust delays based on your network conditions
   - Use circuit breaker for external dependencies

3. **Handle Errors Gracefully**
   - Check error types to provide specific handling
   - Use error suggestions for user feedback
   - Log errors with context for debugging

4. **Monitor Circuit Breaker State**
   - Check circuit state in health endpoints
   - Alert on circuit open states
   - Monitor failure rates

## Migration Guide

To migrate from the standard client to enhanced:

1. **Update Environment Variables**
   ```bash
   export JAMF_USE_ENHANCED_MODE=true
   ```

2. **Handle New Error Types**
   ```typescript
   import { JamfAPIError, NetworkError } from './utils/errors.js';
   
   try {
     await client.someMethod();
   } catch (error) {
     if (error instanceof NetworkError) {
       // Handle network issues
     } else if (error instanceof JamfAPIError) {
       // Handle API errors
       console.error(error.suggestions);
     }
   }
   ```

3. **Update Error Messages**
   - Use `error.toDetailedString()` for detailed output
   - Access `error.suggestions` for user-friendly help
   - Use `error.context` for debugging information

## Troubleshooting

### Circuit Breaker Stays Open
- Check failure threshold settings
- Verify reset timeout is appropriate
- Monitor for persistent service issues

### Too Many Retries
- Adjust retry configuration
- Check if errors are actually retryable
- Consider using circuit breaker

### Rate Limiting Issues
- Enable rate limiting feature
- Adjust request intervals
- Implement request queuing

### Debug Information
Enable debug mode to see:
- All HTTP traffic
- Retry attempts and delays
- Circuit breaker state changes
- Detailed error information