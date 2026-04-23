/**
 * Type exports for core conversation plugin
 */

// Session types - 枚举作为值导出，接口作为类型导出
export {
  SessionStatus,
  ContextWindowType,
  type SessionConfig,
  type ContextWindowConfig,
} from './session.js';

export type {
  Session,
  SessionUpdates,
  SessionFilter,
  SessionCreateOptions,
} from './session.js';

// Context types - 枚举作为值导出，接口作为类型导出
export {
  CompressionStrategy,
} from './context.js';

export type {
  ContextWindow,
  ContextUpdates,
  ContextStats,
  ConversationContext,
} from './context.js';

// Input types - 枚举作为值导出，接口作为类型导出
export {
  MessageSender,
  InputFormat,
  InputType,
} from './input.js';

export type {
  Message,
  ParsedInput,
  InputOptions,
  InputMetadata,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './input.js';

// Output types - 枚举作为值导出，接口作为类型导出
export {
  ContentFormat,
  ResponseType,
  ToolCallStatus,
  ResultType,
  OutputFormat,
} from './output.js';

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
} from './output.js';