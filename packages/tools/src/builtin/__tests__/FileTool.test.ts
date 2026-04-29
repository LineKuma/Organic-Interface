import { describe, it, expect, beforeEach } from 'vitest';
import { FileTool, createFileTool } from '../FileTool.js';
import type { ToolExecutionContext } from '../../types/index.js';

describe('FileTool', () => {
  let tool: FileTool;

  beforeEach(() => {
    tool = new FileTool();
  });

  describe('constructor', () => {
    it('should create FileTool instance', () => {
      expect(tool).toBeDefined();
    });
  });

  describe('getDefinition', () => {
    it('should return tool definition', () => {
      const definition = tool.getDefinition();
      expect(definition.id).toBe('builtin:file');
      expect(definition.name).toBe('FileTool');
      expect(definition.category).toBe('file');
      expect(definition.enabled).toBe(true);
    });

    it('should have valid input schema', () => {
      const definition = tool.getDefinition();
      expect(definition.inputSchema).toBeDefined();
      expect(definition.inputSchema.type).toBe('object');
    });
  });

  describe('validate', () => {
    it('should return no errors for valid input', () => {
      const errors = tool.validate({ operation: 'exists', path: '/tmp/test' });
      expect(errors).toHaveLength(0);
    });

    it('should require operation', () => {
      const errors = tool.validate({});
      expect(errors.some(e => e.path === 'operation')).toBe(true);
    });

    it('should reject invalid operation', () => {
      const errors = tool.validate({ operation: 'invalid' });
      expect(errors.some(e => e.message.includes('Invalid operation'))).toBe(true);
    });

    it('should require path for read operation', () => {
      const errors = tool.validate({ operation: 'read' });
      expect(errors.some(e => e.path === 'path')).toBe(true);
    });

    it('should require content for write operation', () => {
      const errors = tool.validate({ operation: 'write', path: '/tmp/test' });
      expect(errors.some(e => e.path === 'content')).toBe(true);
    });

    it('should require source and destination for copy operation', () => {
      const errors = tool.validate({ operation: 'copy' });
      expect(errors.some(e => e.path === 'source')).toBe(true);
      expect(errors.some(e => e.path === 'destination')).toBe(true);
    });
  });

  describe('execute', () => {
    const mockContext: ToolExecutionContext = {
      toolId: 'builtin:file',
      executionId: 'exec-1',
      workingDirectory: '/tmp',
      environment: {},
      cancelled: false,
      permissionLevel: 'L2',
      metadata: {},
    };

    it('should return error for invalid operation', async () => {
      const result = await tool.execute({ operation: 'invalid' }, mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown operation');
    });
  });

  describe('createFileTool', () => {
    it('should create FileTool instance', () => {
      const instance = createFileTool();
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(FileTool);
    });
  });
});
