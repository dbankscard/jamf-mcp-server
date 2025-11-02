/**
 * Claude Skill: Deploy Policy by Criteria
 * 
 * This skill helps deploy policies to devices based on specific criteria,
 * such as OS version, last check-in time, or device model.
 */

import { SkillContext, SkillResult } from '../types';

interface DeployPolicyByCriteriaParams {
  policyIdentifier: string;
  identifierType: 'id' | 'name';
  criteria: {
    osVersion?: string;
    daysSinceLastContact?: number;
    model?: string;
    building?: string;
    department?: string;
  };
  dryRun?: boolean;
  confirm?: boolean;
}

export async function deployPolicyByCriteria(
  context: SkillContext,
  params: DeployPolicyByCriteriaParams
): Promise<SkillResult> {
  try {
    // First, resolve the policy
    let policyId: string;
    
    if (params.identifierType === 'id') {
      policyId = params.policyIdentifier;
    } else {
      // Search for policy by name
      const searchResult = await context.callTool('searchPolicies', {
        query: params.policyIdentifier,
        limit: 5
      });
      
      const policies = searchResult.data?.policies || [];
      const exactMatch = policies.find((p: any) => 
        p.name.toLowerCase() === params.policyIdentifier.toLowerCase()
      );
      
      if (!exactMatch) {
        return {
          success: false,
          message: `Policy "${params.policyIdentifier}" not found`,
          data: { foundPolicies: policies.map((p: any) => p.name) }
        };
      }
      
      policyId = exactMatch.id.toString();
    }

    // Get policy details
    const policyDetails = await context.callTool('getPolicyDetails', {
      policyId,
      includeScriptContent: false
    });

    const policy = policyDetails.data?.policy;
    if (!policy) {
      return {
        success: false,
        message: `Failed to get details for policy ${policyId}`
      };
    }

    // Find devices matching criteria
    const matchingDevices = [];
    const searchQueries = [];

    // Build search queries based on criteria
    if (params.criteria.osVersion) {
      searchQueries.push(params.criteria.osVersion);
    }
    if (params.criteria.model) {
      searchQueries.push(params.criteria.model);
    }
    if (params.criteria.building) {
      searchQueries.push(params.criteria.building);
    }
    if (params.criteria.department) {
      searchQueries.push(params.criteria.department);
    }

    // Search for devices
    for (const query of searchQueries) {
      const searchResult = await context.callTool('searchDevices', {
        query,
        limit: 100
      });
      
      const devices = searchResult.data?.devices || [];
      matchingDevices.push(...devices);
    }

    // Remove duplicates
    const uniqueDevices = Array.from(
      new Map(matchingDevices.map(d => [d.id, d])).values()
    );

    // Filter by additional criteria if needed
    let filteredDevices = uniqueDevices;

    if (params.criteria.daysSinceLastContact) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - params.criteria.daysSinceLastContact);
      
      filteredDevices = filteredDevices.filter(device => {
        const lastContact = new Date(device.lastContactTime || device.last_contact_time);
        return lastContact >= cutoffDate;
      });
    }

    // Prepare deployment
    const deviceIds = filteredDevices.map(d => d.id.toString());
    
    let response = `## Policy Deployment Plan\n\n`;
    response += `**Policy**: ${policy.name} (ID: ${policyId})\n`;
    response += `**Matching Devices**: ${deviceIds.length}\n\n`;

    if (deviceIds.length === 0) {
      return {
        success: false,
        message: response + 'No devices found matching the specified criteria.',
        data: { matchingDevices: 0 }
      };
    }

    response += `### Criteria Used\n`;
    Object.entries(params.criteria).forEach(([key, value]) => {
      response += `- ${key}: ${value}\n`;
    });
    response += `\n`;

    if (params.dryRun) {
      response += `### Dry Run Results\n`;
      response += `Would deploy to ${deviceIds.length} devices:\n\n`;
      response += `| Device Name | Model | OS Version | Last Check-in |\n`;
      response += `|-------------|-------|------------|---------------|\n`;
      
      filteredDevices.slice(0, 10).forEach(device => {
        response += `| ${device.name} | ${device.model || 'N/A'} | ${device.osVersion || 'N/A'} | ${device.lastContactTime ? new Date(device.lastContactTime).toLocaleDateString() : 'N/A'} |\n`;
      });
      
      if (filteredDevices.length > 10) {
        response += `\n... and ${filteredDevices.length - 10} more devices.\n`;
      }

      return {
        success: true,
        message: response,
        data: {
          policyId,
          policyName: policy.name,
          matchingDevices: deviceIds.length,
          devices: filteredDevices
        }
      };
    }

    // Execute deployment if confirmed
    if (!params.confirm) {
      response += `\n⚠️ **Confirmation Required**\n\n`;
      response += `To deploy this policy, set \`confirm: true\` in the parameters.\n`;
      
      return {
        success: false,
        message: response,
        data: {
          requiresConfirmation: true,
          deviceIds
        }
      };
    }

    // Execute the policy
    const executionResult = await context.callTool('executePolicy', {
      policyId,
      deviceIds,
      confirm: true
    });

    if (executionResult.success) {
      response += `\n✅ **Policy Deployed Successfully**\n\n`;
      response += `The policy has been queued for execution on ${deviceIds.length} devices.\n`;
    } else {
      response += `\n❌ **Deployment Failed**\n\n`;
      response += `Error: ${executionResult.error?.message || 'Unknown error'}\n`;
    }

    return {
      success: executionResult.success,
      message: response,
      data: {
        policyId,
        policyName: policy.name,
        deployedTo: deviceIds.length,
        executionResult: executionResult.data
      }
    };

  } catch (error) {
    return {
      success: false,
      message: `Failed to deploy policy: ${error.message}`,
      error
    };
  }
}

// Skill metadata
export const metadata = {
  name: 'deploy-policy-by-criteria',
  description: 'Deploy policies to devices based on specific criteria',
  parameters: {
    policyIdentifier: {
      type: 'string',
      description: 'Policy ID or name',
      required: true
    },
    identifierType: {
      type: 'string',
      description: 'Type of identifier: "id" or "name"',
      required: true,
      enum: ['id', 'name']
    },
    criteria: {
      type: 'object',
      description: 'Criteria for selecting devices',
      required: true
    },
    dryRun: {
      type: 'boolean',
      description: 'Preview deployment without executing',
      required: false,
      default: true
    },
    confirm: {
      type: 'boolean',
      description: 'Confirm execution (required for actual deployment)',
      required: false,
      default: false
    }
  },
  examples: [
    {
      description: 'Find devices running macOS 13 for policy deployment',
      params: {
        policyIdentifier: 'Update Security Settings',
        identifierType: 'name',
        criteria: { osVersion: '13' },
        dryRun: true
      }
    },
    {
      description: 'Deploy policy to recently active devices in Engineering',
      params: {
        policyIdentifier: '123',
        identifierType: 'id',
        criteria: { 
          department: 'Engineering',
          daysSinceLastContact: 7
        },
        dryRun: false,
        confirm: true
      }
    }
  ],
  tags: ['policy', 'deployment', 'automation']
};