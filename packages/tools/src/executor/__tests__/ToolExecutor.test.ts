import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolExecutor } from '../ToolExecutor.js';
import type { Tool, ToolResult, ToolExecutionContext, ToolDefinition } from '../../types/index.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const createMockTool = (id: string = 'mock-tool'): Tool => ({
  getDefinition: () => ({
    id,
    name: 'MockTool',
    description: 'Mock tool for testing',
    category: 'custom',
    inputSchema: { type: 'object' },
    enabled: true,
    timeout: 5000,
  }),
  validate: () => [],
  execute: vi.fn().mockResolvedValue({
    success: true,
    data: { result: 'mocked' },
    executionTime: 10,
  } as ToolResult),
});

const createMockContext = (): ToolExecutionContext => ({
  toolId: 'mock-tool',
  executionId: 'exec-1',
  workingDirectory: '/tmp',
  environment: {},
  cancelled: false,
  permissionLevel: 'L2',
  metadata: {},
});

describe('ToolExecutor', () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    executor = new ToolExecutor();
  });

  describe('constructor', () => {
    it('should create executor with default config', () => {
      expect(executor).toBeDefined();
    });

    it('should accept custom config', () => {
      const customExecutor = new ToolExecutor({
        maxConcurrent: 10,
        maxQueueSize: 200,
      });
      expect(customExecutor).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start the executor', () => {
      executor.start();
      expect(executor).toBeDefined();
    });

    it('should stop the executor', async () => {
      executor.start();
      await executor.stop();
      expect(executor).toBeDefined();
    });

    it('should not throw when start is called while already running', () => {
      executor.start();
      expect(() => executor.start()).not.toThrow();
    });

    it('should not throw when stop is called when not running', async () => {
      await expect(executor.stop()).resolves.not.toThrow();
    });

    it('should wait for active executions to complete on stop', async () => {
      const limitedExecutor = new ToolExecutor({ maxConcurrent: 1 });
      limitedExecutor.start();

      const tool = createMockTool();
      const context = createMockContext();

      let resolveExecution: (value: unknown) => void;
      const executionPromise = new Promise((resolve) => {
        resolveExecution = resolve;
      });

      (tool.execute as ReturnType<typeof vi.fn>).mockImplementation(() => executionPromise);

      // Start an execution that will hang
      const executePromise = limitedExecutor.execute(tool, { input: 'test' }, context);

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Stop should wait for the active execution
      const stopPromise = limitedExecutor.stop();

      // Resolve the execution after a short delay
      setTimeout(() => resolveExecution!({ success: true, data: {}, executionTime: 10 }), 50);

      await Promise.all([executePromise, stopPromise]);
    });
  });

  describe('execute', () => {
    it('should execute tool directly when capacity available', async () => {
      executor.start();
      const tool = createMockTool();
      const context = createMockContext();
      const result = await executor.execute(tool, { input: 'test' }, context);

      expect(result.success).toBe(true);
    });

    it('should queue execution when at capacity', async () => {
      const limitedExecutor = new ToolExecutor({ maxConcurrent: 1 });
      limitedExecutor.start();

      const tool1 = createMockTool('tool-1');
      const tool2 = createMockTool('tool-2');
      const context = createMockContext();

      const mockExecute = tool1.execute as ReturnType<typeof vi.fn>;
      mockExecute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { success: true, data: {}, executionTime: 50 };
      });

      await limitedExecutor.execute(tool1, { input: 'test' }, context);
      const result = await limitedExecutor.execute(tool2, { input: 'test' }, context);

      expect(result.success).toBe(true);
      await limitedExecutor.stop();
    });

    it('should return queue full error when queue is at maximum size', async () => {
      const limitedExecutor = new ToolExecutor({
        maxConcurrent: 1,
        maxQueueSize: 1, // Allow only 1 item in queue
      });
      limitedExecutor.start();

      const tool1 = createMockTool('tool-1');
      const tool2 = createMockTool('tool-2');
      const tool3 = createMockTool('tool-3');
      const context = createMockContext();

      // Make first tool run slowly to occupy the slot
      const mockExecute = tool1.execute as ReturnType<typeof vi.fn>;
      mockExecute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { success: true, data: {}, executionTime: 200 };
      });

      // Start first execution (takes concurrent slot)
      limitedExecutor.execute(tool1, { input: 'test' }, context);

      // Wait for it to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Queue second execution (fills the queue)
      const queuePromise = limitedExecutor.execute(tool2, { input: 'test' }, { ...context, executionId: 'exec-2' });

      // Wait for queuing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Try third execution - should fail with queue full
      const result = await limitedExecutor.execute(tool3, { input: 'test' }, { ...context, executionId: 'exec-3' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution queue is full');

      // Cleanup
      await queuePromise.catch(() => {}); // Handle potential rejection from stop()
      await limitedExecutor.stop();
    });

    it('should emit execution:started event', async () => {
      executor.start();
      const handler = vi.fn();
      executor.on('execution:started', handler);

      const tool = createMockTool();
      const context = createMockContext();
      await executor.execute(tool, { input: 'test' }, context);

      expect(handler).toHaveBeenCalled();
    });

    it('should emit execution:completed event', async () => {
      executor.start();
      const handler = vi.fn();
      executor.on('execution:completed', handler);

      const tool = createMockTool();
      const context = createMockContext();
      await executor.execute(tool, { input: 'test' }, context);

      expect(handler).toHaveBeenCalled();
    });

    it('should emit execution:failed event when tool throws error', async () => {
      executor.start();
      const handler = vi.fn();
      executor.on('execution:failed', handler);

      const tool = createMockTool();
      (tool.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Test error'));

      const context = createMockContext();
      const result = await executor.execute(tool, { input: 'test' }, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          toolId: 'mock-tool',
          error: 'Test error',
        })
      );
    });

    it('should emit execution:queued event when queued', async () => {
      const limitedExecutor = new ToolExecutor({ maxConcurrent: 1 });
      limitedExecutor.start();

      const handler = vi.fn();
      limitedExecutor.on('execution:queued', handler);

      const tool1 = createMockTool('tool-1');
      const tool2 = createMockTool('tool-2');
      const context = createMockContext();

      const mockExecute = tool1.execute as ReturnType<typeof vi.fn>;
      mockExecute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true, data: {}, executionTime: 100 };
      });

      // First execution takes the slot
      limitedExecutor.execute(tool1, { input: 'test' }, context);

      // Wait for it to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second execution should be queued
      const queuePromise = limitedExecutor.execute(tool2, { input: 'test' }, context);

      // Wait for queue event
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          toolId: 'tool-2',
          queueLength: expect.any(Number),
        })
      );

      await queuePromise;
      await limitedExecutor.stop();
    });

    it('should emit queue:full event when queue reaches limit', async () => {
      const limitedExecutor = new ToolExecutor({
        maxConcurrent: 1,
        maxQueueSize: 1, // Allow only 1 item in queue
      });
      limitedExecutor.start();

      const handler = vi.fn();
      limitedExecutor.on('queue:full', handler);

      const tool1 = createMockTool('tool-1');
      const tool2 = createMockTool('tool-2');
      const tool3 = createMockTool('tool-3');
      const context = createMockContext();

      const mockExecute = tool1.execute as ReturnType<typeof vi.fn>;
      mockExecute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { success: true, data: {}, executionTime: 200 };
      });

      // Start first execution
      limitedExecutor.execute(tool1, { input: 'test' }, context);

      // Wait for it to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Queue second execution (fills the queue)
      const queuePromise = limitedExecutor.execute(tool2, { input: 'test' }, { ...context, executionId: 'exec-2' });

      // Wait for queuing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Try to add third - should trigger queue:full
      await limitedExecutor.execute(tool3, { input: 'test' }, { ...context, executionId: 'exec-3' });

      expect(handler).toHaveBeenCalled();

      // Cleanup
      await queuePromise.catch(() => {});
      await limitedExecutor.stop();
    });

    it('should handle timeout and return error', async () => {
      executor.start();

      const tool = createMockTool();
      (tool.execute as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ success: true, data: {}, executionTime: 100000 });
            }, 10000);
          })
      );

      const context = createMockContext();
      const result = await executor.execute(
        tool,
        { input: 'test' },
        context,
        { timeout: 10 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should process high priority requests first', async () => {
      const limitedExecutor = new ToolExecutor({ maxConcurrent: 1 });
      limitedExecutor.start();

      const tool1 = createMockTool('tool-1');
      const tool2 = createMockTool('tool-2');
      const tool3 = createMockTool('tool-3');

      const executionOrder: string[] = [];

      (tool1.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        executionOrder.push('tool-1');
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { success: true, data: {}, executionTime: 50 };
      });

      (tool2.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        executionOrder.push('tool-2');
        return { success: true, data: {}, executionTime: 10 };
      });

      (tool3.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        executionOrder.push('tool-3');
        return { success: true, data: {}, executionTime: 10 };
      });

      const context1: ToolExecutionContext = {
        ...createMockContext(),
        executionId: 'exec-1',
        metadata: { priority: 1 },
      };

      const context2: ToolExecutionContext = {
        ...createMockContext(),
        executionId: 'exec-2',
        metadata: { priority: 10 }, // High priority
      };

      const context3: ToolExecutionContext = {
        ...createMockContext(),
        executionId: 'exec-3',
        metadata: { priority: 5 },
      };

      // Start first execution (takes the slot)
      await limitedExecutor.execute(tool1, { input: 'test' }, context1);

      // Queue second and third (tool2 has higher priority)
      const promise2 = limitedExecutor.execute(tool2, { input: 'test' }, context2);
      const promise3 = limitedExecutor.execute(tool3, { input: 'test' }, context3);

      // Wait for all to complete
      await Promise.all([promise2, promise3]);

      // tool2 should execute before tool3 due to higher priority
      expect(executionOrder.indexOf('tool-2')).toBeLessThan(executionOrder.indexOf('tool-3'));

      await limitedExecutor.stop();
    });
  });

  describe('cancelExecution', () => {
    it('should return false for non-existent execution', () => {
      const result = executor.cancelExecution('non-existent');
      expect(result).toBe(false);
    });

    it('should return true and mark execution as cancelled for active execution', async () => {
      executor.start();

      const tool = createMockTool();
      const context = createMockContext();

      let resolveExecution: (value: unknown) => void;
      const executionPromise = new Promise((resolve) => {
        resolveExecution = resolve;
      });

      (tool.execute as ReturnType<typeof vi.fn>).mockImplementation(() => executionPromise);

      // Start execution
      const executePromise = executor.execute(tool, { input: 'test' }, context);

      // Wait for it to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Cancel the execution
      const cancelResult = executor.cancelExecution(context.executionId);
      expect(cancelResult).toBe(true);
      expect(context.cancelled).toBe(true);

      // Resolve and cleanup
      resolveExecution!({ success: true, data: {}, executionTime: 10 });
      await executePromise;
    });

    it('should emit execution:cancelled event on successful cancellation', async () => {
      executor.start();

      const tool = createMockTool();
      const context = createMockContext();

      const handler = vi.fn();
      executor.on('execution:cancelled', handler);

      let resolveExecution: (value: unknown) => void;
      const executionPromise = new Promise((resolve) => {
        resolveExecution = resolve;
      });

      (tool.execute as ReturnType<typeof vi.fn>).mockImplementation(() => executionPromise);

      // Start execution
      const executePromise = executor.execute(tool, { input: 'test' }, context);

      // Wait for it to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Cancel the execution
      executor.cancelExecution(context.executionId);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          toolId: 'mock-tool',
          executionId: context.executionId,
        })
      );

      // Resolve and cleanup
      resolveExecution!({ success: true, data: {}, executionTime: 10 });
      await executePromise;
    });
  });

  describe('getStatus', () => {
    it('should return executor status', () => {
      const status = executor.getStatus();
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('activeExecutions');
      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('maxConcurrent');
    });

    it('should include correct values in status', async () => {
      executor.start();

      const tool = createMockTool();
      const context = createMockContext();

      let resolveExecution: (value: unknown) => void;
      const executionPromise = new Promise((resolve) => {
        resolveExecution = resolve;
      });

      (tool.execute as ReturnType<typeof vi.fn>).mockImplementation(() => executionPromise);

      // Start execution
      executor.execute(tool, { input: 'test' }, context);

      // Wait for it to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      const status = executor.getStatus();
      expect(status.running).toBe(true);
      expect(status.activeExecutions).toBe(1);
      expect(status.queueLength).toBe(0);
      expect(status.maxConcurrent).toBe(5); // Default value

      // Cleanup
      resolveExecution!({ success: true, data: {}, executionTime: 10 });
      await executionPromise;
    });
  });

  describe('isIdle', () => {
    it('should return true when idle', () => {
      expect(executor.isIdle()).toBe(true);
    });

    it('should return false when there are active executions', async () => {
      executor.start();

      const tool = createMockTool();
      const context = createMockContext();

      let resolveExecution: (value: unknown) => void;
      const executionPromise = new Promise((resolve) => {
        resolveExecution = resolve;
      });

      (tool.execute as ReturnType<typeof vi.fn>).mockImplementation(() => executionPromise);

      // Start execution
      executor.execute(tool, { input: 'test' }, context);

      // Wait for it to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(executor.isIdle()).toBe(false);

      // Cleanup
      resolveExecution!({ success: true, data: {}, executionTime: 10 });
      await executionPromise;
    });

    it('should return false when there are items in queue', async () => {
      const limitedExecutor = new ToolExecutor({ maxConcurrent: 1 });
      limitedExecutor.start();

      const tool1 = createMockTool('tool-1');
      const tool2 = createMockTool('tool-2');
      const context = createMockContext();

      const mockExecute = tool1.execute as ReturnType<typeof vi.fn>;
      mockExecute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true, data: {}, executionTime: 100 };
      });

      // Start first execution (takes slot)
      limitedExecutor.execute(tool1, { input: 'test' }, context);

      // Wait for it to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Queue second execution
      const queuePromise = limitedExecutor.execute(tool2, { input: 'test' }, { ...context, executionId: 'exec-2' });

      // Wait for queuing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(limitedExecutor.isIdle()).toBe(false);

      // Cleanup - catch the rejection from stop()
      await queuePromise.catch(() => {});
      await limitedExecutor.stop();
    });
  });

  describe('sandbox environment filtering', () => {
    it('should filter sensitive environment variables when sandbox enabled', async () => {
      const sandboxExecutor = new ToolExecutor({
        enableSandbox: true,
        sandboxConfig: { enabled: true },
      });
      sandboxExecutor.start();

      const tool = createMockTool();
      const originalEnv = {
        API_KEY: 'secret-key',
        SECRET_TOKEN: 'token123',
        SAFE_VAR: 'safe-value',
        PASSWORD: 'password123',
        NORMAL_VAR: 'normal',
      };

      let capturedContext: ToolExecutionContext | undefined;

      (tool.execute as ReturnType<typeof vi.fn>).mockImplementation(
        async (_input: unknown, context: ToolExecutionContext) => {
          capturedContext = context;
          return { success: true, data: {}, executionTime: 10 };
        }
      );

      const context: ToolExecutionContext = {
        ...createMockContext(),
        environment: originalEnv,
      };

      await sandboxExecutor.execute(tool, { input: 'test' }, context);

      // Sensitive vars should be filtered
      expect(capturedContext!.environment.API_KEY).toBeUndefined();
      expect(capturedContext!.environment.SECRET_TOKEN).toBeUndefined();
      expect(capturedContext!.environment.PASSWORD).toBeUndefined();

      // Safe vars should remain
      expect(capturedContext!.environment.SAFE_VAR).toBe('safe-value');
      expect(capturedContext!.environment.NORMAL_VAR).toBe('normal');

      await sandboxExecutor.stop();
    });

    it('should filter PRIVATE_KEY environment variable', async () => {
      const sandboxExecutor = new ToolExecutor({
        enableSandbox: true,
        sandboxConfig: { enabled: true },
      });
      sandboxExecutor.start();

      const tool = createMockTool();
      let capturedContext: ToolExecutionContext | undefined;

      (tool.execute as ReturnType<typeof vi.fn>).mockImplementation(
        async (_input: unknown, context: ToolExecutionContext) => {
          capturedContext = context;
          return { success: true, data: {}, executionTime: 10 };
        }
      );

      const context: ToolExecutionContext = {
        ...createMockContext(),
        environment: {
          MY_PRIVATE_KEY: 'private-key-value',
          SAFE_VAR: 'safe',
        },
      };

      await sandboxExecutor.execute(tool, { input: 'test' }, context);

      expect(capturedContext!.environment.MY_PRIVATE_KEY).toBeUndefined();
      expect(capturedContext!.environment.SAFE_VAR).toBe('safe');

      await sandboxExecutor.stop();
    });
  });

  describe('permission level downgrade', () => {
    it('should downgrade L4 permission to L3 in sandbox', async () => {
      const sandboxExecutor = new ToolExecutor({
        enableSandbox: true,
        sandboxConfig: { enabled: true },
      });
      sandboxExecutor.start();

      const tool = createMockTool();
      let capturedContext: ToolExecutionContext | undefined;

      (tool.execute as ReturnType<typeof vi.fn>).mockImplementation(
        async (_input: unknown, context: ToolExecutionContext) => {
          capturedContext = context;
          return { success: true, data: {}, executionTime: 10 };
        }
      );

      const context: ToolExecutionContext = {
        ...createMockContext(),
        permissionLevel: 'L4',
      };

      await sandboxExecutor.execute(tool, { input: 'test' }, context);

      expect(capturedContext!.permissionLevel).toBe('L3');

      await sandboxExecutor.stop();
    });

    it('should keep L2 permission unchanged in sandbox', async () => {
      const sandboxExecutor = new ToolExecutor({
        enableSandbox: true,
        sandboxConfig: { enabled: true },
      });
      sandboxExecutor.start();

      const tool = createMockTool();
      let capturedContext: ToolExecutionContext | undefined;

      (tool.execute as ReturnType<typeof vi.fn>).mockImplementation(
        async (_input: unknown, context: ToolExecutionContext) => {
          capturedContext = context;
          return { success: true, data: {}, executionTime: 10 };
        }
      );

      const context: ToolExecutionContext = {
        ...createMockContext(),
        permissionLevel: 'L2',
      };

      await sandboxExecutor.execute(tool, { input: 'test' }, context);

      expect(capturedContext!.permissionLevel).toBe('L2');

      await sandboxExecutor.stop();
    });
  });
});
