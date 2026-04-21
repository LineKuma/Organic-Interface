/**
 * @organic/plugins - Plugin system module
 */

export {
  type PluginInterface,
  type PluginContext,
  type PluginInput,
  type PluginOutput,
  type InitializeResult,
  type PluginConfig,
  createLogger,
  type Logger,
  type LogLevel,
} from '@organic/utils';

/**
 * Plugin Registry - manages plugin lifecycle
 */
export class PluginRegistry {
  private plugins: Map<string, PluginInterface> = new Map();

  register(plugin: PluginInterface): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  unregister(name: string): void {
    this.plugins.delete(name);
  }

  get(name: string): PluginInterface | undefined {
    return this.plugins.get(name);
  }

  list(): PluginInterface[] {
    return Array.from(this.plugins.values());
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }
}

/**
 * Plugin Loader - dynamic plugin loading
 */
export class PluginLoader {
  async load(path: string): Promise<PluginInterface> {
    // Dynamic loading implementation placeholder
    throw new Error('Dynamic plugin loading not implemented');
  }
}
