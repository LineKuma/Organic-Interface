/**
 * Communication module - Agent message passing
 *
 * Provides standardized communication primitives for agent-to-agent
 * messaging including message formats, channels, and queue management.
 */

// AgentMessage - Message definition
export {
  type AgentMessage,
  type MessageMetadata,
  type MessageError,
  type MessageOptions,
  MessageAction,
  MessagePriority,
  DeliveryMode,
  MessageFlag,
  createAgentMessage,
  createExecuteMessage,
  createQueryMessage,
  createResponseMessage,
  createHeartbeatMessage,
  createNotifyMessage,
  createErrorMessage,
  isMessageExpired,
  isValidMessage,
  compareMessagePriority,
} from './AgentMessage.js';

// AgentChannel - Communication channel
export {
  type AgentChannelConfig,
  type MessageHandler,
  type SubscriptionFilter,
  AgentChannel,
  DEFAULT_CHANNEL_CONFIG,
  createAgentChannel,
} from './AgentChannel.js';

// MessageQueue - Priority queue for messages
export {
  type MessageQueueConfig,
  type QueueFilter,
  type QueueStats,
  MessageQueue,
  DEFAULT_QUEUE_CONFIG,
} from './MessageQueue.js';
