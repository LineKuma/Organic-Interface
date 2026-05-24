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
});