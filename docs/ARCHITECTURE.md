# Jamf MCP Server Architecture

This document provides a high-level architectural overview of the Jamf MCP Server for developers and maintainers.

## Overview

The Jamf MCP Server is a **Model Context Protocol (MCP)** server that bridges AI assistants (Claude Desktop, ChatGPT) with Jamf Pro enterprise device management. It provides a structured interface for AI to interact with Jamf Pro APIs through tools, resources, prompts, and skills.

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Assistants                            │
│     ┌───────────────┐              ┌───────────────────┐       │
│     │ Claude Desktop│              │ ChatGPT / Custom  │       │
│     └───────┬───────┘              └─────────┬─────────┘       │
│             │ stdio                          │ HTTP/SSE        │
└─────────────┼────────────────────────────────┼─────────────────┘
              ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Server Layer                            │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │ StdioTransport │  │ SSETransport   │  │ Express HTTP   │    │
│  │ (index.ts)     │  │ (http-server)  │  │ (REST/OAuth)   │    │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘    │
│           └───────────────────┴───────────────────┘             │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────┐     │
│  │                    MCP Handlers                        │     │
│  │   ┌─────────┐  ┌───────────┐  ┌─────────┐  ┌───────┐ │     │
│  │   │  Tools  │  │ Resources │  │ Prompts │  │Skills │ │     │
│  │   └────┬────┘  └─────┬─────┘  └────┬────┘  └───┬───┘ │     │
│  └────────┼─────────────┼─────────────┼───────────┼─────┘     │
└───────────┼─────────────┼─────────────┼───────────┼────────────┘
            └─────────────┴─────────────┴───────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Jamf Client Layer                           │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              JamfApiClientHybrid                        │    │
│  │   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │    │
│  │   │  OAuth2 Auth │  │  Basic Auth  │  │ Token Mgmt  │ │    │
│  │   └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │    │
│  │          └─────────────────┴─────────────────┘         │    │
│  │   ┌────────────────┐  ┌────────────────────────────┐  │    │
│  │   │ Circuit Breaker│  │ HTTP Agent Pool / Retry    │  │    │
│  │   └────────┬───────┘  └────────────┬───────────────┘  │    │
│  └────────────┴───────────────────────┴──────────────────┘    │
└───────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Jamf Pro API                               │
│       ┌─────────────────┐      ┌────────────────────┐          │
│       │  Modern API     │      │   Classic API      │          │
│       │  (OAuth2/JWT)   │      │   (Basic/Bearer)   │          │
│       └─────────────────┘      └────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Entry Points

The server has multiple entry points to support different modes:

| Entry Point | Binary | Transport | Purpose |
|-------------|--------|-----------|---------|
| `index-main.ts` | `jamf-mcp-server` | stdio | Main router - selects standard or enhanced mode |
| `index.ts` | - | stdio | Standard MCP server |
| `index-enhanced.ts` | - | stdio | Enhanced mode with retry/circuit breaker |
| `index-http.ts` | `jamf-mcp-http` | HTTP/SSE | HTTP server for ChatGPT integration |

**Mode Selection Flow:**
```
index-main.ts
    │
    ├── Check JAMF_USE_ENHANCED_MODE or feature flags
    │   (JAMF_ENABLE_RETRY, JAMF_ENABLE_CIRCUIT_BREAKER, etc.)
    │
    ├── Enhanced mode? ──► index-enhanced.ts
    │                      (retry, rate limiting, circuit breaker)
    │
    └── Standard mode? ──► index.ts
                           (basic functionality)
```

### 2. Tools System

Tools provide atomic operations that AI can invoke directly:

```
src/tools/
├── index-compat.ts          # Tool registration & handler binding
├── tool-implementations.ts  # Actual tool logic
├── validation-schemas.ts    # Zod schemas for parameter validation
├── skills-integration.ts    # Bridge between tools and skills
└── skills-mcp-integration.ts # MCP handler integration for skills
```

**Tool Categories:**

| Category | Examples |
|----------|----------|
| Device Management | `searchDevices`, `getDeviceDetails`, `updateInventory` |
| Policy Management | `listPolicies`, `getPolicyDetails`, `executePolicy` |
| Configuration Profiles | `listConfigurationProfiles`, `deployConfigurationProfile` |
| Scripts | `getScriptDetails`, `deployScript` |
| Compliance | `checkDeviceCompliance` |

**Tool Request Flow:**
```
MCP Tool Request
    │
    ▼
CallToolRequestSchema Handler
    │
    ├── Validate parameters (Zod schemas)
    │
    ├── Check if skill (name starts with "skill_")
    │   ├── YES → skillsManager.executeSkill()
    │   └── NO  → tool-implementations.ts
    │
    └── Format response for MCP
```

### 3. Skills System

Skills are multi-step workflows that orchestrate multiple tool calls:

```
src/skills/
├── manager.ts              # SkillsManager - registration & execution
├── types.ts                # Skill interfaces (SkillDefinition, SkillResult)
├── context-provider.ts     # SkillContext for tool access
├── http-initializer.ts     # Skills initialization for HTTP mode
│
├── device-management/
│   ├── device-search-optimized.ts   # Smart device search
│   ├── find-outdated-devices.ts     # Find inactive devices
│   └── batch-inventory-update.ts    # Bulk inventory updates
│
├── policy-management/
│   └── deploy-policy-by-criteria.ts # Criteria-based deployment
│
├── automation/
│   └── scheduled-compliance-check.ts # Compliance auditing
│
└── documentation/
    └── generate-environment-docs.ts  # Environment documentation
```

**Skill Execution Flow:**
```
AI calls skill_device_search
    │
    ▼
SkillsManager.executeSkill()
    │
    ├── Get skill definition
    │
    ├── Create SkillContext
    │   └── Provides callTool() method
    │
    ├── Execute skill.execute(context, params)
    │   │
    │   ├── context.callTool('searchDevices', ...)
    │   │       │
    │   │       └── tool-implementations.ts
    │   │               │
    │   │               └── JamfApiClientHybrid
    │   │
    │   └── Return SkillResult
    │
    └── Format response for MCP
```

**SkillResult Structure:**
```typescript
{
  success: boolean;      // Did the skill complete successfully?
  message: string;       // Human-readable summary
  data?: any;           // Structured result data
  error?: Error;        // Error details if failed
  nextActions?: string[]; // Suggested follow-up actions
}
```

### 4. Jamf Hybrid Client

The hybrid client (`src/jamf-client-hybrid.ts`) handles all Jamf Pro API communication:

```
JamfApiClientHybrid
    │
    ├── Authentication
    │   ├── OAuth2 (client credentials) ──► Modern API
    │   └── Basic Auth / Bearer Token ──► Classic API
    │
    ├── Token Management
    │   ├── Automatic token refresh (5 min before expiry)
    │   └── 401 retry with re-authentication
    │
    ├── Resilience
    │   ├── Circuit Breaker (configurable threshold/timeout)
    │   └── Retry with exponential backoff
    │
    └── Connection Management
        └── HTTP Agent Pool (connection reuse)
```

**Why "Hybrid"?**

Jamf Pro has two APIs:
- **Modern API**: Uses OAuth2 JWT tokens, RESTful, newer endpoints
- **Classic API**: Uses Basic Auth or Bearer tokens, XML/JSON, legacy endpoints

Many operations require both APIs. The hybrid client:
1. Authenticates to both APIs with available credentials
2. Automatically selects the correct auth method per endpoint
3. Falls back between auth methods when needed

### 5. Resources System

Resources provide read-only data access for AI context:

```
src/resources/index-compat.ts

Resources:
├── jamf://inventory/computers       # Computer list
├── jamf://inventory/mobile-devices  # Mobile device list
├── jamf://reports/compliance        # Compliance report
├── jamf://reports/storage           # Storage analytics
├── jamf://reports/os-versions       # OS distribution
└── jamf://reports/mobile-device-compliance # Mobile compliance
```

### 6. Prompts System

Pre-defined conversation templates for common workflows:

```
src/prompts/index.ts

Prompts:
├── troubleshoot-device   # Device troubleshooting guide
├── deploy-software       # Software deployment workflow
├── compliance-check      # Compliance verification steps
├── mass-update          # Bulk device update workflow
└── storage-cleanup      # Disk space cleanup guide
```

## HTTP Server Architecture

For ChatGPT and custom integrations, the HTTP server provides:

```
Express Application (src/server/http-server.ts)
    │
    ├── Security Middleware
    │   ├── Helmet (security headers)
    │   ├── Compression
    │   ├── CORS (configurable origins)
    │   └── Request ID tracking
    │
    ├── Authentication
    │   ├── /oauth/authorize
    │   ├── /oauth/callback
    │   └── /oauth/refresh
    │
    ├── Skills API (/api/v1/skills/)
    │   ├── POST /execute     # Execute a skill
    │   └── GET /catalog      # List available skills
    │
    ├── Health Checks
    │   ├── /health           # Basic health
    │   ├── /health/detailed  # Full status
    │   ├── /health/live      # Kubernetes liveness
    │   └── /health/ready     # Kubernetes readiness
    │
    └── MCP SSE Endpoint
        └── Server-Sent Events for MCP protocol
```

## Health Check System

Granular health monitoring for production deployments:

```
Component Health Response:
{
  "status": "healthy" | "degraded" | "unhealthy",
  "components": {
    "jamfApi": {
      "status": "healthy",
      "message": "API responding normally",
      "details": { "responseTime": 145 }
    },
    "auth": {
      "status": "healthy",
      "message": "Token valid for 25 minutes"
    },
    "skills": {
      "status": "healthy",
      "message": "6 skills registered"
    },
    "cache": {
      "status": "healthy",
      "message": "Connection pool active"
    }
  },
  "summary": {
    "total": 4,
    "healthy": 4,
    "degraded": 0,
    "unhealthy": 0
  }
}
```

## Error Handling

Structured error handling throughout:

```
src/utils/error-handler.ts

buildErrorContext(error, action, source, context)
    │
    └── Returns:
        {
          message: "User-friendly error message",
          code: "ERROR_CODE",
          timestamp: "2024-01-12T10:30:00Z",
          suggestions: ["Try X", "Check Y"],
          details: { /* technical context */ }
        }
```

**Error Categories:**
- `JamfAPIError` - Jamf API failures
- `NetworkError` - Connection issues
- `AuthenticationError` - Auth failures
- `ValidationError` - Invalid parameters
- `CircuitBreakerError` - Circuit open

## Configuration

### Environment Variables

**Required:**
```bash
JAMF_URL=https://your-instance.jamfcloud.com
# Plus at least one auth method:
JAMF_CLIENT_ID=xxx      # OAuth2
JAMF_CLIENT_SECRET=xxx
# OR
JAMF_USERNAME=xxx       # Basic Auth
JAMF_PASSWORD=xxx
```

**Optional - Features:**
```bash
JAMF_READ_ONLY=true               # Prevent write operations
JAMF_USE_ENHANCED_MODE=true       # Enable all enhanced features
JAMF_ENABLE_RETRY=true            # Enable retry logic
JAMF_ENABLE_CIRCUIT_BREAKER=true  # Enable circuit breaker
JAMF_DEBUG_MODE=true              # Verbose logging
```

**Optional - Tuning:**
```bash
JAMF_MAX_RETRIES=3
JAMF_RETRY_DELAY=1000
JAMF_RETRY_MAX_DELAY=10000
JAMF_CIRCUIT_BREAKER_THRESHOLD=5
JAMF_CIRCUIT_BREAKER_RESET_TIMEOUT=60000
```

**HTTP Server:**
```bash
PORT=3000
ALLOWED_ORIGINS=https://chat.openai.com
SERVER_URL=https://your-server.com
JAMF_ALLOW_INSECURE=false         # Dev only: skip TLS verification
```

## File Structure

```
src/
├── index.ts              # Standard MCP entry point
├── index-enhanced.ts     # Enhanced mode entry point
├── index-main.ts         # Mode router (bin entry)
├── index-http.ts         # HTTP server entry
├── jamf-client-hybrid.ts # Jamf API client
│
├── tools/                # Tool implementations
├── skills/               # Multi-step workflows
├── resources/            # Read-only data resources
├── prompts/              # Conversation templates
│
├── server/
│   ├── http-server.ts    # Express server
│   ├── health-check.ts   # Health endpoints
│   └── logger.ts         # Winston logger factory
│
├── utils/
│   ├── error-handler.ts  # Structured error handling
│   ├── env-validation.ts # Zod env validation
│   ├── retry.ts          # CircuitBreaker, retry logic
│   ├── http-agent-pool.ts # Connection pooling
│   └── shutdown-manager.ts # Graceful shutdown
│
└── types/
    ├── jamf-api.ts       # Jamf API types
    └── index.ts          # Type re-exports
```

## Extension Points

### Adding a New Tool

1. Add implementation in `src/tools/tool-implementations.ts`
2. Add Zod schema in `src/tools/validation-schemas.ts`
3. Register in `src/tools/index-compat.ts`

### Adding a New Skill

1. Create skill file in `src/skills/<category>/`
2. Export skill definition following `SkillDefinition` interface
3. Register in `src/skills/index.ts`

### Adding a New Resource

1. Add resource handler in `src/resources/index-compat.ts`
2. Define resource URI pattern (`jamf://category/name`)

## Security Considerations

- **Read-Only Mode**: Enable `JAMF_READ_ONLY=true` to prevent any write operations
- **OAuth2 Preferred**: Use client credentials over basic auth when possible
- **TLS Verification**: Never disable in production (`JAMF_ALLOW_INSECURE=false`)
- **CORS Origins**: Explicitly whitelist allowed origins
- **Rate Limiting**: Configure rate limits for HTTP server
- **No Console Output**: MCP servers must not write to stdout (breaks JSON-RPC)
