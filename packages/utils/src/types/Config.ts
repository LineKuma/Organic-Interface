/**
 * Config types for Organic Interface
 */

/**
 * Kernel configuration
 */
export interface KernelConfig {
  /** Kernel instance name */
  name: string;
  /** Kernel version */
  version: string;
  /** Enabled plugin list */
  plugins?: string[];
  /** Enabled tool list */
  tools?: string[];
  /** Custom configuration options */
  options?: Record<string, unknown>;
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  /** Plugin name */
  name: string;
  /** Whether the plugin is enabled */
  enabled: boolean;
  /** Custom configuration options */
  options?: Record<string, unknown>;
}

/**
 * Generic configuration with key-value options
 */
export interface GenericConfig {
  [key: string]: unknown;
}
