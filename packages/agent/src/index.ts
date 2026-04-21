/**
 * @organic/agent - Agent module
 */

export {
  createLogger,
  type Logger,
  type LogLevel,
} from '@organic/utils';

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
}

/**
 * Task definition
 */
export interface Task {
  id: string;
  name: string;
  priority: TaskPriority;
  status: TaskStatus;
  execute(): Promise<void>;
}

/**
 * Task queue for managing tasks
 */
export class TaskQueue {
  private queue: Task[] = [];

  enqueue(task: Task): void {
    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): Task | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

/**
 * Task scheduler
 */
export class TaskScheduler {
  private queue: TaskQueue;
  private running: boolean = false;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.queue = new TaskQueue();
    this.logger = logger ?? createLogger('scheduler');
  }

  async schedule(task: Task): Promise<void> {
    this.queue.enqueue(task);
    this.logger.info(`Task scheduled: ${task.name}`);
  }

  async start(): Promise<void> {
    this.running = true;
    this.logger.info('Task scheduler started');
  }

  async stop(): Promise<void> {
    this.running = false;
    this.logger.info('Task scheduler stopped');
  }
}

/**
 * Context manager for agent execution context
 */
export class ContextManager {
  private context: Map<string, unknown> = new Map();

  set(key: string, value: unknown): void {
    this.context.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.context.get(key) as T | undefined;
  }

  delete(key: string): void {
    this.context.delete(key);
  }

  clear(): void {
    this.context.clear();
  }
}
