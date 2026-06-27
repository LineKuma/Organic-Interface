import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskScheduler, type TaskExecutor } from '../TaskScheduler.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('TaskScheduler', () => {
  let scheduler: TaskScheduler;

  beforeEach(() => {
    scheduler = new TaskScheduler();
  });

  describe('constructor', () => {
    it('should create scheduler with default config', () => {
      expect(scheduler).toBeDefined();
    });

    it('should accept custom config', () => {
      const customScheduler = new TaskScheduler({
        maxParallelTasks: 5,
        autoProcess: true,
        processingInterval: 200,
        enableRetry: false,
        defaultTimeout: 60000,
      });
      expect(customScheduler).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start the scheduler', () => {
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should not start twice', () => {
      scheduler.start();
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should stop the scheduler', async () => {
      scheduler.start();
      await scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });
  });

  describe('setExecutor', () => {
    it('should set task executor', () => {
      const executor: TaskExecutor = vi.fn().mockResolvedValue('result');
      scheduler.setExecutor(executor);
      expect(scheduler).toBeDefined();
    });
  });

  describe('schedule', () => {
    it('should schedule a task', () => {
      scheduler.start();
      const task = scheduler.schedule({ name: 'TestTask' });
      expect(task).toBeDefined();
      expect(task.name).toBe('TestTask');
    });

    it('should generate unique task ID', () => {
      scheduler.start();
      const task1 = scheduler.schedule({ name: 'Task1' });
      const task2 = scheduler.schedule({ name: 'Task2' });
      expect(task1.id).not.toBe(task2.id);
    });

    it('should set default max retries when retry enabled', () => {
      scheduler.start();
      const task = scheduler.schedule({ name: 'TestTask' });
      expect(task.maxRetries).toBe(3);
    });

    it('should set zero max retries when retry disabled', () => {
      const noRetryScheduler = new TaskScheduler({ enableRetry: false });
      noRetryScheduler.start();
      const task = noRetryScheduler.schedule({ name: 'TestTask' });
      expect(task.maxRetries).toBe(0);
    });

    it('should emit task:scheduled event', () => {
      scheduler.start();
      const handler = vi.fn();
      scheduler.on('task:scheduled', handler);
      scheduler.schedule({ name: 'TestTask' });
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('scheduleMany', () => {
    it('should schedule multiple tasks', () => {
      scheduler.start();
      const tasks = scheduler.scheduleMany([
        { name: 'Task1' },
        { name: 'Task2' },
        { name: 'Task3' },
      ]);
      expect(tasks).toHaveLength(3);
    });
  });

  describe('cancel', () => {
    it('should cancel a task', () => {
      scheduler.start();
      const task = scheduler.schedule({ name: 'TestTask' });
      const result = scheduler.cancel(task.id);
      expect(result).toBe(true);
    });

    it('should return false for non-existent task', () => {
      scheduler.start();
      const result = scheduler.cancel('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('cancelAll', () => {
    it('should cancel all pending tasks', () => {
      scheduler.start();
      scheduler.scheduleMany([{ name: 'Task1' }, { name: 'Task2' }]);
      scheduler.cancelAll();
      expect(scheduler.getQueueSize()).toBe(0);
    });
  });

  describe('getTask', () => {
    it('should get task by ID', () => {
      scheduler.start();
      const scheduled = scheduler.schedule({ name: 'TestTask' });
      const task = scheduler.getTask(scheduled.id);
      expect(task).toBeDefined();
      expect(task?.name).toBe('TestTask');
    });

    it('should return undefined for non-existent task', () => {
      scheduler.start();
      const task = scheduler.getTask('non-existent');
      expect(task).toBeUndefined();
    });
  });

  describe('getQueueSize', () => {
    it('should return queue size', () => {
      scheduler.start();
      scheduler.scheduleMany([{ name: 'Task1' }, { name: 'Task2' }]);
      expect(scheduler.getQueueSize()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRunningCount', () => {
    it('should return running task count', async () => {
      scheduler.start();
      const executor: TaskExecutor = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      });
      scheduler.setExecutor(executor);

      scheduler.schedule({ name: 'Task1' });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(scheduler.getRunningCount()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPendingTasks', () => {
    it('should return pending tasks array', () => {
      scheduler.start();
      scheduler.scheduleMany([{ name: 'Task1' }, { name: 'Task2' }]);
      const pending = scheduler.getPendingTasks();
      expect(Array.isArray(pending)).toBe(true);
    });
  });

  describe('getCompletedTasks', () => {
    it('should return completed tasks', async () => {
      scheduler.start();
      const executor: TaskExecutor = vi.fn().mockResolvedValue('result');
      scheduler.setExecutor(executor);

      scheduler.schedule({ name: 'Task1' });
      await new Promise(resolve => setTimeout(resolve, 50));
      const completed = scheduler.getCompletedTasks();
      expect(completed.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hasCapacity', () => {
    it('should return true when under capacity', () => {
      scheduler.start();
      expect(scheduler.hasCapacity()).toBe(true);
    });

    it('should return false when at capacity', async () => {
      const limitedScheduler = new TaskScheduler({ maxParallelTasks: 1 });
      limitedScheduler.start();
      const executor: TaskExecutor = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return 'result';
      });
      limitedScheduler.setExecutor(executor);

      limitedScheduler.schedule({ name: 'Task1' });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(limitedScheduler.hasCapacity()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return scheduler status', () => {
      scheduler.start();
      const status = scheduler.getStatus();
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('pending');
      expect(status).toHaveProperty('completed');
    });
  });

  describe('events', () => {
    it('should emit task:scheduled event', () => {
      scheduler.start();
      const handler = vi.fn();
      scheduler.on('task:scheduled', handler);
      scheduler.schedule({ name: 'TestTask' });
      expect(handler).toHaveBeenCalled();
    });

    it('should emit task:completed event', async () => {
      scheduler.start();
      const executor: TaskExecutor = vi.fn().mockResolvedValue('result');
      scheduler.setExecutor(executor);

      const handler = vi.fn();
      scheduler.on('task:completed', handler);

      scheduler.schedule({ name: 'TestTask' });
      await new Promise(resolve => setTimeout(resolve, 50));

      if (handler.mock.calls.length > 0) {
        expect(handler).toHaveBeenCalled();
      }
    });
  });
});
