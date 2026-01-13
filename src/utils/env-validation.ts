/**
 * Environment Variable Validation
 *
 * Validates all environment variables on startup using Zod schemas.
 * Provides helpful error messages for invalid or missing configuration.
 */

import { z } from 'zod';

/**
 * Custom error class for environment validation failures
 */
export class EnvValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: z.ZodError['errors'],
    public readonly suggestions: string[]
  ) {
    super(message);
    this.name = 'EnvValidationError';
  }

  /**
   * Format the error for display
   */
  format(): string {
    const lines: string[] = [this.message, ''];

    if (this.errors.length > 0) {
      lines.push('Validation errors:');
      for (const error of this.errors) {
        const path = error.path.join('.');
        lines.push(`  - ${path}: ${error.message}`);
      }
      lines.push('');
    }

    if (this.suggestions.length > 0) {
      lines.push('Suggestions:');
      for (const suggestion of this.suggestions) {
        lines.push(`  - ${suggestion}`);
      }
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Helper Schemas
// ============================================================================

/** Boolean from string: 'true' = true, anything else = false */
const booleanFromString = z
  .string()
  .optional()
  .transform((val) => val === 'true');

/** Positive integer with bounds */
const positiveInt = (min: number, max: number, defaultVal?: number) =>
  z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : defaultVal))
    .pipe(
      z
        .number()
        .int()
        .min(min)
        .max(max)
        .optional()
    );

/** Port number (1-65535) */
const portSchema = z
  .string()
  .optional()
  .transform((val) => (val ? parseInt(val, 10) : 3000))
  .pipe(z.number().int().min(1).max(65535));

/** URL schema */
const urlSchema = z.string().url();

/** Optional URL schema */
const optionalUrlSchema = z.string().url().optional();

// ============================================================================
// Core Jamf Configuration
// ============================================================================

export const JamfConfigSchema = z.object({
  /** Jamf Pro URL (required) */
  JAMF_URL: urlSchema.describe('Jamf Pro server URL'),

  /** OAuth2 Client ID */
  JAMF_CLIENT_ID: z.string().min(1).optional(),

  /** OAuth2 Client Secret */
  JAMF_CLIENT_SECRET: z.string().min(1).optional(),

  /** Basic Auth Username */
  JAMF_USERNAME: z.string().min(1).optional(),

  /** Basic Auth Password */
  JAMF_PASSWORD: z.string().min(1).optional(),

  /** Enable read-only mode */
  JAMF_READ_ONLY: booleanFromString,

  /** Allow insecure TLS connections (self-signed certs) */
  JAMF_ALLOW_INSECURE: booleanFromString,
});

// ============================================================================
// Enhanced Mode Configuration
// ============================================================================

export const EnhancedModeSchema = z.object({
  /** Enable enhanced mode with retry, rate limiting, circuit breaker */
  JAMF_USE_ENHANCED_MODE: booleanFromString,

  /** Enable automatic retries */
  JAMF_ENABLE_RETRY: booleanFromString,

  /** Enable rate limiting */
  JAMF_ENABLE_RATE_LIMITING: booleanFromString,

  /** Enable circuit breaker pattern */
  JAMF_ENABLE_CIRCUIT_BREAKER: booleanFromString,

  /** Enable debug logging */
  JAMF_DEBUG_MODE: booleanFromString,

  /** Maximum retry attempts (0-10) */
  JAMF_MAX_RETRIES: positiveInt(0, 10, 3),

  /** Initial retry delay in ms (100-30000) */
  JAMF_RETRY_DELAY: positiveInt(100, 30000, 1000),

  /** Maximum retry delay in ms (1000-60000) */
  JAMF_RETRY_MAX_DELAY: positiveInt(1000, 60000, 10000),

  /** Backoff multiplier (1-5) */
  JAMF_RETRY_BACKOFF_MULTIPLIER: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : 2))
    .pipe(z.number().min(1).max(5).optional()),

  /** Circuit breaker failure threshold before opening (1-20) */
  JAMF_CIRCUIT_BREAKER_THRESHOLD: positiveInt(1, 20, 5),

  /** Circuit breaker reset timeout in ms (5000-300000) */
  JAMF_CIRCUIT_BREAKER_RESET_TIMEOUT: positiveInt(5000, 300000, 60000),

  /** Circuit breaker half-open requests before closing (1-10) */
  JAMF_CIRCUIT_BREAKER_HALF_OPEN_REQUESTS: positiveInt(1, 10, 3),
});

// ============================================================================
// HTTP Server Configuration
// ============================================================================

export const HttpServerSchema = z.object({
  /** Server port */
  PORT: portSchema,

  /** Node environment */
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),

  /** Allowed CORS origins (comma-separated) */
  ALLOWED_ORIGINS: z.string().optional(),

  /** Rate limit window in ms (60000-3600000) */
  RATE_LIMIT_WINDOW: positiveInt(60000, 3600000, 900000),

  /** Rate limit max requests per window (1-10000) */
  RATE_LIMIT_MAX: positiveInt(1, 10000, 100),

  /** Server URL for skills */
  SERVER_URL: optionalUrlSchema,
});

// ============================================================================
// OAuth Provider Configuration
// ============================================================================

export const OAuthProviderSchema = z.object({
  /** OAuth provider type */
  OAUTH_PROVIDER: z.enum(['dev', 'auth0', 'okta']).optional(),

  /** OAuth redirect URI */
  OAUTH_REDIRECT_URI: optionalUrlSchema,

  /** JWT secret for dev mode */
  JWT_SECRET: z.string().min(16).optional(),

  /** Required OAuth scopes (space-separated) */
  REQUIRED_SCOPES: z.string().optional(),
});

export const Auth0ConfigSchema = z.object({
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_CLIENT_ID: z.string().optional(),
  AUTH0_CLIENT_SECRET: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),
  AUTH0_SCOPE: z.string().optional(),
});

export const OktaConfigSchema = z.object({
  OKTA_DOMAIN: z.string().optional(),
  OKTA_CLIENT_ID: z.string().optional(),
  OKTA_CLIENT_SECRET: z.string().optional(),
  OKTA_SCOPE: z.string().optional(),
});

// ============================================================================
// HTTP Agent Pool Configuration
// ============================================================================

export const HttpAgentPoolSchema = z.object({
  /** Maximum concurrent sockets (1-500) */
  HTTP_MAX_SOCKETS: positiveInt(1, 500, 50),

  /** Maximum free sockets to keep alive (1-100) */
  HTTP_MAX_FREE_SOCKETS: positiveInt(1, 100, 10),

  /** Request timeout in ms (1000-300000) */
  HTTP_TIMEOUT: positiveInt(1000, 300000, 60000),

  /** Keep-alive timeout in ms (1000-120000) */
  HTTP_KEEPALIVE_TIMEOUT: positiveInt(1000, 120000, 30000),

  /** Enable connection metrics */
  HTTP_ENABLE_METRICS: booleanFromString,
});

// ============================================================================
// Logging Configuration
// ============================================================================

export const LoggingSchema = z.object({
  /** Log level */
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).optional(),

  /** Log directory path */
  LOG_DIR: z.string().optional(),

  /** Enable MCP mode (suppress stdout/stderr) */
  MCP_MODE: booleanFromString,
});

// ============================================================================
// Agent Configuration
// ============================================================================

export const AgentConfigSchema = z.object({
  /** MCP server host */
  AGENT_MCP_HOST: z.string().optional(),

  /** MCP server port */
  AGENT_MCP_PORT: positiveInt(1, 65535),

  /** MCP transport type */
  AGENT_MCP_TRANSPORT: z.string().optional(),

  /** AI provider type */
  AGENT_AI_PROVIDER: z.enum(['openai', 'anthropic', 'local', 'mock', 'bedrock']).optional(),

  /** AI API key */
  AGENT_AI_API_KEY: z.string().optional(),

  /** AI model name */
  AGENT_AI_MODEL: z.string().optional(),

  /** AI temperature (0-2) */
  AGENT_AI_TEMPERATURE: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .pipe(z.number().min(0).max(2).optional()),

  /** Agent safety mode */
  AGENT_SAFETY_MODE: z.string().optional(),

  /** Require confirmation for actions */
  AGENT_REQUIRE_CONFIRMATION: booleanFromString,

  /** Agent read-only mode */
  AGENT_READ_ONLY: booleanFromString,

  /** Enable agent metrics */
  AGENT_ENABLE_METRICS: booleanFromString,

  /** Agent log level */
  AGENT_LOG_LEVEL: z.string().optional(),
});

// ============================================================================
// External API Keys
// ============================================================================

export const ExternalApiKeysSchema = z.object({
  /** Anthropic API key */
  ANTHROPIC_API_KEY: z.string().optional(),

  /** OpenAI API key */
  OPENAI_API_KEY: z.string().optional(),

  /** AWS Access Key ID */
  AWS_ACCESS_KEY_ID: z.string().optional(),

  /** AWS Secret Access Key */
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  /** AWS Region */
  AWS_REGION: z.string().optional(),

  /** AWS Session Token */
  AWS_SESSION_TOKEN: z.string().optional(),
});

// ============================================================================
// Combined Schema for Full Validation
// ============================================================================

export const FullEnvSchema = JamfConfigSchema.merge(EnhancedModeSchema)
  .merge(HttpServerSchema)
  .merge(OAuthProviderSchema)
  .merge(Auth0ConfigSchema)
  .merge(OktaConfigSchema)
  .merge(HttpAgentPoolSchema)
  .merge(LoggingSchema)
  .merge(AgentConfigSchema)
  .merge(ExternalApiKeysSchema);

export type FullEnvConfig = z.infer<typeof FullEnvSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate core Jamf configuration (required for all modes)
 */
export function validateJamfConfig(env: NodeJS.ProcessEnv): {
  valid: boolean;
  config?: z.infer<typeof JamfConfigSchema>;
  error?: EnvValidationError;
} {
  const result = JamfConfigSchema.safeParse(env);

  if (!result.success) {
    const suggestions: string[] = [];
    const missingFields: string[] = [];

    for (const error of result.error.errors) {
      const field = error.path[0] as string;
      if (error.code === 'invalid_type' && error.received === 'undefined') {
        missingFields.push(field);
      }
    }

    if (missingFields.includes('JAMF_URL')) {
      suggestions.push('Set JAMF_URL to your Jamf Pro server URL (e.g., https://yourcompany.jamfcloud.com)');
    }

    return {
      valid: false,
      error: new EnvValidationError(
        'Invalid Jamf configuration',
        result.error.errors,
        suggestions
      ),
    };
  }

  // Additional validation: need at least one auth method
  const hasOAuth2 = !!(result.data.JAMF_CLIENT_ID && result.data.JAMF_CLIENT_SECRET);
  const hasBasicAuth = !!(result.data.JAMF_USERNAME && result.data.JAMF_PASSWORD);

  if (!hasOAuth2 && !hasBasicAuth) {
    return {
      valid: false,
      error: new EnvValidationError(
        'Missing authentication credentials',
        [],
        [
          'Provide OAuth2 credentials: JAMF_CLIENT_ID and JAMF_CLIENT_SECRET',
          'Or provide Basic Auth: JAMF_USERNAME and JAMF_PASSWORD',
          'OAuth2 is recommended for production use',
        ]
      ),
    };
  }

  return { valid: true, config: result.data };
}

/**
 * Validate enhanced mode configuration
 */
export function validateEnhancedModeConfig(env: NodeJS.ProcessEnv): {
  valid: boolean;
  config?: z.infer<typeof EnhancedModeSchema>;
  error?: EnvValidationError;
} {
  const result = EnhancedModeSchema.safeParse(env);

  if (!result.success) {
    const suggestions: string[] = [];

    for (const error of result.error.errors) {
      const field = error.path[0] as string;
      if (field === 'JAMF_MAX_RETRIES') {
        suggestions.push('JAMF_MAX_RETRIES must be between 0 and 10');
      }
      if (field === 'JAMF_RETRY_DELAY') {
        suggestions.push('JAMF_RETRY_DELAY must be between 100 and 30000 ms');
      }
      if (field === 'JAMF_RETRY_MAX_DELAY') {
        suggestions.push('JAMF_RETRY_MAX_DELAY must be between 1000 and 60000 ms');
      }
    }

    return {
      valid: false,
      error: new EnvValidationError(
        'Invalid enhanced mode configuration',
        result.error.errors,
        suggestions
      ),
    };
  }

  return { valid: true, config: result.data };
}

/**
 * Validate HTTP server configuration
 */
export function validateHttpServerConfig(env: NodeJS.ProcessEnv): {
  valid: boolean;
  config?: z.infer<typeof HttpServerSchema>;
  error?: EnvValidationError;
} {
  const result = HttpServerSchema.safeParse(env);

  if (!result.success) {
    const suggestions: string[] = [];

    for (const error of result.error.errors) {
      const field = error.path[0] as string;
      if (field === 'PORT') {
        suggestions.push('PORT must be a valid port number between 1 and 65535');
      }
      if (field === 'RATE_LIMIT_WINDOW') {
        suggestions.push('RATE_LIMIT_WINDOW must be between 60000 (1 min) and 3600000 (1 hour) ms');
      }
      if (field === 'RATE_LIMIT_MAX') {
        suggestions.push('RATE_LIMIT_MAX must be between 1 and 10000 requests');
      }
    }

    return {
      valid: false,
      error: new EnvValidationError(
        'Invalid HTTP server configuration',
        result.error.errors,
        suggestions
      ),
    };
  }

  return { valid: true, config: result.data };
}

/**
 * Validate OAuth provider configuration
 */
export function validateOAuthConfig(env: NodeJS.ProcessEnv): {
  valid: boolean;
  config?: z.infer<typeof OAuthProviderSchema>;
  warnings: string[];
} {
  const result = OAuthProviderSchema.safeParse(env);
  const warnings: string[] = [];

  if (!result.success) {
    return { valid: false, warnings };
  }

  const provider = result.data.OAUTH_PROVIDER || 'auth0';

  // Check provider-specific requirements
  if (provider === 'auth0') {
    if (!env.AUTH0_DOMAIN || !env.AUTH0_CLIENT_ID || !env.AUTH0_CLIENT_SECRET) {
      warnings.push('Auth0 provider selected but missing AUTH0_DOMAIN, AUTH0_CLIENT_ID, or AUTH0_CLIENT_SECRET');
    }
  } else if (provider === 'okta') {
    if (!env.OKTA_DOMAIN || !env.OKTA_CLIENT_ID || !env.OKTA_CLIENT_SECRET) {
      warnings.push('Okta provider selected but missing OKTA_DOMAIN, OKTA_CLIENT_ID, or OKTA_CLIENT_SECRET');
    }
  } else if (provider === 'dev') {
    if (env.NODE_ENV === 'production') {
      warnings.push('Dev OAuth provider should not be used in production');
    }
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) {
      warnings.push('JWT_SECRET should be at least 16 characters for dev mode');
    }
  }

  return { valid: true, config: result.data, warnings };
}

/**
 * Validate all environment variables
 *
 * @param env - Process environment to validate
 * @param options - Validation options
 * @returns Validation result with config or error
 */
export function validateEnvironment(
  env: NodeJS.ProcessEnv,
  options: {
    /** Whether to validate HTTP server config */
    validateHttpServer?: boolean;
    /** Whether enhanced mode is expected */
    enhancedMode?: boolean;
  } = {}
): {
  valid: boolean;
  config?: Partial<FullEnvConfig>;
  error?: EnvValidationError;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Always validate core Jamf config
  const jamfResult = validateJamfConfig(env);
  if (!jamfResult.valid) {
    return { valid: false, error: jamfResult.error, warnings };
  }

  // Validate enhanced mode if enabled
  if (options.enhancedMode) {
    const enhancedResult = validateEnhancedModeConfig(env);
    if (!enhancedResult.valid) {
      return { valid: false, error: enhancedResult.error, warnings };
    }
  }

  // Validate HTTP server if requested
  if (options.validateHttpServer) {
    const httpResult = validateHttpServerConfig(env);
    if (!httpResult.valid) {
      return { valid: false, error: httpResult.error, warnings };
    }

    // Validate OAuth config for HTTP server
    const oauthResult = validateOAuthConfig(env);
    warnings.push(...oauthResult.warnings);
  }

  // Parse full config
  const fullResult = FullEnvSchema.safeParse(env);

  return {
    valid: true,
    config: fullResult.success ? fullResult.data : undefined,
    warnings,
  };
}
