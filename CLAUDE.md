# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Building and Running
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Start development server with hot reload
- `npm run serve` - Run compiled production server
- `npm run inspector` - Launch MCP inspector for debugging

### Testing
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm test -- path/to/test.ts` - Run specific test file
- `npm test -- --testNamePattern="pattern"` - Run tests matching pattern

### Code Quality
- `npm run lint` - Check code style
- `npm run lint:fix` - Auto-fix linting issues
- `npm run typecheck` - Verify TypeScript types without building

### Environment Setup
Required environment variables:
- `JAMF_URL` - Your Jamf Pro server URL
- `JAMF_CLIENT_ID` - OAuth2 client ID
- `JAMF_CLIENT_SECRET` - OAuth2 client secret
- Optional: `JAMF_USERNAME`, `JAMF_PASSWORD` for basic auth

## Architecture Overview

This is an MCP (Model Context Protocol) server that bridges AI assistants with Jamf Pro for Apple device management. The architecture follows MCP patterns with three main component types:

### Core Components

1. **Tools** (`/src/tools/`) - Executable functions that perform actions:
   - `device_search.ts` - Search and manage devices
   - `policy_execution.ts` - Execute policies on devices
   - `script_deployment.ts` - Deploy scripts for troubleshooting
   - `inventory_update.ts` - Update device inventory

2. **Resources** (`/src/resources/`) - Read-only data endpoints:
   - `device_compliance.ts` - Compliance reporting
   - `storage_report.ts` - Device storage analysis
   - `os_version_report.ts` - OS version distribution

3. **Prompts** (`/src/prompts/`) - Workflow templates for complex operations

### Client Strategy Pattern

The codebase implements multiple Jamf API client strategies (`/src/jamfClient.ts`):
- **Classic Client** - Uses traditional Jamf API endpoints
- **Advanced Search Client** - Leverages advanced search API
- **Hybrid Client** - Combines classic and advanced approaches
- **Unified Client** - Optimal performance with fallback strategies

### Key Design Patterns

1. **Safety Features**:
   - Read-only mode support
   - Confirmation required for destructive operations
   - Comprehensive error handling with actionable messages

2. **Authentication**:
   - OAuth2 (preferred) with automatic token refresh
   - Basic auth fallback
   - Credential validation on startup

3. **Testing Strategy**:
   - Unit tests for individual components
   - Integration tests with mock Jamf API
   - Test utilities in `__tests__/testUtils.ts`

### Important Implementation Notes

- All tools validate input using Zod schemas
- Error responses include troubleshooting suggestions
- Device searches support various identifiers (serial, ID, name)
- Policy execution includes pre-checks and safety validations
- Resources implement pagination for large datasets
- All API interactions include retry logic and timeout handling

When modifying the codebase:
1. Follow existing TypeScript patterns and strict typing
2. Add tests for new functionality
3. Update relevant documentation
4. Ensure error messages are helpful for end users
5. Consider performance implications for large Jamf environments