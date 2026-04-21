/**
 * ContextService - Core context management service
 *
 * Provides high-level context management capabilities including
 * context lifecycle, message handling, state management, and
 * context propagation for multi-agent collaboration.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import type {
  Message,
  MessageSender,
  MessageContent,
} from '../Message.js';
import {
  ContextManager,
  type ConversationContext,
  type Participant,
  type ContextMetadata,
  type ContextManagerConfig,
  ContextStatus,
  type StateItem,
  type StateChange,
} from '../ContextManager.js';
import type {
  ContextItem,
  ContextItemFilter,
  ContextItemUpdate,
} from '../models/ContextItem.js';
import {
  createContextItem,
  createMessageContextItem,
  createStateContextItem,
  createToolCallContextItem,
  createResultContextItem,
  updateContextItem,
  isContextItemExpired,
  touchContextItem,
  ContextItemType,
} from '../models/ContextItem.js';

/**
 * Propagation mode enumeration
 */
export enum PropagationMode {
  /** Direct propagation - full context */
  DIRECT = 'direct',
  /** Reference propagation - context ID only */
  REFERENCE = 'reference',
  /** Incremental propagation - changes only */
  INCREMENTAL = 'incremental',
  /** Hybrid propagation - automatic selection */
  HYBRID = 'hybrid',
}

/**
 * Propagation scope configuration
 */
export interface PropagationScope {
  /** Include message history */
  includeMessages: boolean;
  /** Include state information */
  includeStates: boolean;
  /** Include tool call history */
  includeToolCalls: boolean;
  /** Include attachments */
  includeAttachments: boolean;
  /** Message time range */
  messageTimeRange?: {
    start?: number;
    end?: number;
  };
  /** Message count limit */
  messageLimit?: number;
}

/**
 * Context filter configuration
 */
export interface ContextFilter {
  /** Filter by message types */
  messageTypes?: string[];
  /** Filter by senders */
  senders?: string[];
  /** Filter by time range */
  timeRange?: {
    start?: number;
    end?: number;
  };
  /** Filter by content keywords */
  contentKeywords?: string[];
  /** Filter by flags */
  flags?: string[];
}

/**
 * Execution context stack frame
 */
export interface ExecutionFrame {
  /** Frame ID */
  id: string;
  /** Context ID */
  contextId: string;
  /** Agent ID */
  agentId: string;
  /** Parent frame ID */
  parentFrameId?: string;
  /** Child frame IDs */
  childFrameIds: string[];
  /** Enter timestamp */
  enterTime: number;
  /** Exit timestamp */
  exitTime?: number;
  /** Execution status */
  status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  /** Result data */
  result?: unknown;
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Execution context stack
 */
export interface ExecutionContextStack {
  /** Root context ID */
  rootContextId: string;
  /** Current stack of frames */
  stack: ExecutionFrame[];
  /** Maximum nesting depth */
  maxDepth: number;
}

/**
 * Context service configuration
 */
export interface ContextServiceConfig extends ContextManagerConfig {
  /** Enable context propagation */
  enablePropagation?: boolean;
  /** Maximum nesting depth for nested calls */
  maxNestingDepth?: number;
  /** Enable automatic cleanup */
  autoCleanup?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
  /** Enable context compression */
  enableCompression?: boolean;
}

/**
 * Default context service configuration
 */
export const DEFAULT_CONTEXT_SERVICE_CONFIG: Required<ContextServiceConfig> = {
  ...{
    maxWindowSize: 100,
    ttl: 3600000,
    compressMessages: false,
    persistStates: false,
    defaultNamespace: 'default',
  },
  enablePropagation: true,
  maxNestingDepth: 5,
  autoCleanup: true,
  cleanupInterval: 60000, // 1 minute
  enableCompression: false,
};

/**
 * ContextService
 *
 * Provides high-level context management for agent execution.
 */
export class ContextService extends EventEmitter {
  private config: Required<ContextServiceConfig>;
  private contextManager: ContextManager;
  private contextItems: Map<string, Map<string, ContextItem>> = new Map();
  private executionStacks: Map<string, ExecutionContextStack> = new Map();
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private logger: Logger;

  /**
   * Create a new ContextService
   */
  constructor(config: ContextServiceConfig = {}) {
    super();
    this.config = {
      ...DEFAULT_CONTEXT_SERVICE_CONFIG,
      ...config,
    };

    this.contextManager = new ContextManager({
      maxWindowSize: this.config.maxWindowSize,
      ttl: this.config.ttl,
      compressMessages: this.config.compressMessages,
      persistStates: this.config.persistStates,
      defaultNamespace: this.config.defaultNamespace,
    });

    this.logger = createLogger({ prefix: 'context-service' });

    // Setup auto cleanup
    if (this.config.autoCleanup) {
      this.startCleanupTimer();
    }

    // Forward events from context manager
    this.contextManager.on('message:added', (data) => {
      this.emit('message:added', data);
    });
    this.contextManager.on('state:changed', (data) => {
      this.emit('state:changed', data);
    });
  }

  // ==================== Context Lifecycle ====================

  /**
   * Create a new context
   */
  createContext(
    sessionId: string,
    participants: Participant[],
    metadata?: ContextMetadata
  ): ConversationContext {
    const context = this.contextManager.create(sessionId, participants);

    if (metadata) {
      context.metadata = { ...context.metadata, ...metadata };
    }

    // Initialize item store
    this.contextItems.set(context.id, new Map());

    this.logger.info(`Context created: ${context.id}`);
    this.emit('context:created', context);

    return context;
  }

  /**
   * Get context by ID
   */
  getContext(contextId: string): ConversationContext | null {
    return this.contextManager.get(contextId);
  }

  /**
   * Delete context
   */
  deleteContext(contextId: string): boolean {
    // Clean up items
    this.contextItems.delete(contextId);

    // Clean up execution stack
    this.executionStacks.delete(contextId);

    const result = this.contextManager.delete(contextId);

    if (result) {
      this.emit('context:deleted', contextId);
    }

    return result;
  }

  /**
   * Archive context
   */
  archiveContext(contextId: string): boolean {
    return this.contextManager.archive(contextId);
  }

  /**
   * Restore archived context
   */
  restoreContext(contextId: string): ConversationContext | null {
    return this.contextManager.restore(contextId);
  }

  // ==================== Message Management ====================

  /**
   * Add message to context
   */
  addMessage(contextId: string, message: Message): boolean {
    const result = this.contextManager.addMessage(contextId, message);

    if (result) {
      // Also add as context item
      this.addContextItem(
        createMessageContextItem(contextId, message)
      );
    }

    return result;
  }

  /**
   * Get messages from context
   */
  getMessages(
    contextId: string,
    options?: {
      limit?: number;
      offset?: number;
      types?: string[];
    }
  ): Message[] {
    const types = options?.types as Message['type'][] | undefined;
    return this.contextManager.getMessages(contextId, {
      limit: options?.limit,
      offset: options?.offset,
      types,
    });
  }

  /**
   * Get recent messages
   */
  getRecentMessages(contextId: string, count: number = 10): Message[] {
    return this.contextManager.getRecentMessages(contextId, count);
  }

  // ==================== Context Item Management ====================

  /**
   * Add context item
   */
  addContextItem<T>(item: ContextItem<T>): void {
    const store = this.contextItems.get(item.contextId);
    if (!store) {
      const newStore = new Map<string, ContextItem>();
      newStore.set(item.id, item);
      this.contextItems.set(item.contextId, newStore);
    } else {
      store.set(item.id, item);
    }

    this.emit('item:added', { contextId: item.contextId, item });
  }

  /**
   * Get context item
   */
  getContextItem<T>(
    contextId: string,
    itemId: string
  ): ContextItem<T> | null {
    const store = this.contextItems.get(contextId);
    if (!store) {
      return null;
    }

    const item = store.get(itemId);
    if (!item) {
      return null;
    }

    // Check expiration
    if (isContextItemExpired(item)) {
      store.delete(itemId);
      return null;
    }

    // Touch to update access time
    const updatedItem = touchContextItem(item);
    store.set(itemId, updatedItem);

    return updatedItem;
  }

  /**
   * Get all context items
   */
  getContextItems(
    contextId: string,
    filter?: ContextItemFilter
  ): ContextItem[] {
    const store = this.contextItems.get(contextId);
    if (!store) {
      return [];
    }

    let items = Array.from(store.values());

    // Apply filters
    if (filter) {
      if (filter.types && filter.types.length > 0) {
        items = items.filter((item) =>
          filter.types!.includes(item.type)
        );
      }

      if (filter.contextIds && filter.contextIds.length > 0) {
        items = items.filter((item) =>
          filter.contextIds!.includes(item.contextId)
        );
      }

      if (filter.tags && filter.tags.length > 0) {
        items = items.filter((item) =>
          filter.tags!.some((tag) => item.metadata.tags?.includes(tag))
        );
      }

      if (filter.timeRange) {
        items = items.filter((item) => {
          const inRange =
            (!filter.timeRange!.start ||
              item.createdAt >= filter.timeRange!.start) &&
            (!filter.timeRange!.end ||
              item.createdAt <= filter.timeRange!.end);
          return inRange;
        });
      }

      if (!filter.includeExpired) {
        items = items.filter((item) => !isContextItemExpired(item));
      }
    }

    return items;
  }

  /**
   * Update context item
   */
  updateContextItem<T>(
    contextId: string,
    itemId: string,
    updates: ContextItemUpdate<T>
  ): ContextItem<T> | null {
    const store = this.contextItems.get(contextId);
    if (!store) {
      return null;
    }

    const item = store.get(itemId);
    if (!item) {
      return null;
    }

    const updatedItem = updateContextItem(item, updates);
    store.set(itemId, updatedItem);

    this.emit('item:updated', { contextId, itemId, item: updatedItem });

    return updatedItem;
  }

  /**
   * Delete context item
   */
  deleteContextItem(contextId: string, itemId: string): boolean {
    const store = this.contextItems.get(contextId);
    if (!store) {
      return false;
    }

    const result = store.delete(itemId);

    if (result) {
      this.emit('item:deleted', { contextId, itemId });
    }

    return result;
  }

  // ==================== State Management ====================

  /**
   * Set state value
   */
  setState<T>(
    contextId: string,
    key: string,
    value: T,
    options?: {
      namespace?: string;
      expiresAt?: number;
      readonly?: boolean;
    }
  ): void {
    this.contextManager.setState(contextId, key, value, options);

    // Also add as context item
    const item = createStateContextItem(contextId, key, value, {
      stateKey: key,
      ...options,
    });
    this.addContextItem(item);
  }

  /**
   * Get state value
   */
  getState<T>(contextId: string, key: string, namespace?: string): T | undefined {
    return this.contextManager.getState<T>(contextId, key, namespace);
  }

  /**
   * Delete state
   */
  deleteState(contextId: string, key: string, namespace?: string): boolean {
    return this.contextManager.deleteState(contextId, key, namespace);
  }

  /**
   * Get all states in namespace
   */
  getStates<T>(contextId: string, namespace?: string): Map<string, T> {
    return this.contextManager.getStates<T>(contextId, namespace);
  }

  // ==================== Execution Context Stack ====================

  /**
   * Push execution frame
   */
  pushExecutionFrame(
    contextId: string,
    agentId: string
  ): ExecutionFrame | null {
    let stack = this.executionStacks.get(contextId);

    if (!stack) {
      stack = {
        rootContextId: contextId,
        stack: [],
        maxDepth: this.config.maxNestingDepth,
      };
      this.executionStacks.set(contextId, stack);
    }

    // Check depth limit
    if (stack.stack.length >= stack.maxDepth) {
      this.logger.warn(`Max nesting depth exceeded for context: ${contextId}`);
      return null;
    }

    const parentFrame = stack.stack[stack.stack.length - 1];
    const frame: ExecutionFrame = {
      id: `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      contextId,
      agentId,
      parentFrameId: parentFrame?.id,
      childFrameIds: [],
      enterTime: Date.now(),
      status: 'running',
    };

    // Update parent child frames
    if (parentFrame) {
      parentFrame.childFrameIds.push(frame.id);
    }

    stack.stack.push(frame);
    this.emit('frame:pushed', { contextId, frame });

    return frame;
  }

  /**
   * Pop execution frame
   */
  popExecutionFrame(
    contextId: string,
    result?: unknown,
    error?: ExecutionFrame['error']
  ): ExecutionFrame | null {
    const stack = this.executionStacks.get(contextId);
    if (!stack || stack.stack.length === 0) {
      return null;
    }

    const frame = stack.stack.pop()!;
    frame.exitTime = Date.now();
    frame.status = error ? 'failed' : 'completed';
    frame.result = result;
    frame.error = error;

    this.emit('frame:popped', { contextId, frame });

    return frame;
  }

  /**
   * Get current execution frame
   */
  getCurrentFrame(contextId: string): ExecutionFrame | null {
    const stack = this.executionStacks.get(contextId);
    if (!stack || stack.stack.length === 0) {
      return null;
    }

    return stack.stack[stack.stack.length - 1];
  }

  /**
   * Get execution context stack
   */
  getExecutionStack(contextId: string): ExecutionContextStack | null {
    return this.executionStacks.get(contextId) ?? null;
  }

  // ==================== Context Propagation ====================

  /**
   * Propagate context to another agent
   */
  propagateContext(
    sourceContextId: string,
    targetAgentId: string,
    mode: PropagationMode,
    scope: PropagationScope
  ): {
    contextId?: string;
    referenceId?: string;
    incremental?: {
      messages: Message[];
      states: StateItem[];
      items: ContextItem[];
    };
  } {
    const sourceContext = this.getContext(sourceContextId);
    if (!sourceContext) {
      throw new Error(`Source context not found: ${sourceContextId}`);
    }

    switch (mode) {
      case PropagationMode.DIRECT:
        // Return full context
        return { contextId: sourceContextId };

      case PropagationMode.REFERENCE:
        // Return reference only
        return { referenceId: sourceContextId };

      case PropagationMode.INCREMENTAL:
        // Return incremental changes
        return {
          incremental: this.getIncrementalContext(sourceContextId, scope),
        };

      case PropagationMode.HYBRID:
        // Auto-select based on size
        const items = this.getContextItems(sourceContextId);
        if (items.length < 10) {
          return { contextId: sourceContextId };
        }
        return {
          incremental: this.getIncrementalContext(sourceContextId, scope),
        };

      default:
        return { contextId: sourceContextId };
    }
  }

  /**
   * Get incremental context changes
   */
  private getIncrementalContext(
    contextId: string,
    scope: PropagationScope
  ): {
    messages: Message[];
    states: StateItem[];
    items: ContextItem[];
  } {
    const result: {
      messages: Message[];
      states: StateItem[];
      items: ContextItem[];
    } = {
      messages: [],
      states: [],
      items: [],
    };

    // Get messages
    if (scope.includeMessages) {
      let messages = this.getMessages(contextId);

      if (scope.messageTimeRange) {
        messages = messages.filter((m) => {
          const inRange =
            (!scope.messageTimeRange!.start ||
              m.timestamp >= scope.messageTimeRange!.start) &&
            (!scope.messageTimeRange!.end ||
              m.timestamp <= scope.messageTimeRange!.end);
          return inRange;
        });
      }

      if (scope.messageLimit) {
        messages = messages.slice(-scope.messageLimit);
      }

      result.messages = messages;
    }

    // Get states
    if (scope.includeStates) {
      const states = this.getStates(contextId);
      result.states = Array.from(states.entries()).map(
        ([key, value]) =>
          ({
            key,
            value,
            type: 'session',
            namespace: this.config.defaultNamespace,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }) as StateItem
      );
    }

    // Get items
    if (scope.includeToolCalls || scope.includeAttachments) {
      const types: ContextItemType[] = [];
      if (scope.includeToolCalls) {
        types.push(ContextItemType.TOOL_CALL);
      }
      if (scope.includeAttachments) {
        types.push(ContextItemType.ATTACHMENT);
      }

      result.items = this.getContextItems(contextId, { types });
    }

    return result;
  }

  // ==================== Statistics ====================

  /**
   * Get context statistics
   */
  getStats(contextId: string): {
    messageCount: number;
    itemCount: number;
    participantCount: number;
    tokenEstimate: number;
    lastActivityAt: number;
    createdAt: number;
  } | null {
    const context = this.contextManager.getStats(contextId);
    if (!context) {
      return null;
    }

    const items = this.getContextItems(contextId);
    const stack = this.getExecutionStack(contextId);

    return {
      messageCount: context.messageCount,
      itemCount: items.length,
      participantCount: context.participantCount,
      tokenEstimate: context.tokenEstimate,
      lastActivityAt: context.lastActivityAt,
      createdAt: context.createdAt,
      nestingDepth: stack?.stack.length ?? 0,
    };
  }

  /**
   * Get all context IDs
   */
  getAllContextIds(): string[] {
    return this.contextManager.getAllContextIds();
  }

  /**
   * Get active context count
   */
  getActiveContextCount(): number {
    return this.contextManager.getActiveCount();
  }

  // ==================== Cleanup ====================

  /**
   * Clean up expired contexts and items
   */
  cleanup(): { deletedContexts: number; archivedContexts: number; deletedItems: number } {
    const contextResult = this.contextManager.cleanup();

    let deletedItems = 0;

    // Clean up expired items
    for (const [contextId, store] of this.contextItems) {
      for (const [itemId, item] of store) {
        if (isContextItemExpired(item)) {
          store.delete(itemId);
          deletedItems++;
        }
      }
    }

    this.logger.info(
      `Cleanup completed: ${contextResult.deleted} deleted, ` +
        `${contextResult.archived} archived, ${deletedItems} items removed`
    );

    return {
      deletedContexts: contextResult.deleted,
      archivedContexts: contextResult.archived,
      deletedItems,
    };
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Dispose and cleanup resources
   */
  dispose(): void {
    this.stopCleanupTimer();
    this.contextItems.clear();
    this.executionStacks.clear();
    this.removeAllListeners();
    this.logger.info('ContextService disposed');
  }
}
