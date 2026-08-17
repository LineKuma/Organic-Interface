/**
 * AgentRunner - Abstract base class tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

/**
 * Minimal concrete runner for testing the abstract base class
 */
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

describe('AgentRunner', () => {
  let runner: TestRunner;

  const createRunner = (overrides: Partial<RunnerConfig> = {}) =>
    new TestRunner({
      runnerId: 'test-runner',
      name: 'TestRunner',
      mode: RunnerMode.LOCAL,
      maxConcurrentTasks: 2,
      ...overrides,
    });

  beforeEach(() => {
    runner = createRunner();
  });

  describe('constructor', () => {
    it('should apply default config values', () => {
      expect(runner.getConfig().maxConcurrentTasks).toBe(2);
      expect(runner.getConfig().defaultTimeout).toBe(30000);
      expect(runner.getConfig().heartbeatInterval).toBe(15000);
    });

    it('should start with OFFLINE health status', () => {
      expect(runner.getStats().health).toBe(RunnerHealthStatus.OFFLINE);
    });
  });

  describe('lifecycle', () => {
    it('should start the runner', async () => {
      await runner.start();
      expect(runner.isStarted()).toBe(true);
      expect(runner.getStats().health).toBe(RunnerHealthStatus.HEALTHY);
    });

    it('should be idempotent on repeated start', async () => {
      await runner.start();
      await runner.start();
      expect(runner.isStarted()).toBe(true);
    });

    it('should stop the runner', async () => {
      await runner.start();
      await runner.stop();
      expect(runner.isStarted()).toBe(false);
      expect(runner.getStats().health).toBe(RunnerHealthStatus.OFFLINE);
    });

    it('should be safe to stop when not started', async () => {
      await runner.stop();
      expect(runner.isStarted()).toBe(false);
    });
  });

  describe('accessors', () => {
    it('should return runner id, name, and mode', () => {
      expect(runner.getRunnerId()).toBe('test-runner');
      expect(runner.getName()).toBe('TestRunner');
      expect(runner.getMode()).toBe(RunnerMode.LOCAL);
    });
  });

  describe('canAcceptTasks', () => {
    it('should not accept tasks before start', () => {
      expect(runner.canAcceptTasks()).toBe(false);
    });

    it('should accept tasks when started and healthy', async () => {
      await runner.start();
      expect(runner.canAcceptTasks()).toBe(true);
    });

    it('should not accept tasks at max concurrency', async () => {
      await runner.start();
      runner['trackTaskStart']('task-1');
      runner['trackTaskStart']('task-2');
      expect(runner.canAcceptTasks()).toBe(false);
    });

    it('should not accept tasks when unhealthy', async () => {
      await runner.start();
      runner['setHealth'](RunnerHealthStatus.UNHEALTHY);
      expect(runner.canAcceptTasks()).toBe(false);
    });
  });

  describe('task tracking', () => {
    it('should track task start', async () => {
      await runner.start();
      runner['trackTaskStart']('task-1');
      const stats = runner.getStats();
      expect(stats.activeTaskCount).toBe(1);
    });

    it('should track task completion', async () => {
      await runner.start();
      runner['trackTaskStart']('task-1');
      runner['trackTaskComplete']('task-1', { success: true, data: 'x', executionTime: 5 });
      const stats = runner.getStats();
      expect(stats.completedTaskCount).toBe(1);
      expect(stats.activeTaskCount).toBe(0);
    });

    it('should track failed completion as failure', async () => {
      await runner.start();
      runner['trackTaskStart']('task-1');
      runner['trackTaskComplete']('task-1', { success: false, error: 'boom', executionTime: 5 });
      const stats = runner.getStats();
      expect(stats.failedTaskCount).toBe(1);
    });

    it('should track task error', async () => {
      await runner.start();
      runner['trackTaskStart']('task-1');
      runner['trackTaskError']('task-1', new Error('boom'));
      const stats = runner.getStats();
      expect(stats.failedTaskCount).toBe(1);
      expect(stats.activeTaskCount).toBe(0);
    });

    it('should compute load from active tasks', async () => {
      await runner.start();
      runner['trackTaskStart']('task-1');
      expect(runner.getLoad()).toBeCloseTo(0.5);
    });
  });

  describe('events', () => {
    it('should emit task:start event', async () => {
      await runner.start();
      const handler = vi.fn();
      runner.on('task:start', handler);
      runner['trackTaskStart']('task-1');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'task-1', runnerId: 'test-runner' })
      );
    });

    it('should emit task:complete event', async () => {
      await runner.start();
      const handler = vi.fn();
      runner.on('task:complete', handler);
      runner['trackTaskComplete']('task-1', { success: true, data: 'x', executionTime: 1 });
      expect(handler).toHaveBeenCalled();
    });

    it('should emit health:change event on status transition', async () => {
      await runner.start();
      const handler = vi.fn();
      runner.on('health:change', handler);
      runner['setHealth'](RunnerHealthStatus.DEGRADED);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          oldStatus: RunnerHealthStatus.HEALTHY,
          newStatus: RunnerHealthStatus.DEGRADED,
        })
      );
    });

    it('should not emit health:change when status unchanged', async () => {
      await runner.start();
      const handler = vi.fn();
      runner.on('health:change', handler);
      runner['setHealth'](RunnerHealthStatus.HEALTHY);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
