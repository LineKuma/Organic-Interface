/**
 * AgentMessage - Agent communication message definition
 *
 * Defines the standardized message format for inter-agent communication.
 */

import { createLogger, type Logger } from '@organic/utils';

/**
 * Message action types
 */
export enum MessageAction {
  /** Execute a task */
  EXECUTE = 'execute',
  /** Query for information */
  QUERY = 'query',
  /** Response to a message */
  RESPONSE = 'response',
  /** Subscribe to events */
  SUBSCRIBE = 'subscribe',
  /** Notify about events */
  NOTIFY = 'notify',
  /** Heartbeat ping */
  HEARTBEAT = 'heartbeat',
  /** Error response */
  ERROR = 'error',
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  HIGH = 0,
  NORMAL = 1,
  LOW = 2,
}

/**
 * Message delivery modes
 */
export enum DeliveryMode {
  /** Fire and forget */
  ONE_WAY = 'one_way',
  /** Request and response */
  REQUEST_RESPONSE = 'request_response',
  /** Publish to multiple subscribers */
  BROADCAST = 'broadcast',
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  /** Correlation ID for tracking related messages */
  correlationId?: string;
  /** Reply-to address */
  replyTo?: string;
  /** Time to live in milliseconds */
  ttl?: number;
  /** Message flags */
  flags?: MessageFlag[];
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Message flags
 */
export enum MessageFlag {
  PERSISTENT = 'persistent',
  REDELIVER = 'redeliver',
  PRIORITY = 'priority',
  BATCH = 'batch',
}

/**
 * Agent message structure
 *
 * Standard message format for all agent-to-agent communication.
 */
export interface AgentMessage<T = unknown> {
  /** Unique message identifier */
  id: string;

  /** Source agent identifier */
  source: string;

  /** Target agent identifier (or wildcard for broadcast) */
  target: string;

  /** Message action type */
  action: MessageAction;

  /** Message payload */
  payload: T;

  /** Message priority */
  priority: MessagePriority;

  /** Delivery mode */
  deliveryMode: DeliveryMode;

  /** Timestamp when message was created */
  timestamp: number;

  /** Expiration time (optional) */
  expiresAt?: number;

  /** Message metadata */
  metadata?: MessageMetadata;

  /** Error information (for error messages) */
  error?: MessageError;
}

/**
 * Message error structure
 */
export interface MessageError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: unknown;
}

/**
 * Message options for creating messages
 */
export interface MessageOptions<T = unknown> {
  id?: string;
  source: string;
  target: string;
  action: MessageAction;
  payload: T;
  priority?: MessagePriority;
  deliveryMode?: DeliveryMode;
  ttl?: number;
  correlationId?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create an agent message
 */
export function createAgentMessage<T = unknown>(options: MessageOptions<T>): AgentMessage<T> {
  const now = Date.now();
  const message: AgentMessage<T> = {
    id: options.id ?? generateMessageId(),
    source: options.source,
    target: options.target,
    action: options.action,
    payload: options.payload,
    priority: options.priority ?? MessagePriority.NORMAL,
    deliveryMode: options.deliveryMode ?? DeliveryMode.REQUEST_RESPONSE,
    timestamp: now,
    expiresAt: options.ttl ? now + options.ttl : undefined,
    metadata: {
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      ttl: options.ttl,
      headers: options.headers,
    },
  };

  return message;
}

/**
 * Create an execute message
 */
export function createExecuteMessage<T = unknown>(
  source: string,
  target: string,
  payload: T,
  options?: {
    priority?: MessagePriority;
    correlationId?: string;
    ttl?: number;
    headers?: Record<string, string>;
  }
): AgentMessage<T> {
  return createAgentMessage({
    source,
    target,
    action: MessageAction.EXECUTE,
    payload,
    priority: options?.priority ?? MessagePriority.NORMAL,
    correlationId: options?.correlationId,
    ttl: options?.ttl,
    headers: options?.headers,
  });
}

/**
 * Create a query message
 */
export function createQueryMessage<T = unknown>(
  source: string,
  target: string,
  payload: T,
  options?: {
    priority?: MessagePriority;
    correlationId?: string;
    ttl?: number;
  }
): AgentMessage<T> {
  return createAgentMessage({
    source,
    target,
    action: MessageAction.QUERY,
    payload,
    priority: options?.priority ?? MessagePriority.NORMAL,
    correlationId: options?.correlationId,
    ttl: options?.ttl,
  });
}

/**
 * Create a response message
 */
export function createResponseMessage<T = unknown>(
  source: string,
  target: string,
  payload: T,
  correlationId: string,
  options?: {
    priority?: MessagePriority;
    isError?: boolean;
    error?: MessageError;
  }
): AgentMessage<T> {
  return createAgentMessage({
    source,
    target,
    action: options?.isError ? MessageAction.ERROR : MessageAction.RESPONSE,
    payload,
    priority: options?.priority ?? MessagePriority.NORMAL,
    correlationId,
  });
}

/**
 * Create a heartbeat message
 */
export function createHeartbeatMessage(
  source: string,
  target: string,
  stats?: {
    load: number;
    activeTasks: number;
    completedTasks: number;
  }
): AgentMessage<{ load: number; activeTasks: number; completedTasks: number }> {
  return createAgentMessage({
    source,
    target,
    action: MessageAction.HEARTBEAT,
    payload: stats ?? { load: 0, activeTasks: 0, completedTasks: 0 },
    priority: MessagePriority.LOW,
    deliveryMode: DeliveryMode.ONE_WAY,
  });
}

/**
 * Create a notify message
 */
export function createNotifyMessage<T = unknown>(
  source: string,
  target: string,
  event: string,
  data?: T
): AgentMessage<{ event: string; data?: T }> {
  return createAgentMessage({
    source,
    target,
    action: MessageAction.NOTIFY,
    payload: { event, data },
    priority: MessagePriority.NORMAL,
    deliveryMode: DeliveryMode.BROADCAST,
  });
}

/**
 * Create an error message
 */
export function createErrorMessage(
  source: string,
  target: string,
  code: string,
  message: string,
  correlationId?: string,
  details?: unknown
): AgentMessage<null> {
  return createAgentMessage({
    source,
    target,
    action: MessageAction.ERROR,
    payload: null,
    priority: MessagePriority.HIGH,
    correlationId,
    headers: details ? { 'x-error-details': JSON.stringify(details) } : undefined,
  });
}

/**
 * Check if message is expired
 */
export function isMessageExpired(message: AgentMessage): boolean {
  if (!message.expiresAt) {
    return false;
  }
  return Date.now() > message.expiresAt;
}

/**
 * Check if message is valid
 */
export function isValidMessage(message: unknown): message is AgentMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const msg = message as AgentMessage;

  return (
    typeof msg.id === 'string' &&
    typeof msg.source === 'string' &&
    typeof msg.target === 'string' &&
    Object.values(MessageAction).includes(msg.action) &&
    msg.payload !== undefined &&
    Object.values(MessagePriority).includes(msg.priority)
  );
}

/**
 * Compare message priority for sorting
 */
export function compareMessagePriority(a: AgentMessage, b: AgentMessage): number {
  return a.priority - b.priority;
}