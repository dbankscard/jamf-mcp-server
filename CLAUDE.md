# CLAUDE.md — Project Rules

## PII & Credential Safety (CRITICAL)

This project is **public on GitHub**. Never commit any of the following:

### Banned Content
- **Real hostnames**: No Jamf instance URLs (e.g., `jss.*.io`, `*.jamfcloud.com` with real subdomain). Use `your-instance.jamfcloud.com` in examples.
- **Credentials**: No API client IDs, client secrets, passwords, bearer tokens, or OAuth tokens. Use `your-client-id`, `your-client-secret`, `your-password`.
- **Personal names**: No real employee names. Use generic names like `Jane Smith`, `john.doe`, `CORP-IT-0001`.
- **Device names**: No real device naming conventions (e.g., company-prefix hostnames). Use `CORP-IT-XXXX` or `LAPTOP-001`.
- **Email addresses**: No real company email domains. Use `@example.com`.
- **Company names**: No real company or organization names. Use `ACME Corp` or omit.
- **Local filesystem paths**: No paths containing real usernames (e.g., `/Users/someone/...`). Use `/path/to/jamf-mcp-server`.

### Safe Patterns for Examples
```
URL:      https://your-instance.jamfcloud.com
Client:   your-api-client-id
Secret:   your-api-client-secret
Username: your-username
Password: your-password
Device:   CORP-IT-0300, LAPTOP-001
Person:   Jane Smith, jane.smith@example.com
Company:  ACME Corp
Path:     /path/to/jamf-mcp-server
```

### Before Every Commit
Ask yourself: "Would I be comfortable if this appeared on the front page of Hacker News?" If not, sanitize it.

## Code Conventions

- TypeScript, ESM (`"type": "module"`)
- Target: ES2022, Node.js 18+
- Build: `npm run build:force` (no tests), `npm run build` (with tests)
- Test: `npm test` (skills + jest)
- Lint: `npm run lint`
- Entry points: `dist/index-main.js` (Classic), `dist/index-code.js` (Code Mode)

## Architecture

- Two Jamf APIs: Jamf Pro API (`/api/v1/`, `/api/v2/`) and Classic API (`/JSSResource/`)
- Hybrid client tries Jamf Pro API first, falls back to Classic API
- Auth: OAuth2 Client Credentials → Bearer Token
- Code Mode: `jamf_search` + `jamf_execute` (sandboxed `node:vm`)
- Classic Mode: 108 individual MCP tools

## File Hygiene

- Do not commit session artifacts (`SESSION-CONTEXT.md`, `AGENT-STATUS.md`, etc.)
- Do not commit local config files (`claude_desktop_config.json`, `.env`)
- Keep `.gitignore` up to date
