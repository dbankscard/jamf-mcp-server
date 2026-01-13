/**
 * Zod validation schemas for tool parameters
 * Provides runtime validation with clear error messages
 */

import { z, ZodError } from 'zod';

/**
 * Custom validation error class for tool parameters
 */
export class ToolValidationError extends Error {
  public readonly field: string;
  public readonly code: string;
  public readonly details: { field: string; message: string }[];

  constructor(zodError: ZodError) {
    const details = zodError.errors.map(e => ({
      field: e.path.join('.') || 'unknown',
      message: e.message,
    }));
    const message = details.map(d => `${d.field}: ${d.message}`).join('; ');
    super(message);
    this.name = 'ToolValidationError';
    this.field = details[0]?.field || 'unknown';
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
}

/**
 * Validate params against a Zod schema and throw ToolValidationError on failure
 */
export function validateParams<T>(schema: z.ZodSchema<T>, params: unknown): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ToolValidationError(result.error);
  }
  return result.data;
}

// --- ID Format Validators ---

/**
 * Jamf device IDs are numeric strings or numbers
 * Format: positive integer as string
 */
export const JamfDeviceIdSchema = z
  .string()
  .min(1, 'Device ID is required')
  .regex(/^\d+$/, 'Device ID must be a numeric value')
  .transform(val => val.trim());

/**
 * Jamf policy IDs are numeric strings
 */
export const JamfPolicyIdSchema = z
  .string()
  .min(1, 'Policy ID is required')
  .regex(/^\d+$/, 'Policy ID must be a numeric value')
  .transform(val => val.trim());

/**
 * Jamf script IDs are numeric strings
 */
export const JamfScriptIdSchema = z
  .string()
  .min(1, 'Script ID is required')
  .regex(/^\d+$/, 'Script ID must be a numeric value')
  .transform(val => val.trim());

/**
 * Jamf profile IDs are numeric strings
 */
export const JamfProfileIdSchema = z
  .string()
  .min(1, 'Profile ID is required')
  .regex(/^\d+$/, 'Profile ID must be a numeric value')
  .transform(val => val.trim());

/**
 * Jamf group IDs are numeric strings
 */
export const JamfGroupIdSchema = z
  .string()
  .min(1, 'Group ID is required')
  .regex(/^\d+$/, 'Group ID must be a numeric value')
  .transform(val => val.trim());

// --- Search Query Validators ---

/**
 * Search query string with length limits
 */
export const SearchQuerySchema = z
  .string()
  .max(500, 'Search query must be less than 500 characters')
  .transform(val => val.trim());

/**
 * Optional search query
 */
export const OptionalSearchQuerySchema = z
  .string()
  .max(500, 'Search query must be less than 500 characters')
  .optional()
  .transform(val => val?.trim());

// --- Numeric Range Validators ---

/**
 * Days parameter for compliance checks
 * Must be positive and reasonable (max 365 days)
 */
export const ComplianceDaysSchema = z
  .number()
  .int('Days must be a whole number')
  .min(1, 'Days must be at least 1')
  .max(365, 'Days cannot exceed 365');

/**
 * Limit parameter for pagination
 * Must be positive and reasonable
 */
export const LimitSchema = z
  .number()
  .int('Limit must be a whole number')
  .min(1, 'Limit must be at least 1')
  .max(1000, 'Limit cannot exceed 1000')
  .default(50);

/**
 * Optional limit with default
 */
export const OptionalLimitSchema = z
  .number()
  .int('Limit must be a whole number')
  .min(1, 'Limit must be at least 1')
  .max(1000, 'Limit cannot exceed 1000')
  .optional();

// --- Tool Parameter Schemas ---

/**
 * Device search parameters
 */
export const DeviceSearchParamsSchema = z.object({
  query: SearchQuerySchema,
  limit: LimitSchema.optional().default(50),
});
export type DeviceSearchParams = z.infer<typeof DeviceSearchParamsSchema>;

/**
 * Device details parameters
 */
export const DeviceDetailsParamsSchema = z.object({
  deviceId: JamfDeviceIdSchema,
});
export type DeviceDetailsParams = z.infer<typeof DeviceDetailsParamsSchema>;

/**
 * Update inventory parameters
 */
export const UpdateInventoryParamsSchema = z.object({
  deviceId: JamfDeviceIdSchema,
});
export type UpdateInventoryParams = z.infer<typeof UpdateInventoryParamsSchema>;

/**
 * Compliance check parameters
 */
export const ComplianceCheckParamsSchema = z.object({
  days: ComplianceDaysSchema.default(30),
  includeDetails: z.boolean().default(false),
  deviceId: JamfDeviceIdSchema.optional(),
});
export type ComplianceCheckParams = z.infer<typeof ComplianceCheckParamsSchema>;

/**
 * Execute policy parameters
 */
export const ExecutePolicyParamsSchema = z.object({
  policyId: JamfPolicyIdSchema,
  deviceIds: z
    .array(JamfDeviceIdSchema)
    .min(1, 'At least one device ID is required')
    .max(100, 'Cannot execute on more than 100 devices at once'),
  confirm: z.boolean().optional().default(false),
});
export type ExecutePolicyParams = z.infer<typeof ExecutePolicyParamsSchema>;

/**
 * Search policies parameters
 */
export const SearchPoliciesParamsSchema = z.object({
  query: SearchQuerySchema,
  limit: LimitSchema.optional().default(50),
});
export type SearchPoliciesParams = z.infer<typeof SearchPoliciesParamsSchema>;

/**
 * Policy details parameters
 */
export const PolicyDetailsParamsSchema = z.object({
  policyId: JamfPolicyIdSchema,
  includeScriptContent: z.boolean().optional().default(false),
});
export type PolicyDetailsParams = z.infer<typeof PolicyDetailsParamsSchema>;

/**
 * Search configuration profiles parameters
 */
export const SearchConfigProfilesParamsSchema = z.object({
  query: SearchQuerySchema,
  type: z.enum(['computer', 'mobiledevice']).optional().default('computer'),
});
export type SearchConfigProfilesParams = z.infer<typeof SearchConfigProfilesParamsSchema>;

/**
 * Get devices batch parameters
 */
export const GetDevicesBatchParamsSchema = z.object({
  deviceIds: z
    .array(JamfDeviceIdSchema)
    .min(1, 'At least one device ID is required')
    .max(100, 'Cannot fetch more than 100 devices at once'),
  includeBasicOnly: z.boolean().optional().default(false),
});
export type GetDevicesBatchParams = z.infer<typeof GetDevicesBatchParamsSchema>;

/**
 * Deploy script parameters
 */
export const DeployScriptParamsSchema = z.object({
  scriptId: JamfScriptIdSchema,
  deviceIds: z
    .array(JamfDeviceIdSchema)
    .min(1, 'At least one device ID is required')
    .max(100, 'Cannot deploy to more than 100 devices at once'),
  confirm: z.boolean().optional().default(false),
});
export type DeployScriptParams = z.infer<typeof DeployScriptParamsSchema>;

/**
 * Script details parameters
 */
export const ScriptDetailsParamsSchema = z.object({
  scriptId: JamfScriptIdSchema,
});
export type ScriptDetailsParams = z.infer<typeof ScriptDetailsParamsSchema>;

/**
 * Configuration profile details parameters
 */
export const ConfigProfileDetailsParamsSchema = z.object({
  profileId: JamfProfileIdSchema,
  type: z.enum(['computer', 'mobiledevice']).optional().default('computer'),
});
export type ConfigProfileDetailsParams = z.infer<typeof ConfigProfileDetailsParamsSchema>;

/**
 * Deploy configuration profile parameters
 */
export const DeployConfigProfileParamsSchema = z.object({
  profileId: JamfProfileIdSchema,
  deviceIds: z
    .array(JamfDeviceIdSchema)
    .min(1, 'At least one device ID is required')
    .max(100, 'Cannot deploy to more than 100 devices at once'),
  type: z.enum(['computer', 'mobiledevice']).optional().default('computer'),
  confirm: z.boolean().optional().default(false),
});
export type DeployConfigProfileParams = z.infer<typeof DeployConfigProfileParamsSchema>;

/**
 * Remove configuration profile parameters
 */
export const RemoveConfigProfileParamsSchema = z.object({
  profileId: JamfProfileIdSchema,
  deviceIds: z
    .array(JamfDeviceIdSchema)
    .min(1, 'At least one device ID is required')
    .max(100, 'Cannot remove from more than 100 devices at once'),
  type: z.enum(['computer', 'mobiledevice']).optional().default('computer'),
  confirm: z.boolean().optional().default(false),
});
export type RemoveConfigProfileParams = z.infer<typeof RemoveConfigProfileParamsSchema>;

/**
 * List computer groups parameters
 */
export const ListComputerGroupsParamsSchema = z.object({
  type: z.enum(['smart', 'static', 'all']).optional().default('all'),
});
export type ListComputerGroupsParams = z.infer<typeof ListComputerGroupsParamsSchema>;

/**
 * Computer group details parameters
 */
export const ComputerGroupDetailsParamsSchema = z.object({
  groupId: JamfGroupIdSchema,
});
export type ComputerGroupDetailsParams = z.infer<typeof ComputerGroupDetailsParamsSchema>;

/**
 * Search computer groups parameters
 */
export const SearchComputerGroupsParamsSchema = z.object({
  query: SearchQuerySchema,
});
export type SearchComputerGroupsParams = z.infer<typeof SearchComputerGroupsParamsSchema>;

/**
 * Create static computer group parameters
 */
export const CreateStaticGroupParamsSchema = z.object({
  name: z
    .string()
    .min(1, 'Group name is required')
    .max(255, 'Group name cannot exceed 255 characters'),
  computerIds: z
    .array(JamfDeviceIdSchema)
    .min(1, 'At least one computer ID is required')
    .max(500, 'Cannot add more than 500 computers at once'),
  confirm: z.boolean().optional().default(false),
});
export type CreateStaticGroupParams = z.infer<typeof CreateStaticGroupParamsSchema>;

/**
 * Update static computer group parameters
 */
export const UpdateStaticGroupParamsSchema = z.object({
  groupId: JamfGroupIdSchema,
  computerIds: z
    .array(JamfDeviceIdSchema)
    .max(500, 'Cannot set more than 500 computers at once'),
  confirm: z.boolean().optional().default(false),
});
export type UpdateStaticGroupParams = z.infer<typeof UpdateStaticGroupParamsSchema>;

/**
 * Delete computer group parameters
 */
export const DeleteComputerGroupParamsSchema = z.object({
  groupId: JamfGroupIdSchema,
  confirm: z.boolean().optional().default(false),
});
export type DeleteComputerGroupParams = z.infer<typeof DeleteComputerGroupParamsSchema>;
