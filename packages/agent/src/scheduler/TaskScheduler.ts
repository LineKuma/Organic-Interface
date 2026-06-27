/**
 * Task Scheduler - Orchestrates task execution
 *
 * The scheduler manages task queues, executes tasks with proper
 * concurrency control, and handles task lifecycle events.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import {
  TaskQueue,
  type Task,
  type TaskOptions,
  type TaskQueueConfig,
  createTask,
} from './TaskQueue.js';

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /** Maximum parallel tasks */
  maxParallelTasks?: number;

  /** Task queue configuration */
  queueConfig?: TaskQueueConfig;

  /** Enable automatic task processing */
  autoProcess?: boolean;

  /** Processing interval in milliseconds */
  processingInterval?: number;

  /** Enable task retry */
  enableRetry?: boolean;

  /** Default task timeout */
  defaultTimeout?: number;
}

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG: Required<SchedulerConfig> = {
  maxParallelTasks: 10,
  queueConfig: {},
  autoProcess: false,
  processingInterval: 100,
  enableRetry: true,
  defaultTimeout: 30000,
};

/**
 * Scheduler events
 */
export interface SchedulerEvents {
  'task:scheduled': { task: Task };
  'task:started': { task: Task };
  'task:completed': { task: Task; result: unknown };
  'task:failed': { task: Task; error: string };
  'task:cancelled': { task: Task };
  'queue:empty': {};
  'queue:full': { size: number };
  'status:change': { running: number; pending: number; completed: number };
}

/**
 * Task execution function type
 */
export type TaskExecutor = (task: Task, signal: AbortSignal) => Promise<unknown>;

/**
 * Task Scheduler - Manages task execution
 *
 * The scheduler provides:
 * - Priority-based task queuing
 * - Concurrency control
 * - Task lifecycle management
 * - Event-driven architecture
 */
export class TaskScheduler extends EventEmitter {
  private config: Required<SchedulerConfig>;
  private queue: TaskQueue;
  private logger: Logger;
  private running: boolean = false;
  private processing: boolean = false;
  private processingInterval?: ReturnType<typeof setInterval>;
  private activeTasks: Map<string, { task: Task; abortController: AbortController }> = new Map();
  private taskExecutor?: TaskExecutor;

  /**
   * Create a new TaskScheduler
   */
  constructor(config: SchedulerConfig = {}) {
    super();
    this.config = {
      ...DEFAULT_SCHEDULER_CONFIG,
      ...config,
      queueConfig: {
        ...DEFAULT_SCHEDULER_CONFIG.queueConfig,
        ...config.queueConfig,
      },
    };

    this.queue = new TaskQueue(this.config.queueConfig);
    this.logger = createLogger({ prefix: 'scheduler' });
  }

  // ==================== Lifecycle ====================

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) {
      this.logger.warn('Scheduler already running');
      return;
    }

    this.running = true;
    this.logger.info('Task scheduler started');

    if (this.config.autoProcess) {
      this.startProcessing();
    }
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.running) {
      this.logger.warn('Scheduler not running');
      return;
    }

    this.running = false;
    this.stopProcessing();

    // Wait for active tasks to complete or cancel
    await this.waitForActiveTasks();

    this.logger.info('Task scheduler stopped');
  }

  /**
   * Set task executor function
   */
  setExecutor(executor: TaskExecutor): void {
    this.taskExecutor = executor;
  }

  // ==================== Task Management ====================

  /**
   * Schedule a task for execution
   */
  schedule(options: TaskOptions): Task {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task = createTask(taskId, {
      ...options,
      maxRetries: options.maxRetries ?? (this.config.enableRetry ? 3 : 0),
    });

    this.queue.enqueue(task);
    this.logger.info(`Task scheduled: ${task.name} (${task.id})`);

    this.emit('task:scheduled', { task });

    // Trigger processing if auto-process is off
    if (!this.config.autoProcess) {
      this.processQueue();
    }

    return task;
  }

  /**
   * Schedule multiple tasks
   */
  scheduleMany(tasks: TaskOptions[]): Task[] {
    return tasks.map(options => this.schedule(options));
  }

  /**
   * Cancel a task
   */
  cancel(taskId: string): boolean {
    const active = this.activeTasks.get(taskId);
    if (active) {
      active.abortController.abort();
    }

    const result = this.queue.cancel(taskId);
    if (result) {
      const task = this.queue.get(taskId);
      if (task) {
        this.emit('task:cancelled', { task });
      }
    }

    return result;
  }

  /**
   * Cancel all pending tasks
   */
  cancelAll(): void {
    // Cancel active tasks
    for (const active of this.activeTasks.values()) {
      active.abortController.abort();
    }

    // Clear queue
    const pendingTasks = this.queue.getPendingTasks();
    for (const task of pendingTasks) {
      this.queue.cancel(task.id);
      this.emit('task:cancelled', { task });
    }
  }

  // ==================== Query Methods ====================

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.queue.get(taskId);
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.size();
  }

  /**
   * Get running task count
   */
  getRunningCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Get pending tasks
   */
  getPendingTasks(): Task[] {
    return this.queue.getPendingTasks();
  }

  /**
   * Get running tasks
   */
  getRunningTasks(): Task[] {
    return Array.from(this.activeTasks.values()).map(a => a.task);
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): Task[] {
    return this.queue.getCompletedTasks();
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if scheduler has capacity for more tasks
   */
  hasCapacity(): boolean {
    return this.activeTasks.size < this.config.maxParallelTasks;
  }

  // ==================== Processing ====================

  /**
   * Start automatic task processing
   */
  startProcessing(): void {
    if (this.processing) {
      return;
    }

    this.processing = true;
    this.processInterval();
  }

  /**
   * Stop automatic task processing
   */
  stopProcessing(): void {
    this.processing = false;
    if (this.processingInterval) {
      clearTimeout(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  /**
   * Process the queue (single iteration)
   */
  private async processQueue(): Promise<void> {
    if (!this.running || !this.hasCapacity()) {
      return;
    }

    // Dequeue next ready task
    const task = this.queue.dequeue();
    if (!task) {
      if (this.queue.isEmpty()) {
        this.emit('queue:empty');
      }
      return;
    }

    // Execute task
    await this.executeTask(task);
  }

  /**
   * Process queue at interval
   */
  private processInterval(): void {
    if (!this.processing || !this.running) {
      return;
    }

    this.processQueue().catch(error => {
      this.logger.error('Error processing queue', error);
    });

    this.processingInterval = setTimeout(
      () => this.processInterval(),
      this.config.processingInterval
    );
  }

  /**
   * Execute a task
   */
  private async executeTask(task: Task): Promise<void> {
    const abortController = new AbortController();
    this.activeTasks.set(task.id, { task, abortController });

    this.emit('task:started', { task });
    this.logger.debug(`Task started: ${task.name} (${task.id})`);

    try {
      if (!this.taskExecutor) {
        throw new Error('No task executor configured');
      }

      const result = await Promise.race([
        this.taskExecutor(task, abortController.signal),
        this.timeoutPromise(this.config.defaultTimeout),
      ]);

      this.queue.complete(task.id, result);
      this.activeTasks.delete(task.id);

      this.emit('task:completed', { task, result });
      this.emit('status:change', this.getStatus());

      this.logger.debug(`Task completed: ${task.name} (${task.id})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage === 'TIMEOUT') {
        abortController.abort();
      }

      const canRetry = this.queue.fail(task.id, errorMessage);
      this.activeTasks.delete(task.id);

      this.emit('task:failed', { task, error: errorMessage });
      this.emit('status:change', this.getStatus());

      this.logger.warn(`Task failed: ${task.name} (${task.id}) - ${errorMessage}`);

      // Retry if applicable
      if (canRetry) {
        this.logger.debug(`Task will be retried: ${task.name}`);
      }
    }

    // Continue processing
    if (this.running && this.hasCapacity()) {
      this.processQueue();
    }
  }

  /**
   * Wait for active tasks to complete
   */
  private async waitForActiveTasks(): Promise<void> {
    while (this.activeTasks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Create a promise that rejects after timeout
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), ms);
    });
  }

  /**
   * Get current scheduler status
   */
  getStatus(): { running: number; pending: number; completed: number } {
    return {
      running: this.activeTasks.size,
      pending: this.queue.size(),
      completed: this.queue.getCompletedTasks().length,
    };
  }
}
