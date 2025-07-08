# Built a Jamf Pro MCP Server - AI Assistant for Mac Fleet Management

Hey r/macsysadmin! 

I've been working on something that might interest those of you managing Mac fleets with Jamf Pro. I built an MCP (Model Context Protocol) server that lets you interact with Jamf using natural language through AI assistants like Claude.

Originally created this to help our new support tech get up to speed with Jamf without needing to learn all the API endpoints or navigate through multiple console screens. Turned out to be useful enough that I figured others might benefit too.

## What it does

Instead of clicking through the Jamf console or writing API scripts, you can just ask questions like:
- "Which devices haven't checked in for 30 days?"
- "Show me all devices assigned to john.doe"
- "Get details for devices that need OS updates"
- "Execute the software update policy on these 5 devices"

## Key Features

**Device Management:**
- Search devices by any criteria (name, user, serial, IP)
- Get detailed hardware/software info
- Check compliance (which devices haven't reported recently)
- Batch operations for multiple devices
- Force inventory updates

**Policy Management:**
- List and search policies
- View policy details including scope and packages
- Execute policies with safety confirmations
- Deploy scripts to specific devices

**What makes it useful:**
- Natural language queries instead of clicking through menus
- Bulk operations that would take forever in the GUI
- Quick compliance checks with categorized results (warning/critical)
- Combines multiple API calls into simple commands
- Safety confirmations before executing changes

## Example Usage

```
You: "Check which devices haven't reported in 14 days"

AI: Found 47 devices that haven't reported in 14+ days:
- Compliant: 453 devices (90.6%)
- Warning (14-90 days): 35 devices
- Critical (90+ days): 12 devices
- Unknown: 0 devices

Critical devices requiring immediate attention:
1. MacBook-Pro-Marketing (Serial: ABC123) - Last seen: 95 days ago
2. iMac-Finance-01 (Serial: DEF456) - Last seen: 127 days ago
[...]
```

## Technical Details

- Built using MCP (Model Context Protocol) - Anthropic's open standard
- Supports Jamf Pro's Classic and Modern APIs
- OAuth2 authentication with client credentials flow
- Efficient batch processing to minimize API calls
- Date parsing handles multiple Jamf timestamp formats
- TypeScript with full type safety

## Setup

Requires:
- Jamf Pro instance with API access
- OAuth2 client credentials (client ID & secret)
- Node.js 18+
- Compatible AI assistant (Claude Desktop, CLI, or other MCP clients)

## Questions/Feedback

This is still in active development. Main questions for the community:

1. What other Jamf operations would be most useful via natural language?
2. Any interest in mobile device management features?
3. Would integration with other Mac admin tools (Munki, etc.) be valuable?
4. What compliance/reporting features would help your workflows?

The code is open source and available here: https://github.com/dbankscard/jamf-mcp-server

Been using it for a few weeks now and it's made routine Jamf tasks much faster.

What do you all think? Worth continuing development?