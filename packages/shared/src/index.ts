/**
 * @organic/shared - Shared types and utilities for Organic Interface
 */

// Config types
export interface KernelConfig {
  name: string;
  version: string;
  plugins?: string[];
  tools?: string[];
}

export interface PluginConfig {
  name: string;
  enabled: boolean;
  options?: Record<string, unknown>;
}

// Plugin types
export interface PluginContext {
  kernel: KernelApi;
  config: PluginConfig;
}

export interface InitializeResult {
  success: boolean;
  error?: string;
}

export interface PluginInput {
  action: string;
  params?: Record<string, unknown>;
}

export interface PluginOutput {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Tool types
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Kernel API
export interface KernelApi {
  getConfig(): KernelConfig;
  getVersion(): string;
  registerPlugin(plugin: PluginInterface): Promise<void>;
  unregisterPlugin(name: string): Promise<void>;
  getPlugin(name: string): PluginInterface | undefined;
  listPlugins(): PluginInterface[];
  executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult>;
}

// Plugin Interface
export interface PluginInterface {
  readonly name: string;
  readonly version: string;
  initialize(context: PluginContext): Promise<InitializeResult>;
  execute(input: PluginInput): Promise<PluginOutput>;
  shutdown(): Promise<void>;
}

// Logger
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export function createLogger(prefix: string, level: LogLevel = 'info'): Logger {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const minLevel = levels.indexOf(level);

  const log = (lvl: LogLevel, message: string, ...args: unknown[]) => {
    if (levels.indexOf(lvl) >= minLevel) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${lvl.toUpperCase()}] [${prefix}] ${message}`, ...args);
    }
  };

  return {
    debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args),
    info: (msg: string, ...args: unknown[]) => log('info', msg, ...args),
    warn: (msg: string, ...args: unknown[]) => log('warn', msg, ...args),
    error: (msg: string, ...args: unknown[]) => log('error', msg, ...args),
  };
}
