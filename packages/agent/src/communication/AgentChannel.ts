/**
 * AgentChannel - Agent communication channel
 *
 * Provides bidirectional communication between agents with support
 * for synchronous, asynchronous, and pub/sub messaging patterns.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import {
  type AgentMessage,
  MessageAction,
  type MessageMetadata,
  type MessageOptions,
  createAgentMessage,
  createExecuteMessage,
  createQueryMessage,
  createResponseMessage,
  createHeartbeatMessage,
  createNotifyMessage,
  createErrorMessage,
  isMessageExpired,
} from './AgentMessage.js';

/**
 * Channel configuration
 */
export interface AgentChannelConfig {
  /** Channel identifier */
  channelId?: string;
  /** Agent identifier (this channel's owner) */
  agentId: string;
  /** Default timeout for message responses (ms) */
  defaultTimeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay base in ms */
  retryDelayBase?: number;
  /** Enable message persistence */
  persistMessages?: boolean;
}

/**
 * Default channel configuration
 */
export const DEFAULT_CHANNEL_CONFIG: Required<AgentChannelConfig> = {
  channelId: `channel_${Date.now()}`,
  agentId: 'unknown',
  defaultTimeout: 5000,
  maxRetries: 3,
  retryDelayBase: 100,
  persistMessages: false,
};

/**
 * Message handler type
 */
export type MessageHandler = (message: AgentMessage) => Promise<unknown> | unknown;

/**
 * Subscription filter
 */
export interface SubscriptionFilter {
  action?: MessageAction;
  source?: string;
  target?: string;
  predicate?: (message: AgentMessage) => boolean;
}

/**
 * Pending request for request-response pattern
 */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  retries: number;
}

/**
 * Channel subscription
 */
interface Subscription {
  id: string;
  filter: SubscriptionFilter;
  handler: MessageHandler;
  pattern?: string;
}

/**
 * AgentChannel - Communication channel for agent messaging
 *
 * Features:
 * - Direct message sending (async/sync)
 * - Request-response pattern
 * - Pub/sub messaging
 * - Automatic retry with backoff
 * - Message filtering
 */
export class AgentChannel extends EventEmitter {
  private config: Required<AgentChannelConfig>;
  private logger: Logger;
  private handlers: Map<string, MessageHandler> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageHistory: AgentMessage[] = [];
  private maxHistorySize: number = 100;

  /**
   * Create a new AgentChannel
   */
  constructor(config: AgentChannelConfig) {
    super();
    this.config = {
      ...DEFAULT_CHANNEL_CONFIG,
      ...config,
    };
    this.logger = createLogger({
      prefix: `channel:${this.config.agentId}`,
    });
  }

  // ==================== Lifecycle ====================

  /**
   * Get channel ID
   */
  getChannelId(): string {
    return this.config.channelId;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.config.agentId;
  }

  // ==================== Message Handlers ====================

  /**
   * Register a message handler for a specific action
   */
  registerHandler(action: MessageAction, handler: MessageHandler): void {
    this.handlers.set(action, handler);
    this.logger.debug(`Handler registered for action: ${action}`);
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(action: MessageAction): boolean {
    const deleted = this.handlers.delete(action);
    if (deleted) {
      this.logger.debug(`Handler unregistered for action: ${action}`);
    }
    return deleted;
  }

  /**
   * Check if handler exists for action
   */
  hasHandler(action: MessageAction): boolean {
    return this.handlers.has(action);
  }

  // ==================== Message Processing ====================

  /**
   * Handle incoming message
   */
  async handleMessage(message: AgentMessage): Promise<unknown> {
    // Check expiration
    if (isMessageExpired(message)) {
      this.logger.warn(`Message expired: ${message.id}`);
      throw new Error(`Message ${message.id} has expired`);
    }

    // Store in history
    this.addToHistory(message);

    this.logger.debug(`Handling message: ${message.action} from ${message.source} to ${message.target}`);

    // Check for response to pending request
    if (message.metadata?.correlationId && this.pendingRequests.has(message.metadata.correlationId)) {
      return this.handlePendingResponse(message);
    }

    // Find appropriate handler
    const handler = this.handlers.get(message.action);
    if (!handler) {
      // Check for wildcard handler
      const wildcardHandler = this.handlers.get('*' as MessageAction);
      if (wildcardHandler) {
        return wildcardHandler(message);
      }

      this.logger.warn(`No handler for action: ${message.action}`);
      throw new Error(`No handler registered for action: ${message.action}`);
    }

    // Execute handler
    try {
      const result = await handler(message);

      // If request-response mode, send response
      if (message.deliveryMode === 'request_response' && message.metadata?.replyTo) {
        const response = createResponseMessage(
          this.config.agentId,
          message.source,
          result,
          message.metadata.correlationId ?? message.id
        );
        await this.send(response);
      }

      return result;
    } catch (error) {
      // Send error response
      if (message.deliveryMode === 'request_response' && message.metadata?.replyTo) {
        const errorMsg = createErrorMessage(
          this.config.agentId,
          message.source,
          'CHANNEL_ERROR',
          error instanceof Error ? error.message : String(error),
          message.metadata.correlationId
        );
        await this.send(errorMsg);
      }
      throw error;
    }
  }

  /**
   * Handle response to pending request
   */
  private handlePendingResponse(message: AgentMessage): unknown {
    const correlationId = message.metadata?.correlationId;
    if (!correlationId) {
      return;
    }

    const pending = this.pendingRequests.get(correlationId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);

    if (message.action === MessageAction.ERROR) {
      pending.reject(new Error(message.error?.message ?? 'Unknown error'));
    } else {
      pending.resolve(message.payload);
    }

    this.pendingRequests.delete(correlationId);
    return undefined;
  }

  // ==================== Direct Messaging ====================

  /**
   * Send a message (fire and forget)
   */
  async send(message: AgentMessage): Promise<void> {
    // Ensure source is set
    if (!message.source) {
      message.source = this.config.agentId;
    }

    this.addToHistory(message);
    this.emit('message:sent', message);

    // In a real implementation, this would route to the appropriate transport
    // For now, we just emit the event
    this.logger.debug(`Message sent: ${message.action} -> ${message.target}`);
  }

  /**
   * Send message with retry
   */
  async sendWithRetry(
    message: AgentMessage,
    options?: {
      maxRetries?: number;
      onRetry?: (attempt: number, error: Error) => void;
    }
  ): Promise<void> {
    const maxRetries = options?.maxRetries ?? this.config.maxRetries;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        await this.send(message);
        return;
      } catch (error) {
        attempt++;
        if (attempt > maxRetries) {
          throw error;
        }

        const delay = this.config.retryDelayBase * Math.pow(2, attempt - 1);
        this.logger.debug(`Retry attempt ${attempt} after ${delay}ms`);

        if (options?.onRetry) {
          options.onRetry(attempt, error as Error);
        }

        await this.sleep(delay);
      }
    }
  }

  /**
   * Send and wait for response (request-response pattern)
   */
  async sendAndWait<R = unknown>(
    message: AgentMessage,
    options?: {
      timeout?: number;
      maxRetries?: number;
    }
  ): Promise<R> {
    const timeout = options?.timeout ?? this.config.defaultTimeout;
    const correlationId = message.metadata?.correlationId ?? message.id;

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Request timed out after ${timeout}ms`));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(correlationId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timer,
        retries: options?.maxRetries ?? this.config.maxRetries,
      });

      // Send message
      this.send(message).catch((error) => {
        clearTimeout(timer);
        this.pendingRequests.delete(correlationId);
        reject(error);
      });
    });
  }

  // ==================== Pub/Sub ====================

  /**
   * Subscribe to messages matching filter
   */
  subscribe(
    filter: SubscriptionFilter,
    handler: MessageHandler
  ): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      filter,
      handler,
    });

    this.logger.debug(`Subscription created: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(subscriptionId: string): boolean {
    const deleted = this.subscriptions.delete(subscriptionId);
    if (deleted) {
      this.logger.debug(`Subscription removed: ${subscriptionId}`);
    }
    return deleted;
  }

  /**
   * Publish a message to all matching subscribers
   */
  async publish(message: AgentMessage): Promise<void> {
    let matched = false;

    for (const sub of this.subscriptions.values()) {
      if (this.matchesFilter(message, sub.filter)) {
        matched = true;
        try {
          await sub.handler(message);
        } catch (error) {
          this.logger.error(`Subscription handler error:`, error);
        }
      }
    }

    if (!matched) {
      this.logger.debug(`No subscribers for message: ${message.id}`);
    }
  }

  /**
   * Check if message matches filter
   */
  private matchesFilter(message: AgentMessage, filter: SubscriptionFilter): boolean {
    if (filter.action && message.action !== filter.action) {
      return false;
    }
    if (filter.source && message.source !== filter.source) {
      return false;
    }
    if (filter.target && message.target !== filter.target && message.target !== '*') {
      return false;
    }
    if (filter.predicate && !filter.predicate(message)) {
      return false;
    }
    return true;
  }

  // ==================== Utility Methods ====================

  /**
   * Add message to history
   */
  private addToHistory(message: AgentMessage): void {
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }
  }

  /**
   * Get message history
   */
  getHistory(limit?: number): AgentMessage[] {
    if (limit) {
      return this.messageHistory.slice(-limit);
    }
    return [...this.messageHistory];
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get pending request count
   */
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Dispose channel
   */
  dispose(): void {
    // Clear pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Channel disposed'));
    }
    this.pendingRequests.clear();

    // Clear subscriptions
    this.subscriptions.clear();

    // Clear handlers
    this.handlers.clear();

    // Clear history
    this.messageHistory = [];

    // Remove all listeners
    this.removeAllListeners();

    this.logger.info('AgentChannel disposed');
  }
}

/**
 * Create a channel with preset handlers for common patterns
 */
export function createAgentChannel(
  agentId: string,
  handlers?: Partial<Record<MessageAction, MessageHandler>>
): AgentChannel {
  const channel = new AgentChannel({ agentId });

  if (handlers) {
    for (const [action, handler] of Object.entries(handlers)) {
      if (handler) {
        channel.registerHandler(action as MessageAction, handler);
      }
    }
  }

  return channel;
}