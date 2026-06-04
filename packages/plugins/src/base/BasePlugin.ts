/**
 * BasePlugin - Base implementation for plugins
 */

import type {
  PluginInterface,
  PluginMetadata,
  PluginContext,
  PluginInput,
  PluginOutput,
  InitializeResult,
  ValidateResult,
  ValidationError,
} from '../interfaces/PluginInterface.js';

/**
 * Base plugin options
 */
export interface BasePluginOptions {
  /** Plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin API version */
  apiVersion?: string;
  /** Minimum kernel version */
  minKernelVersion?: string;
  /** Default configuration */
  defaultConfig?: Record<string, unknown>;
  /** Lifecycle hooks */
  hooks?: {
    onLoad?: () => void | Promise<void>;
    onUnload?: () => void | Promise<void>;
    onError?: (error: Error) => void;
    onConfigChange?: (config: Record<string, unknown>) => void;
  };
}

/**
 * BasePlugin - Abstract base class for plugins
 */
export abstract class BasePlugin implements PluginInterface {
  /** Plugin name */
  readonly name: string;

  /** Plugin version */
  readonly version: string;

  /** Plugin description */
  readonly description?: string;

  /** Plugin metadata */
  protected metadata: PluginMetadata;

  /** Plugin configuration */
  protected config: Record<string, unknown> = {};

  /** Kernel API interface */
  protected kernel: any = null;

  /** Whether plugin is initialized */
  protected initialized: boolean = false;

  /** Lifecycle hooks */
  private hooks?: BasePluginOptions['hooks'];

  /**
   * Create a new BasePlugin
   * @param options - Plugin options
   */
  constructor(options: BasePluginOptions) {
    this.name = options.name;
    this.version = options.version;
    this.description = options.description;

    this.metadata = {
      id: options.name,
      name: options.name,
      version: options.version,
      description: options.description,
      apiVersion: options.apiVersion || '1.0.0',
      minKernelVersion: options.minKernelVersion,
      defaultConfig: options.defaultConfig,
      hooks: options.hooks,
    };

    this.hooks = options.hooks;

    // Initialize config with defaults
    if (options.defaultConfig) {
      this.config = { ...options.defaultConfig };
    }
  }

  /**
   * Get plugin metadata
   */
  getMetadata(): PluginMetadata {
    return { ...this.metadata };
  }

  /**
   * Initialize the plugin
   * @param context - Plugin context
   */
  async initialize(context: PluginContext): Promise<InitializeResult> {
    try {
      // Store kernel API
      this.kernel = context.kernel;

      // Merge configuration
      this.config = {
        ...this.metadata.defaultConfig,
        ...context.config,
      };

      // Call onLoad hook
      if (this.hooks?.onLoad) {
        await this.hooks.onLoad();
      }

      // Call subclass initialization
      await this.onInitialize(context);

      this.initialized = true;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a plugin action
   * @param input - Plugin input
   */
  async execute(input: PluginInput): Promise<PluginOutput> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Plugin not initialized',
      };
    }

    try {
      const result = await this.onExecute(input);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // Call onError hook
      if (this.hooks?.onError && error instanceof Error) {
        this.hooks.onError(error);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Shutdown the plugin
   */
  async shutdown(): Promise<void> {
    try {
      // Call onUnload hook
      if (this.hooks?.onUnload) {
        await this.hooks.onUnload();
      }

      // Call subclass shutdown
      await this.onShutdown();

      this.initialized = false;
    } catch (error) {
      console.error(`Error during plugin shutdown: ${this.name}`, error);
    }
  }

  /**
   * Validate plugin configuration
   * @param config - Configuration to validate
   */
  async validateConfig(config: Record<string, unknown>): Promise<ValidateResult> {
    const errors: ValidationError[] = [];

    // Get validation schema from subclass
    const schema = this.getConfigSchema?.();

    if (schema) {
      for (const [field, rules] of Object.entries(schema)) {
        const value = config[field];

        // Check required
        if (rules.required && (value === undefined || value === null)) {
          errors.push({
            field,
            message: `${field} is required`,
            expected: 'any value',
          });
        }

        // Check type
        if (value !== undefined && rules.type && typeof value !== rules.type) {
          errors.push({
            field,
            message: `${field} must be of type ${rules.type}`,
            expected: rules.type,
            actual: typeof value,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ==================== Protected Methods ====================

  /**
   * Get configuration schema for validation
   * Override in subclass to define schema
   */
  protected getConfigSchema?(): Record<
    string,
    {
      type: string;
      required?: boolean;
      default?: unknown;
      description?: string;
    }
  >;

  /**
   * OnInitialize callback - override in subclass
   * @param context - Plugin context
   */
  protected async onInitialize(_context: PluginContext): Promise<void> {
    // Override in subclass
  }

  /**
   * OnExecute callback - override in subclass
   * @param input - Plugin input
   */
  protected async onExecute(input: PluginInput): Promise<unknown> {
    // Override in subclass
    return { action: input.action, result: 'not implemented' };
  }

  /**
   * OnShutdown callback - override in subclass
   */
  protected async onShutdown(): Promise<void> {
    // Override in subclass
  }

  /**
   * Update configuration
   * @param config - New configuration
   */
  protected updateConfig(config: Record<string, unknown>): void {
    this.config = { ...this.config, ...config };

    // Call onConfigChange hook
    if (this.hooks?.onConfigChange) {
      this.hooks.onConfigChange(this.config);
    }
  }

  /**
   * Get current configuration
   */
  protected getConfig(): Record<string, unknown> {
    return { ...this.config };
  }

  /**
   * Check if plugin is initialized
   */
  protected isInitialized(): boolean {
    return this.initialized;
  }
}
