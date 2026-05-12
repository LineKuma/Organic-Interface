import { describe, it, expect } from 'vitest';
import type {
  AgentConfig,
  AgentConfigOptions} from '../AgentConfig.js';
import {
  AgentType,
  AgentPriority,
  DEFAULT_AGENT_CONFIG,
  createAgentConfig,
} from '../AgentConfig.js';

describe('AgentConfig', () => {
  describe('AgentType enum', () => {
    it('should have correct enum values', () => {
      expect(AgentType.ORCHESTRATOR).toBe('orchestrator');
      expect(AgentType.EXECUTOR).toBe('executor');
      expect(AgentType.PLANNER).toBe('planner');
      expect(AgentType.MONITOR).toBe('monitor');
      expect(AgentType.CUSTOM).toBe('custom');
    });
  });

  describe('AgentPriority enum', () => {
    it('should have correct priority values', () => {
      expect(AgentPriority.LOW).toBe(0);
      expect(AgentPriority.NORMAL).toBe(1);
      expect(AgentPriority.HIGH).toBe(2);
      expect(AgentPriority.CRITICAL).toBe(3);
    });
  });

  describe('DEFAULT_AGENT_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_AGENT_CONFIG.maxDepth).toBe(3);
      expect(DEFAULT_AGENT_CONFIG.maxParallelTasks).toBe(10);
      expect(DEFAULT_AGENT_CONFIG.communicationTimeout).toBe(5000);
      expect(DEFAULT_AGENT_CONFIG.heartbeatInterval).toBe(30);
      expect(DEFAULT_AGENT_CONFIG.capabilities).toEqual([]);
      expect(DEFAULT_AGENT_CONFIG.type).toBe(AgentType.EXECUTOR);
      expect(DEFAULT_AGENT_CONFIG.priority).toBe(AgentPriority.NORMAL);
    });
  });

  describe('createAgentConfig', () => {
    it('should create config with required fields', () => {
      const config = createAgentConfig({
        id: 'agent-1',
        name: 'TestAgent',
        version: '1.0.0',
      });

      expect(config.id).toBe('agent-1');
      expect(config.name).toBe('TestAgent');
      expect(config.version).toBe('1.0.0');
    });

    it('should apply default values', () => {
      const config = createAgentConfig({
        id: 'agent-1',
        name: 'TestAgent',
        version: '1.0.0',
      });

      expect(config.maxDepth).toBe(DEFAULT_AGENT_CONFIG.maxDepth);
      expect(config.maxParallelTasks).toBe(DEFAULT_AGENT_CONFIG.maxParallelTasks);
      expect(config.communicationTimeout).toBe(DEFAULT_AGENT_CONFIG.communicationTimeout);
    });

    it('should override defaults with provided values', () => {
      const config = createAgentConfig({
        id: 'agent-1',
        name: 'TestAgent',
        version: '1.0.0',
        maxDepth: 5,
        maxParallelTasks: 20,
        capabilities: ['cap1'],
      });

      expect(config.maxDepth).toBe(5);
      expect(config.maxParallelTasks).toBe(20);
      expect(config.capabilities).toEqual(['cap1']);
    });

    it('should preserve additional properties', () => {
      const config = createAgentConfig({
        id: 'agent-1',
        name: 'TestAgent',
        version: '1.0.0',
        description: 'A test agent',
        options: { customOption: true },
      });

      expect(config.description).toBe('A test agent');
      expect(config.options).toEqual({ customOption: true });
    });
  });

  describe('AgentConfig interface', () => {
    it('should accept all required properties', () => {
      const config: AgentConfig = {
        id: 'agent-1',
        name: 'TestAgent',
        version: '1.0.0',
        maxDepth: 3,
        maxParallelTasks: 10,
        communicationTimeout: 5000,
        heartbeatInterval: 30,
        capabilities: ['cap1', 'cap2'],
        type: AgentType.EXECUTOR,
        priority: AgentPriority.NORMAL,
      };

      expect(config.id).toBe('agent-1');
      expect(config.capabilities).toHaveLength(2);
    });

    it('should accept optional properties', () => {
      const config: AgentConfig = {
        id: 'agent-1',
        name: 'TestAgent',
        version: '1.0.0',
        maxDepth: 3,
        maxParallelTasks: 10,
        communicationTimeout: 5000,
        heartbeatInterval: 30,
        capabilities: [],
        type: AgentType.EXECUTOR,
        priority: AgentPriority.NORMAL,
        description: 'Test description',
        parentId: 'parent-agent',
        options: { key: 'value' },
      };

      expect(config.description).toBe('Test description');
      expect(config.parentId).toBe('parent-agent');
      expect(config.options).toEqual({ key: 'value' });
    });
  });

  describe('AgentConfigOptions interface', () => {
    it('should accept kernel and config', () => {
      const options: AgentConfigOptions = {
        kernel: {} as any,
        config: {
          id: 'agent-1',
          name: 'TestAgent',
          version: '1.0.0',
        },
      };

      expect(options.kernel).toBeDefined();
      expect(options.config.id).toBe('agent-1');
    });

    it('should accept optional debug flag', () => {
      const options: AgentConfigOptions = {
        kernel: {} as any,
        config: {
          id: 'agent-1',
          name: 'TestAgent',
          version: '1.0.0',
        },
        debug: true,
      };

      expect(options.debug).toBe(true);
    });

    it('should accept optional prefix', () => {
      const options: AgentConfigOptions = {
        kernel: {} as any,
        config: {
          id: 'agent-1',
          name: 'TestAgent',
          version: '1.0.0',
        },
        prefix: 'custom-prefix',
      };

      expect(options.prefix).toBe('custom-prefix');
    });
  });
});
