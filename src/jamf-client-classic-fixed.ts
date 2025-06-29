// This is a simplified version that properly fetches computer details for compliance checking

export async function getComputersWithDetails(jamfClient: any, limit: number = 100): Promise<any[]> {
  try {
    // First get the list of computers
    const response = await jamfClient.axios.get('/JSSResource/computers');
    const computers = response.data.computers || [];
    
    // Limit the number we process
    const computersToProcess = computers.slice(0, limit);
    
    // Fetch details for each computer
    const detailedComputers = [];
    
    for (const computer of computersToProcess) {
      try {
        const detailResponse = await jamfClient.axios.get(`/JSSResource/computers/id/${computer.id}`);
        const detailed = detailResponse.data.computer;
        
        // Combine list info with detailed info
        detailedComputers.push({
          id: computer.id,
          name: computer.name,
          // Add all date fields from general section
          last_contact_time: detailed.general?.last_contact_time,
          last_contact_time_epoch: detailed.general?.last_contact_time_epoch,
          last_contact_time_utc: detailed.general?.last_contact_time_utc,
          report_date: detailed.general?.report_date,
          report_date_epoch: detailed.general?.report_date_epoch,
          report_date_utc: detailed.general?.report_date_utc,
          serial_number: detailed.general?.serial_number,
          ip_address: detailed.general?.ip_address,
          mac_address: detailed.general?.mac_address,
          // Include the full general section for reference
          general: detailed.general
        });
      } catch (error) {
        console.error(`Failed to get details for computer ${computer.id}:`, error);
        // Include basic info even if details fail
        detailedComputers.push({
          id: computer.id,
          name: computer.name,
          error: 'Failed to fetch details'
        });
      }
    }
    
    return detailedComputers;
  } catch (error) {
    console.error('Failed to get computers with details:', error);
    throw error;
  }
}