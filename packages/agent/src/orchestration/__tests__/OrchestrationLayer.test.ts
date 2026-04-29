import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrchestrationLayer, createOrchestrationLayer, OrchestrationStrategy, OrchestrationPlanStatus } from '../OrchestrationLayer.js';
import { AgentRegistry } from '../../registry/AgentRegistry.js';
import { ExecutionCoordinator } from '../ExecutionCoordinator.js';
import { AgentType, createAgentMetadata } from '../../registry/AgentMetadata.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('OrchestrationLayer', () => {
  let layer: OrchestrationLayer;
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.start();
    layer = new OrchestrationLayer(registry);
  });

  describe('constructor', () => {
    it('should create orchestration layer', () => {
      expect(layer).toBeDefined();
    });

    it('should accept custom coordinator', () => {
      const coordinator = new ExecutionCoordinator(registry);
      const customLayer = new OrchestrationLayer(registry, coordinator);
      expect(customLayer).toBeDefined();
    });
  });

  describe('registerAgent', () => {
    it('should register agent', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      expect(layer.getAgent('agent-1')).toBeDefined();
    });

    it('should emit agent:registered event', () => {
      const handler = vi.fn();
      layer.on('agent:registered', handler);
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      expect(handler).toHaveBeenCalledWith({ agentId: 'agent-1' });
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister agent', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      const result = layer.unregisterAgent('agent-1');
      expect(result).toBe(true);
      expect(layer.getAgent('agent-1')).toBeUndefined();
    });

    it('should emit agent:unregistered event', () => {
      const handler = vi.fn();
      layer.on('agent:unregistered', handler);
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      layer.unregisterAgent('agent-1');
      expect(handler).toHaveBeenCalledWith({ agentId: 'agent-1' });
    });
  });

  describe('getAgent', () => {
    it('should get registered agent', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      const agent = layer.getAgent('agent-1');
      expect(agent?.id).toBe('agent-1');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = layer.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('listAgents', () => {
    it('should list all agents', () => {
      layer.registerAgent(createAgentMetadata('agent-1', 'Agent1', AgentType.EXECUTOR));
      layer.registerAgent(createAgentMetadata('agent-2', 'Agent2', AgentType.PLANNER));
      const agents = layer.listAgents();
      expect(agents).toHaveLength(2);
    });
  });

  describe('orchestrate', () => {
    it('should return error when max concurrent reached', async () => {
      const limitedLayer = new OrchestrationLayer(registry, undefined, {
        maxConcurrentOrchestrations: 0,
      });

      const result = await limitedLayer.orchestrate({
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MAX_CONCURRENT');
    });

    it('should emit orchestration:start event', async () => {
      const handler = vi.fn();
      layer.on('orchestration:start', handler);

      await layer.orchestrate({
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      });

      expect(handler).toHaveBeenCalledWith({ requestId: 'req-1' });
    });

    it('should handle orchestration failure', async () => {
      const result = await layer.orchestrate({
        requestId: 'req-1',
        taskName: 'test-task',
        payload: {},
      });

      expect(result.success).toBe(false);
    });
  });

  describe('createPlan', () => {
    it('should create orchestration plan', () => {
      const plan = layer.createPlan([
        { requestId: 'req-1', taskName: 'task1', payload: {} },
        { requestId: 'req-2', taskName: 'task2', payload: {} },
      ]);

      expect(plan.planId).toMatch(/^orchestration_plan_/);
      expect(plan.status).toBe(OrchestrationPlanStatus.PENDING);
    });
  });

  describe('getOrchestrationPlan', () => {
    it('should get plan by ID', () => {
      const createdPlan = layer.createPlan([
        { requestId: 'req-1', taskName: 'task1', payload: {} },
      ]);

      const plan = layer.getOrchestrationPlan(createdPlan.planId);
      expect(plan?.planId).toBe(createdPlan.planId);
    });

    it('should return undefined for non-existent plan', () => {
      const plan = layer.getOrchestrationPlan('non-existent');
      expect(plan).toBeUndefined();
    });
  });

  describe('listPlans', () => {
    it('should list all plans', () => {
      layer.createPlan([{ requestId: 'req-1', taskName: 'task1', payload: {} }]);
      layer.createPlan([{ requestId: 'req-2', taskName: 'task2', payload: {} }]);
      const plans = layer.listPlans();
      expect(plans).toHaveLength(2);
    });
  });

  describe('pause', () => {
    it('should return false for non-existent plan', () => {
      const result = layer.pause('non-existent');
      expect(result).toBe(false);
    });

    it('should pause plan', () => {
      const plan = layer.createPlan([
        { requestId: 'req-1', taskName: 'task1', payload: {} },
      ]);

      const result = layer.pause(plan.planId);
      expect(result).toBe(true);
    });
  });

  describe('resume', () => {
    it('should return error for non-existent plan', async () => {
      const result = await layer.resume('non-existent');
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PLAN_NOT_FOUND');
    });
  });

  describe('cancel', () => {
    it('should return false for non-existent orchestration', () => {
      const result = layer.cancel('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('cancelAll', () => {
    it('should cancel all orchestrations', () => {
      layer.cancelAll();
      expect(layer.getActiveCount()).toBe(0);
    });
  });

  describe('selectAgent', () => {
    it('should return null when no agents available', () => {
      const agent = layer.selectAgent();
      expect(agent).toBeNull();
    });

    it('should select agent with capability', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      const agent = layer.selectAgent();
      expect(agent).toBeDefined();
    });
  });

  describe('getAvailableAgents', () => {
    it('should return available agents', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      layer.registerAgent(metadata);
      const agents = layer.getAvailableAgents();
      expect(agents).toHaveLength(1);
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 initially', () => {
      expect(layer.getActiveCount()).toBe(0);
    });
  });

  describe('isActive', () => {
    it('should return false for non-active request', () => {
      expect(layer.isActive('non-existent')).toBe(false);
    });
  });

  describe('getCoordinator', () => {
    it('should return coordinator', () => {
      const coordinator = layer.getCoordinator();
      expect(coordinator).toBeDefined();
    });
  });

  describe('getRegistry', () => {
    it('should return registry', () => {
      const reg = layer.getRegistry();
      expect(reg).toBeDefined();
    });
  });

  describe('dispose', () => {
    it('should dispose orchestration layer', () => {
      layer.dispose();
      expect(layer.listAgents()).toEqual([]);
      expect(layer.listPlans()).toEqual([]);
    });
  });

  describe('createOrchestrationLayer', () => {
    it('should create orchestration layer with defaults', () => {
      const createdLayer = createOrchestrationLayer(registry);
      expect(createdLayer).toBeDefined();
      createdLayer.dispose();
    });
  });
});
