import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageQueue, DEFAULT_QUEUE_CONFIG } from './MessageQueue.js';
import {
  MessageAction,
  MessagePriority,
  createExecuteMessage,
  createQueryMessage,
} from './AgentMessage.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('MessageQueue', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  describe('constructor', () => {
    it('should create queue with default config', () => {
      expect(queue).toBeDefined();
    });

    it('should accept custom config', () => {
      const customQueue = new MessageQueue({
        maxSize: 500,
        defaultTTL: 60000,
        enableDeadLetter: false,
      });
      expect(customQueue).toBeDefined();
    });
  });

  describe('enqueue', () => {
    it('should enqueue message successfully', () => {
      const message = createExecuteMessage('agent-1', 'agent-2', { task: 'test' });
      const result = queue.enqueue(message);
      expect(result).toBe(true);
      expect(queue.size()).toBe(1);
    });

    it('should reject message when queue is full', () => {
      const smallQueue = new MessageQueue({ maxSize: 1 });
      smallQueue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: 'test' }));
      const result = smallQueue.enqueue(
        createExecuteMessage('agent-1', 'agent-2', { task: 'test2' })
      );
      expect(result).toBe(false);
    });

    it('should order by priority (high priority first)', () => {
      const highPriority = createExecuteMessage('agent-1', 'agent-2', { task: 'high' });
      highPriority.priority = MessagePriority.HIGH;
      const normalPriority = createExecuteMessage('agent-1', 'agent-2', { task: 'normal' });
      normalPriority.priority = MessagePriority.NORMAL;

      queue.enqueue(normalPriority);
      queue.enqueue(highPriority);

      const peeked = queue.peek();
      expect(peeked?.payload).toEqual({ task: 'high' });
    });

    it('should emit message:enqueued event', () => {
      const handler = vi.fn();
      queue.on('message:enqueued', handler);

      const message = createExecuteMessage('agent-1', 'agent-2', { task: 'test' });
      queue.enqueue(message);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('dequeue', () => {
    it('should dequeue message in priority order', () => {
      const msg1 = createExecuteMessage('agent-1', 'agent-2', { task: '1' });
      msg1.priority = MessagePriority.LOW;
      const msg2 = createExecuteMessage('agent-1', 'agent-2', { task: '2' });
      msg2.priority = MessagePriority.HIGH;

      queue.enqueue(msg1);
      queue.enqueue(msg2);

      const first = queue.dequeue();
      expect(first?.payload).toEqual({ task: '2' });
    });

    it('should return null when queue is empty', () => {
      const result = queue.dequeue();
      expect(result).toBeNull();
    });

    it('should skip expired messages', () => {
      const expiredMsg = createExecuteMessage('agent-1', 'agent-2', { task: 'expired' });
      expiredMsg.expiresAt = Date.now() - 1000;

      const validMsg = createExecuteMessage('agent-1', 'agent-2', { task: 'valid' });

      queue.enqueue(expiredMsg);
      queue.enqueue(validMsg);

      const dequeued = queue.dequeue();
      expect(dequeued?.payload).toEqual({ task: 'valid' });
    });

    it('should emit message:dequeued event', () => {
      const handler = vi.fn();
      queue.on('message:dequeued', handler);

      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: 'test' }));
      queue.dequeue();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit queue:empty when last message dequeued', () => {
      const handler = vi.fn();
      queue.on('queue:empty', handler);

      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: 'test' }));
      queue.dequeue();
      queue.dequeue();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('peek', () => {
    it('should return next message without removing', () => {
      const message = createExecuteMessage('agent-1', 'agent-2', { task: 'test' });
      queue.enqueue(message);

      const peeked = queue.peek();
      expect(peeked?.payload).toEqual({ task: 'test' });
      expect(queue.size()).toBe(1);
    });

    it('should return null when queue is empty', () => {
      const result = queue.peek();
      expect(result).toBeNull();
    });

    it('should skip expired messages', () => {
      const expiredMsg = createExecuteMessage('agent-1', 'agent-2', { task: 'expired' });
      expiredMsg.expiresAt = Date.now() - 1000;
      const validMsg = createExecuteMessage('agent-1', 'agent-2', { task: 'valid' });

      queue.enqueue(expiredMsg);
      queue.enqueue(validMsg);

      const peeked = queue.peek();
      expect(peeked?.payload).toEqual({ task: 'valid' });
    });
  });

  describe('get', () => {
    it('should return message by ID', () => {
      const message = createExecuteMessage('agent-1', 'agent-2', { task: 'test' });
      queue.enqueue(message);

      const retrieved = queue.get(message.id);
      expect(retrieved?.payload).toEqual({ task: 'test' });
    });

    it('should return null for non-existent message', () => {
      const result = queue.get('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove message by ID', () => {
      const message = createExecuteMessage('agent-1', 'agent-2', { task: 'test' });
      queue.enqueue(message);

      const result = queue.remove(message.id);
      expect(result).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it('should return false for non-existent message', () => {
      const result = queue.remove('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all messages', () => {
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: '1' }));
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: '2' }));

      queue.clear();
      expect(queue.size()).toBe(0);
    });

    it('should emit queue:cleared event', () => {
      const handler = vi.fn();
      queue.on('queue:cleared', handler);

      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: 'test' }));
      queue.clear();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('filter', () => {
    it('should filter by source', () => {
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: '1' }));
      queue.enqueue(createExecuteMessage('agent-2', 'agent-2', { task: '2' }));

      const filtered = queue.filter({ source: 'agent-1' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].payload).toEqual({ task: '1' });
    });

    it('should filter by target', () => {
      queue.enqueue(createExecuteMessage('agent-1', 'target-1', { task: '1' }));
      queue.enqueue(createExecuteMessage('agent-2', 'target-2', { task: '2' }));

      const filtered = queue.filter({ target: 'target-1' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].payload).toEqual({ task: '1' });
    });

    it('should filter by action', () => {
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: '1' }));
      queue.enqueue(createQueryMessage('agent-1', 'agent-2', { query: '2' }));

      const filtered = queue.filter({ action: MessageAction.EXECUTE });
      expect(filtered).toHaveLength(1);
    });

    it('should filter by priority range', () => {
      const highMsg = createExecuteMessage('agent-1', 'agent-2', { task: 'high' });
      highMsg.priority = MessagePriority.HIGH;
      const lowMsg = createExecuteMessage('agent-1', 'agent-2', { task: 'low' });
      lowMsg.priority = MessagePriority.LOW;

      queue.enqueue(highMsg);
      queue.enqueue(lowMsg);

      const filtered = queue.filter({
        minPriority: MessagePriority.HIGH,
        maxPriority: MessagePriority.HIGH,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].payload).toEqual({ task: 'high' });
    });

    it('should return all messages when no filter provided', () => {
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: '1' }));
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: '2' }));

      const filtered = queue.filter({});
      expect(filtered).toHaveLength(2);
    });
  });

  describe('getAll', () => {
    it('should return all messages', () => {
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: '1' }));
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: '2' }));

      const all = queue.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('dead letter queue', () => {
    it('should move expired messages to dead letter', () => {
      const expiredMsg = createExecuteMessage('agent-1', 'agent-2', { task: 'expired' });
      expiredMsg.expiresAt = Date.now() - 1000;

      queue.enqueue(expiredMsg);
      queue.dequeue();

      const deadLetters = queue.getDeadLetters();
      expect(deadLetters).toHaveLength(1);
    });

    it('should retry dead letter message', () => {
      const expiredMsg = createExecuteMessage('agent-1', 'agent-2', { task: 'test' });
      expiredMsg.expiresAt = Date.now() - 1000;

      queue.enqueue(expiredMsg);
      queue.dequeue();

      const deadLetters = queue.getDeadLetters();
      expect(deadLetters).toHaveLength(1);

      const retryResult = queue.retryDeadLetter(deadLetters[0].id);
      expect(retryResult).toBe(true);
    });

    it('should return false when retrying non-existent dead letter', () => {
      const result = queue.retryDeadLetter('non-existent');
      expect(result).toBe(false);
    });

    it('should clear dead letters', () => {
      const expiredMsg = createExecuteMessage('agent-1', 'agent-2', { task: 'expired' });
      expiredMsg.expiresAt = Date.now() - 1000;

      queue.enqueue(expiredMsg);
      queue.dequeue();

      queue.clearDeadLetters();
      expect(queue.getDeadLetters()).toHaveLength(0);
    });

    it('should include reason in dead letter headers', () => {
      const expiredMsg = createExecuteMessage('agent-1', 'agent-2', { task: 'expired' });
      expiredMsg.expiresAt = Date.now() - 1000;

      queue.enqueue(expiredMsg);
      queue.dequeue();

      const deadLetters = queue.getDeadLetters();
      expect(deadLetters[0].metadata?.headers?.['x-dead-letter-reason']).toBe('EXPIRED');
    });
  });

  describe('startProcessing / stopProcessing', () => {
    it('should start and stop queue processing', () => {
      queue.startProcessing(100);
      expect(queue.size()).toBeDefined();

      queue.stopProcessing();
      expect(queue.size()).toBeDefined();
    });

    it('should not start processing twice', () => {
      queue.startProcessing(100);
      queue.startProcessing(100);
      queue.stopProcessing();
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', () => {
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: '1' }));
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: '2' }));
      queue.dequeue();

      const stats = queue.getStats();
      expect(stats.size).toBe(1);
      expect(stats.enqueuedCount).toBe(2);
      expect(stats.dequeuedCount).toBe(1);
    });
  });

  describe('isEmpty', () => {
    it('should return true when empty', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('should return false when not empty', () => {
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: 'test' }));
      expect(queue.isEmpty()).toBe(false);
    });
  });

  describe('isFull', () => {
    it('should return false for empty queue', () => {
      expect(queue.isFull()).toBe(false);
    });

    it('should return true when at max size', () => {
      const smallQueue = new MessageQueue({ maxSize: 1 });
      smallQueue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: 'test' }));
      expect(smallQueue.isFull()).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should dispose queue and clear all', () => {
      queue.enqueue(createExecuteMessage('agent-1', 'agent-2', { task: 'test' }));
      queue.dispose();

      expect(queue.size()).toBe(0);
    });
  });
});

describe('DEFAULT_QUEUE_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_QUEUE_CONFIG.maxSize).toBe(1000);
    expect(DEFAULT_QUEUE_CONFIG.defaultTTL).toBe(30000);
    expect(DEFAULT_QUEUE_CONFIG.enableDeadLetter).toBe(true);
    expect(DEFAULT_QUEUE_CONFIG.deadLetterMaxSize).toBe(100);
    expect(DEFAULT_QUEUE_CONFIG.persistMessages).toBe(false);
  });
});
