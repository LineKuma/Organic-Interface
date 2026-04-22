/**
 * Type exports for core conversation plugin
 */

// Session types
export {
  SessionStatus,
  type SessionConfig,
  type ContextWindowConfig,
  type ContextWindowType,
  type Session,
  type SessionUpdates,
  type SessionFilter,
  type SessionCreateOptions,
} from './session.js';

// Context types
export {
  type ContextWindow,
  type ContextUpdates,
  type ContextStats,
  CompressionStrategy,
  type ConversationContext,
} from './context.js';

// Input types
export {
  MessageSender,
  InputFormat,
  InputType,
  type Message,
  type ParsedInput,
  type InputOptions,
  type InputMetadata,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
} from './input.js';

// Output types
export {
  ContentFormat,
  ResponseType,
  ToolCallStatus,
  ResultType,
  type ResponseContent,
  type ResponseMessage,
  type ToolCall,
  type StreamInfo,
  type ConversationResult,
  type ToolCallResult,
  type ToolCallError,
  type FormattedOutput,
  OutputFormat,
  type OutputMetadata,
} from './output.js';