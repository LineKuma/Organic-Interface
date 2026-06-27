/**
 * Core Conversation Plugin - Main module exports
 *
 * Provides the core conversation functionality for text-based interaction.
 * This is the primary user-facing plugin following the Linux design philosophy.
 */

// Plugin main class
export { CoreConversationPlugin, METADATA, CONFIG_SCHEMA } from './CoreConversationPlugin.js';

// Session manager
export {
  SessionManager,
  type SessionManagerOptions,
  type SessionStorage,
} from './SessionManager.js';

// Context manager
export { ContextManager, type ContextManagerOptions } from './ContextManager.js';

// Input parser
export { InputParser, type InputParserOptions } from './InputParser.js';

// Output formatter
export {
  OutputFormatter,
  type OutputFormatterOptions,
  type OutputTheme,
} from './OutputFormatter.js';

// Types - re-export from internal modules
export type {
  // Session types
  Session,
  SessionConfig,
  SessionStatus,
  SessionUpdates,
  SessionFilter,
  SessionCreateOptions,
  ContextWindowConfig,
  ContextWindowType,
} from './types/session.js';

// Context types
export type {
  ContextWindow,
  ContextUpdates,
  ContextStats,
  ConversationContext,
  CompressionStrategy,
} from './types/context.js';

// Input types
export type {
  Message,
  ParsedInput,
  InputOptions,
  InputMetadata,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  InputType,
  InputFormat,
  MessageSender,
} from './types/input.js';

// Output types
export type {
  ResponseContent,
  ResponseMessage,
  ToolCall,
  StreamInfo,
  ConversationResult,
  ToolCallResult,
  ToolCallError,
  FormattedOutput,
  OutputMetadata,
  ResultType,
  ResponseType,
  ContentFormat,
  ToolCallStatus,
  OutputFormat,
} from './types/output.js';

// Errors
export {
  ConversationError,
  ConversationErrorCode,
  type ConversationErrorCodeType,
} from './errors/ConversationError.js';

export { SessionError } from './errors/SessionError.js';

export { ContextError } from './errors/ContextError.js';

export * from './errors/index.js';

// Types index
export * from './types/index.js';

/**
 * Plugin version
 */
export const VERSION = '1.0.0';

/**
 * Plugin identifier
 */
export const PLUGIN_ID = 'core-conversation';

/**
 * Plugin interface compatibility check
 */
export const COMPATIBLE_API_VERSIONS = ['1.0.0'] as const;
