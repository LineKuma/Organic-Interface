/**
 * WorkflowExecutor - Executes workflow tasks
 *
 * Handles task execution, retry logic, timeout management,
 * and parallel execution coordination.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import type { Workflow } from '../models/Workflow.js';
import {
  type Task,
  type TaskExecution,
  type TaskConfig,
  TaskStatus,
  TaskType,
  createTaskExecution,
  updateTaskExecution,
  isTaskExecutionFinal,
  canTaskRetry,
  calculateRetryInterval,
  DEFAULT_RETRY_POLICY,
} from '../models/Task.js';
import {
  getOutgoingEdges,
  getEntryNode,
  EdgeConditionType,
} from '../models/Workflow.js';

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  /** Success flag */
  success: boolean;
  /** Output data */
  output?: unknown;
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Execution duration */
  duration: number;
}

/**
 * Node executor function type
 */
export type NodeExecutor = (
  task: Task,
  input: Record<string, unknown>,
  context: Record<string, unknown>
) => Promise<TaskExecutionResult>;

/**
 * Workflow executor configuration
 */
export interface WorkflowExecutorConfig {
  /** Maximum concurrent task executions */
  maxConcurrency?: number;
  /** Default timeout for task execution */
  defaultTimeout?: number;
  /** Enable automatic retry */
  autoRetry?: boolean;
  /** Enable execution tracking */
  enableTracking?: boolean;
}

/**
 * Default workflow executor configuration
 */
export const DEFAULT_WORKFLOW_EXECUTOR_CONFIG: Required<WorkflowExecutorConfig> = {
  maxConcurrency: 10,
  defaultTimeout: 3600000, // 1 hour
  autoRetry: true,
  enableTracking: true,
};

/**
 * Active task execution tracking
 */
interface ActiveExecution {
  execution: TaskExecution;
  task: Task;
  startTime: number;
  timeoutId?: ReturnType<typeof setTimeout>;
  resolve?: (result: TaskExecutionResult) => void;
  reject?: (error: Error) => void;
}

/**
 * WorkflowExecutor
 *
 * Executes individual tasks within a workflow.
 */
export class WorkflowExecutor extends EventEmitter {
  private config: Required<WorkflowExecutorConfig>;
  private executor: NodeExecutor;
  private activeExecutions: Map<string, ActiveExecution> = new Map();
  private logger: Logger;

  /**
   * Create a new WorkflowExecutor
   */
  constructor(
    executor: NodeExecutor,
    config: WorkflowExecutorConfig = {}
  ) {
    super();
    this.config = {
      ...DEFAULT_WORKFLOW_EXECUTOR_CONFIG,
      ...config,
    };
    this.executor = executor;
    this.logger = createLogger({ prefix: 'workflow-executor' });
  }

  // ==================== Task Execution ====================

  /**
   * Execute a single task
   */
  async executeTask(
    task: Task,
    execution: TaskExecution,
    input: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<TaskExecutionResult> {
    // Check if already running
    if (this.activeExecutions.has(task.id)) {
      throw new Error(`Task ${task.id} is already executing`);
    }

    // Update execution status
    execution = updateTaskExecution(execution, {
      status: TaskStatus.RUNNING,
      startedAt: Date.now(),
    });

    this.emit('task:start', { task, execution });

    // Set up timeout
    const timeout = this.getTaskTimeout(task);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        this.handleTimeout(task.id, execution);
      }, timeout);
    }

    // Track active execution
    const activeExecution: ActiveExecution = {
      execution,
      task,
      startTime: Date.now(),
      timeoutId,
    };

    this.activeExecutions.set(task.id, activeExecution);

    try {
      // Execute the task
      const result = await this.executor(task, input, context);

      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Process result
      const finalExecution = this.processTaskResult(task, execution, result);

      return {
        success: finalExecution.status === TaskStatus.COMPLETED,
        output: finalExecution.output,
        error: finalExecution.error,
        duration: finalExecution.duration ?? 0,
      };
    } catch (error) {
      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Handle execution error
      const errorResult = this.handleExecutionError(
        task,
        execution,
        error as Error
      );

      return errorResult;
    } finally {
      // Clean up active execution
      this.activeExecutions.delete(task.id);
    }
  }

  /**
   * Get task timeout value
   */
  private getTaskTimeout(task: Task): number {
    if (task.timeout) {
      return task.timeout.duration;
    }
    return this.config.defaultTimeout;
  }

  /**
   * Handle task timeout
   */
  private handleTimeout(taskId: string, execution: TaskExecution): void {
    const active = this.activeExecutions.get(taskId);
    if (!active) {
      return;
    }

    this.logger.warn(`Task ${taskId} timed out`);

    execution = updateTaskExecution(execution, {
      status: TaskStatus.TIMEOUT,
      finishedAt: Date.now(),
      error: {
        code: 'WF_002',
        message: `Task execution timed out after ${this.getTaskTimeout(active.task)}ms`,
      },
    });

    this.emit('task:timeout', { task: active.task, execution });

    // Resolve with timeout result
    if (active.resolve) {
      active.resolve({
        success: false,
        error: execution.error,
        duration: Date.now() - active.startTime,
      });
    }

    this.activeExecutions.delete(taskId);
  }

  /**
   * Process task execution result
   */
  private processTaskResult(
    task: Task,
    execution: TaskExecution,
    result: TaskExecutionResult
  ): TaskExecution {
    let status: TaskStatus;
    let error: TaskExecution['error'];

    if (result.success) {
      status = TaskStatus.COMPLETED;
    } else {
      status = TaskStatus.FAILED;
      error = result.error
        ? {
            code: result.error.code || 'WF_003',
            message: result.error.message,
            details: result.error.details,
          }
        : {
            code: 'WF_003',
            message: 'Task execution failed',
          };
    }

    const finishedExecution = updateTaskExecution(execution, {
      status,
      output: result.output,
      error,
      finishedAt: Date.now(),
      duration: Date.now() - (execution.startedAt ?? execution.createdAt),
    });

    this.emit('task:complete', { task, execution: finishedExecution, result });

    return finishedExecution;
  }

  /**
   * Handle execution error
   */
  private handleExecutionError(
    task: Task,
    execution: TaskExecution,
    error: Error
  ): TaskExecutionResult {
    const result: TaskExecutionResult = {
      success: false,
      error: {
        code: 'WF_003',
        message: error.message,
        details: error.stack,
      },
      duration: Date.now() - (execution.startedAt ?? execution.createdAt),
    };

    const finishedExecution = updateTaskExecution(execution, {
      status: TaskStatus.FAILED,
      error: result.error,
      finishedAt: Date.now(),
      duration: result.duration,
    });

    this.emit('task:error', { task, execution: finishedExecution, error });

    return result;
  }

  // ==================== Retry Logic ====================

  /**
   * Check if task should retry
   */
  shouldRetry(task: Task, execution: TaskExecution): boolean {
    if (!this.config.autoRetry) {
      return false;
    }

    return canTaskRetry(execution, task);
  }

  /**
   * Schedule retry for failed task
   */
  scheduleRetry(
    task: Task,
    execution: TaskExecution,
    input: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<TaskExecutionResult> {
    return new Promise((resolve, reject) => {
      const interval = calculateRetryInterval(execution, task);

      this.logger.info(
        `Scheduling retry for task ${task.id} in ${interval}ms (attempt ${execution.retryCount + 1})`
      );

      // Create new execution for retry
      const retryExecution = updateTaskExecution(execution, {
        status: TaskStatus.RETRYING,
        retryCount: execution.retryCount + 1,
      });

      setTimeout(async () => {
        try {
          const result = await this.executeTask(
            task,
            retryExecution,
            input,
            context
          );
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, interval);
    });
  }

  // ==================== Execution Control ====================

  /**
   * Cancel a running task
   */
  cancelTask(taskId: string): boolean {
    const active = this.activeExecutions.get(taskId);
    if (!active) {
      return false;
    }

    // Clear timeout
    if (active.timeoutId) {
      clearTimeout(active.timeoutId);
    }

    // Update execution status
    updateTaskExecution(active.execution, {
      status: TaskStatus.CANCELLED,
      finishedAt: Date.now(),
    });

    this.emit('task:cancelled', { task: active.task, execution: active.execution });

    // Reject pending promise
    if (active.reject) {
      active.reject(new Error('Task execution was cancelled'));
    }

    this.activeExecutions.delete(taskId);

    return true;
  }

  /**
   * Pause a running task
   */
  pauseTask(taskId: string): boolean {
    const active = this.activeExecutions.get(taskId);
    if (!active) {
      return false;
    }

    // For now, cancel the task
    // A more sophisticated implementation would suspend the task
    return this.cancelTask(taskId);
  }

  /**
   * Get active execution count
   */
  getActiveCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Check if task is running
   */
  isTaskRunning(taskId: string): boolean {
    return this.activeExecutions.has(taskId);
  }

  /**
   * Get active execution for task
   */
  getActiveExecution(taskId: string): TaskExecution | null {
    return this.activeExecutions.get(taskId)?.execution ?? null;
  }

  /**
   * Clear all active executions
   */
  clearActiveExecutions(): void {
    for (const [taskId] of this.activeExecutions) {
      this.cancelTask(taskId);
    }
  }
}

/**
 * Default node executor that throws an error
 * Users should provide their own implementation
 */
export async function defaultNodeExecutor(
  task: Task,
  input: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<TaskExecutionResult> {
  const startTime = Date.now();

  // Check if handler is defined
  if (!task.config.handler) {
    throw new Error(`No handler defined for task: ${task.id}`);
  }

  // This is a placeholder - actual execution should be handled by custom executor
  throw new Error(
    `Task handler "${task.config.handler}" not implemented. ` +
      'Provide a custom NodeExecutor to WorkflowExecutor.'
  );
}
