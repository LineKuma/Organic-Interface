/**
 * Context module exports
 */

// Message exports
export {
  type Message,
  type MessageSender,
  type MessageContent,
  type MessageOptions,
  type Attachment,
  type ToolCall,
  type ToolResponse,
  MessageType,
  MessageStatus,
  MessageFlag,
  ContentFormat,
  AttachmentType,
  createMessage,
  createUserMessage,
  createAssistantMessage,
  createToolCallMessage,
  createToolResponseMessage,
  createSystemMessage,
  createErrorMessage,
  isValidMessage,
} from './Message.js';

// ContextManager exports
export {
  ContextManager,
  type ConversationContext,
  type Participant,
  type ContextMetadata,
  type StateItem,
  type StateChange,
  type ContextStats,
  type ContextManagerConfig,
  ContextStatus,
  ContextItemType,
  StateType,
  DEFAULT_CONTEXT_CONFIG,
} from './ContextManager.js';
