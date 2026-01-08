/**
 * Generate Environment Documentation Skill
 *
 * Multi-step workflow to document complete Jamf Pro environment
 */

import { JamfApiClientHybrid } from '../../jamf-client-hybrid.js';
import { DocumentationGenerator } from '../../documentation/generator.js';
import { DocumentationOptions, ComponentType } from '../../documentation/types.js';
import { SkillContext, SkillResult } from '../types.js';
import { createLogger } from '../../server/logger.js';

const logger = createLogger('skill-generate-environment-docs');

export interface GenerateEnvironmentDocsInput {
  outputPath?: string;
  formats?: ('markdown' | 'json')[];
  components?: ComponentType[];
  detailLevel?: 'summary' | 'standard' | 'full';
  includeScriptContent?: boolean;
  includeProfilePayloads?: boolean;
}

/**
 * Generate comprehensive Jamf Pro environment documentation
 */
export async function generateEnvironmentDocs(
  context: SkillContext,
  input: GenerateEnvironmentDocsInput
): Promise<SkillResult> {
  logger.info('Starting environment documentation generation', { input });

  // Get the Jamf client from context
  const client = context.client as JamfApiClientHybrid;

  const startTime = Date.now();
  const steps: string[] = [];
  const results: any[] = [];

  try {
    // Step 1: Validate input
    steps.push('Validating input parameters');
    const options: DocumentationOptions = {
      outputPath: input.outputPath || './jamf-documentation',
      formats: input.formats || ['markdown', 'json'],
      components: input.components || [
        'computers',
        'mobile-devices',
        'policies',
        'configuration-profiles',
        'scripts',
        'packages',
        'computer-groups',
        'mobile-device-groups',
      ],
      detailLevel: input.detailLevel || 'full',
      includeScriptContent: input.includeScriptContent !== false,
      includeProfilePayloads: input.includeProfilePayloads !== false,
    };

    results.push({
      step: 'validation',
      status: 'completed',
      data: {
        outputPath: options.outputPath,
        formats: options.formats,
        components: options.components,
        detailLevel: options.detailLevel,
      },
    });

    // Step 2: Initialize documentation generator
    steps.push('Initializing documentation generator');
    const generator = new DocumentationGenerator(client);

    results.push({
      step: 'initialization',
      status: 'completed',
    });

    // Step 3: Generate documentation
    steps.push('Generating documentation for all components');
    logger.info('Generating documentation', { options });

    const documentation = await generator.generateDocumentation(options);

    results.push({
      step: 'generation',
      status: 'completed',
      data: {
        overview: documentation.overview,
        componentsDocumented: Object.keys(documentation.components).length,
      },
    });

    // Step 4: Get final progress
    const progress = generator.getProgress();

    results.push({
      step: 'completion',
      status: 'completed',
      data: {
        progress,
        outputPath: options.outputPath,
      },
    });

    const duration = Date.now() - startTime;

    logger.info('Environment documentation completed', {
      duration,
      components: options.components?.length || 0,
      errors: progress.errors.length,
    });

    return {
      success: true,
      message: `Documentation generated successfully for ${progress.completedComponents.length}/${progress.totalComponents} components`,
      data: {
        overview: documentation.overview,
        progress,
        outputPath: options.outputPath,
        formats: options.formats,
        duration,
        steps: results,
        executionTime: duration,
        itemsProcessed: progress.completedComponents.length,
        errors: progress.errors,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Failed to generate environment documentation', { error });

    return {
      success: false,
      message: `Documentation generation failed: ${error instanceof Error ? error.message : String(error)}`,
      data: {
        steps: results,
        duration,
        executionTime: duration,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// Skill metadata for registration
export const metadata: any = {
  name: 'generate-environment-docs',
  description: 'Generate comprehensive Jamf Pro environment documentation in markdown and JSON formats',
  parameters: {
    outputPath: {
      type: 'string' as const,
      description: 'Output directory path for generated documentation',
      required: false,
      default: './jamf-documentation',
    },
    formats: {
      type: 'array' as const,
      description: 'Output formats to generate (markdown, json, or both)',
      required: false,
      default: ['markdown', 'json'],
    },
    components: {
      type: 'array' as const,
      description: 'Specific components to document',
      required: false,
    },
    detailLevel: {
      type: 'string' as const,
      enum: ['summary', 'standard', 'full'],
      description: 'Level of detail to include in documentation',
      required: false,
      default: 'full',
    },
    includeScriptContent: {
      type: 'boolean' as const,
      description: 'Include full script content in documentation',
      required: false,
      default: true,
    },
    includeProfilePayloads: {
      type: 'boolean' as const,
      description: 'Include configuration profile payload details',
      required: false,
      default: true,
    },
  },
  examples: [
    {
      description: 'Generate complete environment documentation with all components',
      params: {},
    },
    {
      description: 'Generate markdown documentation for policies and scripts only',
      params: {
        components: ['policies', 'scripts'],
        formats: ['markdown'],
      },
    },
    {
      description: 'Generate summary documentation for devices only',
      params: {
        detailLevel: 'summary',
        components: ['computers', 'mobile-devices'],
      },
    },
  ],
};
