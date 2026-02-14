# Changelog

## [2.1.0] - 2026-02-14

### Major Features
- **108 tools** (up from 56) — expanded coverage across the full Jamf Pro API and Classic API
- **12 resources** — all returning live data including compliance, storage, OS versions, encryption, and patch reports
- **12 workflow prompts** — guided templates for common admin tasks like onboarding, offboarding, security audits, and staged rollouts
- **5 skills** — advanced multi-step operations for the ChatGPT connector

### Compound Tools
- **getFleetOverview**: Single-call fleet summary combining inventory counts, compliance rates, and mobile device status
- **getDeviceFullProfile**: Complete device profile by name, serial, or ID with parallel API calls
- **getSecurityPosture**: Fleet security analysis — encryption, compliance, and OS currency
- **getPolicyAnalysis**: Policy analysis by ID or name with configuration, scope, and compliance

### API Improvements
- **Bearer Token authentication on Classic API** — full OAuth2 Client Credentials support without needing a username/password
- **Parallel API calls** — batch operations and compound tools run requests concurrently for faster results
- **Hybrid API client** — automatic fallback between Jamf Pro API and Classic API for maximum compatibility

### New Tool Categories
- Computer History and MDM Commands (getComputerHistory, sendComputerMDMCommand, flushMDMCommands)
- Advanced Computer Searches (create, list, get, delete)
- Managed Software Updates (listSoftwareUpdatePlans, createSoftwareUpdatePlan)
- PreStage Enrollments (computer and mobile)
- Network Segments
- Accounts and Users
- App Installers
- Restricted Software (CRUD operations)
- Webhooks
- LAPS (Local Administrator Password Solution)
- Patch Management
- Extension Attributes (CRUD operations)
- Policy management (create, update, clone, enable/disable, scope management)
- Script management (create, update, delete)

### Security Fixes
- **CRITICAL**: Re-enabled HTTPS certificate verification by default
  - Added `JAMF_ALLOW_INSECURE` environment variable for development only
  - Created comprehensive security documentation
  - Certificate verification now enabled unless explicitly disabled

### Performance Improvements
- **Memory Leak Fix**: Implemented LRU cache for JWKS clients
  - Automatic eviction of least recently used clients
  - Configurable cache size and TTL
  - Periodic cleanup of expired entries
  - Proper cleanup on shutdown

- **Connection Pooling**: Added HTTP/HTTPS connection pooling
  - Reuses connections for better performance
  - Configurable pool size and timeouts
  - Connection metrics tracking
  - Reduces connection overhead

### Infrastructure
- **Docker Support**: Complete containerization setup
  - Multi-stage Dockerfile for optimized images
  - Docker Compose for easy deployment
  - Development and production configurations
  - Optional Nginx reverse proxy with HTTPS
  - Health checks and proper signal handling

### Code Quality
- **Error Handling**: Comprehensive error handling improvements
  - Centralized error handler utility
  - Global unhandled rejection handlers
  - Structured logging with context
  - Replaced console.error with proper logger
  - Async operation timeouts

- **Project Structure**: Cleaned up duplicate files
  - Updated .gitignore to prevent future issues
  - Consistent import paths

### Documentation
- Comprehensive README with all 108 tools documented
- Security documentation (SECURITY.md)
- Docker deployment guide (DOCKER_DEPLOYMENT.md)
- Error handling guide (ERROR_HANDLING.md)
- Skills testing documentation
- ChatGPT connector setup guides

### Testing & Quality
- **Unit Tests**: Added comprehensive test suite
  - LRU cache tests with TTL and eviction
  - Error handler utilities tests
  - Auth middleware tests with mocked dependencies
  - Skills manager tests covering all skills
  - Jest configuration with ESM support

- **Graceful Shutdown**: Implemented shutdown manager
  - Priority-based handler execution
  - Timeout protection for handlers
  - Signal handling (SIGTERM, SIGINT, SIGUSR2)
  - Cleanup for all resources (auth, HTTP agents, servers)
  - Prevents data loss during deployment

- **Type Safety**: Improved TypeScript types
  - Created comprehensive Jamf API type definitions
  - Added common types for requests and responses
  - Type guards for safe error handling
  - Replaced 'any' types with proper interfaces

- **Health Checks**: Comprehensive monitoring endpoints
  - `/health` - Basic health status
  - `/health/detailed` - Full system diagnostics
  - `/health/live` - Kubernetes liveness probe
  - `/health/ready` - Kubernetes readiness probe
  - Checks: memory, Jamf API, connection pool, shutdown status

- **Tool Annotations**: Each tool declares `readOnlyHint` and `destructiveHint` for client-side safety
- **Correct Jamf terminology** — all documentation and tool descriptions align with official Jamf developer documentation

### Reliability & Bug Fixes
- **Auth Token Refresh Race Condition**: Added mutex-based locking to prevent concurrent token refresh requests from corrupting auth state
- **Cache Invalidation**: Write operations (create, update, delete) now properly invalidate cached data to prevent stale reads
- **JamfAPIError Wrapping**: All API methods in the hybrid client now throw structured `JamfAPIError` with status codes, error codes, and actionable suggestions instead of raw errors
- **Log Level Corrections**: Replaced `console.error` with proper `logger.error`/`logger.warn`/`logger.info` calls throughout the codebase

### New Tools
- **deletePolicy**: Delete a policy (requires confirmation)
- **deleteConfigurationProfile**: Delete a configuration profile — computer or mobile device (requires confirmation)
- **deleteComputerExtensionAttribute**: Delete an extension attribute (requires confirmation)
- Removed `debugDeviceDates` (internal debug tool not intended for production use)

### Code Quality Improvements
- **Zod Schema Deduplication**: Extracted shared field definitions for create/update tool pairs to reduce repetition
- **ESLint Cleanup**: Resolved 73 lint errors across the codebase
- **GitHub Actions CI Pipeline**: Added `ci.yml` workflow — build, test, and lint on every PR and push to main
- **New Unit Tests**: Added tests for `utils/retry.ts` and `utils/errors.ts` covering retry logic, circuit breaker, and error classes
- **XML Builder Extraction**: Centralized XML construction for Classic API payloads

## [1.2.0] - Previous Release
- Skills integration for Claude Desktop and ChatGPT
- Enhanced error handling with retry logic
- OAuth2 and Basic Auth support
- Device search optimization
