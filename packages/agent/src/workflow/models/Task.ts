/**
 * Task - Task model for workflow execution
 *
 * Defines the task structure used in workflow execution,
 * including task status, configuration, and execution tracking.
 */

/**
 * Task status enumeration
 */
export enum TaskStatus {
  /** Task is pending, waiting to be executed */
  PENDING = 'pending',
  /** Task is waiting for dependencies */
  WAITING = 'waiting',
  /** Task is currently executing */
  RUNNING = 'running',
  /** Task execution completed successfully */
  COMPLETED = 'completed',
  /** Task execution failed */
  FAILED = 'failed',
  /** Task was skipped */
  SKIPPED = 'skipped',
  /** Task was cancelled */
  CANCELLED = 'cancelled',
  /** Task execution timed out */
  TIMEOUT = 'timeout',
  /** Task is paused */
  PAUSED = 'paused',
  /** Task is retrying after failure */
  RETRYING = 'retrying',
}

/**
 * Task type enumeration
 */
export enum TaskType {
  /** Basic task execution */
  TASK = 'task',
  /** Conditional task */
  CONDITION = 'condition',
  /** Parallel execution group */
  PARALLEL = 'parallel',
  /** Loop execution */
  LOOP = 'loop',
  /** Sub-workflow invocation */
  SUBWORKFLOW = 'subworkflow',
  /** Start node */
  START = 'start',
  /** End node */
  END = 'end',
  /** Delay/wait task */
  DELAY = 'delay',
  /** Manual intervention task */
  MANUAL = 'manual',
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry interval in milliseconds */
  retryInterval: number;
  /** Exponential backoff multiplier */
  backoffMultiplier?: number;
  /** Maximum retry interval */
  maxRetryInterval?: number;
  /** Retry on specific errors only */
  retryableErrors?: string[];
  /** Do not retry on these errors */
  nonRetryableErrors?: string[];
}

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: Required<RetryPolicy> = {
  maxRetries: 3,
  retryInterval: 1000,
  backoffMultiplier: 2,
  maxRetryInterval: 60000,
  retryableErrors: [],
  nonRetryableErrors: [],
};

/**
 * Task timeout configuration
 */
export interface TaskTimeout {
  /** Timeout duration in milliseconds */
  duration: number;
  /** Action on timeout */
  action: 'fail' | 'skip' | 'continue';
}

/**
 * Task input definition
 */
export interface TaskInput {
  /** Input parameter name */
  name: string;
  /** Input type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  /** Default value */
  defaultValue?: unknown;
  /** Is required */
  required?: boolean;
  /** Description */
  description?: string;
}

/**
 * Task output definition
 */
export interface TaskOutput {
  /** Output parameter name */
  name: string;
  /** Output type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  /** Description */
  description?: string;
}

/**
 * Task configuration
 */
export interface TaskConfig {
  /** Task handler name */
  handler?: string;
  /** Task-specific configuration */
  params?: Record<string, unknown>;
  /** Input definitions */
  inputs?: TaskInput[];
  /** Output definitions */
  outputs?: TaskOutput[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Resource limits */
  resources?: {
    /** Memory limit in MB */
    memory?: number;
    /** CPU limit in cores */
    cpu?: number;
    /** Disk limit in MB */
    disk?: number;
  };
}

/**
 * Task dependencies
 */
export interface TaskDependency {
  /** Dependent task ID */
  taskId: string;
  /** Required status for dependency */
  requiredStatus?: TaskStatus;
}

/**
 * Condition expression for conditional tasks
 */
export interface ConditionExpression {
  /** Expression type */
  type: 'expression' | 'script' | 'function';
  /** Expression content */
  content: string;
  /** Expected result for true path */
  expectedTrue?: boolean;
}

/**
 * Loop configuration
 */
export interface LoopConfig {
  /** Loop type */
  type: 'count' | 'while' | 'foreach' | 'until';
  /** Maximum iterations */
  maxIterations: number;
  /** Loop variable name (for foreach) */
  loopVariable?: string;
  /** Collection to iterate (for foreach) */
  collection?: string;
  /** Condition expression (for while/until) */
  condition?: ConditionExpression;
}

/**
 * Parallel execution configuration
 */
export interface ParallelConfig {
  /** Execution mode */
  mode: 'fork' | 'fanout' | 'fanin';
  /** Wait for all branches */
  waitAll?: boolean;
  /** Timeout for all branches */
  timeout?: number;
  /** Merge strategy */
  mergeStrategy?: 'first' | 'all' | 'custom';
}

/**
 * Task metadata
 */
export interface TaskMetadata {
  /** Task name */
  name: string;
  /** Task description */
  description?: string;
  /** Task tags */
  tags?: string[];
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Task definition
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  /** Task name */
  name: string;
  /** Task type */
  type: TaskType;
  /** Task configuration */
  config: TaskConfig;
  /** Task dependencies */
  dependencies: TaskDependency[];
  /** Retry policy */
  retryPolicy?: RetryPolicy;
  /** Timeout configuration */
  timeout?: TaskTimeout;
  /** Condition for conditional tasks */
  condition?: ConditionExpression;
  /** Loop configuration */
  loop?: LoopConfig;
  /** Parallel configuration */
  parallel?: ParallelConfig;
  /** Parent workflow ID */
  workflowId?: string;
  /** Task metadata */
  metadata?: TaskMetadata;
  /** Position in visual editor */
  position?: {
    x: number;
    y: number;
  };
}

/**
 * Task execution record
 */
export interface TaskExecution {
  /** Execution ID */
  id: string;
  /** Task ID */
  taskId: string;
  /** Parent execution ID */
  executionId: string;
  /** Execution status */
  status: TaskStatus;
  /** Input parameters */
  input: Record<string, unknown>;
  /** Output result */
  output?: unknown;
  /** Error information */
  error?: {
    code: string;
    message: string;
    stack?: string;
    details?: unknown;
  };
  /** Retry count */
  retryCount: number;
  /** Started timestamp */
  startedAt?: number;
  /** Finished timestamp */
  finishedAt?: number;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Node execution ID (for tracking in graph) */
  nodeExecutionId?: string;
}

/**
 * Task execution history entry
 */
export interface TaskExecutionHistory {
  /** Task execution ID */
  executionId: string;
  /** All attempts for this task */
  attempts: TaskExecution[];
  /** Final status */
  finalStatus: TaskStatus;
  /** Total duration */
  totalDuration: number;
}

/**
 * Create a new task
 */
export function createTask(
  name: string,
  type: TaskType,
  config: TaskConfig = {},
  options?: {
    id?: string;
    workflowId?: string;
    dependencies?: TaskDependency[];
    retryPolicy?: RetryPolicy;
    timeout?: TaskTimeout;
    metadata?: TaskMetadata;
  }
): Task {
  const now = Date.now();

  return {
    id: options?.id ?? `task_${now}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type,
    config,
    dependencies: options?.dependencies ?? [],
    retryPolicy: options?.retryPolicy,
    timeout: options?.timeout,
    workflowId: options?.workflowId,
    metadata: options?.metadata,
  };
}

/**
 * Create a task execution record
 */
export function createTaskExecution(
  taskId: string,
  executionId: string,
  input: Record<string, unknown> = {}
): TaskExecution {
  const now = Date.now();

  return {
    id: `task_exec_${now}_${Math.random().toString(36).substr(2, 9)}`,
    taskId,
    executionId,
    status: TaskStatus.PENDING,
    input,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update task execution status
 */
export function updateTaskExecution(
  execution: TaskExecution,
  updates: Partial<Omit<TaskExecution, 'id' | 'taskId' | 'executionId' | 'createdAt'>>
): TaskExecution {
  const now = Date.now();

  return {
    ...execution,
    ...updates,
    updatedAt: now,
  };
}

/**
 * Check if task execution is final
 */
export function isTaskExecutionFinal(status: TaskStatus): boolean {
  return [
    TaskStatus.COMPLETED,
    TaskStatus.FAILED,
    TaskStatus.SKIPPED,
    TaskStatus.CANCELLED,
    TaskStatus.TIMEOUT,
  ].includes(status);
}

/**
 * Check if task can be retried
 */
export function canTaskRetry(
  execution: TaskExecution,
  task: Task
): boolean {
  if (isTaskExecutionFinal(execution.status)) {
    return false;
  }

  const maxRetries = task.retryPolicy?.maxRetries ?? DEFAULT_RETRY_POLICY.maxRetries;
  return execution.retryCount < maxRetries;
}

/**
 * Calculate next retry interval
 */
export function calculateRetryInterval(
  execution: TaskExecution,
  task: Task
): number {
  const policy = task.retryPolicy ?? DEFAULT_RETRY_POLICY;
  const baseInterval = policy.retryInterval;
  const multiplier = policy.backoffMultiplier ?? 1;
  const maxInterval = policy.maxRetryInterval ?? 60000;

  const interval = baseInterval * Math.pow(multiplier, execution.retryCount);
  return Math.min(interval, maxInterval);
}

/**
 * Validate task definition
 */
export function isValidTask(task: unknown): task is Task {
  if (!task || typeof task !== 'object') {
    return false;
  }

  const t = task as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    Object.values(TaskType).includes(t.type as TaskType) &&
    typeof t.config === 'object' &&
    Array.isArray(t.dependencies)
  );
}

/**
 * Create a simple task with basic configuration
 */
export function createSimpleTask(
  name: string,
  handler: string,
  params?: Record<string, unknown>
): Task {
  return createTask(name, TaskType.TASK, {
    handler,
    params,
  });
}

/**
 * Create a condition task
 */
export function createConditionTask(
  name: string,
  condition: ConditionExpression,
  trueTaskId?: string,
  falseTaskId?: string
): Task {
  return createTask(name, TaskType.CONDITION, {
    params: {
      trueTaskId,
      falseTaskId,
    },
  }, {
    metadata: {
      name,
      description: 'Conditional task based on expression evaluation',
    },
  });
}

/**
 * Create a loop task
 */
export function createLoopTask(
  name: string,
  loopConfig: LoopConfig,
  bodyTaskId: string
): Task {
  return createTask(name, TaskType.LOOP, {
    params: {
      bodyTaskId,
    },
  }, {
    metadata: {
      name,
      description: 'Loop task with configuration',
    },
  });
}

/**
 * Create a parallel task
 */
export function createParallelTask(
  name: string,
  parallelConfig: ParallelConfig,
  branchTaskIds: string[]
): Task {
  return createTask(name, TaskType.PARALLEL, {
    params: {
      branchTaskIds,
    },
  }, {
    metadata: {
      name,
      description: 'Parallel execution task',
    },
  });
}
