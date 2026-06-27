import { describe, it, expect } from 'vitest';
import { BuiltinToolService } from '../BuiltinToolService.js';
import { ToolType } from '@organic/utils';

describe('BuiltinToolService', () => {
  describe('getToolDefinitions', () => {
    it('should return all tool definitions', () => {
      const definitions = BuiltinToolService.getToolDefinitions();
      expect(definitions.length).toBeGreaterThan(0);
    });

    it('should have required fields in each definition', () => {
      const definitions = BuiltinToolService.getToolDefinitions();
      for (const def of definitions) {
        expect(def.name).toBeDefined();
        expect(def.version).toBeDefined();
        expect(def.description).toBeDefined();
        expect(def.type).toBeDefined();
        expect(def.call_level).toBeDefined();
        expect(def.parameters).toBeDefined();
      }
    });
  });

  describe('getToolDefinition', () => {
    it('should return definition for existing tool', () => {
      const definition = BuiltinToolService.getToolDefinition('file_read');
      expect(definition).toBeDefined();
      expect(definition?.name).toBe('file_read');
    });

    it('should return null for non-existent tool', () => {
      const definition = BuiltinToolService.getToolDefinition('non-existent-tool');
      expect(definition).toBeNull();
    });
  });

  describe('getToolsByType', () => {
    it('should return tools by type', () => {
      const fileTools = BuiltinToolService.getToolsByType(ToolType.FILE_OPERATION);
      expect(fileTools.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown type', () => {
      const unknownTools = BuiltinToolService.getToolsByType('UNKNOWN' as ToolType);
      expect(unknownTools.length).toBe(0);
    });
  });

  describe('getToolNames', () => {
    it('should return all tool names', () => {
      const names = BuiltinToolService.getToolNames();
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('file_read');
      expect(names).toContain('file_write');
    });
  });

  describe('isBuiltinTool', () => {
    it('should return true for built-in tool', () => {
      expect(BuiltinToolService.isBuiltinTool('file_read')).toBe(true);
    });

    it('should return false for non-built-in tool', () => {
      expect(BuiltinToolService.isBuiltinTool('non-existent-tool')).toBe(false);
    });
  });

  describe('getToolMetadata', () => {
    it('should return metadata for existing tool', () => {
      const metadata = BuiltinToolService.getToolMetadata('file_read');
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('file_read');
      expect(metadata?.description).toBeDefined();
    });

    it('should return null for non-existent tool', () => {
      const metadata = BuiltinToolService.getToolMetadata('non-existent-tool');
      expect(metadata).toBeNull();
    });
  });
});
