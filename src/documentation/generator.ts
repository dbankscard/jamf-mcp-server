/**
 * Documentation Generator
 * Core service for generating comprehensive Jamf Pro environment documentation
 */

import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import {
  DocumentationOptions,
  DocumentationProgress,
  ComponentType,
  ComponentDocumentation,
  EnvironmentDocumentation,
} from './types.js';
import { createLogger } from '../server/logger.js';
import { HandbookGenerator } from './handbook-generator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = createLogger('documentation-generator');

export class DocumentationGenerator {
  protected jamfClient: JamfApiClientHybrid;
  private progress: DocumentationProgress;

  constructor(jamfClient: JamfApiClientHybrid) {
    this.jamfClient = jamfClient;
    this.progress = {
      status: 'pending',
      completedComponents: [],
      totalComponents: 0,
      errors: [],
    };
  }

  /**
   * Generate complete environment documentation
   */
  async generateDocumentation(options: DocumentationOptions = {}): Promise<EnvironmentDocumentation> {
    const {
      outputPath = './jamf-documentation',
      formats = ['markdown', 'json'],
      components = [
        'computers',
        'mobile-devices',
        'policies',
        'configuration-profiles',
        'scripts',
        'packages',
        'computer-groups',
        'mobile-device-groups',
      ],
      detailLevel = 'full',
      includeScriptContent = true,
      includeProfilePayloads = true,
    } = options;

    this.progress = {
      status: 'in_progress',
      completedComponents: [],
      totalComponents: components.length,
      startTime: new Date(),
      errors: [],
      outputPath,
    };

    logger.info('Starting documentation generation', {
      components,
      formats,
      detailLevel,
    });

    const documentation: EnvironmentDocumentation = {
      overview: {
        jamfUrl: (this.jamfClient as any).config.baseUrl,
        generatedAt: new Date(),
        generatedBy: 'jamf-mcp-server',
        totalComputers: 0,
        totalMobileDevices: 0,
        totalPolicies: 0,
        totalConfigurationProfiles: 0,
        totalScripts: 0,
        totalPackages: 0,
        totalComputerGroups: 0,
        totalMobileDeviceGroups: 0,
      },
      components: {},
    };

    // Generate documentation for each component
    for (const component of components) {
      try {
        this.progress.currentComponent = component;
        logger.info(`Documenting ${component}...`);

        const componentDoc = await this.documentComponent(component, {
          detailLevel,
          includeScriptContent,
          includeProfilePayloads,
        });

        documentation.components[component] = componentDoc;
        this.updateOverview(documentation.overview, component, componentDoc);
        this.progress.completedComponents.push(component);

        logger.info(`Completed ${component}: ${componentDoc.totalCount} items`);
      } catch (error) {
        const errorMessage = `Failed to document ${component}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMessage, { error });
        this.progress.errors.push(errorMessage);
      }
    }

    this.progress.status = this.progress.errors.length > 0 ? 'completed' : 'completed';
    this.progress.endTime = new Date();

    // Write documentation files
    if (formats.includes('json') || formats.includes('markdown')) {
      await this.writeDocumentation(documentation, outputPath, formats);
    }

    // Generate comprehensive handbook
    if (formats.includes('markdown')) {
      await this.generateHandbook(documentation, outputPath);
    }

    logger.info('Documentation generation completed', {
      totalComponents: components.length,
      completed: this.progress.completedComponents.length,
      errors: this.progress.errors.length,
    });

    return documentation;
  }

  /**
   * Document a specific component
   */
  private async documentComponent(
    component: ComponentType,
    options: { detailLevel: string; includeScriptContent: boolean; includeProfilePayloads: boolean }
  ): Promise<ComponentDocumentation> {
    let items: any[] = [];

    try {
      switch (component) {
        case 'computers':
          items = await this.documentComputers(options);
          break;
        case 'mobile-devices':
          items = await this.documentMobileDevices(options);
          break;
        case 'policies':
          items = await this.documentPolicies(options);
          break;
        case 'configuration-profiles':
          items = await this.documentConfigurationProfiles(options);
          break;
        case 'scripts':
          items = await this.documentScripts(options);
          break;
        case 'packages':
          items = await this.documentPackages(options);
          break;
        case 'computer-groups':
          items = await this.documentComputerGroups(options);
          break;
        case 'mobile-device-groups':
          items = await this.documentMobileDeviceGroups(options);
          break;
        default:
          throw new Error(`Unknown component type: ${component}`);
      }

      // Filter out any null/undefined items
      items = items.filter(item => item != null);
    } catch (error) {
      logger.error(`Error fetching ${component} data`, { error });
      // Return empty array if component fetch fails
      items = [];
    }

    return {
      component,
      totalCount: items.length,
      items,
      metadata: {
        generatedAt: new Date(),
        jamfUrl: (this.jamfClient as any).config.baseUrl,
        detailLevel: options.detailLevel,
      },
    };
  }

  /**
   * Document computers
   */
  private async documentComputers(options: any): Promise<any[]> {
    const computers = await this.jamfClient.searchComputers('');

    if (options.detailLevel === 'full') {
      const detailed = [];
      for (const computer of computers) {
        try {
          const details = await this.jamfClient.getComputerDetails(computer.id.toString());
          detailed.push(details);
        } catch (error) {
          logger.warn(`Failed to get details for computer ${computer.id}`, { error });
          detailed.push(computer);
        }
      }
      return detailed;
    }

    return computers;
  }

  /**
   * Document mobile devices
   */
  private async documentMobileDevices(options: any): Promise<any[]> {
    const devices = await this.jamfClient.listMobileDevices(10000);

    if (options.detailLevel === 'full') {
      const detailed = [];
      for (const device of devices) {
        try {
          const details = await this.jamfClient.getMobileDeviceDetails(device.id.toString());
          detailed.push(details);
        } catch (error) {
          logger.warn(`Failed to get details for mobile device ${device.id}`, { error });
          detailed.push(device);
        }
      }
      return detailed;
    }

    return devices;
  }

  /**
   * Document policies
   */
  private async documentPolicies(options: any): Promise<any[]> {
    const policies = await this.jamfClient.listPolicies(10000);

    if (options.detailLevel === 'full') {
      const detailed = [];
      for (const policy of policies) {
        try {
          const details = await this.jamfClient.getPolicyDetails(policy.id.toString());
          detailed.push(details);
        } catch (error) {
          logger.warn(`Failed to get details for policy ${policy.id}`, { error });
          detailed.push(policy);
        }
      }
      return detailed;
    }

    return policies;
  }

  /**
   * Document configuration profiles
   */
  private async documentConfigurationProfiles(options: any): Promise<any[]> {
    const computerProfiles = await this.jamfClient.listConfigurationProfiles('computer');
    const mobileProfiles = await this.jamfClient.listConfigurationProfiles('mobiledevice');

    const allProfiles = [
      ...computerProfiles.map((p: any) => ({ ...p, deviceType: 'computer' })),
      ...mobileProfiles.map((p: any) => ({ ...p, deviceType: 'mobile' })),
    ];

    if (options.detailLevel === 'full') {
      const detailed = [];
      for (const profile of allProfiles) {
        try {
          const details = await this.jamfClient.getConfigurationProfileDetails(
            profile.id.toString(),
            profile.deviceType
          );
          detailed.push(details);
        } catch (error) {
          logger.warn(`Failed to get details for profile ${profile.id}`, { error });
          detailed.push(profile);
        }
      }
      return detailed;
    }

    return allProfiles;
  }

  /**
   * Document scripts
   */
  private async documentScripts(options: any): Promise<any[]> {
    const scripts = await this.jamfClient.listScripts(10000);

    if (options.detailLevel === 'full' && options.includeScriptContent) {
      const detailed = [];
      for (const script of scripts) {
        try {
          const details = await this.jamfClient.getScriptDetails(script.id.toString());
          detailed.push(details);
        } catch (error) {
          logger.warn(`Failed to get details for script ${script.id}`, { error });
          detailed.push(script);
        }
      }
      return detailed;
    }

    return scripts;
  }

  /**
   * Document packages
   */
  private async documentPackages(options: any): Promise<any[]> {
    const packages = await this.jamfClient.listPackages(10000);

    if (options.detailLevel === 'full') {
      const detailed = [];
      for (const pkg of packages) {
        try {
          const details = await this.jamfClient.getPackageDetails(pkg.id.toString());
          detailed.push(details);
        } catch (error) {
          logger.warn(`Failed to get details for package ${pkg.id}`, { error });
          detailed.push(pkg);
        }
      }
      return detailed;
    }

    return packages;
  }

  /**
   * Document computer groups
   */
  private async documentComputerGroups(options: any): Promise<any[]> {
    const groups = await this.jamfClient.listComputerGroups('all');

    if (options.detailLevel === 'full') {
      const detailed = [];
      for (const group of groups) {
        try {
          const details = await this.jamfClient.getComputerGroupDetails(group.id.toString());
          detailed.push(details);
        } catch (error) {
          logger.warn(`Failed to get details for group ${group.id}`, { error });
          detailed.push(group);
        }
      }
      return detailed;
    }

    return groups;
  }

  /**
   * Document mobile device groups
   */
  private async documentMobileDeviceGroups(options: any): Promise<any[]> {
    const groups = await this.jamfClient.getMobileDeviceGroups('all');

    if (options.detailLevel === 'full') {
      const detailed = [];
      for (const group of groups) {
        try {
          const details = await this.jamfClient.getMobileDeviceGroupDetails(group.id.toString());
          detailed.push(details);
        } catch (error) {
          logger.warn(`Failed to get details for mobile device group ${group.id}`, { error });
          detailed.push(group);
        }
      }
      return detailed;
    }

    return groups;
  }

  /**
   * Update overview statistics
   */
  private updateOverview(
    overview: EnvironmentDocumentation['overview'],
    component: ComponentType,
    doc: ComponentDocumentation
  ): void {
    switch (component) {
      case 'computers':
        overview.totalComputers = doc.totalCount;
        break;
      case 'mobile-devices':
        overview.totalMobileDevices = doc.totalCount;
        break;
      case 'policies':
        overview.totalPolicies = doc.totalCount;
        break;
      case 'configuration-profiles':
        overview.totalConfigurationProfiles = doc.totalCount;
        break;
      case 'scripts':
        overview.totalScripts = doc.totalCount;
        break;
      case 'packages':
        overview.totalPackages = doc.totalCount;
        break;
      case 'computer-groups':
        overview.totalComputerGroups = doc.totalCount;
        break;
      case 'mobile-device-groups':
        overview.totalMobileDeviceGroups = doc.totalCount;
        break;
    }
  }

  /**
   * Write documentation to files
   */
  private async writeDocumentation(
    documentation: EnvironmentDocumentation,
    outputPath: string,
    formats: ('markdown' | 'json')[]
  ): Promise<void> {
    // Create output directories
    await fs.mkdir(outputPath, { recursive: true });

    if (formats.includes('json')) {
      await fs.mkdir(path.join(outputPath, 'data'), { recursive: true });
    }

    if (formats.includes('markdown')) {
      await fs.mkdir(path.join(outputPath, 'markdown'), { recursive: true });
    }

    // Write overview
    if (formats.includes('markdown')) {
      await this.writeOverviewMarkdown(documentation, outputPath);
    }

    // Write component documentation
    for (const [componentType, componentDoc] of Object.entries(documentation.components)) {
      if (!componentDoc) continue;

      if (formats.includes('json')) {
        await this.writeComponentJSON(componentType as ComponentType, componentDoc, outputPath);
      }

      if (formats.includes('markdown')) {
        await this.writeComponentMarkdown(componentType as ComponentType, componentDoc, outputPath);
      }
    }

    // Write full JSON documentation
    if (formats.includes('json')) {
      const sanitizedDoc = this.sanitizeForJSON(documentation);
      await fs.writeFile(
        path.join(outputPath, 'data', 'complete-environment.json'),
        JSON.stringify(sanitizedDoc, null, 2)
      );
    }

    logger.info(`Documentation written to ${outputPath}`);
  }

  /**
   * Write overview markdown
   */
  private async writeOverviewMarkdown(
    documentation: EnvironmentDocumentation,
    outputPath: string
  ): Promise<void> {
    const { overview } = documentation;
    const markdown = `# Jamf Pro Environment Documentation

**Generated:** ${overview.generatedAt.toISOString()}
**Jamf Instance:** ${overview.jamfUrl}
**Generated By:** ${overview.generatedBy}

## Overview Statistics

| Component | Count |
|-----------|-------|
| Computers | ${overview.totalComputers} |
| Mobile Devices | ${overview.totalMobileDevices} |
| Policies | ${overview.totalPolicies} |
| Configuration Profiles | ${overview.totalConfigurationProfiles} |
| Scripts | ${overview.totalScripts} |
| Packages | ${overview.totalPackages} |
| Computer Groups | ${overview.totalComputerGroups} |
| Mobile Device Groups | ${overview.totalMobileDeviceGroups} |

## Documentation Files

### JSON Data
- [Complete Environment](data/complete-environment.json)
${Object.keys(documentation.components).map(c => `- [${this.formatComponentName(c as ComponentType)}](data/${c}.json)`).join('\n')}

### Markdown Documentation
${Object.keys(documentation.components).map(c => `- [${this.formatComponentName(c as ComponentType)}](markdown/${c}.md)`).join('\n')}

---
*This documentation was automatically generated by jamf-mcp-server*
`;

    await fs.writeFile(path.join(outputPath, 'README.md'), markdown);
  }

  /**
   * Write component JSON
   */
  private async writeComponentJSON(
    component: ComponentType,
    doc: ComponentDocumentation,
    outputPath: string
  ): Promise<void> {
    const filePath = path.join(outputPath, 'data', `${component}.json`);

    // Sanitize data to remove circular references
    const sanitizedDoc = this.sanitizeForJSON(doc);

    await fs.writeFile(filePath, JSON.stringify(sanitizedDoc, null, 2));
  }

  /**
   * Sanitize object for JSON serialization (remove circular references)
   */
  private sanitizeForJSON(obj: any): any {
    const seen = new WeakSet();

    return JSON.parse(
      JSON.stringify(obj, (key, value) => {
        // Remove circular references
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }

        // Remove error objects and axios-specific properties
        if (key === 'request' || key === 'response' || key === 'config') {
          return undefined;
        }

        return value;
      })
    );
  }

  /**
   * Write component markdown
   */
  private async writeComponentMarkdown(
    component: ComponentType,
    doc: ComponentDocumentation,
    outputPath: string
  ): Promise<void> {
    const markdown = this.generateComponentMarkdown(component, doc);
    const filePath = path.join(outputPath, 'markdown', `${component}.md`);
    await fs.writeFile(filePath, markdown);
  }

  /**
   * Generate markdown for a component
   */
  private generateComponentMarkdown(component: ComponentType, doc: ComponentDocumentation): string {
    const title = this.formatComponentName(component);
    let markdown = `# ${title}\n\n`;
    markdown += `**Total Count:** ${doc.totalCount}  \n`;
    markdown += `**Generated:** ${doc.metadata.generatedAt.toISOString()}  \n`;
    markdown += `**Detail Level:** ${doc.metadata.detailLevel}  \n\n`;

    if (doc.totalCount === 0) {
      markdown += `*No ${title.toLowerCase()} found in this environment.*\n`;
      return markdown;
    }

    markdown += `## Items\n\n`;

    // Generate tables or lists based on component type
    switch (component) {
      case 'computers':
        markdown += this.generateComputersMarkdown(doc.items);
        break;
      case 'mobile-devices':
        markdown += this.generateMobileDevicesMarkdown(doc.items);
        break;
      case 'policies':
        markdown += this.generatePoliciesMarkdown(doc.items);
        break;
      case 'configuration-profiles':
        markdown += this.generateProfilesMarkdown(doc.items);
        break;
      case 'scripts':
        markdown += this.generateScriptsMarkdown(doc.items);
        break;
      case 'packages':
        markdown += this.generatePackagesMarkdown(doc.items);
        break;
      case 'computer-groups':
      case 'mobile-device-groups':
        markdown += this.generateGroupsMarkdown(doc.items);
        break;
    }

    return markdown;
  }

  private generateComputersMarkdown(computers: any[]): string {
    let md = '| ID | Name | Serial Number | Model | OS Version | Last Contact |\n';
    md += '|----|------|---------------|-------|------------|-------------|\n';

    for (const computer of computers) {
      const general = computer.general || computer.computer?.general || {};
      md += `| ${general.id || computer.id || 'N/A'} `;
      md += `| ${general.name || computer.name || 'N/A'} `;
      md += `| ${general.serialNumber || general.serial_number || computer.serialNumber || 'N/A'} `;
      md += `| ${general.model || computer.model || 'N/A'} `;
      md += `| ${general.operatingSystem || general.os_version || computer.osVersion || 'N/A'} `;
      md += `| ${general.lastContactTime || general.last_contact_time || computer.lastContactTime || 'N/A'} |\n`;
    }

    return md;
  }

  private generateMobileDevicesMarkdown(devices: any[]): string {
    let md = '| ID | Name | Serial Number | Model | OS Version | Last Inventory |\n';
    md += '|----|------|---------------|-------|------------|----------------|\n';

    for (const device of devices) {
      const general = device.general || device.mobile_device?.general || {};
      md += `| ${general.id || device.id || 'N/A'} `;
      md += `| ${general.name || device.name || 'N/A'} `;
      md += `| ${general.serialNumber || general.serial_number || device.serialNumber || 'N/A'} `;
      md += `| ${general.model || device.model || 'N/A'} `;
      md += `| ${general.osVersion || general.os_version || device.osVersion || 'N/A'} `;
      md += `| ${general.lastInventoryUpdate || general.last_inventory_update || device.lastInventoryUpdate || 'N/A'} |\n`;
    }

    return md;
  }

  private generatePoliciesMarkdown(policies: any[]): string {
    let md = '';

    for (const policy of policies) {
      const general = policy.general || policy.policy?.general || {};
      md += `### ${general.name || policy.name || 'Unnamed Policy'}\n\n`;
      md += `**ID:** ${general.id || policy.id || 'N/A'}  \n`;
      md += `**Enabled:** ${general.enabled !== undefined ? general.enabled : 'N/A'}  \n`;
      md += `**Category:** ${general.category?.name || 'None'}  \n`;
      md += `**Trigger:** ${general.trigger || 'N/A'}  \n`;
      md += `**Frequency:** ${general.frequency || 'N/A'}  \n\n`;

      if (policy.scope) {
        md += `**Scope:**\n`;
        md += `- All Computers: ${policy.scope.all_computers || false}\n`;
        if (policy.scope.computers?.length) {
          md += `- Computers: ${policy.scope.computers.length}\n`;
        }
        if (policy.scope.computer_groups?.length) {
          md += `- Computer Groups: ${policy.scope.computer_groups.length}\n`;
        }
      }

      md += '\n---\n\n';
    }

    return md;
  }

  private generateProfilesMarkdown(profiles: any[]): string {
    let md = '';

    for (const profile of profiles) {
      const general = profile.general || profile.configuration_profile?.general || {};
      md += `### ${general.name || profile.name || 'Unnamed Profile'}\n\n`;
      md += `**ID:** ${general.id || profile.id || 'N/A'}  \n`;
      md += `**Device Type:** ${profile.deviceType || 'N/A'}  \n`;
      md += `**Level:** ${general.level || 'N/A'}  \n`;
      md += `**Category:** ${general.category?.name || 'None'}  \n`;
      md += `**Distribution Method:** ${general.distribution_method || 'N/A'}  \n\n`;

      if (profile.scope) {
        md += `**Scope:**\n`;
        md += `- All Computers: ${profile.scope.all_computers || false}\n`;
        md += `- All Mobile Devices: ${profile.scope.all_mobile_devices || false}\n`;
      }

      md += '\n---\n\n';
    }

    return md;
  }

  private generateScriptsMarkdown(scripts: any[]): string {
    let md = '';

    for (const script of scripts) {
      md += `### ${script.name || 'Unnamed Script'}\n\n`;
      md += `**ID:** ${script.id || 'N/A'}  \n`;
      md += `**Category:** ${script.category?.name || script.category || 'None'}  \n`;
      md += `**Priority:** ${script.priority || 'N/A'}  \n`;
      md += `**OS Requirements:** ${script.os_requirements || 'Any'}  \n\n`;

      if (script.script_contents || script.scriptContents) {
        md += '**Script Content:**\n```bash\n';
        md += script.script_contents || script.scriptContents || '';
        md += '\n```\n\n';
      }

      md += '---\n\n';
    }

    return md;
  }

  private generatePackagesMarkdown(packages: any[]): string {
    let md = '| ID | Name | Filename | Category | Size |\n';
    md += '|----|------|----------|----------|------|\n';

    for (const pkg of packages) {
      md += `| ${pkg.id || 'N/A'} `;
      md += `| ${pkg.name || 'N/A'} `;
      md += `| ${pkg.filename || pkg.fileName || 'N/A'} `;
      md += `| ${pkg.category || 'None'} `;
      md += `| ${pkg.size || pkg.fileSize || 'N/A'} |\n`;
    }

    return md;
  }

  private generateGroupsMarkdown(groups: any[]): string {
    let md = '';

    for (const group of groups) {
      md += `### ${group.name || 'Unnamed Group'}\n\n`;
      md += `**ID:** ${group.id || 'N/A'}  \n`;
      md += `**Type:** ${group.is_smart || group.isSmart ? 'Smart Group' : 'Static Group'}  \n`;

      if (group.computers?.length || group.computers?.size) {
        md += `**Member Count:** ${group.computers.length || group.computers.size || 0}  \n`;
      } else if (group.mobile_devices?.length || group.mobile_devices?.size) {
        md += `**Member Count:** ${group.mobile_devices.length || group.mobile_devices.size || 0}  \n`;
      }

      md += '\n---\n\n';
    }

    return md;
  }

  /**
   * Generate comprehensive handbook
   */
  protected async generateHandbook(
    documentation: EnvironmentDocumentation,
    outputPath: string
  ): Promise<void> {
    try {
      const handbookGen = new HandbookGenerator();
      await handbookGen.generateHandbook(documentation, outputPath);
      logger.info('Comprehensive handbook generated');
    } catch (error) {
      logger.warn('Failed to generate handbook', { error });
    }
  }

  /**
   * Format component name for display
   */
  private formatComponentName(component: ComponentType): string {
    return component
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get current progress
   */
  getProgress(): DocumentationProgress {
    return { ...this.progress };
  }
}
