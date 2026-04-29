import { describe, it, expect, vi } from 'vitest';
import { SearchTool, createSearchTool } from '../SearchTool.js';

describe('SearchTool', () => {
  describe('constructor', () => {
    it('should create SearchTool instance', () => {
      const tool = new SearchTool();
      expect(tool).toBeDefined();
    });
  });

  describe('getDefinition', () => {
    it('should return tool definition', () => {
      const tool = new SearchTool();
      const definition = tool.getDefinition();
      expect(definition.id).toBe('builtin:search');
      expect(definition.name).toBe('SearchTool');
      expect(definition.category).toBe('search');
    });
  });

  describe('validate', () => {
    it('should require operation', () => {
      const tool = new SearchTool();
      const errors = tool.validate({});
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept valid query input', () => {
      const tool = new SearchTool();
      const errors = tool.validate({
        operation: 'query',
        query: 'test search',
        paths: ['/'],
      });
      expect(errors).toHaveLength(0);
    });

    it('should validate query requires query field', () => {
      const tool = new SearchTool();
      const errors = tool.validate({
        operation: 'query',
        paths: ['/'],
      });
      expect(errors.some(e => e.path === 'query')).toBe(true);
    });

    it('should validate grep requires pattern', () => {
      const tool = new SearchTool();
      const errors = tool.validate({
        operation: 'grep',
        paths: ['/'],
      });
      expect(errors.some(e => e.path === 'pattern')).toBe(true);
    });

    it('should accept valid grep input', () => {
      const tool = new SearchTool();
      const errors = tool.validate({
        operation: 'grep',
        pattern: 'test.*pattern',
        paths: ['/'],
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('createSearchTool', () => {
    it('should create SearchTool instance', () => {
      const instance = createSearchTool();
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(SearchTool);
    });
  });
});
