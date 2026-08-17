/**
 * RemoteRunner - HTTP remote execution client tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { Agent } from '../../core/Agent.js';
import { RemoteRunnerServer } from '../RemoteRunnerServer.js';
import { RemoteRunner, RemoteTransport } from '../RemoteRunner.js';
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

describe('RemoteRunner', () => {
  let agent: Agent;
  let server: RemoteRunnerServer;
  let runner: RemoteRunner;
  let baseUrl: string;

  beforeAll(async () => {
    agent = new Agent({
      kernel: mockKernel,
      config: { id: 'remote-agent', name: 'RemoteAgent', version: '1.0.0' },
    });
    await agent.initialize();
    agent.registerTaskHandler('add', async input => input.a + input.b);
    agent.registerTaskHandler('fail', async () => {
      throw new Error('server side failure');
    });
  });

  afterAll(async () => {
    await agent.shutdown();
  });

  beforeEach(async () => {
    server = new RemoteRunnerServer({ port: 0, agent });
    await server.start();
    baseUrl = `http://127.0.0.1:${server.getPort()}`;
  });

  afterEach(async () => {
    await runner?.stop();
    await server.stop();
  });

  describe('HTTP transport', () => {
    it('should execute a task via HTTP', async () => {
      runner = new RemoteRunner({
        runnerId: 'remote-client',
        name: 'RemoteClient',
        remoteUrl: baseUrl,
        transport: RemoteTransport.HTTP,
      });
      await runner.start();

      const result = await runner.execute({
        taskId: 'add',
        payload: { a: 2, b: 3 },
      });
      expect(result.success).toBe(true);
      expect(result.data).toBe(5);
    });

    it('should propagate remote errors', async () => {
      runner = new RemoteRunner({
        runnerId: 'remote-client',
        name: 'RemoteClient',
        remoteUrl: baseUrl,
        transport: RemoteTransport.HTTP,
      });
      await runner.start();

      const result = await runner.execute({ taskId: 'fail', payload: {} });
      expect(result.success).toBe(false);
      expect(result.error).toContain('server side failure');
    });

    it('should return error when runner not started', async () => {
      runner = new RemoteRunner({
        runnerId: 'remote-client',
        name: 'RemoteClient',
        remoteUrl: baseUrl,
        transport: RemoteTransport.HTTP,
      });
      const result = await runner.execute({ taskId: 'add', payload: { a: 1, b: 1 } });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not started');
    });

    it('should return error when remote is unreachable', async () => {
      runner = new RemoteRunner({
        runnerId: 'remote-client',
        name: 'RemoteClient',
        remoteUrl: 'http://127.0.0.1:1', // unlikely to be listening
        transport: RemoteTransport.HTTP,
        requestTimeout: 1000,
      });
      await runner.start();

      const result = await runner.execute({ taskId: 'add', payload: { a: 1, b: 1 } });
      expect(result.success).toBe(false);
    });

    it('should track completed task count', async () => {
      runner = new RemoteRunner({
        runnerId: 'remote-client',
        name: 'RemoteClient',
        remoteUrl: baseUrl,
        transport: RemoteTransport.HTTP,
      });
      await runner.start();

      await runner.execute({ taskId: 'add', payload: { a: 1, b: 1 } });
      const stats = runner.getStats();
      expect(stats.completedTaskCount).toBe(1);
      expect(stats.activeTaskCount).toBe(0);
    });
  });

  describe('healthCheck', () => {
    it('should return HEALTHY against a running server', async () => {
      runner = new RemoteRunner({
        runnerId: 'remote-client',
        name: 'RemoteClient',
        remoteUrl: baseUrl,
        transport: RemoteTransport.HTTP,
      });
      await runner.start();

      const status = await runner.healthCheck();
      expect(status).toBe(RunnerHealthStatus.HEALTHY);
    });

    it('should return UNHEALTHY against an unreachable server', async () => {
      runner = new RemoteRunner({
        runnerId: 'remote-client',
        name: 'RemoteClient',
        remoteUrl: 'http://127.0.0.1:1',
        transport: RemoteTransport.HTTP,
      });
      const status = await runner.healthCheck();
      expect(status).toBe(RunnerHealthStatus.UNHEALTHY);
    });
  });

  describe('stop', () => {
    it('should stop the runner', async () => {
      runner = new RemoteRunner({
        runnerId: 'remote-client',
        name: 'RemoteClient',
        remoteUrl: baseUrl,
        transport: RemoteTransport.HTTP,
      });
      await runner.start();
      await runner.stop();
      expect(runner.isStarted()).toBe(false);
    });
  });
});
