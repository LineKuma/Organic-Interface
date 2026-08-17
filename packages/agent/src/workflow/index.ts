/**
 * Workflow module exports
 *
 * Provides workflow orchestration capabilities including:
 * - Workflow definition and management
 * - Task execution and coordination
 * - Parallel execution support
 * - Error handling and retry logic
 */

// Task model exports
export {
  type Task,
  type TaskExecution,
  type TaskExecutionHistory,
  type TaskConfig,
  type TaskInput,
  type TaskOutput,
  type TaskDependency,
  type TaskMetadata,
  type RetryPolicy,
  type TaskTimeout,
  type ConditionExpression,
  type LoopConfig,
  type ParallelConfig,
  TaskStatus,
  TaskType,
  DEFAULT_RETRY_POLICY,
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
} from './models/index.js';

// Workflow model exports
export {
  type Workflow,
  type WorkflowEdge,
  type WorkflowConfig,
  type WorkflowVariable,
  type WorkflowExecution,
  type WorkflowExecutionSnapshot,
  type WorkflowVersion,
  type EdgeCondition,
  WorkflowStatus,
  WorkflowExecutionStatus,
  EdgeConditionType,
  DEFAULT_WORKFLOW_CONFIG,
  createWorkflow,
  createWorkflowEdge,
  createSimpleEdge,
  createSuccessEdge,
  createFailureEdge,
  createWorkflowExecution,
  createWorkflowSnapshot,
  updateWorkflowExecution,
  isValidWorkflow,
  getEntryNode,
  getExitNodes,
  getOutgoingEdges,
  getIncomingEdges,
  isValidDAG,
  getTopologicalOrder,
} from './models/index.js';

// Workflow executor exports
export {
  WorkflowExecutor,
  type WorkflowExecutorConfig,
  type TaskExecutionResult,
  NodeExecutor,
  DEFAULT_WORKFLOW_EXECUTOR_CONFIG,
  defaultNodeExecutor,
} from './engine/index.js';

// Workflow engine exports
export {
  WorkflowEngine,
  type WorkflowEngineConfig,
  DEFAULT_WORKFLOW_ENGINE_CONFIG,
} from './engine/index.js';

/**
 * Module version
 */
export const WORKFLOW_VERSION = '0.1.0';
