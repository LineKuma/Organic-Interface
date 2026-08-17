/**
 * @organic/macro - Macro Expression Resolution System
 *
 * Provides a macro expression system for conversation requests that
 * supports inserting dynamic content via expressions:
 *
 * - {{system:name}}     - Insert system prompt by name
 * - {{file:path}}       - Insert file content from disk
 * - {{env:VAR_NAME}}    - Insert environment variable value
 * - {{history:ctx_id}}  - Insert conversation history with range/filter
 * - {{history:current}} - Insert current conversation context
 *
 * Both users and AI agents can invoke macros. The MacroTool wraps
 * the resolver as a standard AI-invocable tool.
 *
 * @example User usage:
 * ```typescript
 * import { MacroResolver } from '@organic/macro';
 *
 * const resolver = new MacroResolver();
 * const result = await resolver.resolve(
 *   'Context: {{history:current:last:10}}',
 *   { currentContextId: 'ctx_123', getMessages: async (id) => [...] }
 * );
 * console.log(result.resolved);
 * ```
 *
 * @example AI tool usage:
 * ```typescript
 * import { MacroTool } from '@organic/macro';
 *
 * const tool = new MacroTool({
 *   contextProvider: () => ({
 *     currentContextId: 'ctx_123',
 *     getMessages: async (id) => [...],
 *   })
 * });
 *
 * // Register with ToolService for AI invocation
 * toolService.registerTool(tool);
 * ```
 */

// Types
export * from './types/index.js';

// Parser
export * from './parser/index.js';

// Resolvers
export * from './resolvers/index.js';

// Core
export * from './core/index.js';

/** Package version */
export const VERSION = '0.1.0';
