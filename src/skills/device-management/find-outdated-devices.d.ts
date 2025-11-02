/**
 * Claude Skill: Find Outdated Devices
 *
 * This skill helps identify devices that haven't checked in recently,
 * which could indicate they're offline, decommissioned, or need attention.
 */
import { SkillContext, SkillResult } from '../types';
interface FindOutdatedDevicesParams {
    daysSinceLastContact: number;
    includeDetails?: boolean;
}
export declare function findOutdatedDevices(context: SkillContext, params: FindOutdatedDevicesParams): Promise<SkillResult>;
export declare const metadata: {
    name: string;
    description: string;
    parameters: {
        daysSinceLastContact: {
            type: string;
            description: string;
            required: boolean;
            default: number;
        };
        includeDetails: {
            type: string;
            description: string;
            required: boolean;
            default: boolean;
        };
    };
    examples: ({
        description: string;
        params: {
            daysSinceLastContact: number;
            includeDetails?: undefined;
        };
    } | {
        description: string;
        params: {
            daysSinceLastContact: number;
            includeDetails: boolean;
        };
    })[];
};
export {};
//# sourceMappingURL=find-outdated-devices.d.ts.map