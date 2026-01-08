/**
 * Enhanced Documentation Generator with AI Analysis and Pagination
 * Extends the base generator with intelligent insights and efficient data fetching
 */

import { DocumentationGenerator } from './generator.js';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import {
  DocumentationOptions,
  EnvironmentDocumentation,
  ComponentDocumentation,
  ComponentType,
} from './types.js';
import { ClaudeAIClient } from '../cli/ai-client.js';
import { createLogger } from '../server/logger.js';

const logger = createLogger('documentation-generator-enhanced');

export { DocumentationGenerator };

export class EnhancedDocumentationGenerator extends DocumentationGenerator {
  private aiClient?: ClaudeAIClient;
  private pageSize: number;

  constructor(jamfClient: JamfApiClientHybrid, aiClient?: ClaudeAIClient) {
    super(jamfClient);
    this.aiClient = aiClient;
    this.pageSize = 100;
  }

  /**
   * Generate documentation with AI analysis
   */
  async generateDocumentation(options: DocumentationOptions = {}): Promise<EnvironmentDocumentation> {
    this.pageSize = options.pageSize || 100;

    // Initialize AI client if enabled
    if (options.useAIAnalysis && !this.aiClient) {
      try {
        this.aiClient = new ClaudeAIClient(options.anthropicApiKey);
        logger.info('AI analysis enabled');
      } catch (error) {
        logger.warn('AI client initialization failed, continuing without AI analysis', { error });
      }
    }

    // Generate base documentation
    const documentation = await super.generateDocumentation(options);

    // Add AI analysis if enabled
    if (this.aiClient && options.useAIAnalysis) {
      logger.info('Generating AI analysis...');
      documentation.aiAnalysis = await this.generateAIAnalysis(documentation);
    }

    return documentation;
  }

  /**
   * Generate comprehensive AI analysis
   */
  private async generateAIAnalysis(
    documentation: EnvironmentDocumentation
  ): Promise<EnvironmentDocumentation['aiAnalysis']> {
    if (!this.aiClient) {
      return undefined;
    }

    try {
      logger.info('Analyzing environment with AI...');

      // Environment-level analysis
      const environmentAnalysis = await this.aiClient.analyzeEnvironment({
        totalComputers: documentation.overview.totalComputers,
        totalMobileDevices: documentation.overview.totalMobileDevices,
        totalPolicies: documentation.overview.totalPolicies,
        totalProfiles: documentation.overview.totalConfigurationProfiles,
        totalScripts: documentation.overview.totalScripts,
        totalPackages: documentation.overview.totalPackages,
        components: documentation.components,
      });

      // Security analysis
      let securityAnalysis;
      if (documentation.components.policies && documentation.components['configuration-profiles']) {
        logger.info('Performing security analysis...');
        securityAnalysis = await this.aiClient.analyzeSecurityPosture({
          policies: documentation.components.policies.items,
          profiles: documentation.components['configuration-profiles']?.items || [],
          devices: [
            ...(documentation.components.computers?.items || []),
            ...(documentation.components['mobile-devices']?.items || []),
          ],
        });
      }

      // Strategic recommendations
      logger.info('Generating strategic recommendations...');
      const recommendations = await this.aiClient.generateRecommendations(
        documentation.overview,
        documentation.components
      );

      return {
        environmentAnalysis,
        securityAnalysis,
        recommendations,
      };
    } catch (error) {
      logger.error('AI analysis failed', { error });
      return undefined;
    }
  }

  /**
   * Override component documentation to add AI analysis per component
   */
  protected async documentComponentWithAI(
    component: ComponentType,
    items: any[]
  ): Promise<ComponentDocumentation> {
    const componentDoc: ComponentDocumentation = {
      component,
      totalCount: items.length,
      items,
      metadata: {
        generatedAt: new Date(),
        jamfUrl: (this.jamfClient as any).config.baseUrl,
        detailLevel: 'full',
      },
    };

    // Add AI analysis if available
    if (this.aiClient && items.length > 0) {
      try {
        logger.info(`Analyzing ${component} with AI...`);
        componentDoc.aiAnalysis = await this.aiClient.analyzeComponent(component, items);
      } catch (error) {
        logger.warn(`AI analysis failed for ${component}`, { error });
      }
    }

    return componentDoc;
  }
}
