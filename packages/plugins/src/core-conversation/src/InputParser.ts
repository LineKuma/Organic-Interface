/**
 * InputParser - Parses user input for conversation plugin
 *
 * Handles CLI-level text input parsing, intent extraction, and validation.
 * Provides standardized parsing for different input formats.
 */

import {
  type ParsedInput,
  InputType,
  type InputOptions,
  type InputMetadata,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type Message,
  MessageSender,
} from './types/index.js';

/**
 * Regular expression patterns for command parsing
 */
const JSON_PATTERN = /^\s*[\[{]/;
const QUOTED_PATTERN = /^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/;

/**
 * Input parser options
 */
export interface InputParserOptions {
  /** Maximum input length */
  maxLength?: number;
  /** Enable command parsing */
  enableCommands?: boolean;
  /** Command prefixes to recognize */
  commandPrefixes?: string[];
  /** Strip whitespace */
  stripWhitespace?: boolean;
  /** Enable intent extraction */
  enableIntentExtraction?: boolean;
}

/**
 * Intent pattern definitions
 */
interface IntentPattern {
  pattern: RegExp;
  intent: string;
  extractParams?: (match: RegExpMatchArray) => Record<string, unknown>;
}

/**
 * InputParser - Parses and validates user input
 */
export class InputParser {
  private options: Required<InputParserOptions>;
  private intentPatterns: IntentPattern[] = [];

  /**
   * Create a new InputParser
   * @param options - Parser options
   */
  constructor(options: InputParserOptions = {}) {
    this.options = {
      maxLength: options.maxLength ?? 10000,
      enableCommands: options.enableCommands ?? true,
      commandPrefixes: options.commandPrefixes ?? ['/'],
      stripWhitespace: options.stripWhitespace ?? true,
      enableIntentExtraction: options.enableIntentExtraction ?? true,
    };

    // Register default intent patterns
    this.registerDefaultIntents();
  }

  // ==================== Public Methods ====================

  /**
   * Parse raw user input
   * @param rawInput - Raw input text
   * @returns Parsed input result
   */
  parse(rawInput: string): ParsedInput {
    const startTime = Date.now();

    // Validate input exists
    if (!rawInput || typeof rawInput !== 'string') {
      return this.createParsedInput(rawInput ?? '', InputType.TEXT, {
        timestamp: startTime,
        originalLength: 0,
      });
    }

    // Apply whitespace stripping
    let normalized = rawInput;
    if (this.options.stripWhitespace) {
      normalized = rawInput.trim();
    }

    // Check length
    if (normalized.length > this.options.maxLength) {
      normalized = normalized.substring(0, this.options.maxLength);
    }

    // Determine input type and extract components
    let type = InputType.TEXT;
    let command: string | undefined;
    let arguments_: Record<string, unknown> | undefined;
    let options: InputOptions | undefined;

    // Try command parsing
    if (this.options.enableCommands) {
      const commandResult = this.parseCommand(normalized);
      if (commandResult) {
        type = InputType.COMMAND;
        command = commandResult.command;
        arguments_ = commandResult.arguments;
        options = commandResult.options;
      }
    }

    // Try JSON parsing
    if (type === InputType.TEXT && JSON_PATTERN.test(normalized)) {
      const jsonResult = this.tryParseJSON(normalized);
      if (jsonResult) {
        type = InputType.TEXT;
        arguments_ = jsonResult;
      }
    }

    // Extract intent if enabled
    if (this.options.enableIntentExtraction && type === InputType.TEXT) {
      const intent = this.extractIntent(normalized);
      if (intent) {
        options = { ...options, intent };
      }
    }

    return this.createParsedInput(normalized, type, {
      timestamp: startTime,
      originalLength: rawInput.length,
      tokenEstimate: this.estimateTokens(normalized),
    }, command, arguments_, options);
  }

  /**
   * Validate parsed input
   * @param input - Parsed input to validate
   * @returns Validation result
   */
  validate(input: ParsedInput): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check empty input
    if (!input.normalizedText || input.normalizedText.length === 0) {
      errors.push({
        code: 'EMPTY_INPUT',
        message: 'Input cannot be empty',
        field: 'content',
      });
    }

    // Check input length
    if (input.metadata.originalLength > this.options.maxLength) {
      warnings.push({
        code: 'TRUNCATED',
        message: `Input was truncated to ${this.options.maxLength} characters`,
      });
    }

    // Validate command format
    if (input.type === InputType.COMMAND) {
      if (!input.command) {
        errors.push({
          code: 'INVALID_COMMAND',
          message: 'Command name is required',
          field: 'command',
        });
      } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.command)) {
        errors.push({
          code: 'INVALID_COMMAND_FORMAT',
          message: 'Command name must be alphanumeric with underscores',
          field: 'command',
          position: 1,
        });
      }
    }

    // Validate arguments
    if (input.arguments !== undefined) {
      for (const [key, value] of Object.entries(input.arguments)) {
        if (typeof key !== 'string') {
          errors.push({
            code: 'INVALID_ARGUMENT_KEY',
            message: 'Argument keys must be strings',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Extract intent from text
   * @param text - Input text
   * @returns Intent string or null
   */
  extractIntent(text: string): string | null {
    for (const pattern of this.intentPatterns) {
      const match = text.match(pattern.pattern);
      if (match) {
        return pattern.intent;
      }
    }
    return null;
  }

  /**
   * Extract parameters from input using intent patterns
   * @param text - Input text
   * @returns Extracted parameters or empty object
   */
  extractParameters(text: string): Record<string, unknown> {
    for (const pattern of this.intentPatterns) {
      const match = text.match(pattern.pattern);
      if (match && pattern.extractParams) {
        return pattern.extractParams(match);
      }
    }
    return {};
  }

  /**
   * Get help text for commands
   * @returns Help text
   */
  getHelp(): string {
    return `Available commands:
  /help              - Show this help message
  /status            - Show current session status
  /context           - Show context window info
  /clear             - Clear current conversation
  /save              - Save current session
  /quit              - End current session

Usage:
  - Type a message to chat with the assistant
  - Use /command to execute built-in commands
  - Use "key: value" format for structured input`;
  }

  /**
   * Register a custom intent pattern
   * @param pattern - Regex pattern
   * @param intent - Intent name
   * @param extractParams - Optional parameter extractor
   */
  registerIntent(
    pattern: RegExp,
    intent: string,
    extractParams?: (match: RegExpMatchArray) => Record<string, unknown>
  ): void {
    this.intentPatterns.push({ pattern, intent, extractParams });
  }

  /**
   * Create a message from parsed input
   * @param input - Parsed input
   * @param sessionId - Optional session ID
   * @returns Message object
   */
  createMessage(input: ParsedInput, sessionId?: string): Message {
    return {
      id: this.generateMessageId(),
      content: input.normalizedText,
      sender: MessageSender.USER,
      timestamp: Date.now(),
      sessionId,
      metadata: {
        type: input.type,
        command: input.command,
        arguments: input.arguments,
        options: input.options,
      },
    };
  }

  // ==================== Private Methods ====================

  /**
   * Register default intent patterns
   */
  private registerDefaultIntents(): void {
    // Help intent
    this.registerIntent(/\b(help|assist|support)\b/i, 'help');

    // Question intent
    this.registerIntent(/\b(what|how|why|when|where|who)\b/i, 'question');

    // Code intent
    this.registerIntent(/\b(code|implement|write|create|function|class)\b/i, 'code');

    // Search intent
    this.registerIntent(/\b(search|find|look|query)\b/i, 'search');

    // Modify intent
    this.registerIntent(/\b(edit|change|update|modify|fix)\b/i, 'modify');

    // Delete intent
    this.registerIntent(/\b(delete|remove|clear|drop)\b/i, 'delete');

    // List intent
    this.registerIntent(/\b(list|show|display|get|retrieve)\b/i, 'list');
  }

  /**
   * Parse command-style input
   */
  private parseCommand(text: string): { command: string; arguments: Record<string, unknown>; options: InputOptions } | null {
    for (const prefix of this.options.commandPrefixes) {
      if (text.startsWith(prefix)) {
        const match = text.match(new RegExp(`^${prefix.replace('/', '\\/')}(\\w+)(?:\\s+(.*))?$`));
        if (match) {
          const [, command, argsStr] = match;
          const args = this.parseArguments(argsStr || '');

          return {
            command,
            arguments: args.args,
            options: { ...args.options, rawArgs: argsStr },
          };
        }
      }
    }
    return null;
  }

  /**
   * Parse argument string into key-value pairs
   */
  private parseArguments(argsStr: string): { args: Record<string, unknown>; options: InputOptions } {
    const args: Record<string, unknown> = {};
    const options: InputOptions = {};

    if (!argsStr.trim()) {
      return { args, options };
    }

    // Split by whitespace but respect quotes
    const tokens = this.tokenize(argsStr);

    for (const token of tokens) {
      // Check for key: value pattern
      const colonIndex = token.indexOf(':');
      if (colonIndex > 0) {
        const key = token.substring(0, colonIndex).trim();
        let value: unknown = token.substring(colonIndex + 1).trim();

        // Parse value type
        value = this.parseValue(value as string);

        args[key] = value;
      } else {
        // Positional argument
        const existingPositional = Object.keys(args).filter((k) => k.startsWith('_pos')).length;
        args[`_pos${existingPositional}`] = this.parseValue(token);
      }
    }

    return { args, options };
  }

  /**
   * Tokenize argument string
   */
  private tokenize(str: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote: string | null = null;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (inQuote) {
        if (char === inQuote) {
          inQuote = null;
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inQuote = char;
      } else if (/\s/.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Parse value to appropriate type
   */
  private parseValue(value: string): unknown {
    // Remove quotes if present
    const unquoted = value.replace(/^["']|["']$/g, '');

    // Try boolean
    if (unquoted === 'true') return true;
    if (unquoted === 'false') return false;
    if (unquoted === 'null') return null;

    // Try number
    const num = Number(unquoted);
    if (!isNaN(num) && unquoted.trim() !== '') {
      return num;
    }

    // Return as string
    return unquoted;
  }

  /**
   * Try to parse as JSON
   */
  private tryParseJSON(text: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not valid JSON
    }
    return null;
  }

  /**
   * Create parsed input object
   */
  private createParsedInput(
    text: string,
    type: InputType,
    metadata: InputMetadata,
    command?: string,
    arguments_?: Record<string, unknown>,
    options?: InputOptions
  ): ParsedInput {
    return {
      type,
      rawText: text,
      normalizedText: text,
      command,
      arguments: arguments_,
      options,
      metadata,
    };
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `msg_${timestamp}_${random}`;
  }
}