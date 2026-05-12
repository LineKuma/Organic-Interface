import { describe, it, expect } from 'vitest';
import type {
  AgentCapability,
  AgentMetadata,
  RegistryEntry,
  AgentSelector,
  RegistryStats} from '../AgentMetadata.js';
import {
  AgentType,
  AgentRegistryStatus,
  HealthCheckResult,
  createAgentMetadata,
  createHealthCheckResult,
  isAgentHealthy,
  canAgentAcceptTasks,
  compareByLoad,
  serializeEntry,
  deserializeEntry,
} from '../AgentMetadata.js';

describe('AgentMetadata', () => {
  describe('AgentType enum', () => {
    it('should have correct enum values', () => {
      expect(AgentType.ORCHESTRATOR).toBe('orchestrator');
      expect(AgentType.EXECUTOR).toBe('executor');
      expect(AgentType.PLANNER).toBe('planner');
      expect(AgentType.MONITOR).toBe('monitor');
      expect(AgentType.CUSTOM).toBe('custom');
    });
  });

  describe('AgentRegistryStatus enum', () => {
    it('should have correct status values', () => {
      expect(AgentRegistryStatus.ONLINE).toBe('online');
      expect(AgentRegistryStatus.BUSY).toBe('busy');
      expect(AgentRegistryStatus.UNAVAILABLE).toBe('unavailable');
      expect(AgentRegistryStatus.OFFLINE).toBe('offline');
    });
  });

  describe('createAgentMetadata', () => {
    it('should create metadata with required fields', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);

      expect(metadata.id).toBe('agent-1');
      expect(metadata.name).toBe('TestAgent');
      expect(metadata.type).toBe(AgentType.EXECUTOR);
    });

    it('should set default version', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      expect(metadata.version).toBe('0.1.0');
    });

    it('should set default values', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);

      expect(metadata.status).toBe(AgentRegistryStatus.ONLINE);
      expect(metadata.load).toBe(0);
      expect(metadata.childIds).toEqual([]);
      expect(metadata.maxConcurrentTasks).toBe(10);
      expect(metadata.activeTaskCount).toBe(0);
      expect(metadata.tags).toEqual([]);
    });

    it('should set timestamps', () => {
      const before = Date.now();
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      const after = Date.now();

      expect(metadata.registeredAt).toBeGreaterThanOrEqual(before);
      expect(metadata.registeredAt).toBeLessThanOrEqual(after);
      expect(metadata.lastHeartbeatAt).toBeGreaterThanOrEqual(before);
      expect(metadata.lastHeartbeatAt).toBeLessThanOrEqual(after);
    });

    it('should accept options', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR, {
        version: '2.0.0',
        capabilities: [{ id: 'cap1', description: 'Capability 1' }],
        maxConcurrentTasks: 20,
        tags: ['tag1', 'tag2'],
        metadata: { key: 'value' },
      });

      expect(metadata.version).toBe('2.0.0');
      expect(metadata.capabilities).toHaveLength(1);
      expect(metadata.maxConcurrentTasks).toBe(20);
      expect(metadata.tags).toEqual(['tag1', 'tag2']);
      expect(metadata.metadata).toEqual({ key: 'value' });
    });
  });

  describe('createHealthCheckResult', () => {
    it('should create healthy result', () => {
      const result = createHealthCheckResult(true, 100);
      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBe(100);
      expect(result.checkedAt).toBeDefined();
    });

    it('should create unhealthy result with error', () => {
      const result = createHealthCheckResult(false, undefined, 'Service unavailable');
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Service unavailable');
    });

    it('should accept details', () => {
      const result = createHealthCheckResult(true, 50, undefined, { details: 'info' });
      expect(result.details).toEqual({ details: 'info' });
    });
  });

  describe('isAgentHealthy', () => {
    it('should return true for healthy agent', () => {
      const agent: AgentMetadata = {
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

      expect(isAgentHealthy(agent)).toBe(true);
    });

    it('should return false for offline agent', () => {
      const agent: AgentMetadata = {
        id: 'agent-1',
        name: 'TestAgent',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.OFFLINE,
        load: 0,
        maxConcurrentTasks: 10,
        activeTaskCount: 0,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      expect(isAgentHealthy(agent)).toBe(false);
    });

    it('should return false for stale heartbeat', () => {
      const agent: AgentMetadata = {
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
        lastHeartbeatAt: Date.now() - 60000,
        childIds: [],
      };

      expect(isAgentHealthy(agent, 30000)).toBe(false);
    });

    it('should return false for unhealthy health check', () => {
      const agent: AgentMetadata = {
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
        healthCheck: { healthy: false, checkedAt: Date.now(), error: 'Unhealthy' },
        childIds: [],
      };

      expect(isAgentHealthy(agent)).toBe(false);
    });
  });

  describe('canAgentAcceptTasks', () => {
    it('should return true for healthy agent with capacity', () => {
      const agent: AgentMetadata = {
        id: 'agent-1',
        name: 'TestAgent',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0.5,
        maxConcurrentTasks: 10,
        activeTaskCount: 5,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      expect(canAgentAcceptTasks(agent)).toBe(true);
    });

    it('should return false when load is 1', () => {
      const agent: AgentMetadata = {
        id: 'agent-1',
        name: 'TestAgent',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 1,
        maxConcurrentTasks: 10,
        activeTaskCount: 10,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      expect(canAgentAcceptTasks(agent)).toBe(false);
    });
  });

  describe('compareByLoad', () => {
    it('should sort by load ascending', () => {
      const a: AgentMetadata = {
        id: 'a',
        name: 'Agent A',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0.8,
        maxConcurrentTasks: 10,
        activeTaskCount: 8,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      const b: AgentMetadata = {
        id: 'b',
        name: 'Agent B',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0.3,
        maxConcurrentTasks: 10,
        activeTaskCount: 3,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      expect(compareByLoad(a, b)).toBeGreaterThan(0);
      expect(compareByLoad(b, a)).toBeLessThan(0);
    });
  });

  describe('serializeEntry/deserializeEntry', () => {
    it('should serialize and deserialize entry', () => {
      const entry: RegistryEntry = {
        agent: createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR),
        leaseExpiresAt: Date.now() + 60000,
        version: 1,
      };

      const serialized = serializeEntry(entry);
      const deserialized = deserializeEntry(serialized);

      expect(deserialized.agent.id).toBe('agent-1');
      expect(deserialized.leaseExpiresAt).toBe(entry.leaseExpiresAt);
      expect(deserialized.version).toBe(1);
    });
  });

  describe('AgentCapability interface', () => {
    it('should accept capability with all fields', () => {
      const capability: AgentCapability = {
        id: 'cap1',
        description: 'Test capability',
        version: '1.0.0',
      };
      expect(capability.id).toBe('cap1');
    });
  });

  describe('AgentSelector interface', () => {
    it('should accept selector with type filter', () => {
      const selector: AgentSelector = { type: AgentType.EXECUTOR };
      expect(selector.type).toBe(AgentType.EXECUTOR);
    });

    it('should accept selector with custom filter', () => {
      const selector: AgentSelector = {
        filter: (agent) => agent.load < 0.5,
      };
      expect(selector.filter).toBeDefined();
    });
  });

  describe('RegistryStats interface', () => {
    it('should accept all required properties', () => {
      const stats: RegistryStats = {
        totalAgents: 10,
        onlineAgents: 5,
        busyAgents: 3,
        offlineAgents: 2,
        totalCapabilities: 15,
        averageLoad: 0.45,
      };

      expect(stats.totalAgents).toBe(10);
      expect(stats.averageLoad).toBe(0.45);
    });
  });
});
