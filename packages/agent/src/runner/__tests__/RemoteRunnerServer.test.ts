/**
 * RemoteRunnerServer - HTTP server hosting remote agents tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Agent } from '../../core/Agent.js';
import { RemoteRunnerServer } from '../RemoteRunnerServer.js';

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

describe('RemoteRunnerServer', () => {
  let agent: Agent;
  let server: RemoteRunnerServer;
  let baseUrl: string;

  beforeAll(async () => {
    agent = new Agent({
      kernel: mockKernel,
      config: { id: 'server-agent', name: 'ServerAgent', version: '1.0.0' },
    });
    await agent.initialize();
    agent.registerTaskHandler('echo', async input => ({ received: input }));
    agent.registerTaskHandler('greet', async input => `Hi ${input.name}`);
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
    await server.stop();
  });

  describe('start', () => {
    it('should expose the actual port when started with port 0', () => {
      expect(server.getPort()).toBeGreaterThan(0);
      expect(server.getUrl()).toContain(`${server.getPort()}`);
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return healthy status', async () => {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('healthy');
      expect(body.agentId).toBe('server-agent');
    });
  });

  describe('GET /api/v1/info', () => {
    it('should return agent info', async () => {
      const res = await fetch(`${baseUrl}/api/v1/info`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe('server-agent');
      expect(body.name).toBe('ServerAgent');
      expect(body.version).toBe('1.0.0');
    });
  });

  describe('POST /api/v1/execute', () => {
    it('should execute a task and return result', async () => {
      const res = await fetch(`${baseUrl}/api/v1/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: 'greet',
          payload: { name: 'Organic' },
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.success).toBe(true);
      expect(body.data.data).toBe('Hi Organic');
    });

    it('should handle missing task handler', async () => {
      const res = await fetch(`${baseUrl}/api/v1/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: 'missing',
          payload: {},
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.success).toBe(false);
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    it('should return not found for unknown task', async () => {
      const res = await fetch(`${baseUrl}/api/v1/tasks/unknown-task`);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  describe('unknown routes', () => {
    it('should return 404 for unknown path', async () => {
      const res = await fetch(`${baseUrl}/api/v1/nope`);
      expect(res.status).toBe(404);
    });
  });

  describe('authentication', () => {
    it('should reject unauthorized requests when apiKey is set', async () => {
      const authedServer = new RemoteRunnerServer({
        port: 0,
        agent,
        apiKey: 'secret',
      });
      await authedServer.start();
      const url = `http://127.0.0.1:${authedServer.getPort()}`;

      const res = await fetch(`${url}/api/v1/health`);
      expect(res.status).toBe(401);

      await authedServer.stop();
    });

    it('should accept requests with valid api key', async () => {
      const authedServer = new RemoteRunnerServer({
        port: 0,
        agent,
        apiKey: 'secret',
      });
      await authedServer.start();
      const url = `http://127.0.0.1:${authedServer.getPort()}`;

      const res = await fetch(`${url}/api/v1/health`, {
        headers: { Authorization: 'Bearer secret' },
      });
      expect(res.status).toBe(200);

      await authedServer.stop();
    });
  });
});
