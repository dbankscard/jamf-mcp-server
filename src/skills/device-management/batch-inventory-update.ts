/**
 * Claude Skill: Batch Inventory Update
 * 
 * This skill updates inventory for multiple devices at once,
 * useful for ensuring device information is current before reports or audits.
 */

import { SkillContext, SkillResult } from '../types.js';
import { buildErrorContext } from '../../utils/error-handler.js';

interface BatchInventoryUpdateParams {
  deviceIdentifiers: string[];
  identifierType: 'id' | 'serialNumber' | 'name';
  maxConcurrent?: number;
}

export async function batchInventoryUpdate(
  context: SkillContext,
  params: BatchInventoryUpdateParams
): Promise<SkillResult> {
  const maxConcurrent = params.maxConcurrent || 5;
  const results = {
    successful: [] as string[],
    failed: [] as { device: string; error: string }[],
    total: params.deviceIdentifiers.length
  };

  try {
    // First, resolve identifiers to device IDs if needed
    let deviceIds: string[] = [];
    
    if (params.identifierType === 'id') {
      deviceIds = params.deviceIdentifiers;
    } else {
      // Search for devices to get their IDs
      for (const identifier of params.deviceIdentifiers) {
        try {
          const searchResult = await context.callTool('searchDevices', {
            query: identifier,
            limit: 1
          });
          
          if (searchResult.data?.devices && searchResult.data.devices.length > 0) {
            const device = searchResult.data.devices[0];
            deviceIds.push(device.id.toString());
          } else {
            results.failed.push({
              device: identifier,
              error: 'Device not found'
            });
          }
        } catch (error: unknown) {
          const errorContext = buildErrorContext(
            error,
            `Search device: ${identifier}`,
            'batch-inventory-update',
            { identifier, identifierType: params.identifierType }
          );
          results.failed.push({
            device: identifier,
            error: `Search failed: ${errorContext.message}`
          });
        }
      }
    }

    // Update inventory in batches
    const updatePromises = [];
    
    for (let i = 0; i < deviceIds.length; i += maxConcurrent) {
      const batch = deviceIds.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (deviceId) => {
        try {
          await context.callTool('updateInventory', { deviceId });
          results.successful.push(deviceId);
        } catch (error: unknown) {
          const errorContext = buildErrorContext(
            error,
            `Update inventory: ${deviceId}`,
            'batch-inventory-update',
            { deviceId }
          );
          results.failed.push({
            device: deviceId,
            error: errorContext.message
          });
        }
      });
      
      // Wait for batch to complete before starting next
      await Promise.all(batchPromises);
    }

    // Generate report
    let response = `## Batch Inventory Update Results\n\n`;
    response += `- **Total Devices**: ${results.total}\n`;
    response += `- **✅ Successful**: ${results.successful.length}\n`;
    response += `- **❌ Failed**: ${results.failed.length}\n\n`;

    if (results.successful.length > 0) {
      response += `### Successfully Updated\n`;
      response += `${results.successful.length} devices had their inventory updated.\n\n`;
    }

    if (results.failed.length > 0) {
      response += `### Failed Updates\n\n`;
      response += `| Device | Error |\n`;
      response += `|--------|-------|\n`;
      results.failed.forEach(failure => {
        response += `| ${failure.device} | ${failure.error} |\n`;
      });
    }

    return {
      success: results.failed.length === 0,
      message: response,
      data: results
    };
  } catch (error: unknown) {
    const errorContext = buildErrorContext(
      error,
      'Batch inventory update',
      'batch-inventory-update',
      { deviceCount: params.deviceIdentifiers.length, identifierType: params.identifierType }
    );
    return {
      success: false,
      message: `Batch update failed: ${errorContext.message}${errorContext.suggestions ? ` (${errorContext.suggestions[0]})` : ''}`,
      error: error instanceof Error ? error : new Error(errorContext.message),
      data: {
        errorCode: errorContext.code,
        timestamp: errorContext.timestamp,
      }
    };
  }
}

// Skill metadata
export const metadata: any = {
  name: 'batch-inventory-update',
  description: 'Update inventory for multiple devices at once',
  parameters: {
    deviceIdentifiers: {
      type: 'array',
      description: 'Array of device identifiers (IDs, serial numbers, or names)',
      required: true
    },
    identifierType: {
      type: 'string',
      description: 'Type of identifier provided: "id", "serialNumber", or "name"',
      required: true,
      enum: ['id', 'serialNumber', 'name']
    },
    maxConcurrent: {
      type: 'number',
      description: 'Maximum concurrent updates (default: 5)',
      required: false,
      default: 5
    }
  },
  examples: [
    {
      description: 'Update inventory by device IDs',
      params: {
        deviceIdentifiers: ['1001', '1002', '1003'],
        identifierType: 'id'
      }
    },
    {
      description: 'Update inventory by serial numbers',
      params: {
        deviceIdentifiers: ['C02XL1234567', 'C02XL2345678'],
        identifierType: 'serialNumber',
        maxConcurrent: 3
      }
    }
  ]
};