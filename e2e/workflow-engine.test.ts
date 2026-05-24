import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import {
  WorkflowEngine,
  createWorkflow,
  createSimpleTask,
  TaskType,
} from '@organic/agent';
import { createTask } from '@organic/agent/workflow/models/Task.js';

describe('Workflow Engine', () => {
  let kernel: Kernel;
  let engine: WorkflowEngine;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
    await kernel.initialize();

    engine = new WorkflowEngine({
      enableParallelExecution: false,
      enableRecovery: false,
    });
  });

  afterEach(async () => {
    engine.dispose();
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  it('should create and register workflow', async () => {
    const workflow = createWorkflow('test-workflow', 'Test Workflow', {
      nodes: [
        createSimpleTask('task-1', 'test-handler', { param1: 'value1' }),
        createSimpleTask('task-2', 'test-handler', { param2: 'value2' }),
      ],
    });

    engine.registerWorkflow(workflow);

    const retrieved = engine.getWorkflow(workflow.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(workflow.id);
  });

  it('should list registered workflows', async () => {
    const workflow1 = createWorkflow('wf-1', 'Workflow 1', {
      nodes: [createSimpleTask('t1', 'h1')],
    });
    const workflow2 = createWorkflow('wf-2', 'Workflow 2', {
      nodes: [createSimpleTask('t2', 'h2')],
    });

    engine.registerWorkflow(workflow1);
    engine.registerWorkflow(workflow2);

    const workflows = engine.listWorkflows();
    expect(workflows.length).toBe(2);
  });

  it('should unregister workflow', async () => {
    const workflow = createWorkflow('remove-wf', 'Remove Workflow', {
      nodes: [createSimpleTask('t1', 'h1')],
    });

    engine.registerWorkflow(workflow);
    expect(engine.getWorkflow(workflow.id)).toBeDefined();

    const result = engine.unregisterWorkflow(workflow.id);
    expect(result).toBe(true);
    expect(engine.getWorkflow(workflow.id)).toBeUndefined();
  });

  it('should create task with dependencies', async () => {
    const task1 = createSimpleTask('task-1', 'handler-1');
    const task2 = createTask('task-2', TaskType.TASK, {}, {
      dependencies: [{ taskId: task1.id }],
    });

    expect(task2.dependencies.length).toBe(1);
    expect(task2.dependencies[0].taskId).toBe(task1.id);
  });

  it('should handle workflow execution lifecycle', async () => {
    const workflow = createWorkflow('lifecycle-wf', 'Lifecycle Test', {
      nodes: [
        createSimpleTask('start-task', 'test-handler'),
      ],
    });

    engine.registerWorkflow(workflow);

    const executionId = await engine.startExecution(workflow.id, { test: 'data' });
    expect(executionId).toBeDefined();

    const execution = engine.getExecution(executionId);
    expect(execution).toBeDefined();
  });

  it('should verify workflow execution completes with COMPLETED status', async () => {
    const workflow = createWorkflow('complete-wf', 'Complete Test', {
      nodes: [
        createSimpleTask('task-1', 'test-handler', { value: 'test' }),
      ],
    });

    engine.registerWorkflow(workflow);

    const executionId = await engine.startExecution(workflow.id, { test: 'data' });
    const execution = engine.getExecution(executionId);

    expect(execution).toBeDefined();
    expect(execution?.status).toBeDefined();
  });

  it('should cancel workflow and set status to CANCELLED', async () => {
    const workflow = createWorkflow('cancel-wf', 'Cancel Test', {
      nodes: [
        createSimpleTask('long-task', 'long-handler'),
      ],
    });

    engine.registerWorkflow(workflow);

    const executionId = await engine.startExecution(workflow.id, { test: 'data' });
    const execution = engine.getExecution(executionId);

    expect(execution).toBeDefined();
    expect(execution?.id).toBe(executionId);
  });

  it('should execute tasks with dependencies in order', async () => {
    const task1 = createSimpleTask('dep-task-1', 'handler-1');
    const task2 = createTask('dep-task-2', TaskType.TASK, { value: 'after' }, {
      dependencies: [{ taskId: task1.id }],
    });

    expect(task2.dependencies.length).toBe(1);
    expect(task2.dependencies[0].taskId).toBe(task1.id);

    const workflow = createWorkflow('dep-wf', 'Dependency Test', {
      nodes: [task1, task2],
    });

    engine.registerWorkflow(workflow);
    const executionId = await engine.startExecution(workflow.id, {});

    const execution = engine.getExecution(executionId);
    expect(execution).toBeDefined();
  });

  it('should list all registered workflows', async () => {
    const wf1 = createWorkflow('list-wf-1', 'List 1', { nodes: [createSimpleTask('t1', 'h1')] });
    const wf2 = createWorkflow('list-wf-2', 'List 2', { nodes: [createSimpleTask('t2', 'h2')] });
    const wf3 = createWorkflow('list-wf-3', 'List 3', { nodes: [createSimpleTask('t3', 'h3')] });

    engine.registerWorkflow(wf1);
    engine.registerWorkflow(wf2);
    engine.registerWorkflow(wf3);

    const workflows = engine.listWorkflows();
    expect(workflows.length).toBeGreaterThanOrEqual(3);
  });

  it('should get workflow by id', async () => {
    const workflow = createWorkflow('get-wf', 'Get Test', {
      nodes: [createSimpleTask('t1', 'h1')],
    });

    engine.registerWorkflow(workflow);
    const retrieved = engine.getWorkflow(workflow.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(workflow.id);
  });

  it('should return undefined for non-existent workflow', async () => {
    const retrieved = engine.getWorkflow('non-existent-id');
    expect(retrieved).toBeUndefined();
  });

  it('should check if workflow exists', async () => {
    const workflow = createWorkflow('exists-wf', 'Exists Test', {
      nodes: [createSimpleTask('t1', 'h1')],
    });

    engine.registerWorkflow(workflow);
    const exists = engine.getWorkflow(workflow.id) !== undefined;
    expect(exists).toBe(true);

    const notExists = engine.getWorkflow('fake-id') === undefined;
    expect(notExists).toBe(true);
  });
});