import { parseJamfDate } from '../jamf-client-classic.js';

export async function checkDeviceComplianceOptimized(jamfClient: any, days: number, includeDetails: boolean) {
  // Get all computers from advanced search (already includes date info)
  const allComputers = await jamfClient.getAllComputers();
  
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  
  const results = {
    totalDevices: allComputers.length,
    compliant: 0,
    nonCompliant: 0,
    notReporting: 0,
    unknown: 0,
    complianceRate: '0%',
    summary: {
      totalDevices: allComputers.length,
      compliant: 0,
      warning: 0,
      critical: 0,
      unknown: 0,
      criticalDevices: [] as any[],
      warningDevices: [] as any[],
    },
    devices: includeDetails ? [] as any[] : undefined,
  };

  // Process all computers without fetching individual details
  for (const computer of allComputers) {
    // Get date from the data we already have
    const dateValue = computer.general?.last_contact_time || 
                      computer.general?.last_contact_time_utc ||
                      computer.Last_Check_in;
    
    const lastContact = parseJamfDate(dateValue);
    
    const daysSinceContact = lastContact 
      ? Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    const deviceInfo = {
      id: computer.id?.toString(),
      name: computer.name || computer.general?.name || computer.Computer_Name,
      serialNumber: computer.general?.serial_number || computer.Serial_Number,
      username: computer.username || computer.Full_Name,
      lastContact: lastContact?.toISOString() || 'Unknown',
      lastContactReadable: dateValue || 'Unknown',
      daysSinceContact,
      status: 'unknown' as string,
    };
    
    if (!lastContact) {
      results.unknown++;
      results.summary.unknown++;
      deviceInfo.status = 'unknown';
    } else if (lastContact < cutoffDate) {
      results.nonCompliant++;
      results.notReporting++;
      deviceInfo.status = 'non-compliant';
      
      // Categorize by severity
      if (daysSinceContact && daysSinceContact > 90) {
        results.summary.critical++;
        if (includeDetails) {
          results.summary.criticalDevices.push({
            ...deviceInfo,
            severity: 'critical',
          });
        }
      } else {
        results.summary.warning++;
        if (includeDetails) {
          results.summary.warningDevices.push({
            ...deviceInfo,
            severity: 'warning',
          });
        }
      }
    } else {
      results.compliant++;
      results.summary.compliant++;
      deviceInfo.status = 'compliant';
    }
    
    if (includeDetails && results.devices) {
      results.devices.push(deviceInfo);
    }
  }
  
  // Calculate compliance rate
  const complianceRate = results.totalDevices > 0 
    ? ((results.compliant / results.totalDevices) * 100).toFixed(1)
    : '0.0';
  results.complianceRate = `${complianceRate}%`;
  
  // Sort devices by last contact time if details included
  if (includeDetails && results.devices) {
    results.devices.sort((a, b) => {
      const dateA = new Date(a.lastContact).getTime();
      const dateB = new Date(b.lastContact).getTime();
      return dateB - dateA;
    });
  }
  
  return results;
}