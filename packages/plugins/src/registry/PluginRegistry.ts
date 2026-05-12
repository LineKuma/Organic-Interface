/**
 * PluginRegistry - Central registry for plugin management
 */

import type {
  PluginMetadata,
  PluginConfig,
  PluginStatus} from '../interfaces/PluginInterface.js';
import {
  PluginInterface,
  PluginLifecycleState,
  PluginHooks,
} from '../interfaces/PluginInterface.js';
import type {
  PluginLoaderInterface,
  PluginLoadResult,
  PluginDiscoveryResult,
} from '../interfaces/PluginLoaderInterface.js';

/**
 * Plugin information stored in registry
 */
export interface PluginInfo {
  /** Unique plugin identifier */
  readonly pluginId: string;
  /** Plugin metadata */
  readonly metadata: PluginMetadata;
  /** Installation path */
  readonly packagePath: string;
  /** Installation timestamp */
  readonly installTime: number;
  /** Plugin status */
  status: PluginStatus;
  /** Configuration */
  config?: PluginConfig;
}

/**
 * Search options for plugin queries
 */
export interface PluginSearchOptions {
  /** Filter by name pattern */
  name?: string;
  /** Filter by enabled status */
  enabled?: boolean;
  /** Filter by minimum version */
  minVersion?: string;
  /** Filter by maximum version */
  maxVersion?: string;
  /** Include plugins with specific dependency */
  hasDependency?: string;
}

/**
 * Install result
 */
export interface InstallResult {
  /** Whether installation succeeded */
  success: boolean;
  /** Installed plugin info */
  pluginInfo?: PluginInfo;
  /** Error message if failed */
  error?: string;
  /** Warnings during installation */
  warnings?: string[];
}

/**
 * Upgrade result
 */
export interface UpgradeResult {
  /** Whether upgrade succeeded */
  success: boolean;
  /** New plugin info */
  pluginInfo?: PluginInfo;
  /** Previous version */
  previousVersion?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * PluginRegistry - Manages plugin registration and lifecycle
 */
export class PluginRegistry {
  private plugins: Map<string, PluginInfo> = new Map();
  private loader: PluginLoaderInterface;
  private listeners: Map<string, Set<(event: RegistryEvent) => void>> = new Map();

  /**
   * Create a new PluginRegistry
   * @param loader - Plugin loader implementation
   */
  constructor(loader: PluginLoaderInterface) {
    this.loader = loader;
  }

  // ==================== Registration Methods ====================

  /**
   * Register a plugin
   * @param pluginId - Plugin identifier
   * @param metadata - Plugin metadata
   * @param packagePath - Installation path
   * @param config - Plugin configuration
   */
  register(
    pluginId: string,
    metadata: PluginMetadata,
    packagePath: string,
    config?: PluginConfig
  ): PluginInfo {
    const now = Date.now();

    const pluginInfo: PluginInfo = {
      pluginId,
      metadata,
      packagePath,
      installTime: now,
      status: {
        pluginId,
        state: PluginLifecycleState.DISCOVERED,
        enabled: config?.enabled ?? true,
      },
      config,
    };

    this.plugins.set(pluginId, pluginInfo);
    this.emit('plugin:registered', { pluginId, metadata });

    return pluginInfo;
  }

  /**
   * Unregister a plugin
   * @param pluginId - Plugin identifier
   */
  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      this.plugins.delete(pluginId);
      this.emit('plugin:unregistered', { pluginId });
    }
  }

  /**
   * Get plugin information
   * @param pluginId - Plugin identifier
   */
  getPluginInfo(pluginId: string): PluginInfo | null {
    return this.plugins.get(pluginId) || null;
  }

  /**
   * Check if plugin is registered
   * @param pluginId - Plugin identifier
   */
  isRegistered(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  // ==================== Query Methods ====================

  /**
   * List all registered plugins
   */
  listAll(): PluginInfo[] {
    return Array.from(this.plugins.values());
  }

  /**
   * List registered plugin identifiers
   */
  listIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * List enabled plugins
   */
  listEnabled(): PluginInfo[] {
    return Array.from(this.plugins.values()).filter((p) => p.status.enabled);
  }

  /**
   * List disabled plugins
   */
  listDisabled(): PluginInfo[] {
    return Array.from(this.plugins.values()).filter((p) => !p.status.enabled);
  }

  /**
   * Search plugins
   * @param options - Search options
   */
  search(options: PluginSearchOptions): PluginInfo[] {
    return Array.from(this.plugins.values()).filter((plugin) => {
      if (options.name && !plugin.metadata.name.includes(options.name)) {
        return false;
      }
      if (options.enabled !== undefined && plugin.status.enabled !== options.enabled) {
        return false;
      }
      if (options.minVersion && this.compareVersion(plugin.metadata.version, options.minVersion) < 0) {
        return false;
      }
      if (options.maxVersion && this.compareVersion(plugin.metadata.version, options.maxVersion) > 0) {
        return false;
      }
      if (options.hasDependency) {
        const deps = plugin.metadata.dependencies || [];
        if (!deps.some((d) => d.pluginName === options.hasDependency)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Find plugins by dependency
   * @param pluginId - Plugin identifier
   */
  findDependents(pluginId: string): PluginInfo[] {
    return Array.from(this.plugins.values()).filter((plugin) => {
      const deps = plugin.metadata.dependencies || [];
      return deps.some((d) => d.pluginName === pluginId);
    });
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Load a plugin
   * @param pluginId - Plugin identifier
   * @param config - Optional configuration
   */
  async load(pluginId: string, config?: PluginConfig): Promise<PluginLoadResult> {
    const pluginInfo = this.plugins.get(pluginId);
    if (!pluginInfo) {
      return { success: false, error: `Plugin not registered: ${pluginId}` };
    }

    const result = await this.loader.load(pluginId, config);

    if (result.success) {
      pluginInfo.status.state = PluginLifecycleState.ACTIVE;
      this.emit('plugin:loaded', { pluginId });
    }

    return result;
  }

  /**
   * Unload a plugin
   * @param pluginId - Plugin identifier
   */
  async unload(pluginId: string): Promise<void> {
    const pluginInfo = this.plugins.get(pluginId);
    if (pluginInfo) {
      await this.loader.unload(pluginId);
      pluginInfo.status.state = PluginLifecycleState.SHUTDOWN;
      this.emit('plugin:unloaded', { pluginId });
    }
  }

  /**
   * Enable a plugin
   * @param pluginId - Plugin identifier
   */
  enable(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.status.enabled = true;
      this.emit('plugin:enabled', { pluginId });
    }
  }

  /**
   * Disable a plugin
   * @param pluginId - Plugin identifier
   */
  disable(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.status.enabled = false;
      this.emit('plugin:disabled', { pluginId });
    }
  }

  /**
   * Update plugin status
   * @param pluginId - Plugin identifier
   * @param state - New lifecycle state
   * @param error - Optional error message
   */
  updateStatus(pluginId: string, state: PluginLifecycleState, error?: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.status.state = state;
      plugin.status.lastStateChange = Date.now();
      if (error) {
        plugin.status.error = error;
      }
      this.emit('plugin:status_changed', { pluginId, state });
    }
  }

  // ==================== Installation Methods ====================

  /**
   * Discover and register available plugins
   */
  async discoverPlugins(): Promise<PluginDiscoveryResult[]> {
    const results = await this.loader.discover();

    for (const result of results) {
      if (result.success && result.metadata) {
        this.register(result.pluginId, result.metadata, result.source);
      }
    }

    return results;
  }

  // ==================== Event Methods ====================

  /**
   * Subscribe to registry events
   * @param event - Event name
   * @param listener - Event listener
   */
  on(event: string, listener: (event: RegistryEvent) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  /**
   * Subscribe to registry events once
   * @param event - Event name
   * @param listener - Event listener
   */
  once(event: string, listener: (event: RegistryEvent) => void): void {
    const unsubscribe = this.on(event, (e) => {
      listener(e);
      unsubscribe();
    });
  }

  /**
   * Emit a registry event
   * @param event - Event name
   * @param data - Event data
   */
  private emit(event: string, data: Record<string, any>): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const registryEvent: RegistryEvent = {
        type: event,
        timestamp: Date.now(),
        data,
      };
      listeners.forEach((listener) => listener(registryEvent));
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Compare semantic versions
   */
  private compareVersion(a: string, b: string): number {
    const parse = (v: string) => v.split('.').map(Number);
    const aParts = parse(a);
    const bParts = parse(b);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aNum = aParts[i] || 0;
      const bNum = bParts[i] || 0;
      if (aNum !== bNum) return aNum - bNum;
    }

    return 0;
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.plugins.clear();
    this.emit('registry:cleared', {});
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalPlugins: number;
    enabledPlugins: number;
    disabledPlugins: number;
    loadedPlugins: number;
  } {
    const plugins = Array.from(this.plugins.values());
    return {
      totalPlugins: plugins.length,
      enabledPlugins: plugins.filter((p) => p.status.enabled).length,
      disabledPlugins: plugins.filter((p) => !p.status.enabled).length,
      loadedPlugins: plugins.filter(
        (p) =>
          p.status.state === PluginLifecycleState.ACTIVE ||
          p.status.state === PluginLifecycleState.RUNNING ||
          p.status.state === PluginLifecycleState.INITIALIZED
      ).length,
    };
  }
}

/**
 * Registry event interface
 */
export interface RegistryEvent {
  /** Event type */
  type: string;
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data: Record<string, any>;
}