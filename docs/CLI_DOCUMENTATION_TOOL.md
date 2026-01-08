# Jamf Environment Documentation CLI Tool

A standalone command-line tool for generating comprehensive, AI-powered documentation of your Jamf Pro environment.

## Features

✨ **AI-Powered Analysis**: Uses Claude AI to provide intelligent insights, security analysis, and recommendations

📊 **Comprehensive Coverage**: Documents all Jamf Pro components:
- Computers and Mobile Devices
- Policies and Configuration Profiles
- Scripts and Packages
- Computer and Mobile Device Groups

🔄 **Efficient Pagination**: Handles large environments with configurable page sizes

📝 **Multiple Formats**: Generates both JSON (machine-readable) and Markdown (human-readable) documentation

🎯 **Flexible Configuration**: Customizable output, components, and detail levels

## Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Configure environment variables** in `.env`:
   ```bash
   # Required
   JAMF_URL=https://your-instance.jamfcloud.com
   JAMF_CLIENT_ID=your-api-client-id
   JAMF_CLIENT_SECRET=your-api-client-secret

   # Optional (for AI analysis)
   ANTHROPIC_API_KEY=your-claude-api-key
   ```

## Usage

### Basic Usage

Generate full documentation with default settings:

```bash
npm run document:env
```

### With AI Analysis

Enable AI-powered insights and recommendations:

```bash
npm run document:env -- --ai-analysis
```

### Custom Output Directory

Specify where to save documentation:

```bash
npm run document:env -- --output ./my-jamf-docs
```

### Document Specific Components

Only document certain components:

```bash
npm run document:env -- --components policies,scripts,configuration-profiles
```

### Markdown Only

Generate only markdown documentation:

```bash
npm run document:env -- --formats markdown
```

### Complete Example

```bash
npm run document:env -- \
  --output ./jamf-docs \
  --components computers,policies,scripts \
  --detail-level full \
  --ai-analysis \
  --page-size 200
```

## Command-Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output <path>` | Output directory | `./jamf-documentation` |
| `--components <list>` | Comma-separated components to document | All components |
| `--detail-level <level>` | Detail level: `summary`, `standard`, `full` | `full` |
| `--formats <list>` | Output formats: `markdown`, `json` | Both |
| `--ai-analysis` | Enable AI-powered analysis | Disabled |
| `--page-size <number>` | Pagination size for large datasets | `100` |
| `--help` | Show help message | - |

## Available Components

- `computers` - Mac computers in inventory
- `mobile-devices` - iOS/iPadOS devices
- `policies` - Jamf policies with scope and configuration
- `configuration-profiles` - Computer and mobile device profiles
- `scripts` - Shell scripts with full content
- `packages` - Software packages
- `computer-groups` - Computer smart and static groups
- `mobile-device-groups` - Mobile device groups

## Output Structure

```
jamf-documentation/
├── README.md                           # Overview with statistics
├── data/                               # JSON data files
│   ├── complete-environment.json       # Full environment data
│   ├── computers.json
│   ├── mobile-devices.json
│   ├── policies.json
│   ├── configuration-profiles.json
│   ├── scripts.json
│   ├── packages.json
│   ├── computer-groups.json
│   └── mobile-device-groups.json
└── markdown/                           # Human-readable documentation
    ├── computers.md
    ├── mobile-devices.md
    ├── policies.md
    ├── configuration-profiles.md
    ├── scripts.md
    ├── packages.md
    ├── computer-groups.md
    └── mobile-device-groups.md
```

## AI Analysis Features

When `--ai-analysis` is enabled, the tool generates:

### Environment Analysis
- Executive summary of your Jamf infrastructure
- Key insights about device management
- Infrastructure strengths and areas for improvement

### Component Analysis
- Per-component insights and patterns
- Configuration recommendations
- Naming convention analysis

### Security Analysis
- Security posture assessment
- Identified risks and vulnerabilities
- Security best practices evaluation

### Strategic Recommendations
- Prioritized action items
- Efficiency improvement suggestions
- Cost optimization opportunities

## Examples

### 1. Quick Documentation (No AI)

Perfect for quick snapshots:

```bash
npm run document:env -- --detail-level summary
```

### 2. Full Documentation with AI Insights

Comprehensive analysis with AI recommendations:

```bash
npm run document:env -- --ai-analysis --detail-level full
```

### 3. Policy Audit

Focus on policies and scripts:

```bash
npm run document:env -- \
  --components policies,scripts \
  --ai-analysis \
  --output ./policy-audit
```

### 4. Device Inventory

Document only device information:

```bash
npm run document:env -- \
  --components computers,mobile-devices,computer-groups,mobile-device-groups \
  --formats json \
  --output ./device-inventory
```

### 5. Security Audit

Comprehensive security-focused documentation:

```bash
npm run document:env -- \
  --components policies,configuration-profiles,scripts \
  --ai-analysis \
  --output ./security-audit
```

## Performance Tips

1. **Use pagination** for large environments:
   ```bash
   npm run document:env -- --page-size 50
   ```

2. **Limit components** for faster generation:
   ```bash
   npm run document:env -- --components computers,policies
   ```

3. **Disable AI** for quick snapshots:
   ```bash
   npm run document:env -- --detail-level summary
   ```

## Troubleshooting

### "Missing required environment variables"

Ensure your `.env` file contains:
```
JAMF_URL=...
JAMF_CLIENT_ID=...
JAMF_CLIENT_SECRET=...
```

### "AI analysis requested but ANTHROPIC_API_KEY not set"

Add your Claude API key to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Get an API key from: https://console.anthropic.com/

### Large environments timing out

Reduce the page size:
```bash
npm run document:env -- --page-size 25
```

## Best Practices

1. **Schedule regular documentation**:
   - Weekly snapshots for change tracking
   - Monthly comprehensive analysis with AI

2. **Version control your documentation**:
   - Commit documentation to git
   - Track changes over time

3. **Use AI analysis strategically**:
   - Enable for monthly audits
   - Disable for quick daily snapshots

4. **Separate concerns**:
   - Device inventory: `computers,mobile-devices,*-groups`
   - Configuration: `policies,configuration-profiles,scripts,packages`
   - Security: All components with `--ai-analysis`

## Integration Examples

### Automated Daily Snapshots

```bash
#!/bin/bash
# daily-doc.sh
npm run document:env -- \
  --output "./docs/snapshots/$(date +%Y-%m-%d)" \
  --detail-level summary
```

### Weekly AI Analysis

```bash
#!/bin/bash
# weekly-analysis.sh
npm run document:env -- \
  --output "./docs/weekly/week-$(date +%U)" \
  --ai-analysis \
  --detail-level full
```

### CI/CD Integration

```yaml
# .github/workflows/document.yml
name: Document Jamf Environment
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  document:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
      - run: npm run document:env -- --ai-analysis
        env:
          JAMF_URL: ${{ secrets.JAMF_URL }}
          JAMF_CLIENT_ID: ${{ secrets.JAMF_CLIENT_ID }}
          JAMF_CLIENT_SECRET: ${{ secrets.JAMF_CLIENT_SECRET }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - uses: actions/upload-artifact@v2
        with:
          name: jamf-documentation
          path: jamf-documentation/
```

## Support

For issues or questions:
- [GitHub Issues](https://github.com/dbankscard/jamf-mcp-server/issues)
- [Documentation](../README.md)
