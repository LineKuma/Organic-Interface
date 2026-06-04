/**
 * Interactive prompt component for user input
 */

import { createLogger, type Logger } from '@organic/utils';

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
   * Render a text input prompt
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
   * Render a password prompt (masked input)
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
   * Render a confirmation prompt (yes/no)
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
   * Render a single-select prompt
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
   * Render a multi-select prompt
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
   * Render a prompt with configuration
   */
  render(message: string, config: Omit<PromptConfig, 'message' | 'logger'>): PromptResult {
    const { type, defaultValue, options, placeholder, required, validate } = config;

    // Display the prompt message
    this.logger.info(message);

    // Format default value for display
    let displayDefault = '';
    if (defaultValue !== undefined) {
      if (type === 'confirm') {
        displayDefault = defaultValue ? 'Y' : 'N';
      } else if (type === 'multiselect' && Array.isArray(defaultValue)) {
        displayDefault = defaultValue.join(', ');
      } else {
        displayDefault = String(defaultValue);
      }
    }

    if (placeholder || displayDefault) {
      const placeholderText = displayDefault || placeholder || '';
      this.logger.info(`(Default: ${placeholderText})`);
    }

    // For select types, show numbered options
    if (type === 'select' || type === 'multiselect') {
      if (options) {
        const formatted = options
          .map((opt, i) => {
            const marker = opt.disabled ? '   ' : `${i + 1}. `;
            return `${marker}${opt.label}${opt.disabled ? ' (disabled)' : ''}`;
          })
          .join('\n');
        this.logger.info(formatted);
      }
    }

    // Get input
    const input = this.readLine();

    // Handle empty input
    if (!input || input.trim() === '') {
      if (required) {
        return { answered: false, error: 'This field is required' };
      }
      return { answered: true, value: defaultValue };
    }

    // Validate if provided
    if (validate) {
      const error = validate(input);
      if (error) {
        return { answered: false, error };
      }
    }

    // Return based on type
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

  /**
   * Read a line from input (synchronous placeholder for demo)
   */
  private readLine(): string {
    // In Node.js environment, use readline
    // For synchronous operation in demo mode, return empty string
    // In real interactive mode, this should use async prompts
    this.logger.warn('Using placeholder for synchronous input - use async methods for real input');
    return '';
  }

  /**
   * Get input value (simplified)
   */
  private getInput(result: PromptResult): string {
    if (!result.answered && result.error) {
      this.logger.error(result.error);
    }
    return String(result.value ?? '');
  }

  /**
   * Parse confirmation input
   */
  private parseConfirm(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    if (normalized === 'yes' || normalized === 'y') {
      return true;
    }
    if (normalized === 'no' || normalized === 'n') {
      return false;
    }
    return false; // Default to no
  }

  /**
   * Parse select input
   */
  private parseSelect(input: string, options: SelectOption[]): string {
    const num = parseInt(input.trim(), 10);

    if (!isNaN(num) && num >= 1 && num <= options.length) {
      const option = options[num - 1];
      if (option && !option.disabled) {
        return option.value;
      }
    }

    // Try exact match
    const match = options.find(
      opt =>
        opt.label.toLowerCase() === input.toLowerCase() ||
        opt.value.toLowerCase() === input.toLowerCase()
    );

    if (match && !match.disabled) {
      return match.value;
    }

    // Return input as-is
    return input;
  }

  /**
   * Parse multiselect input
   */
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

      // Try exact match
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
