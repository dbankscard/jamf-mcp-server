/**
 * Claude Skill: Deploy Policy by Criteria
 *
 * This skill helps deploy policies to devices based on specific criteria,
 * such as OS version, last check-in time, or device model.
 */
import { SkillContext, SkillResult } from '../types';
interface DeployPolicyByCriteriaParams {
    policyIdentifier: string;
    identifierType: 'id' | 'name';
    criteria: {
        osVersion?: string;
        daysSinceLastContact?: number;
        model?: string;
        building?: string;
        department?: string;
    };
    dryRun?: boolean;
    confirm?: boolean;
}
export declare function deployPolicyByCriteria(context: SkillContext, params: DeployPolicyByCriteriaParams): Promise<SkillResult>;
export declare const metadata: {
    name: string;
    description: string;
    parameters: {
        policyIdentifier: {
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
        criteria: {
            type: string;
            description: string;
            required: boolean;
        };
        dryRun: {
            type: string;
            description: string;
            required: boolean;
            default: boolean;
        };
        confirm: {
            type: string;
            description: string;
            required: boolean;
            default: boolean;
        };
    };
    examples: ({
        description: string;
        params: {
            policyIdentifier: string;
            identifierType: string;
            criteria: {
                osVersion: string;
                department?: undefined;
                daysSinceLastContact?: undefined;
            };
            dryRun: boolean;
            confirm?: undefined;
        };
    } | {
        description: string;
        params: {
            policyIdentifier: string;
            identifierType: string;
            criteria: {
                department: string;
                daysSinceLastContact: number;
                osVersion?: undefined;
            };
            dryRun: boolean;
            confirm: boolean;
        };
    })[];
    tags: string[];
};
export {};
//# sourceMappingURL=deploy-policy-by-criteria.d.ts.map