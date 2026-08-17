import { describe, it, expect } from 'vitest';
import type { AgentState, AgentStats } from '../AgentState.js';
import { AgentStatus, createAgentState, getAgentStats } from '../AgentState.js';

describe('AgentState', () => {
  describe('AgentStatus enum', () => {
    it('should have correct status values', () => {
      expect(AgentStatus.IDLE).toBe('idle');
      expect(AgentStatus.BUSY).toBe('busy');
      expect(AgentStatus.ERROR).toBe('error');
      expect(AgentStatus.OFFLINE).toBe('offline');
      expect(AgentStatus.INITIALIZING).toBe('initializing');
      expect(AgentStatus.SHUTTING_DOWN).toBe('shutting_down');
    });
  });

  describe('createAgentState', () => {
    it('should create state with required fields', () => {
      const state = createAgentState({
        agentId: 'agent-1',
        name: 'TestAgent',
      });

      expect(state.agentId).toBe('agent-1');
      expect(state.name).toBe('TestAgent');
    });

    it('should set initial status to IDLE', () => {
      const state = createAgentState({
        agentId: 'agent-1',
        name: 'TestAgent',
      });

      expect(state.status).toBe(AgentStatus.IDLE);
    });

    it('should initialize counters to zero', () => {
      const state = createAgentState({
        agentId: 'agent-1',
        name: 'TestAgent',
      });

      expect(state.load).toBe(0);
      expect(state.activeTaskCount).toBe(0);
      expect(state.completedTaskCount).toBe(0);
      expect(state.failedTaskCount).toBe(0);
      expect(state.totalExecutionTime).toBe(0);
      expect(state.avgResponseTime).toBe(0);
    });

    it('should set timestamps', () => {
      const before = Date.now();
      const state = createAgentState({
        agentId: 'agent-1',
        name: 'TestAgent',
      });
      const after = Date.now();

      expect(state.lastHeartbeat).toBeGreaterThanOrEqual(before);
      expect(state.lastHeartbeat).toBeLessThanOrEqual(after);
      expect(state.startTime).toBeGreaterThanOrEqual(before);
      expect(state.startTime).toBeLessThanOrEqual(after);
    });

    it('should initialize empty childIds array', () => {
      const state = createAgentState({
        agentId: 'agent-1',
        name: 'TestAgent',
      });

      expect(state.childIds).toEqual([]);
    });

    it('should initialize empty metadata', () => {
      const state = createAgentState({
        agentId: 'agent-1',
        name: 'TestAgent',
      });

      expect(state.metadata).toEqual({});
    });

    it('should use provided capabilities', () => {
      const state = createAgentState({
        agentId: 'agent-1',
        name: 'TestAgent',
        capabilities: ['cap1', 'cap2'],
      });

      expect(state.capabilities).toEqual(['cap1', 'cap2']);
    });

    it('should use provided parentId', () => {
      const state = createAgentState({
        agentId: 'agent-1',
        name: 'TestAgent',
        parentId: 'parent-1',
      });

      expect(state.parentId).toBe('parent-1');
    });
  });

  describe('AgentState interface', () => {
    it('should accept all required properties', () => {
      const state: AgentState = {
        agentId: 'agent-1',
        name: 'TestAgent',
        status: AgentStatus.IDLE,
        capabilities: [],
        load: 0,
        activeTaskCount: 0,
        completedTaskCount: 0,
        failedTaskCount: 0,
        totalExecutionTime: 0,
        avgResponseTime: 0,
        lastHeartbeat: Date.now(),
        startTime: Date.now(),
        childIds: [],
        metadata: {},
      };

      expect(state.agentId).toBe('agent-1');
    });

    it('should accept optional errorMessage', () => {
      const state: AgentState = {
        agentId: 'agent-1',
        name: 'TestAgent',
        status: AgentStatus.ERROR,
        capabilities: [],
        load: 0,
        activeTaskCount: 0,
        completedTaskCount: 0,
        failedTaskCount: 0,
        totalExecutionTime: 0,
        avgResponseTime: 0,
        lastHeartbeat: Date.now(),
        startTime: Date.now(),
        childIds: [],
        metadata: {},
        errorMessage: 'Something went wrong',
      };

      expect(state.errorMessage).toBe('Something went wrong');
    });
  });

  describe('getAgentStats', () => {
    it('should calculate stats from state', () => {
      const now = Date.now();
      const state: AgentState = {
        agentId: 'agent-1',
        name: 'TestAgent',
        status: AgentStatus.IDLE,
        capabilities: [],
        load: 0.5,
        activeTaskCount: 2,
        completedTaskCount: 10,
        failedTaskCount: 2,
        totalExecutionTime: 1000,
        avgResponseTime: 100,
        lastHeartbeat: now,
        startTime: now - 60000,
        childIds: [],
        metadata: {},
      };

      const stats = getAgentStats(state);

      expect(stats.completedTasks).toBe(10);
      expect(stats.failedTasks).toBe(2);
      expect(stats.totalExecutionTime).toBe(1000);
      expect(stats.avgResponseTime).toBe(100);
      expect(stats.loadPercentage).toBe(50);
      expect(stats.uptime).toBeGreaterThanOrEqual(60000);
    });

    it('should calculate load percentage correctly', () => {
      const state: AgentState = {
        agentId: 'agent-1',
        name: 'TestAgent',
        status: AgentStatus.IDLE,
        capabilities: [],
        load: 0.75,
        activeTaskCount: 0,
        completedTaskCount: 0,
        failedTaskCount: 0,
        totalExecutionTime: 0,
        avgResponseTime: 0,
        lastHeartbeat: Date.now(),
        startTime: Date.now(),
        childIds: [],
        metadata: {},
      };

      const stats = getAgentStats(state);
      expect(stats.loadPercentage).toBe(75);
    });
  });

  describe('AgentStats interface', () => {
    it('should accept all required properties', () => {
      const stats: AgentStats = {
        completedTasks: 10,
        failedTasks: 2,
        totalExecutionTime: 1000,
        avgResponseTime: 100,
        loadPercentage: 50,
        uptime: 60000,
      };

      expect(stats.completedTasks).toBe(10);
      expect(stats.failedTasks).toBe(2);
    });
  });
});
