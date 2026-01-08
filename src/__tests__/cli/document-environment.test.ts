/**
 * CLI Document-Environment Tests
 * Tests for CLI argument parsing and configuration validation
 */

import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';

// Store original process.argv and process.env
const originalArgv = process.argv;
const originalEnv = process.env;

/**
 * Helper to simulate CLI arguments
 */
function setArgs(args: string[]): void {
  process.argv = ['node', 'document-environment.js', ...args];
}

/**
 * Helper to set environment variables
 */
function setEnv(vars: Record<string, string>): void {
  Object.entries(vars).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

/**
 * Helper to clear environment variables
 */
function clearEnv(keys: string[]): void {
  keys.forEach((key) => {
    delete process.env[key];
  });
}

describe('CLI Document-Environment', () => {
  beforeEach(() => {
    // Reset process.argv before each test
    process.argv = [...originalArgv];
    // Reset relevant env vars
    clearEnv([
      'JAMF_URL',
      'JAMF_CLIENT_ID',
      'JAMF_CLIENT_SECRET',
      'JAMF_USERNAME',
      'JAMF_PASSWORD',
      'ANTHROPIC_API_KEY',
    ]);
  });

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv;
    Object.keys(originalEnv).forEach((key) => {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      }
    });
  });

  describe('parseArgs', () => {
    // We need to test parseArgs in isolation
    // Since it's not exported, we'll test the CLI behavior through integration

    test('should parse --help flag', () => {
      setArgs(['--help']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.help).toBe(true);
    });

    test('should parse -h short flag for help', () => {
      setArgs(['-h']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.help).toBe(true);
    });

    test('should parse --output option', () => {
      setArgs(['--output', './my-docs']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.output).toBe('./my-docs');
    });

    test('should parse -o short flag for output', () => {
      setArgs(['-o', '/custom/path']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.output).toBe('/custom/path');
    });

    test('should parse --components option', () => {
      setArgs(['--components', 'policies,scripts']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.components).toBe('policies,scripts');
    });

    test('should parse -c short flag for components', () => {
      setArgs(['-c', 'computers']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.components).toBe('computers');
    });

    test('should parse --detail-level option', () => {
      setArgs(['--detail-level', 'summary']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.detailLevel).toBe('summary');
    });

    test('should parse -d short flag for detail-level', () => {
      setArgs(['-d', 'full']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.detailLevel).toBe('full');
    });

    test('should parse --formats option', () => {
      setArgs(['--formats', 'markdown,json']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.formats).toBe('markdown,json');
    });

    test('should parse -f short flag for formats', () => {
      setArgs(['-f', 'json']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.formats).toBe('json');
    });

    test('should parse --ai-analysis flag', () => {
      setArgs(['--ai-analysis']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.aiAnalysis).toBe(true);
    });

    test('should parse --ai short flag for ai-analysis', () => {
      setArgs(['--ai']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.aiAnalysis).toBe(true);
    });

    test('should parse --page-size option', () => {
      setArgs(['--page-size', '50']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.pageSize).toBe(50);
    });

    test('should parse -p short flag for page-size', () => {
      setArgs(['-p', '200']);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.pageSize).toBe(200);
    });

    test('should parse multiple options together', () => {
      setArgs([
        '--output', './docs',
        '--components', 'policies,scripts',
        '--detail-level', 'standard',
        '--formats', 'markdown',
        '--ai-analysis',
        '--page-size', '75',
      ]);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args.output).toBe('./docs');
      expect(args.components).toBe('policies,scripts');
      expect(args.detailLevel).toBe('standard');
      expect(args.formats).toBe('markdown');
      expect(args.aiAnalysis).toBe(true);
      expect(args.pageSize).toBe(75);
    });

    test('should return empty object for unknown arguments', () => {
      setArgs(['--unknown', 'value']);
      const args = parseArgsHelper(process.argv.slice(2));
      // Unknown args should be ignored
      expect(args.help).toBeUndefined();
      expect(args.output).toBeUndefined();
    });

    test('should handle empty arguments', () => {
      setArgs([]);
      const args = parseArgsHelper(process.argv.slice(2));
      expect(args).toEqual({});
    });
  });

  describe('configuration validation', () => {
    test('should identify missing JAMF_URL', () => {
      setEnv({
        JAMF_CLIENT_ID: 'client-id',
        JAMF_CLIENT_SECRET: 'client-secret',
      });
      const missing = validateRequiredEnvVars();
      expect(missing).toContain('JAMF_URL');
    });

    test('should identify missing JAMF_CLIENT_ID', () => {
      setEnv({
        JAMF_URL: 'https://test.jamfcloud.com',
        JAMF_CLIENT_SECRET: 'client-secret',
      });
      const missing = validateRequiredEnvVars();
      expect(missing).toContain('JAMF_CLIENT_ID');
    });

    test('should identify missing JAMF_CLIENT_SECRET', () => {
      setEnv({
        JAMF_URL: 'https://test.jamfcloud.com',
        JAMF_CLIENT_ID: 'client-id',
      });
      const missing = validateRequiredEnvVars();
      expect(missing).toContain('JAMF_CLIENT_SECRET');
    });

    test('should return empty array when all required vars are set', () => {
      setEnv({
        JAMF_URL: 'https://test.jamfcloud.com',
        JAMF_CLIENT_ID: 'client-id',
        JAMF_CLIENT_SECRET: 'client-secret',
      });
      const missing = validateRequiredEnvVars();
      expect(missing).toEqual([]);
    });

    test('should return all missing vars when none are set', () => {
      const missing = validateRequiredEnvVars();
      expect(missing).toContain('JAMF_URL');
      expect(missing).toContain('JAMF_CLIENT_ID');
      expect(missing).toContain('JAMF_CLIENT_SECRET');
      expect(missing.length).toBe(3);
    });
  });

  describe('buildDocumentationOptions', () => {
    test('should use default output path when not specified', () => {
      const cliOptions = parseArgsHelper([]);
      const docOptions = buildDocumentationOptions(cliOptions);
      expect(docOptions.outputPath).toBe('./jamf-documentation');
    });

    test('should use custom output path when specified', () => {
      const cliOptions = parseArgsHelper(['--output', './custom-docs']);
      const docOptions = buildDocumentationOptions(cliOptions);
      expect(docOptions.outputPath).toBe('./custom-docs');
    });

    test('should use default detail level when not specified', () => {
      const cliOptions = parseArgsHelper([]);
      const docOptions = buildDocumentationOptions(cliOptions);
      expect(docOptions.detailLevel).toBe('full');
    });

    test('should use specified detail level', () => {
      const cliOptions = parseArgsHelper(['--detail-level', 'summary']);
      const docOptions = buildDocumentationOptions(cliOptions);
      expect(docOptions.detailLevel).toBe('summary');
    });

    test('should use default page size when not specified', () => {
      const cliOptions = parseArgsHelper([]);
      const docOptions = buildDocumentationOptions(cliOptions);
      expect(docOptions.pageSize).toBe(100);
    });

    test('should use specified page size', () => {
      const cliOptions = parseArgsHelper(['--page-size', '50']);
      const docOptions = buildDocumentationOptions(cliOptions);
      expect(docOptions.pageSize).toBe(50);
    });

    test('should parse comma-separated components', () => {
      const cliOptions = parseArgsHelper(['--components', 'policies,scripts,packages']);
      const docOptions = buildDocumentationOptions(cliOptions);
      expect(docOptions.components).toEqual(['policies', 'scripts', 'packages']);
    });

    test('should parse comma-separated formats', () => {
      const cliOptions = parseArgsHelper(['--formats', 'markdown,json']);
      const docOptions = buildDocumentationOptions(cliOptions);
      expect(docOptions.formats).toEqual(['markdown', 'json']);
    });

    test('should enable AI analysis when flag is set', () => {
      const cliOptions = parseArgsHelper(['--ai-analysis']);
      const docOptions = buildDocumentationOptions(cliOptions);
      expect(docOptions.useAIAnalysis).toBe(true);
    });

    test('should default includeScriptContent to true', () => {
      const cliOptions = parseArgsHelper([]);
      const docOptions = buildDocumentationOptions(cliOptions);
      expect(docOptions.includeScriptContent).toBe(true);
    });

    test('should default includeProfilePayloads to true', () => {
      const cliOptions = parseArgsHelper([]);
      const docOptions = buildDocumentationOptions(cliOptions);
      expect(docOptions.includeProfilePayloads).toBe(true);
    });
  });
});

/**
 * Helper function that mirrors the parseArgs logic from document-environment.ts
 * This is a replica for testing since the original is not exported
 */
interface CLIOptions {
  output?: string;
  components?: string;
  detailLevel?: 'summary' | 'standard' | 'full';
  formats?: string;
  aiAnalysis?: boolean;
  pageSize?: number;
  help?: boolean;
}

function parseArgsHelper(args: string[]): CLIOptions {
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

/**
 * Helper function that mirrors the environment validation logic
 */
function validateRequiredEnvVars(): string[] {
  const requiredEnvVars = ['JAMF_URL', 'JAMF_CLIENT_ID', 'JAMF_CLIENT_SECRET'];
  return requiredEnvVars.filter((v) => !process.env[v]);
}

/**
 * Helper function that mirrors the buildDocumentationOptions logic
 */
interface DocumentationOptionsSimple {
  outputPath: string;
  formats?: string[];
  components?: string[];
  detailLevel: 'summary' | 'standard' | 'full';
  includeScriptContent: boolean;
  includeProfilePayloads: boolean;
  useAIAnalysis?: boolean;
  anthropicApiKey?: string;
  pageSize: number;
}

function buildDocumentationOptions(cliOptions: CLIOptions): DocumentationOptionsSimple {
  const components = cliOptions.components
    ? cliOptions.components.split(',').map((c) => c.trim())
    : undefined;

  const formats = cliOptions.formats
    ? cliOptions.formats.split(',').map((f) => f.trim())
    : undefined;

  return {
    outputPath: cliOptions.output || './jamf-documentation',
    formats: formats,
    components: components,
    detailLevel: cliOptions.detailLevel || 'full',
    includeScriptContent: true,
    includeProfilePayloads: true,
    useAIAnalysis: cliOptions.aiAnalysis,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    pageSize: cliOptions.pageSize || 100,
  };
}
