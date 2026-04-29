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
  });

  describe('cancelExecution', () => {
    it('should return false for non-existent execution', () => {
      const result = executor.cancelExecution('non-existent');
      expect(result).toBe(false);
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
  });

  describe('isIdle', () => {
    it('should return true when idle', () => {
      expect(executor.isIdle()).toBe(true);
    });
  });
});
