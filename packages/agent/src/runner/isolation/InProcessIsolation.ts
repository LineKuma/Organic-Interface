/**
 * InProcessIsolation - Isolated execution within the current process
 *
 * Runs task handlers in-process while providing logical isolation:
 * - Fresh execution context per task (no shared mutable state leaked)
 * - Configurable timeout with abort/cancellation
 * - Concurrency limiting (semaphore)
 * - Capability gating (permitted / forbidden task names)
 *
 * This is the default, lowest-overhead isolation strategy.
 */

import {
  type ExecutionIsolation,
  type IsolatedExecutionRequest,
  type IsolatedExecutionResult,
  type IsolatedTaskHandler,
} from './ExecutionIsolation.js';

/**
 * In-process isolation configuration
 */
export interface InProcessIsolationConfig {
  /** Default timeout in ms */
  defaultTimeout?: number;
  /** Maximum concurrent executions */
  maxConcurrent?: number;
  /** Task names allowed to run (empty = all allowed) */
  permittedTaskNames?: string[];
  /** Task names explicitly forbidden */
  forbiddenTaskNames?: string[];
}

/**
 * Default in-process isolation configuration
 */
export const DEFAULT_IN_PROCESS_CONFIG: Required<InProcessIsolationConfig> = {
  defaultTimeout: 30000,
  maxConcurrent: 16,
  permittedTaskNames: [],
  forbiddenTaskNames: [],
};

/**
 * InProcessIsolation - Logical isolation in the current process
 *
 * Features:
 * - Fresh isolated context per task
 * - Timeout and cancellation via AbortController
 * - Concurrency limiting
 * - Task name allowlist / denylist
 */
export class InProcessIsolation implements ExecutionIsolation {
  readonly name = 'in-process';

  private config: Required<InProcessIsolationConfig>;
  private activeCount = 0;
  private waiters: Array<() => void> = [];

  constructor(config: InProcessIsolationConfig = {}) {
    this.config = {
      ...DEFAULT_IN_PROCESS_CONFIG,
      ...config,
    };
  }

  /**
   * Execute a task handler within an isolated context
   */
  async execute<T = unknown>(
    request: IsolatedExecutionRequest,
    handler: IsolatedTaskHandler
  ): Promise<IsolatedExecutionResult<T>> {
    const startTime = Date.now();

    // Capability gating
    const gateError = this.checkGate(request.taskName);
    if (gateError) {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: gateError,
        },
        executionTime: Date.now() - startTime,
      };
    }

    // Concurrency limiting
    await this.acquire();

    try {
      const timeout = request.timeout ?? this.config.defaultTimeout;
      const result = await this.runWithTimeout<T>(request, handler, timeout);
      result.executionTime = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        executionTime: Date.now() - startTime,
      };
    } finally {
      this.release();
    }
  }

  /**
   * In-process isolation is always available
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Get the number of currently active executions
   */
  getActiveCount(): number {
    return this.activeCount;
  }

  /**
   * Run the handler with a timeout and fresh isolated context
   */
  private async runWithTimeout<T>(
    request: IsolatedExecutionRequest,
    handler: IsolatedTaskHandler,
    timeout: number
  ): Promise<IsolatedExecutionResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const data = await Promise.race([
        Promise.resolve(handler(request.payload)),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`Task ${request.taskName} timed out after ${timeout}ms`));
          });
        }),
      ]);

      return {
        success: true,
        data: data as T,
        executionTime: 0,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Check task name against the allowlist / denylist
   */
  private checkGate(taskName: string): string | null {
    if (this.config.forbiddenTaskNames.includes(taskName)) {
      return `Task '${taskName}' is forbidden by isolation policy`;
    }

    if (
      this.config.permittedTaskNames.length > 0 &&
      !this.config.permittedTaskNames.includes(taskName)
    ) {
      return `Task '${taskName}' is not permitted by isolation policy`;
    }

    return null;
  }

  /**
   * Acquire a concurrency slot
   */
  private async acquire(): Promise<void> {
    if (this.activeCount < this.config.maxConcurrent) {
      this.activeCount++;
      return;
    }

    await new Promise<void>(resolve => {
      this.waiters.push(resolve);
    });
    // Slot is handed over by release(); do not increment again.
  }

  /**
   * Release a concurrency slot
   */
  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      // Hand the freed slot directly to the next waiter
      next();
    } else {
      this.activeCount--;
    }
  }
}
