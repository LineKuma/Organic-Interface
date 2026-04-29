import { describe, it, expect, vi } from 'vitest';
import { UIAgent, createUIAgent } from '../UIAgent.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('UIAgent', () => {
  describe('constructor', () => {
    it('should create UIAgent instance', () => {
      const agent = new UIAgent();
      expect(agent).toBeDefined();
    });

    it('should accept custom config', () => {
      const agent = new UIAgent({
        agentId: 'custom-agent',
        name: 'CustomAgent',
      });
      expect(agent).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start the agent', async () => {
      const agent = new UIAgent();
      await agent.start();
      expect(agent.getState().status).toBe('idle');
    });

    it('should stop the agent', async () => {
      const agent = new UIAgent();
      await agent.start();
      await agent.stop();
      expect(agent.getState().status).toBe('offline');
    });
  });

  describe('pause/resume', () => {
    it('should pause the agent', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.pause();
      expect(agent.getState().status).toBe('paused');
    });

    it('should resume the agent', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.pause();
      agent.resume();
      expect(agent.getState().status).toBe('idle');
    });
  });

  describe('session management', () => {
    it('should start a session', async () => {
      const agent = new UIAgent();
      await agent.start();
      const session = agent.startSession();
      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^session_/);
    });

    it('should end a session', async () => {
      const agent = new UIAgent();
      await agent.start();
      const session = agent.startSession();
      await agent.endSession(session.sessionId);
      expect(agent.getCurrentSession()).toBeUndefined();
    });

    it('should get current session', async () => {
      const agent = new UIAgent();
      await agent.start();
      const session = agent.startSession();
      expect(agent.getCurrentSession()?.sessionId).toBe(session.sessionId);
    });
  });

  describe('getState', () => {
    it('should return agent state', () => {
      const agent = new UIAgent();
      const state = agent.getState();
      expect(state).toHaveProperty('status');
      expect(state).toHaveProperty('totalOperations');
      expect(state).toHaveProperty('successfulOperations');
    });
  });

  describe('getConfig', () => {
    it('should return agent config', () => {
      const agent = new UIAgent({ name: 'TestAgent' });
      const config = agent.getConfig();
      expect(config.name).toBe('TestAgent');
    });
  });

  describe('setPermissionLevel', () => {
    it('should set permission level', async () => {
      const agent = new UIAgent();
      await agent.start();
      agent.setPermissionLevel('L3');
      expect(agent.getState().permissionLevel).toBe('L3');
    });
  });

  describe('getStats', () => {
    it('should return agent statistics', () => {
      const agent = new UIAgent();
      const stats = agent.getStats();
      expect(stats).toHaveProperty('totalOperations');
      expect(stats).toHaveProperty('successRate');
    });
  });

  describe('createUIAgent', () => {
    it('should create UIAgent instance', () => {
      const agent = createUIAgent();
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(UIAgent);
    });
  });
});
