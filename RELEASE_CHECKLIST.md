# GitHub Release Checklist

## Pre-Release Checklist

### ✅ Code Quality
- [x] All tests pass (`npm test`)
- [x] TypeScript builds without errors (`npm run build`)
- [x] No ESLint warnings (`npm run lint`)
- [x] Test coverage meets thresholds (70-80%)

### ✅ Security & Privacy
- [x] No hardcoded credentials
- [x] No company-specific information
- [x] All examples use generic placeholders
- [x] Environment variables for all sensitive config

### ✅ Documentation
- [x] README.md is comprehensive
- [x] LICENSE file exists (MIT)
- [x] CONTRIBUTING.md with guidelines
- [x] CHANGELOG.md with version history
- [x] API documentation is complete
- [x] Setup instructions are clear

### ✅ Project Structure
- [x] .gitignore is comprehensive
- [x] .npmignore excludes unnecessary files
- [x] package.json has all required fields
- [x] GitHub Actions workflow configured
- [x] Issue templates created

### ✅ Code Cleanup
- [x] No console.log in production code
- [x] No commented-out code
- [x] No TODO comments in critical paths
- [x] All test files in proper directories

## Release Steps

1. **Update package.json**
   - Verify GitHub URLs are correct
   - Verify version number (1.0.0)

2. **Verify release readiness**
   ```bash
   npm test
   npm run build
   npm run lint || true
   ```

3. **Initialize Git repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Jamf MCP Server v1.0.0"
   ```

4. **Create GitHub repository**
   - Go to https://github.com/new
   - Name: `jamf-mcp-server`
   - Description: "MCP server for Jamf Pro device management"
   - Public repository
   - Don't initialize with README

5. **Push to GitHub**
   ```bash
   git remote add origin https://github.com/dbanks-gh/jamf-mcp-server.git
   git branch -M main
   git push -u origin main
   ```

6. **Create Release**
   - Go to repository → Releases → Create new release
   - Tag: `v1.0.0`
   - Title: "Jamf MCP Server v1.0.0"
   - Description: Include highlights from CHANGELOG.md
   - Attach any binaries if needed

7. **Post-Release**
   - [ ] Enable GitHub Actions
   - [ ] Add repository topics: `mcp`, `jamf`, `mdm`, `apple`, `typescript`
   - [ ] Update repository description
   - [ ] Consider adding to MCP server registry

## NPM Publishing (Optional)

If you want to publish to NPM:

```bash
npm login
npm publish
```

Remember to update the package name if `jamf-mcp-server` is taken.

## Announcement Template

```markdown
🎉 Introducing Jamf MCP Server v1.0.0

A Model Context Protocol (MCP) server that enables AI assistants to interact with Jamf Pro for Apple device management.

✨ Features:
- 11 tools for device and policy management
- 4 resources for reporting and analytics
- 5 workflow prompts for common tasks
- Dual authentication support
- Read-only safety mode
- TypeScript with full type safety

🔗 GitHub: https://github.com/dbanks-gh/jamf-mcp-server

#MCP #JamfPro #DeviceManagement #OpenSource
```