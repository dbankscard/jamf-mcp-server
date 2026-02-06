# Testing Jamf MCP Skills

## Overview

The Jamf MCP Server includes a comprehensive test suite for all skills that runs automatically before building. This ensures that all skills are working correctly before deployment.

## Running Tests

### Basic Test Run
```bash
npm test
# or
npm run test:skills
```

### Verbose Mode
To see detailed output including mock API calls and results:
```bash
VERBOSE=true npm run test:skills
```

### Build with Automatic Testing
The standard build command now includes automatic skill testing:
```bash
npm run build
```

### Build Without Testing
If you need to build quickly without running tests:
```bash
npm run build:force
```

## Test Coverage

The test suite covers all skills with the following test scenarios:

### 1. Device Search
- **Basic search**: Tests searching by device name
- **Possessive form**: Tests natural language like "Jane's MacBook"
- **User search**: Tests searching by assigned user

### 2. Find Outdated Devices
- Tests identifying devices that haven't checked in within a specified timeframe

### 3. Batch Inventory Update
- Tests updating multiple devices concurrently
- Validates both successful and failed updates

### 4. Deploy Policy by Criteria
- Tests policy deployment with device criteria filtering
- Includes dry-run validation

### 5. Scheduled Compliance Check
- Tests comprehensive compliance auditing
- Validates summary report generation

### 6. Error Handling
- Tests graceful handling of invalid skill names

## Writing New Skill Tests

When adding a new skill, add corresponding tests to `test-all-skills.js`:

```javascript
await runner.runTest(
  'Your Skill Name - Test Description',
  'skill-name',
  { 
    // Input parameters for the skill
    param1: 'value1',
    param2: 'value2'
  },
  [
    // Assertions to validate the result
    Object.assign(
      (result) => result.success === true,
      { message: 'Should succeed' }
    ),
    Object.assign(
      (result) => result.data.someField === expectedValue,
      { message: 'Should return expected data' }
    )
  ]
);
```

## CI/CD Integration

Tests run automatically in GitHub Actions on:
- Every push to main, develop, or feature branches
- Every pull request to main or develop

The CI pipeline tests against multiple Node.js versions (18.x, 20.x, 22.x) to ensure compatibility.

## Troubleshooting

### Tests Failing Locally
1. Ensure you have the latest dependencies: `npm install`
2. Rebuild the project: `npm run build:quick`
3. Run tests in verbose mode to see details: `VERBOSE=true npm test`

### Mock Data
The test suite uses mock Jamf Pro API responses defined in `test-all-skills.js`. If you need to test with different data scenarios, modify the `mockDevices`, `mockPolicies`, or other mock data structures.

### Adding New Tools
If your skill uses a new tool, add it to the `createMockContext` function:

```javascript
case 'yourNewTool':
  return { 
    data: { 
      // Mock response for your tool
    } 
  };
```

## Best Practices

1. **Always run tests before committing**: The build process enforces this
2. **Keep tests fast**: Use mock data instead of real API calls
3. **Test edge cases**: Include tests for error conditions and empty results
4. **Update tests when modifying skills**: Keep tests in sync with skill behavior
5. **Use descriptive test names**: Make it clear what each test validates