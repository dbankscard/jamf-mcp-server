/**
 * HTTP Skills Initializer
 * Initializes skills for HTTP endpoint usage
 */

import { SkillsManager } from './manager.js';
import { SkillContext } from './types.js';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';

// Import tool functions directly
import { 
  searchDevices,
  checkDeviceCompliance,
  updateInventory,
  getDeviceDetails,
  executePolicy,
  searchPolicies,
  getPolicyDetails,
  searchConfigurationProfiles
} from '../tools/tool-implementations.js';

export function initializeSkillsForHttp(
  skillsManager: SkillsManager,
  jamfClient: JamfApiClientHybrid
): void {
  // Create a context that can call tool implementations directly
  const context: SkillContext = {
    callTool: async (toolName: string, params: any) => {
      try {
        let result: any;
        
        switch (toolName) {
          case 'searchDevices':
            result = await searchDevices(jamfClient, params);
            break;
          case 'checkDeviceCompliance':
            result = await checkDeviceCompliance(jamfClient, params);
            break;
          case 'updateInventory':
            result = await updateInventory(jamfClient, params);
            break;
          case 'getDeviceDetails':
            result = await getDeviceDetails(jamfClient, params);
            break;
          case 'executePolicy':
            result = await executePolicy(jamfClient, params);
            break;
          case 'searchPolicies':
            result = await searchPolicies(jamfClient, params);
            break;
          case 'getPolicyDetails':
            result = await getPolicyDetails(jamfClient, params);
            break;
          case 'searchConfigurationProfiles':
            result = await searchConfigurationProfiles(jamfClient, params);
            break;
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
        
        return { data: result };
      } catch (error: any) {
        throw new Error(`Tool execution failed: ${error.message}`);
      }
    },
    
    env: {
      jamfUrl: process.env.JAMF_URL || '',
      jamfClientId: process.env.JAMF_CLIENT_ID || '',
    },
    
    logger: {
      info: (message: string, meta?: any) => {
        console.log(`[SKILL INFO] ${message}`, meta || '');
      },
      warn: (message: string, meta?: any) => {
        console.warn(`[SKILL WARN] ${message}`, meta || '');
      },
      error: (message: string, meta?: any) => {
        console.error(`[SKILL ERROR] ${message}`, meta || '');
      }
    }
  };
  
  // Initialize the skills manager with this context
  (skillsManager as any).context = context;
}