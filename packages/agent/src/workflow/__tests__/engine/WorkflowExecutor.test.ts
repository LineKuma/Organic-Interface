import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowExecutor, defaultNodeExecutor } from '../../engine/WorkflowExecutor.js';
import { TaskType, createTask, createTaskExecution } from '../../models/Task.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('WorkflowExecutor', () => {
  let executor: WorkflowExecutor;

  beforeEach(() => {
    const mockNodeExecutor = vi.fn(async () => ({ success: true, output: {}, duration: 100 }));
    executor = new WorkflowExecutor(mockNodeExecutor);
  });

  describe('constructor', () => {
    it('should create executor with default config', () => {
      expect(executor).toBeDefined();
    });

    it('should accept custom config', () => {
      const customExecutor = new WorkflowExecutor(
        vi.fn(async () => ({ success: true, output: {}, duration: 100 })),
        {
          maxConcurrency: 5,
          autoRetry: false,
        }
      );
      expect(customExecutor).toBeDefined();
    });
  });

  describe('executeTask', () => {
    it('should execute task successfully', async () => {
      const mockFn = vi.fn(async () => ({
        success: true,
        output: { result: 'success' },
        duration: 100,
      }));
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('TestTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const result = await executor.executeTask(task, execution, {}, {});
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ result: 'success' });
    });

    it('should handle task failure', async () => {
      const mockFn = vi.fn(async () => ({
        success: false,
        error: { code: 'ERR_001', message: 'Task failed' },
        duration: 100,
      }));
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('TestTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const result = await executor.executeTask(task, execution, {}, {});
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Task failed');
    });

    it('should handle executor error', async () => {
      const mockFn = vi.fn(async () => {
        throw new Error('Execution error');
      });
      executor = new WorkflowExecutor(mockFn);

      const task = createTask('TestTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      const result = await executor.executeTask(task, execution, {}, {});
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Execution error');
    });

    it('should emit task:start event', async () => {
      const mockFn = vi.fn(async () => ({ success: true, duration: 100 }));
      executor = new WorkflowExecutor(mockFn);

      const handler = vi.fn();
      executor.on('task:start', handler);

      const task = createTask('TestTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      await executor.executeTask(task, execution, {}, {});
      expect(handler).toHaveBeenCalled();
    });

    it('should emit task:complete event', async () => {
      const mockFn = vi.fn(async () => ({ success: true, duration: 100 }));
      executor = new WorkflowExecutor(mockFn);

      const handler = vi.fn();
      executor.on('task:complete', handler);

      const task = createTask('TestTask', TaskType.TASK, { handler: 'test' });
      const execution = createTaskExecution(task.id, 'exec-1');

      await executor.executeTask(task, execution, {}, {});
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('shouldRetry', () => {
    it('should return false if autoRetry is disabled', () => {
      const mockFn = vi.fn(async () => ({ success: true, output: {}, duration: 100 }));
      const noRetryExecutor = new WorkflowExecutor(mockFn, { autoRetry: false });
      const task = createTask('TestTask', TaskType.TASK);
      const execution = createTaskExecution(task.id, 'exec-1');

      expect(noRetryExecutor.shouldRetry(task, execution)).toBe(false);
    });
  });

  describe('cancelTask', () => {
    it('should return false for non-existent task', () => {
      const result = executor.cancelTask('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('pauseTask', () => {
    it('should return false for non-existent task', () => {
      const result = executor.pauseTask('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 initially', () => {
      expect(executor.getActiveCount()).toBe(0);
    });
  });

  describe('isTaskRunning', () => {
    it('should return false for non-running task', () => {
      expect(executor.isTaskRunning('non-existent')).toBe(false);
    });
  });

  describe('getActiveExecution', () => {
    it('should return null for non-existent task', () => {
      expect(executor.getActiveExecution('non-existent')).toBeNull();
    });
  });

  describe('clearActiveExecutions', () => {
    it('should clear all active executions', () => {
      executor.clearActiveExecutions();
      expect(executor.getActiveCount()).toBe(0);
    });
  });
});

describe('defaultNodeExecutor', () => {
  it('should throw error for task without handler', async () => {
    const task = createTask('TestTask', TaskType.TASK);

    await expect(defaultNodeExecutor(task, {}, {})).rejects.toThrow('No handler defined');
  });

  it('should throw error for unimplemented handler', async () => {
    const task = createTask('TestTask', TaskType.TASK, { handler: 'unknown-handler' });

    await expect(defaultNodeExecutor(task, {}, {})).rejects.toThrow('not implemented');
  });
});
