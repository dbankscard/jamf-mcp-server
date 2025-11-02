/**
 * Common types for Claude Skills
 */
export interface SkillContext {
    /**
     * Call a Jamf MCP tool
     */
    callTool: (toolName: string, params: any) => Promise<any>;
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
        info: (message: string, meta?: any) => void;
        warn: (message: string, meta?: any) => void;
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
    data?: any;
    /**
     * Error information if the skill failed
     */
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
    default?: any;
    enum?: any[];
}
export interface SkillExample {
    description: string;
    params: Record<string, any>;
}
//# sourceMappingURL=types.d.ts.map