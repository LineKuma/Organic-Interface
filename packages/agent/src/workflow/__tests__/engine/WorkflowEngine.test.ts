import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowEngine } from '../../engine/WorkflowEngine.js';
import { WorkflowStatus, createWorkflow, createSimpleEdge } from '../../models/Workflow.js';
import { TaskType, createTask } from '../../models/Task.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  describe('constructor', () => {
    it('should create engine with default config', () => {
      expect(engine).toBeDefined();
    });

    it('should accept custom config', () => {
      const customEngine = new WorkflowEngine({
        maxConcurrency: 5,
        enableParallelExecution: false,
      });
      expect(customEngine).toBeDefined();
    });
  });

  describe('registerWorkflow', () => {
    it('should register a workflow', () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      expect(engine.getWorkflow(workflow.id)).toBeDefined();
    });

    it('should emit workflow:registered event', () => {
      const handler = vi.fn();
      engine.on('workflow:registered', handler);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      expect(handler).toHaveBeenCalledWith(workflow);
    });
  });

  describe('getWorkflow', () => {
    it('should get registered workflow', () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const result = engine.getWorkflow(workflow.id);
      expect(result?.id).toBe(workflow.id);
    });

    it('should return undefined for non-existent workflow', () => {
      const result = engine.getWorkflow('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('unregisterWorkflow', () => {
    it('should unregister workflow', () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const result = engine.unregisterWorkflow(workflow.id);
      expect(result).toBe(true);
      expect(engine.getWorkflow(workflow.id)).toBeUndefined();
    });

    it('should emit workflow:unregistered event', () => {
      const handler = vi.fn();
      engine.on('workflow:unregistered', handler);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      engine.unregisterWorkflow(workflow.id);
      expect(handler).toHaveBeenCalledWith(workflow.id);
    });
  });

  describe('listWorkflows', () => {
    it('should list all workflows', () => {
      engine.registerWorkflow(createWorkflow('Workflow1', '1.0.0'));
      engine.registerWorkflow(createWorkflow('Workflow2', '1.0.0'));
      const workflows = engine.listWorkflows();
      expect(workflows).toHaveLength(2);
    });

    it('should return empty array when no workflows', () => {
      const workflows = engine.listWorkflows();
      expect(workflows).toEqual([]);
    });
  });

  describe('startExecution', () => {
    it('should throw error for non-existent workflow', async () => {
      await expect(engine.startExecution('non-existent')).rejects.toThrow('Workflow not found');
    });

    it('should create execution for valid workflow', async () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const executionId = await engine.startExecution(workflow.id);
      expect(executionId).toBeDefined();
      expect(executionId).toMatch(/^exec_/);
    });

    it('should emit execution:started event', async () => {
      const handler = vi.fn();
      engine.on('execution:started', handler);
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      await engine.startExecution(workflow.id);
      expect(handler).toHaveBeenCalled();
    });

    it('should set entry node as current', async () => {
      const startNode = createTask('start', TaskType.START);
      const workflow = createWorkflow('TestWorkflow', '1.0.0', { config: {} });
      workflow.nodes = [startNode];
      workflow.entryNodeId = startNode.id;
      engine.registerWorkflow(workflow);

      const executionId = await engine.startExecution(workflow.id);
      const execution = engine.getExecution(executionId);
      expect(execution?.currentNodeIds).toContain(startNode.id);
    });
  });

  describe('getExecution', () => {
    it('should get execution by ID', async () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const executionId = await engine.startExecution(workflow.id);
      const execution = engine.getExecution(executionId);
      expect(execution).toBeDefined();
      expect(execution?.workflowId).toBe(workflow.id);
    });

    it('should return undefined for non-existent execution', () => {
      const execution = engine.getExecution('non-existent');
      expect(execution).toBeUndefined();
    });
  });

  describe('pauseExecution', () => {
    it('should return false for non-existent execution', () => {
      const result = engine.pauseExecution('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('resumeExecution', () => {
    it('should return false for non-existent execution', async () => {
      const result = await engine.resumeExecution('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('cancelExecution', () => {
    it('should return false for non-existent execution', () => {
      const result = engine.cancelExecution('non-existent');
      expect(result).toBe(false);
    });

    it('should cancel running execution', async () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const executionId = await engine.startExecution(workflow.id);
      const result = engine.cancelExecution(executionId);
      expect(result).toBe(true);
    });
  });

  describe('getExecutionHistory', () => {
    it('should return executions for workflow', async () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      await engine.startExecution(workflow.id);
      await engine.startExecution(workflow.id);
      const history = engine.getExecutionHistory(workflow.id);
      expect(history).toHaveLength(2);
    });

    it('should return empty array for workflow with no executions', () => {
      const workflow = createWorkflow('TestWorkflow', '1.0.0');
      engine.registerWorkflow(workflow);
      const history = engine.getExecutionHistory(workflow.id);
      expect(history).toEqual([]);
    });
  });

  describe('createSnapshot', () => {
    it('should return null for non-existent execution', () => {
      const snapshot = engine.createSnapshot('non-existent');
      expect(snapshot).toBeNull();
    });
  });

  describe('recoverFromSnapshot', () => {
    it('should return false for non-existent execution', async () => {
      const result = await engine.recoverFromSnapshot({
        id: 'snapshot-1',
        executionId: 'non-existent',
        data: {
          status: 'paused' as any,
          currentNodeIds: [],
          completedNodeIds: [],
          failedNodeIds: [],
          context: {},
        },
        createdAt: Date.now(),
      });
      expect(result).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should dispose the engine', () => {
      engine.registerWorkflow(createWorkflow('TestWorkflow', '1.0.0'));
      engine.dispose();
      expect(engine.listWorkflows()).toEqual([]);
    });
  });
});
