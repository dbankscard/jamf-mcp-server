# Jamf MCP Server - Policy Management Examples

## Policy Tools Usage Examples

### List All Policies
```
List all policies
Show me all policies in Jamf
What policies do we have?
```

### List Policies by Category
```
Show me all security policies
List maintenance policies
What software deployment policies do we have?
Show me all policies in the "Updates" category
```

### Get Policy Details
```
Show details for policy ID 123
Get information about policy 456
What does the "macOS Update" policy do?
Show me the scope and scripts for policy 789
```

### Search Policies
```
Search for policies containing "update"
Find all policies with "security" in the name
Look for policy ID 123
Search for Adobe-related policies
```

## Example Conversations

### Example 1: Understanding Policy Configuration
**User**: "Show me details about our software update policy"

**Assistant**: I'll search for policies related to software updates.

*Uses searchPolicies tool with query "software update"*

Found 3 policies related to software updates:
1. Policy ID 123: "macOS Software Update" (Category: Maintenance)
2. Policy ID 456: "Microsoft Office Updates" (Category: Software)
3. Policy ID 789: "Security Update Deployment" (Category: Security)

**User**: "Show me the details for the macOS Software Update policy"

**Assistant**: I'll get the detailed information for policy ID 123.

*Uses getPolicyDetails tool with policyId "123"*

Here are the details for the "macOS Software Update" policy:

**General Information:**
- ID: 123
- Name: macOS Software Update
- Enabled: Yes
- Category: Maintenance
- Frequency: Once per computer
- Trigger: Check-in (runs during device check-in)

**Scope:**
- Targeted to: IT Department computer group
- Includes: 45 computers
- Exclusions: None

**Scripts:**
- Pre-install script: "Check Disk Space" (ensures 10GB free space)
- Parameters: --required-space 10GB --verbose

**Packages:**
- macOS Ventura 13.6.3 Update
- Action: Cache and Install

**User Interaction:**
- Start message: "Your Mac will be updated to the latest version of macOS. Please save your work."
- Completion message: "Update complete! Your Mac is now running the latest version."
- Allow deferral: Yes (until Dec 31, 2024)

**Reboot Settings:**
- User logged in: Restart if required by package
- No user logged in: Restart immediately
- Restart message: "Your computer will restart in 5 minutes to complete the update."

### Example 2: Finding and Analyzing Security Policies
**User**: "What security policies do we have?"

**Assistant**: I'll list all policies in the Security category.

*Uses listPolicies tool with category "Security"*

Found 8 security policies:

1. **Firewall Configuration** (ID: 201)
   - Enables macOS firewall with stealth mode

2. **FileVault Encryption** (ID: 202)
   - Enforces disk encryption on all devices

3. **Security Agent Installation** (ID: 203)
   - Deploys CrowdStrike Falcon

4. **Gatekeeper Settings** (ID: 204)
   - Configures app notarization requirements

5. **Password Policy Enforcement** (ID: 205)
   - Sets password complexity requirements

6. **Security Update Deployment** (ID: 206)
   - Installs critical security patches

7. **Malware Remediation** (ID: 207)
   - Removes known malware

8. **Certificate Installation** (ID: 208)
   - Deploys corporate certificates

Would you like details about any specific security policy?

### Example 3: Policy Compliance Check
**User**: "Which policies are currently enabled and which are disabled?"

**Assistant**: I'll list all policies and check their status.

*Uses listPolicies tool*

Here's a summary of all policies by status:

**Enabled Policies (42 total):**
- Software Deployment: 15 policies
- Security: 8 policies
- Maintenance: 10 policies
- Configuration: 9 policies

**Disabled Policies (7 total):**
1. "Legacy Java Installation" - Software category
2. "Old VPN Configuration" - Network category
3. "Flash Player Removal" - Security category (completed)
4. "macOS Big Sur Upgrade" - OS category (completed)
5. "Temporary Remote Access" - Support category
6. "Holiday Wallpaper 2023" - Configuration category
7. "Beta Testing Profile" - Testing category

**Key Observations:**
- Most disabled policies appear to be legacy or completed one-time deployments
- All current security policies are enabled
- Consider removing completed policies to reduce clutter

## Advanced Queries

### Finding Policies by Scope
```
Which policies apply to the Marketing department?
Show me policies that run on all computers
What policies target the Executive team?
```

### Analyzing Policy Triggers
```
Which policies run at check-in?
Show me policies triggered by enrollment
What policies run at user login?
List policies with custom triggers
```

### Policy Package Analysis
```
Which policies install Microsoft Office?
Show me all policies that deploy security software
What policies include script execution?
List policies with reboot requirements
```

## Tips for Policy Management

1. **Regular Review**: Use `listPolicies` periodically to review all policies
2. **Category Organization**: Filter by category to focus on specific types
3. **Detailed Analysis**: Use `getPolicyDetails` to understand complex policies
4. **Search Efficiency**: Use `searchPolicies` to quickly find specific policies
5. **Scope Verification**: Always check the scope section to understand impact

## Integration with Other Tools

Policies can be used with other Jamf MCP tools:

1. **Check Device Compliance**: See which devices have run specific policies
2. **Execute Policy**: Run policies on specific devices (requires confirmation)
3. **Search Devices**: Find devices in policy scopes
4. **Get Device Details**: See policy history on individual devices