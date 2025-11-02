/**
 * Optimized Device Search Skill
 * More efficient search that prioritizes likely matches and handles timeouts better
 */

import { SkillContext, SkillResult } from '../types.js';

interface DeviceSearchParams {
  query: string;
  searchType?: 'all' | 'device' | 'user' | 'serial';
  limit?: number;
  includeDetails?: boolean;
  filterBy?: {
    osVersion?: string;
    building?: string;
    department?: string;
    lastSeenDays?: number;
    assignedUser?: string;
  };
  sortBy?: 'name' | 'lastSeen' | 'osVersion' | 'serialNumber' | 'user';
}

/**
 * Extract the actual name from possessive forms
 */
function extractNameFromPossessive(query: string): string {
  const possessivePattern = /['']s?\s*(macbook|computer|device|laptop|mac|iphone|ipad)?$/i;
  return query.replace(possessivePattern, '').trim();
}

/**
 * Prioritized device search
 */
async function searchDevicesByPriority(context: SkillContext, userQuery: string): Promise<any[]> {
  const results = [];
  
  // Priority 1: Search IT devices (most likely for IT staff)
  try {
    const itResult = await context.callTool('searchDevices', {
      query: 'CORP-IT',
      limit: 20
    });
    if (itResult.data?.devices) {
      results.push(...itResult.data.devices);
    }
  } catch (error) {
    context.logger?.warn('Failed to search IT devices', error);
  }
  
  // Priority 2: Search admin devices
  try {
    const admResult = await context.callTool('searchDevices', {
      query: 'CORP-ADM',
      limit: 20
    });
    if (admResult.data?.devices) {
      results.push(...admResult.data.devices);
    }
  } catch (error) {
    context.logger?.warn('Failed to search ADM devices', error);
  }
  
  // Priority 3: General search if we don't have enough results
  if (results.length < 40 && userQuery) {
    try {
      const generalResult = await context.callTool('searchDevices', {
        query: userQuery,
        limit: 20
      });
      if (generalResult.data?.devices) {
        results.push(...generalResult.data.devices);
      }
    } catch (error) {
      context.logger?.warn('Failed general search', error);
    }
  }
  
  return results;
}

export async function deviceSearchOptimized(
  context: SkillContext,
  params: DeviceSearchParams
): Promise<SkillResult> {
  try {
    const { query, searchType = 'all', limit = 50, includeDetails = false, filterBy, sortBy = 'name' } = params;
    
    let devices: any[] = [];
    let totalFound = 0;
    let cleanQuery = query;
    
    // Handle possessive forms
    const hasPossessive = query.match(/['']s?\s/);
    if (hasPossessive) {
      cleanQuery = extractNameFromPossessive(query);
      context.logger?.info(`Detected possessive form, searching for "${cleanQuery}"`);
    }
    
    // User search - use prioritized approach
    if (searchType === 'user' || (searchType === 'all' && hasPossessive)) {
      context.logger?.info(`Searching for devices assigned to "${cleanQuery}"`);
      
      // Get prioritized device list
      const candidateDevices = await searchDevicesByPriority(context, cleanQuery);
      totalFound = candidateDevices.length;
      
      if (candidateDevices.length > 0) {
        context.logger?.info(`Checking ${candidateDevices.length} devices for user assignments`);
        
        // Check devices one by one with timeout handling
        const devicesWithUsers = [];
        for (const device of candidateDevices.slice(0, Math.min(candidateDevices.length, 30))) {
          try {
            const detailsResult = await Promise.race([
              context.callTool('getDeviceDetails', { deviceId: device.id.toString() }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
            ]);
            
            const details = detailsResult.data?.device;
            if (details?.userAndLocation) {
              const username = details.userAndLocation.username || '';
              const realName = details.userAndLocation.realName || details.userAndLocation.realname || '';
              const email = details.userAndLocation.email || '';
              
              // Check if query matches
              const queryLower = cleanQuery.toLowerCase();
              if (username.toLowerCase().includes(queryLower) ||
                  realName.toLowerCase().includes(queryLower) ||
                  email.toLowerCase().includes(queryLower)) {
                device.assignedUser = username;
                device.userRealName = realName;
                device.userEmail = email;
                device.details = details;
                devicesWithUsers.push(device);
                
                // If we found the user's device, we can stop
                if (username.toLowerCase() === queryLower) {
                  context.logger?.info(`Found exact match for user "${cleanQuery}"`);
                  break;
                }
              }
            }
          } catch (error: any) {
            if (error.message !== 'Timeout') {
              context.logger?.warn(`Failed to get details for device ${device.id}`, error);
            }
          }
        }
        
        devices = devicesWithUsers;
      }
    } else {
      // Regular device search
      const searchResult = await context.callTool('searchDevices', {
        query: searchType === 'serial' ? cleanQuery : query,
        limit: limit * 2
      });
      
      devices = searchResult.data?.devices || [];
      totalFound = devices.length;
    }
    
    // Apply filters if specified
    if (filterBy) {
      if (filterBy.osVersion) {
        devices = devices.filter((d: any) => 
          d.osVersion && d.osVersion.startsWith(filterBy.osVersion!)
        );
      }
      
      if (filterBy.lastSeenDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - filterBy.lastSeenDays);
        devices = devices.filter((d: any) => {
          const lastSeen = new Date(d.lastContactTime || d.lastReportDate || 0);
          return lastSeen >= cutoffDate;
        });
      }
    }
    
    // Sort devices
    devices.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'user':
          return (a.assignedUser || '').localeCompare(b.assignedUser || '');
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });
    
    // Limit results
    devices = devices.slice(0, limit);
    
    // Format response
    let response = `## Device Search Results\n\n`;
    response += `**Search Query**: "${query}"`;
    if (cleanQuery !== query) {
      response += ` (interpreted as "${cleanQuery}")`;
    }
    response += `\n`;
    response += `**Found**: ${devices.length} devices`;
    if (totalFound > devices.length) {
      response += ` (from ${totalFound} total)`;
    }
    response += `\n\n`;
    
    if (devices.length === 0) {
      response += `No devices found matching your criteria.\n`;
      if (searchType === 'user' || hasPossessive) {
        response += `\nNote: Searched IT and Admin devices for user assignments containing "${cleanQuery}".\n`;
      }
    } else {
      response += `### Devices\n\n`;
      
      if (searchType === 'user' || hasPossessive) {
        response += `| Device Name | Username | Full Name | Email |\n`;
        response += `|-------------|----------|-----------|-------|\n`;
        
        devices.forEach((device: any) => {
          response += `| ${device.name} | ${device.assignedUser || 'N/A'} | ${device.userRealName || 'N/A'} | ${device.userEmail || 'N/A'} |\n`;
        });
      } else {
        response += `| Device Name | Serial Number | Last Seen |\n`;
        response += `|-------------|---------------|----------|\n`;
        
        devices.forEach((device: any) => {
          const lastSeen = device.lastContactTime || device.lastReportDate;
          const lastSeenDate = lastSeen ? new Date(lastSeen).toLocaleDateString() : 'Never';
          response += `| ${device.name} | ${device.serialNumber || 'N/A'} | ${lastSeenDate} |\n`;
        });
      }
    }
    
    return {
      success: true,
      message: response,
      data: {
        query,
        cleanQuery,
        totalFound,
        devices,
        searchType
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Device search failed: ${error.message}`,
      error
    };
  }
}

// Skill metadata
export const metadata: any = {
  name: 'device-search-optimized',
  description: 'Optimized device search with better performance and timeout handling',
  parameters: {
    query: {
      type: 'string',
      description: 'Search query (device name, serial number, username, etc.)',
      required: true
    },
    searchType: {
      type: 'string',
      description: 'Type of search to perform',
      required: false,
      default: 'all',
      enum: ['all', 'device', 'user', 'serial']
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results to return',
      required: false,
      default: 50
    },
    includeDetails: {
      type: 'boolean',
      description: 'Include detailed device information',
      required: false,
      default: false
    },
    sortBy: {
      type: 'string',
      description: 'Sort results by field',
      required: false,
      default: 'name',
      enum: ['name', 'user']
    }
  }
};