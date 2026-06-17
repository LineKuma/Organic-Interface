/**
 * Environment Variable Resolver
 *
 * Resolves {{env:VAR_NAME}} and {{env:VAR_NAME:default}} macros
 * by reading environment variables.
 */

import type {
  MacroExpression,
  MacroResolveResult,
  MacroResolutionContext,
} from '../types/macro.js';

/**
 * Resolve an environment variable macro
 *
 * Syntax: {{env:VAR_NAME}} or {{env:VAR_NAME:default_value}}
 *
 * @param expression - The parsed macro expression
 * @param _context - Resolution context (unused for env vars)
 * @returns Resolution result
 */
export async function resolveEnv(
  expression: MacroExpression,
  _context: MacroResolutionContext
): Promise<MacroResolveResult> {
  const varName = expression.args[0];
  const defaultValue = expression.args[1];

  if (!varName) {
    return {
      success: false,
      error: 'Environment variable macro requires a variable name: {{env:VAR_NAME}}',
      expression,
    };
  }

  const value = process.env[varName];

  if (value !== undefined) {
    return {
      success: true,
      content: value,
      expression,
    };
  }

  if (defaultValue !== undefined) {
    return {
      success: true,
      content: defaultValue,
      expression,
    };
  }

  return {
    success: false,
    error: `Environment variable "${varName}" is not set and no default provided`,
    expression,
  };
}
