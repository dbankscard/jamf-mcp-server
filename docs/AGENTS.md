# Jamf AI Agent

## Overview

The Jamf AI Agent is an intelligent assistant that uses natural language processing to interact with the Jamf MCP server. It can understand complex requests, plan multi-step operations, and execute them autonomously while ensuring safety and compliance.

## Quick Start

```bash
# Set required environment variables
export JAMF_URL="https://your-instance.jamfcloud.com"
export JAMF_CLIENT_ID="your-client-id"
export JAMF_CLIENT_SECRET="your-client-secret"
export OPENAI_API_KEY="your-openai-api-key"

# Run the agent CLI
npm run agent

# Or run the example
npm run agent:example
```

## Architecture

The agent is built with a modular architecture:

- **Core**: Agent orchestration, configuration, context management, and task execution
- **AI Integration**: Support for multiple AI providers (OpenAI, Anthropic, local models)
- **MCP Communication**: Client wrapper for communicating with the Jamf MCP server
- **Task Management**: Planning, validation, and execution of multi-step tasks
- **Safety & Compliance**: Rules engine, audit logging, and confirmation handling
- **Interfaces**: CLI, REST API, and WebSocket for different interaction modes

See `src/agent/README.md` for detailed documentation.

---

# Repository Guidelines

## Project Structure & Modules
- `src/`: TypeScript source. Key entries: `index-main.ts` (CLI/server), `index.ts` (MCP server), `tools/`, `resources/`, `prompts/`, `utils/`.
- `src/agent/`: AI Agent modules for natural language interaction with Jamf MCP server.
- `src/__tests__/`: Jest tests (unit, integration, fixtures, helpers).
- `dist/`: Build output (generated). Binary: `dist/index-main.js` exposed as `jamf-mcp-server`.
- `docs/`: Feature and error-handling docs. `examples/`: sample flows.

## Build, Test, and Development
- `npm run dev`: Start MCP server from TS (`tsx src/index-main.ts`).
- `npm run dev:enhanced`: Dev mode with `JAMF_USE_ENHANCED_MODE=true`.
- `npm run build`: Type-check and compile to `dist/`.
- `npm run serve`: Run compiled server (`node dist/index-main.js`).
- `npm run inspector`: Launch MCP Inspector on `dist/index-main.js`.
- `npm test` / `npm run test:watch` / `npm run test:coverage`: Run Jest tests and coverage.
- `npm run lint` / `npm run lint:fix`: Lint TypeScript sources.

## Coding Style & Naming
- Language: TypeScript (ESM, NodeNext, strict). Keep types explicit; avoid `any`.
- Indentation: 2 spaces; max 120 cols recommended.
- Filenames: kebab-case (`jamf-client-unified.ts`), tests suffixed with `.test.ts`.
- Linting: ESLint with `@typescript-eslint`. Address `no-unused-vars` (prefix unused with `_`), keep `console` to `warn`/`error`.

## Testing Guidelines
- Framework: Jest via `ts-jest` (ESM). Tests live under `src/__tests__/` and end with `.test.ts`.
- Coverage thresholds: branches 70%, functions/lines/statements 80% (see `jest.config.js`).
- Use fixtures/helpers in `src/__tests__/fixtures` and `src/__tests__/helpers`.
- Commands: `npm test` for CI parity, `npm run test:coverage` before PR.

## Commit & Pull Requests
- Branch from `main`; follow GitHub Flow.
- Use Conventional Commit prefixes where possible: `feat:`, `fix:`, `docs:`, `test:`, `chore:` (matches history).
- PRs must: include a clear description, link issues, add/update tests, pass CI, and satisfy linting. Update docs/README when adding tools, env vars, or APIs.

## Security & Configuration
- Never commit secrets. Copy `.env.example` to `.env` for local dev.
- Key env vars: `JAMF_URL`, `JAMF_CLIENT_ID`, `JAMF_CLIENT_SECRET`, `JAMF_READ_ONLY`, `JAMF_USE_ENHANCED_MODE`, `JAMF_DEBUG_MODE`.
- Prefer read-only mode (`JAMF_READ_ONLY=true`) when testing write actions.

