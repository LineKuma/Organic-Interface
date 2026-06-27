import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolService } from '../ToolService.js';
import type { Tool } from '../../types/index.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const createMockTool = (id: string, name: string = 'MockTool'): Tool => ({
  getDefinition: () => ({
    id,
    name,
    description: 'Mock tool for testing',
    category: 'custom',
    inputSchema: { type: 'object' },
    enabled: true,
    timeout: 5000,
  }),
  validate: () => [],
  execute: vi.fn().mockResolvedValue({
    success: true,
    data: { result: 'mocked' },
    executionTime: 10,
  }),
});

describe('ToolService', () => {
  let service: ToolService;

  beforeEach(() => {
    service = new ToolService();
  });

  describe('constructor', () => {
    it('should create service with default config', () => {
      expect(service).toBeDefined();
    });

    it('should accept custom config', () => {
      const customService = new ToolService({
        defaultTimeout: 60000,
        maxConcurrentExecutions: 20,
      });
      expect(customService).toBeDefined();
    });
  });

  describe('registerTool', () => {
    it('should register a tool', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      expect(service.hasTool('tool-1')).toBe(true);
    });

    it('should emit tool:registered event', () => {
      const handler = vi.fn();
      service.on('tool:registered', handler);
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      expect(handler).toHaveBeenCalled();
    });

    it('should warn on duplicate registration', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      service.registerTool(tool);
      expect(service.getAllTools()).toHaveLength(1);
    });
  });

  describe('unregisterTool', () => {
    it('should unregister existing tool', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      const result = service.unregisterTool('tool-1');
      expect(result).toBe(true);
      expect(service.hasTool('tool-1')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      const result = service.unregisterTool('non-existent');
      expect(result).toBe(false);
    });

    it('should emit tool:unregistered event', () => {
      const handler = vi.fn();
      service.on('tool:unregistered', handler);
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      service.unregisterTool('tool-1');
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getTool', () => {
    it('should get registered tool', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      const retrieved = service.getTool('tool-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.getDefinition().id).toBe('tool-1');
    });

    it('should return undefined for non-existent tool', () => {
      const retrieved = service.getTool('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getToolDefinition', () => {
    it('should get tool definition', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      const definition = service.getToolDefinition('tool-1');
      expect(definition).toBeDefined();
      expect(definition?.name).toBe('Tool1');
    });

    it('should return undefined for non-existent tool', () => {
      const definition = service.getToolDefinition('non-existent');
      expect(definition).toBeUndefined();
    });
  });

  describe('getAllTools', () => {
    it('should return all registered tools', () => {
      service.registerTool(createMockTool('tool-1', 'Tool1'));
      service.registerTool(createMockTool('tool-2', 'Tool2'));
      const tools = service.getAllTools();
      expect(tools).toHaveLength(2);
    });

    it('should return empty array when no tools', () => {
      const tools = service.getAllTools();
      expect(tools).toEqual([]);
    });
  });

  describe('getToolsByCategory', () => {
    it('should return tools by category', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      const tools = service.getToolsByCategory('custom');
      expect(tools).toHaveLength(1);
    });
  });

  describe('enableTool', () => {
    it('should enable existing tool', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      const result = service.enableTool('tool-1');
      expect(result).toBe(true);
      expect(service.isToolEnabled('tool-1')).toBe(true);
    });

    it('should emit tool:enabled event', () => {
      const handler = vi.fn();
      service.on('tool:enabled', handler);
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      service.enableTool('tool-1');
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('disableTool', () => {
    it('should disable existing tool', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      const result = service.disableTool('tool-1');
      expect(result).toBe(true);
      expect(service.isToolEnabled('tool-1')).toBe(false);
    });

    it('should emit tool:disabled event', () => {
      const handler = vi.fn();
      service.on('tool:disabled', handler);
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      service.disableTool('tool-1');
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('execute', () => {
    it('should return error for non-existent tool', async () => {
      const result = await service.execute('non-existent', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error for disabled tool', async () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      service.disableTool('tool-1');
      const result = await service.execute('tool-1', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('should execute tool successfully', async () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      const result = await service.execute('tool-1', { input: 'test' });
      expect(result.success).toBe(true);
    });

    it('should emit execution:start event', async () => {
      const handler = vi.fn();
      service.on('execution:start', handler);
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      await service.execute('tool-1', {});
      expect(handler).toHaveBeenCalled();
    });

    it('should emit execution:complete event', async () => {
      const handler = vi.fn();
      service.on('execution:complete', handler);
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      await service.execute('tool-1', {});
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should validate tool input', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      const errors = service.validate('tool-1', {});
      expect(Array.isArray(errors)).toBe(true);
    });

    it('should return error for non-existent tool', () => {
      const errors = service.validate('non-existent', {});
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('not found');
    });
  });

  describe('getToolStats', () => {
    it('should return tool stats', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      const stats = service.getToolStats('tool-1');
      expect(stats).toBeDefined();
      expect(stats?.totalExecutions).toBe(0);
    });

    it('should return undefined for non-existent tool', () => {
      const stats = service.getToolStats('non-existent');
      expect(stats).toBeUndefined();
    });
  });

  describe('getServiceStats', () => {
    it('should return service statistics', () => {
      service.registerTool(createMockTool('tool-1', 'Tool1'));
      service.registerTool(createMockTool('tool-2', 'Tool2'));
      const stats = service.getServiceStats();
      expect(stats.totalTools).toBe(2);
      expect(stats.enabledTools).toBe(2);
    });
  });

  describe('hasTool', () => {
    it('should return true for registered tool', () => {
      service.registerTool(createMockTool('tool-1', 'Tool1'));
      expect(service.hasTool('tool-1')).toBe(true);
    });

    it('should return false for non-registered tool', () => {
      expect(service.hasTool('non-existent')).toBe(false);
    });
  });

  describe('isToolEnabled', () => {
    it('should return true for enabled tool', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      expect(service.isToolEnabled('tool-1')).toBe(true);
    });

    it('should return false for disabled tool', () => {
      const tool = createMockTool('tool-1', 'Tool1');
      service.registerTool(tool);
      service.disableTool('tool-1');
      expect(service.isToolEnabled('tool-1')).toBe(false);
    });
  });

  describe('getActiveExecutionCount', () => {
    it('should return 0 initially', () => {
      expect(service.getActiveExecutionCount()).toBe(0);
    });
  });

  describe('canAcceptExecution', () => {
    it('should return true when under capacity', () => {
      expect(service.canAcceptExecution()).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all tools', () => {
      service.registerTool(createMockTool('tool-1', 'Tool1'));
      service.registerTool(createMockTool('tool-2', 'Tool2'));
      service.clear();
      expect(service.getAllTools()).toHaveLength(0);
    });
  });
});
