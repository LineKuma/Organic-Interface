/**
 * PluginManager - Manages plugin registration, lifecycle, and execution
 */

import type {
  PluginInterface,
  PluginContext,
  PluginConfig,
  PluginInput,
  PluginOutput,
  KernelApi,
  KernelConfig,
  ToolResult,
} from '@organic/utils';
import { EventBus } from './EventBus.js';
import type { Logger } from '@organic/utils';

/**
 * Plugin metadata including runtime state
 */
export interface PluginMetadata {
  /** Plugin instance */
  plugin: PluginInterface;
  /** Plugin configuration */
  config: PluginConfig;
  /** When plugin was registered */
  registeredAt: number;
  /** When plugin was last executed */
  lastExecutedAt?: number;
  /** Number of times plugin has been executed */
  executionCount: number;
  /** Whether plugin is currently enabled */
  enabled: boolean;
}

/**
 * Plugin initialization options
 */
export interface PluginInitOptions {
  /** Custom plugin configuration */
  config?: PluginConfig;
  /** Whether to auto-enable after registration */
  autoEnable?: boolean;
}

/**
 * PluginManager configuration
 */
export interface PluginManagerConfig {
  /** Kernel API to provide to plugins */
  kernelApi: KernelApi;
  /** EventBus for plugin events */
  eventBus: EventBus;
  /** Logger instance */
  logger?: Logger;
  /** Default plugin configuration */
  defaultPluginConfig?: PluginConfig;
}

/**
 * PluginManager - Manages plugin registration, lifecycle, and execution
 */
export class PluginManager {
  private plugins: Map<string, PluginMetadata> = new Map();
  private kernelApi: KernelApi;
  private eventBus: EventBus;
  private logger: Logger;
  private defaultPluginConfig: PluginConfig;

  constructor(config: PluginManagerConfig) {
    this.kernelApi = config.kernelApi;
    this.eventBus = config.eventBus;
    this.logger = config.logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    this.defaultPluginConfig = config.defaultPluginConfig ?? {
      name: '',
      enabled: true,
    };
  }

  /**
   * Register a plugin
   */
  async register(
    plugin: PluginInterface,
    options: PluginInitOptions = {}
  ): Promise<void> {
    const { config, autoEnable = true } = options;

    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }

    this.logger.info(`Registering plugin: ${plugin.name} v${plugin.version}`);

    const pluginConfig: PluginConfig = {
      ...this.defaultPluginConfig,
      ...config,
      name: plugin.name,
      enabled: autoEnable,
    };

    const metadata: PluginMetadata = {
      plugin,
      config: pluginConfig,
      registeredAt: Date.now(),
      executionCount: 0,
      enabled: autoEnable,
    };

    this.plugins.set(plugin.name, metadata);

    // Emit plugin register event
    this.eventBus.emit('plugin:register', {
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
    });

    this.logger.info(`Plugin ${plugin.name} registered successfully`);
  }

  /**
   * Unregister a plugin
   */
  async unregister(name: string): Promise<void> {
    const metadata = this.plugins.get(name);

    if (!metadata) {
      throw new Error(`Plugin ${name} is not registered`);
    }

    this.logger.info(`Unregistering plugin: ${name}`);

    // Shutdown the plugin
    try {
      await metadata.plugin.shutdown();
    } catch (error) {
      this.logger.error(`Error shutting down plugin ${name}:`, error);
    }

    this.plugins.delete(name);

    // Emit plugin unregister event
    this.eventBus.emit('plugin:unregister', { name });

    this.logger.info(`Plugin ${name} unregistered successfully`);
  }

  /**
   * Get a plugin by name
   */
  get(name: string): PluginInterface | undefined {
    return this.plugins.get(name)?.plugin;
  }

  /**
   * Get plugin metadata
   */
  getMetadata(name: string): PluginMetadata | undefined {
    return this.plugins.get(name);
  }

  /**
   * List all registered plugins
   */
  list(): PluginInterface[] {
    return Array.from(this.plugins.values()).map(m => m.plugin);
  }

  /**
   * List all plugin metadata
   */
  listWithMetadata(): PluginMetadata[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Initialize a plugin
   */
  async initialize(name: string): Promise<void> {
    const metadata = this.plugins.get(name);

    if (!metadata) {
      throw new Error(`Plugin ${name} is not registered`);
    }

    if (!metadata.enabled) {
      this.logger.warn(`Plugin ${name} is disabled, skipping initialization`);
      return;
    }

    this.logger.info(`Initializing plugin: ${name}`);

    const context: PluginContext = {
      kernel: this.kernelApi,
      config: metadata.config,
    };

    try {
      const result = await metadata.plugin.initialize(context);

      if (!result.success) {
        throw new Error(result.error ?? 'Plugin initialization failed');
      }

      this.logger.info(`Plugin ${name} initialized successfully`);
    } catch (error) {
      this.logger.error(`Failed to initialize plugin ${name}:`, error);
      this.eventBus.emit('plugin:error', {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Execute a plugin action
   */
  async execute(name: string, input: PluginInput): Promise<PluginOutput> {
    const metadata = this.plugins.get(name);

    if (!metadata) {
      return {
        success: false,
        error: `Plugin ${name} is not registered`,
      };
    }

    if (!metadata.enabled) {
      return {
        success: false,
        error: `Plugin ${name} is disabled`,
      };
    }

    this.logger.debug(`Executing plugin ${name}, action: ${input.action}`);

    try {
      const result = await metadata.plugin.execute(input);

      // Update execution statistics
      metadata.lastExecutedAt = Date.now();
      metadata.executionCount++;

      return result;
    } catch (error) {
      this.logger.error(`Error executing plugin ${name}:`, error);
      this.eventBus.emit('plugin:error', {
        name,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Shutdown a plugin
   */
  async shutdown(name: string): Promise<void> {
    const metadata = this.plugins.get(name);

    if (!metadata) {
      this.logger.warn(`Plugin ${name} is not registered, skipping shutdown`);
      return;
    }

    this.logger.info(`Shutting down plugin: ${name}`);

    try {
      await metadata.plugin.shutdown();
      this.logger.info(`Plugin ${name} shutdown successfully`);
    } catch (error) {
      this.logger.error(`Error shutting down plugin ${name}:`, error);
    }
  }

  /**
   * Shutdown all plugins
   */
  async shutdownAll(): Promise<void> {
    this.logger.info('Shutting down all plugins');

    const shutdownPromises = Array.from(this.plugins.values()).map(
      async (metadata) => {
        try {
          await metadata.plugin.shutdown();
        } catch (error) {
          this.logger.error(`Error shutting down plugin ${metadata.plugin.name}:`, error);
        }
      }
    );

    await Promise.allSettled(shutdownPromises);
    this.plugins.clear();

    this.logger.info('All plugins shut down');
  }

  /**
   * Enable a plugin
   */
  enable(name: string): void {
    const metadata = this.plugins.get(name);

    if (metadata) {
      metadata.enabled = true;
      metadata.config.enabled = true;
      this.logger.info(`Plugin ${name} enabled`);
    }
  }

  /**
   * Disable a plugin
   */
  disable(name: string): void {
    const metadata = this.plugins.get(name);

    if (metadata) {
      metadata.enabled = false;
      metadata.config.enabled = false;
      this.logger.info(`Plugin ${name} disabled`);
    }
  }

  /**
   * Check if a plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get the count of registered plugins
   */
  count(): number {
    return this.plugins.size;
  }

  /**
   * Get enabled plugins
   */
  getEnabled(): PluginInterface[] {
    return Array.from(this.plugins.values())
      .filter(m => m.enabled)
      .map(m => m.plugin);
  }

  /**
   * Get disabled plugins
   */
  getDisabled(): PluginInterface[] {
    return Array.from(this.plugins.values())
      .filter(m => !m.enabled)
      .map(m => m.plugin);
  }
}
