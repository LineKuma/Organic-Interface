/**
 * Core macro expression types
 *
 * Defines the macro expression syntax, resolution context,
 * and result types for the macro system.
 */

import type { Message } from '@organic/agent';

// ── Macro Expression ─────────────────────────────────────────────

/**
 * Supported macro types
 *
 * - system: Insert system prompt content
 * - file: Insert file content from disk
 * - env: Insert environment variable value
 * - history: Insert conversation history
 */
export type MacroType = 'system' | 'file' | 'env' | 'history';

/**
 * A parsed macro expression
 *
 * Syntax: {{type:arg1:arg2:...}}
 *
 * Examples:
 *   {{system:code-assistant}}
 *   {{file:./prompts/creative.txt}}
 *   {{env:OPENAI_API_KEY}}
 *   {{history:current}}
 *   {{history:ctx_abc123:last:5}}
 *   {{history:ctx_abc123:range:3:10}}
 *   {{history:ctx_abc123:filter:sender:user}}
 */
export interface MacroExpression {
  /** The macro type */
  type: MacroType;
  /** Raw expression text */
  raw: string;
  /** Positional arguments after the type */
  args: string[];
  /** Start position in the source text */
  start: number;
  /** End position in the source text */
  end: number;
}

// ── History Query ────────────────────────────────────────────────

/** History range specification */
export interface HistoryRange {
  /** Start index (inclusive) */
  start?: number;
  /** End index (exclusive) */
  end?: number;
}

/** History filter specification */
export interface HistoryFilter {
  /** Filter by sender type */
  sender?: string;
  /** Filter by message type */
  type?: string;
  /** Filter by content substring */
  contains?: string;
}

/** Parameters for a history macro */
export interface HistoryQuery {
  /** Context ID - "current" for active context, or specific context ID */
  contextId: string;
  /** Range specification */
  range?: HistoryRange;
  /** Filter specification */
  filter?: HistoryFilter;
  /** Number of last N messages */
  lastN?: number;
  /** Number of first N messages */
  firstN?: number;
}

// ── Resolution Context ───────────────────────────────────────────

/** Context provided to the macro resolver */
export interface MacroResolutionContext {
  /** Current conversation context ID (for "current" history refs) */
  currentContextId?: string;
  /** Available system prompts (name -> content) */
  systemPrompts?: Record<string, string>;
  /** Function to retrieve messages for a context ID */
  getMessages?: (contextId: string) => Promise<Message[]> | Message[];
  /** Function to resolve file paths */
  resolveFilePath?: (path: string) => Promise<string> | string;
  /** Current working directory */
  cwd?: string;
  /** Additional variables */
  variables?: Record<string, string>;
}

/** Result of resolving a single macro expression */
export interface MacroResolveResult {
  /** Whether resolution succeeded */
  success: boolean;
  /** The resolved content */
  content?: string;
  /** Error message if failed */
  error?: string;
  /** The original expression */
  expression: MacroExpression;
}

/** Result of resolving all macros in a text */
export interface MacroResolveReport {
  /** The text with all macros resolved */
  resolved: string;
  /** Individual resolution results */
  results: MacroResolveResult[];
  /** Whether all macros were resolved successfully */
  allResolved: boolean;
  /** Unresolved expression count */
  unresolvedCount: number;
}

// ── Macro Tool Definition ────────────────────────────────────────

/** Parameters for the macro tool (AI-invocable) */
export interface MacroToolParams {
  /** The text containing macro expressions to resolve */
  text: string;
  /** Context ID for history macros (defaults to current) */
  contextId?: string;
  /** Parameters for history macros */
  historyRange?: {
    lastN?: number;
    firstN?: number;
    range?: HistoryRange;
    filter?: HistoryFilter;
  };
  /** System prompts to make available */
  systemPrompts?: Record<string, string>;
}

/** Result of the macro tool */
export interface MacroToolResult {
  /** The resolved text */
  resolved: string;
  /** Individual resolution results */
  results: MacroResolveResult[];
  /** Whether all macros were resolved successfully */
  allResolved: boolean;
  /** Number of macros resolved */
  macroCount: number;
}
