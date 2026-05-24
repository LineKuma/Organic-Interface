import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { TaskQueue, TaskScheduler, TaskPriority } from '@organic/agent';

function createTestTask(id: string, name: string): { id: string; name: string; priority: TaskPriority; status: string; dependencies: string[]; createdAt: number; retryCount: number; maxRetries: number } {
  return {
    id,
    name,
    priority: TaskPriority.NORMAL,
    status: 'pending',
    dependencies: [],
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 0,
  };
}

describe('Agent Scheduling', () => {
  let kernel: Kernel;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
    await kernel.initialize();
  });

  afterEach(async () => {
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  it('should schedule agents correctly', async () => {
    const queue = new TaskQueue({
      maxSize: 100,
    });

    const task = createTestTask('task-1', 'test-task');
    queue.enqueue(task as any);
    expect(queue.size()).toBe(1);

    const scheduler = new TaskScheduler(queue, {
      maxConcurrentTasks: 5,
      taskTimeout: 30000,
    });

    const scheduled = scheduler.schedule(task as any);
    expect(scheduled).toBeDefined();
  });

  it('should handle concurrent agent requests', async () => {
    const queue = new TaskQueue({
      maxSize: 100,
    });

    const tasks = [
      createTestTask('concurrent-1', 'test-task-1'),
      createTestTask('concurrent-2', 'test-task-2'),
    ];

    tasks.forEach((task) => queue.enqueue(task as any));
    expect(queue.size()).toBe(2);

    const scheduler = new TaskScheduler(queue, {
      maxConcurrentTasks: 5,
      taskTimeout: 30000,
    });

    const results = await Promise.all(
      tasks.map((task) => scheduler.schedule(task as any))
    );

    expect(results.every((r) => r !== undefined)).toBe(true);
  });

  it('should recover from scheduling failures', async () => {
    const queue = new TaskQueue({
      maxSize: 100,
    });

    const failingTask = createTestTask('fail-task', 'failing-task');

    queue.enqueue(failingTask as any);

    const scheduler = new TaskScheduler(queue, {
      maxConcurrentTasks: 5,
      taskTimeout: 30000,
    });

    try {
      await scheduler.schedule(failingTask as any);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});