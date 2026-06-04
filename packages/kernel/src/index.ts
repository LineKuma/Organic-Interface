/**
 * @organic/kernel - Core Kernel module for Organic Interface
 *
 * Kernel provides the core runtime for the Organic Interface system,
 * managing plugins, lifecycle, events, and tool execution.
 */

// Re-export types from @organic/utils
export type {
  KernelConfig,
  KernelApi,
  PluginInterface,
  PluginContext,
  PluginInput,
  PluginOutput,
  PluginConfig,
  ToolResult,
  ToolError,
  ToolMetadata,
  TextServiceInterface,
  InfoServiceInterface,
} from '@organic/utils';

// Re-export logger utilities
export { createLogger, type Logger, type LogLevel } from '@organic/utils';

// Kernel core components
export { Kernel, type KernelOptions } from './kernel/Kernel.js';
export {
  EventBus,
  KernelEvents,
  type EventSubscription,
  type KernelEvent,
} from './kernel/EventBus.js';
export {
  LifecycleManager,
  LifecycleState,
  type LifecycleTransition,
} from './kernel/LifecycleManager.js';
export { PluginManager, type PluginMetadata } from './kernel/PluginManager.js';

// Kernel services
export {
  TextService,
  InfoService,
  type TextServiceConfig,
  type TextStream,
  type SpinnerController,
  type SpinnerFrames,
  type TextStyle,
  type TextColor,
  type TableData,
  type TableOptions,
  type ListOptions,
  type PrintOptions,
  type StreamOptions,
  type InfoServiceConfig,
  type ProjectContext,
  type SystemInfo,
  type PlatformInfo,
  type RuntimeInfo,
  type ConfigValue,
} from './services/index.js';

/**
 * Module version
 */
export const VERSION = '0.1.0';
