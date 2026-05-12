import { describe, it, expect } from 'vitest';
import type {
  ConditionExpression,
  LoopConfig,
  ParallelConfig} from '../../models/Task.js';
import {
  TaskStatus,
  TaskType,
  RetryPolicy,
  DEFAULT_RETRY_POLICY,
  TaskTimeout,
  TaskInput,
  TaskOutput,
  TaskConfig,
  TaskDependency,
  TaskMetadata,
  Task,
  TaskExecution,
  createTask,
  createTaskExecution,
  updateTaskExecution,
  isTaskExecutionFinal,
  canTaskRetry,
  calculateRetryInterval,
  isValidTask,
  createSimpleTask,
  createConditionTask,
  createLoopTask,
  createParallelTask,
} from '../../models/Task.js';

describe('Task', () => {
  describe('TaskStatus enum', () => {
    it('should have correct status values', () => {
      expect(TaskStatus.PENDING).toBe('pending');
      expect(TaskStatus.WAITING).toBe('waiting');
      expect(TaskStatus.RUNNING).toBe('running');
      expect(TaskStatus.COMPLETED).toBe('completed');
      expect(TaskStatus.FAILED).toBe('failed');
      expect(TaskStatus.SKIPPED).toBe('skipped');
      expect(TaskStatus.CANCELLED).toBe('cancelled');
      expect(TaskStatus.TIMEOUT).toBe('timeout');
      expect(TaskStatus.PAUSED).toBe('paused');
      expect(TaskStatus.RETRYING).toBe('retrying');
    });
  });

  describe('TaskType enum', () => {
    it('should have correct type values', () => {
      expect(TaskType.TASK).toBe('task');
      expect(TaskType.CONDITION).toBe('condition');
      expect(TaskType.PARALLEL).toBe('parallel');
      expect(TaskType.LOOP).toBe('loop');
      expect(TaskType.SUBWORKFLOW).toBe('subworkflow');
      expect(TaskType.START).toBe('start');
      expect(TaskType.END).toBe('end');
      expect(TaskType.DELAY).toBe('delay');
      expect(TaskType.MANUAL).toBe('manual');
    });
  });

  describe('DEFAULT_RETRY_POLICY', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_RETRY_POLICY.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_POLICY.retryInterval).toBe(1000);
      expect(DEFAULT_RETRY_POLICY.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_POLICY.maxRetryInterval).toBe(60000);
      expect(DEFAULT_RETRY_POLICY.retryableErrors).toEqual([]);
      expect(DEFAULT_RETRY_POLICY.nonRetryableErrors).toEqual([]);
    });
  });

  describe('createTask', () => {
    it('should create task with required fields', () => {
      const task = createTask('TestTask', TaskType.TASK);
      expect(task.name).toBe('TestTask');
      expect(task.type).toBe(TaskType.TASK);
    });

    it('should set default ID', () => {
      const task = createTask('TestTask', TaskType.TASK);
      expect(task.id).toMatch(/^task_/);
    });

    it('should accept custom ID', () => {
      const task = createTask('TestTask', TaskType.TASK, {}, { id: 'custom-id' });
      expect(task.id).toBe('custom-id');
    });

    it('should set empty dependencies by default', () => {
      const task = createTask('TestTask', TaskType.TASK);
      expect(task.dependencies).toEqual([]);
    });

    it('should accept config', () => {
      const task = createTask('TestTask', TaskType.TASK, { handler: 'test-handler' });
      expect(task.config.handler).toBe('test-handler');
    });
  });

  describe('createTaskExecution', () => {
    it('should create task execution with required fields', () => {
      const execution = createTaskExecution('task-1', 'exec-1');
      expect(execution.taskId).toBe('task-1');
      expect(execution.executionId).toBe('exec-1');
    });

    it('should set initial status to PENDING', () => {
      const execution = createTaskExecution('task-1', 'exec-1');
      expect(execution.status).toBe(TaskStatus.PENDING);
    });

    it('should initialize retry count to 0', () => {
      const execution = createTaskExecution('task-1', 'exec-1');
      expect(execution.retryCount).toBe(0);
    });

    it('should set timestamps', () => {
      const before = Date.now();
      const execution = createTaskExecution('task-1', 'exec-1');
      const after = Date.now();
      expect(execution.createdAt).toBeGreaterThanOrEqual(before);
      expect(execution.createdAt).toBeLessThanOrEqual(after);
      expect(execution.updatedAt).toBeGreaterThanOrEqual(before);
      expect(execution.updatedAt).toBeLessThanOrEqual(after);
    });

    it('should accept input', () => {
      const execution = createTaskExecution('task-1', 'exec-1', { key: 'value' });
      expect(execution.input).toEqual({ key: 'value' });
    });
  });

  describe('updateTaskExecution', () => {
    it('should update execution fields', () => {
      const execution = createTaskExecution('task-1', 'exec-1');
      const updated = updateTaskExecution(execution, {
        status: TaskStatus.COMPLETED,
        output: { result: 'success' },
      });

      expect(updated.status).toBe(TaskStatus.COMPLETED);
      expect(updated.output).toEqual({ result: 'success' });
    });

    it('should update updatedAt timestamp', () => {
      const execution = createTaskExecution('task-1', 'exec-1');
      const originalUpdatedAt = execution.updatedAt;

      const updated = updateTaskExecution(execution, { status: TaskStatus.RUNNING });
      expect(updated.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe('isTaskExecutionFinal', () => {
    it('should return true for completed status', () => {
      expect(isTaskExecutionFinal(TaskStatus.COMPLETED)).toBe(true);
    });

    it('should return true for failed status', () => {
      expect(isTaskExecutionFinal(TaskStatus.FAILED)).toBe(true);
    });

    it('should return true for skipped status', () => {
      expect(isTaskExecutionFinal(TaskStatus.SKIPPED)).toBe(true);
    });

    it('should return true for cancelled status', () => {
      expect(isTaskExecutionFinal(TaskStatus.CANCELLED)).toBe(true);
    });

    it('should return true for timeout status', () => {
      expect(isTaskExecutionFinal(TaskStatus.TIMEOUT)).toBe(true);
    });

    it('should return false for pending status', () => {
      expect(isTaskExecutionFinal(TaskStatus.PENDING)).toBe(false);
    });

    it('should return false for running status', () => {
      expect(isTaskExecutionFinal(TaskStatus.RUNNING)).toBe(false);
    });
  });

  describe('canTaskRetry', () => {
    it('should return false if execution is already final', () => {
      const execution = createTaskExecution('task-1', 'exec-1');
      execution.status = TaskStatus.COMPLETED;
      const task = createTask('TestTask', TaskType.TASK);

      expect(canTaskRetry(execution, task)).toBe(false);
    });

    it('should return false if retry count exceeded', () => {
      const execution = createTaskExecution('task-1', 'exec-1');
      execution.retryCount = 3;
      const task = createTask('TestTask', TaskType.TASK, {}, { retryPolicy: { maxRetries: 3, retryInterval: 1000, backoffMultiplier: 2, maxRetryInterval: 60000, retryableErrors: [], nonRetryableErrors: [] } });

      expect(canTaskRetry(execution, task)).toBe(false);
    });

    it('should return true if retries available', () => {
      const execution = createTaskExecution('task-1', 'exec-1');
      execution.retryCount = 1;
      const task = createTask('TestTask', TaskType.TASK, {}, { retryPolicy: { maxRetries: 3, retryInterval: 1000, backoffMultiplier: 2, maxRetryInterval: 60000, retryableErrors: [], nonRetryableErrors: [] } });

      expect(canTaskRetry(execution, task)).toBe(true);
    });
  });

  describe('calculateRetryInterval', () => {
    it('should calculate exponential backoff', () => {
      const execution = createTaskExecution('task-1', 'exec-1');
      execution.retryCount = 2;
      const task = createTask('TestTask', TaskType.TASK, {}, {
        retryPolicy: { retryInterval: 1000, backoffMultiplier: 2, maxRetries: 3, maxRetryInterval: 60000, retryableErrors: [], nonRetryableErrors: [] },
      });

      const interval = calculateRetryInterval(execution, task);
      expect(interval).toBe(4000); // 1000 * 2^2
    });

    it('should respect max retry interval', () => {
      const execution = createTaskExecution('task-1', 'exec-1');
      execution.retryCount = 10;
      const task = createTask('TestTask', TaskType.TASK, {}, {
        retryPolicy: { retryInterval: 1000, maxRetryInterval: 30000, maxRetries: 3, backoffMultiplier: 2, retryableErrors: [], nonRetryableErrors: [] },
      });

      const interval = calculateRetryInterval(execution, task);
      expect(interval).toBeGreaterThan(0);
    });
  });

  describe('isValidTask', () => {
    it('should return true for valid task', () => {
      const task = createTask('TestTask', TaskType.TASK);
      expect(isValidTask(task)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidTask(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidTask('string')).toBe(false);
    });

    it('should return false for task missing id', () => {
      const task = { name: 'Test', type: TaskType.TASK, config: {}, dependencies: [] };
      expect(isValidTask(task)).toBe(false);
    });
  });

  describe('createSimpleTask', () => {
    it('should create simple task with handler', () => {
      const task = createSimpleTask('TestTask', 'handler-name');
      expect(task.name).toBe('TestTask');
      expect(task.type).toBe(TaskType.TASK);
      expect(task.config.handler).toBe('handler-name');
    });

    it('should accept params', () => {
      const task = createSimpleTask('TestTask', 'handler', { key: 'value' });
      expect(task.config.params).toEqual({ key: 'value' });
    });
  });

  describe('createConditionTask', () => {
    it('should create condition task', () => {
      const condition: ConditionExpression = { type: 'expression', content: 'x > 0' };
      const task = createConditionTask('CheckTask', condition, 'true-id', 'false-id');

      expect(task.type).toBe(TaskType.CONDITION);
      expect(task.config.params?.trueTaskId).toBe('true-id');
      expect(task.config.params?.falseTaskId).toBe('false-id');
    });
  });

  describe('createLoopTask', () => {
    it('should create loop task', () => {
      const loopConfig: LoopConfig = { type: 'count', maxIterations: 5 };
      const task = createLoopTask('LoopTask', loopConfig, 'body-id');

      expect(task.type).toBe(TaskType.LOOP);
      expect(task.config.params?.bodyTaskId).toBe('body-id');
    });
  });

  describe('createParallelTask', () => {
    it('should create parallel task', () => {
      const parallelConfig: ParallelConfig = { mode: 'fanout' };
      const task = createParallelTask('ParallelTask', parallelConfig, ['branch-1', 'branch-2']);

      expect(task.type).toBe(TaskType.PARALLEL);
      expect(task.config.params?.branchTaskIds).toEqual(['branch-1', 'branch-2']);
    });
  });
});
