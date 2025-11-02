/**
 * Claude Skill: Scheduled Compliance Check
 *
 * This skill performs comprehensive compliance checks and generates
 * actionable reports for IT administrators.
 */
import { SkillContext, SkillResult } from '../types';
interface ScheduledComplianceCheckParams {
    checks: {
        outdatedDevices?: {
            enabled: boolean;
            daysThreshold: number;
        };
        missingProfiles?: {
            enabled: boolean;
            requiredProfiles: string[];
        };
        osVersionCompliance?: {
            enabled: boolean;
            minimumVersion: string;
        };
        diskEncryption?: {
            enabled: boolean;
        };
    };
    outputFormat?: 'summary' | 'detailed' | 'csv';
    emailReport?: boolean;
}
export declare function scheduledComplianceCheck(context: SkillContext, params: ScheduledComplianceCheckParams): Promise<SkillResult>;
export declare const metadata: {
    name: string;
    description: string;
    parameters: {
        checks: {
            type: string;
            description: string;
            required: boolean;
        };
        outputFormat: {
            type: string;
            description: string;
            required: boolean;
            default: string;
            enum: string[];
        };
        emailReport: {
            type: string;
            description: string;
            required: boolean;
            default: boolean;
        };
    };
    examples: ({
        description: string;
        params: {
            checks: {
                outdatedDevices: {
                    enabled: boolean;
                    daysThreshold: number;
                };
                osVersionCompliance: {
                    enabled: boolean;
                    minimumVersion: string;
                };
                missingProfiles?: undefined;
                diskEncryption?: undefined;
            };
            outputFormat: string;
        };
    } | {
        description: string;
        params: {
            checks: {
                outdatedDevices: {
                    enabled: boolean;
                    daysThreshold: number;
                };
                missingProfiles: {
                    enabled: boolean;
                    requiredProfiles: string[];
                };
                osVersionCompliance: {
                    enabled: boolean;
                    minimumVersion: string;
                };
                diskEncryption: {
                    enabled: boolean;
                };
            };
            outputFormat: string;
        };
    })[];
    tags: string[];
};
export {};
//# sourceMappingURL=scheduled-compliance-check.d.ts.map