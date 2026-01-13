/**
 * Common types for Claude Skills
 */

/**
 * Tool call result - returns flexible data shape from Jamf API tools
 * The any types here are intentional as tool results vary by tool
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolCallResult = any;

export interface SkillContext {
  /**
   * Call a Jamf MCP tool - returns tool-specific data shape
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callTool: (toolName: string, params: any) => Promise<ToolCallResult>;

  /**
   * Direct access to Jamf client (for complex operations)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;

  /**
   * Access to environment configuration
   */
  env: {
    jamfUrl: string;
    [key: string]: string;
  };

  /**
   * Logger instance
   */
  logger?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info: (message: string, meta?: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warn: (message: string, meta?: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: (message: string, meta?: any) => void;
  };
}

export interface SkillResult {
  /**
   * Whether the skill executed successfully
   */
  success: boolean;

  /**
   * Human-readable message about the result
   */
  message: string;

  /**
   * Structured data returned by the skill
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;

  /**
   * Error information if the skill failed
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: any;

  /**
   * Suggested next actions
   */
  nextActions?: string[];
}

export interface SkillMetadata {
  /**
   * Unique name for the skill
   */
  name: string;
  
  /**
   * Description of what the skill does
   */
  description: string;
  
  /**
   * Parameter definitions
   */
  parameters: Record<string, ParameterDefinition>;
  
  /**
   * Usage examples
   */
  examples?: SkillExample[];
  
  /**
   * Tags for categorization
   */
  tags?: string[];
}

export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enum?: any[];
}

export interface SkillExample {
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>;
}