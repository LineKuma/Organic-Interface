/**
 * Plugin Loader Interface - Contract for plugin loading mechanisms
 */

import type { PluginInterface, PluginMetadata, PluginConfig, PluginStatus } from './PluginInterface.js';

/**
 * Plugin loader options
 */
export interface PluginLoaderOptions {
  /** Base directory for plugins */
  baseDir?: string;
  /** Enable caching of loaded plugins */
  cacheEnabled?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
}

/**
 * Plugin loader result
 */
export interface PluginLoadResult {
  /** Whether loading was successful */
  success: boolean;
  /** Loaded plugin instance */
  plugin?: PluginInterface;
  /** Error message if loading failed */
  error?: string;
  /** Plugin metadata if loaded */
  metadata?: PluginMetadata;
}

/**
 * Plugin discovery result
 */
export interface PluginDiscoveryResult {
  /** Plugin identifier */
  pluginId: string;
  /** Plugin path or source */
  source: string;
  /** Discovered metadata */
  metadata?: PluginMetadata;
  /** Discovery timestamp */
  discoveredAt: number;
  /** Whether discovery was successful */
  success: boolean;
  /** Error message if discovery failed */
  error?: string;
}

/**
 * Plugin loader interface
 * Implementations provide different mechanisms for loading plugins
 */
export interface PluginLoaderInterface {
  /**
   * Load a plugin by identifier
   * @param pluginId - Plugin identifier
   * @param config - Optional plugin configuration
   * @returns Promise resolving to load result
   */
  load(pluginId: string, config?: PluginConfig): Promise<PluginLoadResult>;

  /**
   * Unload a plugin by identifier
   * @param pluginId - Plugin identifier
   */
  unload(pluginId: string): Promise<void>;

  /**
   * Reload a plugin
   * @param pluginId - Plugin identifier
   * @returns Promise resolving to load result
   */
  reload(pluginId: string): Promise<PluginLoadResult>;

  /**
   * Discover available plugins
   * @returns Promise resolving to list of discovered plugins
   */
  discover(): Promise<PluginDiscoveryResult[]>;

  /**
   * Get plugin status
   * @param pluginId - Plugin identifier
   * @returns Plugin status or undefined if not loaded
   */
  getStatus(pluginId: string): PluginStatus | undefined;

  /**
   * Check if a plugin is loaded
   * @param pluginId - Plugin identifier
   * @returns True if plugin is loaded
   */
  isLoaded(pluginId: string): boolean;

  /**
   * Get all loaded plugin identifiers
   * @returns Array of plugin identifiers
   */
  listLoaded(): string[];

  /**
   * Validate plugin compatibility
   * @param metadata - Plugin metadata to validate
   * @returns Promise resolving to validation result
   */
  validateCompatibility(metadata: PluginMetadata): Promise<CompatibilityResult>;
}

/**
 * Plugin compatibility validation result
 */
export interface CompatibilityResult {
  /** Whether plugin is compatible */
  compatible: boolean;
  /** Compatibility issues */
  issues?: CompatibilityIssue[];
}

/**
 * Compatibility issue
 */
export interface CompatibilityIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue code */
  code: string;
  /** Issue description */
  message: string;
}

/**
 * Remote plugin source information
 */
export interface RemotePluginSource {
  /** Plugin identifier */
  pluginId: string;
  /** Remote URL or identifier */
  url: string;
  /** Source type (npm, git, http, etc.) */
  type: 'npm' | 'git' | 'http' | 'file';
  /** Version constraint */
  version?: string;
  /** Checksum for verification */
  checksum?: string;
}

/**
 * Remote plugin loader result
 */
export interface RemotePluginLoadResult extends PluginLoadResult {
  /** Source information */
  source: RemotePluginSource;
  /** Installation path */
  installPath?: string;
}