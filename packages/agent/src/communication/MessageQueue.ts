/**
 * MessageQueue - Queue management for agent messages
 *
 * Provides priority-based message queuing with TTL support,
 * dead letter handling, and filtering capabilities.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import type { MessagePriority, AgentMessage } from './AgentMessage.js';
import { isMessageExpired } from './AgentMessage.js';

/**
 * Queue configuration
 */
export interface MessageQueueConfig {
  /** Maximum queue size */
  maxSize?: number;
  /** Default message TTL in milliseconds */
  defaultTTL?: number;
  /** Enable dead letter queue */
  enableDeadLetter?: boolean;
  /** Dead letter queue maximum size */
  deadLetterMaxSize?: number;
  /** Enable message persistence */
  persistMessages?: boolean;
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: Required<MessageQueueConfig> = {
  maxSize: 1000,
  defaultTTL: 30000,
  enableDeadLetter: true,
  deadLetterMaxSize: 100,
  persistMessages: false,
};

/**
 * Queue entry with metadata
 */
interface QueueEntry {
  message: AgentMessage;
  enqueuedAt: number;
  attemptCount: number;
  priority: MessagePriority;
}

/**
 * Queue filter options
 */
export interface QueueFilter {
  source?: string;
  target?: string;
  action?: string;
  minPriority?: MessagePriority;
  maxPriority?: MessagePriority;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  size: number;
  enqueuedCount: number;
  dequeuedCount: number;
  expiredCount: number;
  deadLetterCount: number;
}

/**
 * MessageQueue - Priority queue for agent messages
 *
 * Features:
 * - Priority-based ordering
 * - TTL management
 * - Dead letter handling
 * - Message filtering
 * - Statistics tracking
 */
export class MessageQueue extends EventEmitter {
  private config: Required<MessageQueueConfig>;
  private logger: Logger;
  private queue: QueueEntry[] = [];
  private deadLetterQueue: AgentMessage[] = [];
  private stats: QueueStats = {
    size: 0,
    enqueuedCount: 0,
    dequeuedCount: 0,
    expiredCount: 0,
    deadLetterCount: 0,
  };
  private processingInterval?: ReturnType<typeof setInterval>;
  private isProcessing: boolean = false;

  /**
   * Create a new MessageQueue
   */
  constructor(config: MessageQueueConfig = {}) {
    super();
    this.config = {
      ...DEFAULT_QUEUE_CONFIG,
      ...config,
    };
    this.logger = createLogger({ prefix: 'message-queue' });
  }

  // ==================== Queue Operations ====================

  /**
   * Enqueue a message
   */
  enqueue(message: AgentMessage): boolean {
    // Check size limit
    if (this.queue.length >= this.config.maxSize) {
      this.logger.warn(`Queue is full (${this.config.maxSize}), message rejected`);
      this.emit('queue:full', { message });
      return false;
    }

    const entry: QueueEntry = {
      message,
      enqueuedAt: Date.now(),
      attemptCount: 0,
      priority: message.priority,
    };

    // Insert based on priority (lower number = higher priority)
    const insertIndex = this.queue.findIndex(e => e.priority > entry.priority);
    if (insertIndex === -1) {
      this.queue.push(entry);
    } else {
      this.queue.splice(insertIndex, 0, entry);
    }

    this.stats.size++;
    this.stats.enqueuedCount++;

    this.logger.debug(`Message enqueued: ${message.id} (priority: ${message.priority})`);
    this.emit('message:enqueued', { message, position: insertIndex });

    return true;
  }

  /**
   * Dequeue the next message
   */
  dequeue(): AgentMessage | null {
    // Find next non-expired message
    while (this.queue.length > 0) {
      const entry = this.queue.shift()!;
      this.stats.size--;

      // Check expiration
      if (isMessageExpired(entry.message)) {
        this.stats.expiredCount++;
        this.handleDeadLetter(entry.message, 'EXPIRED');
        continue;
      }

      this.stats.dequeuedCount++;
      this.emit('message:dequeued', { message: entry.message });
      return entry.message;
    }

    this.emit('queue:empty');
    return null;
  }

  /**
   * Peek at the next message without removing it
   */
  peek(): AgentMessage | null {
    // Find next non-expired message
    for (let i = 0; i < this.queue.length; i++) {
      const entry = this.queue[i];
      if (!isMessageExpired(entry.message)) {
        return entry.message;
      }
    }
    return null;
  }

  /**
   * Get message by ID
   */
  get(messageId: string): AgentMessage | null {
    const entry = this.queue.find(e => e.message.id === messageId);
    return entry?.message ?? null;
  }

  /**
   * Remove a specific message
   */
  remove(messageId: string): boolean {
    const index = this.queue.findIndex(e => e.message.id === messageId);
    if (index === -1) {
      return false;
    }

    this.queue.splice(index, 1);
    this.stats.size--;
    this.emit('message:removed', { messageId });
    return true;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.stats.size = 0;
    this.emit('queue:cleared');
    this.logger.info('Queue cleared');
  }

  // ==================== Filtering ====================

  /**
   * Get messages matching filter
   */
  filter(filter: QueueFilter): AgentMessage[] {
    return this.queue
      .filter(entry => {
        const msg = entry.message;

        if (filter.source && msg.source !== filter.source) {
          return false;
        }
        if (filter.target && msg.target !== filter.target) {
          return false;
        }
        if (filter.action && msg.action !== filter.action) {
          return false;
        }
        if (filter.minPriority !== undefined && msg.priority < filter.minPriority) {
          return false;
        }
        if (filter.maxPriority !== undefined && msg.priority > filter.maxPriority) {
          return false;
        }

        return true;
      })
      .map(entry => entry.message);
  }

  /**
   * Get all messages (without removing)
   */
  getAll(): AgentMessage[] {
    return this.queue.map(entry => entry.message);
  }

  // ==================== Dead Letter Queue ====================

  /**
   * Handle dead letter message
   */
  private handleDeadLetter(message: AgentMessage, reason: string): void {
    if (!this.config.enableDeadLetter) {
      this.logger.debug(`Dead letter disabled, message discarded: ${message.id}`);
      return;
    }

    // Add to dead letter queue
    const deadLetter = {
      ...message,
      metadata: {
        ...message.metadata,
        headers: {
          ...message.metadata?.headers,
          'x-dead-letter-reason': reason,
          'x-dead-letter-at': String(Date.now()),
        },
      },
    };

    if (this.deadLetterQueue.length >= this.config.deadLetterMaxSize) {
      this.deadLetterQueue.shift();
    }

    this.deadLetterQueue.push(deadLetter);
    this.stats.deadLetterCount++;

    this.logger.warn(`Message moved to dead letter: ${message.id} (${reason})`);
    this.emit('message:dead-letter', { message: deadLetter, reason });
  }

  /**
   * Get dead letter messages
   */
  getDeadLetters(): AgentMessage[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Retry a dead letter message
   */
  retryDeadLetter(messageId: string): boolean {
    const index = this.deadLetterQueue.findIndex(m => m.id === messageId);
    if (index === -1) {
      return false;
    }

    const message = this.deadLetterQueue.splice(index, 1)[0];
    return this.enqueue(message);
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetters(): void {
    this.deadLetterQueue = [];
    this.stats.deadLetterCount = 0;
    this.emit('dead-letters:cleared');
  }

  // ==================== Processing ====================

  /**
   * Start automatic processing
   */
  startProcessing(interval: number = 1000): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processInterval(interval);
    this.logger.info('Queue processing started');
  }

  /**
   * Stop automatic processing
   */
  stopProcessing(): void {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearTimeout(this.processingInterval);
      this.processingInterval = undefined;
    }
    this.logger.info('Queue processing stopped');
  }

  /**
   * Process expired messages
   */
  private processInterval(interval: number): void {
    if (!this.isProcessing) {
      return;
    }

    // Check for expired messages
    const now = Date.now();
    this.queue = this.queue.filter(entry => {
      if (entry.message.expiresAt && entry.message.expiresAt < now) {
        this.stats.expiredCount++;
        this.handleDeadLetter(entry.message, 'EXPIRED');
        this.stats.size--;
        return false;
      }
      return true;
    });

    this.processingInterval = setTimeout(() => this.processInterval(interval), interval);
  }

  // ==================== Statistics ====================

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Check if queue is full
   */
  isFull(): boolean {
    return this.queue.length >= this.config.maxSize;
  }

  // ==================== Cleanup ====================

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.stopProcessing();
    this.clear();
    this.clearDeadLetters();
    this.removeAllListeners();
    this.logger.info('MessageQueue disposed');
  }
}
