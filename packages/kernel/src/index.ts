/**
 * @organic/kernel - Core Kernel module
 */

export {
  type KernelConfig,
  type KernelApi,
  type PluginInterface,
  type PluginContext,
  type PluginInput,
  type PluginOutput,
  createLogger,
  type Logger,
  type LogLevel,
} from '@organic/utils';

/**
 * Core Kernel implementation
 */
export class Kernel {
  private plugins: Map<string, PluginInterface> = new Map();
  private config: KernelConfig;
  private logger: Logger;
  private initialized: boolean = false;

  constructor(config: KernelConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger ?? createLogger('kernel');
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Kernel already initialized');
      return;
    }
    this.logger.info(`Initializing Kernel: ${this.config.name} v${this.config.version}`);
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Kernel');
    for (const [name, plugin] of this.plugins) {
      await plugin.shutdown();
      this.logger.info(`Plugin ${name} shutdown`);
    }
    this.plugins.clear();
    this.initialized = false;
  }

  getConfig(): KernelConfig {
    return { ...this.config };
  }

  getVersion(): string {
    return this.config.version;
  }

  async registerPlugin(plugin: PluginInterface): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} already registered`);
    }
    this.logger.info(`Registering plugin: ${plugin.name}`);
    this.plugins.set(plugin.name, plugin);
  }

  async unregisterPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }
    await plugin.shutdown();
    this.plugins.delete(name);
    this.logger.info(`Unregistered plugin: ${name}`);
  }

  getPlugin(name: string): PluginInterface | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): PluginInterface[] {
    return Array.from(this.plugins.values());
  }

  async executeTool(name: string, params: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    this.logger.info(`Executing tool: ${name}`);
    return { success: true, data: null };
  }
}
