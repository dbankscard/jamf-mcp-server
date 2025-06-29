import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Prompt,
  PromptMessage,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';

interface PromptTemplate {
  name: string;
  description: string;
  messages: PromptMessage[];
}

const prompts: PromptTemplate[] = [
  {
    name: 'troubleshoot-device',
    description: 'Step-by-step workflow for troubleshooting a device issue',
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
];

export function registerPrompts(server: Server): void {
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: prompts.map(p => ({
        name: p.name,
        description: p.description,
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
      prompt: {
        name: prompt.name,
        description: prompt.description,
        messages,
      },
    };
  });
}