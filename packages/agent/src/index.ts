/**
 * @organic/agent - Agent module for Organic Interface
 *
 * Provides the core agent implementation, task scheduling,
 * and context management capabilities.
 */

// Re-export from @organic/utils
export {
  createLogger,
  type Logger,
  type LogLevel,
} from '@organic/utils';

// Re-export from core module
export {
  Agent,
  type AgentResult,
  type AgentTaskInput,
  type AgentTaskHandler,
  type AgentExecutionContext,
  type AgentEvents,
  type AgentConfig,
  type AgentConfigOptions,
  AgentType,
  AgentPriority,
  DEFAULT_AGENT_CONFIG,
  createAgentConfig,
  type AgentState,
  type AgentStateOptions,
  type AgentStats,
  AgentStatus,
  createAgentState,
  getAgentStats,
} from './core/index.js';

// Re-export from scheduler module
export {
  TaskQueue,
  TaskPriority,
  TaskStatus,
  type Task,
  type TaskOptions,
  type TaskQueueConfig,
  type SchedulerConfig,
  type SchedulerEvents,
  type TaskExecutor,
  DEFAULT_QUEUE_CONFIG,
  createTask,
  TaskScheduler,
  DEFAULT_SCHEDULER_CONFIG,
} from './scheduler/index.js';

// Re-export from context module
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
} from './context/index.js';

/**
 * Module version
 */
export const VERSION = '0.1.0';
