/**
 * Claude Skill: Find Outdated Devices
 *
 * This skill helps identify devices that haven't checked in recently,
 * which could indicate they're offline, decommissioned, or need attention.
 */
export async function findOutdatedDevices(context, params) {
    try {
        // Use the checkDeviceCompliance tool to find outdated devices
        const result = await context.callTool('checkDeviceCompliance', {
            days: params.daysSinceLastContact,
            includeDetails: params.includeDetails || false
        });
        const devices = result.data?.devices || [];
        const totalDevices = result.data?.totalDevices || 0;
        const compliantDevices = result.data?.compliant || 0;
        const nonCompliantDevices = result.data?.nonCompliant || 0;
        // Format the response
        let response = `## Device Check-in Status Report\n\n`;
        response += `- **Total Devices**: ${totalDevices}\n`;
        response += `- **Active (checked in within ${params.daysSinceLastContact} days)**: ${compliantDevices}\n`;
        response += `- **Outdated**: ${nonCompliantDevices}\n\n`;
        if (nonCompliantDevices > 0) {
            response += `### Devices Requiring Attention\n\n`;
            if (params.includeDetails && devices.length > 0) {
                response += `| Device Name | Serial Number | Last Check-in | Days Since |\n`;
                response += `|-------------|---------------|---------------|------------|\n`;
                devices.forEach((device) => {
                    const daysSince = Math.floor((Date.now() - new Date(device.lastContactTime).getTime()) / (1000 * 60 * 60 * 24));
                    response += `| ${device.name} | ${device.serialNumber} | ${new Date(device.lastContactTime).toLocaleDateString()} | ${daysSince} days |\n`;
                });
            }
            else {
                response += `Run with \`includeDetails: true\` to see the full list of outdated devices.\n`;
            }
        }
        else {
            response += `✅ All devices have checked in within the last ${params.daysSinceLastContact} days!\n`;
        }
        return {
            success: true,
            message: response,
            data: {
                totalDevices,
                activeDevices: compliantDevices,
                outdatedDevices: nonCompliantDevices,
                devices: params.includeDetails ? devices : undefined
            }
        };
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to check device status: ${error.message}`,
            error
        };
    }
}
// Skill metadata
export const metadata = {
    name: 'find-outdated-devices',
    description: 'Identify devices that haven\'t checked in recently',
    parameters: {
        daysSinceLastContact: {
            type: 'number',
            description: 'Number of days to consider a device outdated',
            required: true,
            default: 30
        },
        includeDetails: {
            type: 'boolean',
            description: 'Include detailed device list',
            required: false,
            default: false
        }
    },
    examples: [
        {
            description: 'Find devices not seen in 30 days',
            params: { daysSinceLastContact: 30 }
        },
        {
            description: 'Get detailed list of devices not seen in 7 days',
            params: { daysSinceLastContact: 7, includeDetails: true }
        }
    ]
};
//# sourceMappingURL=find-outdated-devices.js.map