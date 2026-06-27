import { describe, it, expect, beforeEach } from 'vitest';
import { SearchTool, createSearchTool } from '../SearchTool.js';
import type { ToolExecutionContext } from '../../types/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('SearchTool', () => {
  let tempDir: string;

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

    it('should track execution time', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'index',
          index: 'test-index',
          documentId: 'doc-1',
          document: { title: 'Test', content: 'test' },
        },
        mockContext
      );
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should return results with count', async () => {
      const tool = new SearchTool();
      await tool.execute(
        {
          operation: 'index',
          index: 'test-index',
          documentId: 'doc-1',
          document: { title: 'Test', content: 'hello world test' },
        },
        mockContext
      );

      const result = await tool.execute(
        {
          operation: 'query',
          query: 'test',
          index: 'test-index',
        },
        mockContext
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.count).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple documents in index', async () => {
      const tool = new SearchTool();

      await tool.execute(
        {
          operation: 'index',
          index: 'multi-index',
          documentId: 'doc-1',
          document: { content: 'apple banana' },
        },
        mockContext
      );

      await tool.execute(
        {
          operation: 'index',
          index: 'multi-index',
          documentId: 'doc-2',
          document: { content: 'banana cherry' },
        },
        mockContext
      );

      const result = await tool.execute(
        {
          operation: 'query',
          query: 'banana',
          index: 'multi-index',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.count).toBe(2);
    });
  });

  describe('createSearchTool', () => {
    it('should create SearchTool instance', () => {
      const instance = createSearchTool();
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(SearchTool);
    });
  });

  describe('execute - grep operation', () => {
    beforeEach(async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.txt'),
        `line one
line two hello
line three world
line four hello world
line five
`
      );
    });

    it('should execute grep and return results with count', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'grep',
          pattern: 'hello',
          paths: [tempDir],
          options: { extensions: ['txt'] },
        },
        mockContext
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.results).toBeDefined();
      expect(data.count).toBe(2);
      expect(data.count).toBe(data.results.length);
    });

    it('should return correct line numbers and content in grep results', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'grep',
          pattern: 'hello',
          paths: [tempDir],
          options: { extensions: ['txt'] },
        },
        mockContext
      );
      const data = result.data as any;
      expect(data.results[0].line).toBe(2);
      expect(data.results[0].content).toContain('hello');
      expect(data.results[1].line).toBe(4);
    });

    it('should support context lines in grep (before/after)', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'grep',
          pattern: 'three',
          paths: [tempDir],
          options: { extensions: ['txt'], context: 1 },
        },
        mockContext
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.results).toHaveLength(1);
      expect(data.results[0].before).toEqual(['line two hello']);
      expect(data.results[0].after).toEqual(['line four hello world']);
    });

    it('should limit grep results', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'grep',
          pattern: 'line',
          paths: [tempDir],
          options: { extensions: ['txt'], limit: 2 },
        },
        mockContext
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.count).toBeLessThanOrEqual(2);
    });

    it('should support caseSensitive option in grep', async () => {
      const tool = new SearchTool();

      // Case insensitive by default - should match both
      const resultInsensitive = await tool.execute(
        {
          operation: 'grep',
          pattern: 'HELLO',
          paths: [tempDir],
          options: { extensions: ['txt'] },
        },
        mockContext
      );
      expect((resultInsensitive.data as any).count).toBe(2);

      // Case sensitive - should match none
      const resultSensitive = await tool.execute(
        {
          operation: 'grep',
          pattern: 'HELLO',
          paths: [tempDir],
          options: { extensions: ['txt'], caseSensitive: true },
        },
        mockContext
      );
      expect(resultSensitive.success).toBe(true);
      expect((resultSensitive.data as any).count).toBe(0);
    });

    it('should support regex option in grep', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'grep',
          pattern: 'h\\w+o',
          paths: [tempDir],
          options: { extensions: ['txt'], regex: true },
        },
        mockContext
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      // regex h\w+o should match "hello" on lines 2 and 4
      expect(data.count).toBe(2);
    });
  });

  describe('execute - find operation', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'dist'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'app.ts'), 'app content');
      await fs.writeFile(path.join(tempDir, 'src', 'utils.ts'), 'utils content');
      await fs.writeFile(path.join(tempDir, 'dist', 'app.js'), 'compiled');
      await fs.writeFile(path.join(tempDir, 'node_modules', 'dep.js'), 'dependency');
      await fs.writeFile(path.join(tempDir, 'README.md'), '# readme');
    });

    it('should find files matching name pattern', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'find',
          pattern: 'app',
          paths: [tempDir],
        },
        mockContext
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.files).toBeDefined();
      expect(data.count).toBeGreaterThanOrEqual(1);
      // Should find app.ts and app.js but not filtered by default
      expect(data.files.some((f: string) => f.includes('app'))).toBe(true);
    });

    it('should filter files by extensions', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'find',
          pattern: '.',
          paths: [tempDir],
          options: { extensions: ['ts'] },
        },
        mockContext
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      // Should only include .ts files
      expect(data.files.every((f: string) => f.endsWith('.ts'))).toBe(true);
      expect(data.count).toBe(2); // app.ts and utils.ts
    });

    it('should exclude directories from find', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'find',
          pattern: '.',
          paths: [tempDir],
          options: { excludeDirs: ['node_modules', 'dist'] },
        },
        mockContext
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      // Should not contain files from node_modules or dist
      expect(
        data.files.every((f: string) => !f.includes('node_modules') && !f.includes('dist'))
      ).toBe(true);
    });
  });

  describe('execute - unknown operation', () => {
    it('should throw error for unknown operation type', async () => {
      const tool = new SearchTool();
      const result = await tool.execute(
        {
          operation: 'unknown' as any,
        },
        mockContext
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown operation');
    });
  });

  describe('validate - index/suggest operations', () => {
    it('should not require paths for index operation', () => {
      const tool = new SearchTool();
      const errors = tool.validate({
        operation: 'index',
        index: 'test-index',
        documentId: 'doc-1',
        document: { title: 'Test' },
      });
      expect(errors).toHaveLength(0);
    });

    it('should not require paths for suggest operation', () => {
      const tool = new SearchTool();
      const errors = tool.validate({
        operation: 'suggest',
        query: 'test',
        index: 'test-index',
      });
      expect(errors).toHaveLength(0);
    });

    it('should validate index requires no extra fields beyond operation', () => {
      const tool = new SearchTool();
      const errors = tool.validate({
        operation: 'index',
      });
      // Only missing index/documentId/document are needed, not paths
      const hasPathsError = errors.some(e => e.path === 'paths');
      expect(hasPathsError).toBe(false);
    });
  });

  describe('execute - suggest no match', () => {
    it('should return empty suggestions when no words match query prefix', async () => {
      const tool = new SearchTool();
      await tool.execute(
        {
          operation: 'index',
          index: 'suggest-test',
          documentId: 'doc-1',
          document: { content: 'apple banana cherry' },
        },
        mockContext
      );

      const result = await tool.execute(
        {
          operation: 'suggest',
          query: 'zzz',
          index: 'suggest-test',
        },
        mockContext
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.suggestions).toEqual([]);
    });
  });

  describe('execute - index multiple documents', () => {
    it('should index and query multiple documents under same index', async () => {
      const tool = new SearchTool();

      await tool.execute(
        {
          operation: 'index',
          index: 'multi-doc-index',
          documentId: 'doc-alpha',
          document: { content: 'alpha beta gamma' },
        },
        mockContext
      );

      await tool.execute(
        {
          operation: 'index',
          index: 'multi-doc-index',
          documentId: 'doc-beta',
          document: { content: 'beta gamma delta' },
        },
        mockContext
      );

      await tool.execute(
        {
          operation: 'index',
          index: 'multi-doc-index',
          documentId: 'doc-gamma',
          document: { content: 'delta epsilon zeta' },
        },
        mockContext
      );

      // Query for "gamma" should match doc-alpha and doc-beta
      const result = await tool.execute(
        {
          operation: 'query',
          query: 'gamma',
          index: 'multi-doc-index',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.count).toBe(2);
      const ids = data.results.map((r: any) => r.id);
      expect(ids).toContain('doc-alpha');
      expect(ids).toContain('doc-beta');
    });
  });
});
