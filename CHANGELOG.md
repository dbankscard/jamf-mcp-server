# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2024-01-31

### Added
- **Configuration Profile Management**
  - `listConfigurationProfiles` - List all configuration profiles (computer or mobile device)
  - `getConfigurationProfileDetails` - Get detailed information about specific profiles
  - `searchConfigurationProfiles` - Search profiles by name
  - `deployConfigurationProfile` - Deploy profiles to devices (with confirmation)
  - `removeConfigurationProfile` - Remove profiles from devices (with confirmation)
- **Package Management**
  - `listPackages` - List all packages with metadata
  - `getPackageDetails` - Get detailed package information
  - `searchPackages` - Search packages by name, filename, or category
  - `getPackageDeploymentHistory` - View deployment history and statistics
  - `getPoliciesUsingPackage` - Find policies that use specific packages
- **Smart Computer Groups**
  - `listComputerGroups` - List computer groups (smart, static, or all)
  - `getComputerGroupDetails` - Get detailed group information including criteria
  - `searchComputerGroups` - Search groups by name
  - `getComputerGroupMembers` - Get all members of a group
  - `createStaticComputerGroup` - Create new static groups (with confirmation)
  - `updateStaticComputerGroup` - Update group membership (with confirmation)
  - `deleteComputerGroup` - Delete groups (with confirmation)
- **Mobile Device Management**
  - `searchMobileDevices` - Search mobile devices by various criteria
  - `getMobileDeviceDetails` - Get comprehensive device information
  - `listMobileDevices` - List all mobile devices
  - `updateMobileDeviceInventory` - Force inventory updates
  - `sendMDMCommand` - Send MDM commands (lock, wipe, clear passcode, etc.)
  - `listMobileDeviceGroups` - List mobile device groups
  - `getMobileDeviceGroupDetails` - Get mobile device group details
- **Enhanced Script Management**
  - `getScriptDetails` now includes full script content, parameters, notes, and OS requirements
  - `getPolicyDetails` can now include full script content with `includeScriptContent` parameter
- **Enhanced Reporting**
  - New resource: `jamf://reports/mobile-device-compliance` - Mobile device compliance report
  - Enhanced compliance reports with better formatting and statistics

### Enhanced
- Policy tools now support:
  - Searching by name or ID
  - Getting full script content within policy details
  - Better error handling for missing or invalid policies
- Script tools now provide:
  - Complete script content retrieval
  - Script parameters and default values
  - OS requirements and compatibility info
- Configuration profile tools handle:
  - Both computer and mobile device profiles
  - Proper XML parsing for Classic API responses
  - Field name variations between API versions
- Package tools provide:
  - Deployment statistics and history
  - Policy usage tracking
  - Category-based filtering
- Mobile device tools support:
  - Comprehensive MDM command set (16+ commands)
  - Destructive action confirmations
  - Battery, storage, and security status

### Fixed
- XML format handling for Classic API responses (configuration profiles, groups, etc.)
- Improved fallback behavior when fields are missing
- Better error messages for API failures
- Consistent field naming across different API endpoints
- Proper handling of empty or null values in API responses

### Changed
- Updated TypeScript interfaces for all new features
- Improved API client error handling
- Better support for both Modern and Classic API endpoints
- Enhanced documentation and examples

## [1.1.0] - 2024-01-30

### Added
- Comprehensive retry and error handling system
  - Exponential backoff retry logic for transient failures
  - Circuit breaker pattern to prevent cascading failures
  - Enhanced error classes with actionable suggestions
  - Request/response logging in debug mode
  - Rate limiting capabilities
- New utility modules:
  - `utils/errors.ts` - Enhanced error classes (JamfAPIError, NetworkError, AuthenticationError, RateLimitError, ValidationError)
  - `utils/retry.ts` - Retry logic with exponential backoff and circuit breaker
  - `utils/axios-interceptors.ts` - HTTP interceptors for automatic retry and error enhancement
- Enhanced API client (`jamf-client-enhanced.ts`) with built-in retry logic
- Enhanced tools implementation with better error feedback
- Automatic mode selection based on configuration
- New environment variables for configuration:
  - `JAMF_USE_ENHANCED_MODE` - Enable enhanced error handling
  - `JAMF_MAX_RETRIES` - Configure retry attempts
  - `JAMF_RETRY_DELAY` - Initial retry delay
  - `JAMF_RETRY_MAX_DELAY` - Maximum retry delay
  - `JAMF_DEBUG_MODE` - Enable debug logging
  - `JAMF_ENABLE_RETRY` - Toggle automatic retries
  - `JAMF_ENABLE_RATE_LIMITING` - Enable rate limiting
  - `JAMF_ENABLE_CIRCUIT_BREAKER` - Enable circuit breaker

### Enhanced
- Error messages now include:
  - Detailed error context
  - Specific suggestions for resolution
  - Request IDs for tracking
  - Retry information when applicable
- API calls are automatically retried for:
  - Network errors (timeouts, connection issues)
  - Server errors (5xx status codes)
  - Rate limit errors (with appropriate delays)
- Debug mode provides comprehensive logging:
  - All HTTP requests and responses
  - Retry attempts with delays
  - Circuit breaker state changes

### Changed
- Main entry point now at `index-main.ts` for automatic mode selection
- Package version bumped to 1.1.0
- Updated package.json with new scripts:
  - `dev:enhanced` - Run in enhanced mode
  - `serve:enhanced` - Serve in enhanced mode
  - `test:enhanced` - Test enhanced error handling

### Documentation
- Added comprehensive error handling documentation (`docs/ERROR_HANDLING.md`)
- Updated README with enhanced mode configuration
- Added examples for using enhanced error handling
- Created `.env.example` with all configuration options

## [1.0.0] - 2024-01-29

### Added
- Initial release of Jamf MCP Server
- 11 tools for device and policy management
- 4 resources for reporting and analytics
- 5 workflow prompts for common tasks
- Dual authentication support (OAuth2 and Basic Auth)
- Intelligent API routing between Modern and Classic Jamf APIs
- Advanced Search fallback for limited permissions
- Comprehensive test suite with 70-80% coverage
- TypeScript with strict mode
- Read-only safety mode
- Batch operations support
- Performance optimizations for large fleets

### Security
- Environment variable based configuration
- No hardcoded credentials
- Read-only mode by default
- Confirmation required for destructive operations

### Documentation
- Comprehensive README with setup instructions
- API documentation for all tools and resources
- Troubleshooting guide
- Example configurations
- Contributing guidelines