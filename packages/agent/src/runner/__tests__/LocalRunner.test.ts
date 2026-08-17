/**
 * LocalRunner - In-process execution tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../../core/Agent.js';
import { LocalRunner, type LocalRunnerConfig } from '../LocalRunner.js';
import { RunnerHealthStatus } from '../AgentRunner.js';

vi.mock('@organic/kernel', () => ({
  KernelApi: vi.fn(),
}));

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockKernel = {} as any;

describe('LocalRunner', () => {
  let agent: Agent;
  let runner: LocalRunner;

  const createAgent = async (): Promise<Agent> => {
    const a = new Agent({
      kernel: mockKernel,
      config: { id: 'local-agent', name: 'LocalAgent', version: '1.0.0' },
    });
    await a.initialize();
    return a;
  };

  const createRunner = async (overrides: Partial<LocalRunnerConfig> = {}): Promise<LocalRunner> => {
    const a = agent ?? (await createAgent());
    const r = new LocalRunner({
      runnerId: 'local-runner',
      name: 'LocalRunner',
      agent: a,
      ...overrides,
    });
    return r;
  };

  beforeEach(() => {
    agent = undefined as unknown as Agent;
  });

  describe('constructor', () => {
    it('should set mode to LOCAL', () => {
      const r = new LocalRunner({
        runnerId: 'x',
        name: 'X',
        agent: {} as Agent,
      });
      expect(r.getMode()).toBe('local');
      expect(r.getRunnerId()).toBe('x');
    });
  });

  describe('start', () => {
    it('should start the runner and initialize the agent', async () => {
      agent = await createAgent();
      runner = await createRunner();
      await runner.start();
      expect(runner.isStarted()).toBe(true);
      expect(runner.getAgent().getStatus()).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should stop the runner', async () => {
      agent = await createAgent();
      runner = await createRunner();
      await runner.start();
      await runner.stop();
      expect(runner.isStarted()).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return error when runner not started', async () => {
      agent = await createAgent();
      runner = await createRunner();
      const result = await runner.execute({
        taskId: 'greet',
        payload: {},
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not started');
    });

    it('should execute task by delegating to the agent', async () => {
      agent = await createAgent();
      agent.registerTaskHandler('greet', async input => `Hello ${input.name}`);
      runner = await createRunner();
      await runner.start();

      const result = await runner.execute({
        taskId: 'greet',
        payload: { name: 'Organic' },
      });
      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello Organic');
    });

    it('should track completed task count', async () => {
      agent = await createAgent();
      agent.registerTaskHandler('greet', async () => 'hi');
      runner = await createRunner();
      await runner.start();

      await runner.execute({ taskId: 'greet', payload: {} });
      const stats = runner.getStats();
      expect(stats.completedTaskCount).toBe(1);
      expect(stats.activeTaskCount).toBe(0);
    });

    it('should capture agent execution errors', async () => {
      agent = await createAgent();
      agent.registerTaskHandler('fail', async () => {
        throw new Error('agent failed');
      });
      runner = await createRunner();
      await runner.start();

      const result = await runner.execute({ taskId: 'fail', payload: {} });
      expect(result.success).toBe(false);
      expect(result.error).toBe('agent failed');
      expect(runner.getStats().failedTaskCount).toBe(1);
    });

    it('should handle unregistered task', async () => {
      agent = await createAgent();
      runner = await createRunner();
      await runner.start();

      const result = await runner.execute({ taskId: 'missing', payload: {} });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler registered');
    });
  });

  describe('healthCheck', () => {
    it('should return HEALTHY when agent can accept tasks', async () => {
      agent = await createAgent();
      runner = await createRunner();
      await runner.start();
      const status = await runner.healthCheck();
      expect(status).toBe(RunnerHealthStatus.HEALTHY);
    });
  });

  describe('getAgent', () => {
    it('should return the wrapped agent', async () => {
      agent = await createAgent();
      runner = await createRunner();
      expect(runner.getAgent()).toBe(agent);
    });
  });
});
