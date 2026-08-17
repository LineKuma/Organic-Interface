/**
 * Macro Resolver - Main resolution engine
 *
 * Orchestrates the full macro resolution pipeline:
 * 1. Parse macro expressions from text
 * 2. Resolve each expression using the appropriate resolver
 * 3. Replace expressions with resolved content
 * 4. Return the fully resolved text and a resolution report
 */

import { createLogger, type Logger } from '@organic/utils';

import type {
  MacroExpression,
  MacroResolveResult,
  MacroResolveReport,
  MacroResolutionContext,
  MacroType,
} from '../types/macro.js';

import { parseMacros, hasMacros, countMacros } from '../parser/MacroParser.js';
import { resolveSystemPrompt } from '../resolvers/SystemPromptResolver.js';
import { resolveFile } from '../resolvers/FileResolver.js';
import { resolveEnv } from '../resolvers/EnvResolver.js';
import { resolveHistory } from '../resolvers/HistoryResolver.js';

/** Resolver function type */
type MacroResolverFn = (
  expression: MacroExpression,
  context: MacroResolutionContext
) => Promise<MacroResolveResult>;

/** Map of macro type to resolver function */
const RESOLVERS: Record<MacroType, MacroResolverFn> = {
  system: resolveSystemPrompt,
  file: resolveFile,
  env: resolveEnv,
  history: resolveHistory,
};

/**
 * Main macro resolver engine
 *
 * Usage:
 * ```typescript
 * const resolver = new MacroResolver();
 *
 * const result = await resolver.resolve(
 *   'You are {{system:code-assistant}}. The key is {{env:API_KEY}}.',
 *   {
 *     systemPrompts: { 'code-assistant': 'You are a helpful coding assistant.' },
 *   }
 * );
 *
 * console.log(result.resolved);
 * // "You are You are a helpful coding assistant.. The key is sk-xxx."
 * ```
 */
export class MacroResolver {
  private logger: Logger;
  private customResolvers: Map<string, MacroResolverFn> = new Map();

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ prefix: 'MacroResolver' });
  }

  /**
   * Register a custom resolver for a macro type
   *
   * @param type - The macro type to handle
   * @param resolver - The resolver function
   */
  registerResolver(type: string, resolver: MacroResolverFn): void {
    this.customResolvers.set(type, resolver);
    this.logger.info(`Custom resolver registered for type: ${type}`);
  }

  /**
   * Unregister a custom resolver
   *
   * @param type - The macro type to unregister
   */
  unregisterResolver(type: string): void {
    this.customResolvers.delete(type);
  }

  /**
   * Get the resolver function for a macro type
   */
  private getResolver(type: MacroType): MacroResolverFn | undefined {
    return RESOLVERS[type] ?? this.customResolvers.get(type);
  }

  /**
   * Resolve a single macro expression
   *
   * @param expression - The parsed macro expression
   * @param context - Resolution context
   * @returns Resolution result
   */
  async resolveExpression(
    expression: MacroExpression,
    context: MacroResolutionContext
  ): Promise<MacroResolveResult> {
    const resolver = this.getResolver(expression.type);

    if (!resolver) {
      return {
        success: false,
        error: `Unknown macro type: "${expression.type}". Supported: ${Object.keys(RESOLVERS).join(', ')}`,
        expression,
      };
    }

    try {
      const result = await resolver(expression, context);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Resolver error for {{${expression.type}}}: ${message}`,
        expression,
      };
    }
  }

  /**
   * Resolve all macro expressions in a text
   *
   * @param text - The text containing macro expressions
   * @param context - Resolution context
   * @returns Resolution report with resolved text and individual results
   */
  async resolve(text: string, context: MacroResolutionContext = {}): Promise<MacroResolveReport> {
    const macros = parseMacros(text);

    if (macros.length === 0) {
      return {
        resolved: text,
        results: [],
        allResolved: true,
        unresolvedCount: 0,
      };
    }

    this.logger.debug(`Resolving ${macros.length} macro(s) in text`);

    // Resolve all macros in parallel
    const results = await Promise.all(macros.map(expr => this.resolveExpression(expr, context)));

    // Replace macros in text (process from end to start to preserve positions)
    let resolved = text;
    const sortedResults = [...results]
      .map((r, i) => ({ ...r, expression: macros[i] }))
      .sort((a, b) => b.expression.start - a.expression.start);

    for (const result of sortedResults) {
      const replacement = result.success ? (result.content ?? '') : result.expression.raw; // Keep original on failure

      resolved =
        resolved.substring(0, result.expression.start) +
        replacement +
        resolved.substring(result.expression.end);
    }

    const allResolved = results.every(r => r.success);
    const unresolvedCount = results.filter(r => !r.success).length;

    if (!allResolved) {
      this.logger.warn(`${unresolvedCount}/${results.length} macro(s) failed to resolve`);
    }

    return {
      resolved,
      results,
      allResolved,
      unresolvedCount,
    };
  }

  /**
   * Check if a text contains macro expressions
   *
   * @param text - The text to check
   * @returns Whether the text contains macros
   */
  hasMacros(text: string): boolean {
    return hasMacros(text);
  }

  /**
   * Count macro expressions in a text
   *
   * @param text - The text to count
   * @returns Number of macro expressions
   */
  countMacros(text: string): number {
    return countMacros(text);
  }

  /**
   * Preview macros in a text without resolving them
   *
   * @param text - The text to preview
   * @returns Array of macro summaries
   */
  previewMacros(text: string): Array<{ type: string; args: string[] }> {
    return parseMacros(text).map(m => ({
      type: m.type,
      args: m.args,
    }));
  }
}
