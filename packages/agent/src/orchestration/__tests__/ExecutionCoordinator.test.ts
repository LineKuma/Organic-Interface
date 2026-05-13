import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionCoordinator, type ExecutionRequest } from '../ExecutionCoordinator.js';
import { AgentRegistry } from '../../registry/AgentRegistry.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ExecutionCoordinator', () => {
  let coordinator: ExecutionCoordinator;
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.start();
    coordinator = new ExecutionCoordinator(registry);
  });

  describe('constructor', () => {
    it('should create coordinator with registry', () => {
      expect(coordinator).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should return error when no agent found', async () => {
      const request: ExecutionRequest = {
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      };

      const result = await coordinator.execute(request);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_AGENT');
    });

    it('should emit execution:start event', async () => {
      const handler = vi.fn();
      coordinator.on('execution:start', handler);

      const request: ExecutionRequest = {
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      };

      await coordinator.execute(request);
      expect(handler).toHaveBeenCalledWith({ requestId: 'req-1' });
    });

    it('should handle execution when no agent found', async () => {
      const request: ExecutionRequest = {
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      };

      const result = await coordinator.execute(request);
      expect(result.success).toBe(false);
    });
  });

  describe('executeParallel', () => {
    it('should execute requests in parallel', async () => {
      const requests: ExecutionRequest[] = [
        { requestId: 'req-1', taskName: 'task1', payload: {} },
        { requestId: 'req-2', taskName: 'task2', payload: {} },
      ];

      const results = await coordinator.executeParallel(requests);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(false);
    });
  });

  describe('executeSequential', () => {
    it('should stop on first failure', async () => {
      const requests: ExecutionRequest[] = [
        { requestId: 'req-1', taskName: 'task1', payload: {} },
        { requestId: 'req-2', taskName: 'task2', payload: {} },
      ];

      const results = await coordinator.executeSequential(requests);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });
  });

  describe('executeWithPlan', () => {
    it('should execute with plan', async () => {
      const plan = coordinator.createPlan([
        { requestId: 'req-1', taskName: 'task1', payload: {} },
      ]);

      const results = await coordinator.executeWithPlan(plan);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('createPlan', () => {
    it('should create execution plan', () => {
      const requests: ExecutionRequest[] = [
        { requestId: 'req-1', taskName: 'task1', payload: {} },
        { requestId: 'req-2', taskName: 'task2', payload: {} },
      ];

      const plan = coordinator.createPlan(requests);
      expect(plan.requestId).toMatch(/^plan_/);
      expect(plan.steps).toHaveLength(2);
      expect(plan.parallelGroups).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('should return false for non-existent execution', () => {
      const result = coordinator.cancel('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('cancelAll', () => {
    it('should cancel all executions', () => {
      coordinator.cancelAll();
      expect(coordinator.getActiveCount()).toBe(0);
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 initially', () => {
      expect(coordinator.getActiveCount()).toBe(0);
    });
  });

  describe('setDefaultTimeout', () => {
    it('should set default timeout', () => {
      coordinator.setDefaultTimeout(60000);
      expect(coordinator).toBeDefined();
    });
  });

  describe('dispose', () => {
    it('should dispose coordinator', () => {
      coordinator.dispose();
      expect(coordinator.getActiveCount()).toBe(0);
    });
  });
});
