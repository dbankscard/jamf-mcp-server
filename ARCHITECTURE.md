# Jamf MCP Server Architecture

## Overview

The Jamf MCP Server bridges AI assistants (Claude, ChatGPT) with Jamf Pro for Apple device management. It implements the Model Context Protocol (MCP) to provide a standardized interface for AI interactions.

## Architecture Diagram

```
┌─────────────┐     ┌─────────────┐
│   Claude    │     │   ChatGPT   │
│  Desktop    │     │   Custom    │
└──────┬──────┘     └──────┬──────┘
       │                   │
       │ MCP Protocol      │ HTTPS/JSON-RPC
       │                   │
┌──────┴───────────────────┴──────┐
│        MCP Server Layer         │
│  ┌───────────┬──────────────┐  │
│  │   Tools   │  Resources   │  │
│  └───────────┴──────────────┘  │
│  ┌─────────────────────────┐   │
│  │    Request Handlers     │   │
│  └─────────────────────────┘   │
└────────────┬────────────────────┘
             │
      ┌──────┴──────┐
      │ Jamf Client │
      │   Hybrid    │
      └──────┬──────┘
             │
    ┌────────┴────────┐
    │   Jamf Pro API  │
    │ (Modern/Classic)│
    └─────────────────┘
```

## Components

### 1. MCP Server Layer

The main server implementing the MCP protocol:
- **Protocol Handler**: Manages MCP communication
- **Tool Registry**: Executable functions (27 tools)
- **Resource Provider**: Read-only data sources (6 resources)
- **Prompt Templates**: Workflow automation (5 prompts)

### 2. HTTP Server (ChatGPT Support)

Express-based server for ChatGPT integration:
- **JSON-RPC Endpoint**: MCP protocol over HTTP
- **Authentication**: Development mode for POC
- **CORS Support**: Allows ChatGPT domains
- **Rate Limiting**: Protects against abuse

### 3. Jamf Client Hybrid

Intelligent API client that:
- **Dual API Support**: Seamlessly switches between Modern and Classic APIs
- **Automatic Fallback**: Tries Modern API first, falls back to Classic
- **Error Recovery**: Exponential backoff and retry logic
- **Rate Limiting**: Respects Jamf API limits

### 4. Authentication

Multiple authentication modes:
- **OAuth2**: Client credentials flow (production)
- **Basic Auth**: Username/password (legacy support)
- **Development JWT**: Simplified auth for POC
- **No Auth**: ChatGPT POC mode

## Data Flow

### Claude Desktop Flow

1. User asks Claude to perform a Jamf operation
2. Claude calls MCP tool via stdio
3. MCP Server processes the request
4. Jamf Client calls appropriate API
5. Response flows back through MCP protocol

### ChatGPT Flow

1. User asks ChatGPT to query devices
2. ChatGPT sends JSON-RPC request to server
3. Server processes MCP protocol over HTTP
4. Jamf Client executes the query
5. JSON response returned to ChatGPT

## Security

### Authentication Layers
- **MCP Level**: No auth (trusted local process)
- **HTTP Level**: JWT tokens or OAuth2
- **Jamf Level**: OAuth2 client credentials

### Safety Features
- **Confirmation Required**: Destructive operations need explicit confirm
- **Read-Only Mode**: Optional safety switch
- **Audit Logging**: All operations logged
- **Input Validation**: Zod schemas for type safety

## Tool Categories

### Device Management
- Search, view details, update inventory
- Batch operations for efficiency
- Compliance checking

### Policy & Script Management
- List, search, execute policies
- View full script content
- Deploy with confirmations

### Configuration Management
- Profiles for computers and mobile devices
- Deploy and remove operations
- Search by name patterns

### Package Management
- List, search, analyze packages
- Deployment history tracking
- Policy relationship mapping

### Group Management
- Smart and static groups
- Member management
- Creation and deletion

### Mobile Device Management
- Full MDM command suite
- Lost mode operations
- Settings management

## Performance Optimizations

### Batch Operations
- `getDevicesBatch`: Fetch multiple devices in parallel
- Efficient compliance checking for large fleets

### Caching
- Connection pooling for API requests
- Token caching for OAuth2

### Error Handling
- Exponential backoff for retries
- Circuit breaker pattern
- Detailed error messages

## Extension Points

### Adding New Tools

1. Define schema in `/src/tools/index.ts`
2. Implement handler in tool registry
3. Add to ChatGPT endpoints if needed

### Adding Resources

1. Define URI scheme in `/src/resources/index.ts`
2. Implement data fetcher
3. Return structured JSON response

### Adding Prompts

1. Create template in `/src/prompts/index.ts`
2. Define conversation flow
3. Use template variables for customization

## Deployment Options

### Local Development
- Claude Desktop direct integration
- `.env` file configuration
- MCP Inspector for testing

### ChatGPT POC
- HTTP server mode
- Tunnel via Cloudflare/ngrok
- Development authentication

### Production (Future)
- AWS ECS deployment
- Terraform infrastructure
- OAuth2 authentication
- SSL/TLS encryption
- Auto-scaling support

## Monitoring

### Logging
- Structured JSON logs
- Log levels (debug, info, warn, error)
- Request/response logging in debug mode

### Health Checks
- `/health` endpoint for monitoring
- Uptime tracking
- Version information

### Metrics (Future)
- API call counts
- Response times
- Error rates
- Resource usage