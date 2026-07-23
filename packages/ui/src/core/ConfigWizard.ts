/**
 * ConfigWizard - Interactive configuration wizard for first-time setup
 *
 * Provides a guided step-by-step configuration experience with
 * support for various input types, validation, navigation, and
 * persistence.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createLogger, type Logger } from '@organic/utils';

/**
 * Wizard step type
 */
export type WizardStepType = 'text' | 'select' | 'confirm' | 'multiselect' | 'number';

/**
 * Wizard step definition
 */
export interface WizardStep {
  /** Unique step ID */
  id: string;
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Input type */
  type: WizardStepType;
  /** Configuration key to store result */
  key: string;
  /** Available options for select/multiselect types */
  options?: string[];
  /** Default value */
  default?: unknown;
  /** Whether this step is required */
  required?: boolean;
  /** Validation function: returns true if valid, or error string */
  validate?: (value: unknown) => boolean | string;
}

/**
 * Wizard configuration
 */
export interface WizardConfig {
  /** Unique wizard ID */
  id: string;
  /** Wizard title */
  title: string;
  /** Wizard description */
  description: string;
  /** Steps to execute */
  steps: WizardStep[];
}

/**
 * Wizard result
 */
export interface WizardResult {
  /** Collected configuration */
  config: Record<string, unknown>;
  /** Whether wizard was completed */
  completed: boolean;
  /** IDs of skipped steps */
  skippedSteps: string[];
}

/**
 * Built-in wizard presets
 */
export const BUILTIN_WIZARDS: Record<string, WizardConfig> = {
  'initial-setup': {
    id: 'initial-setup',
    title: 'Initial Setup',
    description: 'Configure your Organic Interface for the first time',
    steps: [
      {
        id: 'language',
        title: 'Language Preference',
        description: 'Select your preferred language for the interface',
        type: 'select',
        key: 'language',
        options: ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es'],
        default: 'en',
        required: true,
      },
      {
        id: 'security',
        title: 'Security Preset',
        description: 'Choose your security preset level',
        type: 'select',
        key: 'securityPreset',
        options: ['strict', 'standard', 'permissive'],
        default: 'standard',
        required: true,
      },
      {
        id: 'storage',
        title: 'Storage Backend',
        description: 'Select the storage backend for persistence',
        type: 'select',
        key: 'storageBackend',
        options: ['memory', 'file', 'database'],
        default: 'file',
        required: true,
      },
      {
        id: 'telemetry',
        title: 'Telemetry Opt-in',
        description: 'Allow anonymous usage data collection to improve the product',
        type: 'confirm',
        key: 'telemetry',
        default: false,
        required: false,
      },
      {
        id: 'model',
        title: 'Default Model',
        description: 'Select the default AI model to use',
        type: 'select',
        key: 'defaultModel',
        options: ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-pro', 'llama-3'],
        default: 'gpt-4',
        required: true,
      },
    ],
  },
};

/**
 * ConfigWizard - Interactive configuration wizard
 *
 * Guides users through a series of configuration steps,
 * with validation, navigation, and save/load capabilities.
 */
export class ConfigWizard {
  private logger: Logger;
  private config: WizardConfig | null = null;
  private currentStepIndex = 0;
  private results: Record<string, unknown> = {};
  private skippedSteps: Set<string> = new Set();
  private history: number[] = [];

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ prefix: 'config-wizard' });
  }

  /**
   * Run a full configuration wizard
   */
  async run(config: WizardConfig): Promise<WizardResult> {
    this.config = config;
    this.currentStepIndex = 0;
    this.results = {};
    // Preserve skippedSteps that were set before run() was called
    this.history = [];

    this.logger.info(`Starting wizard: ${config.title}`);

    for (let i = 0; i < config.steps.length; i++) {
      this.currentStepIndex = i;
      const step = config.steps[i];

      if (this.skippedSteps.has(step.id)) {
        this.logger.debug(`Skipping step: ${step.id}`);
        continue;
      }

      try {
        const value = await this.runStep(step);
        this.results[step.key] = value;
        this.history.push(i);
      } catch (error) {
        this.logger.error(
          `Step ${step.id} failed: ${error instanceof Error ? error.message : String(error)}`
        );
        // Continue with remaining steps
      }
    }

    const completed = this.currentStepIndex >= config.steps.length - 1;
    this.logger.info(`Wizard ${completed ? 'completed' : 'interrupted'}: ${config.title}`);

    return {
      config: { ...this.results },
      completed,
      skippedSteps: Array.from(this.skippedSteps),
    };
  }

  /**
   * Run a single wizard step
   */
  async runStep(step: WizardStep): Promise<unknown> {
    this.logger.info(`Step: ${step.title}`);
    this.logger.debug(`  ${step.description}`);

    // Apply default if available
    let value: unknown = step.default;

    // In non-interactive mode, use defaults
    if (!this.isInteractive()) {
      if (step.required && step.default === undefined) {
        // For required steps without defaults, provide reasonable defaults
        switch (step.type) {
          case 'text':
            value = '';
            break;
          case 'number':
            value = 0;
            break;
          case 'select':
            value = step.options?.[0] ?? '';
            break;
          case 'multiselect':
            value = step.options ? [step.options[0]] : [];
            break;
          case 'confirm':
            value = false;
            break;
          default:
            value = '';
        }
      }
      this.logger.debug(`  Non-interactive: using default = ${JSON.stringify(value)}`);
    }

    // Validate
    if (step.validate && step.required) {
      const validationResult = step.validate(value);
      if (typeof validationResult === 'string') {
        this.logger.warn(`  Validation warning: ${validationResult}`);
      } else if (!validationResult) {
        this.logger.warn(`  Validation failed for step: ${step.id}`);
      }
    }

    return value;
  }

  /**
   * Skip a step by ID
   */
  skipStep(stepId: string): void {
    this.skippedSteps.add(stepId);
    this.logger.debug(`Step marked for skip: ${stepId}`);
  }

  /**
   * Go back to the previous step
   */
  goBack(): void {
    if (this.history.length > 0) {
      this.history.pop();
      this.currentStepIndex = this.history.length > 0 ? this.history[this.history.length - 1] : 0;
      this.logger.debug(`Went back to step index: ${this.currentStepIndex}`);
    }
  }

  /**
   * Get current wizard progress
   */
  getProgress(): { current: number; total: number; completed: string[] } {
    if (!this.config) {
      return { current: 0, total: 0, completed: [] };
    }

    const completed = Object.keys(this.results);
    return {
      current: this.currentStepIndex + 1,
      total: this.config.steps.length,
      completed,
    };
  }

  /**
   * Save wizard result to a file
   */
  async saveToFile(result: WizardResult, filePath: string): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      const content = JSON.stringify(
        {
          wizardId: this.config?.id ?? 'unknown',
          completed: result.completed,
          skippedSteps: result.skippedSteps,
          config: result.config,
          savedAt: new Date().toISOString(),
        },
        null,
        2
      );

      await fs.writeFile(filePath, content, 'utf-8');
      this.logger.info(`Wizard result saved to: ${filePath}`);
    } catch (error) {
      this.logger.error(
        `Failed to save wizard result: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Load wizard result from a file
   */
  async loadFromFile(filePath: string): Promise<WizardResult> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      const result: WizardResult = {
        config: data.config ?? {},
        completed: data.completed ?? false,
        skippedSteps: data.skippedSteps ?? [],
      };

      this.logger.info(`Wizard result loaded from: ${filePath}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to load wizard result: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Check if running in interactive environment
   */
  private isInteractive(): boolean {
    return process.stdout.isTTY && process.stdin.isTTY;
  }

  /**
   * Get the current step
   */
  getCurrentStep(): WizardStep | null {
    if (!this.config) return null;
    return this.config.steps[this.currentStepIndex] ?? null;
  }

  /**
   * Reset the wizard state
   */
  reset(): void {
    this.config = null;
    this.currentStepIndex = 0;
    this.results = {};
    this.skippedSteps = new Set();
    this.history = [];
    this.logger.debug('Wizard state reset');
  }

  /**
   * Get the built-in 'initial-setup' wizard config
   */
  static getInitialSetupWizard(): WizardConfig {
    return { ...BUILTIN_WIZARDS['initial-setup'] };
  }
}
