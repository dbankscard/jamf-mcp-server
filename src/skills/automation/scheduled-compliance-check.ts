/**
 * Claude Skill: Scheduled Compliance Check
 * 
 * This skill performs comprehensive compliance checks and generates
 * actionable reports for IT administrators.
 */

import { SkillContext, SkillResult, SkillMetadata } from '../types.js';

/** Profile search result from the compliance check */
interface MissingProfileEntry {
  name: string;
  status: 'not_found' | 'found';
}

/** Device OS compliance result */
interface OsNonCompliantDevice {
  name: string;
  currentVersion: string;
  id: string;
}

/** Device result from compliance check */
interface ComplianceDevice {
  name?: string;
  osVersion?: string;
  id?: string;
  lastContactTime?: string;
}

/** Check result types */
interface CheckResults {
  outdatedDevices?: {
    passed: boolean;
    count: number;
    devices: ComplianceDevice[];
    threshold: number;
  };
  osVersionCompliance?: {
    passed: boolean;
    minimumRequired: string;
    nonCompliantCount: number;
    devices: OsNonCompliantDevice[];
  };
  missingProfiles?: {
    passed: boolean;
    missingProfiles: MissingProfileEntry[];
    affectedDevices: number;
  };
}

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

export async function scheduledComplianceCheck(
  context: SkillContext,
  params: ScheduledComplianceCheckParams
): Promise<SkillResult> {
  const results = {
    timestamp: new Date().toISOString(),
    checks: {} as CheckResults,
    summary: {
      totalIssues: 0,
      criticalIssues: 0,
      warnings: 0
    }
  };

  try {
    // Check for outdated devices
    if (params.checks.outdatedDevices?.enabled) {
      const complianceResult = await context.callTool('checkDeviceCompliance', {
        days: params.checks.outdatedDevices.daysThreshold,
        includeDetails: true
      });

      const outdatedCount = complianceResult.data?.nonCompliant || 0;
      results.checks.outdatedDevices = {
        passed: outdatedCount === 0,
        count: outdatedCount,
        devices: complianceResult.data?.devices || [],
        threshold: params.checks.outdatedDevices.daysThreshold
      };

      if (outdatedCount > 0) {
        results.summary.totalIssues += outdatedCount;
        results.summary.warnings += outdatedCount;
      }
    }

    // Check for missing configuration profiles
    if (params.checks.missingProfiles?.enabled) {
      const profileResults: {
        passed: boolean;
        missingProfiles: MissingProfileEntry[];
        affectedDevices: number;
      } = {
        passed: true,
        missingProfiles: [],
        affectedDevices: 0
      };

      for (const requiredProfile of params.checks.missingProfiles.requiredProfiles) {
        const searchResult = await context.callTool('searchConfigurationProfiles', {
          query: requiredProfile,
          type: 'computer'
        });

        const profiles = searchResult.data?.profiles || [];
        if (profiles.length === 0) {
          profileResults.missingProfiles.push({
            name: requiredProfile,
            status: 'not_found'
          });
          profileResults.passed = false;
          results.summary.criticalIssues++;
        }
      }

      results.checks.missingProfiles = profileResults;
      if (!profileResults.passed) {
        results.summary.totalIssues++;
      }
    }

    // Check OS version compliance
    if (params.checks.osVersionCompliance?.enabled) {
      const searchResult = await context.callTool('searchDevices', {
        query: 'os',
        limit: 100
      });

      const devices = (searchResult.data?.devices || []) as ComplianceDevice[];
      const nonCompliantDevices = devices.filter((device) => {
        const deviceVersion = device.osVersion || '';
        return deviceVersion < params.checks.osVersionCompliance!.minimumVersion;
      });

      results.checks.osVersionCompliance = {
        passed: nonCompliantDevices.length === 0,
        minimumRequired: params.checks.osVersionCompliance.minimumVersion,
        nonCompliantCount: nonCompliantDevices.length,
        devices: nonCompliantDevices.map((d) => ({
          name: d.name || 'Unknown',
          currentVersion: d.osVersion || 'Unknown',
          id: d.id || ''
        }))
      };

      if (nonCompliantDevices.length > 0) {
        results.summary.totalIssues += nonCompliantDevices.length;
        results.summary.criticalIssues += nonCompliantDevices.length;
      }
    }

    // Generate report
    let report = `# Compliance Check Report\n\n`;
    report += `**Generated**: ${new Date().toLocaleString()}\n\n`;

    // Summary section
    report += `## Summary\n\n`;
    report += `- **Total Issues**: ${results.summary.totalIssues}\n`;
    report += `- **Critical Issues**: ${results.summary.criticalIssues}\n`;
    report += `- **Warnings**: ${results.summary.warnings}\n\n`;

    // Detailed results
    if (params.outputFormat !== 'summary') {
      report += `## Detailed Results\n\n`;

      // Outdated devices
      if (results.checks.outdatedDevices) {
        report += `### Outdated Devices Check\n`;
        report += `- **Status**: ${results.checks.outdatedDevices.passed ? '✅ Passed' : '⚠️ Failed'}\n`;
        report += `- **Threshold**: ${results.checks.outdatedDevices.threshold} days\n`;
        report += `- **Found**: ${results.checks.outdatedDevices.count} devices\n\n`;

        if (!results.checks.outdatedDevices.passed && params.outputFormat === 'detailed') {
          report += `| Device | Last Check-in | Days Outdated |\n`;
          report += `|--------|---------------|---------------|\n`;
          results.checks.outdatedDevices.devices.slice(0, 10).forEach((device) => {
            const lastContactTime = device.lastContactTime || new Date().toISOString();
            const daysSince = Math.floor((Date.now() - new Date(lastContactTime).getTime()) / (1000 * 60 * 60 * 24));
            report += `| ${device.name || 'Unknown'} | ${new Date(lastContactTime).toLocaleDateString()} | ${daysSince} |\n`;
          });
          report += `\n`;
        }
      }

      // OS Version compliance
      if (results.checks.osVersionCompliance) {
        report += `### OS Version Compliance\n`;
        report += `- **Status**: ${results.checks.osVersionCompliance.passed ? '✅ Passed' : '❌ Failed'}\n`;
        report += `- **Minimum Required**: ${results.checks.osVersionCompliance.minimumRequired}\n`;
        report += `- **Non-compliant**: ${results.checks.osVersionCompliance.nonCompliantCount} devices\n\n`;

        if (!results.checks.osVersionCompliance.passed && params.outputFormat === 'detailed') {
          report += `| Device | Current Version |\n`;
          report += `|--------|----------------|\n`;
          results.checks.osVersionCompliance.devices.slice(0, 10).forEach((device) => {
            report += `| ${device.name} | ${device.currentVersion} |\n`;
          });
          report += `\n`;
        }
      }

      // Missing profiles
      if (results.checks.missingProfiles) {
        report += `### Configuration Profile Check\n`;
        report += `- **Status**: ${results.checks.missingProfiles.passed ? '✅ Passed' : '❌ Failed'}\n`;
        if (results.checks.missingProfiles.missingProfiles.length > 0) {
          report += `- **Missing Profiles**:\n`;
          results.checks.missingProfiles.missingProfiles.forEach((profile) => {
            report += `  - ${profile.name}: ${profile.status}\n`;
          });
        }
        report += `\n`;
      }
    }

    // Recommendations
    report += `## Recommendations\n\n`;
    
    if (results.summary.criticalIssues > 0) {
      report += `### Critical Actions Required\n`;
      if (results.checks.osVersionCompliance && !results.checks.osVersionCompliance.passed) {
        report += `- Update ${results.checks.osVersionCompliance.nonCompliantCount} devices to macOS ${results.checks.osVersionCompliance.minimumRequired} or later\n`;
      }
      if (results.checks.missingProfiles && !results.checks.missingProfiles.passed) {
        report += `- Deploy missing configuration profiles\n`;
      }
      report += `\n`;
    }

    if (results.summary.warnings > 0) {
      report += `### Warnings\n`;
      if (results.checks.outdatedDevices && !results.checks.outdatedDevices.passed) {
        report += `- ${results.checks.outdatedDevices.count} devices haven't checked in recently\n`;
        report += `- Consider running inventory update or checking device connectivity\n`;
      }
      report += `\n`;
    }

    return {
      success: true,
      message: report,
      data: results,
      nextActions: results.summary.totalIssues > 0 ? [
        'Review non-compliant devices',
        'Create remediation policies',
        'Schedule follow-up compliance check'
      ] : ['Schedule next compliance check']
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Compliance check failed: ${message}`,
      error: error instanceof Error ? error : new Error(message)
    };
  }
}

// Skill metadata
export const metadata: SkillMetadata = {
  name: 'scheduled-compliance-check',
  description: 'Perform comprehensive compliance checks and generate reports',
  parameters: {
    checks: {
      type: 'object',
      description: 'Compliance checks to perform',
      required: true
    },
    outputFormat: {
      type: 'string',
      description: 'Report format: summary, detailed, or csv',
      required: false,
      default: 'detailed',
      enum: ['summary', 'detailed', 'csv']
    },
    emailReport: {
      type: 'boolean',
      description: 'Email the report (not implemented in this example)',
      required: false,
      default: false
    }
  },
  examples: [
    {
      description: 'Basic compliance check',
      params: {
        checks: {
          outdatedDevices: { enabled: true, daysThreshold: 30 },
          osVersionCompliance: { enabled: true, minimumVersion: '14.0' }
        },
        outputFormat: 'summary'
      }
    },
    {
      description: 'Comprehensive compliance audit',
      params: {
        checks: {
          outdatedDevices: { enabled: true, daysThreshold: 7 },
          missingProfiles: { 
            enabled: true, 
            requiredProfiles: ['FileVault', 'Firewall', 'Screensaver']
          },
          osVersionCompliance: { enabled: true, minimumVersion: '14.0' },
          diskEncryption: { enabled: true }
        },
        outputFormat: 'detailed'
      }
    }
  ],
  tags: ['compliance', 'reporting', 'automation', 'security']
};