import { describe, it, expect } from 'vitest';
import {
  WorkflowStatus,
  WorkflowExecutionStatus,
  EdgeConditionType,
  EdgeCondition,
  WorkflowEdge,
  WorkflowConfig,
  DEFAULT_WORKFLOW_CONFIG,
  WorkflowVariable,
  Workflow,
  WorkflowExecution,
  WorkflowExecutionSnapshot,
  WorkflowVersion,
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
} from '../../models/Workflow.js';
import { TaskType, createTask } from '../../models/Task.js';

describe('Workflow', () => {
  describe('WorkflowStatus enum', () => {
    it('should have correct status values', () => {
      expect(WorkflowStatus.DRAFT).toBe('draft');
      expect(WorkflowStatus.PUBLISHED).toBe('published');
      expect(WorkflowStatus.ARCHIVED).toBe('archived');
    });
  });

  describe('WorkflowExecutionStatus enum', () => {
    it('should have correct status values', () => {
      expect(WorkflowExecutionStatus.PENDING).toBe('pending');
      expect(WorkflowExecutionStatus.RUNNING).toBe('running');
      expect(WorkflowExecutionStatus.PAUSED).toBe('paused');
      expect(WorkflowExecutionStatus.COMPLETED).toBe('completed');
      expect(WorkflowExecutionStatus.FAILED).toBe('failed');
      expect(WorkflowExecutionStatus.CANCELLED).toBe('cancelled');
    });
  });

  describe('EdgeConditionType enum', () => {
    it('should have correct type values', () => {
      expect(EdgeConditionType.ALWAYS).toBe('always');
      expect(EdgeConditionType.ON_SUCCESS).toBe('on_success');
      expect(EdgeConditionType.ON_FAILURE).toBe('on_failure');
      expect(EdgeConditionType.ON_COMPLETE).toBe('on_complete');
      expect(EdgeConditionType.EXPRESSION).toBe('expression');
    });
  });

  describe('DEFAULT_WORKFLOW_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_WORKFLOW_CONFIG.enableParallel).toBe(true);
      expect(DEFAULT_WORKFLOW_CONFIG.maxParallelNodes).toBe(10);
      expect(DEFAULT_WORKFLOW_CONFIG.defaultTimeout).toBe(3600000);
      expect(DEFAULT_WORKFLOW_CONFIG.autoRetry).toBe(false);
      expect(DEFAULT_WORKFLOW_CONFIG.enableTracking).toBe(true);
      expect(DEFAULT_WORKFLOW_CONFIG.enableRecovery).toBe(true);
      expect(DEFAULT_WORKFLOW_CONFIG.errorStrategy).toBe('fail-fast');
    });
  });

  describe('createWorkflow', () => {
    it('should create workflow with required fields', () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      expect(workflow.name).toBe('TestWorkflow');
      expect(workflow.version).toBe('1.0.0');
    });

    it('should set default status to DRAFT', () => {
      const workflow = createWorkflow('TestWorkflow');
      expect(workflow.status).toBe(WorkflowStatus.DRAFT);
    });

    it('should initialize empty nodes and edges', () => {
      const workflow = createWorkflow('TestWorkflow');
      expect(workflow.nodes).toEqual([]);
      expect(workflow.edges).toEqual([]);
    });

    it('should apply default config', () => {
      const workflow = createWorkflow('TestWorkflow');
      expect(workflow.config.enableParallel).toBe(true);
    });

    it('should accept custom config', () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0', {
        config: { maxParallelNodes: 20 },
      });
      expect(workflow.config.maxParallelNodes).toBe(20);
    });

    it('should set timestamps', () => {
      const before = Date.now();
      const workflow = createWorkflow('TestWorkflow');
      const after = Date.now();
      expect(workflow.createdAt).toBeGreaterThanOrEqual(before);
      expect(workflow.createdAt).toBeLessThanOrEqual(after);
      expect(workflow.updatedAt).toBeGreaterThanOrEqual(before);
      expect(workflow.updatedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('createWorkflowEdge', () => {
    it('should create edge with source and target', () => {
      const edge = createWorkflowEdge('node-1', 'node-2');
      expect(edge.source).toBe('node-1');
      expect(edge.target).toBe('node-2');
    });

    it('should set default ID', () => {
      const edge = createWorkflowEdge('node-1', 'node-2');
      expect(edge.id).toMatch(/^edge_/);
    });
  });

  describe('createSimpleEdge', () => {
    it('should create edge with ALWAYS condition', () => {
      const edge = createSimpleEdge('node-1', 'node-2');
      expect(edge.condition?.type).toBe(EdgeConditionType.ALWAYS);
    });

    it('should accept label', () => {
      const edge = createSimpleEdge('node-1', 'node-2', 'Next Step');
      expect(edge.label).toBe('Next Step');
    });
  });

  describe('createSuccessEdge', () => {
    it('should create edge with ON_SUCCESS condition', () => {
      const edge = createSuccessEdge('node-1', 'node-2');
      expect(edge.condition?.type).toBe(EdgeConditionType.ON_SUCCESS);
    });
  });

  describe('createFailureEdge', () => {
    it('should create edge with ON_FAILURE condition', () => {
      const edge = createFailureEdge('node-1', 'node-2');
      expect(edge.condition?.type).toBe(EdgeConditionType.ON_FAILURE);
    });
  });

  describe('createWorkflowExecution', () => {
    it('should create execution with required fields', () => {
      const execution = createWorkflowExecution('wf-1');
      expect(execution.workflowId).toBe('wf-1');
    });

    it('should set initial status to PENDING', () => {
      const execution = createWorkflowExecution('wf-1');
      expect(execution.status).toBe(WorkflowExecutionStatus.PENDING);
    });

    it('should initialize arrays', () => {
      const execution = createWorkflowExecution('wf-1');
      expect(execution.currentNodeIds).toEqual([]);
      expect(execution.completedNodeIds).toEqual([]);
      expect(execution.failedNodeIds).toEqual([]);
      expect(execution.skippedNodeIds).toEqual([]);
    });

    it('should initialize context with input', () => {
      const execution = createWorkflowExecution('wf-1', { key: 'value' });
      expect(execution.context).toEqual({ key: 'value' });
    });
  });

  describe('createWorkflowSnapshot', () => {
    it('should create snapshot from execution', () => {
      const execution = createWorkflowExecution('wf-1');
      const snapshot = createWorkflowSnapshot(execution);
      expect(snapshot.executionId).toBe(execution.id);
    });
  });

  describe('updateWorkflowExecution', () => {
    it('should update execution fields', () => {
      const execution = createWorkflowExecution('wf-1');
      const updated = updateWorkflowExecution(execution, {
        status: WorkflowExecutionStatus.COMPLETED,
      });
      expect(updated.status).toBe(WorkflowExecutionStatus.COMPLETED);
    });
  });

  describe('isValidWorkflow', () => {
    it('should return true for valid workflow', () => {
      const workflow = createWorkflow('TestWorkflow');
      expect(isValidWorkflow(workflow)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidWorkflow(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidWorkflow('string')).toBe(false);
    });

    it('should return false for missing id', () => {
      const wf = { name: 'Test', version: '1.0.0', status: WorkflowStatus.DRAFT, nodes: [], edges: [] };
      expect(isValidWorkflow(wf)).toBe(false);
    });
  });

  describe('getEntryNode', () => {
    it('should return entry node by ID', () => {
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('Test', '1.0.0', {
        config: {},
      });
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;

      const entry = getEntryNode(workflow);
      expect(entry?.id).toBe(startNode.id);
    });

    it('should find start node if no entryNodeId', () => {
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('Test', '1.0.0', {
        config: {},
      });
      workflow.nodes = [startNode];

      const entry = getEntryNode(workflow);
      expect(entry?.id).toBe(startNode.id);
    });
  });

  describe('getExitNodes', () => {
    it('should return exit nodes by IDs', () => {
      const endNode = createTask('end', TaskType.END);
      const workflow = createWorkflow('Test', '1.0.0', {
        config: {},
      });
      workflow.nodes = [endNode];
      workflow.exitNodeIds = [endNode.id];

      const exits = getExitNodes(workflow);
      expect(exits).toHaveLength(1);
      expect(exits[0].id).toBe(endNode.id);
    });
  });

  describe('getOutgoingEdges', () => {
    it('should return edges from source node', () => {
      const edge = createSimpleEdge('node-1', 'node-2');
      const workflow = createWorkflow('Test', '1.0.0', {
        config: {},
      });
      workflow.edges = [edge];

      const outgoing = getOutgoingEdges(workflow, 'node-1');
      expect(outgoing).toHaveLength(1);
      expect(outgoing[0].target).toBe('node-2');
    });
  });

  describe('getIncomingEdges', () => {
    it('should return edges to target node', () => {
      const edge = createSimpleEdge('node-1', 'node-2');
      const workflow = createWorkflow('Test', '1.0.0', {
        config: {},
      });
      workflow.edges = [edge];

      const incoming = getIncomingEdges(workflow, 'node-2');
      expect(incoming).toHaveLength(1);
      expect(incoming[0].source).toBe('node-1');
    });
  });

  describe('isValidDAG', () => {
    it('should return valid for acyclic workflow', () => {
      const task1 = createTask('task1', TaskType.TASK);
      const task2 = createTask('task2', TaskType.TASK);
      const workflow = createWorkflow('Test', '1.0.0', { config: {} });
      workflow.nodes = [task1, task2];
      workflow.edges = [createSimpleEdge(task1.id, task2.id)];

      const result = isValidDAG(workflow);
      expect(result.valid).toBe(true);
    });

    it('should detect cycle', () => {
      const task1 = createTask('task1', TaskType.TASK);
      const task2 = createTask('task2', TaskType.TASK);
      const workflow = createWorkflow('Test', '1.0.0', { config: {} });
      workflow.nodes = [task1, task2];
      workflow.edges = [
        createSimpleEdge(task1.id, task2.id),
        createSimpleEdge(task2.id, task1.id),
      ];

      const result = isValidDAG(workflow);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cycle detected');
    });
  });

  describe('getTopologicalOrder', () => {
    it('should return topological order', () => {
      const task1 = createTask('task1', TaskType.TASK);
      const task2 = createTask('task2', TaskType.TASK);
      const workflow = createWorkflow('Test', '1.0.0', { config: {} });
      workflow.nodes = [task1, task2];
      workflow.edges = [createSimpleEdge(task1.id, task2.id)];

      const order = getTopologicalOrder(workflow);
      expect(order).toContain(task1.id);
      expect(order).toContain(task2.id);
      expect(order.indexOf(task1.id)).toBeLessThan(order.indexOf(task2.id));
    });
  });
});
