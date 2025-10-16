# Jamf MCP Server Architecture

## Overview

The Jamf MCP Server is a Model Context Protocol (MCP) server that bridges ChatGPT with Jamf Pro's API, enabling AI-powered Apple device management through natural language interactions.

## Architecture Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│    ChatGPT      │ ◄────► │  OAuth Provider │ ◄────► │     Users       │
│                 │         │  (Auth0/Okta)   │         │                 │
└────────┬────────┘         └─────────────────┘         └─────────────────┘
         │                                                        ▲
         │ HTTPS/SSE                                             │
         │ MCP Protocol                                          │
         ▼                                                       │
┌─────────────────────────────────────────────────────┐         │
│                  MCP HTTP Server                     │         │
│  ┌─────────────────────────────────────────────┐   │         │
│  │             Express.js Server                │   │         │
│  │  ┌────────────┐  ┌──────────────────────┐  │   │         │
│  │  │   Auth     │  │   Rate Limiting      │  │   │         │
│  │  │ Middleware │  │   & Validation       │  │   │         │
│  │  └────────────┘  └──────────────────────┘  │   │         │
│  │  ┌────────────┐  ┌──────────────────────┐  │   │         │
│  │  │   CORS     │  │   Security Headers   │  │   │         │
│  │  │ Protection │  │   (Helmet.js)        │  │   │         │
│  │  └────────────┘  └──────────────────────┘  │   │         │
│  └──────────────────────┬──────────────────────┘   │         │
│                         │                           │         │
│  ┌──────────────────────▼──────────────────────┐   │         │
│  │           MCP Server Instance               │   │         │
│  │  ┌────────────┐  ┌────────────┐  ┌──────┐  │   │         │
│  │  │   Tools    │  │ Resources  │  │Prompts│ │   │         │
│  │  └────────────┘  └────────────┘  └──────┘  │   │         │
│  └──────────────────────┬──────────────────────┘   │         │
│                         │                           │         │
│  ┌──────────────────────▼──────────────────────┐   │         │
│  │         Jamf API Client (Hybrid)            │   │         │
│  │  ┌────────────┐  ┌──────────────────────┐  │   │         │
│  │  │ Modern API │  │    Classic API       │  │   │         │
│  │  │  (OAuth2)  │  │   (Basic Auth)       │  │   │         │
│  │  └────────────┘  └──────────────────────┘  │   │◄────────┘
│  └──────────────────────────────────────────────┘   │  Monitoring
└─────────────────────────┬───────────────────────────┘  & Logging
                         │
                         │ HTTPS
                         ▼
                ┌─────────────────┐
                │                 │
                │   Jamf Pro      │
                │   Instance      │
                │                 │
                └─────────────────┘
```

## Component Architecture

### 1. **HTTP Server Layer** (`src/server/http-server.ts`)
- **Express.js** server handling HTTP/HTTPS requests
- **SSE Transport** for MCP protocol over HTTP
- **Middleware Stack**:
  - Request ID tracking
  - Security headers (Helmet.js)
  - CORS validation
  - Rate limiting
  - Request/response compression
  - Body parsing with size limits
  - Authentication
  - Input validation

### 2. **Authentication Layer**
- **OAuth2 Middleware** (`src/server/auth-middleware.ts`)
  - JWT validation with JWKS
  - Multiple provider support (Auth0, Okta)
  - Token caching and refresh
  - Scope-based authorization
  
- **OAuth Configuration** (`src/server/oauth-config.ts`)
  - Authorization flow handling
  - CSRF protection with state validation
  - Token exchange
  - Refresh token support

### 3. **MCP Protocol Layer**
- **MCP Server** (`@modelcontextprotocol/sdk`)
  - Handles MCP protocol communication
  - Tool registration and execution
  - Resource management
  - Prompt templates

- **Transport Layer**
  - SSE (Server-Sent Events) for ChatGPT
  - Stdio for local CLI usage

### 4. **Business Logic Layer**

#### Tools (`src/tools/`)
Executable functions for device management:
- Device search and management
- Policy execution and management
- Script deployment
- Configuration profile management
- Package management
- Group management
- Mobile device management

#### Resources (`src/resources/`)
Read-only data endpoints:
- Device inventory
- Compliance reports
- Storage analytics
- OS version statistics

#### Prompts (`src/prompts/`)
Workflow templates for common tasks:
- Device troubleshooting
- Software deployment
- Compliance checking
- Bulk operations

### 5. **Jamf API Integration Layer**

#### Hybrid Client (`src/jamf-client-hybrid.ts`)
- Intelligent routing between Classic and Modern APIs
- Automatic failover
- Unified interface

#### Modern API Client (`src/jamf-client.ts`)
- OAuth2 authentication
- Token management
- GraphQL support

#### Classic API Client (`src/jamf-client-classic.ts`)
- Basic authentication
- XML/JSON handling
- Legacy endpoint support

### 6. **Security Architecture**

#### Authentication Flow
```
1. User → ChatGPT → OAuth Provider
2. OAuth Provider validates credentials
3. OAuth Provider → Redirect with code → ChatGPT
4. ChatGPT → Exchange code for token → MCP Server
5. MCP Server validates token with JWKS
6. Authenticated session established
```

#### Security Layers
- **Transport Security**: HTTPS/TLS required
- **Authentication**: OAuth2 with JWT validation
- **Authorization**: Scope and permission checking
- **Input Validation**: Zod schemas for all inputs
- **Rate Limiting**: Per-IP and per-endpoint limits
- **CORS**: Strict origin validation
- **CSP**: Content Security Policy headers
- **Logging**: Security event tracking

### 7. **Data Flow**

```
1. ChatGPT sends natural language request
2. MCP Server authenticates request
3. Request parsed into MCP protocol command
4. Appropriate tool/resource selected
5. Jamf API client executes operation
6. Response formatted and sanitized
7. SSE stream returns data to ChatGPT
8. ChatGPT presents results to user
```

## Deployment Architecture

### Container Architecture
```
┌─────────────────────────────────────┐
│         Docker Container            │
│  ┌────────────────────────────┐    │
│  │    Node.js Application     │    │
│  │  Running as non-root user  │    │
│  └────────────────────────────┘    │
│  ┌────────────────────────────┐    │
│  │     Health Check          │    │
│  │   /health endpoint        │    │
│  └────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Cloud Deployment Options
1. **Heroku**: Simple deployment with buildpacks
2. **AWS ECS/Fargate**: Container orchestration
3. **Google Cloud Run**: Serverless containers
4. **Azure Container Instances**: Managed containers

## Scalability Considerations

### Horizontal Scaling
- Stateless design allows multiple instances
- OAuth state store needs Redis for multi-instance
- Load balancer with session affinity for SSE

### Performance Optimizations
- JWKS client caching
- Connection pooling for Jamf API
- Response compression
- Rate limiting to prevent abuse

## Monitoring & Observability

### Logging Architecture
```
Application → Winston Logger → JSON Output → Log Aggregator
                                                    │
                                                    ▼
                                            Analytics Platform
```

### Metrics
- Request duration
- Error rates
- API usage by endpoint
- Authentication success/failure
- Rate limit hits

## Security Considerations

### Defense in Depth
1. **Network**: HTTPS/TLS only
2. **Application**: Input validation, sanitization
3. **Authentication**: OAuth2 with JWT
4. **Authorization**: Scope-based permissions
5. **Runtime**: Non-root container, minimal attack surface

### Data Protection
- No credential storage in logs
- Sensitive data redaction
- Secure token handling
- Environment variable isolation

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5.8
- **Framework**: Express.js 4.x
- **Protocol**: Model Context Protocol (MCP) 1.0

### Key Dependencies
- **Authentication**: jsonwebtoken, jwks-rsa
- **Security**: helmet, cors, express-rate-limit
- **Validation**: zod
- **Logging**: winston
- **HTTP Client**: axios
- **MCP SDK**: @modelcontextprotocol/sdk

### Development Tools
- **Build**: TypeScript Compiler
- **Test**: Jest
- **Lint**: ESLint
- **Container**: Docker with Alpine Linux

## Future Architecture Considerations

### Potential Enhancements
1. **Caching Layer**: Redis for token/response caching
2. **Message Queue**: For async operations
3. **WebSocket Support**: Real-time updates
4. **Multi-tenancy**: Support for multiple Jamf instances
5. **Plugin Architecture**: Extensible tool system