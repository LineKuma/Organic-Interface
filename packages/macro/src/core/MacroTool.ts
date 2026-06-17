/**
 * Macro Tool - AI-invocable tool for macro resolution
 *
 * Implements the Tool interface from @organic/tools so that
 * AI agents can autonomously resolve macro expressions in their
 * requests. This allows AI to:
 *
 * - Retrieve conversation history via {{history:...}}
 * - Look up system prompts via {{system:...}}
 * - Read file contents via {{file:...}}
 * - Access environment variables via {{env:...}}
 *
 * The tool can be registered with the ToolService and invoked
 * by AI agents through the standard tool calling mechanism.
 */

import { createLogger, type Logger } from '@organic/utils';

import type { MacroToolParams, MacroToolResult, MacroResolutionContext } from '../types/macro.js';

import type {
  Tool,
  ToolDefinition,
  ToolResult,
  ToolExecutionContext,
  ToolValidationError,
} from '@organic/tools';

import { MacroResolver } from './MacroResolver.js';

/** Tool definition for the macro tool */
const MACRO_TOOL_DEFINITION: ToolDefinition = {
  id: 'resolve_macros',
  name: 'resolve_macros',
  description:
    'Resolve macro expressions in text. Supports: {{system:name}} for system prompts, {{file:path}} for file contents, {{env:VAR}} for environment variables, {{history:context_id}} for conversation history with range/filter support.',
  category: 'custom',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text containing macro expressions to resolve',
      },
      contextId: {
        type: 'string',
        description:
          'Context ID for history macros. Use "current" for the active conversation context.',
      },
      historyRange: {
        type: 'object',
        description: 'Range specification for history macros',
        properties: {
          lastN: {
            type: 'number',
            description: 'Get the last N messages from history',
          },
          firstN: {
            type: 'number',
            description: 'Get the first N messages from history',
          },
          range: {
            type: 'object',
            properties: {
              start: { type: 'number', description: 'Start index (inclusive)' },
              end: { type: 'number', description: 'End index (exclusive)' },
            },
          },
          filter: {
            type: 'object',
            properties: {
              sender: {
                type: 'string',
                description: 'Filter by sender type (user, agent, system, plugin)',
              },
              type: { type: 'string', description: 'Filter by message type' },
              contains: { type: 'string', description: 'Filter by content substring' },
            },
          },
        },
      },
      systemPrompts: {
        type: 'object',
        description: 'System prompts to make available for resolution',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['text'],
  },
  enabled: true,
  timeout: 30000,
};

/**
 * Macro Tool - AI-invocable macro resolution
 *
 * This tool wraps the MacroResolver and exposes it as a standard
 * tool that AI agents can call. The tool accepts a text containing
 * macro expressions and returns the resolved text.
 *
 * @example AI usage:
 * ```json
 * {
 *   "tool": "resolve_macros",
 *   "parameters": {
 *     "text": "Previous conversation: {{history:current:last:5}}",
 *     "contextId": "current"
 *   }
 * }
 * ```
 */
export class MacroTool implements Tool {
  private resolver: MacroResolver;
  private logger: Logger;

  /** Context provider for resolution */
  private contextProvider?: () => MacroResolutionContext;

  constructor(options?: {
    resolver?: MacroResolver;
    contextProvider?: () => MacroResolutionContext;
    logger?: Logger;
  }) {
    this.resolver = options?.resolver ?? new MacroResolver();
    this.contextProvider = options?.contextProvider;
    this.logger = options?.logger ?? createLogger({ prefix: 'MacroTool' });
  }

  /**
   * Set the context provider for resolution
   */
  setContextProvider(provider: () => MacroResolutionContext): void {
    this.contextProvider = provider;
  }

  /**
   * Get the tool definition
   */
  getDefinition(): ToolDefinition {
    return { ...MACRO_TOOL_DEFINITION };
  }

  /**
   * Validate input parameters
   */
  validate(input: unknown): ToolValidationError[] {
    const errors: ToolValidationError[] = [];

    if (!input || typeof input !== 'object') {
      errors.push({
        path: '',
        message: 'Input must be an object',
      });
      return errors;
    }

    const params = input as Record<string, unknown>;

    if (!params.text || typeof params.text !== 'string') {
      errors.push({
        path: 'text',
        message: 'Parameter "text" is required and must be a string',
      });
    }

    if (
      params.text &&
      typeof params.text === 'string' &&
      !this.resolver.hasMacros(params.text as string)
    ) {
      errors.push({
        path: 'text',
        message: 'Text contains no macro expressions to resolve',
      });
    }

    return errors;
  }

  /**
   * Execute the macro tool
   */
  async execute(
    input: unknown,
    _context: ToolExecutionContext
  ): Promise<ToolResult<MacroToolResult>> {
    const startTime = Date.now();
    const params = input as MacroToolParams;

    try {
      // Build resolution context
      const baseContext = this.contextProvider?.() ?? {};
      const resolutionContext: MacroResolutionContext = {
        ...baseContext,
        currentContextId: params.contextId ?? baseContext.currentContextId,
        systemPrompts: params.systemPrompts ?? baseContext.systemPrompts,
      };

      // Resolve macros
      const report = await this.resolver.resolve(params.text, resolutionContext);

      const result: MacroToolResult = {
        resolved: report.resolved,
        results: report.results,
        allResolved: report.allResolved,
        macroCount: report.results.length,
      };

      const elapsed = Date.now() - startTime;
      this.logger.info(
        `Macro resolution complete: ${report.results.length} macros, ${report.unresolvedCount} unresolved, ${elapsed}ms`
      );

      return {
        success: true,
        data: result,
        executionTime: elapsed,
        metadata: {
          duration: elapsed,
          macroCount: report.results.length,
          unresolvedCount: report.unresolvedCount,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const elapsed = Date.now() - startTime;
      this.logger.error(`Macro resolution failed: ${message}`);

      return {
        success: false,
        error: `Macro resolution failed: ${message}`,
        executionTime: elapsed,
        metadata: {
          duration: elapsed,
        },
      };
    }
  }
}
