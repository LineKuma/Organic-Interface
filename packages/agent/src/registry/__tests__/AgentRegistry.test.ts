import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry, createRegistry, type AgentRegistryConfig } from '../AgentRegistry.js';
import type { AgentMetadata } from '../AgentMetadata.js';
import { AgentType, AgentRegistryStatus } from '../AgentMetadata.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('constructor', () => {
    it('should create a registry with default config', () => {
      expect(registry).toBeDefined();
    });

    it('should accept custom config', () => {
      const customRegistry = new AgentRegistry({
        name: 'custom',
        heartbeatTimeout: 60000,
        leaseDuration: 120000,
      });
      expect(customRegistry).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start the registry', () => {
      registry.start();
      expect(registry).toBeDefined();
    });

    it('should stop the registry', () => {
      registry.start();
      registry.stop();
      expect(registry).toBeDefined();
    });

    it('should not start twice', () => {
      registry.start();
      registry.start();
      registry.stop();
    });
  });

  describe('register', () => {
    it('should register an agent', () => {
      registry.start();
      const metadata: AgentMetadata = {
        id: 'agent-1',
        name: 'TestAgent',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0,
        maxConcurrentTasks: 10,
        activeTaskCount: 0,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      const result = registry.register(metadata);
      expect(result.id).toBe('agent-1');
    });

    it('should emit agent:registered event', () => {
      registry.start();
      const handler = vi.fn();
      registry.on('agent:registered', handler);

      const metadata: AgentMetadata = {
        id: 'agent-1',
        name: 'TestAgent',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0,
        maxConcurrentTasks: 10,
        activeTaskCount: 0,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      registry.register(metadata);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('registerAgent', () => {
    it('should register agent with basic info', () => {
      registry.start();
      const result = registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      expect(result.id).toBe('agent-1');
      expect(result.name).toBe('TestAgent');
    });

    it('should register with options', () => {
      registry.start();
      const result = registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR, {
        version: '2.0.0',
        capabilities: [{ id: 'cap1' }],
        maxConcurrentTasks: 20,
        tags: ['tag1'],
      });

      expect(result.version).toBe('2.0.0');
      expect(result.capabilities).toHaveLength(1);
      expect(result.maxConcurrentTasks).toBe(20);
      expect(result.tags).toContain('tag1');
    });
  });

  describe('unregister', () => {
    it('should unregister existing agent', () => {
      registry.start();
      registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      const result = registry.unregister('agent-1');
      expect(result).toBe(true);
    });

    it('should return false for non-existent agent', () => {
      registry.start();
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should emit agent:unregistered event', () => {
      registry.start();
      const handler = vi.fn();
      registry.on('agent:unregistered', handler);

      registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      registry.unregister('agent-1');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update agent metadata', () => {
      registry.start();
      registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      const result = registry.update('agent-1', { name: 'UpdatedAgent' });
      expect(result).toBeDefined();
      expect(result?.name).toBe('UpdatedAgent');
    });

    it('should return null for non-existent agent', () => {
      registry.start();
      const result = registry.update('non-existent', { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should prevent ID change', () => {
      registry.start();
      registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      const result = registry.update('agent-1', { id: 'changed-id' } as any);
      expect(result?.id).toBe('agent-1');
    });
  });

  describe('get', () => {
    it('should get agent by ID', () => {
      registry.start();
      registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      const result = registry.get('agent-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('agent-1');
    });

    it('should return null for non-existent agent', () => {
      registry.start();
      const result = registry.get('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all agents', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.PLANNER);
      const result = registry.list();
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no agents', () => {
      registry.start();
      const result = registry.list();
      expect(result).toEqual([]);
    });
  });

  describe('find', () => {
    it('should find agents by type', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.PLANNER);
      const result = registry.find({ type: AgentType.EXECUTOR });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(AgentType.EXECUTOR);
    });

    it('should find agents by capability', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap2' }],
      });
      const result = registry.find({ capability: 'cap1' });
      expect(result).toHaveLength(1);
      expect(result[0].capabilities[0].id).toBe('cap1');
    });

    it('should find agents by status', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.find({ status: AgentRegistryStatus.ONLINE });
      expect(result).toHaveLength(1);
    });

    it('should find agents by max load', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR);
      const result = registry.find({ maxLoad: 0.5 });
      expect(result.length).toBeGreaterThan(0);
    });

    it('should find agents by tags', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, { tags: ['tag1', 'tag2'] });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, { tags: ['tag2'] });
      const result = registry.find({ tags: ['tag1'] });
      expect(result).toHaveLength(1);
    });
  });

  describe('discover', () => {
    it('should discover agents by capability', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });
      const result = registry.discover('cap1');
      expect(result).toHaveLength(1);
    });

    it('should discover with options', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.discover('any-capability', { maxLoad: 1 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('heartbeat', () => {
    it('should record heartbeat', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.heartbeat('agent-1', { load: 0.5, activeTaskCount: 2 });
      expect(result).toBe(true);
    });

    it('should return false for unknown agent', () => {
      registry.start();
      const result = registry.heartbeat('unknown', { load: 0.5, activeTaskCount: 2 });
      expect(result).toBe(false);
    });
  });

  describe('isHealthy', () => {
    it('should return true for healthy agent', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      expect(registry.isHealthy('agent-1')).toBe(true);
    });

    it('should return false for unknown agent', () => {
      registry.start();
      expect(registry.isHealthy('unknown')).toBe(false);
    });
  });

  describe('canAcceptTasks', () => {
    it('should return true for agent that can accept tasks', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      expect(registry.canAcceptTasks('agent-1')).toBe(true);
    });

    it('should return false for unknown agent', () => {
      registry.start();
      expect(registry.canAcceptTasks('unknown')).toBe(false);
    });
  });

  describe('selectAgent', () => {
    it('should select available agent', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.selectAgent();
      expect(result).toBeDefined();
    });

    it('should return null when no agents available', () => {
      registry.start();
      const result = registry.selectAgent();
      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.PLANNER);
      const stats = registry.getStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.onlineAgents).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should cleanup stale entries', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const removed = registry.cleanup();
      expect(removed).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.clear();
      expect(registry.list()).toHaveLength(0);
    });
  });

  describe('size', () => {
    it('should return entry count', () => {
      registry.start();
      expect(registry.size()).toBe(0);
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      expect(registry.size()).toBe(1);
    });
  });

  describe('has', () => {
    it('should return true for existing agent', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      expect(registry.has('agent-1')).toBe(true);
    });

    it('should return false for non-existing agent', () => {
      registry.start();
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should dispose the registry', () => {
      registry.start();
      registry.dispose();
      expect(registry).toBeDefined();
    });
  });

  describe('createRegistry', () => {
    it('should create registry with auto-start', () => {
      const reg = createRegistry('test');
      expect(reg).toBeDefined();
      reg.dispose();
    });
  });
});
