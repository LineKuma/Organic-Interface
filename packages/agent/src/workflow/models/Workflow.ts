/**
 * Workflow - Workflow definition and execution models
 *
 * Defines workflow structure, edges, and execution records.
 */

import type { Task, TaskDependency } from './Task.js';

/**
 * Workflow status enumeration
 */
export enum WorkflowStatus {
  /** Workflow is in draft state */
  DRAFT = 'draft',
  /** Workflow is published and ready for execution */
  PUBLISHED = 'published',
  /** Workflow is archived */
  ARCHIVED = 'archived',
}

/**
 * Workflow execution status
 */
export enum WorkflowExecutionStatus {
  /** Execution is pending */
  PENDING = 'pending',
  /** Execution is running */
  RUNNING = 'running',
  /** Execution is paused */
  PAUSED = 'paused',
  /** Execution completed successfully */
  COMPLETED = 'completed',
  /** Execution failed */
  FAILED = 'failed',
  /** Execution was cancelled */
  CANCELLED = 'cancelled',
}

/**
 * Edge condition type
 */
export enum EdgeConditionType {
  /** Always execute */
  ALWAYS = 'always',
  /** Execute on task success */
  ON_SUCCESS = 'on_success',
  /** Execute on task failure */
  ON_FAILURE = 'on_failure',
  /** Execute on task completion (success or failure) */
  ON_COMPLETE = 'on_complete',
  /** Custom condition expression */
  EXPRESSION = 'expression',
}

/**
 * Edge condition
 */
export interface EdgeCondition {
  /** Condition type */
  type: EdgeConditionType;
  /** Expression content (for EXPRESSION type) */
  expression?: string;
  /** Expected value (for comparison expressions) */
  expectedValue?: unknown;
}

/**
 * Workflow edge definition
 */
export interface WorkflowEdge {
  /** Unique edge ID */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge condition */
  condition?: EdgeCondition;
  /** Edge label */
  label?: string;
  /** Edge metadata */
  metadata?: Record<string, unknown>;
  /** Visual position for editor */
  points?: Array<{ x: number; y: number }>;
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
  /** Enable parallel execution */
  enableParallel?: boolean;
  /** Maximum parallel nodes */
  maxParallelNodes?: number;
  /** Default timeout for all tasks */
  defaultTimeout?: number;
  /** Enable auto-retry */
  autoRetry?: boolean;
  /** Enable execution tracking */
  enableTracking?: boolean;
  /** Enable execution recovery */
  enableRecovery?: boolean;
  /** Error handling strategy */
  errorStrategy?: 'fail-fast' | 'continue' | 'compensate';
  /** Callback URL for notifications */
  callbackUrl?: string;
  /** Custom configuration */
  custom?: Record<string, unknown>;
}

/**
 * Default workflow configuration
 */
export const DEFAULT_WORKFLOW_CONFIG: Omit<WorkflowConfig, 'callbackUrl'> & { callbackUrl?: string } = {
  enableParallel: true,
  maxParallelNodes: 10,
  defaultTimeout: 3600000, // 1 hour
  autoRetry: false,
  enableTracking: true,
  enableRecovery: true,
  errorStrategy: 'fail-fast',
  callbackUrl: undefined,
  custom: {},
};

/**
 * Workflow variable
 */
export interface WorkflowVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Default value */
  defaultValue?: unknown;
  /** Description */
  description?: string;
}

/**
 * Workflow definition
 */
export interface Workflow {
  /** Unique workflow ID */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Version string */
  version: string;
  /** Workflow status */
  status: WorkflowStatus;
  /** Workflow nodes (tasks) */
  nodes: Task[];
  /** Workflow edges */
  edges: WorkflowEdge[];
  /** Workflow configuration */
  config: WorkflowConfig;
  /** Workflow variables */
  variables?: WorkflowVariable[];
  /** Entry point node ID */
  entryNodeId?: string;
  /** Exit point node IDs */
  exitNodeIds?: string[];
  /** Parent workflow ID (for subworkflows) */
  parentWorkflowId?: string;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Created by */
  createdBy?: string;
}

/**
 * Workflow execution
 */
export interface WorkflowExecution {
  /** Execution ID */
  id: string;
  /** Workflow ID */
  workflowId: string;
  /** Execution status */
  status: WorkflowExecutionStatus;
  /** Input parameters */
  input: Record<string, unknown>;
  /** Current executing node IDs */
  currentNodeIds: string[];
  /** Completed node IDs */
  completedNodeIds: string[];
  /** Failed node IDs */
  failedNodeIds: string[];
  /** Skipped node IDs */
  skippedNodeIds: string[];
  /** Node executions */
  nodeExecutions: Map<string, string>; // nodeId -> executionId
  /** Execution context data */
  context: Record<string, unknown>;
  /** Started timestamp */
  startedAt?: number;
  /** Finished timestamp */
  finishedAt?: number;
  /** Total duration in milliseconds */
  duration?: number;
  /** Parent execution ID (for subworkflow executions) */
  parentExecutionId?: string;
  /** Root execution ID (for nested subworkflows) */
  rootExecutionId?: string;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Error information */
  error?: {
    code: string;
    message: string;
    nodeId?: string;
    details?: unknown;
  };
  /** Execution result */
  result?: unknown;
  /** Retry count */
  retryCount: number;
}

/**
 * Workflow execution snapshot
 */
export interface WorkflowExecutionSnapshot {
  /** Snapshot ID */
  id: string;
  /** Execution ID */
  executionId: string;
  /** Snapshot data */
  data: {
    status: WorkflowExecutionStatus;
    currentNodeIds: string[];
    completedNodeIds: string[];
    failedNodeIds: string[];
    context: Record<string, unknown>;
  };
  /** Created timestamp */
  createdAt: number;
}

/**
 * Workflow version
 */
export interface WorkflowVersion {
  /** Version ID */
  id: string;
  /** Workflow ID */
  workflowId: string;
  /** Version string */
  version: string;
  /** Full workflow definition */
  definition: Workflow;
  /** Created timestamp */
  createdAt: number;
  /** Created by */
  createdBy?: string;
  /** Change notes */
  notes?: string;
}

/**
 * Create a new workflow
 */
export function createWorkflow(
  name: string,
  version: string = '1.0.0',
  options?: {
    id?: string;
    description?: string;
    config?: Partial<WorkflowConfig>;
    variables?: WorkflowVariable[];
    createdBy?: string;
  }
): Workflow {
  const now = Date.now();

  return {
    id: options?.id ?? `wf_${now}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description: options?.description,
    version,
    status: WorkflowStatus.DRAFT,
    nodes: [],
    edges: [],
    config: {
      ...DEFAULT_WORKFLOW_CONFIG,
      ...options?.config,
    },
    variables: options?.variables,
    createdAt: now,
    updatedAt: now,
    createdBy: options?.createdBy,
  };
}

/**
 * Create a workflow edge
 */
export function createWorkflowEdge(
  source: string,
  target: string,
  options?: {
    id?: string;
    condition?: EdgeCondition;
    label?: string;
    metadata?: Record<string, unknown>;
  }
): WorkflowEdge {
  return {
    id: options?.id ?? `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    source,
    target,
    condition: options?.condition,
    label: options?.label,
    metadata: options?.metadata,
  };
}

/**
 * Create a simple always-true edge
 */
export function createSimpleEdge(
  source: string,
  target: string,
  label?: string
): WorkflowEdge {
  return createWorkflowEdge(source, target, {
    condition: { type: EdgeConditionType.ALWAYS },
    label,
  });
}

/**
 * Create a success edge
 */
export function createSuccessEdge(
  source: string,
  target: string,
  label?: string
): WorkflowEdge {
  return createWorkflowEdge(source, target, {
    condition: { type: EdgeConditionType.ON_SUCCESS },
    label: label ?? 'on success',
  });
}

/**
 * Create a failure edge
 */
export function createFailureEdge(
  source: string,
  target: string,
  label?: string
): WorkflowEdge {
  return createWorkflowEdge(source, target, {
    condition: { type: EdgeConditionType.ON_FAILURE },
    label: label ?? 'on failure',
  });
}

/**
 * Create a workflow execution
 */
export function createWorkflowExecution(
  workflowId: string,
  input: Record<string, unknown> = {}
): WorkflowExecution {
  const now = Date.now();

  return {
    id: `exec_${now}_${Math.random().toString(36).substr(2, 9)}`,
    workflowId,
    status: WorkflowExecutionStatus.PENDING,
    input,
    currentNodeIds: [],
    completedNodeIds: [],
    failedNodeIds: [],
    skippedNodeIds: [],
    nodeExecutions: new Map(),
    context: { ...input },
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a workflow execution snapshot
 */
export function createWorkflowSnapshot(
  execution: WorkflowExecution
): WorkflowExecutionSnapshot {
  return {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    executionId: execution.id,
    data: {
      status: execution.status,
      currentNodeIds: execution.currentNodeIds,
      completedNodeIds: execution.completedNodeIds,
      failedNodeIds: execution.failedNodeIds,
      context: execution.context,
    },
    createdAt: Date.now(),
  };
}

/**
 * Update workflow execution
 */
export function updateWorkflowExecution(
  execution: WorkflowExecution,
  updates: Partial<Omit<WorkflowExecution, 'id' | 'workflowId' | 'createdAt'>>
): WorkflowExecution {
  const now = Date.now();

  return {
    ...execution,
    ...updates,
    updatedAt: now,
  };
}

/**
 * Validate workflow definition
 */
export function isValidWorkflow(workflow: unknown): workflow is Workflow {
  if (!workflow || typeof workflow !== 'object') {
    return false;
  }

  const wf = workflow as Record<string, unknown>;
  return (
    typeof wf.id === 'string' &&
    typeof wf.name === 'string' &&
    typeof wf.version === 'string' &&
    Object.values(WorkflowStatus).includes(wf.status as WorkflowStatus) &&
    Array.isArray(wf.nodes) &&
    Array.isArray(wf.edges)
  );
}

/**
 * Get entry node of workflow
 */
export function getEntryNode(workflow: Workflow): Task | undefined {
  if (workflow.entryNodeId) {
    return workflow.nodes.find((n) => n.id === workflow.entryNodeId);
  }

  // Find start node if exists
  return workflow.nodes.find((n) => n.type === 'start');
}

/**
 * Get exit nodes of workflow
 */
export function getExitNodes(workflow: Workflow): Task[] {
  if (workflow.exitNodeIds && workflow.exitNodeIds.length > 0) {
    return workflow.nodes.filter((n) => workflow.exitNodeIds!.includes(n.id));
  }

  // Find end nodes if exists
  return workflow.nodes.filter((n) => n.type === 'end');
}

/**
 * Get outgoing edges from a node
 */
export function getOutgoingEdges(
  workflow: Workflow,
  nodeId: string
): WorkflowEdge[] {
  return workflow.edges.filter((e) => e.source === nodeId);
}

/**
 * Get incoming edges to a node
 */
export function getIncomingEdges(
  workflow: Workflow,
  nodeId: string
): WorkflowEdge[] {
  return workflow.edges.filter((e) => e.target === nodeId);
}

/**
 * Check if workflow is valid DAG
 */
export function isValidDAG(workflow: Workflow): { valid: boolean; error?: string } {
  // Check for cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoing = getOutgoingEdges(workflow, nodeId);
    for (const edge of outgoing) {
      if (!visited.has(edge.target)) {
        if (hasCycle(edge.target)) {
          return true;
        }
      } else if (recursionStack.has(edge.target)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  // Check all nodes
  for (const node of workflow.nodes) {
    if (!visited.has(node.id)) {
      if (hasCycle(node.id)) {
        return {
          valid: false,
          error: `Cycle detected involving node: ${node.id}`,
        };
      }
    }
  }

  // Check for orphan nodes
  for (const node of workflow.nodes) {
    const hasIncoming = getIncomingEdges(workflow, node.id).length > 0;
    const hasOutgoing = getOutgoingEdges(workflow, node.id).length > 0;

    if (!hasIncoming && !hasOutgoing && workflow.nodes.length > 1) {
      return {
        valid: false,
        error: `Orphan node detected: ${node.id}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get topological order of nodes
 */
export function getTopologicalOrder(workflow: Workflow): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of workflow.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build graph
  for (const edge of workflow.edges) {
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];

  // Start with nodes with no incoming edges
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);

    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return result;
}
