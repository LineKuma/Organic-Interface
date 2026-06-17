/**
 * File Content Resolver
 *
 * Resolves {{file:path}} macros by reading file content from disk.
 * Supports relative and absolute paths.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  MacroExpression,
  MacroResolveResult,
  MacroResolutionContext,
} from '../types/macro.js';

/**
 * Resolve a file content macro
 *
 * Syntax: {{file:path/to/file}}
 *
 * @param expression - The parsed macro expression
 * @param context - Resolution context with file path resolution
 * @returns Resolution result
 */
export async function resolveFile(
  expression: MacroExpression,
  context: MacroResolutionContext
): Promise<MacroResolveResult> {
  const filePath = expression.args[0];

  if (!filePath) {
    return {
      success: false,
      error: 'File macro requires a path argument: {{file:path/to/file}}',
      expression,
    };
  }

  // Resolve file path
  let resolvedPath: string;
  if (context.resolveFilePath) {
    try {
      const result = context.resolveFilePath(filePath);
      resolvedPath = typeof result === 'string' ? result : await result;
    } catch {
      return {
        success: false,
        error: `Failed to resolve file path: ${filePath}`,
        expression,
      };
    }
  } else {
    // Default: resolve relative to cwd
    const cwd = context.cwd ?? process.cwd();
    resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  }

  // Read file
  try {
    const content = await fs.readFile(resolvedPath, 'utf-8');
    return {
      success: true,
      content,
      expression,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to read file "${resolvedPath}": ${message}`,
      expression,
    };
  }
}
