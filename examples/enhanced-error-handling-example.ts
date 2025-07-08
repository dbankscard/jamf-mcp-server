import { JamfApiClientEnhanced } from '../src/jamf-client-enhanced.js';
import { JamfAPIError, NetworkError, AuthenticationError } from '../src/utils/errors.js';

// Example: Using the enhanced Jamf API client with proper error handling

async function main() {
  // Configure the enhanced client
  const client = new JamfApiClientEnhanced({
    baseUrl: process.env.JAMF_URL!,
    clientId: process.env.JAMF_CLIENT_ID!,
    clientSecret: process.env.JAMF_CLIENT_SECRET!,
    enableRetry: true,
    enableRateLimiting: true,
    enableCircuitBreaker: true,
  });

  try {
    // Example 1: Search for devices with automatic retry on failure
    console.log('Searching for devices...');
    const devices = await client.searchComputers('macbook', 10);
    console.log(`Found ${devices.length} devices`);

    // Example 2: Get device details with enhanced error information
    if (devices.length > 0) {
      const device = await client.getComputerDetails(devices[0].id);
      console.log(`Device ${device.name} last contacted: ${device.general?.lastContactTime}`);
    }

    // Example 3: Handle a potentially failing operation
    try {
      await client.updateInventory('non-existent-device');
    } catch (error) {
      if (error instanceof JamfAPIError) {
        // Enhanced error provides detailed information
        console.error('API Error occurred:');
        console.error(error.toDetailedString());
        
        // Access specific error properties
        console.error('Status Code:', error.statusCode);
        console.error('Error Code:', error.errorCode);
        console.error('Suggestions:', error.suggestions);
      }
    }

  } catch (error) {
    // Handle different error types appropriately
    if (error instanceof NetworkError) {
      console.error('Network issue detected:');
      console.error(error.message);
      console.error('Please check your network connection and Jamf Pro server availability.');
    } else if (error instanceof AuthenticationError) {
      console.error('Authentication failed:');
      console.error(error.message);
      console.error('Please verify your API credentials.');
    } else if (error instanceof JamfAPIError) {
      console.error('Jamf API Error:');
      console.error(error.toDetailedString());
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Example: Custom retry logic for specific operations
async function customRetryExample(client: JamfApiClientEnhanced) {
  const { retryWithBackoff } = await import('../src/utils/retry.js');
  
  // Retry a specific operation with custom settings
  const result = await retryWithBackoff(
    async () => {
      return await client.searchComputers('exec', 100);
    },
    {
      maxRetries: 5,
      initialDelay: 2000,
      onRetry: (error, attempt, delay) => {
        console.log(`Retry attempt ${attempt} after ${delay}ms due to:`, error.message);
      }
    }
  );
  
  console.log(`Found ${result.length} executive computers`);
}

// Example: Using circuit breaker for external dependencies
async function circuitBreakerExample(client: JamfApiClientEnhanced) {
  const { RetryableCircuitBreaker } = await import('../src/utils/retry.js');
  
  const circuitBreaker = new RetryableCircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 60000, // 1 minute
  });
  
  try {
    // Wrap API calls with circuit breaker
    const devices = await circuitBreaker.executeWithRetry(
      'device-search',
      async () => await client.searchComputers('ipad', 50)
    );
    
    console.log(`Circuit breaker allowed request, found ${devices.length} devices`);
  } catch (error) {
    if (error instanceof JamfAPIError && error.errorCode === 'CIRCUIT_OPEN') {
      console.error('Circuit breaker is open - too many recent failures');
      console.error('Service will be available again soon');
    }
  }
}

// Run the examples
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}