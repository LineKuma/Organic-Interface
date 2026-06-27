/**
 * ContextItem - Context item model for storing various context data
 *
 * Provides a unified interface for storing different types of context data
 * including messages, states, tool calls, results, and attachments.
 */

/**
 * Context item type enumeration
 */
export enum ContextItemType {
  /** Message item */
  MESSAGE = 'message',
  /** State item */
  STATE = 'state',
  /** Tool call item */
  TOOL_CALL = 'tool_call',
  /** Result item */
  RESULT = 'result',
  /** Attachment item */
  ATTACHMENT = 'attachment',
  /** Custom item */
  CUSTOM = 'custom',
}

/**
 * Context item priority
 */
export enum ContextItemPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Context item metadata
 */
export interface ContextItemMetadata {
  /** Created by */
  createdBy?: string;
  /** Source agent */
  sourceAgent?: string;
  /** Tags */
  tags?: string[];
  /** Priority */
  priority?: ContextItemPriority;
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Context item interface
 *
 * Represents a generic item that can be stored in a context.
 */
export interface ContextItem<T = unknown> {
  /** Unique identifier */
  id: string;
  /** Item type */
  type: ContextItemType;
  /** Item content */
  content: T;
  /** Associated context ID */
  contextId: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  accessedAt: number;
  /** Update timestamp */
  updatedAt: number;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Item metadata */
  metadata: ContextItemMetadata;
  /** Size in bytes (estimated) */
  size?: number;
}

/**
 * Context item creation options
 */
export interface ContextItemOptions<T = unknown> {
  /** Item type */
  type: ContextItemType;
  /** Item content */
  content: T;
  /** Context ID */
  contextId: string;
  /** Unique ID (auto-generated if not provided) */
  id?: string;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Metadata */
  metadata?: ContextItemMetadata;
  /** Size in bytes */
  size?: number;
}

/**
 * Context item filter options
 */
export interface ContextItemFilter {
  /** Filter by types */
  types?: ContextItemType[];
  /** Filter by context IDs */
  contextIds?: string[];
  /** Filter by tags */
  tags?: string[];
  /** Filter by priority */
  priority?: ContextItemPriority;
  /** Include expired items */
  includeExpired?: boolean;
  /** Time range filter */
  timeRange?: {
    start?: number;
    end?: number;
  };
}

/**
 * Context item update options
 */
export interface ContextItemUpdate<T = unknown> {
  /** Updated content */
  content?: T;
  /** Updated metadata */
  metadata?: Partial<ContextItemMetadata>;
  /** New expiration timestamp */
  expiresAt?: number;
  /** New priority */
  priority?: ContextItemPriority;
}

/**
 * Create a new context item
 */
export function createContextItem<T = unknown>(options: ContextItemOptions<T>): ContextItem<T> {
  const now = Date.now();
  return {
    id: options.id ?? `ctx_item_${now}_${Math.random().toString(36).substr(2, 9)}`,
    type: options.type,
    content: options.content,
    contextId: options.contextId,
    createdAt: now,
    accessedAt: now,
    updatedAt: now,
    expiresAt: options.expiresAt,
    metadata: {
      ...options.metadata,
    },
    size: options.size,
  };
}

/**
 * Create a message context item
 */
export function createMessageContextItem<T = unknown>(
  contextId: string,
  message: T,
  metadata?: ContextItemMetadata
): ContextItem<T> {
  return createContextItem({
    type: ContextItemType.MESSAGE,
    content: message,
    contextId,
    metadata,
  });
}

/**
 * Create a state context item
 */
export function createStateContextItem<T = unknown>(
  contextId: string,
  key: string,
  value: T,
  metadata?: ContextItemMetadata
): ContextItem<T> {
  return createContextItem({
    type: ContextItemType.STATE,
    content: value,
    contextId,
    metadata: {
      ...metadata,
      stateKey: key,
    },
  });
}

/**
 * Create a tool call context item
 */
export function createToolCallContextItem<T = unknown>(
  contextId: string,
  toolCall: T,
  metadata?: ContextItemMetadata
): ContextItem<T> {
  return createContextItem({
    type: ContextItemType.TOOL_CALL,
    content: toolCall,
    contextId,
    metadata,
  });
}

/**
 * Create a result context item
 */
export function createResultContextItem<T = unknown>(
  contextId: string,
  result: T,
  metadata?: ContextItemMetadata
): ContextItem<T> {
  return createContextItem({
    type: ContextItemType.RESULT,
    content: result,
    contextId,
    metadata,
  });
}

/**
 * Update a context item
 */
export function updateContextItem<T = unknown>(
  item: ContextItem<T>,
  updates: ContextItemUpdate<T>
): ContextItem<T> {
  return {
    ...item,
    content: updates.content ?? item.content,
    metadata: updates.metadata ? { ...item.metadata, ...updates.metadata } : item.metadata,
    accessedAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: updates.expiresAt ?? item.expiresAt,
  };
}

/**
 * Check if context item is expired
 */
export function isContextItemExpired(item: ContextItem): boolean {
  if (!item.expiresAt) {
    return false;
  }
  return Date.now() > item.expiresAt;
}

/**
 * Mark context item as accessed
 */
export function touchContextItem<T>(item: ContextItem<T>): ContextItem<T> {
  return {
    ...item,
    accessedAt: Date.now(),
  };
}

/**
 * Validate context item structure
 */
export function isValidContextItem(item: unknown): item is ContextItem {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const ctxItem = item as Record<string, unknown>;
  return (
    typeof ctxItem.id === 'string' &&
    Object.values(ContextItemType).includes(ctxItem.type as ContextItemType) &&
    'content' in ctxItem &&
    typeof ctxItem.contextId === 'string' &&
    typeof ctxItem.createdAt === 'number' &&
    typeof ctxItem.accessedAt === 'number' &&
    typeof ctxItem.updatedAt === 'number'
  );
}

/**
 * Calculate estimated size of context item
 */
export function calculateContextItemSize<T>(item: ContextItem<T>): number {
  if (item.size !== undefined) {
    return item.size;
  }

  // Estimate size based on content
  const contentSize =
    typeof item.content === 'string' ? item.content.length : JSON.stringify(item.content).length;

  const metadataSize = JSON.stringify(item.metadata).length;

  return contentSize + metadataSize + 200; // Base overhead
}

/**
 * Context item comparator for sorting
 */
export function compareContextItems(
  a: ContextItem,
  b: ContextItem,
  sortBy: 'created' | 'accessed' | 'updated' = 'accessed'
): number {
  const timeA =
    sortBy === 'created' ? a.createdAt : sortBy === 'accessed' ? a.accessedAt : a.updatedAt;
  const timeB =
    sortBy === 'created' ? b.createdAt : sortBy === 'accessed' ? b.accessedAt : b.updatedAt;

  return timeB - timeA; // Descending order (newest first)
}
