/**
 * OutputFormatter - Formats conversation output for display
 *
 * Handles CLI-level text output formatting, stream formatting,
 * and error formatting. Provides standardized output formatting
 * for different display contexts.
 */

import {
  type ResponseMessage,
  ResponseType,
  type MessageSender,
  type ToolCall,
  type StreamInfo,
  type ConversationResult,
  type ToolCallResult,
  type FormattedOutput,
  OutputFormat,
  type OutputMetadata,
  ResultType,
  type Session,
  type ContextWindow,
  ContentFormat,
} from './types/index.js';
import type { ConversationError} from './errors/index.js';
import { ConversationErrorCode } from './errors/index.js';

/**
 * Output formatter options
 */
export interface OutputFormatterOptions {
  /** Default output format */
  defaultFormat?: OutputFormat;
  /** Enable colors for terminal output */
  enableColors?: boolean;
  /** Maximum line width */
  maxLineWidth?: number;
  /** Include timestamps in output */
  includeTimestamps?: boolean;
  /** Include metadata in output */
  includeMetadata?: boolean;
  /** Theme for terminal colors */
  theme?: OutputTheme;
}

/**
 * Output theme for terminal colors
 */
export interface OutputTheme {
  /** Primary color (main text) */
  primary: string;
  /** Secondary color (secondary text) */
  secondary: string;
  /** Success color */
  success: string;
  /** Error color */
  error: string;
  /** Warning color */
  warning: string;
  /** Info color */
  info: string;
  /** Muted color */
  muted: string;
}

/**
 * Default terminal theme
 */
const DEFAULT_THEME: OutputTheme = {
  primary: '\x1b[37m',      // White
  secondary: '\x1b[90m',    // Bright black (gray)
  success: '\x1b[32m',      // Green
  error: '\x1b[31m',        // Red
  warning: '\x1b[33m',      // Yellow
  info: '\x1b[36m',         // Cyan
  muted: '\x1b[2m',         // Dim
};

/**
 * ANSI color reset
 */
const RESET = '\x1b[0m';

/**
 * OutputFormatter - Formats conversation output
 */
export class OutputFormatter {
  private options: Required<OutputFormatterOptions>;

  /**
   * Create a new OutputFormatter
   * @param options - Formatter options
   */
  constructor(options: OutputFormatterOptions = {}) {
    this.options = {
      defaultFormat: options.defaultFormat ?? OutputFormat.PLAIN,
      enableColors: options.enableColors ?? false,
      maxLineWidth: options.maxLineWidth ?? 80,
      includeTimestamps: options.includeTimestamps ?? true,
      includeMetadata: options.includeMetadata ?? false,
      theme: options.theme ?? DEFAULT_THEME,
    };
  }

  // ==================== Public Methods ====================

  /**
   * Format a conversation result
   * @param result - Conversation result to format
   * @returns Formatted output
   */
  format(result: ConversationResult): FormattedOutput {
    const startTime = Date.now();

    switch (result.type) {
      case ResultType.MESSAGE:
        return this.formatMessage(result.message!, startTime);

      case ResultType.SESSION:
        return this.formatSession(result.session!, startTime);

      case ResultType.SESSION_LIST:
        return this.formatSessionList(result.sessions!, startTime);

      case ResultType.CONTEXT:
        return this.formatContext(result.contextWindow!, startTime);

      case ResultType.CONFIRMATION:
        return this.formatConfirmation(result.message!, startTime);

      case ResultType.ERROR:
        return this.formatErrorResult(result, startTime);

      default:
        return this.formatGeneric(result, startTime);
    }
  }

  /**
   * Format an error for display
   * @param error - Conversation error
   * @returns Formatted error output
   */
  formatError(error: ConversationError): FormattedOutput {
    const startTime = Date.now();

    let text = '';
    const code = error.code;
    const message = error.message;

    if (this.options.enableColors) {
      text = `${this.options.theme.error}[ERROR]${RESET} ${message}`;
      if (error.details) {
        text += `\n${this.options.theme.muted}Details: ${JSON.stringify(error.details, null, 2)}${RESET}`;
      }
    } else {
      text = `[ERROR] ${message}`;
      if (error.details) {
        text += `\nDetails: ${JSON.stringify(error.details, null, 2)}`;
      }
    }

    return {
      text,
      format: OutputFormat.TERMINAL,
      metadata: {
        executionTime: Date.now() - startTime,
        pluginVersion: '1.0.0',
        sessionId: error.details && typeof error.details === 'object' && 'sessionId' in error.details
          ? (error.details as { sessionId?: string }).sessionId
          : undefined,
      },
    };
  }

  /**
   * Format a streaming chunk
   * @param chunk - Stream chunk data
   * @returns Formatted chunk string
   */
  formatStream(chunk: unknown): string {
    if (typeof chunk === 'string') {
      return this.formatStreamText(chunk);
    }

    if (chunk && typeof chunk === 'object') {
      const obj = chunk as Record<string, unknown>;

      // Check for text content
      if (obj.text || obj.content) {
        return this.formatStreamText((obj.text ?? obj.content) as string);
      }

      // Check for tool call
      if (obj.tool_call) {
        return this.formatStreamToolCall(obj.tool_call as ToolCall);
      }

      // Check for status update
      if (obj.status) {
        return this.formatStreamStatus(obj);
      }

      // Generic object formatting
      return this.formatStreamText(JSON.stringify(chunk));
    }

    return String(chunk);
  }

  /**
   * Format a success message
   * @param message - Success message text
   * @param metadata - Optional metadata
   * @returns Formatted output
   */
  formatSuccess(message: string, metadata?: Partial<OutputMetadata>): FormattedOutput {
    const startTime = Date.now();

    let text = message;
    if (this.options.enableColors) {
      text = `${this.options.theme.success}[OK]${RESET} ${message}`;
    } else {
      text = `[OK] ${message}`;
    }

    return {
      text,
      format: OutputFormat.TERMINAL,
      metadata: {
        executionTime: Date.now() - startTime,
        pluginVersion: '1.0.0',
        ...metadata,
      },
    };
  }

  /**
   * Format a warning message
   * @param message - Warning message text
   * @param metadata - Optional metadata
   * @returns Formatted output
   */
  formatWarning(message: string, metadata?: Partial<OutputMetadata>): FormattedOutput {
    const startTime = Date.now();

    let text = message;
    if (this.options.enableColors) {
      text = `${this.options.theme.warning}[WARN]${RESET} ${message}`;
    } else {
      text = `[WARN] ${message}`;
    }

    return {
      text,
      format: OutputFormat.TERMINAL,
      metadata: {
        executionTime: Date.now() - startTime,
        pluginVersion: '1.0.0',
        ...metadata,
      },
    };
  }

  /**
   * Format a status update
   * @param status - Status information
   * @returns Formatted output
   */
  formatStatus(status: Record<string, unknown>): FormattedOutput {
    const startTime = Date.now();

    let text = this.formatJSON(status);

    if (this.options.enableColors) {
      text = `${this.options.theme.info}[STATUS]${RESET}\n${text}`;
    } else {
      text = `[STATUS]\n${text}`;
    }

    return {
      text,
      format: OutputFormat.JSON,
      metadata: {
        executionTime: Date.now() - startTime,
        pluginVersion: '1.0.0',
      },
    };
  }

  /**
   * Format tool call results
   * @param results - Tool call results
   * @returns Formatted output
   */
  formatToolResults(results: ToolCallResult[]): FormattedOutput {
    const startTime = Date.now();
    let text = '';

    for (const result of results) {
      if (this.options.enableColors) {
        const prefix = result.success
          ? `${this.options.theme.success}[TOOL]${RESET}`
          : `${this.options.theme.error}[TOOL]${RESET}`;
        text += `${prefix} ${result.toolName} (${result.executionTime}ms)\n`;

        if (result.success) {
          text += `  Result: ${this.formatJSON(result.result)}\n`;
        } else if (result.error) {
          text += `  ${this.options.theme.error}Error: ${result.error.message}${RESET}\n`;
        }
      } else {
        text += `[TOOL] ${result.toolName} (${result.executionTime}ms)\n`;
        if (result.success) {
          text += `  Result: ${this.formatJSON(result.result)}\n`;
        } else if (result.error) {
          text += `  Error: ${result.error.message}\n`;
        }
      }
    }

    return {
      text,
      format: OutputFormat.TERMINAL,
      metadata: {
        executionTime: Date.now() - startTime,
        pluginVersion: '1.0.0',
      },
    };
  }

  /**
   * Format response message
   * @param message - Response message
   * @param startTime - Start timestamp for execution time
   * @returns Formatted output
   */
  formatMessage(message: ResponseMessage, startTime: number): FormattedOutput {
    let text = message.content.text;

    // Apply formatting based on content format
    if (message.content.format === ContentFormat.MARKDOWN) {
      text = this.formatMarkdown(text);
    }

    // Add tool calls if present
    if (message.toolCalls && message.toolCalls.length > 0) {
      const toolText = message.toolCalls.map((tc) =>
        this.formatToolCallShort(tc)
      ).join('\n');
      text += `\n\n${toolText}`;
    }

    // Add timestamps if enabled
    if (this.options.includeTimestamps) {
      const timestamp = new Date(message.timestamp).toISOString();
      if (this.options.enableColors) {
        text = `${this.options.theme.muted}[${timestamp}]${RESET}\n${text}`;
      } else {
        text = `[${timestamp}]\n${text}`;
      }
    }

    return {
      text,
      format: message.content.format === ContentFormat.MARKDOWN ? OutputFormat.MARKDOWN : this.options.defaultFormat,
      metadata: {
        executionTime: Date.now() - startTime,
        pluginVersion: '1.0.0',
        messageId: message.id,
        stream: message.stream?.isFinal === false,
      },
    };
  }

  /**
   * Format session information
   * @param session - Session object
   * @param startTime - Start timestamp
   * @returns Formatted output
   */
  formatSession(session: Session, startTime: number): FormattedOutput {
    const lines: string[] = [];

    lines.push(this.formatSection('Session Information', [
      `ID: ${session.id ?? 'N/A'}`,
      `Title: ${session.title ?? 'Untitled'}`,
      `Status: ${session.status ?? 'unknown'}`,
      `Created: ${session.createdAt ? new Date(session.createdAt).toISOString() : 'N/A'}`,
      `Last Active: ${session.lastActiveAt ? new Date(session.lastActiveAt).toISOString() : 'N/A'}`,
      `Messages: ${session.messageCount ?? 0}`,
    ]));

    if (session.tags && session.tags.length > 0) {
      lines.push(`Tags: ${session.tags.join(', ')}`);
    }

    return {
      text: lines.join('\n'),
      format: OutputFormat.TERMINAL,
      metadata: {
        executionTime: Date.now() - startTime,
        pluginVersion: '1.0.0',
        sessionId: session.id ?? undefined,
      },
    };
  }

  /**
   * Format session list
   * @param sessions - Array of sessions
   * @param startTime - Start timestamp
   * @returns Formatted output
   */
  formatSessionList(sessions: Session[], startTime: number): FormattedOutput {
    if (sessions.length === 0) {
      return this.formatSuccess('No active sessions');
    }

    const lines: string[] = [];
    lines.push(`Active Sessions (${sessions.length}):\n`);

    for (const session of sessions) {
      const statusIcon = this.getStatusIcon(session.status);
      const line = `${statusIcon} ${session.id?.substring(0, 8) ?? 'unknown'} - ${session.title ?? 'Untitled'} (${session.messageCount ?? 0} messages)`;
      lines.push(line);
    }

    return {
      text: lines.join('\n'),
      format: OutputFormat.TERMINAL,
      metadata: {
        executionTime: Date.now() - startTime,
        pluginVersion: '1.0.0',
        sessionId: undefined,
      },
    };
  }

  /**
   * Format context window
   * @param context - Context window object
   * @param startTime - Start timestamp
   * @returns Formatted output
   */
  formatContext(context: ContextWindow, startTime: number): FormattedOutput {
    const lines: string[] = [];

    lines.push(this.formatSection('Context Window', [
      `ID: ${context.id ?? 'N/A'}`,
      `Session: ${context.sessionId ?? 'N/A'}`,
      `Messages: ${context.messageCount ?? 0}`,
      `Tokens: ${context.tokenCount ?? 'N/A'}`,
    ]));

    if (context.config) {
      lines.push(this.formatSection('Configuration', [
        `Window Size: ${context.config.windowSize ?? 'N/A'}`,
        `Window Type: ${context.config.windowType ?? 'N/A'}`,
        `Include System: ${context.config.includeSystemMessages ?? true}`,
        `Include Tool Calls: ${context.config.includeToolCalls ?? true}`,
      ]));
    }

    return {
      text: lines.join('\n'),
      format: OutputFormat.TERMINAL,
      metadata: {
        executionTime: Date.now() - startTime,
        pluginVersion: '1.0.0',
        sessionId: context.sessionId,
      },
    };
  }

  /**
   * Format confirmation request
   * @param message - Confirmation message
   * @param startTime - Start timestamp
   * @returns Formatted output
   */
  formatConfirmation(message: ResponseMessage, startTime: number): FormattedOutput {
    let text = message.content.text;

    if (this.options.enableColors) {
      text = `${this.options.theme.warning}${text}${RESET}`;
    }

    text += '\n\nPlease confirm (yes/no): ';

    return {
      text,
      format: OutputFormat.TERMINAL,
      metadata: {
        executionTime: Date.now() - startTime,
        pluginVersion: '1.0.0',
      },
    };
  }

  // ==================== Private Methods ====================

  /**
   * Format generic result
   */
  private formatGeneric(result: ConversationResult, startTime: number): FormattedOutput {
    return {
      text: this.formatJSON(result),
      format: OutputFormat.JSON,
      metadata: {
        executionTime: Date.now() - startTime,
        pluginVersion: '1.0.0',
      },
    };
  }

  /**
   * Format error result
   */
  private formatErrorResult(result: ConversationResult, startTime: number): FormattedOutput {
    // If we have a message, format it as error
    if (result.message) {
      return this.formatMessage(result.message, startTime);
    }

    // Otherwise format as generic error
    return this.formatGeneric(result, startTime);
  }

  /**
   * Format stream text
   */
  private formatStreamText(text: string): string {
    return text;
  }

  /**
   * Format stream tool call
   */
  private formatStreamToolCall(toolCall: ToolCall): string {
    return `[TOOL] ${toolCall.name}`;
  }

  /**
   * Format stream status
   */
  private formatStreamStatus(data: Record<string, unknown>): string {
    return `[STATUS] ${data.status}`;
  }

  /**
   * Format tool call in short form
   */
  private formatToolCallShort(toolCall: ToolCall): string {
    return `[TOOL] ${toolCall.name}`;
  }

  /**
   * Format JSON
   */
  private formatJSON(data: unknown): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Format markdown (simplified)
   */
  private formatMarkdown(text: string): string {
    // Basic markdown processing
    return text
      .replace(/^### (.*)$/gm, `${this.options.theme.secondary}$1${RESET}`)
      .replace(/^## (.*)$/gm, `\n${this.options.theme.secondary}$1${RESET}\n`)
      .replace(/^# (.*)$/gm, `\n${this.options.theme.primary}$1${RESET}\n`)
      .replace(/\*\*(.*?)\*\*/g, `${this.options.theme.primary}$1${RESET}`)
      .replace(/`([^`]+)`/g, `${this.options.theme.info}$1${RESET}`);
  }

  /**
   * Format a section with title and content
   */
  private formatSection(title: string, lines: string[]): string {
    const separator = '─'.repeat(Math.min(title.length, this.options.maxLineWidth));
    let text = `${title}\n${separator}\n`;

    if (this.options.enableColors) {
      text = `${this.options.theme.secondary}${text}${RESET}`;
    }

    text += lines.join('\n');
    return text;
  }

  /**
   * Get status icon for session
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'active':
        return this.options.enableColors ? `${this.options.theme.success}●${RESET}` : '●';
      case 'idle':
        return this.options.enableColors ? `${this.options.theme.warning}○${RESET}` : '○';
      case 'closed':
        return this.options.enableColors ? `${this.options.theme.muted}●${RESET}` : '●';
      default:
        return '○';
    }
  }
}