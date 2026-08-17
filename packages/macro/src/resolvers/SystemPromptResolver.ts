/**
 * System Prompt Resolver
 *
 * Resolves {{system:name}} macros by looking up system prompts
 * from the resolution context.
 */

import type {
  MacroExpression,
  MacroResolveResult,
  MacroResolutionContext,
} from '../types/macro.js';

/**
 * Resolve a system prompt macro
 *
 * Syntax: {{system:prompt_name}}
 *
 * @param expression - The parsed macro expression
 * @param context - Resolution context with system prompts
 * @returns Resolution result
 */
export async function resolveSystemPrompt(
  expression: MacroExpression,
  context: MacroResolutionContext
): Promise<MacroResolveResult> {
  const promptName = expression.args[0];

  if (!promptName) {
    return {
      success: false,
      error: 'System prompt macro requires a name argument: {{system:name}}',
      expression,
    };
  }

  const prompts = context.systemPrompts ?? {};
  const content = prompts[promptName];

  if (content === undefined) {
    return {
      success: false,
      error: `System prompt "${promptName}" not found. Available: ${Object.keys(prompts).join(', ') || 'none'}`,
      expression,
    };
  }

  return {
    success: true,
    content,
    expression,
  };
}
