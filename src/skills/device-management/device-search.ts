/**
 * Claude Skill: Device Search
 * 
 * This skill provides enhanced device search with filtering, sorting,
 * and formatted output for easy reading.
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

interface DeviceWithUser {
  id: string;
  name: string;
  serialNumber?: string;
  osVersion?: string;
  lastContactTime?: string;
  lastReportDate?: string;
  ipAddress?: string;
  assignedUser?: string;
  userRealName?: string;
  userEmail?: string;
  details?: any;
}

/**
 * Extract the actual name from possessive forms
 * e.g., "Jane's" -> "Jane", "James'" -> "James"
 */
function extractNameFromPossessive(query: string): string {
  // Remove possessive endings
  const possessivePattern = /['']s?\s*(macbook|computer|device|laptop|mac|iphone|ipad)?$/i;
  const cleanedQuery = query.replace(possessivePattern, '').trim();
  return cleanedQuery;
}

/**
 * Check if a string matches a query (case-insensitive)
 */
function matchesQuery(value: string | undefined, query: string): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(query.toLowerCase());
}

/**
 * Fetch device details in parallel batches to optimize performance
 */
async function fetchDeviceDetailsInBatches(
  context: SkillContext,
  devices: any[],
  batchSize: number = 10
): Promise<Map<string, any>> {
  const detailsMap = new Map<string, any>();
  
  // Process devices in batches
  for (let i = 0; i < devices.length; i += batchSize) {
    const batch = devices.slice(i, i + batchSize);
    const batchPromises = batch.map(async (device) => {
      try {
        const result = await context.callTool('getDeviceDetails', {
          deviceId: device.id.toString()
        });
        return { id: device.id, details: result.data?.device };
      } catch (error) {
        context.logger?.warn(`Failed to get details for device ${device.id}`, error);
        return { id: device.id, details: null };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(({ id, details }) => {
      if (details) {
        detailsMap.set(id, details);
      }
    });
  }
  
  return detailsMap;
}

export async function deviceSearch(
  context: SkillContext,
  params: DeviceSearchParams
): Promise<SkillResult> {
  try {
    const { query, searchType = 'all', limit = 50, includeDetails = false, filterBy, sortBy = 'name' } = params;
    
    // Extract clean name from possessive forms
    const cleanQuery = extractNameFromPossessive(query);
    const queryLower = cleanQuery.toLowerCase();
    
    let devices: DeviceWithUser[] = [];
    let totalFound = 0;
    
    // For user search, we need to get ALL devices and check their user assignments
    if (searchType === 'user') {
      // Get all devices (or a large number) to search through
      const searchResult = await context.callTool('searchDevices', {
        query: '', // Empty query to get all devices
        limit: 500 // Get more devices for comprehensive user search
      });
      
      const allDevices = searchResult.data?.devices || [];
      totalFound = allDevices.length;
      
      if (allDevices.length > 0) {
        context.logger?.info(`Searching through ${allDevices.length} devices for user "${cleanQuery}"`);
        
        // Fetch device details in parallel batches
        const detailsMap = await fetchDeviceDetailsInBatches(context, allDevices, 20);
        
        // Filter devices by user information
        for (const device of allDevices) {
          const details = detailsMap.get(device.id);
          if (details?.userAndLocation) {
            const userInfo = details.userAndLocation;
            const username = userInfo.username || '';
            const realName = userInfo.realName || '';
            const email = userInfo.email || '';
            
            // Check if any user field matches the query
            if (matchesQuery(username, queryLower) ||
                matchesQuery(realName, queryLower) ||
                matchesQuery(email, queryLower)) {
              devices.push({
                ...device,
                assignedUser: username,
                userRealName: realName,
                userEmail: email,
                details
              });
            }
          }
        }
        
        context.logger?.info(`Found ${devices.length} devices assigned to users matching "${cleanQuery}"`);
      }
    } else {
      // For non-user searches, use the query directly
      const searchQuery = searchType === 'serial' ? cleanQuery : query;
      
      const searchResult = await context.callTool('searchDevices', {
        query: searchQuery,
        limit: limit * 2 // Get extra to account for filtering
      });
      
      devices = searchResult.data?.devices || [];
      totalFound = devices.length;
      
      // For 'all' search type with possessive queries, also check user assignments
      if (searchType === 'all' && query.match(/['']s?\s/)) {
        context.logger?.info(`Detected possessive form in query, also checking user assignments`);
        
        // Get additional devices and check their user assignments
        const additionalResult = await context.callTool('searchDevices', {
          query: '',
          limit: 200
        });
        
        const additionalDevices = additionalResult.data?.devices || [];
        const detailsMap = await fetchDeviceDetailsInBatches(context, additionalDevices, 20);
        
        // Find devices assigned to the user
        const userDevices: DeviceWithUser[] = [];
        for (const device of additionalDevices) {
          const details = detailsMap.get(device.id);
          if (details?.userAndLocation) {
            const userInfo = details.userAndLocation;
            const username = userInfo.username || '';
            const realName = userInfo.realName || '';
            
            if (matchesQuery(username, queryLower) || matchesQuery(realName, queryLower)) {
              // Check if we already have this device
              if (!devices.find(d => d.id === device.id)) {
                userDevices.push({
                  ...device,
                  assignedUser: username,
                  userRealName: realName,
                  userEmail: userInfo.email || '',
                  details
                });
              }
            }
          }
        }
        
        // Merge user devices with search results
        devices = [...devices, ...userDevices];
        totalFound = devices.length;
      }
    }
    
    // Apply additional filters if specified
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
      
      if (filterBy.assignedUser) {
        devices = devices.filter((d: any) => 
          matchesQuery(d.assignedUser, filterBy.assignedUser!) ||
          matchesQuery(d.userRealName, filterBy.assignedUser!)
        );
      }
    }
    
    // Sort devices
    devices.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'lastSeen': {
          const dateA = new Date(a.lastContactTime || a.lastReportDate || 0);
          const dateB = new Date(b.lastContactTime || b.lastReportDate || 0);
          return dateB.getTime() - dateA.getTime();
        }
        case 'osVersion':
          return (b.osVersion || '').localeCompare(a.osVersion || '');
        case 'serialNumber':
          return (a.serialNumber || '').localeCompare(b.serialNumber || '');
        case 'user':
          return (a.assignedUser || a.userRealName || '').localeCompare(b.assignedUser || b.userRealName || '');
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });
    
    // Limit results
    devices = devices.slice(0, limit);
    
    // Get additional details for devices if requested and not already fetched
    if (includeDetails && devices.length > 0 && devices.length <= 10) {
      const devicesNeedingDetails = devices.filter(d => !d.details);
      if (devicesNeedingDetails.length > 0) {
        const detailsMap = await fetchDeviceDetailsInBatches(context, devicesNeedingDetails, 10);
        devicesNeedingDetails.forEach(device => {
          const details = detailsMap.get(device.id);
          if (details) {
            device.details = details;
            // Update user information if available
            if (details.userAndLocation) {
              device.assignedUser = device.assignedUser || details.userAndLocation.username;
              device.userRealName = device.userRealName || details.userAndLocation.realName;
              device.userEmail = device.userEmail || details.userAndLocation.email;
            }
          }
        });
      }
    }
    
    // Format the response
    let response = `## Device Search Results\n\n`;
    response += `**Search Query**: "${query}"`;
    if (searchType !== 'all') {
      response += ` (${searchType} search)`;
    }
    if (query !== cleanQuery) {
      response += `\n**Interpreted as**: "${cleanQuery}"`;
    }
    response += `\n`;
    response += `**Found**: ${totalFound} devices`;
    
    if (filterBy || searchType === 'user' || devices.length !== totalFound) {
      response += ` (${devices.length} after filtering)`;
    }
    response += `\n\n`;
    
    if (devices.length === 0) {
      response += `No devices found matching your criteria.\n`;
      if (searchType === 'user') {
        response += `\nTip: The search looked for devices assigned to users with names containing "${cleanQuery}".\n`;
      }
    } else {
      response += `### Devices (${devices.length} shown, sorted by ${sortBy})\n\n`;
      
      if (includeDetails && devices.length <= 10) {
        // Detailed view for small result sets
        devices.forEach((device: any, index: number) => {
          const lastSeen = device.lastContactTime || device.lastReportDate;
          const daysSinceContact = lastSeen 
            ? Math.floor((Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24))
            : 'Unknown';
          
          response += `#### ${index + 1}. ${device.name}\n`;
          response += `- **Serial Number**: ${device.serialNumber || 'N/A'}\n`;
          response += `- **OS Version**: ${device.osVersion || 'Unknown'}\n`;
          response += `- **Last Seen**: ${lastSeen ? new Date(lastSeen).toLocaleDateString() : 'Never'} (${daysSinceContact} days ago)\n`;
          response += `- **IP Address**: ${device.ipAddress || 'Unknown'}\n`;
          response += `- **Jamf ID**: ${device.id}\n`;
          
          // Show user information
          if (device.assignedUser || device.details?.userAndLocation) {
            const userInfo = device.details?.userAndLocation || {};
            response += `- **Assigned User**: ${device.assignedUser || userInfo.username || 'Not assigned'}\n`;
            if (device.userRealName || userInfo.realName) {
              response += `- **Full Name**: ${device.userRealName || userInfo.realName}\n`;
            }
            if (device.userEmail || userInfo.email) {
              response += `- **Email**: ${device.userEmail || userInfo.email}\n`;
            }
            response += `- **Department**: ${userInfo.department || 'None'}\n`;
            response += `- **Building**: ${userInfo.building || 'None'}\n`;
          }
          response += `\n`;
        });
      } else {
        // Table view for larger result sets
        if (searchType === 'user' || devices.some((d: any) => d.assignedUser)) {
          // Include user column when doing user search
          response += `| Device Name | Assigned User | Serial Number | OS Version | Last Seen |\n`;
          response += `|-------------|---------------|---------------|------------|-----------||\n`;
          
          devices.forEach((device: any) => {
            const lastSeen = device.lastContactTime || device.lastReportDate;
            const lastSeenDate = lastSeen ? new Date(lastSeen).toLocaleDateString() : 'Never';
            const user = device.assignedUser || device.details?.userAndLocation?.username || 'Not assigned';
            
            response += `| ${device.name} | ${user} | ${device.serialNumber || 'N/A'} | ${device.osVersion || 'Unknown'} | ${lastSeenDate} |\n`;
          });
        } else {
          // Standard table without user column
          response += `| Device Name | Serial Number | OS Version | Last Seen | Days Ago |\n`;
          response += `|-------------|---------------|------------|-----------|----------|\n`;
          
          devices.forEach((device: any) => {
            const lastSeen = device.lastContactTime || device.lastReportDate;
            const lastSeenDate = lastSeen ? new Date(lastSeen).toLocaleDateString() : 'Never';
            const daysSinceContact = lastSeen 
              ? Math.floor((Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24))
              : 'N/A';
            
            response += `| ${device.name} | ${device.serialNumber || 'N/A'} | ${device.osVersion || 'Unknown'} | ${lastSeenDate} | ${daysSinceContact} |\n`;
          });
        }
      }
    }
    
    // Add suggestions
    if (devices.length > 0) {
      response += `\n### Suggested Actions\n\n`;
      response += `- Get full details for a specific device using its Jamf ID\n`;
      response += `- Update inventory for devices that haven't checked in recently\n`;
      response += `- Deploy policies or configuration profiles to these devices\n`;
      
      if (!includeDetails && devices.length <= 10) {
        response += `- Run again with \`includeDetails: true\` for more information\n`;
      }
    }
    
    return {
      success: true,
      message: response,
      data: {
        query,
        cleanQuery,
        totalFound,
        filtered: devices.length !== totalFound,
        devices,
        suggestions: devices.length > 0 ? [
          `View device details for ${devices[0].name}`,
          'Update inventory for outdated devices',
          'Filter results by OS version or last seen date'
        ] : ['Try a different search term', 'Check if the device name is correct']
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
  name: 'device-search',
  description: 'Enhanced device search with filtering, sorting, and formatted results',
  parameters: {
    query: {
      type: 'string',
      description: 'Search query (device name, serial number, username, IP, etc.)',
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
      description: 'Include detailed device information (for up to 10 devices)',
      required: false,
      default: false
    },
    filterBy: {
      type: 'object',
      description: 'Additional filters to apply',
      required: false,
      properties: {
        osVersion: {
          type: 'string',
          description: 'Filter by OS version (e.g., "14", "13.6")'
        },
        lastSeenDays: {
          type: 'number',
          description: 'Only show devices seen within this many days'
        },
        assignedUser: {
          type: 'string',
          description: 'Filter by assigned username'
        }
      }
    },
    sortBy: {
      type: 'string',
      description: 'Sort results by field',
      required: false,
      default: 'name',
      enum: ['name', 'lastSeen', 'osVersion', 'serialNumber', 'user']
    }
  },
  examples: [
    {
      description: 'Simple device search',
      params: {
        query: 'MacBook'
      }
    },
    {
      description: 'Search for user devices',
      params: {
        query: "Jane's MacBook",
        searchType: 'user'
      }
    },
    {
      description: 'Search with filters and details',
      params: {
        query: 'Pro',
        filterBy: {
          osVersion: '14',
          lastSeenDays: 7
        },
        includeDetails: true,
        limit: 5
      }
    },
    {
      description: 'Search by serial number',
      params: {
        query: 'C02X',
        searchType: 'serial',
        sortBy: 'lastSeen'
      }
    }
  ],
  tags: ['search', 'devices', 'inventory']
};