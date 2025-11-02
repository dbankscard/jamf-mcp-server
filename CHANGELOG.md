# Changelog

## [Unreleased] - Security and Production Hardening

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
  - Removed duplicate skills directory
  - Updated .gitignore to prevent future issues
  - Consistent import paths

### Documentation
- Added comprehensive security documentation
- Created Docker deployment guide
- Updated environment variable documentation
- Added connection pool configuration options

### Developer Experience
- All skills tests passing
- Build process includes automatic testing
- Improved TypeScript type safety
- Better development tooling support

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
  - Better IntelliSense support

- **Health Checks**: Comprehensive monitoring endpoints
  - `/health` - Basic health status
  - `/health/detailed` - Full system diagnostics
  - `/health/live` - Kubernetes liveness probe
  - `/health/ready` - Kubernetes readiness probe
  - Checks: memory, Jamf API, connection pool, shutdown status

## [1.2.0] - Previous Release
- Skills integration for Claude Desktop and ChatGPT
- Enhanced error handling with retry logic
- OAuth2 and Basic Auth support
- Device search optimization