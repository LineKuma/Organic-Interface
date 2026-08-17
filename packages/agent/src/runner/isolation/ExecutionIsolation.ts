/**
 * ExecutionIsolation - Isolated task execution contract
 *
 * Defines the common interface for executing agent tasks in an
 * isolated environment. Implementations control the isolation
 * boundary:
 *
 * - InProcessIsolation: isolated within the same process (fresh context,
 *   timeout, cancellation, concurrency limit, capability gating)
 * - ChildProcessIsolation: isolated in a separate child process
 *   (OS-level process boundary)
 *
 * All isolation implementations are fully modular and swappable
 * via the ExecutionIsolation interface.
 */

/**
 * Request passed to an isolated execution
 */
export interface IsolatedExecutionRequest {
  /** Task name */
  taskName: string;
  /** Task payload */
  payload: unknown;
  /** Execution timeout in ms */
  timeout?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result returned from an isolated execution
 */
export interface IsolatedExecutionResult<T = unknown> {
  /** Whether execution succeeded */
  success: boolean;
  /** Result data */
  data?: T;
  /** Error information if failed */
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  /** Execution time in ms */
  executionTime: number;
}

/**
 * Task handler executed inside the isolation boundary
 */
export type IsolatedTaskHandler = (payload: unknown) => Promise<unknown> | unknown;

/**
 * ExecutionIsolation - Isolated task execution contract
 *
 * Implementations provide an execute() method that runs a task handler
 * within an isolation boundary and returns a structured result.
 */
export interface ExecutionIsolation {
  /** Isolation strategy name */
  readonly name: string;

  /**
   * Execute a task handler within the isolation boundary
   */
  execute<T = unknown>(
    request: IsolatedExecutionRequest,
    handler: IsolatedTaskHandler
  ): Promise<IsolatedExecutionResult<T>>;

  /**
   * Check whether this isolation strategy is available on the host
   */
  isAvailable(): boolean;
}
