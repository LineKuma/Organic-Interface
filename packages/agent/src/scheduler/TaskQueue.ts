/**
 * Task Queue - Priority queue for task management
 *
 * Implements a priority-based task queue with support for
 * task dependencies and various queue operations.
 */

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Task status
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Task definition
 */
export interface Task {
  /** Unique task identifier */
  id: string;

  /** Task name */
  name: string;

  /** Task priority */
  priority: TaskPriority;

  /** Current status */
  status: TaskStatus;

  /** Dependencies - task IDs that must complete first */
  dependencies: string[];

  /** Task payload/data */
  payload?: Record<string, unknown>;

  /** Created timestamp */
  createdAt: number;

  /** Started timestamp */
  startedAt?: number;

  /** Completed timestamp */
  completedAt?: number;

  /** Execution result */
  result?: unknown;

  /** Error message if failed */
  error?: string;

  /** Retry count */
  retryCount: number;

  /** Maximum retries */
  maxRetries: number;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task options for creation
 */
export interface TaskOptions {
  /** Task name */
  name: string;

  /** Task priority (default: NORMAL) */
  priority?: TaskPriority;

  /** Dependencies */
  dependencies?: string[];

  /** Task payload */
  payload?: Record<string, unknown>;

  /** Maximum retries (default: 0) */
  maxRetries?: number;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task queue configuration
 */
export interface TaskQueueConfig {
  /** Maximum queue size (0 = unlimited) */
  maxSize?: number;

  /** Enable task deduplication */
  deduplicate?: boolean;

  /** Default task timeout in milliseconds */
  defaultTimeout?: number;

  /** Maximum retries for failed tasks */
  maxRetries?: number;
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: Required<TaskQueueConfig> = {
  maxSize: 0,
  deduplicate: false,
  defaultTimeout: 30000,
  maxRetries: 3,
};

/**
 * Create a new task
 */
export function createTask(id: string, options: TaskOptions): Task {
  return {
    id,
    name: options.name,
    priority: options.priority ?? TaskPriority.NORMAL,
    status: TaskStatus.PENDING,
    dependencies: options.dependencies ?? [],
    payload: options.payload,
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: options.maxRetries ?? 0,
    metadata: options.metadata,
  };
}

/**
 * TaskQueue - Priority queue implementation
 *
 * Tasks are sorted by priority, with higher priority tasks
 * being dequeued first. Tasks with unresolved dependencies
 * are skipped until their dependencies are satisfied.
 */
export class TaskQueue {
  private queue: Task[] = [];
  private completedTasks: Map<string, Task> = new Map();
  private runningTasks: Map<string, Task> = new Map();
  private taskMap: Map<string, Task> = new Map();
  private config: Required<TaskQueueConfig>;

  /**
   * Create a new TaskQueue
   */
  constructor(config: TaskQueueConfig = {}) {
    this.config = {
      ...DEFAULT_QUEUE_CONFIG,
      ...config,
    };
  }

  // ==================== Queue Operations ====================

  /**
   * Add a task to the queue
   */
  enqueue(task: Task): boolean {
    // Check max size
    if (this.config.maxSize > 0 && this.queue.length >= this.config.maxSize) {
      return false;
    }

    // Check for duplicates
    if (this.config.deduplicate && this.has(task.id)) {
      return false;
    }

    // Store in map
    this.taskMap.set(task.id, task);

    // Add to priority queue
    this.queue.push(task);
    this.sortQueue();

    return true;
  }

  /**
   * Add multiple tasks to the queue
   */
  enqueueMany(tasks: Task[]): number {
    let added = 0;
    for (const task of tasks) {
      if (this.enqueue(task)) {
        added++;
      }
    }
    return added;
  }

  /**
   * Remove and return the next ready task
   *
   * A task is ready if:
   * - Status is PENDING
   * - All dependencies are COMPLETED
   */
  dequeue(): Task | undefined {
    // Find next ready task
    for (let i = 0; i < this.queue.length; i++) {
      const task = this.queue[i];
      if (task.status === TaskStatus.PENDING && this.areDependenciesMet(task)) {
        // Remove from queue
        this.queue.splice(i, 1);
        // Mark as running
        task.status = TaskStatus.RUNNING;
        task.startedAt = Date.now();
        this.runningTasks.set(task.id, task);
        return task;
      }
    }
    return undefined;
  }

  /**
   * Peek at the next task without removing it
   */
  peek(): Task | undefined {
    for (const task of this.queue) {
      if (task.status === TaskStatus.PENDING && this.areDependenciesMet(task)) {
        return task;
      }
    }
    return undefined;
  }

  /**
   * Get task by ID
   */
  get(taskId: string): Task | undefined {
    return this.taskMap.get(taskId);
  }

  /**
   * Check if task exists
   */
  has(taskId: string): boolean {
    return this.taskMap.has(taskId);
  }

  /**
   * Remove a task from the queue
   */
  remove(taskId: string): boolean {
    const task = this.taskMap.get(taskId);
    if (!task) {
      return false;
    }

    // Remove from queue
    const index = this.queue.findIndex((t) => t.id === taskId);
    if (index > -1) {
      this.queue.splice(index, 1);
    }

    // Remove from task map
    this.taskMap.delete(taskId);
    return true;
  }

  /**
   * Clear all tasks from the queue
   */
  clear(): void {
    this.queue = [];
    this.taskMap.clear();
    this.runningTasks.clear();
  }

  // ==================== Task Status Management ====================

  /**
   * Mark task as completed
   */
  complete(taskId: string, result?: unknown): boolean {
    const task = this.runningTasks.get(taskId);
    if (!task) {
      return false;
    }

    task.status = TaskStatus.COMPLETED;
    task.completedAt = Date.now();
    task.result = result;

    this.runningTasks.delete(taskId);
    this.completedTasks.set(taskId, task);

    return true;
  }

  /**
   * Mark task as failed
   */
  fail(taskId: string, error: string): boolean {
    const task = this.runningTasks.get(taskId);
    if (!task) {
      return false;
    }

    task.retryCount++;

    if (task.retryCount < task.maxRetries) {
      // Re-queue for retry
      task.status = TaskStatus.PENDING;
      task.error = error;
      this.runningTasks.delete(taskId);
      this.queue.push(task);
      this.sortQueue();
    } else {
      // Mark as failed
      task.status = TaskStatus.FAILED;
      task.completedAt = Date.now();
      task.error = error;
      this.runningTasks.delete(taskId);
      this.completedTasks.set(taskId, task);
    }

    return true;
  }

  /**
   * Cancel a task
   */
  cancel(taskId: string): boolean {
    const task = this.taskMap.get(taskId);
    if (!task || task.status === TaskStatus.RUNNING) {
      return false;
    }

    task.status = TaskStatus.CANCELLED;
    task.completedAt = Date.now();

    // Remove from queue
    const index = this.queue.findIndex((t) => t.id === taskId);
    if (index > -1) {
      this.queue.splice(index, 1);
    }

    return true;
  }

  // ==================== Query Methods ====================

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.filter((t) => t.status === TaskStatus.PENDING).length;
  }

  /**
   * Get total task count
   */
  totalSize(): number {
    return this.taskMap.size;
  }

  /**
   * Get running task count
   */
  runningCount(): number {
    return this.runningTasks.size;
  }

  /**
   * Get pending tasks
   */
  getPendingTasks(): Task[] {
    return this.queue.filter((t) => t.status === TaskStatus.PENDING);
  }

  /**
   * Get running tasks
   */
  getRunningTasks(): Task[] {
    return Array.from(this.runningTasks.values());
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): Task[] {
    return Array.from(this.completedTasks.values());
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.size() === 0;
  }

  /**
   * Check if queue has ready tasks
   */
  hasReadyTasks(): boolean {
    return this.peek() !== undefined;
  }

  // ==================== Private Methods ====================

  /**
   * Sort queue by priority (descending) and creation time (ascending)
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Earlier creation first
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Check if all dependencies for a task are met
   */
  private areDependenciesMet(task: Task): boolean {
    for (const depId of task.dependencies) {
      const depTask = this.completedTasks.get(depId);
      if (!depTask || depTask.status !== TaskStatus.COMPLETED) {
        return false;
      }
    }
    return true;
  }
}
