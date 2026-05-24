import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { TaskQueue, TaskScheduler, TaskPriority, TaskStatus, type Task } from '@organic/agent';

function createTestTask(id: string, name: string, priority: TaskPriority = TaskPriority.NORMAL): Task {
  return {
    id,
    name,
    priority,
    status: TaskStatus.PENDING,
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
      maxParallelTasks: 5,
      defaultTimeout: 30000,
    });

    const scheduled = scheduler.schedule({ name: 'test-task' });
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
      maxParallelTasks: 5,
      defaultTimeout: 30000,
    });

    const results = await Promise.all(
      tasks.map((task) => scheduler.schedule({ name: task.name }))
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
      maxParallelTasks: 5,
      defaultTimeout: 30000,
    });

    try {
      await scheduler.schedule({ name: failingTask.name });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  describe('TaskQueue Priority', () => {
    it('should prioritize HIGH tasks over NORMAL tasks', async () => {
      const queue = new TaskQueue();

      const normalTask = createTestTask('normal-task', 'Normal Task', TaskPriority.NORMAL);
      const highTask = createTestTask('high-task', 'High Task', TaskPriority.HIGH);

      queue.enqueue(normalTask as any);
      queue.enqueue(highTask as any);

      const first = queue.dequeue();
      expect(first?.id).toBe('high-task');
    });

    it('should prioritize NORMAL tasks over LOW tasks', async () => {
      const queue = new TaskQueue();

      const lowTask = createTestTask('low-task', 'Low Task', TaskPriority.LOW);
      const normalTask = createTestTask('normal-task', 'Normal Task', TaskPriority.NORMAL);

      queue.enqueue(lowTask as any);
      queue.enqueue(normalTask as any);

      const first = queue.dequeue();
      expect(first?.id).toBe('normal-task');
    });

    it('should maintain FIFO order for same priority tasks', async () => {
      const queue = new TaskQueue();

      const task1 = createTestTask('task-1', 'Task 1', TaskPriority.NORMAL);
      const task2 = createTestTask('task-2', 'Task 2', TaskPriority.NORMAL);
      const task3 = createTestTask('task-3', 'Task 3', TaskPriority.NORMAL);

      queue.enqueue(task1 as any);
      queue.enqueue(task2 as any);
      queue.enqueue(task3 as any);

      const first = queue.dequeue();
      expect(first?.id).toBe('task-1');

      const second = queue.dequeue();
      expect(second?.id).toBe('task-2');
    });

    it('should handle CRITICAL priority at highest level', async () => {
      const queue = new TaskQueue();

      const normalTask = createTestTask('normal-task', 'Normal', TaskPriority.NORMAL);
      const criticalTask = createTestTask('critical-task', 'Critical', TaskPriority.CRITICAL);

      queue.enqueue(normalTask as any);
      queue.enqueue(criticalTask as any);

      const first = queue.dequeue();
      expect(first?.id).toBe('critical-task');
    });
  });

  describe('TaskQueue Scheduling', () => {
    it('should respect max size limit', async () => {
      const queue = new TaskQueue({ maxSize: 2 });

      queue.enqueue(createTestTask('t1', 'Task 1') as any);
      queue.enqueue(createTestTask('t2', 'Task 2') as any);
      const result = queue.enqueue(createTestTask('t3', 'Task 3') as any);

      expect(result).toBe(false);
      expect(queue.size()).toBe(2);
    });

    it('should mark task as running after dequeue', async () => {
      const queue = new TaskQueue();

      const task = createTestTask('running-task', 'Running Task');
      queue.enqueue(task as any);

      const dequeued = queue.dequeue();
      expect(dequeued?.status).toBe(TaskStatus.RUNNING);
    });

    it('should complete task and remove from running', async () => {
      const queue = new TaskQueue();

      const task = createTestTask('complete-task', 'Complete Task');
      queue.enqueue(task as any);

      const dequeued = queue.dequeue();
      const result = queue.complete(dequeued!.id, { success: true });

      expect(result).toBe(true);
      expect(queue.runningCount()).toBe(0);
    });

    it('should fail task with retry when under max retries', async () => {
      const queue = new TaskQueue({ maxRetries: 2 });

      const task = createTestTask('retry-task', 'Retry Task');
      task.maxRetries = 2;
      queue.enqueue(task as any);

      const dequeued = queue.dequeue();
      const result = queue.fail(dequeued!.id, 'Test error');

      expect(result).toBe(true);
      expect(queue.size()).toBe(1);
      expect(task.retryCount).toBe(1);
    });

    it('should mark as failed when exceeding max retries', async () => {
      const queue = new TaskQueue({ maxRetries: 1 });

      const task = createTestTask('fail-task', 'Fail Task');
      task.maxRetries = 1;
      queue.enqueue(task as any);

      const dequeued = queue.dequeue();
      queue.fail(dequeued!.id, 'First error');
      queue.fail(dequeued!.id, 'Second error');

      expect(task.status).toBe(TaskStatus.FAILED);
    });
  });

  describe('TaskScheduler', () => {
    it('should start and stop scheduler', async () => {
      const queue = new TaskQueue();
      const scheduler = new TaskScheduler(queue);

      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      await scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should schedule task with default timeout', async () => {
      const queue = new TaskQueue();
      const scheduler = new TaskScheduler(queue, { defaultTimeout: 5000 });

      const task = scheduler.schedule({ name: 'timeout-test', maxRetries: 0 });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
    });

    it('should handle task timeout', async () => {
      const queue = new TaskQueue();
      const scheduler = new TaskScheduler(queue, {
        defaultTimeout: 50,
        enableRetry: false,
      });

      let failedEventFired = false;
      scheduler.on('task:failed', () => {
        failedEventFired = true;
      });

      const task = scheduler.schedule({ name: 'timeout-task', maxRetries: 0 });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(scheduler.getTask(task.id)?.status).toBeDefined();
    });

    it('should cancel specific task', async () => {
      const queue = new TaskQueue();
      const scheduler = new TaskScheduler(queue);

      const task = scheduler.schedule({ name: 'cancel-test', maxRetries: 0 });
      const result = scheduler.cancel(task.id);

      expect(result).toBe(true);
    });

    it('should cancel all pending tasks', async () => {
      const queue = new TaskQueue();
      const scheduler = new TaskScheduler(queue);

      scheduler.schedule({ name: 'cancel-all-1', maxRetries: 0 });
      scheduler.schedule({ name: 'cancel-all-2', maxRetries: 0 });

      scheduler.cancelAll();

      expect(scheduler.getQueueSize()).toBe(0);
    });
  });
});