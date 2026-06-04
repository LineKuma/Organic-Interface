/**
 * @organic/plugins - Plugin system module for Organic Interface
 *
 * Provides plugin management, loading, and lifecycle control.
 */

// Re-export all types
export type {
  PluginInterface,
  PluginMetadata,
  PluginDependency,
  PluginHooks,
  PluginLifecycleState,
  PluginConfig,
  ValidateResult,
  ValidationError,
  PluginStatus,
  PluginStats,
  PluginContext,
  PluginInput,
  PluginOutput,
  InitializeResult,
} from './interfaces/PluginInterface.js';

export type {
  PluginLoaderInterface,
  PluginLoaderOptions,
  PluginLoadResult,
  PluginDiscoveryResult,
  CompatibilityResult,
  CompatibilityIssue,
  RemotePluginSource,
  RemotePluginLoadResult,
} from './interfaces/PluginLoaderInterface.js';

export type {
  PluginInfo,
  PluginSearchOptions,
  InstallResult,
  UpgradeResult,
  RegistryEvent,
} from './registry/PluginRegistry.js';

// Re-export loaders
export { PluginLoader } from './loaders/PluginLoader.js';
export {
  RemotePluginLoader,
  type RemotePluginLoaderOptions,
} from './loaders/RemotePluginLoader.js';

// Re-export registry
export { PluginRegistry } from './registry/PluginRegistry.js';

// Re-export base plugin
export { BasePlugin, type BasePluginOptions } from './base/BasePlugin.js';

// Re-export core-conversation plugin
export {
  CoreConversationPlugin,
  SessionManager,
  ContextManager,
  InputParser,
  OutputFormatter,
  METADATA,
  PLUGIN_ID,
  COMPATIBLE_API_VERSIONS,
} from './core-conversation/src/index.js';

export type {
  Session,
  SessionConfig,
  SessionStatus,
  ContextWindow,
  Message,
  ParsedInput,
  ConversationResult,
  FormattedOutput,
  ConversationError,
  SessionError,
  ContextError,
} from './core-conversation/src/index.js';

/**
 * Module version
 */
export const VERSION = '0.1.0';
