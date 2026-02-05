import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Prompt,
  PromptMessage,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';

interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

interface PromptTemplate {
  name: string;
  description: string;
  arguments?: PromptArgument[];
  messages: PromptMessage[];
}

const prompts: PromptTemplate[] = [
  {
    name: 'troubleshoot-device',
    description: 'Step-by-step workflow for troubleshooting a device issue',
    arguments: [
      { name: 'deviceName', description: 'Name of the device to troubleshoot', required: true },
    ],
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'I need help troubleshooting a device issue. The device name is: {{deviceName}}',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll help you troubleshoot the device. Let me start by searching for it and gathering information.

First, let me search for the device:
- Using searchDevices tool to find {{deviceName}}

Once I find the device, I'll:
1. Check the last contact time
2. Review the hardware specifications
3. Analyze storage usage
4. Check for any compliance issues
5. Provide recommendations based on findings

Would you like me to proceed with this troubleshooting workflow?`,
        },
      },
    ],
  },
  {
    name: 'deploy-software',
    description: 'Workflow for deploying software to one or more devices',
    arguments: [
      { name: 'softwareName', description: 'Name of the software to deploy', required: true },
      { name: 'targetDevices', description: 'Target devices or group to deploy to', required: true },
    ],
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'I need to deploy {{softwareName}} to {{targetDevices}}',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll help you deploy {{softwareName}} to the specified devices. Here's the process I'll follow:

1. Search for the target devices: {{targetDevices}}
2. Verify the devices are online and managed
3. Locate the appropriate policy or package for {{softwareName}}
4. Execute the deployment with your confirmation
5. Monitor the deployment status

Before proceeding, please ensure:
- The software package exists in Jamf Pro
- You have the policy ID for {{softwareName}}
- The target devices meet the software requirements

Shall I begin by searching for the devices?`,
        },
      },
    ],
  },
  {
    name: 'compliance-check',
    description: 'Run a comprehensive compliance check across the fleet',
    arguments: [
      { name: 'criteria', description: 'Compliance criteria or focus area to check', required: true },
    ],
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'Run a compliance check for {{criteria}}',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll run a comprehensive compliance check based on: {{criteria}}

The compliance check will include:
1. Devices not reporting in the last 30 days
2. Devices with critical storage issues (<10GB free)
3. Devices missing required OS updates
4. Devices without proper MDM approval
5. Overall compliance statistics

I'll use the following resources:
- jamf://reports/compliance - For reporting status
- jamf://reports/storage - For storage analytics
- jamf://reports/os-versions - For OS version compliance

This will provide a complete picture of your fleet's compliance status. Would you like me to generate this report?`,
        },
      },
    ],
  },
  {
    name: 'mass-update',
    description: 'Perform a mass update or configuration change',
    arguments: [
      { name: 'action', description: 'The action to perform on matching devices', required: true },
      { name: 'criteria', description: 'Criteria to match devices against', required: true },
    ],
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'I need to {{action}} on all devices that {{criteria}}',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll help you {{action}} on devices matching: {{criteria}}

Here's my planned approach:
1. Search for all devices matching the criteria
2. Review the list of affected devices
3. Prepare the {{action}} command/policy
4. Request your confirmation before proceeding
5. Execute in batches to avoid overwhelming the system
6. Provide a summary of results

Safety measures:
- I'll show you the exact device count before proceeding
- Confirmation will be required for the actual execution
- We can start with a small test batch if preferred

Ready to begin searching for devices that {{criteria}}?`,
        },
      },
    ],
  },
  {
    name: 'storage-cleanup',
    description: 'Help users free up disk space on their devices',
    arguments: [
      { name: 'deviceIdentifier', description: 'Name or ID of the device to clean up', required: true },
    ],
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'Help me free up disk space on {{deviceIdentifier}}',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll help free up disk space on {{deviceIdentifier}}. Here's my approach:

1. First, I'll analyze the current storage situation:
   - Check total and available storage
   - Identify large files and applications
   - Review system caches and logs

2. Then I can deploy cleanup scripts to:
   - Clear system caches
   - Remove old log files
   - Empty trash
   - Clean up download folders
   - Remove unused language files

3. For more aggressive cleanup, I can:
   - Identify and remove unused applications
   - Clear application caches
   - Remove old iOS backups

Would you like me to start with the storage analysis for {{deviceIdentifier}}?`,
        },
      },
    ],
  },
  {
    name: 'security-audit',
    description: 'Run a full security posture audit across the fleet including encryption, OS currency, compliance, and failed policies',
    arguments: [
      { name: 'scope', description: 'Focus area for the security audit (e.g., encryption, OS updates, compliance)', required: true },
    ],
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'I need a full security audit of the fleet. Focus area: {{scope}}',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll run a comprehensive security posture audit focused on: {{scope}}

Here's the audit plan I'll execute:

1. **Encryption status (FileVault)**
   - Using checkDeviceCompliance to get the overall device compliance picture
   - Using searchDevices to enumerate managed computers
   - Using getDeviceDetails on each device to inspect storage.disks[].partitions[].fileVault2State
   - Flagging any device where FileVault2 is not "Encrypted" or "BootEncrypted"

2. **OS currency analysis**
   - Reading jamf://reports/os-versions to get the full OS version distribution
   - Identifying devices running outdated or unsupported macOS versions
   - Using getSoftwareVersionReport to check specific software currency if relevant to {{scope}}

3. **Compliance and check-in status**
   - Reading jamf://reports/compliance for the overall compliance summary
   - Using getDeviceComplianceSummary for devices with failed policies and missing software
   - Flagging devices that have not checked in within 30 days as potentially unmanaged

4. **Unmanaged device detection**
   - Reading jamf://inventory/computers to review the full inventory
   - Checking userApprovedMdm and management status fields for each device
   - Identifying devices that are enrolled but not properly supervised or MDM-approved

5. **Failed policy detection**
   - Using listPolicies to enumerate all active policies
   - Using getPolicyComplianceReport on critical policies to find failure rates
   - Highlighting policies with high failure counts that relate to {{scope}}

6. **Security summary report**
   - Compiling all findings into a prioritized security report
   - Categorizing issues as Critical, Warning, or Informational
   - Providing remediation recommendations for each finding

Shall I proceed with this security audit?`,
        },
      },
    ],
  },
  {
    name: 'new-device-onboarding',
    description: 'Verify that a newly enrolled device completed onboarding with all required profiles, policies, and group memberships',
    arguments: [
      { name: 'deviceName', description: 'Name of the newly enrolled device to verify', required: true },
    ],
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'I need to verify onboarding for a newly enrolled device: {{deviceName}}',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll verify that {{deviceName}} has completed onboarding successfully. Here's my verification checklist:

1. **Locate the device**
   - Using searchDevices to find {{deviceName}} and get its device ID
   - Using getDeviceDetails to pull full device information including management status, MDM approval, and supervision state

2. **Management status verification**
   - Checking that the device shows as managed and MDM-approved
   - Verifying the management username is set correctly
   - Confirming the device platform and supervised status
   - Checking last contact time to ensure the device is actively communicating

3. **Configuration profile verification**
   - Using listConfigurationProfiles to get all expected computer profiles
   - Using getDeviceDetails to compare installed profiles against expected profiles
   - Identifying any required profiles that are missing from the device

4. **Policy assignment verification**
   - Using listPolicies to enumerate policies that should apply to new enrollments
   - Using searchPolicies with enrollment-related terms to find onboarding policies
   - Using getPolicyDetails on each relevant policy to verify {{deviceName}} is in scope

5. **Group membership verification**
   - Using listComputerGroups to see all available groups
   - Using searchComputerGroups for enrollment or onboarding groups
   - Using getComputerGroupMembers on each relevant group to confirm {{deviceName}} is a member

6. **User assignment verification**
   - Reviewing userAndLocation data from getDeviceDetails
   - Confirming username, real name, email, and position are populated

7. **Onboarding summary**
   - Providing a pass/fail status for each verification step
   - Listing any gaps or missing configurations
   - Recommending remediation actions for any failures (e.g., deploying missing profiles with deployConfigurationProfile, or triggering inventory with updateInventory)

Would you like me to begin the onboarding verification for {{deviceName}}?`,
        },
      },
    ],
  },
  {
    name: 'device-offboarding',
    description: 'Offboard a device by removing group memberships, unscoping profiles, wiping or locking, and retiring from inventory',
    arguments: [
      { name: 'deviceName', description: 'Name of the device to offboard', required: true },
      { name: 'offboardAction', description: 'Offboarding action: wipe, lock, or retire', required: true },
    ],
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'I need to offboard device {{deviceName}}. Requested action: {{offboardAction}}',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll help you offboard {{deviceName}} with action: {{offboardAction}}. This is a multi-step process that involves destructive operations, so I'll confirm before each critical step.

Here's the offboarding workflow:

1. **Locate and document the device**
   - Using searchDevices to find {{deviceName}} and capture the device ID
   - Using getDeviceDetails to document the current state (user, hardware, serial number) for records before any changes

2. **Identify group memberships**
   - Using listComputerGroups with type "static" to find all static groups
   - Using getComputerGroupMembers on each static group to check if {{deviceName}} is a member
   - Building a list of static groups that contain this device

3. **Remove from static groups**
   - For each static group containing {{deviceName}}, using updateStaticComputerGroup to remove the device from the membership list
   - This requires confirmation for each group update

4. **Remove configuration profiles**
   - Using listConfigurationProfiles to identify profiles currently deployed
   - Using removeConfigurationProfile to unscope profiles from {{deviceName}}
   - This requires confirmation for each profile removal

5. **Execute offboard action: {{offboardAction}}**
   - If "wipe": Using sendMDMCommand with command "EraseDevice" on the device (requires confirmation)
   - If "lock": Using sendMDMCommand with command "DeviceLock" on the device
   - If "retire": Documenting the device for manual retirement in Jamf Pro console
   - All destructive MDM commands require explicit confirmation before execution

6. **Final verification**
   - Using getDeviceDetails to confirm the offboarding actions have been processed
   - Providing a summary of all actions taken on {{deviceName}}

Safety measures:
- I will confirm the correct device before any destructive actions
- Each destructive step requires your explicit approval
- A full device record will be captured before any changes are made
- Group removals will be listed for your review before execution

Ready to begin the offboarding process for {{deviceName}}?`,
        },
      },
    ],
  },
  {
    name: 'software-update-review',
    description: 'Review OS version distribution across the fleet and identify devices that need software updates',
    arguments: [
      { name: 'targetOS', description: 'Target OS version to compare against (e.g., 14.2, 15.0)', required: true },
    ],
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'I need to review software update status across the fleet. Target OS version: {{targetOS}}',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll review the software update posture across your fleet against target OS version {{targetOS}}.

Here's my analysis plan:

1. **OS version distribution snapshot**
   - Reading jamf://reports/os-versions to get the complete OS version breakdown
   - Categorizing devices by major OS version and identifying how many are on {{targetOS}} vs older versions

2. **Identify devices needing updates**
   - Using searchDevices to pull the full fleet inventory
   - Using getDevicesBatch to efficiently gather OS version details across devices
   - Filtering for devices running versions older than {{targetOS}}
   - Grouping out-of-date devices by their current version for prioritization

3. **Device readiness assessment**
   - Using getDeviceDetails on out-of-date devices to check:
     - Hardware compatibility (model, Apple Silicon status, processor type)
     - Available storage space (boot drive available MB) to ensure enough room for the update
     - Last contact time to confirm the device is reachable
     - Battery capacity to flag devices with degraded batteries

4. **Inventory and compliance context**
   - Using getInventorySummary for a high-level fleet overview
   - Reading jamf://reports/storage to identify devices that may need storage cleanup before updating
   - Using getDeviceComplianceSummary to check if non-updated devices have other compliance issues

5. **Existing update policies**
   - Using searchPolicies to find any existing OS update or software update policies
   - Using getPolicyDetails on matches to review their scope and configuration
   - Using getPolicyComplianceReport on update policies to check success/failure rates

6. **Update readiness report**
   - Total devices on {{targetOS}} vs devices needing updates
   - Devices blocked by storage constraints
   - Devices blocked by hardware incompatibility
   - Devices unreachable (not checking in)
   - Recommendations for next steps (deploy update policies, clean up storage, retire incompatible hardware)

Would you like me to generate this software update review?`,
        },
      },
    ],
  },
  {
    name: 'fleet-health-dashboard',
    description: 'Generate a comprehensive fleet health dashboard covering device counts, compliance, storage, OS versions, and mobile device status',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'Generate a fleet health dashboard with a full summary of all managed devices.',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll generate a comprehensive fleet health dashboard by pulling data from multiple sources. Here's what I'll gather:

1. **Computer fleet overview**
   - Reading jamf://inventory/computers for total computer count and basic inventory
   - Using getInventorySummary for device model and OS distribution statistics

2. **Compliance status**
   - Reading jamf://reports/compliance for the compliance rate, non-reporting devices, and issue breakdown
   - Using getDeviceComplianceSummary for failed policy counts and missing software data
   - Using checkDeviceCompliance to identify devices not reporting within 30 days

3. **Storage health**
   - Reading jamf://reports/storage for fleet-wide storage analytics
   - Highlighting devices with critical (<10GB) and warning (<20GB) available storage
   - Reporting average storage utilization percentage

4. **OS version distribution**
   - Reading jamf://reports/os-versions for the complete version breakdown by platform
   - Identifying the percentage of fleet on the latest OS vs older versions

5. **Mobile device fleet**
   - Reading jamf://inventory/mobile-devices for total mobile device count and inventory
   - Reading jamf://reports/mobile-device-compliance for mobile compliance status
   - Using listMobileDevices to capture management and supervision rates

6. **Policy health**
   - Using listPolicies to count total active policies
   - Identifying policies with notably high failure rates using getPolicyComplianceReport on key policies

7. **Group summary**
   - Using listComputerGroups to report total smart and static group counts
   - Using listMobileDeviceGroups for mobile device group counts

8. **Dashboard compilation**
   - Computer count and compliance rate
   - Mobile device count and compliance rate
   - Storage health summary (critical/warning/healthy)
   - OS version currency percentages
   - Top compliance issues
   - Devices not reporting
   - Overall fleet health score

Shall I build this dashboard now?`,
        },
      },
    ],
  },
  {
    name: 'investigate-device-issue',
    description: 'Perform a deep investigation of a device issue including profile status, policy details, group membership, and script review',
    arguments: [
      { name: 'deviceName', description: 'Name of the device to investigate', required: true },
      { name: 'issueDescription', description: 'Description of the reported issue', required: true },
    ],
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'I need to deeply investigate an issue with device {{deviceName}}. The reported issue is: {{issueDescription}}',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll conduct a deep investigation of {{deviceName}} related to: {{issueDescription}}

This goes beyond basic troubleshooting to examine all configuration and management aspects of the device.

1. **Device identification and baseline**
   - Using searchDevices to find {{deviceName}} and get the device ID
   - Using getDeviceDetails for complete hardware specs, OS version, storage, user info, and management status
   - Using debugDeviceDates to inspect raw date fields for any timestamp anomalies

2. **Configuration profile analysis**
   - Using listConfigurationProfiles to enumerate all computer profiles
   - Using getDeviceDetails to check which profiles are installed on {{deviceName}}
   - Using getConfigurationProfileDetails on each installed profile to review payload content and scope
   - Identifying any profiles that should be present but are missing, or unexpected profiles that are installed

3. **Policy investigation**
   - Using searchPolicies with terms related to {{issueDescription}} to find relevant policies
   - Using getPolicyDetails (with includeScriptContent: true) on each relevant policy to review:
     - Policy triggers and frequency settings
     - Package configurations attached
     - Script content and parameters
     - Scope to verify {{deviceName}} is included
   - Using getPolicyComplianceReport to check if policies targeting this device are failing

4. **Group membership audit**
   - Using listComputerGroups to enumerate all groups
   - Using getComputerGroupMembers on relevant groups to verify {{deviceName}} membership
   - Using getComputerGroupDetails on smart groups to review criteria that may include or exclude this device
   - Checking if incorrect group membership could explain {{issueDescription}}

5. **Script content review**
   - Using listScripts to find all available scripts
   - Using searchScripts with terms related to {{issueDescription}}
   - Using getScriptDetails on relevant scripts to review their actual content, parameters, and notes
   - Identifying any scripts that may be causing or related to the reported issue

6. **Package and software check**
   - Using searchPackages for software related to {{issueDescription}}
   - Using getPackageDetails to review package requirements and OS compatibility
   - Using getSoftwareVersionReport to check if the device has outdated software

7. **Compliance and reporting status**
   - Using checkDeviceCompliance to see if this device is flagged as non-compliant
   - Using updateInventory to force a fresh inventory collection from {{deviceName}}

8. **Investigation summary**
   - Consolidating all findings relevant to {{issueDescription}}
   - Identifying the most likely root cause(s)
   - Providing step-by-step remediation recommendations
   - Suggesting follow-up monitoring actions

Ready to begin the deep investigation of {{deviceName}}?`,
        },
      },
    ],
  },
  {
    name: 'policy-rollout',
    description: 'Staged rollout of a policy: clone or create, scope to a test group, verify results, then expand to production',
    arguments: [
      { name: 'policyName', description: 'Name of the policy to roll out', required: true },
      { name: 'testGroupName', description: 'Name of the test group to deploy to first', required: true },
    ],
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'I need to do a staged rollout of policy "{{policyName}}" starting with test group "{{testGroupName}}"',
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I'll help you execute a staged rollout of "{{policyName}}" using "{{testGroupName}}" as the initial test scope. Here's the phased approach:

**Phase 1: Preparation**

1. **Locate or create the policy**
   - Using searchPolicies to check if "{{policyName}}" already exists
   - If it exists: Using getPolicyDetails to review its current configuration, triggers, packages, scripts, and scope
   - If it needs cloning from an existing policy: Using clonePolicy with the source policy ID and "{{policyName}}" as the new name
   - If it needs to be created new: Using createPolicy with the desired configuration (requires confirmation)

2. **Verify the test group**
   - Using searchComputerGroups to find "{{testGroupName}}"
   - Using getComputerGroupDetails to review the group type and membership criteria
   - Using getComputerGroupMembers to confirm which devices are in the test group
   - If the test group does not exist: Using createStaticComputerGroup to create it with specified test device IDs (requires confirmation)

**Phase 2: Test deployment**

3. **Scope policy to test group**
   - Using setPolicyEnabled to ensure the policy starts disabled (requires confirmation)
   - Using updatePolicyScope to scope "{{policyName}}" exclusively to "{{testGroupName}}" via addComputerGroups (requires confirmation)
   - Using getPolicyDetails to verify the scope is correctly set

4. **Enable and execute on test group**
   - Using setPolicyEnabled to enable the policy (requires confirmation)
   - Using getComputerGroupMembers to get test device IDs from "{{testGroupName}}"
   - Using executePolicy to trigger the policy on test devices (requires confirmation)

**Phase 3: Verification**

5. **Monitor test results**
   - Using getPolicyComplianceReport to check execution success/failure rates on the test group
   - Using getDevicesBatch on test group members to verify device state after policy execution
   - Using getDeviceDetails on any failed devices to investigate issues
   - Providing a test results summary with pass/fail for each test device

**Phase 4: Production expansion (after your approval)**

6. **Expand scope to production**
   - Using searchComputerGroups or listComputerGroups to identify production target groups
   - Using updatePolicyScope to add production groups via addComputerGroups (requires confirmation)
   - Optionally removing the test group restriction if the policy should apply broadly

7. **Production monitoring**
   - Using getPolicyComplianceReport to monitor the expanded rollout
   - Using getDeviceComplianceSummary to check overall fleet impact
   - Providing ongoing status updates

Safety measures:
- Policy starts disabled and scoped only to the test group
- Each phase requires your explicit approval before proceeding
- Test results are reviewed before any production expansion
- Scope changes are additive, so rollback is straightforward by removing groups

Shall I begin Phase 1 and locate or prepare the policy "{{policyName}}"?`,
        },
      },
    ],
  },
];

export function registerPrompts(server: Server): void {
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: prompts.map(p => ({
        name: p.name,
        description: p.description,
        ...(p.arguments ? { arguments: p.arguments } : {}),
      })),
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    const prompt = prompts.find(p => p.name === name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    // Replace template variables with provided arguments
    const messages = prompt.messages.map(msg => {
      let content = msg.content;
      
      if (content.type === 'text' && args) {
        let text = content.text;
        
        // Replace all template variables
        Object.entries(args).forEach(([key, value]) => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          text = text.replace(regex, String(value));
        });
        
        content = { ...content, text };
      }
      
      return { ...msg, content };
    });

    return {
      description: prompt.description,
      messages,
    };
  });
}