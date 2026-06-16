/**
 * Terminal theme configuration
 *
 * Provides consistent color styling for terminal output.
 * Uses chalk for ANSI color support.
 */

import chalk, { type ChalkInstance } from 'chalk';

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
}

/**
 * Default theme
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
};

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
