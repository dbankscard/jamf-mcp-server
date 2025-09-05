import { z } from 'zod';

export const AgentConfigSchema = z.object({
  mcpServer: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(3000),
    transport: z.enum(['stdio', 'http', 'websocket']).default('stdio'),
  }),
  aiProvider: z.object({
    type: z.enum(['openai', 'anthropic', 'local', 'mock', 'bedrock']).default('openai'),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().default(4000),
    awsRegion: z.string().optional(),
    awsAccessKeyId: z.string().optional(),
    awsSecretAccessKey: z.string().optional(),
    awsSessionToken: z.string().optional(),
  }),
  safety: z.object({
    mode: z.enum(['strict', 'moderate', 'permissive']).default('strict'),
    requireConfirmation: z.boolean().default(true),
    readOnlyMode: z.boolean().default(false),
    maxConcurrentTasks: z.number().default(5),
    auditLogPath: z.string().default('./logs/agent-audit.log'),
  }),
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    metricsPort: z.number().default(9090),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export class AgentConfigManager {
  private config: AgentConfig;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = this.loadConfig(config);
  }

  private loadConfig(overrides: Partial<AgentConfig>): AgentConfig {
    const envConfig = this.loadFromEnvironment();
    const mergedConfig = this.mergeConfigs(envConfig, overrides);
    return AgentConfigSchema.parse(mergedConfig);
  }

  private loadFromEnvironment(): any {
    const config: any = {};
    
    if (process.env.AGENT_MCP_HOST || process.env.AGENT_MCP_PORT || process.env.AGENT_MCP_TRANSPORT) {
      config.mcpServer = {};
      if (process.env.AGENT_MCP_HOST) config.mcpServer.host = process.env.AGENT_MCP_HOST;
      if (process.env.AGENT_MCP_PORT) config.mcpServer.port = parseInt(process.env.AGENT_MCP_PORT);
      if (process.env.AGENT_MCP_TRANSPORT) config.mcpServer.transport = process.env.AGENT_MCP_TRANSPORT;
    }
    
    if (process.env.AGENT_AI_PROVIDER || process.env.AGENT_AI_API_KEY || process.env.AGENT_AI_MODEL || process.env.AGENT_AI_TEMPERATURE ||
        process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_REGION) {
      config.aiProvider = {};
      if (process.env.AGENT_AI_PROVIDER) config.aiProvider.type = process.env.AGENT_AI_PROVIDER;
      if (process.env.AGENT_AI_API_KEY) config.aiProvider.apiKey = process.env.AGENT_AI_API_KEY;
      if (process.env.AGENT_AI_MODEL) config.aiProvider.model = process.env.AGENT_AI_MODEL;
      if (process.env.AGENT_AI_TEMPERATURE) config.aiProvider.temperature = parseFloat(process.env.AGENT_AI_TEMPERATURE);
      if (process.env.AWS_REGION) config.aiProvider.awsRegion = process.env.AWS_REGION;
      if (process.env.AWS_ACCESS_KEY_ID) config.aiProvider.awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
      if (process.env.AWS_SECRET_ACCESS_KEY) config.aiProvider.awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      if (process.env.AWS_SESSION_TOKEN) config.aiProvider.awsSessionToken = process.env.AWS_SESSION_TOKEN;
    }
    
    if (process.env.AGENT_SAFETY_MODE || process.env.AGENT_REQUIRE_CONFIRMATION !== undefined || process.env.AGENT_READ_ONLY !== undefined) {
      config.safety = {};
      if (process.env.AGENT_SAFETY_MODE) config.safety.mode = process.env.AGENT_SAFETY_MODE;
      if (process.env.AGENT_REQUIRE_CONFIRMATION !== undefined) config.safety.requireConfirmation = process.env.AGENT_REQUIRE_CONFIRMATION === 'true';
      if (process.env.AGENT_READ_ONLY !== undefined) config.safety.readOnlyMode = process.env.AGENT_READ_ONLY === 'true';
    }
    
    if (process.env.AGENT_ENABLE_METRICS !== undefined || process.env.AGENT_LOG_LEVEL) {
      config.monitoring = {};
      if (process.env.AGENT_ENABLE_METRICS !== undefined) config.monitoring.enableMetrics = process.env.AGENT_ENABLE_METRICS === 'true';
      if (process.env.AGENT_LOG_LEVEL) config.monitoring.logLevel = process.env.AGENT_LOG_LEVEL;
    }
    
    return config;
  }

  private mergeConfigs(base: any, overrides: any): any {
    const merged: any = {};
    
    // Start with base
    for (const key in base) {
      if (base[key] === undefined) continue;
      if (typeof base[key] === 'object' && !Array.isArray(base[key]) && base[key] !== null) {
        merged[key] = this.mergeConfigs(base[key], overrides?.[key] || {});
      } else {
        merged[key] = base[key];
      }
    }
    
    // Apply overrides
    for (const key in overrides) {
      if (overrides[key] === undefined) continue;
      if (typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && overrides[key] !== null) {
        merged[key] = merged[key] ? this.mergeConfigs(merged[key], overrides[key]) : overrides[key];
      } else {
        merged[key] = overrides[key];
      }
    }
    
    return merged;
  }

  get(): AgentConfig {
    return this.config;
  }

  getAIConfig() {
    return this.config.aiProvider;
  }

  getSafetyConfig() {
    return this.config.safety;
  }

  getMCPConfig() {
    return this.config.mcpServer;
  }

  isReadOnly(): boolean {
    return this.config.safety.readOnlyMode;
  }

  requiresConfirmation(): boolean {
    return this.config.safety.requireConfirmation;
  }
}