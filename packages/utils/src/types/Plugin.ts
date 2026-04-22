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
 * Text service interface for Kernel text interaction
 */
export interface TextServiceInterface {
  /** Print text to stdout */
  print(text: string, options?: unknown): void;
  /** Print text with newline */
  println(text?: string): void;
  /** Format data as table */
  formatTable(data: unknown, options?: unknown): string;
  /** Format items as list */
  formatList(items: string[], options?: unknown): string;
  /** Format section with title */
  formatSection(title: string, content: string): string;
  /** Apply style to text */
  styled(text: string, style: unknown): string;
  /** Success styled text */
  success(text: string): string;
  /** Error styled text */
  error(text: string): string;
  /** Warning styled text */
  warning(text: string): string;
  /** Info styled text */
  info(text: string): string;
  /** Create text stream */
  createStream(options?: unknown): unknown;
  /** Progress bar string */
  progress(current: number, total: number, message?: string): string;
  /** Create spinner */
  spinner(type?: string): unknown;
}

/**
 * Info service interface for Kernel system information
 */
export interface InfoServiceInterface {
  /** Get system configuration */
  getConfig(key: string): unknown;
  /** Get all configurations */
  getAllConfigs(): Record<string, unknown>;
  /** Get runtime information */
  getRuntimeInfo(): unknown;
  /** Get project context */
  getProjectContext(): unknown;
  /** Get project root */
  getProjectRoot(): string;
  /** Get project name */
  getProjectName(): string;
  /** Get project version */
  getProjectVersion(): string;
  /** Get system information */
  getSystemInfo(): unknown;
  /** Get platform information */
  getPlatformInfo(): unknown;
  /** Get environment variable */
  getEnv(key: string): string | undefined;
  /** Get all environment variables */
  getAllEnvs(): Record<string, string>;
}

/**
 * Kernel API interface provided to plugins
 */
export interface KernelApi {
  /** Kernel configuration */
  getConfig(): KernelConfig;
  /** Kernel version */
  getVersion(): string;
  /** Text service for CLI output */
  text: TextServiceInterface;
  /** Info service for system information */
  info: InfoServiceInterface;
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