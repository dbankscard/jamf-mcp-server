/**
 * Claude Skill: Batch Inventory Update
 *
 * This skill updates inventory for multiple devices at once,
 * useful for ensuring device information is current before reports or audits.
 */
import { SkillContext, SkillResult } from '../types';
interface BatchInventoryUpdateParams {
    deviceIdentifiers: string[];
    identifierType: 'id' | 'serialNumber' | 'name';
    maxConcurrent?: number;
}
export declare function batchInventoryUpdate(context: SkillContext, params: BatchInventoryUpdateParams): Promise<SkillResult>;
export declare const metadata: {
    name: string;
    description: string;
    parameters: {
        deviceIdentifiers: {
            type: string;
            description: string;
            required: boolean;
        };
        identifierType: {
            type: string;
            description: string;
            required: boolean;
            enum: string[];
        };
        maxConcurrent: {
            type: string;
            description: string;
            required: boolean;
            default: number;
        };
    };
    examples: ({
        description: string;
        params: {
            deviceIdentifiers: string[];
            identifierType: string;
            maxConcurrent?: undefined;
        };
    } | {
        description: string;
        params: {
            deviceIdentifiers: string[];
            identifierType: string;
            maxConcurrent: number;
        };
    })[];
};
export {};
//# sourceMappingURL=batch-inventory-update.d.ts.map