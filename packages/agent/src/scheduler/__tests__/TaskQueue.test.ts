import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskQueue,
  TaskPriority,
  TaskStatus,
  TaskOptions,
  TaskQueueConfig,
  DEFAULT_QUEUE_CONFIG,
  createTask,
} from '../TaskQueue.js';

describe('TaskQueue', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  describe('constructor', () => {
    it('should create queue with default config', () => {
      expect(queue).toBeDefined();
    });

    it('should accept custom config', () => {
      const customQueue = new TaskQueue({
        maxSize: 100,
        deduplicate: true,
        defaultTimeout: 60000,
        maxRetries: 5,
      });
      expect(customQueue).toBeDefined();
    });
  });

  describe('DEFAULT_QUEUE_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_QUEUE_CONFIG.maxSize).toBe(0);
      expect(DEFAULT_QUEUE_CONFIG.deduplicate).toBe(false);
      expect(DEFAULT_QUEUE_CONFIG.defaultTimeout).toBe(30000);
      expect(DEFAULT_QUEUE_CONFIG.maxRetries).toBe(3);
    });
  });

  describe('createTask', () => {
    it('should create task with required fields', () => {
      const task = createTask('task-1', { name: 'TestTask' });
      expect(task.id).toBe('task-1');
      expect(task.name).toBe('TestTask');
    });

    it('should set default priority to NORMAL', () => {
      const task = createTask('task-1', { name: 'TestTask' });
      expect(task.priority).toBe(TaskPriority.NORMAL);
    });

    it('should set initial status to PENDING', () => {
      const task = createTask('task-1', { name: 'TestTask' });
      expect(task.status).toBe(TaskStatus.PENDING);
    });

    it('should initialize empty dependencies', () => {
      const task = createTask('task-1', { name: 'TestTask' });
      expect(task.dependencies).toEqual([]);
    });

    it('should set timestamps', () => {
      const before = Date.now();
      const task = createTask('task-1', { name: 'TestTask' });
      const after = Date.now();
      expect(task.createdAt).toBeGreaterThanOrEqual(before);
      expect(task.createdAt).toBeLessThanOrEqual(after);
    });

    it('should accept options', () => {
      const task = createTask('task-1', {
        name: 'TestTask',
        priority: TaskPriority.HIGH,
        dependencies: ['dep-1'],
        payload: { key: 'value' },
        maxRetries: 5,
        metadata: { meta: 'data' },
      });

      expect(task.priority).toBe(TaskPriority.HIGH);
      expect(task.dependencies).toEqual(['dep-1']);
      expect(task.payload).toEqual({ key: 'value' });
      expect(task.maxRetries).toBe(5);
      expect(task.metadata).toEqual({ meta: 'data' });
    });
  });

  describe('enqueue', () => {
    it('should add task to queue', () => {
      const task = createTask('task-1', { name: 'TestTask' });
      const result = queue.enqueue(task);
      expect(result).toBe(true);
      expect(queue.size()).toBe(1);
    });

    it('should reject when queue is full', () => {
      const smallQueue = new TaskQueue({ maxSize: 1 });
      smallQueue.enqueue(createTask('task-1', { name: 'Task1' }));
      const result = smallQueue.enqueue(createTask('task-2', { name: 'Task2' }));
      expect(result).toBe(false);
    });

    it('should reject duplicates when deduplicate is enabled', () => {
      const dedupQueue = new TaskQueue({ deduplicate: true });
      dedupQueue.enqueue(createTask('task-1', { name: 'Task1' }));
      const result = dedupQueue.enqueue(createTask('task-1', { name: 'Task1' }));
      expect(result).toBe(false);
    });

    it('should sort by priority', () => {
      queue.enqueue(createTask('low', { name: 'Low', priority: TaskPriority.LOW }));
      queue.enqueue(createTask('high', { name: 'High', priority: TaskPriority.HIGH }));
      queue.enqueue(createTask('normal', { name: 'Normal', priority: TaskPriority.NORMAL }));

      const first = queue.peek();
      expect(first?.id).toBe('high');
    });
  });

  describe('enqueueMany', () => {
    it('should add multiple tasks', () => {
      const tasks = [
        createTask('task-1', { name: 'Task1' }),
        createTask('task-2', { name: 'Task2' }),
        createTask('task-3', { name: 'Task3' }),
      ];
      const result = queue.enqueueMany(tasks);
      expect(result).toBe(3);
      expect(queue.size()).toBe(3);
    });
  });

  describe('dequeue', () => {
    it('should return and remove next ready task', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      const task = queue.dequeue();
      expect(task).toBeDefined();
      expect(task?.id).toBe('task-1');
      expect(queue.size()).toBe(0);
    });

    it('should return undefined when queue is empty', () => {
      const task = queue.dequeue();
      expect(task).toBeUndefined();
    });

    it('should skip tasks with unmet dependencies', () => {
      queue.enqueue(createTask('dep', { name: 'Dependency' }));
      queue.enqueue(createTask('task-2', { name: 'Task2', dependencies: ['dep'] }));
      const task = queue.dequeue();
      expect(task?.id).toBe('dep');
    });

    it('should mark dequeued task as RUNNING', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      queue.dequeue();
      const task = queue.get('task-1');
      expect(task?.status).toBe(TaskStatus.RUNNING);
    });
  });

  describe('peek', () => {
    it('should return next task without removing', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      const task = queue.peek();
      expect(task?.id).toBe('task-1');
      expect(queue.size()).toBe(1);
    });

    it('should return undefined for empty queue', () => {
      const task = queue.peek();
      expect(task).toBeUndefined();
    });
  });

  describe('get', () => {
    it('should get task by ID', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      const task = queue.get('task-1');
      expect(task).toBeDefined();
      expect(task?.name).toBe('Task1');
    });

    it('should return undefined for non-existent task', () => {
      const task = queue.get('non-existent');
      expect(task).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing task', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      expect(queue.has('task-1')).toBe(true);
    });

    it('should return false for non-existent task', () => {
      expect(queue.has('non-existent')).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove task from queue', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      const result = queue.remove('task-1');
      expect(result).toBe(true);
      expect(queue.has('task-1')).toBe(false);
    });

    it('should return false for non-existent task', () => {
      const result = queue.remove('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all tasks', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      queue.enqueue(createTask('task-2', { name: 'Task2' }));
      queue.clear();
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('complete', () => {
    it('should mark task as completed', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      queue.dequeue();
      const result = queue.complete('task-1', { data: 'result' });
      expect(result).toBe(true);
      const task = queue.get('task-1');
      expect(task?.status).toBe(TaskStatus.COMPLETED);
      expect(task?.result).toEqual({ data: 'result' });
    });

    it('should return false for non-running task', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      const result = queue.complete('task-1');
      expect(result).toBe(false);
    });
  });

  describe('fail', () => {
    it('should mark task as failed when max retries exceeded', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1', maxRetries: 0 }));
      queue.dequeue();
      const result = queue.fail('task-1', 'Error message');
      expect(result).toBe(true);
      const task = queue.get('task-1');
      expect(task?.status).toBe(TaskStatus.FAILED);
      expect(task?.error).toBe('Error message');
    });

    it('should re-queue task for retry when retries available', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1', maxRetries: 2 }));
      queue.dequeue();
      queue.fail('task-1', 'Temporary error');
      const task = queue.get('task-1');
      expect(task?.status).toBe(TaskStatus.PENDING);
      expect(task?.retryCount).toBe(1);
    });
  });

  describe('cancel', () => {
    it('should cancel pending task', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      const result = queue.cancel('task-1');
      expect(result).toBe(true);
      const task = queue.get('task-1');
      expect(task?.status).toBe(TaskStatus.CANCELLED);
    });

    it('should not cancel running task', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      queue.dequeue();
      const result = queue.cancel('task-1');
      expect(result).toBe(false);
    });
  });

  describe('size', () => {
    it('should return pending task count', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      queue.enqueue(createTask('task-2', { name: 'Task2' }));
      expect(queue.size()).toBe(2);
    });

    it('should not count running tasks', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      queue.dequeue();
      expect(queue.size()).toBe(0);
    });
  });

  describe('totalSize', () => {
    it('should return total task count', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      queue.enqueue(createTask('task-2', { name: 'Task2' }));
      queue.dequeue();
      expect(queue.totalSize()).toBe(2);
    });
  });

  describe('runningCount', () => {
    it('should return running task count', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      queue.dequeue();
      queue.enqueue(createTask('task-2', { name: 'Task2' }));
      queue.dequeue();
      expect(queue.runningCount()).toBe(2);
    });
  });

  describe('getPendingTasks', () => {
    it('should return pending tasks', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      queue.enqueue(createTask('task-2', { name: 'Task2' }));
      const pending = queue.getPendingTasks();
      expect(pending).toHaveLength(2);
    });
  });

  describe('getRunningTasks', () => {
    it('should return running tasks', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      queue.dequeue();
      const running = queue.getRunningTasks();
      expect(running).toHaveLength(1);
    });
  });

  describe('getCompletedTasks', () => {
    it('should return completed tasks', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      queue.dequeue();
      queue.complete('task-1');
      const completed = queue.getCompletedTasks();
      expect(completed).toHaveLength(1);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty queue', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('should return false for non-empty queue', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      expect(queue.isEmpty()).toBe(false);
    });
  });

  describe('hasReadyTasks', () => {
    it('should return true when ready tasks exist', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1' }));
      expect(queue.hasReadyTasks()).toBe(true);
    });

    it('should return false when no ready tasks', () => {
      queue.enqueue(createTask('task-1', { name: 'Task1', dependencies: ['non-existent'] }));
      expect(queue.hasReadyTasks()).toBe(false);
    });
  });

  describe('TaskPriority enum', () => {
    it('should have correct priority values', () => {
      expect(TaskPriority.LOW).toBe(0);
      expect(TaskPriority.NORMAL).toBe(1);
      expect(TaskPriority.HIGH).toBe(2);
      expect(TaskPriority.CRITICAL).toBe(3);
    });
  });

  describe('TaskStatus enum', () => {
    it('should have correct status values', () => {
      expect(TaskStatus.PENDING).toBe('pending');
      expect(TaskStatus.RUNNING).toBe('running');
      expect(TaskStatus.COMPLETED).toBe('completed');
      expect(TaskStatus.FAILED).toBe('failed');
      expect(TaskStatus.CANCELLED).toBe('cancelled');
    });
  });
});
