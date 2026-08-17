/**
 * Tool related types for Organic Interface
 */

import type { Logger } from '../utils/logger.js';

/**
 * Tool type categories
 */
export enum ToolType {
  /** File system operation tools */
  FILE_OPERATION = 'file_operation',
  /** Code and file search tools */
  SEARCH = 'search',
  /** System command execution tools */
  EXECUTION = 'execution',
  /** System management and operation tools */
  SYSTEM = 'system',
}

/**
 * Tool call level indicating security level
 */
export enum ToolCallLevel {
  /** Normal level, routine operations */
  NORMAL = 'normal',
  /** Restricted level, requires explicit authorization */
  RESTRICTED = 'restricted',
  /** Dangerous level, high-risk operations */
  DANGEROUS = 'dangerous',
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Parameter description */
  description: string;
  /** Whether the parameter is required */
  required: boolean;
  /** Default value if not provided */
  default?: unknown;
  /** Enum values if restricted to specific options */
  enum?: unknown[];
  /** Minimum value for numeric types */
  minimum?: number;
  /** Maximum value for numeric types */
  maximum?: number;
  /** Minimum length for string types */
  minLength?: number;
  /** Maximum length for string types */
  maxLength?: number;
  /** Regex pattern for string validation */
  pattern?: string;
}

/**
 * Tool parameter definition for JSON Schema
 */
export interface ToolParameterDefinition {
  /** Parameter type (always object for tools) */
  type: 'object';
  /** Parameter properties */
  properties: Record<string, ToolParameter>;
  /** Required parameter names */
  required: string[];
  /** Whether additional properties are allowed */
  additionalProperties: boolean;
}

/**
 * Tool definition metadata
 */
export interface ToolDefinition {
  /** Tool unique name */
  name: string;
  /** Tool version */
  version: string;
  /** Tool functional description */
  description: string;
  /** Tool category */
  type: ToolType;
  /** Tool call level */
  call_level: ToolCallLevel;
  /** Parameter definitions */
  parameters: ToolParameterDefinition;
  /** Required permissions */
  permissions?: string[];
  /** Maximum execution time in milliseconds */
  max_execution_time?: number;
  /** Maximum memory usage in bytes */
  max_memory?: number;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Whether execution was successful */
  success: boolean;
  /** Result data if successful */
  data?: unknown;
  /** Error information if failed */
  error?: ToolError;
  /** Execution metadata */
  metadata: ToolMetadata;
}

/**
 * Tool error information
 */
export interface ToolError {
  /** Error code */
  code: ToolErrorCode;
  /** Error description */
  message: string;
  /** Error details */
  details?: unknown;
}

/**
 * Tool error codes
 */
export enum ToolErrorCode {
  /** Invalid arguments provided */
  INVALID_ARGUMENTS = 'invalid_arguments',
  /** Permission denied */
  PERMISSION_DENIED = 'permission_denied',
  /** Tool not found */
  TOOL_NOT_FOUND = 'tool_not_found',
  /** Execution timeout */
  TIMEOUT = 'timeout',
  /** Execution error occurred */
  EXECUTION_ERROR = 'execution_error',
  /** System resources exhausted */
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  /** Tool is disabled */
  TOOL_DISABLED = 'tool_disabled',
}

/**
 * Tool execution metadata
 */
export interface ToolMetadata {
  /** Tool name */
  tool_name: string;
  /** Execution start timestamp */
  start_time: number;
  /** Execution end timestamp */
  end_time: number;
  /** Execution duration in milliseconds */
  execution_time: number;
  /** Request identifier */
  request_id: string;
}

/**
 * Tool handler function type
 */
export type ToolHandler = (
  params: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolResult>;

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** Request identifier */
  request_id: string;
  /** Caller plugin identifier */
  caller_plugin_id: string;
  /** Caller plugin name */
  caller_plugin_name: string;
  /** Execution timestamp */
  timestamp: number;
  /** Logger instance */
  logger: Logger;
}
