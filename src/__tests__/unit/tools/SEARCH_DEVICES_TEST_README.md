# Search Devices Tool Tests

This test suite comprehensively tests the `searchDevices` tool functionality.

## Test Coverage

### Search Scenarios (5 tests)
- ✅ Find all MacBooks
- ✅ Search for John Smith's devices  
- ✅ Find device with serial number ABC123
- ✅ Show devices with IP 192.168.1.50
- ✅ Find all devices in the IT department

### Edge Cases (3 tests)
- ✅ Handle no results
- ✅ Handle special characters in search query
- ✅ Handle empty search query

### Limit Parameter (2 tests)
- ✅ Respect default limit of 50
- ✅ Respect custom limit

### Error Handling (4 tests)
- ✅ Handle 401 unauthorized error
- ✅ Handle 403 forbidden error
- ✅ Handle 500 server error
- ✅ Handle network errors

### Response Format (2 tests)
- ✅ Return correct format for Claude
- ✅ Handle missing optional fields

## Total: 16 tests

All tests mock the Jamf API responses and verify:
1. The correct API endpoints are called
2. The request parameters are properly formatted
3. The response data is correctly parsed and returned
4. Error conditions are handled appropriately
5. The response format matches what Claude expects