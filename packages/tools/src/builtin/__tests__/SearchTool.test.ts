import { describe, it, expect, vi } from 'vitest';
import { SearchTool, createSearchTool } from '../SearchTool.js';
import type { ToolExecutionContext } from '../../types/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('SearchTool', () => {
  let tempDir: string;
  let testFiles: string[];

  const mockContext: ToolExecutionContext = {
    toolId: 'builtin:search',
    executionId: 'exec-1',
    workingDirectory: '/tmp',
    environment: {},
    cancelled: false,
    permissionLevel: 'L2',
    metadata: {},
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'searchtool-test-'));
    testFiles = [];
  });

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

    it('should require paths for grep operation', () => {
      const tool = new SearchTool();
      const errors = tool.validate({
        operation: 'grep',
        pattern: 'test',
      });
      expect(errors.some(e => e.path === 'paths')).toBe(true);
    });

    it('should require paths for find operation', () => {
      const tool = new SearchTool();
      const errors = tool.validate({
        operation: 'find',
        pattern: '*.txt',
      });
      expect(errors.some(e => e.path === 'paths')).toBe(true);
    });

    it('should require paths for query operation', () => {
      const tool = new SearchTool();
      const errors = tool.validate({
        operation: 'query',
        query: 'test',
      });
      expect(errors.some(e => e.path === 'paths')).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute index operation', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'index',
          index: 'test-index',
          documentId: 'doc-1',
          document: { title: 'Test Document', content: 'test content' },
        },
        mockContext
      );
      expect(result.success).toBe(true);
      expect((result.data as any).indexed).toBe(true);
    });

    it('should execute query operation', async () => {
      const tool = new SearchTool();
      await tool.execute(
        {
          operation: 'index',
          index: 'test-index',
          documentId: 'doc-1',
          document: { title: 'Test', content: 'hello world' },
        },
        mockContext
      );

      const result = await tool.execute(
        {
          operation: 'query',
          query: 'hello',
          index: 'test-index',
        },
        mockContext
      );
      expect(result.success).toBe(true);
    });

    it('should execute suggest operation', async () => {
      const tool = new SearchTool();
      await tool.execute(
        {
          operation: 'index',
          index: 'test-index',
          documentId: 'doc-1',
          document: { content: 'testing suggestions' },
        },
        mockContext
      );

      const result = await tool.execute(
        {
          operation: 'suggest',
          query: 'tes',
          index: 'test-index',
        },
        mockContext
      );
      expect(result.success).toBe(true);
    });

    it('should handle query with no index', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'query',
          query: 'test',
          index: 'non-existent-index',
        },
        mockContext
      );
      expect(result.success).toBe(true);
      expect((result.data as any).count).toBe(0);
    });

    it('should handle suggest with no index', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'suggest',
          query: 'test',
          index: 'non-existent-index',
        },
        mockContext
      );
      expect(result.success).toBe(true);
      expect((result.data as any).suggestions).toEqual([]);
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
