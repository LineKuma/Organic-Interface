/**
 * Context Manager - Manages agent execution context
 *
 * Handles conversation context, message history, state management,
 * and context propagation for multi-agent collaboration.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import {
  type Message,
  MessageType,
  ContentFormat,
  createMessage,
} from './Message.js';

/**
 * Context status enumeration
 */
export enum ContextStatus {
  /** Context is initializing */
  INITIALIZING = 'initializing',
  /** Context is active */
  ACTIVE = 'active',
  /** Context is idle */
  IDLE = 'idle',
  /** Context is archived */
  ARCHIVED = 'archived',
  /** Context is deleted */
  DELETED = 'deleted',
}

/**
 * Context item type enumeration
 */
export enum ContextItemType {
  MESSAGE = 'message',
  STATE = 'state',
  TOOL_CALL = 'tool_call',
  RESULT = 'result',
  ATTACHMENT = 'attachment',
  CUSTOM = 'custom',
}

/**
 * State type enumeration
 */
export enum StateType {
  SESSION = 'session',
  PERSISTENT = 'persistent',
  TEMPORARY = 'temporary',
}

/**
 * Participant in a conversation
 */
export interface Participant {
  /** Participant ID */
  id: string;
  /** Participant type */
  type: 'user' | 'agent' | 'plugin';
  /** Participant name */
  name: string;
  /** Participant role */
  role?: string;
  /** Joined timestamp */
  joinedAt: number;
}

/**
 * Context metadata
 */
export interface ContextMetadata {
  /** Created by */
  createdBy?: string;
  /** Tags */
  tags?: string[];
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Conversation context
 */
export interface ConversationContext {
  /** Context unique ID */
  id: string;
  /** Session ID for grouping contexts */
  sessionId: string;
  /** Conversation participants */
  participants: Participant[];
  /** Message history */
  messages: Message[];
  /** Context metadata */
  metadata: ContextMetadata;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Current status */
  status: ContextStatus;
}

/**
 * State item
 */
export interface StateItem<T = unknown> {
  /** State key */
  key: string;
  /** State value */
  value: T;
  /** State type */
  type: StateType;
  /** Namespace */
  namespace: string;
  /** Creation timestamp */
  createdAt: number;
  /** Update timestamp */
  updatedAt: number;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Read-only flag */
  readonly?: boolean;
}

/**
 * State change record
 */
export interface StateChange {
  /** Change ID */
  id: string;
  /** State key */
  key: string;
  /** Namespace */
  namespace: string;
  /** Old value */
  oldValue?: unknown;
  /** New value */
  newValue: unknown;
  /** Change type */
  changeType: 'set' | 'update' | 'delete' | 'clear';
  /** Timestamp */
  timestamp: number;
}

/**
 * Context statistics
 */
export interface ContextStats {
  messageCount: number;
  participantCount: number;
  tokenEstimate: number;
  lastActivityAt: number;
  createdAt: number;
}

/**
 * Context manager configuration
 */
export interface ContextManagerConfig {
  /** Maximum context window size (messages) */
  maxWindowSize?: number;
  /** Context TTL in milliseconds */
  ttl?: number;
  /** Enable message compression */
  compressMessages?: boolean;
  /** Enable state persistence */
  persistStates?: boolean;
  /** Default namespace */
  defaultNamespace?: string;
}

/**
 * Default context manager configuration
 */
export const DEFAULT_CONTEXT_CONFIG: Required<ContextManagerConfig> = {
  maxWindowSize: 100,
  ttl: 3600000, // 1 hour
  compressMessages: false,
  persistStates: false,
  defaultNamespace: 'default',
};

/**
 * Context change callback
 */
export type ContextChangeCallback = (change: StateChange) => void;

/**
 * Context Manager
 *
 * Manages conversation context, message history, and state
 * for agent execution.
 */
export class ContextManager extends EventEmitter {
  private config: Required<ContextManagerConfig>;
  private contexts: Map<string, ConversationContext> = new Map();
  private states: Map<string, Map<string, StateItem>> = new Map();
  private subscribers: Map<string, Set<ContextChangeCallback>> = new Map();
  private logger: Logger;

  /**
   * Create a new ContextManager
   */
  constructor(config: ContextManagerConfig = {}) {
    super();
    this.config = {
      ...DEFAULT_CONTEXT_CONFIG,
      ...config,
    };
    this.logger = createLogger({ prefix: 'context-manager' });
  }

  // ==================== Context Lifecycle ====================

  /**
   * Create a new conversation context
   */
  create(sessionId: string, participants: Participant[]): ConversationContext {
    const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const context: ConversationContext = {
      id: contextId,
      sessionId,
      participants,
      messages: [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
      expiresAt: this.config.ttl ? now + this.config.ttl : undefined,
      status: ContextStatus.ACTIVE,
    };

    this.contexts.set(contextId, context);
    this.initializeStateStore(contextId);

    this.logger.info(`Context created: ${contextId}`);
    return context;
  }

  /**
   * Get context by ID
   */
  get(contextId: string): ConversationContext | null {
    const context = this.contexts.get(contextId);
    if (!context) {
      return null;
    }

    // Check expiration
    if (context.expiresAt && Date.now() > context.expiresAt) {
      this.archive(contextId);
      return null;
    }

    return context;
  }

  /**
   * Delete context
   */
  delete(contextId: string): boolean {
    const context = this.contexts.get(contextId);
    if (!context) {
      return false;
    }

    context.status = ContextStatus.DELETED;
    this.contexts.delete(contextId);
    this.states.delete(contextId);

    this.logger.info(`Context deleted: ${contextId}`);
    return true;
  }

  /**
   * Archive context
   */
  archive(contextId: string): boolean {
    const context = this.contexts.get(contextId);
    if (!context) {
      return false;
    }

    context.status = ContextStatus.ARCHIVED;
    this.logger.info(`Context archived: ${contextId}`);
    return true;
  }

  /**
   * Restore archived context
   */
  restore(contextId: string): ConversationContext | null {
    const context = this.contexts.get(contextId);
    if (!context || context.status !== ContextStatus.ARCHIVED) {
      return null;
    }

    context.status = ContextStatus.ACTIVE;
    context.updatedAt = Date.now();
    context.expiresAt = Date.now() + this.config.ttl;

    this.logger.info(`Context restored: ${contextId}`);
    return context;
  }

  // ==================== Message Management ====================

  /**
   * Add message to context
   */
  addMessage(contextId: string, message: Message): boolean {
    const context = this.get(contextId);
    if (!context) {
      this.logger.warn(`Context not found: ${contextId}`);
      return false;
    }

    // Add message
    context.messages.push(message);
    context.updatedAt = Date.now();

    // Trim if exceeds max window size
    if (context.messages.length > this.config.maxWindowSize) {
      context.messages = context.messages.slice(-this.config.maxWindowSize);
    }

    // Update status
    context.status = ContextStatus.ACTIVE;

    this.emit('message:added', { contextId, message });
    return true;
  }

  /**
   * Create and add a user message
   */
  addUserMessage(
    contextId: string,
    userId: string,
    userName: string,
    text: string
  ): Message | null {
    const message = createMessage({
      sender: { id: userId, type: 'user', name: userName },
      content: { text, format: ContentFormat.PLAIN_TEXT },
      type: MessageType.USER_MESSAGE,
      context_id: contextId,
    });

    if (this.addMessage(contextId, message)) {
      return message;
    }
    return null;
  }

  /**
   * Create and add an assistant message
   */
  addAssistantMessage(
    contextId: string,
    agentId: string,
    agentName: string,
    text: string
  ): Message | null {
    const message = createMessage({
      sender: { id: agentId, type: 'agent', name: agentName },
      content: { text, format: ContentFormat.PLAIN_TEXT },
      type: MessageType.ASSISTANT_MESSAGE,
      context_id: contextId,
    });

    if (this.addMessage(contextId, message)) {
      return message;
    }
    return null;
  }

  /**
   * Get messages from context window
   */
  getMessages(
    contextId: string,
    options?: { limit?: number; offset?: number; types?: MessageType[] }
  ): Message[] {
    const context = this.get(contextId);
    if (!context) {
      return [];
    }

    let messages = context.messages;

    // Filter by types
    if (options?.types && options.types.length > 0) {
      messages = messages.filter((m) => options.types!.includes(m.type));
    }

    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? messages.length;

    return messages.slice(offset, offset + limit);
  }

  /**
   * Get last N messages
   */
  getRecentMessages(contextId: string, count: number = 10): Message[] {
    const context = this.get(contextId);
    if (!context) {
      return [];
    }

    return context.messages.slice(-count);
  }

  // ==================== State Management ====================

  /**
   * Initialize state store for context
   */
  private initializeStateStore(contextId: string): void {
    if (!this.states.has(contextId)) {
      this.states.set(contextId, new Map());
    }
  }

  /**
   * Set state value
   */
  setState<T>(
    contextId: string,
    key: string,
    value: T,
    options?: {
      type?: StateType;
      namespace?: string;
      expiresAt?: number;
      readonly?: boolean;
    }
  ): void {
    this.initializeStateStore(contextId);
    const store = this.states.get(contextId)!;
    const namespace = options?.namespace ?? this.config.defaultNamespace;
    const fullKey = `${namespace}:${key}`;

    const oldItem = store.get(fullKey);
    const now = Date.now();

    const stateItem: StateItem<T> = {
      key: fullKey,
      value,
      type: options?.type ?? StateType.SESSION,
      namespace,
      createdAt: oldItem?.createdAt ?? now,
      updatedAt: now,
      expiresAt: options?.expiresAt,
      readonly: options?.readonly,
    };

    store.set(fullKey, stateItem as StateItem);

    // Emit change
    const change: StateChange = {
      id: `change_${Date.now()}`,
      key: fullKey,
      namespace,
      oldValue: oldItem?.value,
      newValue: value,
      changeType: oldItem ? 'update' : 'set',
      timestamp: now,
    };

    this.notifySubscribers(change);
    this.emit('state:changed', { contextId, change });
  }

  /**
   * Get state value
   */
  getState<T>(contextId: string, key: string, namespace?: string): T | undefined {
    const store = this.states.get(contextId);
    if (!store) {
      return undefined;
    }

    const ns = namespace ?? this.config.defaultNamespace;
    const fullKey = `${ns}:${key}`;
    const item = store.get(fullKey);

    if (!item) {
      return undefined;
    }

    // Check expiration
    if (item.expiresAt && Date.now() > item.expiresAt) {
      store.delete(fullKey);
      return undefined;
    }

    return item.value as T;
  }

  /**
   * Delete state value
   */
  deleteState(contextId: string, key: string, namespace?: string): boolean {
    const store = this.states.get(contextId);
    if (!store) {
      return false;
    }

    const ns = namespace ?? this.config.defaultNamespace;
    const fullKey = `${ns}:${key}`;
    const item = store.get(fullKey);

    if (!item) {
      return false;
    }

    if (item.readonly) {
      this.logger.warn(`Cannot delete readonly state: ${fullKey}`);
      return false;
    }

    const change: StateChange = {
      id: `change_${Date.now()}`,
      key: fullKey,
      namespace: ns,
      oldValue: item.value,
      newValue: undefined,
      changeType: 'delete',
      timestamp: Date.now(),
    };

    store.delete(fullKey);

    this.notifySubscribers(change);
    return true;
  }

  /**
   * Get all states in namespace
   */
  getStates<T>(contextId: string, namespace?: string): Map<string, T> {
    const store = this.states.get(contextId);
    if (!store) {
      return new Map();
    }

    const ns = namespace ?? this.config.defaultNamespace;
    const result = new Map<string, T>();

    for (const [key, item] of store) {
      if (item.namespace === ns) {
        result.set(key.replace(`${ns}:`, ''), item.value as T);
      }
    }

    return result;
  }

  /**
   * Clear all states in namespace
   */
  clearStates(contextId: string, namespace?: string): void {
    const store = this.states.get(contextId);
    if (!store) {
      return;
    }

    const ns = namespace ?? this.config.defaultNamespace;

    for (const [key, item] of store) {
      if (item.namespace === ns && !item.readonly) {
        store.delete(key);
      }
    }
  }

  // ==================== Subscription ====================

  /**
   * Subscribe to state changes
   */
  subscribe(keys: string | string[], callback: ContextChangeCallback, namespace?: string): () => void {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const ns = namespace ?? this.config.defaultNamespace;

    for (const key of keyList) {
      const fullKey = `${ns}:${key}`;
      if (!this.subscribers.has(fullKey)) {
        this.subscribers.set(fullKey, new Set());
      }
      this.subscribers.get(fullKey)!.add(callback);
    }

    return () => {
      for (const key of keyList) {
        const fullKey = `${ns}:${key}`;
        this.subscribers.get(fullKey)?.delete(callback);
      }
    };
  }

  /**
   * Notify subscribers of change
   */
  private notifySubscribers(change: StateChange): void {
    const callbacks = this.subscribers.get(change.key);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(change);
        } catch (error) {
          this.logger.error('Error in state change callback', error);
        }
      }
    }
  }

  // ==================== Statistics ====================

  /**
   * Get context statistics
   */
  getStats(contextId: string): ContextStats | null {
    const context = this.get(contextId);
    if (!context) {
      return null;
    }

    // Estimate token count (rough approximation: 4 chars per token)
    const messageTexts = context.messages.map((m) => m.content.text ?? '').join('');
    const tokenEstimate = Math.ceil(messageTexts.length / 4);

    return {
      messageCount: context.messages.length,
      participantCount: context.participants.length,
      tokenEstimate,
      lastActivityAt: context.updatedAt,
      createdAt: context.createdAt,
    };
  }

  /**
   * Get all context IDs
   */
  getAllContextIds(): string[] {
    return Array.from(this.contexts.keys());
  }

  /**
   * Get active context count
   */
  getActiveCount(): number {
    let count = 0;
    for (const context of this.contexts.values()) {
      if (context.status === ContextStatus.ACTIVE) {
        count++;
      }
    }
    return count;
  }

  // ==================== Cleanup ====================

  /**
   * Clean up expired contexts
   */
  cleanup(): { deleted: number; archived: number } {
    const now = Date.now();
    let deleted = 0;
    let archived = 0;

    for (const [contextId, context] of this.contexts) {
      if (context.expiresAt && now > context.expiresAt) {
        if (context.status === ContextStatus.ARCHIVED) {
          this.delete(contextId);
          deleted++;
        } else {
          this.archive(contextId);
          archived++;
        }
      }
    }

    if (deleted > 0 || archived > 0) {
      this.logger.info(`Cleanup: ${deleted} deleted, ${archived} archived`);
    }

    return { deleted, archived };
  }
}
