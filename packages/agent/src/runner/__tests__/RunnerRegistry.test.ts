/**
 * RunnerRegistry - Runner registration and selection tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RunnerRegistry } from '../RunnerRegistry.js';
import { AgentRunner, RunnerMode, RunnerHealthStatus, type RunnerConfig } from '../AgentRunner.js';
import type { AgentTaskInput } from '../../core/Agent.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

class TestRunner extends AgentRunner {
  constructor(config: RunnerConfig) {
    super(config);
  }

  async execute<R = unknown>(
    _input: AgentTaskInput
  ): Promise<{ success: boolean; data?: R; executionTime: number }> {
    return { success: true, data: 'ok' as R, executionTime: 1 };
  }

  async healthCheck(): Promise<RunnerHealthStatus> {
    return RunnerHealthStatus.HEALTHY;
  }
}

const createRunner = (overrides: Partial<RunnerConfig> = {}): TestRunner =>
  new TestRunner({
    runnerId: 'r1',
    name: 'Runner1',
    mode: RunnerMode.LOCAL,
    capabilities: [{ id: 'compute' }],
    maxConcurrentTasks: 2,
    ...overrides,
  });

describe('RunnerRegistry', () => {
  let registry: RunnerRegistry;

  beforeEach(() => {
    registry = new RunnerRegistry('test-registry');
  });

  describe('register / unregister', () => {
    it('should register a runner', () => {
      registry.register(createRunner());
      expect(registry.size()).toBe(1);
      expect(registry.has('r1')).toBe(true);
    });

    it('should not duplicate registration', () => {
      const runner = createRunner();
      registry.register(runner);
      registry.register(runner);
      expect(registry.size()).toBe(1);
    });

    it('should unregister a runner', () => {
      registry.register(createRunner());
      const removed = registry.unregister('r1');
      expect(removed).toBe(true);
      expect(registry.size()).toBe(0);
    });

    it('should return false when unregistering unknown runner', () => {
      expect(registry.unregister('nope')).toBe(false);
    });

    it('should get a registered runner by id', () => {
      const runner = createRunner();
      registry.register(runner);
      expect(registry.get('r1')).toBe(runner);
    });

    it('should list all runners', () => {
      registry.register(createRunner());
      registry.register(createRunner({ runnerId: 'r2', name: 'Runner2' }));
      expect(registry.list()).toHaveLength(2);
    });
  });

  describe('find', () => {
    it('should filter by mode', () => {
      registry.register(createRunner());
      registry.register(createRunner({ runnerId: 'r2', name: 'Runner2', mode: RunnerMode.REMOTE }));
      const found = registry.find({ mode: RunnerMode.REMOTE });
      expect(found).toHaveLength(1);
      expect(found[0].getRunnerId()).toBe('r2');
    });

    it('should filter by name', () => {
      registry.register(createRunner());
      registry.register(createRunner({ runnerId: 'r2', name: 'Special' }));
      const found = registry.find({ name: 'Special' });
      expect(found).toHaveLength(1);
    });

    it('should filter by capability', () => {
      registry.register(createRunner());
      registry.register(
        createRunner({ runnerId: 'r2', name: 'Runner2', capabilities: [{ id: 'io' }] })
      );
      const found = registry.find({ capability: 'io' });
      expect(found).toHaveLength(1);
      expect(found[0].getRunnerId()).toBe('r2');
    });

    it('should apply custom filter', () => {
      registry.register(createRunner());
      registry.register(createRunner({ runnerId: 'r2', name: 'Runner2' }));
      const found = registry.find({ filter: r => r.getRunnerId() === 'r2' });
      expect(found).toHaveLength(1);
    });
  });

  describe('select', () => {
    it('should return first matching runner', () => {
      registry.register(createRunner());
      registry.register(createRunner({ runnerId: 'r2', name: 'Runner2' }));
      const selected = registry.select({});
      expect(selected).toBeDefined();
    });

    it('should return undefined when no match', () => {
      const selected = registry.select({ name: 'Missing' });
      expect(selected).toBeUndefined();
    });
  });

  describe('selectAvailable', () => {
    it('should pick a started healthy runner', async () => {
      const runner = createRunner();
      await runner.start();
      registry.register(runner);

      const selected = registry.selectAvailable({});
      expect(selected).toBe(runner);
    });

    it('should skip runners that cannot accept tasks', async () => {
      const busy = createRunner();
      await busy.start();
      busy['trackTaskStart']('t1');
      busy['trackTaskStart']('t2');
      registry.register(busy);

      const free = createRunner({ runnerId: 'r2', name: 'Runner2' });
      await free.start();
      registry.register(free);

      const selected = registry.selectAvailable({});
      expect(selected).toBe(free);
    });

    it('should return undefined when no available runner', () => {
      registry.register(createRunner()); // not started
      const selected = registry.selectAvailable({});
      expect(selected).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should aggregate statistics', async () => {
      const runner = createRunner();
      await runner.start();
      registry.register(runner);
      registry.register(createRunner({ runnerId: 'r2', name: 'Runner2' }));

      const stats = registry.getStats();
      expect(stats.total).toBe(2);
      expect(stats.healthy).toBe(1);
      expect(stats.offline).toBe(1);
      expect(stats.byMode[RunnerMode.LOCAL]).toBe(2);
    });
  });

  describe('events', () => {
    it('should emit runner:registered', () => {
      const handler = vi.fn();
      registry.on('runner:registered', handler);
      registry.register(createRunner());
      expect(handler).toHaveBeenCalledWith({ runnerId: 'r1' });
    });

    it('should emit runner:unregistered', () => {
      const handler = vi.fn();
      registry.on('runner:unregistered', handler);
      registry.register(createRunner());
      registry.unregister('r1');
      expect(handler).toHaveBeenCalledWith({ runnerId: 'r1' });
    });
  });

  describe('dispose', () => {
    it('should clear all runners and listeners', () => {
      registry.register(createRunner());
      registry.dispose();
      expect(registry.size()).toBe(0);
    });
  });
});
