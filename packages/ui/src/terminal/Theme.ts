/**
 * Terminal theme configuration
 *
 * Provides consistent color styling for terminal output.
 * Uses chalk for ANSI color support.
 *
 * Supports automatic color capability detection:
 * - trueColor (24-bit) - full color in modern terminals
 * - 256  - 256-color palette
 * - 16   - basic ANSI colors
 * - 8    - minimal colors
 * - none - no colors (plain text, for non-TTY/pipes)
 */

import chalk, { Chalk, type ChalkInstance } from 'chalk';
import { type ColorDepth, Terminal } from './Terminal.js';

/**
 * Theme color palette
 */
export interface ThemeColors {
  primary: ChalkInstance;
  secondary: ChalkInstance;
  success: ChalkInstance;
  warning: ChalkInstance;
  error: ChalkInstance;
  info: ChalkInstance;
  muted: ChalkInstance;
  highlight: ChalkInstance;
  title: ChalkInstance;
  subtitle: ChalkInstance;
  border: ChalkInstance;
  accent: ChalkInstance;
}

/**
 * Theme configuration
 */
export interface Theme {
  colors: ThemeColors;
  /** Prefix for info messages */
  infoPrefix: string;
  /** Prefix for success messages */
  successPrefix: string;
  /** Prefix for warning messages */
  warningPrefix: string;
  /** Prefix for error messages */
  errorPrefix: string;
  /** Whether to include emoji/unicode prefixes */
  useUnicodePrefixes: boolean;
}

/**
 * No-color theme (plain text, no ANSI escape codes)
 * Used when terminal does not support colors.
 */
export const noneTheme: Theme = {
  colors: {
    primary: chalk,
    secondary: chalk,
    success: chalk,
    warning: chalk,
    error: chalk,
    info: chalk,
    muted: chalk,
    highlight: chalk,
    title: chalk,
    subtitle: chalk,
    border: chalk,
    accent: chalk,
  },
  infoPrefix: 'i',
  successPrefix: 'v',
  warningPrefix: '!',
  errorPrefix: 'x',
  useUnicodePrefixes: false,
};

/**
 * Default theme (full color)
 */
export const defaultTheme: Theme = {
  colors: {
    primary: chalk.cyan,
    secondary: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.blue,
    muted: chalk.gray,
    highlight: chalk.magenta,
    title: chalk.bold.cyan,
    subtitle: chalk.bold.blue,
    border: chalk.gray,
    accent: chalk.cyanBright,
  },
  infoPrefix: 'ℹ',
  successPrefix: '✔',
  warningPrefix: '⚠',
  errorPrefix: '✖',
  useUnicodePrefixes: true,
};

/**
 * Low-color theme (uses ASCII prefixes instead of unicode)
 * Best for terminals with basic color support.
 */
export const lowColorTheme: Theme = {
  colors: {
    primary: chalk.cyan,
    secondary: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.blue,
    muted: chalk.dim,
    highlight: chalk.magenta,
    title: chalk.bold.cyan,
    subtitle: chalk.bold.blue,
    border: chalk.dim,
    accent: chalk.cyan,
  },
  infoPrefix: 'info',
  successPrefix: 'ok',
  warningPrefix: 'warn',
  errorPrefix: 'ERR',
  useUnicodePrefixes: false,
};

/**
 * Create a theme based on terminal color capabilities
 *
 * Automatically selects the appropriate theme based on
 * detected terminal color depth.
 */
export function createAutoTheme(): Theme {
  try {
    const terminal = Terminal.get();
    const depth = terminal.colorDepth;

    if (depth === 'none') {
      return noneTheme;
    }
    if (depth === '8') {
      return lowColorTheme;
    }
    // 16+, 256, truecolor all support full color
    return defaultTheme;
  } catch {
    // Terminal not initialized, use default
    return defaultTheme;
  }
}

/**
 * Create a custom theme with overrides
 */
export function createTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    ...defaultTheme,
    ...overrides,
    colors: {
      ...defaultTheme.colors,
      ...overrides.colors,
    },
  };
}

/**
 * Get a chalk instance configured for the given color depth
 */
export function getChalkForDepth(depth: ColorDepth): ChalkInstance {
  switch (depth) {
    case 'truecolor':
      return new Chalk({ level: 3 });
    case '256':
      return new Chalk({ level: 2 });
    case '16':
    case '8':
      return new Chalk({ level: 1 });
    case 'none':
    default:
      return new Chalk({ level: 0 });
  }
}
