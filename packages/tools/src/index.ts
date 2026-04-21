/**
 * @organic/tools - Tool Service module for Organic Interface
 *
 * Provides tool registration, discovery, execution, and built-in tools
 * for the Organic Interface system.
 */

// Re-export types from @organic/utils
export type {
  ToolDefinition,
  ToolResult,
  ToolError,
  ToolErrorCode,
  ToolType,
  ToolCallLevel,
  ToolParameter,
  ToolParameterDefinition,
  ToolMetadata,
  ToolExecutionContext,
} from '@organic/utils';

// Re-export enums
export { ToolType, ToolCallLevel, ToolErrorCode } from '@organic/utils';

// Re-export services
export { ToolService, type ToolServiceOptions } from './services/ToolService.js';
export {
  BuiltinToolService,
  BUILTIN_TOOLS,
  type BuiltinToolMetadata,
} from './services/BuiltinToolService.js';

// Re-export executor
export { ToolExecutor, type ToolExecutorOptions, type ExecutionOptions } from './executor/ToolExecutor.js';
export { ToolContext, type ToolContextOptions } from './executor/ToolContext.js';

// Re-export built-in tools
export { fileToolHandlers, getFileToolDefinitions } from './builtin/FileTool.js';
export { shellToolHandlers, getShellToolDefinitions } from './builtin/ShellTool.js';
export { searchToolHandlers, getSearchToolDefinitions } from './builtin/SearchTool.js';

/**
 * Get all built-in tool definitions with handlers
 */
export function getAllBuiltinTools(): Array<{
  definition: ToolDefinition;
  handler: (params: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
}> {
  return [
    ...getFileToolDefinitions(),
    ...getShellToolDefinitions(),
    ...getSearchToolDefinitions(),
  ];
}

/**
 * Module version
 */
export const VERSION = '0.1.0';
