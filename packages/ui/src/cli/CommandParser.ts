/**
 * Command parser for CLI
 */

import type { Command, CommandArgument, CommandOption, CommandResult } from './Command.js';
import { createLogger, type Logger } from '@organic/utils';

/**
 * Parsed command input
 */
export interface ParsedInput {
  /** Command name */
  command: string;
  /** Positional arguments */
  args: Record<string, string>;
  /** Options */
  options: Record<string, string | boolean | number>;
  /** Remaining raw arguments */
  raw: string[];
}

/**
 * Parse result with error handling
 */
export interface ParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Parsed input if successful */
  parsed?: ParsedInput;
  /** Error message if failed */
  error?: string;
}

/**
 * Command parser class
 */
export class CommandParser {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ prefix: 'parser' });
  }

  /**
   * Parse command line input
   */
  parse(input: string): ParseResult {
    try {
      const tokens = this.tokenize(input);
      if (tokens.length === 0) {
        return { success: false, error: 'Empty input' };
      }

      const { options, args: positionalArgs } = this.parseTokens(tokens);
      const command = tokens[0];

      return {
        success: true,
        parsed: {
          command,
          options,
          args: this.mapPositionalArgs(positionalArgs),
          raw: positionalArgs,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Parse error',
      };
    }
  }

  /**
   * Validate parsed input against command definition
   */
  validate(
    parsed: ParsedInput,
    command: Command
  ): { valid: boolean; error?: string } {
    // Check required arguments
    if (command.arguments) {
      for (const arg of command.arguments) {
        if (arg.required && !parsed.args[arg.name]) {
          return { valid: false, error: `Missing required argument: ${arg.name}` };
        }
      }
    }

    // Check required options
    if (command.options) {
      for (const opt of command.options) {
        if (opt.required && !(opt.long in parsed.options)) {
          return { valid: false, error: `Missing required option: --${opt.long}` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Extract arguments for command handler
   */
  extractArgs(
    parsed: ParsedInput,
    command: Command
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Add positional arguments
    if (command.arguments) {
      for (const arg of command.arguments) {
        result[arg.name] = parsed.args[arg.name] ?? arg.defaultValue;
      }
    }

    // Add options with type conversion
    if (command.options) {
      for (const opt of command.options) {
        if (opt.long in parsed.options) {
          const value = parsed.options[opt.long];
          result[opt.long] = this.convertValue(value, opt.valueType ?? 'string');
        } else if (opt.defaultValue !== undefined) {
          result[opt.long] = opt.defaultValue;
        }
      }
    }

    return result;
  }

  /**
   * Tokenize input string
   */
  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (inQuotes) {
        if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        } else {
          current += char;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inQuotes = true;
        quoteChar = char;
        continue;
      }

      if (char === ' ' || char === '\t') {
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (current.length > 0) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Parse tokens into options and positional arguments
   */
  private parseTokens(tokens: string[]): {
    options: Record<string, string | boolean | number>;
    args: string[];
  } {
    const options: Record<string, string | boolean | number> = {};
    const args: string[] = [];

    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.startsWith('--')) {
        const opt = token.slice(2);
        const eqIndex = opt.indexOf('=');

        if (eqIndex !== -1) {
          const key = opt.slice(0, eqIndex);
          const value = opt.slice(eqIndex + 1);
          options[key] = this.parseOptionValue(value);
        } else {
          // Check if next token is a value
          if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
            options[opt] = this.parseOptionValue(tokens[++i]);
          } else {
            options[opt] = true;
          }
        }
      } else if (token.startsWith('-')) {
        const opt = token.slice(1);
        const eqIndex = opt.indexOf('=');

        if (eqIndex !== -1) {
          const key = opt.slice(0, eqIndex);
          const value = opt.slice(eqIndex + 1);
          options[key] = this.parseOptionValue(value);
        } else {
          // Check if next token is a value
          if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
            options[opt] = this.parseOptionValue(tokens[++i]);
          } else {
            options[opt] = true;
          }
        }
      } else {
        args.push(token);
      }
    }

    return { options, args };
  }

  /**
   * Map positional arguments to their definitions
   */
  private mapPositionalArgs(args: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    args.forEach((arg, index) => {
      result[`arg${index}`] = arg;
    });
    return result;
  }

  /**
   * Convert option value to appropriate type
   */
  private parseOptionValue(value: string): string | boolean | number {
    // Try boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Try number
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') {
      return num;
    }

    return value;
  }

  /**
   * Convert value to specific type
   */
  private convertValue(
    value: string | boolean | number,
    type: 'string' | 'number' | 'boolean'
  ): string | number | boolean {
    switch (type) {
      case 'number':
        return typeof value === 'number' ? value : Number(value);
      case 'boolean':
        return typeof value === 'boolean' ? value : value === 'true';
      case 'string':
      default:
        return String(value);
    }
  }

  /**
   * Format help text for a command
   */
  formatHelp(command: Command): string {
    const lines: string[] = [];

    // Command name and description
    lines.push(`\n${command.name} - ${command.description}\n`);

    // Usage
    let usage = `Usage: ${command.name}`;
    if (command.arguments && command.arguments.length > 0) {
      usage += ' ' + command.arguments
        .map(a => a.required ? `<${a.name}>` : `[${a.name}]`)
        .join(' ');
    }
    if (command.options && command.options.length > 0) {
      usage += ' [options]';
    }
    if (command.subcommands && command.subcommands.size > 0) {
      usage += ' <subcommand>';
    }
    lines.push(usage + '\n');

    // Arguments
    if (command.arguments && command.arguments.length > 0) {
      lines.push('Arguments:');
      for (const arg of command.arguments) {
        const required = arg.required ? '(required)' : '(optional)';
        lines.push(`  ${arg.name.padEnd(16)} ${required} ${arg.description}`);
      }
      lines.push('');
    }

    // Options
    if (command.options && command.options.length > 0) {
      lines.push('Options:');
      for (const opt of command.options) {
        const flags: string[] = [];
        if (opt.short) flags.push(`-${opt.short}`);
        flags.push(`--${opt.long}`);
        if (opt.valueType && opt.valueType !== 'boolean') {
          flags.push(`<${opt.valueType}>`);
        }

        const flagStr = flags.join(', ').padEnd(24);
        const required = opt.required ? '(required) ' : '';
        lines.push(`  ${flagStr} ${required}${opt.description}`);
      }
      lines.push('');
    }

    // Subcommands
    if (command.subcommands && command.subcommands.size > 0) {
      lines.push('Subcommands:');
      const uniqueSubcommands = new Map<string, Command>();
      for (const [name, sub] of command.subcommands) {
        if (!uniqueSubcommands.has(name)) {
          uniqueSubcommands.set(name, sub);
        }
      }
      for (const [name, sub] of uniqueSubcommands) {
        lines.push(`  ${name.padEnd(20)} ${sub.description}`);
      }
      lines.push('');
    }

    // Aliases
    if (command.aliases && command.aliases.length > 0) {
      lines.push(`Aliases: ${command.aliases.join(', ')}\n`);
    }

    return lines.join('\n');
  }
}

/**
 * Default parser instance
 */
export const defaultParser = new CommandParser();
