#!/usr/bin/env node
/**
 * Standalone CLI Tool for Jamf Environment Documentation
 *
 * Usage:
 *   npm run document:env
 *   npm run document:env -- --output ./my-docs --ai-analysis
 */

import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import { DocumentationGenerator } from '../documentation/generator-enhanced.js';
import { DocumentationOptions } from '../documentation/types.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../server/logger.js';
import { print, printError, printWarn } from './output.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const logger = createLogger('cli-document');

interface CLIOptions {
  output?: string;
  components?: string;
  detailLevel?: 'summary' | 'standard' | 'full';
  formats?: string;
  aiAnalysis?: boolean;
  pageSize?: number;
  help?: boolean;
}

function showUsage() {
  print(`
Jamf Environment Documentation Tool
=====================================

Generate comprehensive documentation for your Jamf Pro environment.

Usage:
  npm run document:env [options]

Options:
  --output <path>         Output directory (default: ./jamf-documentation)
  --components <list>     Comma-separated list of components to document
                          (default: all)
                          Available: computers,mobile-devices,policies,
                                    configuration-profiles,scripts,packages,
                                    computer-groups,mobile-device-groups

  --detail-level <level>  Detail level: summary, standard, full (default: full)
  --formats <list>        Output formats: markdown, json (default: both)
  --ai-analysis           Enable AI-powered analysis and insights
  --page-size <number>    Page size for pagination (default: 100)
  --help                  Show this help message

Environment Variables Required:
  JAMF_URL                Your Jamf Pro URL
  JAMF_CLIENT_ID          Jamf API Client ID
  JAMF_CLIENT_SECRET      Jamf API Client Secret
  ANTHROPIC_API_KEY       (Optional) Claude API key for AI analysis

Examples:
  # Generate full documentation with AI analysis
  npm run document:env -- --ai-analysis

  # Document only policies and scripts
  npm run document:env -- --components policies,scripts

  # Generate markdown only
  npm run document:env -- --formats markdown --output ./docs
`);
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--components':
      case '-c':
        options.components = args[++i];
        break;
      case '--detail-level':
      case '-d':
        options.detailLevel = args[++i] as 'summary' | 'standard' | 'full';
        break;
      case '--formats':
      case '-f':
        options.formats = args[++i];
        break;
      case '--ai-analysis':
      case '--ai':
        options.aiAnalysis = true;
        break;
      case '--page-size':
      case '-p':
        options.pageSize = parseInt(args[++i], 10);
        break;
    }
  }

  return options;
}

async function main() {
  print('\n🚀 Jamf Environment Documentation Tool\n');

  const options = parseArgs();

  if (options.help) {
    showUsage();
    process.exit(0);
  }

  // Validate environment variables
  const requiredEnvVars = ['JAMF_URL', 'JAMF_CLIENT_ID', 'JAMF_CLIENT_SECRET'];
  const missing = requiredEnvVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    printError('❌ Error: Missing required environment variables:');
    missing.forEach((v) => printError(`   - ${v}`));
    printError('\nPlease set these in your .env file or environment.\n');
    process.exit(1);
  }

  if (options.aiAnalysis && !process.env.ANTHROPIC_API_KEY) {
    printWarn('⚠️  Warning: AI analysis requested but ANTHROPIC_API_KEY not set.');
    printWarn('   Continuing without AI analysis.\n');
    options.aiAnalysis = false;
  }

  // Initialize Jamf client
  print('📡 Connecting to Jamf Pro...');
  const jamfClient = new JamfApiClientHybrid({
    baseUrl: process.env.JAMF_URL!,
    clientId: process.env.JAMF_CLIENT_ID!,
    clientSecret: process.env.JAMF_CLIENT_SECRET!,
    username: process.env.JAMF_USERNAME,
    password: process.env.JAMF_PASSWORD,
    readOnlyMode: true,
    rejectUnauthorized: process.env.JAMF_ALLOW_INSECURE === 'true' ? false : true,
  });

  try {
    await jamfClient.testApiAccess();
    print('✅ Connected to Jamf Pro\n');
  } catch (error) {
    printError(`❌ Failed to connect to Jamf Pro: ${error}`);
    process.exit(1);
  }

  // Build documentation options
  const components = options.components
    ? options.components.split(',').map((c) => c.trim())
    : undefined;

  const formats = options.formats ? options.formats.split(',').map((f) => f.trim()) : undefined;

  const docOptions: DocumentationOptions = {
    outputPath: options.output || './jamf-documentation',
    formats: formats as any,
    components: components as any,
    detailLevel: options.detailLevel || 'full',
    includeScriptContent: true,
    includeProfilePayloads: true,
    useAIAnalysis: options.aiAnalysis,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    pageSize: options.pageSize || 100,
  };

  print('⚙️  Configuration:');
  print(`   Output: ${docOptions.outputPath}`);
  print(`   Detail Level: ${docOptions.detailLevel}`);
  print(`   Formats: ${docOptions.formats?.join(', ') || 'markdown, json'}`);
  print(`   Components: ${docOptions.components?.join(', ') || 'all'}`);
  print(`   AI Analysis: ${docOptions.useAIAnalysis ? 'enabled' : 'disabled'}`);
  print(`   Page Size: ${docOptions.pageSize}\n`);

  // Generate documentation
  print('📝 Generating documentation...\n');
  const generator = new DocumentationGenerator(jamfClient);

  const documentation = await generator.generateDocumentation(docOptions);
  const progress = generator.getProgress();

  print('\n✅ Documentation generated successfully!\n');
  print('📊 Summary:');
  print(`   Total Computers: ${documentation.overview.totalComputers}`);
  print(`   Total Mobile Devices: ${documentation.overview.totalMobileDevices}`);
  print(`   Total Policies: ${documentation.overview.totalPolicies}`);
  print(`   Total Profiles: ${documentation.overview.totalConfigurationProfiles}`);
  print(`   Total Scripts: ${documentation.overview.totalScripts}`);
  print(`   Total Packages: ${documentation.overview.totalPackages}`);
  print(`   Components Documented: ${progress.completedComponents.length}`);

  if (progress.errors.length > 0) {
    print(`\n⚠️  Errors encountered: ${progress.errors.length}`);
    progress.errors.forEach((err) => print(`   - ${err}`));
  }

  print(`\n📁 Documentation saved to: ${docOptions.outputPath}`);

  if (documentation.aiAnalysis) {
    print('\n🤖 AI Analysis completed:');
    print(`   ${documentation.aiAnalysis.environmentAnalysis.summary}`);
  }

  print('\n✨ Done!\n');
}

main().catch((error) => {
  printError(`\n❌ Fatal error: ${error}`);
  process.exit(1);
});

export {};
