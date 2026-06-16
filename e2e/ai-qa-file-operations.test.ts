/**
 * AI Q&A File Operations E2E Tests
 *
 * Tests focused on file read/write operations simulated through an AI agent.
 * Uses real filesystem operations with fixed (mock) AI responses.
 * Tests: read, write, append, copy, move, delete, exists, stat, list, mkdir operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolService, FileTool, type ToolResult, type ToolExecutionContext } from '@organic/tools';
import { Agent, AgentType, AgentPriority, type AgentTaskInput } from '@organic/agent';

// ── Mock Kernel ──────────────────────────────────────────────────

function createMockKernel() {
  return {
    registerPlugin: async () => ({ success: true }),
    unregisterPlugin: async () => ({ success: true }),
    getPlugin: () => undefined,
    getPlugins: () => [],
    getStatus: () => ({ state: 'running', uptime: 0 }),
    emit: () => {},
    on: () => {},
    off: () => {},
    getConfig: () => ({ name: 'mock-kernel', version: '1.0.0' }),
    stop: async () => {},
    initialize: async () => {},
  };
}

// ── Test Helpers ──────────────────────────────────────────────────

function createToolContext(overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
  return {
    toolId: 'test-tool',
    executionId: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workingDirectory: process.cwd(),
    environment: {},
    cancelled: false,
    permissionLevel: 'L3',
    metadata: {},
    ...overrides,
  };
}

function createFileHandler(
  toolService: ToolService,
  answer: string,
  toolCalls: Array<{ toolId: string; input: unknown }>
) {
  return async (payload: Record<string, unknown>) => {
    const results: ToolResult[] = [];
    for (const tc of toolCalls) {
      const ctx = createToolContext({ toolId: tc.toolId });
      const result = await toolService.execute(tc.toolId, tc.input, ctx);
      results.push(result);
    }
    return { answer, toolResults: results, query: payload.query };
  };
}

// ── Test Suite ────────────────────────────────────────────────────

describe('AI Q&A File Operations', () => {
  let toolService: ToolService;
  let agent: Agent;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-e2e-files-'));
    toolService = new ToolService({
      enableValidation: true,
      enableLogging: false,
      enableMetrics: true,
      defaultTimeout: 10000,
    });
    toolService.registerTool(new FileTool());

    agent = new Agent({
      kernel: createMockKernel() as any,
      config: {
        id: 'file-agent',
        name: 'File Operations Agent',
        version: '1.0.0',
        type: AgentType.EXECUTOR,
        priority: AgentPriority.NORMAL,
        capabilities: ['file_operations'],
      },
    });
    await agent.initialize();
  });

  afterEach(async () => {
    await agent.shutdown();
    toolService.clear();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  describe('Read Operations', () => {
    it('should read text file content', async () => {
      const filePath = path.join(tempDir, 'readme.txt');
      await fs.writeFile(filePath, 'Hello World', 'utf-8');

      agent.registerTaskHandler('ai:read_text', createFileHandler(
        toolService, 'Read successful.',
        [{ toolId: 'builtin:file', input: { operation: 'read', path: filePath } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:read_text', payload: { query: 'read' },
      });

      expect(result.data!.toolResults[0].data).toBe('Hello World');
    });

    it('should read JSON file content', async () => {
      const filePath = path.join(tempDir, 'config.json');
      const json = JSON.stringify({ name: 'Organic', version: '1.0.0' });
      await fs.writeFile(filePath, json, 'utf-8');

      agent.registerTaskHandler('ai:read_json', createFileHandler(
        toolService, 'JSON read.',
        [{ toolId: 'builtin:file', input: { operation: 'read', path: filePath } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:read_json', payload: { query: 'read' },
      });

      expect(result.data!.toolResults[0].data).toBe(json);
    });

    it('should fail reading non-existent file', async () => {
      const filePath = path.join(tempDir, 'does-not-exist.txt');

      agent.registerTaskHandler('ai:read_missing', createFileHandler(
        toolService, 'File not found.',
        [{ toolId: 'builtin:file', input: { operation: 'read', path: filePath } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:read_missing', payload: { query: 'read' },
      });

      expect(result.data!.toolResults[0].success).toBe(false);
      expect(result.data!.toolResults[0].error).toContain('ENOENT');
    });

    it('should read large file content', async () => {
      const filePath = path.join(tempDir, 'large.txt');
      const largeContent = 'A'.repeat(10000);
      await fs.writeFile(filePath, largeContent, 'utf-8');

      agent.registerTaskHandler('ai:read_large', createFileHandler(
        toolService, 'Large file read.',
        [{ toolId: 'builtin:file', input: { operation: 'read', path: filePath } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:read_large', payload: { query: 'read' },
      });

      expect(result.data!.toolResults[0].data).toBe(largeContent);
    });
  });

  describe('Write Operations', () => {
    it('should write text file', async () => {
      const filePath = path.join(tempDir, 'output.txt');
      const content = 'AI-generated output';

      agent.registerTaskHandler('ai:write_text', createFileHandler(
        toolService, 'Written.',
        [{ toolId: 'builtin:file', input: { operation: 'write', path: filePath, content } }],
      ));

      await agent.execute({ taskId: 'ai:write_text', payload: { query: 'write' } });
      expect(await fs.readFile(filePath, 'utf-8')).toBe(content);
    });

    it('should write file with auto-create directories', async () => {
      const filePath = path.join(tempDir, 'deep', 'nested', 'file.txt');
      const content = 'Nested content';

      agent.registerTaskHandler('ai:write_nested', createFileHandler(
        toolService, 'Written.',
        [{ toolId: 'builtin:file', input: { operation: 'write', path: filePath, content, createDirectories: true } }],
      ));

      await agent.execute({ taskId: 'ai:write_nested', payload: { query: 'write' } });
      expect(await fs.readFile(filePath, 'utf-8')).toBe(content);
    });

    it('should overwrite existing file', async () => {
      const filePath = path.join(tempDir, 'overwrite.txt');
      await fs.writeFile(filePath, 'original', 'utf-8');

      agent.registerTaskHandler('ai:overwrite', createFileHandler(
        toolService, 'Overwritten.',
        [{ toolId: 'builtin:file', input: { operation: 'write', path: filePath, content: 'updated' } }],
      ));

      await agent.execute({ taskId: 'ai:overwrite', payload: { query: 'write' } });
      expect(await fs.readFile(filePath, 'utf-8')).toBe('updated');
    });

    it('should write JSON file', async () => {
      const filePath = path.join(tempDir, 'data.json');
      const json = JSON.stringify({ items: [1, 2, 3], total: 6 });

      agent.registerTaskHandler('ai:write_json', createFileHandler(
        toolService, 'JSON written.',
        [{ toolId: 'builtin:file', input: { operation: 'write', path: filePath, content: json } }],
      ));

      await agent.execute({ taskId: 'ai:write_json', payload: { query: 'write' } });
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      expect(parsed.items).toEqual([1, 2, 3]);
    });
  });

  describe('File Management', () => {
    it('should check file existence', async () => {
      const filePath = path.join(tempDir, 'exists.txt');
      await fs.writeFile(filePath, 'exists', 'utf-8');

      agent.registerTaskHandler('ai:exists', createFileHandler(
        toolService, 'Checked.',
        [{ toolId: 'builtin:file', input: { operation: 'exists', path: filePath } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:exists', payload: { query: 'check' },
      });

      expect(result.data!.toolResults[0].data).toBe(true);
    });

    it('should get file stats', async () => {
      const filePath = path.join(tempDir, 'stats.txt');
      const content = 'stat me';
      await fs.writeFile(filePath, content, 'utf-8');

      agent.registerTaskHandler('ai:stat', createFileHandler(
        toolService, 'Statted.',
        [{ toolId: 'builtin:file', input: { operation: 'stat', path: filePath } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:stat', payload: { query: 'stat' },
      });

      const stat = result.data!.toolResults[0].data as any;
      expect(stat.isFile).toBe(true);
      expect(stat.size).toBe(content.length);
      expect(stat.modified).toBeDefined();
    });

    it('should copy file', async () => {
      const src = path.join(tempDir, 'src.txt');
      const dest = path.join(tempDir, 'dest.txt');
      await fs.writeFile(src, 'copy me', 'utf-8');

      agent.registerTaskHandler('ai:copy', createFileHandler(
        toolService, 'Copied.',
        [{ toolId: 'builtin:file', input: { operation: 'copy', source: src, destination: dest } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:copy', payload: { query: 'copy' },
      });

      expect(result.data!.toolResults[0].success).toBe(true);
      expect(await fs.readFile(dest, 'utf-8')).toBe('copy me');
      expect(await fs.readFile(src, 'utf-8')).toBe('copy me'); // original still exists
    });

    it('should move file', async () => {
      const src = path.join(tempDir, 'move-src.txt');
      const dest = path.join(tempDir, 'move-dest.txt');
      await fs.writeFile(src, 'move me', 'utf-8');

      agent.registerTaskHandler('ai:move', createFileHandler(
        toolService, 'Moved.',
        [{ toolId: 'builtin:file', input: { operation: 'move', source: src, destination: dest } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:move', payload: { query: 'move' },
      });

      expect(result.data!.toolResults[0].success).toBe(true);
      expect(await fs.readFile(dest, 'utf-8')).toBe('move me');
      // Original should no longer exist
      await expect(fs.access(src)).rejects.toThrow();
    });

    it('should delete file', async () => {
      const filePath = path.join(tempDir, 'delete-me.txt');
      await fs.writeFile(filePath, 'delete', 'utf-8');

      agent.registerTaskHandler('ai:delete', createFileHandler(
        toolService, 'Deleted.',
        [{ toolId: 'builtin:file', input: { operation: 'delete', path: filePath } }],
      ));

      await agent.execute({ taskId: 'ai:delete', payload: { query: 'delete' } });
      await expect(fs.access(filePath)).rejects.toThrow();
    });
  });

  describe('Directory Operations', () => {
    it('should list directory contents', async () => {
      await fs.mkdir(path.join(tempDir, 'subdir'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'a.txt'), 'a', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'b.txt'), 'b', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'subdir', 'c.txt'), 'c', 'utf-8');

      agent.registerTaskHandler('ai:list', createFileHandler(
        toolService, 'Listed.',
        [{ toolId: 'builtin:file', input: { operation: 'list', path: tempDir, recursive: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:list', payload: { query: 'list' },
      });

      const files = result.data!.toolResults[0].data as string[];
      expect(files.length).toBeGreaterThanOrEqual(3);
      expect(files.some(f => f.endsWith('a.txt'))).toBe(true);
      expect(files.some(f => f.endsWith('c.txt'))).toBe(true);
    });

    it('should list directory non-recursively', async () => {
      await fs.mkdir(path.join(tempDir, 'nested'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'root.txt'), 'root', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'nested', 'deep.txt'), 'deep', 'utf-8');

      agent.registerTaskHandler('ai:list_flat', createFileHandler(
        toolService, 'Listed.',
        [{ toolId: 'builtin:file', input: { operation: 'list', path: tempDir, recursive: false } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:list_flat', payload: { query: 'list' },
      });

      const files = result.data!.toolResults[0].data as string[];
      expect(files.some(f => f.endsWith('root.txt'))).toBe(true);
      // deep.txt should NOT be in flat listing
      expect(files.every(f => !f.endsWith('deep.txt'))).toBe(true);
    });
  });

  describe('AI Workflow Scenarios', () => {
    it('should process files in batch: read, transform, write', async () => {
      // Create input files
      const inputs = ['file1.txt', 'file2.txt', 'file3.txt'];
      for (const name of inputs) {
        await fs.writeFile(path.join(tempDir, name), name.toUpperCase(), 'utf-8');
      }

      // Simulate AI: read all files, collect content, write summary
      agent.registerTaskHandler('ai:batch_process', createFileHandler(
        toolService, 'Batch processed.',
        [
          { toolId: 'builtin:file', input: { operation: 'read', path: path.join(tempDir, 'file1.txt') } },
          { toolId: 'builtin:file', input: { operation: 'read', path: path.join(tempDir, 'file2.txt') } },
          { toolId: 'builtin:file', input: { operation: 'read', path: path.join(tempDir, 'file3.txt') } },
          { toolId: 'builtin:file', input: { operation: 'write', path: path.join(tempDir, 'summary.txt'), content: 'FILE1.TXT\nFILE2.TXT\nFILE3.TXT' } },
        ],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:batch_process', payload: { query: 'process' },
      });

      expect(result.data!.toolResults[0].data).toBe('FILE1.TXT');
      expect(result.data!.toolResults[1].data).toBe('FILE2.TXT');
      expect(result.data!.toolResults[2].data).toBe('FILE3.TXT');
      expect(await fs.readFile(path.join(tempDir, 'summary.txt'), 'utf-8')).toContain('FILE1.TXT');
    });

    it('should handle AI Q&A: generate project scaffold', async () => {
      // Simulate AI generating a project structure
      agent.registerTaskHandler('ai:scaffold', createFileHandler(
        toolService, 'Project scaffolded.',
        [
          { toolId: 'builtin:file', input: { operation: 'write', path: path.join(tempDir, 'src', 'index.ts'), content: 'export const hello = "world";', createDirectories: true } },
          { toolId: 'builtin:file', input: { operation: 'write', path: path.join(tempDir, 'src', 'types.ts'), content: 'export interface Config { name: string; }', createDirectories: true } },
          { toolId: 'builtin:file', input: { operation: 'write', path: path.join(tempDir, 'package.json'), content: '{"name":"test","version":"1.0.0"}' } },
          { toolId: 'builtin:file', input: { operation: 'write', path: path.join(tempDir, 'src', 'utils', 'helper.ts'), content: 'export const helper = () => true;', createDirectories: true } },
          { toolId: 'builtin:file', input: { operation: 'list', path: tempDir, recursive: true } },
        ],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:scaffold', payload: { query: 'scaffold' },
      });

      expect(result.data!.toolResults.every(r => r.success)).toBe(true);
      const files = result.data!.toolResults[4].data as string[];
      expect(files.some(f => f.endsWith('index.ts'))).toBe(true);
      expect(files.some(f => f.endsWith('helper.ts'))).toBe(true);
      expect(files.some(f => f.endsWith('package.json'))).toBe(true);
    });
  });
});