# Jamf MCP Server Test Suite

This directory contains the comprehensive test suite for the Jamf MCP server.

## Directory Structure

```
__tests__/
├── fixtures/          # Mock API responses and test data
├── helpers/           # Test utilities and helper functions
├── types/            # TypeScript type definitions for tests
├── unit/             # Unit tests for individual components
├── integration/      # Integration tests for API workflows
├── setup.ts          # Jest setup and global configuration
└── README.md         # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- jamf-client-classic.test.ts

# Run tests with verbose output
SHOW_TEST_LOGS=true npm test
```

## Writing Tests

### Using Mock Fixtures

```typescript
import { 
  mockClassicComputerSearchResponse,
  mockClassicComputerDetailResponse 
} from '../fixtures/computer-responses';

// Use in your tests
mockAdapter.addMockResponse('GET', '/endpoint', {
  status: 200,
  data: mockClassicComputerSearchResponse
});
```

### Using Test Helpers

```typescript
import { 
  createMockAxios,
  createTestDates,
  assertValidJamfDate,
  setupTestEnvironment 
} from '../helpers/test-utils';

// Set up mock axios
const { axios, adapter } = createMockAxios({ autoAuth: true });

// Use test dates
const { now, nowJamfFormat, nowEpoch } = createTestDates();

// Assert date validity
assertValidJamfDate(dateValue);
```

### Custom Matchers

The test suite includes custom Jest matchers:

```typescript
// Check if a value is a valid Jamf date
expect(dateValue).toBeValidJamfDate();

// Check if a computer object matches expected values
expect(computer).toMatchJamfComputer({
  name: 'Test-Computer',
  serialNumber: 'ABC123'
});
```

## Key Testing Patterns

### 1. Date Handling Tests

The Jamf API returns dates in multiple formats. Always test all formats:

```typescript
test('should handle all date formats', () => {
  const { report_date, report_date_utc, report_date_epoch } = response.general;
  
  assertDateFormatsMatch(report_date, report_date_utc, report_date_epoch);
});
```

### 2. Authentication Testing

```typescript
test('should authenticate before API calls', async () => {
  await client.someMethod();
  
  mockAdapter.expectAuth();
});
```

### 3. Error Handling

```typescript
test('should handle 404 errors', async () => {
  mockAdapter.addMockResponse('GET', '/endpoint', {
    status: 404,
    data: mockNotFoundResponse
  });

  await expect(client.method()).rejects.toThrow();
});
```

### 4. Read-Only Mode

```typescript
test('should prevent destructive operations', async () => {
  const client = new JamfApiClient({ readOnlyMode: true });
  
  await expect(client.updateInventory('1')).rejects.toThrow('read-only mode');
});
```

## Mock Data Conventions

### Computer Objects

- Use realistic IDs (numeric for Classic API, UUID-like strings for Modern API)
- Include all date format variations in general section
- Use consistent test data (e.g., 'MacBook-Pro-001', 'C02ABC123DEF')

### Date Fields

Always include all three formats:
- Standard: '2024-12-24 18:27:00'
- UTC: '2024-12-24T18:27:00.000+0000'
- Epoch: 1735074420000

### Error Responses

Follow Jamf API error format:
```typescript
{
  httpStatus: 404,
  errors: [{
    code: 'RESOURCE_NOT_FOUND',
    description: 'Computer not found',
    id: '0',
    field: null
  }]
}
```

## Integration Test Patterns

### Testing Workflows

```typescript
describe('Complete Workflow', () => {
  test('should search and fetch details', async () => {
    // Mock search
    mockAdapter.addMockResponse('GET', '/search', { 
      status: 200, 
      data: searchResults 
    });
    
    // Mock details
    mockAdapter.addMockResponse('GET', '/details/1', { 
      status: 200, 
      data: detailResults 
    });
    
    // Execute workflow
    const results = await client.searchComputers('test');
    const details = await client.getComputerDetails(results[0].id);
    
    // Verify complete flow
    expect(details).toBeDefined();
  });
});
```

## Debugging Tests

### Enable Console Logs

```bash
SHOW_TEST_LOGS=true npm test
```

### Inspect Mock Requests

```typescript
// Get all requests
const history = mockAdapter.getRequestHistory();

// Get last request
const lastRequest = mockAdapter.getLastRequest();

// Find specific request
const authRequest = mockAdapter.expectRequest('POST', '/auth/token');
```

## Coverage Requirements

The project enforces these coverage thresholds:
- Branches: 70%
- Functions: 80%
- Lines: 80%
- Statements: 80%

Run coverage report:
```bash
npm test -- --coverage
```

## Common Issues

### 1. Mock Not Found

If you see "No mock response configured", ensure:
- The URL matches exactly (including query parameters if needed)
- The HTTP method is correct
- The mock is added before the test executes

### 2. Date Parsing Failures

- Check that all three date formats are included in mock data
- Verify epoch timestamps are in milliseconds (not seconds)
- Use `assertValidJamfDate()` helper for debugging

### 3. Authentication Issues

- Ensure `autoAuth: true` is set in `createMockAxios()`
- Check that auth endpoints are mocked before other requests
- Verify token expiration logic in tests

## Contributing

When adding new tests:
1. Place unit tests in `unit/` directory
2. Place integration tests in `integration/` directory
3. Add new fixtures to `fixtures/` with descriptive names
4. Update helpers if creating reusable test utilities
5. Follow existing naming conventions
6. Include tests for error cases
7. Test all date format variations