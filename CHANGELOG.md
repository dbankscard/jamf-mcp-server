# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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