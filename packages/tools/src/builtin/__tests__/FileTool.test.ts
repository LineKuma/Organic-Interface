import { describe, it, expect, beforeEach } from 'vitest';
import { FileTool, createFileTool } from '../FileTool.js';
import type { ToolExecutionContext } from '../../types/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('FileTool', () => {
  let tool: FileTool;
  let tempDir: string;

  beforeEach(async () => {
    tool = new FileTool();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filetool-test-'));
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

    it('should require source and destination for move operation', () => {
      const errors = tool.validate({ operation: 'move' });
      expect(errors.some(e => e.path === 'source')).toBe(true);
      expect(errors.some(e => e.path === 'destination')).toBe(true);
    });

    it('should validate stat operation', () => {
      const errors = tool.validate({ operation: 'stat' });
      expect(errors.some(e => e.path === 'path')).toBe(true);
    });

    it('should validate mkdir operation', () => {
      const errors = tool.validate({ operation: 'mkdir' });
      expect(errors.some(e => e.path === 'path')).toBe(true);
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

    it('should execute exists operation', async () => {
      const testFile = path.join(tempDir, 'exists-test.txt');
      await fs.writeFile(testFile, 'content');

      const result = await tool.execute({ operation: 'exists', path: testFile }, mockContext);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should execute exists for non-existent file', async () => {
      const result = await tool.execute(
        { operation: 'exists', path: '/non/existent/path' },
        mockContext
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('should execute write operation', async () => {
      const testFile = path.join(tempDir, 'write-test.txt');
      const result = await tool.execute(
        { operation: 'write', path: testFile, content: 'test content' },
        mockContext
      );
      expect(result.success).toBe(true);
      expect((result.data as any).bytes).toBe(12);

      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('test content');
    });

    it('should execute write with createDirectories', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'file.txt');
      const result = await tool.execute(
        { operation: 'write', path: nestedPath, content: 'nested', createDirectories: true },
        mockContext
      );
      expect(result.success).toBe(true);

      const content = await fs.readFile(nestedPath, 'utf-8');
      expect(content).toBe('nested');
    });

    it('should execute read operation', async () => {
      const testFile = path.join(tempDir, 'read-test.txt');
      await fs.writeFile(testFile, 'read content');

      const result = await tool.execute({ operation: 'read', path: testFile }, mockContext);
      expect(result.success).toBe(true);
      expect(result.data).toBe('read content');
    });

    it('should execute delete operation', async () => {
      const testFile = path.join(tempDir, 'delete-test.txt');
      await fs.writeFile(testFile, 'content');

      const result = await tool.execute({ operation: 'delete', path: testFile }, mockContext);
      expect(result.success).toBe(true);

      const exists = await fs
        .access(testFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('should execute stat operation', async () => {
      const testFile = path.join(tempDir, 'stat-test.txt');
      await fs.writeFile(testFile, 'stat content');

      const result = await tool.execute({ operation: 'stat', path: testFile }, mockContext);
      expect(result.success).toBe(true);
      expect((result.data as any).isFile).toBe(true);
      expect((result.data as any).isDirectory).toBe(false);
    });

    it('should execute mkdir operation', async () => {
      const newDir = path.join(tempDir, 'new-dir');
      const result = await tool.execute({ operation: 'mkdir', path: newDir }, mockContext);
      expect(result.success).toBe(true);

      const stat = await fs.stat(newDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should execute list operation', async () => {
      await fs.mkdir(path.join(tempDir, 'list-dir'));
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'f1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'f2');

      const result = await tool.execute({ operation: 'list', path: tempDir }, mockContext);
      expect(result.success).toBe(true);
      expect((result.data as string[]).length).toBeGreaterThan(0);
    });

    it('should execute list with pattern', async () => {
      await fs.writeFile(path.join(tempDir, 'match.txt'), 'content');
      await fs.writeFile(path.join(tempDir, 'skip.txt'), 'content');

      const result = await tool.execute(
        { operation: 'list', path: tempDir, pattern: 'match*' },
        mockContext
      );
      expect(result.success).toBe(true);
      const files = result.data as string[];
      expect(files.some(f => f.includes('match.txt'))).toBe(true);
      expect(files.some(f => f.includes('skip.txt'))).toBe(false);
    });

    it('should execute copy operation', async () => {
      const source = path.join(tempDir, 'source.txt');
      const dest = path.join(tempDir, 'dest.txt');
      await fs.writeFile(source, 'copy content');

      const result = await tool.execute(
        { operation: 'copy', source, destination: dest },
        mockContext
      );
      expect(result.success).toBe(true);

      const destContent = await fs.readFile(dest, 'utf-8');
      expect(destContent).toBe('copy content');
    });

    it('should execute move operation', async () => {
      const source = path.join(tempDir, 'move-source.txt');
      const dest = path.join(tempDir, 'move-dest.txt');
      await fs.writeFile(source, 'move content');

      const result = await tool.execute(
        { operation: 'move', source, destination: dest },
        mockContext
      );
      expect(result.success).toBe(true);

      const destContent = await fs.readFile(dest, 'utf-8');
      expect(destContent).toBe('move content');

      const sourceExists = await fs
        .access(source)
        .then(() => true)
        .catch(() => false);
      expect(sourceExists).toBe(false);
    });

    it('should handle execute errors', async () => {
      const result = await tool.execute(
        { operation: 'read', path: '/non/existent/file' },
        mockContext
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
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
