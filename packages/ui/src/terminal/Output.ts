/**
 * Styled terminal output utilities
 *
 * Wraps chalk for consistent, themed terminal output.
 */

import chalk from 'chalk';
import { type Theme, defaultTheme } from './Theme.js';

/**
 * Level of output
 */
export type OutputLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

/**
 * Output utility for styled terminal output
 */
export class Output {
  private theme: Theme;
  private verbose: boolean;

  constructor(theme?: Theme, verbose: boolean = false) {
    this.theme = theme ?? defaultTheme;
    this.verbose = verbose;
  }

  /** Set verbosity */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /** Print a styled heading */
  heading(text: string): void {
    console.log('');
    console.log(this.theme.colors.title(text));
    console.log(this.theme.colors.border('─'.repeat(Math.min(text.length, 60))));
  }

  /** Print a styled sub-heading */
  subheading(text: string): void {
    console.log('');
    console.log(this.theme.colors.subtitle(`  ${text}`));
  }

  /** Print a log message with level */
  log(level: OutputLevel, message: string): void {
    const { colors, infoPrefix, successPrefix, warningPrefix, errorPrefix } = this.theme;

    switch (level) {
      case 'info':
        console.log(`${colors.info(infoPrefix)} ${message}`);
        break;
      case 'success':
        console.log(`${colors.success(successPrefix)} ${message}`);
        break;
      case 'warning':
        console.log(`${colors.warning(warningPrefix)} ${colors.warning(message)}`);
        break;
      case 'error':
        console.error(`${colors.error(errorPrefix)} ${colors.error(message)}`);
        break;
      case 'debug':
        if (this.verbose) {
          console.log(`${colors.muted('  •')} ${colors.muted(message)}`);
        }
        break;
    }
  }

  /** Print informational message */
  info(message: string): void {
    this.log('info', message);
  }

  /** Print success message */
  success(message: string): void {
    this.log('success', message);
  }

  /** Print warning message */
  warn(message: string): void {
    this.log('warning', message);
  }

  /** Print error message */
  error(message: string): void {
    this.log('error', message);
  }

  /** Print debug message (only in verbose mode) */
  debug(message: string): void {
    this.log('debug', message);
  }

  /** Print a key-value pair */
  keyValue(key: string, value: string, indent: number = 0): void {
    const prefix = ' '.repeat(indent);
    console.log(`${prefix}${this.theme.colors.muted(key)} ${value}`);
  }

  /** Print a bullet list item */
  bullet(text: string, indent: number = 0): void {
    const prefix = ' '.repeat(indent);
    console.log(`${prefix}${this.theme.colors.accent('•')} ${text}`);
  }

  /** Print a numbered list item */
  numbered(index: number, text: string, indent: number = 0): void {
    const prefix = ' '.repeat(indent);
    console.log(`${prefix}${this.theme.colors.accent(`${index}.`)} ${text}`);
  }

  /** Print a divider line */
  divider(width: number = 60): void {
    console.log(this.theme.colors.border('─'.repeat(width)));
  }

  /** Print a blank line */
  newline(): void {
    console.log('');
  }

  /** Print plain text (no styling) */
  plain(text: string): void {
    console.log(text);
  }

  /** Get the themed chalk instance for custom styling */
  get theme_colors(): typeof this.theme.colors {
    return this.theme.colors;
  }

  /** Get raw chalk for custom usage */
  get chalk(): typeof chalk {
    return chalk;
  }
}

/**
 * Default output instance
 */
export const defaultOutput = new Output();

/**
 * Create a new Output instance
 */
export function createOutput(theme?: Theme, verbose?: boolean): Output {
  return new Output(theme, verbose);
}
