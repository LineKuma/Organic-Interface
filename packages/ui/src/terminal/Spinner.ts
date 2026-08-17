/**
 * Terminal spinner component
 *
 * Wraps ora for elegant loading spinners with progress indication.
 */

import ora, { type Ora, type Color } from 'ora';
import { type SpinnerName } from 'cli-spinners';
import { type Theme, defaultTheme } from './Theme.js';

/**
 * Spinner options
 */
export interface SpinnerOptions {
  /** Text to display alongside spinner */
  text?: string;
  /** Spinner style/name (e.g. 'dots', 'line', 'star') */
  spinner?: string;
  /** Custom theme */
  theme?: Theme;
  /** Initial color */
  color?: Color;
  /** Whether to discard output on stop */
  discardStdin?: boolean;
  /** Hide cursor while spinning */
  hideCursor?: boolean;
}

/**
 * Terminal spinner wrapper
 */
export class Spinner {
  private spinner: Ora;
  private theme: Theme;

  constructor(options: SpinnerOptions = {}) {
    this.theme = options.theme ?? defaultTheme;
    this.spinner = ora({
      text: options.text ?? '',
      spinner: (options.spinner as SpinnerName) ?? 'dots',
      color: options.color ?? 'cyan',
      discardStdin: options.discardStdin ?? false,
      hideCursor: options.hideCursor ?? true,
    });
  }

  /** Start the spinner with optional text */
  start(text?: string): this {
    if (text) {
      this.spinner.text = text;
    }
    this.spinner.start();
    return this;
  }

  /** Update spinner text while spinning */
  setText(text: string): this {
    this.spinner.text = text;
    return this;
  }

  /** Stop spinner with success indicator */
  succeed(text?: string): this {
    if (text) {
      this.spinner.text = text;
    }
    this.spinner.succeed();
    return this;
  }

  /** Stop spinner with failure indicator */
  fail(text?: string): this {
    if (text) {
      this.spinner.text = text;
    }
    this.spinner.fail();
    return this;
  }

  /** Stop spinner with warning indicator */
  warn(text?: string): this {
    if (text) {
      this.spinner.text = text;
    }
    this.spinner.warn();
    return this;
  }

  /** Stop spinner with info indicator */
  info(text?: string): this {
    if (text) {
      this.spinner.text = text;
    }
    this.spinner.info();
    return this;
  }

  /** Stop and clear the spinner */
  stop(): this {
    this.spinner.stop();
    return this;
  }

  /** Stop and clear the spinner (remove output) */
  stopAndPersist(options?: { symbol?: string; text?: string }): this {
    this.spinner.stopAndPersist(options);
    return this;
  }

  /** Get whether spinner is currently spinning */
  get isSpinning(): boolean {
    return this.spinner.isSpinning;
  }

  /** Get the underlying ora instance */
  get raw(): Ora {
    return this.spinner;
  }
}

/**
 * Create a spinner instance
 */
export function createSpinner(options?: SpinnerOptions): Spinner {
  return new Spinner(options);
}

/**
 * Run an async function with a spinner
 * Shows spinner while the function executes, auto-succeeds/fails.
 */
export async function withSpinner<T>(
  text: string,
  fn: () => Promise<T>,
  options?: Omit<SpinnerOptions, 'text'>
): Promise<T> {
  const spinner = new Spinner({ ...options, text });
  spinner.start();

  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
