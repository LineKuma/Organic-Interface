import { describe, it, expect, vi } from 'vitest';
import { ShellTool, createShellTool } from '../ShellTool.js';

describe('ShellTool', () => {
  describe('constructor', () => {
    it('should create ShellTool instance', () => {
      const tool = new ShellTool();
      expect(tool).toBeDefined();
    });
  });

  describe('getDefinition', () => {
    it('should return tool definition', () => {
      const tool = new ShellTool();
      const definition = tool.getDefinition();
      expect(definition.id).toBe('builtin:shell');
      expect(definition.name).toBe('ShellTool');
      expect(definition.category).toBe('shell');
    });
  });

  describe('validate', () => {
    it('should require command', () => {
      const tool = new ShellTool();
      const errors = tool.validate({});
      expect(errors.some(e => e.path === 'command')).toBe(true);
    });

    it('should accept valid input', () => {
      const tool = new ShellTool();
      const errors = tool.validate({ command: 'ls -la' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('createShellTool', () => {
    it('should create ShellTool instance', () => {
      const instance = createShellTool();
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(ShellTool);
    });
  });
});
