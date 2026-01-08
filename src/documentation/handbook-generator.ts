/**
 * Enhanced Handbook Generator
 *
 * Generates comprehensive, human-readable documentation suitable for export
 * Creates a complete operations manual with detailed explanations
 */

import { ComponentType, ComponentDocumentation, EnvironmentDocumentation } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../server/logger.js';

const logger = createLogger('handbook-generator');

export class HandbookGenerator {
  /**
   * Generate comprehensive handbook
   */
  async generateHandbook(
    documentation: EnvironmentDocumentation,
    outputPath: string
  ): Promise<void> {
    logger.info('Generating comprehensive handbook...');

    const handbookDir = path.join(outputPath, 'handbook');
    await fs.mkdir(handbookDir, { recursive: true });

    // Generate table of contents
    await this.generateTableOfContents(documentation, handbookDir);

    // Generate component handbooks
    for (const [componentType, componentDoc] of Object.entries(documentation.components)) {
      if (!componentDoc || componentDoc.totalCount === 0) continue;

      await this.generateComponentHandbook(
        componentType as ComponentType,
        componentDoc,
        handbookDir,
        documentation
      );
    }

    // Generate master handbook (single file)
    await this.generateMasterHandbook(documentation, handbookDir);

    logger.info('Handbook generation complete');
  }

  /**
   * Generate table of contents
   */
  private async generateTableOfContents(
    documentation: EnvironmentDocumentation,
    handbookDir: string
  ): Promise<void> {
    const { overview } = documentation;

    let toc = `# Jamf Pro Environment Handbook\n\n`;
    toc += `**Environment:** ${overview.jamfUrl}\n`;
    toc += `**Generated:** ${overview.generatedAt.toISOString()}\n`;
    toc += `**Total Assets:** ${this.calculateTotalAssets(overview)} items\n\n`;

    toc += `---\n\n`;
    toc += `## Table of Contents\n\n`;

    // Overview
    toc += `### Overview\n`;
    toc += `- [Executive Summary](#executive-summary)\n`;
    toc += `- [Environment Statistics](#environment-statistics)\n`;
    toc += `- [Component Summary](#component-summary)\n\n`;

    // Components
    if (overview.totalPolicies > 0) {
      toc += `### Policies (${overview.totalPolicies})\n`;
      toc += `- [Policy Overview](policies-handbook.md)\n`;
      toc += `- [Policy Index](policies-handbook.md#policy-index)\n\n`;
    }

    if (overview.totalScripts > 0) {
      toc += `### Scripts (${overview.totalScripts})\n`;
      toc += `- [Script Overview](scripts-handbook.md)\n`;
      toc += `- [Script Index](scripts-handbook.md#script-index)\n\n`;
    }

    if (overview.totalPackages > 0) {
      toc += `### Packages (${overview.totalPackages})\n`;
      toc += `- [Package Overview](packages-handbook.md)\n`;
      toc += `- [Package Index](packages-handbook.md#package-index)\n\n`;
    }

    if (overview.totalConfigurationProfiles > 0) {
      toc += `### Configuration Profiles (${overview.totalConfigurationProfiles})\n`;
      toc += `- [Profile Overview](profiles-handbook.md)\n`;
      toc += `- [Profile Index](profiles-handbook.md#profile-index)\n\n`;
    }

    if (overview.totalComputerGroups > 0) {
      toc += `### Computer Groups (${overview.totalComputerGroups})\n`;
      toc += `- [Group Overview](groups-handbook.md)\n`;
      toc += `- [Smart Groups](groups-handbook.md#smart-groups)\n`;
      toc += `- [Static Groups](groups-handbook.md#static-groups)\n\n`;
    }

    if (overview.totalComputers > 0) {
      toc += `### Inventory\n`;
      toc += `- [Computers (${overview.totalComputers})](inventory-handbook.md#computers)\n`;
      toc += `- [Mobile Devices (${overview.totalMobileDevices})](inventory-handbook.md#mobile-devices)\n\n`;
    }

    toc += `---\n\n`;
    toc += `## Executive Summary\n\n`;
    toc += `This handbook provides comprehensive documentation for the Jamf Pro environment at ${overview.jamfUrl}. `;
    toc += `It includes detailed information about all ${this.calculateTotalAssets(overview)} managed items, `;
    toc += `including policies, scripts, configuration profiles, packages, and inventory.\n\n`;

    toc += `### Purpose\n\n`;
    toc += `This documentation serves as:\n`;
    toc += `- **Operations Manual**: Day-to-day reference for IT staff\n`;
    toc += `- **Training Resource**: Onboarding documentation for new team members\n`;
    toc += `- **Audit Documentation**: Compliance and security audit trail\n`;
    toc += `- **Disaster Recovery**: Complete environment snapshot for rebuilding\n\n`;

    toc += `### How to Use This Handbook\n\n`;
    toc += `1. **Finding a Policy**: Navigate to the [Policy Index](policies-handbook.md#policy-index) and search by name\n`;
    toc += `2. **Understanding Scripts**: Each script includes full source code, purpose, and usage context\n`;
    toc += `3. **Configuration Profiles**: Detailed breakdown of all settings and payloads\n`;
    toc += `4. **Smart Groups**: Criteria and membership logic explained\n`;
    toc += `5. **Relationships**: Cross-references show how components work together\n\n`;

    toc += `---\n\n`;
    toc += `## Environment Statistics\n\n`;
    toc += `| Component | Count | Status |\n`;
    toc += `|-----------|-------|--------|\n`;
    toc += `| Computers | ${overview.totalComputers} | ✅ Managed |\n`;
    toc += `| Mobile Devices | ${overview.totalMobileDevices} | ✅ Managed |\n`;
    toc += `| Policies | ${overview.totalPolicies} | 📋 Active |\n`;
    toc += `| Scripts | ${overview.totalScripts} | 📝 Available |\n`;
    toc += `| Packages | ${overview.totalPackages} | 📦 Cataloged |\n`;
    toc += `| Configuration Profiles | ${overview.totalConfigurationProfiles} | ⚙️ Active |\n`;
    toc += `| Computer Groups | ${overview.totalComputerGroups} | 👥 Defined |\n`;
    toc += `| Mobile Device Groups | ${overview.totalMobileDeviceGroups} | 👥 Defined |\n\n`;

    await fs.writeFile(path.join(handbookDir, 'README.md'), toc);
  }

  /**
   * Generate comprehensive handbook for a component
   */
  private async generateComponentHandbook(
    component: ComponentType,
    doc: ComponentDocumentation,
    handbookDir: string,
    fullDoc: EnvironmentDocumentation
  ): Promise<void> {
    let handbook = '';

    switch (component) {
      case 'policies':
        handbook = this.generatePoliciesHandbook(doc, fullDoc);
        break;
      case 'scripts':
        handbook = this.generateScriptsHandbook(doc, fullDoc);
        break;
      case 'packages':
        handbook = this.generatePackagesHandbook(doc, fullDoc);
        break;
      case 'configuration-profiles':
        handbook = this.generateProfilesHandbook(doc, fullDoc);
        break;
      case 'computer-groups':
        handbook = this.generateGroupsHandbook(doc, fullDoc);
        break;
      case 'computers':
      case 'mobile-devices':
        // Handle inventory separately
        return;
      default:
        return;
    }

    const filename = `${component}-handbook.md`;
    await fs.writeFile(path.join(handbookDir, filename), handbook);
  }

  /**
   * Generate comprehensive policies handbook
   */
  private generatePoliciesHandbook(doc: ComponentDocumentation, fullDoc: EnvironmentDocumentation): string {
    let md = `# Policies Handbook\n\n`;
    md += `**Total Policies:** ${doc.totalCount}\n`;
    md += `**Last Updated:** ${doc.metadata.generatedAt.toISOString()}\n\n`;

    md += `---\n\n`;
    md += `## Overview\n\n`;
    md += `This section documents all ${doc.totalCount} policies configured in the Jamf Pro environment. `;
    md += `Each policy includes complete details about its purpose, configuration, attached scripts and packages, `;
    md += `scope, exclusions, and execution parameters.\n\n`;

    // Group policies by category
    const policiesByCategory = this.groupByCategory(doc.items);

    md += `### Policies by Category\n\n`;
    for (const [category, count] of Object.entries(policiesByCategory)) {
      md += `- **${category}**: ${count} policies\n`;
    }
    md += `\n`;

    md += `---\n\n`;
    md += `## Policy Index\n\n`;

    // Alphabetical index
    const sortedPolicies = [...doc.items].sort((a, b) => {
      const nameA = (a.general?.name || a.name || '').toLowerCase();
      const nameB = (b.general?.name || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    for (const policy of sortedPolicies) {
      const name = policy.general?.name || policy.name || 'Unnamed';
      const id = policy.general?.id || policy.id;
      const anchor = this.createAnchor(name);
      md += `- [${name}](#${anchor}) (ID: ${id})\n`;
    }

    md += `\n---\n\n`;
    md += `## Policy Details\n\n`;

    // Detailed policy documentation
    for (const policy of sortedPolicies) {
      md += this.generatePolicyDetail(policy, fullDoc);
      md += `\n---\n\n`;
    }

    return md;
  }

  /**
   * Generate detailed policy documentation
   */
  private generatePolicyDetail(policy: any, fullDoc: EnvironmentDocumentation): string {
    const general = policy.general || {};
    const name = general.name || 'Unnamed Policy';

    let md = `### ${name}\n\n`;

    // Basic Information
    md += `#### Basic Information\n\n`;
    md += `| Property | Value |\n`;
    md += `|----------|-------|\n`;
    md += `| **Policy ID** | ${general.id || 'N/A'} |\n`;
    md += `| **Status** | ${general.enabled ? '✅ Enabled' : '❌ Disabled'} |\n`;
    md += `| **Category** | ${general.category?.name || 'Uncategorized'} |\n`;
    md += `| **Site** | ${general.site?.name || 'None'} |\n\n`;

    // Purpose/Description (from self-service if available)
    if (policy.self_service?.self_service_description) {
      md += `#### Purpose\n\n`;
      md += `${policy.self_service.self_service_description}\n\n`;
    }

    // Trigger Information
    md += `#### Trigger Configuration\n\n`;
    md += `| Trigger Type | Value |\n`;
    md += `|--------------|-------|\n`;
    md += `| **Primary Trigger** | ${general.trigger || 'None'} |\n`;
    md += `| **Frequency** | ${general.frequency || 'N/A'} |\n`;
    md += `| **Check-in** | ${general.trigger_checkin ? '✅ Yes' : '❌ No'} |\n`;
    md += `| **Enrollment Complete** | ${general.trigger_enrollment_complete ? '✅ Yes' : '❌ No'} |\n`;
    md += `| **Login** | ${general.trigger_login ? '✅ Yes' : '❌ No'} |\n`;
    md += `| **Network State Changed** | ${general.trigger_network_state_changed ? '✅ Yes' : '❌ No'} |\n`;
    md += `| **Startup** | ${general.trigger_startup ? '✅ Yes' : '❌ No'} |\n`;
    if (general.trigger_other) {
      md += `| **Custom Trigger** | \`${general.trigger_other}\` |\n`;
    }
    md += `\n`;

    // Packages
    if (policy.package_configuration?.packages?.length > 0) {
      md += `#### Packages\n\n`;
      md += `This policy installs ${policy.package_configuration.packages.length} package(s):\n\n`;
      md += `| Package Name | ID | Action | FUT | FEU |\n`;
      md += `|--------------|:--:|:------:|:---:|:---:|\n`;
      for (const pkg of policy.package_configuration.packages) {
        md += `| ${pkg.name || 'N/A'} `;
        md += `| ${pkg.id || 'N/A'} `;
        md += `| ${pkg.action || 'Install'} `;
        md += `| ${pkg.fut ? '✅' : '❌'} `;
        md += `| ${pkg.feu ? '✅' : '❌'} |\n`;
      }
      md += `\n`;
      md += `*FUT = Fill User Template, FEU = Fill Existing Users*\n\n`;
    }

    // Scripts
    if (policy.scripts?.length > 0) {
      md += `#### Scripts\n\n`;
      md += `This policy executes ${policy.scripts.length} script(s):\n\n`;

      for (const script of policy.scripts) {
        md += `##### ${script.name || 'Unnamed Script'}\n\n`;
        md += `- **Script ID**: ${script.id || 'N/A'}\n`;
        md += `- **Priority**: ${script.priority || 'N/A'}\n`;

        // Show parameters if set
        const params = [];
        for (let i = 4; i <= 11; i++) {
          const paramValue = script[`parameter${i}`];
          if (paramValue) {
            params.push(`  - Parameter ${i}: \`${paramValue}\``);
          }
        }
        if (params.length > 0) {
          md += `- **Parameters**:\n${params.join('\n')}\n`;
        }

        // Try to find script details in fullDoc
        const scriptDetails = this.findScriptDetails(script.id, fullDoc);
        if (scriptDetails) {
          if (scriptDetails.info) {
            md += `\n**Purpose:** ${scriptDetails.info}\n`;
          }
          if (scriptDetails.scriptContents || scriptDetails.script_contents) {
            md += `\n**Script Code:**\n\`\`\`bash\n`;
            md += scriptDetails.scriptContents || scriptDetails.script_contents;
            md += `\n\`\`\`\n`;
          }
        }
        md += `\n`;
      }
    }

    // Scope
    md += `#### Scope\n\n`;
    if (policy.scope?.all_computers) {
      md += `**Target:** All Computers\n\n`;
    } else {
      md += `**Target:** Specific computers/groups\n\n`;

      if (policy.scope?.computers?.length > 0) {
        md += `- **Specific Computers**: ${policy.scope.computers.length} computers\n`;
        if (policy.scope.computers.length <= 10) {
          for (const computer of policy.scope.computers) {
            md += `  - ${computer.name || computer.id}\n`;
          }
        }
      }

      if (policy.scope?.computer_groups?.length > 0) {
        md += `- **Computer Groups**: ${policy.scope.computer_groups.length} groups\n`;
        for (const group of policy.scope.computer_groups) {
          md += `  - ${group.name || group.id}\n`;
        }
      }

      if (policy.scope?.buildings?.length > 0) {
        md += `- **Buildings**: ${policy.scope.buildings.map((b: any) => b.name).join(', ')}\n`;
      }

      if (policy.scope?.departments?.length > 0) {
        md += `- **Departments**: ${policy.scope.departments.map((d: any) => d.name).join(', ')}\n`;
      }
    }
    md += `\n`;

    // Exclusions
    if (policy.scope?.exclusions && (
      policy.scope.exclusions.computers?.length > 0 ||
      policy.scope.exclusions.computer_groups?.length > 0 ||
      policy.scope.exclusions.buildings?.length > 0 ||
      policy.scope.exclusions.departments?.length > 0
    )) {
      md += `#### Exclusions\n\n`;
      md += `The following are excluded from this policy:\n\n`;

      if (policy.scope.exclusions.computers?.length > 0) {
        md += `- **Computers**: ${policy.scope.exclusions.computers.length} computers\n`;
      }

      if (policy.scope.exclusions.computer_groups?.length > 0) {
        md += `- **Computer Groups**:\n`;
        for (const group of policy.scope.exclusions.computer_groups) {
          md += `  - ${group.name || group.id}\n`;
        }
      }

      if (policy.scope.exclusions.buildings?.length > 0) {
        md += `- **Buildings**: ${policy.scope.exclusions.buildings.map((b: any) => b.name).join(', ')}\n`;
      }

      if (policy.scope.exclusions.departments?.length > 0) {
        md += `- **Departments**: ${policy.scope.exclusions.departments.map((d: any) => d.name).join(', ')}\n`;
      }
      md += `\n`;
    }

    // Self-Service
    if (policy.self_service?.use_for_self_service) {
      md += `#### Self-Service\n\n`;
      md += `This policy is available in Self-Service.\n\n`;
      md += `- **Display Name**: ${policy.self_service.self_service_display_name || name}\n`;
      md += `- **Install Button**: "${policy.self_service.install_button_text || 'Install'}"\n`;
      md += `- **Reinstall Button**: "${policy.self_service.reinstall_button_text || 'Reinstall'}"\n`;
      md += `- **Feature on Main Page**: ${policy.self_service.feature_on_main_page ? 'Yes' : 'No'}\n`;
      md += `- **Force View Description**: ${policy.self_service.force_users_to_view_description ? 'Yes' : 'No'}\n`;

      if (policy.self_service.self_service_categories?.length > 0) {
        md += `- **Categories**:\n`;
        for (const cat of policy.self_service.self_service_categories) {
          md += `  - ${cat.name}${cat.feature_in ? ' (Featured)' : ''}\n`;
        }
      }

      if (policy.self_service.self_service_icon?.uri) {
        md += `- **Icon**: [View Icon](${policy.self_service.self_service_icon.uri})\n`;
      }
      md += `\n`;
    }

    // Maintenance
    if (policy.maintenance) {
      const actions = [];
      if (policy.maintenance.recon) actions.push('Update Inventory');
      if (policy.maintenance.reset_name) actions.push('Reset Computer Name');
      if (policy.maintenance.install_all_cached_packages) actions.push('Install Cached Packages');
      if (policy.maintenance.heal) actions.push('Heal');
      if (policy.maintenance.permissions) actions.push('Repair Permissions');
      if (policy.maintenance.byhost) actions.push('Fix ByHost Files');
      if (policy.maintenance.system_cache) actions.push('Clear System Cache');
      if (policy.maintenance.user_cache) actions.push('Clear User Cache');
      if (policy.maintenance.verify) actions.push('Verify Disk');

      if (actions.length > 0) {
        md += `#### Maintenance Actions\n\n`;
        for (const action of actions) {
          md += `- ${action}\n`;
        }
        md += `\n`;
      }
    }

    // Reboot
    if (policy.reboot && (policy.reboot.user_logged_in !== 'Do not restart' || policy.reboot.no_user_logged_in !== 'Do not restart')) {
      md += `#### Reboot Settings\n\n`;
      md += `- **No User Logged In**: ${policy.reboot.no_user_logged_in || 'Do not restart'}\n`;
      md += `- **User Logged In**: ${policy.reboot.user_logged_in || 'Do not restart'}\n`;
      if (policy.reboot.user_logged_in !== 'Do not restart' && policy.reboot.minutes_until_reboot) {
        md += `- **Restart Timer**: ${policy.reboot.minutes_until_reboot} minutes\n`;
        md += `- **Message**: ${policy.reboot.message || 'Default message'}\n`;
      }
      md += `\n`;
    }

    // Files & Processes
    if (policy.files_processes && (
      policy.files_processes.search_by_path ||
      policy.files_processes.search_for_process ||
      policy.files_processes.run_command
    )) {
      md += `#### Files & Processes\n\n`;

      if (policy.files_processes.search_by_path) {
        md += `- **Search Path**: \`${policy.files_processes.search_by_path}\`\n`;
        if (policy.files_processes.delete_file) {
          md += `  - Action: Delete file\n`;
        }
      }

      if (policy.files_processes.search_for_process) {
        md += `- **Search Process**: \`${policy.files_processes.search_for_process}\`\n`;
        if (policy.files_processes.kill_process) {
          md += `  - Action: Kill process\n`;
        }
      }

      if (policy.files_processes.run_command) {
        md += `- **Run Command**: \`${policy.files_processes.run_command}\`\n`;
      }
      md += `\n`;
    }

    return md;
  }

  /**
   * Generate scripts handbook
   */
  private generateScriptsHandbook(doc: ComponentDocumentation, fullDoc: EnvironmentDocumentation): string {
    let md = `# Scripts Handbook\n\n`;
    md += `**Total Scripts:** ${doc.totalCount}\n`;
    md += `**Last Updated:** ${doc.metadata.generatedAt.toISOString()}\n\n`;

    md += `---\n\n`;
    md += `## Overview\n\n`;
    md += `This section documents all ${doc.totalCount} scripts available in the Jamf Pro environment. `;
    md += `Each script includes full source code, purpose, parameters, and usage examples.\n\n`;

    md += `---\n\n`;
    md += `## Script Index\n\n`;

    const sortedScripts = [...doc.items].sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    for (const script of sortedScripts) {
      const name = script.name || 'Unnamed';
      const anchor = this.createAnchor(name);
      md += `- [${name}](#${anchor}) (ID: ${script.id})\n`;
    }

    md += `\n---\n\n`;
    md += `## Script Details\n\n`;

    for (const script of sortedScripts) {
      md += this.generateScriptDetail(script, fullDoc);
      md += `\n---\n\n`;
    }

    return md;
  }

  /**
   * Generate detailed script documentation
   */
  private generateScriptDetail(script: any, fullDoc: EnvironmentDocumentation): string {
    const name = script.name || 'Unnamed Script';

    let md = `### ${name}\n\n`;

    md += `#### Basic Information\n\n`;
    md += `| Property | Value |\n`;
    md += `|----------|-------|\n`;
    md += `| **Script ID** | ${script.id || 'N/A'} |\n`;
    md += `| **Category** | ${script.categoryName || script.category?.name || 'Uncategorized'} |\n`;
    md += `| **Priority** | ${script.priority || 'After'} |\n`;
    md += `| **OS Requirements** | ${script.osRequirements || script.os_requirements || 'Any'} |\n\n`;

    if (script.info) {
      md += `#### Purpose\n\n`;
      md += `${script.info}\n\n`;
    }

    if (script.notes) {
      md += `#### Notes\n\n`;
      md += `${script.notes}\n\n`;
    }

    // Parameters
    const params = [];
    for (let i = 4; i <= 11; i++) {
      const paramLabel = script[`parameter${i}`];
      if (paramLabel) {
        params.push({ num: i, label: paramLabel });
      }
    }

    if (params.length > 0) {
      md += `#### Parameters\n\n`;
      md += `This script accepts the following parameters:\n\n`;
      md += `| Parameter | Label/Description |\n`;
      md += `|-----------|-------------------|\n`;
      for (const param of params) {
        md += `| \$${param.num} | ${param.label} |\n`;
      }
      md += `\n`;
    }

    // Find policies that use this script
    const policiesUsingScript = this.findPoliciesUsingScript(script.id, fullDoc);
    if (policiesUsingScript.length > 0) {
      md += `#### Used By\n\n`;
      md += `This script is used by ${policiesUsingScript.length} policy/policies:\n\n`;
      for (const policy of policiesUsingScript) {
        md += `- [${policy.name}](policies-handbook.md#${this.createAnchor(policy.name)}) (ID: ${policy.id})\n`;
      }
      md += `\n`;
    }

    // Script code
    if (script.scriptContents || script.script_contents) {
      md += `#### Script Code\n\n`;
      md += `\`\`\`bash\n`;
      md += script.scriptContents || script.script_contents;
      md += `\n\`\`\`\n\n`;
    }

    return md;
  }

  /**
   * Generate packages handbook
   */
  private generatePackagesHandbook(doc: ComponentDocumentation, fullDoc: EnvironmentDocumentation): string {
    let md = `# Packages Handbook\n\n`;
    md += `**Total Packages:** ${doc.totalCount}\n`;
    md += `**Last Updated:** ${doc.metadata.generatedAt.toISOString()}\n\n`;

    md += `---\n\n`;
    md += `## Package Index\n\n`;
    md += `| ID | Name | Filename | Category | Size |\n`;
    md += `|----|------|----------|----------|------|\n`;

    const sortedPackages = [...doc.items].sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    for (const pkg of sortedPackages) {
      md += `| ${pkg.id || 'N/A'} `;
      md += `| ${pkg.name || 'N/A'} `;
      md += `| ${pkg.filename || pkg.fileName || 'N/A'} `;
      md += `| ${pkg.category || 'None'} `;
      md += `| ${pkg.size || pkg.fileSize || 'N/A'} |\n`;
    }

    return md;
  }

  /**
   * Generate profiles handbook
   */
  private generateProfilesHandbook(doc: ComponentDocumentation, fullDoc: EnvironmentDocumentation): string {
    let md = `# Configuration Profiles Handbook\n\n`;
    md += `**Total Profiles:** ${doc.totalCount}\n`;
    md += `**Last Updated:** ${doc.metadata.generatedAt.toISOString()}\n\n`;

    md += `---\n\n`;

    // Add detailed profile documentation here
    // Similar structure to policies

    return md;
  }

  /**
   * Generate groups handbook
   */
  private generateGroupsHandbook(doc: ComponentDocumentation, fullDoc: EnvironmentDocumentation): string {
    let md = `# Computer Groups Handbook\n\n`;
    md += `**Total Groups:** ${doc.totalCount}\n`;
    md += `**Last Updated:** ${doc.metadata.generatedAt.toISOString()}\n\n`;

    // Separate smart and static groups
    const smartGroups = doc.items.filter((g: any) => g.is_smart);
    const staticGroups = doc.items.filter((g: any) => !g.is_smart);

    md += `---\n\n`;
    md += `## Overview\n\n`;
    md += `- **Smart Groups**: ${smartGroups.length}\n`;
    md += `- **Static Groups**: ${staticGroups.length}\n\n`;

    // Document smart groups with criteria
    if (smartGroups.length > 0) {
      md += `---\n\n`;
      md += `## Smart Groups\n\n`;

      for (const group of smartGroups.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))) {
        md += `### ${group.name}\n\n`;
        md += `**ID:** ${group.id}  \n`;
        md += `**Members:** ${group.memberCount || 0}  \n\n`;

        if (group.criteria && group.criteria.length > 0) {
          md += `#### Membership Criteria\n\n`;
          for (const criterion of group.criteria) {
            md += `- **${criterion.name}** ${criterion.search_type} \`${criterion.value}\`\n`;
            if (criterion.and_or && criterion.and_or !== 'and') {
              md += `  *${criterion.and_or.toUpperCase()}*\n`;
            }
          }
          md += `\n`;
        }

        md += `---\n\n`;
      }
    }

    return md;
  }

  /**
   * Generate master handbook (single file)
   */
  private async generateMasterHandbook(
    documentation: EnvironmentDocumentation,
    handbookDir: string
  ): Promise<void> {
    let master = `# Jamf Pro Environment - Complete Handbook\n\n`;
    master += `**Environment:** ${documentation.overview.jamfUrl}\n`;
    master += `**Generated:** ${documentation.overview.generatedAt.toISOString()}\n\n`;
    master += `---\n\n`;

    // Append each component handbook
    // This creates one massive file that can be exported to PDF

    await fs.writeFile(path.join(handbookDir, 'MASTER-HANDBOOK.md'), master);
  }

  // Helper methods

  private calculateTotalAssets(overview: any): number {
    return (overview.totalComputers || 0) +
           (overview.totalMobileDevices || 0) +
           (overview.totalPolicies || 0) +
           (overview.totalScripts || 0) +
           (overview.totalPackages || 0) +
           (overview.totalConfigurationProfiles || 0) +
           (overview.totalComputerGroups || 0) +
           (overview.totalMobileDeviceGroups || 0);
  }

  private groupByCategory(items: any[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const item of items) {
      const category = item.general?.category?.name || item.category?.name || 'Uncategorized';
      groups[category] = (groups[category] || 0) + 1;
    }
    return groups;
  }

  private createAnchor(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  private findScriptDetails(scriptId: string | number, fullDoc: EnvironmentDocumentation): any {
    const scripts = fullDoc.components.scripts?.items || [];
    return scripts.find((s: any) => s.id == scriptId);
  }

  private findPoliciesUsingScript(scriptId: string | number, fullDoc: EnvironmentDocumentation): any[] {
    const policies = fullDoc.components.policies?.items || [];
    return policies.filter((p: any) => {
      return p.scripts?.some((s: any) => s.id == scriptId);
    }).map((p: any) => ({
      id: p.general?.id || p.id,
      name: p.general?.name || p.name
    }));
  }
}
