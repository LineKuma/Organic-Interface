/**
 * Plugin Interface - Core plugin contract for Organic Interface
 */

import type { PluginInterface as BasePluginInterface } from '@organic/utils';

/**
 * Plugin metadata interface
 */
export interface PluginMetadata {
  /** Plugin unique identifier */
  readonly id: string;
  /** Plugin name */
  readonly name: string;
  /** Plugin version (semver) */
  readonly version: string;
  /** Plugin description */
  readonly description?: string;
  /** Compatible API version */
  readonly apiVersion: string;
  /** Minimum kernel version required */
  readonly minKernelVersion?: string;
  /** Plugin dependencies */
  readonly dependencies?: PluginDependency[];
  /** Default configuration */
  readonly defaultConfig?: Record<string, unknown>;
  /** Lifecycle hooks */
  readonly hooks?: PluginHooks;
  /** Author information */
  readonly author?: string;
}

/**
 * Plugin dependency definition
 */
export interface PluginDependency {
  /** Name of the plugin this depends on */
  pluginName: string;
  /** Version range (semver) */
  versionRange: string;
  /** Whether this is an optional dependency */
  optional?: boolean;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  /** Called when plugin is loaded */
  onLoad?: () => void | Promise<void>;
  /** Called when plugin is unloaded */
  onUnload?: () => void | Promise<void>;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
  /** Called when configuration changes */
  onConfigChange?: (config: Record<string, unknown>) => void;
}

/**
 * Plugin lifecycle state
 */
export enum PluginLifecycleState {
  DISCOVERED = 'discovered',
  RESOLVED = 'resolved',
  LOADING = 'loading',
  INITIALIZED = 'initialized',
  ACTIVE = 'active',
  RUNNING = 'running',
  SHUTTING_DOWN = 'shutting_down',
  SHUTDOWN = 'shutdown',
  ERROR = 'error',
  UNLOADED = 'unloaded',
}

/**
 * Plugin configuration for initialization
 */
export interface PluginConfig {
  /** Plugin identifier */
  pluginId: string;
  /** Configuration overrides */
  config?: Record<string, unknown>;
  /** Whether plugin is enabled by default */
  enabled?: boolean;
  /** Priority for loading order */
  priority?: number;
}

/**
 * Extended plugin interface with metadata support
 */
export interface PluginInterface extends BasePluginInterface {
  /** Get plugin metadata */
  getMetadata(): PluginMetadata;

  /**
   * Validate plugin configuration
   * @param config - Configuration to validate
   * @returns Validation result
   */
  validateConfig?(config: Record<string, unknown>): Promise<ValidateResult>;
}

/**
 * Configuration validation result
 */
export interface ValidateResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors if any */
  errors?: ValidationError[];
}

/**
 * Configuration validation error
 */
export interface ValidationError {
  /** Field path that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Expected value or format */
  expected?: string;
  /** Actual value received */
  actual?: unknown;
}

/**
 * Plugin status information
 */
export interface PluginStatus {
  /** Plugin identifier */
  pluginId: string;
  /** Current lifecycle state */
  state: PluginLifecycleState;
  /** Whether plugin is enabled */
  enabled: boolean;
  /** Error message if in error state */
  error?: string;
  /** Last state transition timestamp */
  lastStateChange?: number;
  /** Execution statistics */
  stats?: PluginStats;
}

/**
 * Plugin execution statistics
 */
export interface PluginStats {
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Average execution time in ms */
  avgExecutionTime: number;
  /** Last execution timestamp */
  lastExecution?: number;
}

/**
 * Re-export base types for convenience
 */
export type { PluginContext, PluginInput, PluginOutput, InitializeResult } from '@organic/utils';
