/**
 * Interactive prompt component for user input
 *
 * Uses Node.js readline for real terminal interaction with chalk styling.
 */

import * as readline from 'node:readline';
import { createLogger, type Logger } from '@organic/utils';
import chalk from 'chalk';

/**
 * Prompt type
 */
export type PromptType = 'text' | 'password' | 'confirm' | 'select' | 'multiselect';

/**
 * Select option
 */
export interface SelectOption {
  /** Option value */
  value: string;
  /** Option label */
  label: string;
  /** Whether option is disabled */
  disabled?: boolean;
}

/**
 * Prompt configuration
 */
export interface PromptConfig {
  /** Prompt type */
  type: PromptType;
  /** Prompt message */
  message: string;
  /** Default value */
  defaultValue?: string | boolean | string[];
  /** Select options (for select/multiselect types) */
  options?: SelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is required */
  required?: boolean;
  /** Validation function */
  validate?: (value: unknown) => string | null;
  /** Custom logger */
  logger?: Logger;
}

/**
 * Prompt result
 */
export interface PromptResult {
  /** Whether the prompt was answered */
  answered: boolean;
  /** Answer value */
  value?: string | boolean | string[];
  /** Error message if validation failed */
  error?: string;
}

/**
 * Interactive prompt component
 */
export class Prompt {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ prefix: 'prompt' });
  }

  /**
   * Ask a text question (async)
   */
  async ask(
    message: string,
    options: {
      defaultValue?: string;
      placeholder?: string;
      required?: boolean;
      validate?: (value: unknown) => string | null;
    } = {}
  ): Promise<string> {
    const result = await this.askAsync(message, {
      type: 'text',
      defaultValue: options.defaultValue,
      placeholder: options.placeholder,
      required: options.required,
      validate: options.validate,
    });
    return String(result.value ?? '');
  }

  /**
   * Ask a password question (async, masked echo)
   */
  async askPassword(
    message: string,
    options: { required?: boolean; validate?: (value: unknown) => string | null } = {}
  ): Promise<string> {
    const result = await this.askAsync(message, {
      type: 'password',
      required: options.required,
      validate: options.validate,
    });
    return String(result.value ?? '');
  }

  /**
   * Ask a confirmation (async)
   */
  async askConfirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';
    const result = await this.askAsync(message + suffix, {
      type: 'confirm',
      defaultValue,
    });
    return result.value === true;
  }

  /**
   * Ask a single selection (async)
   */
  async askSelect(message: string, options: SelectOption[]): Promise<string> {
    const result = await this.askAsync(message, {
      type: 'select',
      options,
    });
    return String(result.value ?? '');
  }

  /**
   * Ask a multi selection (async)
   */
  async askMultiselect(message: string, options: SelectOption[]): Promise<string[]> {
    const result = await this.askAsync(message, {
      type: 'multiselect',
      options,
    });
    return (result.value as string[]) ?? [];
  }

  /**
   * Async prompt with readline
   */
  async askAsync(
    message: string,
    config: Omit<PromptConfig, 'message' | 'logger'>
  ): Promise<PromptResult> {
    const { type, defaultValue, options, placeholder, required, validate } = config;

    // Display the prompt
    this.displayPromptMessage(message, type, defaultValue, options, placeholder);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    try {
      const input = await this.questionAsync(
        rl,
        type === 'password' ? chalk.dim('(input hidden) ') : ''
      );
      rl.close();

      // Handle empty input
      if (!input || input.trim() === '') {
        if (required) {
          return { answered: false, error: 'This field is required' };
        }
        return { answered: true, value: defaultValue };
      }

      // Validate
      if (validate) {
        const error = validate(input);
        if (error) {
          return { answered: false, error };
        }
      }

      // Parse based on type
      switch (type) {
        case 'confirm':
          return { answered: true, value: this.parseConfirm(input) };
        case 'select':
          return { answered: true, value: this.parseSelect(input, options ?? []) };
        case 'multiselect':
          return { answered: true, value: this.parseMultiselect(input, options ?? []) };
        default:
          return { answered: true, value: input };
      }
    } finally {
      try {
        rl.close();
      } catch {
        /* already closed */
      }
    }
  }

  /**
   * Display the prompt message with styling
   */
  private displayPromptMessage(
    message: string,
    type: PromptType,
    defaultValue?: unknown,
    options?: SelectOption[],
    placeholder?: string
  ): void {
    // Type indicator
    const typeIndicator = chalk.dim(`[${type}]`);
    const styledMessage = chalk.cyan.bold(message);

    console.log(`${typeIndicator} ${styledMessage}`);

    // Show default value
    if (defaultValue !== undefined) {
      const defaultStr =
        type === 'multiselect' && Array.isArray(defaultValue)
          ? defaultValue.join(', ')
          : String(defaultValue);
      console.log(chalk.dim(`  Default: ${defaultStr}`));
    }

    if (placeholder) {
      console.log(chalk.dim(`  ${placeholder}`));
    }

    // Show options for select types
    if ((type === 'select' || type === 'multiselect') && options) {
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (opt.disabled) {
          console.log(chalk.dim(`    ${i + 1}. ${opt.label} (disabled)`));
        } else {
          console.log(`    ${chalk.green(`${i + 1}.`)} ${opt.label}`);
        }
      }
      if (type === 'multiselect') {
        console.log(chalk.dim('  Enter numbers separated by commas (e.g., 1,3,5)'));
      }
    }
  }

  /**
   * Async question wrapper
   */
  private questionAsync(rl: readline.Interface, prompt: string): Promise<string> {
    return new Promise(resolve => {
      rl.question(chalk.cyan('? ') + prompt, answer => {
        resolve(answer);
      });
    });
  }

  // ── Synchronous methods (legacy) ──────────────────────────────

  /**
   * Render a text input prompt (synchronous - returns empty string in non-TTY)
   * @deprecated Use ask() for async interactive input
   */
  renderText(
    message: string,
    options: {
      defaultValue?: string;
      placeholder?: string;
      required?: boolean;
      validate?: (value: unknown) => string | null;
    } = {}
  ): string {
    const input = this.render(message, {
      type: 'text',
      defaultValue: options.defaultValue,
      placeholder: options.placeholder,
      required: options.required,
      validate: options.validate,
    });
    return this.getInput(input);
  }

  /**
   * Render a password prompt (synchronous)
   * @deprecated Use askPassword() for async interactive input
   */
  renderPassword(
    message: string,
    options: {
      required?: boolean;
      validate?: (value: unknown) => string | null;
    } = {}
  ): string {
    const input = this.render(message, {
      type: 'password',
      required: options.required,
      validate: options.validate,
    });
    return this.getInput(input);
  }

  /**
   * Render a confirmation prompt (synchronous)
   * @deprecated Use askConfirm() for async interactive input
   */
  renderConfirm(
    message: string,
    defaultValue: boolean = false,
    options?: {
      validate?: (value: unknown) => string | null;
    }
  ): boolean {
    const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';
    const input = this.render(message + suffix, {
      type: 'confirm',
      defaultValue,
      validate: options?.validate,
    });
    const inputStr = typeof input === 'string' ? input : (input.value?.toString() ?? '');
    return this.parseConfirm(inputStr);
  }

  /**
   * Render a single-select prompt (synchronous)
   * @deprecated Use askSelect() for async interactive input
   */
  renderSelect(
    message: string,
    options: SelectOption[],
    validate?: (value: unknown) => string | null
  ): string {
    const formattedOptions = options
      .map((opt, i) => {
        const disabled = opt.disabled ? ' (disabled)' : '';
        return `  ${i + 1}. ${opt.label}${disabled}`;
      })
      .join('\n');

    this.logger.info(`${message}:\n${formattedOptions}`);

    const input = this.render('Enter choice', {
      type: 'select',
      options,
      validate,
    });

    const inputStr =
      typeof input === 'string' ? input : typeof input.value === 'string' ? input.value : '';
    return this.parseSelect(inputStr, options);
  }

  /**
   * Render a multi-select prompt (synchronous)
   * @deprecated Use askMultiselect() for async interactive input
   */
  renderMultiselect(
    message: string,
    options: SelectOption[],
    validate?: (value: unknown) => string | null
  ): string[] {
    const formattedOptions = options
      .map((opt, i) => {
        const disabled = opt.disabled ? ' (disabled)' : '';
        return `  ${i + 1}. ${opt.label}${disabled}`;
      })
      .join('\n');

    this.logger.info(`${message}:\n${formattedOptions}`);
    this.logger.info('Enter numbers separated by commas (e.g., 1,3,5)');

    const input = this.render('Enter choices', {
      type: 'multiselect',
      options,
      validate,
    });

    const inputStr = typeof input === 'string' ? input : (input.value?.toString() ?? '');
    return this.parseMultiselect(inputStr, options);
  }

  /**
   * Render a prompt with configuration (synchronous)
   */
  render(message: string, config: Omit<PromptConfig, 'message' | 'logger'>): PromptResult {
    const { type, defaultValue, options, placeholder, required, validate } = config;

    this.displayPromptMessage(message, type, defaultValue, options, placeholder);

    const input = this.readLine();

    if (!input || input.trim() === '') {
      if (required) {
        return { answered: false, error: 'This field is required' };
      }
      return { answered: true, value: defaultValue };
    }

    if (validate) {
      const error = validate(input);
      if (error) {
        return { answered: false, error };
      }
    }

    switch (type) {
      case 'confirm':
        return { answered: true, value: this.parseConfirm(input) };
      case 'select':
        return { answered: true, value: this.parseSelect(input, options ?? []) };
      case 'multiselect':
        return { answered: true, value: this.parseMultiselect(input, options ?? []) };
      default:
        return { answered: true, value: input };
    }
  }

  /**
   * Format a prompt for display
   */
  formatPrompt(config: PromptConfig): string {
    const parts: string[] = [];

    parts.push(`[${config.type.toUpperCase()}]`);

    if (config.message) {
      parts.push(config.message);
    }

    if (config.options && config.options.length > 0) {
      const optionStr = config.options
        .map((opt, i) => {
          const disabled = opt.disabled ? ' (disabled)' : '';
          return `${i + 1}. ${opt.label}${disabled}`;
        })
        .join(' ');
      parts.push(optionStr);
    }

    if (config.defaultValue !== undefined) {
      parts.push(`(default: ${config.defaultValue})`);
    }

    if (config.required) {
      parts.push('*');
    }

    return parts.join(' ');
  }

  // ── Private helpers ───────────────────────────────────────────

  private readLine(): string {
    this.logger.warn('Using synchronous input - use async methods for real interactive input');
    return '';
  }

  private getInput(result: PromptResult): string {
    if (!result.answered && result.error) {
      this.logger.error(result.error);
    }
    return String(result.value ?? '');
  }

  private parseConfirm(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    if (normalized === 'yes' || normalized === 'y') {
      return true;
    }
    if (normalized === 'no' || normalized === 'n') {
      return false;
    }
    return false;
  }

  private parseSelect(input: string, options: SelectOption[]): string {
    const num = parseInt(input.trim(), 10);

    if (!isNaN(num) && num >= 1 && num <= options.length) {
      const option = options[num - 1];
      if (option && !option.disabled) {
        return option.value;
      }
    }

    const match = options.find(
      opt =>
        opt.label.toLowerCase() === input.toLowerCase() ||
        opt.value.toLowerCase() === input.toLowerCase()
    );

    if (match && !match.disabled) {
      return match.value;
    }

    return input;
  }

  private parseMultiselect(input: string, options: SelectOption[]): string[] {
    const parts = input
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const selected: string[] = [];

    for (const part of parts) {
      const num = parseInt(part, 10);

      if (!isNaN(num) && num >= 1 && num <= options.length) {
        const option = options[num - 1];
        if (option && !option.disabled) {
          selected.push(option.value);
          continue;
        }
      }

      const match = options.find(
        opt =>
          opt.label.toLowerCase() === part.toLowerCase() ||
          opt.value.toLowerCase() === part.toLowerCase()
      );

      if (match && !match.disabled) {
        selected.push(match.value);
      }
    }

    return selected;
  }
}

/**
 * Default prompt instance
 */
export const defaultPrompt = new Prompt();

/**
 * Create a new prompt instance
 */
export function createPrompt(logger?: Logger): Prompt {
  return new Prompt(logger);
}
