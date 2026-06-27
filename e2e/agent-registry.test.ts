import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentRegistry, createAgentMetadata, AgentType } from '@organic/agent/registry';

describe('Agent Registry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry({
      name: 'test-registry',
      enableAutoCleanup: false,
      enableHealthCheck: false,
    });
    registry.start();
  });

  afterEach(() => {
    registry.dispose();
  });

  it('should register agent metadata', async () => {
    const metadata = createAgentMetadata('agent-1', 'Test Agent', AgentType.EXECUTOR, {
      capabilities: [{ id: 'test-cap', description: 'Test capability' }],
      tags: ['test', 'unit'],
    });

    const registered = registry.register(metadata);

    expect(registered).toBeDefined();
    expect(registered.id).toBe('agent-1');
    expect(registry.get('agent-1')).toBeDefined();
  });

  it('should register agent using helper method', async () => {
    const metadata = registry.registerAgent('agent-2', 'Helper Agent', AgentType.PLANNER, {
      capabilities: [{ id: 'planning' }],
      tags: ['planner'],
    });

    expect(metadata).toBeDefined();
    expect(registry.has('agent-2')).toBe(true);
  });

  it('should query agent by ID', async () => {
    registry.registerAgent('agent-3', 'Query Agent', AgentType.MONITOR);

    const retrieved = registry.get('agent-3');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Query Agent');
  });

  it('should list all agents', async () => {
    registry.registerAgent('agent-list-1', 'List Agent 1', AgentType.EXECUTOR);
    registry.registerAgent('agent-list-2', 'List Agent 2', AgentType.PLANNER);
    registry.registerAgent('agent-list-3', 'List Agent 3', AgentType.MONITOR);

    const agents = registry.list();
    expect(agents.length).toBe(3);
  });

  it('should find agents by selector', async () => {
    registry.registerAgent('find-executor-1', 'Executor 1', AgentType.EXECUTOR, {
      capabilities: [{ id: 'exec-cap' }],
      tags: ['compute'],
    });
    registry.registerAgent('find-executor-2', 'Executor 2', AgentType.EXECUTOR, {
      capabilities: [{ id: 'exec-cap' }],
      tags: ['compute'],
    });
    registry.registerAgent('find-planner-1', 'Planner 1', AgentType.PLANNER, {
      capabilities: [{ id: 'plan-cap' }],
      tags: ['planning'],
    });

    const executors = registry.find({ type: AgentType.EXECUTOR });
    expect(executors.length).toBe(2);

    const withCap = registry.find({ capability: 'exec-cap' });
    expect(withCap.length).toBe(2);
  });

  it('should update agent metadata', async () => {
    registry.registerAgent('update-agent', 'Original Name', AgentType.EXECUTOR);

    const updated = registry.update('update-agent', {
      name: 'Updated Name',
      metadata: { key: 'value' },
    });

    expect(updated).toBeDefined();
    expect(updated?.name).toBe('Updated Name');
    expect(updated?.metadata).toEqual({ key: 'value' });
  });

  it('should unregister agent', async () => {
    registry.registerAgent('remove-agent', 'Remove Agent', AgentType.EXECUTOR);
    expect(registry.has('remove-agent')).toBe(true);

    const result = registry.unregister('remove-agent');
    expect(result).toBe(true);
    expect(registry.has('remove-agent')).toBe(false);
  });

  it('should get registry statistics', async () => {
    registry.registerAgent('stat-agent-1', 'Stat Agent 1', AgentType.EXECUTOR);
    registry.registerAgent('stat-agent-2', 'Stat Agent 2', AgentType.PLANNER);

    const stats = registry.getStats();
    expect(stats.totalAgents).toBe(2);
    expect(stats.onlineAgents).toBe(2);
  });

  it('should discover agents by capability', async () => {
    registry.registerAgent('disc-exec-1', 'Discovery Executor 1', AgentType.EXECUTOR, {
      capabilities: [{ id: 'discovery-cap' }],
    });
    registry.registerAgent('disc-exec-2', 'Discovery Executor 2', AgentType.EXECUTOR, {
      capabilities: [{ id: 'discovery-cap' }],
    });
    registry.registerAgent('disc-plan-1', 'Discovery Planner 1', AgentType.PLANNER, {
      capabilities: [{ id: 'planning' }],
    });

    const discovered = registry.discover('discovery-cap');
    expect(discovered.length).toBe(2);
  });

  it('should clear all agents', async () => {
    registry.registerAgent('clear-agent-1', 'Clear Agent 1', AgentType.EXECUTOR);
    registry.registerAgent('clear-agent-2', 'Clear Agent 2', AgentType.EXECUTOR);

    expect(registry.size()).toBe(2);

    registry.clear();

    expect(registry.size()).toBe(0);
  });
});
