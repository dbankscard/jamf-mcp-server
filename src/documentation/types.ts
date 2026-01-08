/**
 * Documentation Types
 * Type definitions for documentation generation
 */

export interface DocumentationOptions {
  outputPath?: string;
  formats?: ('markdown' | 'json')[];
  components?: ComponentType[];
  detailLevel?: 'summary' | 'standard' | 'full';
  includeScriptContent?: boolean;
  includeProfilePayloads?: boolean;
  useAIAnalysis?: boolean;
  anthropicApiKey?: string;
  pageSize?: number;
}

export type ComponentType =
  | 'computers'
  | 'mobile-devices'
  | 'policies'
  | 'configuration-profiles'
  | 'scripts'
  | 'packages'
  | 'computer-groups'
  | 'mobile-device-groups';

export interface DocumentationProgress {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  currentComponent?: ComponentType;
  completedComponents: ComponentType[];
  totalComponents: number;
  startTime?: Date;
  endTime?: Date;
  errors: string[];
  outputPath?: string;
}

export interface AIAnalysis {
  summary: string;
  insights: string[];
  recommendations: string[];
  risks?: string[];
  strengths?: string[];
}

export interface ComponentDocumentation {
  component: ComponentType;
  totalCount: number;
  items: any[];
  metadata: {
    generatedAt: Date;
    jamfUrl: string;
    detailLevel: string;
  };
  aiAnalysis?: AIAnalysis;
}

export interface EnvironmentDocumentation {
  overview: {
    jamfUrl: string;
    generatedAt: Date;
    generatedBy: string;
    totalComputers: number;
    totalMobileDevices: number;
    totalPolicies: number;
    totalConfigurationProfiles: number;
    totalScripts: number;
    totalPackages: number;
    totalComputerGroups: number;
    totalMobileDeviceGroups: number;
  };
  components: {
    [K in ComponentType]?: ComponentDocumentation;
  };
  aiAnalysis?: {
    environmentAnalysis: AIAnalysis;
    securityAnalysis?: AIAnalysis;
    recommendations?: AIAnalysis;
  };
}
