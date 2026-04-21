/**
 * Plugin related types for Organic Interface
 */

/**
 * Plugin context provided during initialization
 */
export interface PluginContext {
  /** Kernel API interface */
  kernel: KernelApi;
  /** Plugin configuration */
  config: PluginConfig;
}

/**
 * Result of plugin initialization
 */
export interface InitializeResult {
  /** Whether initialization was successful */
  success: boolean;
  /** Error message if initialization failed */
  error?: string;
}

/**
 * Input to plugin execution
 */
export interface PluginInput {
  /** Action name to execute */
  action: string;
  /** Action parameters */
  params?: Record<string, unknown>;
}

/**
 * Output from plugin execution
 */
export interface PluginOutput {
  /** Whether execution was successful */
  success: boolean;
  /** Result data if successful */
  data?: unknown;
  /** Error message if failed */
  error?: string;
}

/**
 * Plugin interface that all plugins must implement
 */
export interface PluginInterface {
  /** Plugin unique name */
  readonly name: string;
  /** Plugin version */
  readonly version: string;
  /** Plugin description */
  readonly description?: string;

  /**
   * Initialize the plugin
   * @param context - Plugin context with kernel API and config
   * @returns Initialization result
   */
  initialize(context: PluginContext): Promise<InitializeResult>;

  /**
   * Execute a plugin action
   * @param input - Plugin input with action and params
   * @returns Plugin output with result or error
   */
  execute(input: PluginInput): Promise<PluginOutput>;

  /**
   * Shutdown the plugin gracefully
   */
  shutdown(): Promise<void>;
}

/**
 * Kernel API interface provided to plugins
 */
export interface KernelApi {
  /** Get kernel configuration */
  getConfig(): KernelConfig;
  /** Get kernel version */
  getVersion(): string;
  /** Register a plugin */
  registerPlugin(plugin: PluginInterface): Promise<void>;
  /** Unregister a plugin by name */
  unregisterPlugin(name: string): Promise<void>;
  /** Get a plugin by name */
  getPlugin(name: string): PluginInterface | undefined;
  /** List all registered plugins */
  listPlugins(): PluginInterface[];
  /** Execute a tool by name */
  executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult>;
}

/**
 * Re-export tool types for convenience
 */
export type { ToolResult } from './Tool.js';