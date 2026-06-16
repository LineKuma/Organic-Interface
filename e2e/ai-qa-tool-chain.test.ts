/**
 * AI Q&A Tool Chain E2E Tests
 *
 * Simulates a complete AI Q&A session where an AI agent receives a user query,
 * uses tools (FileTool, ShellTool, SearchTool) to gather information,
 * and produces a fixed (mock) response.
 *
 * This tests the end-to-end flow: User Query -> Agent -> ToolService -> Tools -> Result
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ToolService,
  FileTool,
  ShellTool,
  SearchTool,
  type ToolExecutionContext,
  type ToolResult,
} from '@organic/tools';
import { Agent, AgentType, AgentPriority, type AgentTaskInput } from '@organic/agent';

// ── Mock Kernel API ──────────────────────────────────────────────

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

/**
 * Create an AI task handler that simulates an AI response.
 * The handler uses ToolService to execute tools and returns a fixed answer.
 */
function createAIHandler(
  toolService: ToolService,
  response: {
    answer: string;
    toolCalls: Array<{ toolId: string; input: unknown }>;
  }
) {
  return async (payload: Record<string, unknown>, _context: unknown) => {
    const results: ToolResult[] = [];

    // Execute all tool calls in the AI response plan
    for (const toolCall of response.toolCalls) {
      const ctx = createToolContext({ toolId: toolCall.toolId });
      const result = await toolService.execute(toolCall.toolId, toolCall.input, ctx);
      results.push(result);
    }

    return {
      answer: response.answer,
      toolResults: results,
      query: payload.query,
      timestamp: Date.now(),
    };
  };
}

// ── Test Suite: AI Q&A Tool Chain ─────────────────────────────────

describe('AI Q&A Tool Chain', () => {
  let toolService: ToolService;
  let agent: Agent;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for file operations
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-e2e-'));

    // Initialize ToolService with all built-in tools
    toolService = new ToolService({
      enableValidation: true,
      enableLogging: false,
      enableMetrics: true,
      defaultTimeout: 10000,
    });

    // Register built-in tools
    toolService.registerTool(new FileTool());
    toolService.registerTool(new ShellTool());
    toolService.registerTool(new SearchTool());

    // Create Agent with mock kernel
    const mockKernel = createMockKernel();
    agent = new Agent({
      kernel: mockKernel as any,
      config: {
        id: 'ai-agent',
        name: 'AI Assistant',
        version: '1.0.0',
        type: AgentType.EXECUTOR,
        priority: AgentPriority.NORMAL,
        capabilities: ['file_operations', 'shell_execution', 'search'],
      },
    });
    await agent.initialize();
  });

  afterEach(async () => {
    await agent.shutdown();
    toolService.clear();
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ── File Operations ───────────────────────────────────────────

  describe('File Read/Write via AI Agent', () => {
    it('should read file content through AI Q&A flow', async () => {
      // Create a test file
      const testFilePath = path.join(tempDir, 'test-read.txt');
      const fileContent = 'Hello, AI! This is test content for file reading.\nLine 2\nLine 3';
      await fs.writeFile(testFilePath, fileContent, 'utf-8');

      // Register AI task handler that reads a file
      agent.registerTaskHandler(
        'ai:read_file',
        createAIHandler(toolService, {
          answer: 'File content read successfully.',
          toolCalls: [{ toolId: 'builtin:file', input: { operation: 'read', path: testFilePath } }],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:read_file',
        payload: { query: 'read_file', filePath: testFilePath },
      });

      expect(result.success).toBe(true);
      const data = result.data!;
      expect(data.answer).toBe('File content read successfully.');
      expect(data.toolResults).toHaveLength(1);
      expect(data.toolResults[0].success).toBe(true);
      expect(data.toolResults[0].data).toBe(fileContent);
    });

    it('should write file content through AI Q&A flow', async () => {
      const testFilePath = path.join(tempDir, 'test-write.txt');
      const writeContent = 'AI-generated content: Task completed successfully.';

      // Register AI task handler that writes a file
      agent.registerTaskHandler(
        'ai:write_file',
        createAIHandler(toolService, {
          answer: 'File written successfully.',
          toolCalls: [
            {
              toolId: 'builtin:file',
              input: {
                operation: 'write',
                path: testFilePath,
                content: writeContent,
                createDirectories: true,
              },
            },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:write_file',
        payload: { query: 'write_file' },
      });

      expect(result.success).toBe(true);
      expect(result.data!.answer).toBe('File written successfully.');
      expect(result.data!.toolResults[0].success).toBe(true);

      // Verify file was actually written
      const written = await fs.readFile(testFilePath, 'utf-8');
      expect(written).toBe(writeContent);
    });

    it('should check file existence through AI Q&A', async () => {
      const existingFile = path.join(tempDir, 'exists.txt');
      const nonExistingFile = path.join(tempDir, 'does-not-exist.txt');
      await fs.writeFile(existingFile, 'exists', 'utf-8');

      agent.registerTaskHandler(
        'ai:check_exists',
        createAIHandler(toolService, {
          answer: 'File existence checked.',
          toolCalls: [
            { toolId: 'builtin:file', input: { operation: 'exists', path: existingFile } },
            { toolId: 'builtin:file', input: { operation: 'exists', path: nonExistingFile } },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:check_exists',
        payload: { query: 'check_exists' },
      });

      expect(result.success).toBe(true);
      expect(result.data!.toolResults[0].data).toBe(true); // existing file
      expect(result.data!.toolResults[1].data).toBe(false); // non-existing file
    });

    it('should list directory contents through AI Q&A', async () => {
      // Create a directory structure
      await fs.mkdir(path.join(tempDir, 'subdir'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'subdir', 'nested.txt'), 'nested', 'utf-8');

      agent.registerTaskHandler(
        'ai:list_dir',
        createAIHandler(toolService, {
          answer: 'Directory listing completed.',
          toolCalls: [
            {
              toolId: 'builtin:file',
              input: { operation: 'list', path: tempDir, recursive: true },
            },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:list_dir',
        payload: { query: 'list_files' },
      });

      expect(result.success).toBe(true);
      const files = result.data!.toolResults[0].data as string[];
      expect(files.length).toBeGreaterThanOrEqual(3);
      expect(files.some(f => f.endsWith('file1.txt'))).toBe(true);
      expect(files.some(f => f.endsWith('nested.txt'))).toBe(true);
    });

    it('should get file stats through AI Q&A', async () => {
      const testFile = path.join(tempDir, 'stat-test.txt');
      await fs.writeFile(testFile, 'stat content', 'utf-8');

      agent.registerTaskHandler(
        'ai:file_stat',
        createAIHandler(toolService, {
          answer: 'File stats retrieved.',
          toolCalls: [{ toolId: 'builtin:file', input: { operation: 'stat', path: testFile } }],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:file_stat',
        payload: { query: 'file_stat' },
      });

      expect(result.success).toBe(true);
      const stat = result.data!.toolResults[0].data as any;
      expect(stat.isFile).toBe(true);
      expect(stat.size).toBeGreaterThan(0);
      expect(stat.modified).toBeDefined();
    });

    it('should copy and move files through AI Q&A', async () => {
      const sourceFile = path.join(tempDir, 'source.txt');
      const copyDest = path.join(tempDir, 'copied.txt');
      const moveDest = path.join(tempDir, 'moved.txt');
      await fs.writeFile(sourceFile, 'copy me', 'utf-8');

      agent.registerTaskHandler(
        'ai:copy_move',
        createAIHandler(toolService, {
          answer: 'Copy and move operations completed.',
          toolCalls: [
            {
              toolId: 'builtin:file',
              input: { operation: 'copy', source: sourceFile, destination: copyDest },
            },
            {
              toolId: 'builtin:file',
              input: { operation: 'move', source: sourceFile, destination: moveDest },
            },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:copy_move',
        payload: { query: 'copy_move' },
      });

      expect(result.success).toBe(true);
      expect(result.data!.toolResults.every(r => r.success)).toBe(true);

      // Verify copy exists
      const copyContent = await fs.readFile(copyDest, 'utf-8');
      expect(copyContent).toBe('copy me');

      // Verify original moved (no longer exists at old path)
      const movedContent = await fs.readFile(moveDest, 'utf-8');
      expect(movedContent).toBe('copy me');
    });
  });

  // ── Shell Command Execution ────────────────────────────────────

  describe('Shell Command Execution via AI Agent', () => {
    it('should execute simple command through AI Q&A', async () => {
      agent.registerTaskHandler(
        'ai:run_echo',
        createAIHandler(toolService, {
          answer: 'Command executed successfully.',
          toolCalls: [
            {
              toolId: 'builtin:shell',
              input: {
                command: 'echo "Hello from AI"',
                captureStdout: true,
                captureStderr: true,
              },
            },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:run_echo',
        payload: { query: 'run_command' },
      });

      expect(result.success).toBe(true);
      const shellResult = result.data!.toolResults[0].data as any;
      expect(shellResult.exitCode).toBe(0);
      expect(shellResult.stdout).toContain('Hello from AI');
    });

    it('should execute command with arguments through AI Q&A', async () => {
      agent.registerTaskHandler(
        'ai:run_ls',
        createAIHandler(toolService, {
          answer: 'Directory listing via shell completed.',
          toolCalls: [
            {
              toolId: 'builtin:shell',
              input: {
                command: 'ls',
                args: ['-la', tempDir],
                captureStdout: true,
              },
            },
          ],
        })
      );

      // Create a file so ls has output
      await fs.writeFile(path.join(tempDir, 'shell-test.txt'), 'test', 'utf-8');

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:run_ls',
        payload: { query: 'run_command' },
      });

      expect(result.success).toBe(true);
      const shellResult = result.data!.toolResults[0].data as any;
      expect(shellResult.exitCode).toBe(0);
      expect(shellResult.stdout).toContain('shell-test.txt');
    });

    it('should handle command failure through AI Q&A', async () => {
      agent.registerTaskHandler(
        'ai:run_fail',
        createAIHandler(toolService, {
          answer: 'Command failed as expected.',
          toolCalls: [
            {
              toolId: 'builtin:shell',
              input: {
                command: 'nonexistent_command_xyz',
                captureStdout: true,
                captureStderr: true,
              },
            },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:run_fail',
        payload: { query: 'run_command' },
      });

      expect(result.success).toBe(true);
      const shellResult = result.data!.toolResults[0].data as any;
      expect(shellResult.exitCode).not.toBe(0);
    });

    it('should execute multi-step shell pipeline through AI Q&A', async () => {
      // Simulate AI: write file, then read it via shell cat
      const testFilePath = path.join(tempDir, 'pipeline.txt');
      const pipelineContent = 'Pipeline test content line 1\nline 2\nline 3\n';

      agent.registerTaskHandler(
        'ai:pipeline',
        createAIHandler(toolService, {
          answer: 'Pipeline executed: wrote file and read it back.',
          toolCalls: [
            {
              toolId: 'builtin:file',
              input: { operation: 'write', path: testFilePath, content: pipelineContent },
            },
            {
              toolId: 'builtin:shell',
              input: {
                command: 'wc',
                args: ['-l', testFilePath],
                captureStdout: true,
              },
            },
            {
              toolId: 'builtin:shell',
              input: {
                command: 'cat',
                args: [testFilePath],
                captureStdout: true,
              },
            },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:pipeline',
        payload: { query: 'complex_task' },
      });

      expect(result.success).toBe(true);
      expect(result.data!.toolResults).toHaveLength(3);

      // File write succeeded
      expect(result.data!.toolResults[0].success).toBe(true);

      // wc -l should return 3 lines
      const wcResult = result.data!.toolResults[1].data as any;
      expect(wcResult.exitCode).toBe(0);
      expect(wcResult.stdout).toContain('3');

      // cat should return the content
      const catResult = result.data!.toolResults[2].data as any;
      expect(catResult.stdout).toContain('Pipeline test content');
    });
  });

  // ── Search Operations ──────────────────────────────────────────

  describe('Search Operations via AI Agent', () => {
    it('should index and query documents through AI Q&A', async () => {
      // Index some documents
      agent.registerTaskHandler(
        'ai:index_and_query',
        createAIHandler(toolService, {
          answer: 'Index and query completed.',
          toolCalls: [
            {
              toolId: 'builtin:search',
              input: {
                operation: 'index',
                index: 'knowledge_base',
                documentId: 'doc-1',
                document: {
                  title: 'Getting Started',
                  content:
                    'This is a guide for getting started with Organic Interface. It covers installation, configuration, and basic usage.',
                },
              },
            },
            {
              toolId: 'builtin:search',
              input: {
                operation: 'index',
                index: 'knowledge_base',
                documentId: 'doc-2',
                document: {
                  title: 'Advanced Topics',
                  content:
                    'Advanced topics include plugin development, custom tool creation, and workflow orchestration with multiple agents.',
                },
              },
            },
            {
              toolId: 'builtin:search',
              input: {
                operation: 'query',
                index: 'knowledge_base',
                query: 'plugin development',
                paths: [tempDir], // Required by validation even though query uses indices
                options: { limit: 10 },
              },
            },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:index_and_query',
        payload: { query: 'search_content' },
      });

      expect(result.success).toBe(true);
      expect(result.data!.toolResults).toHaveLength(3);

      // Index operations succeeded
      expect(result.data!.toolResults[0].success).toBe(true);
      expect(result.data!.toolResults[1].success).toBe(true);

      // Query should find doc-2 (plugin development)
      const queryResult = result.data!.toolResults[2].data as any;
      expect(queryResult.count).toBeGreaterThanOrEqual(1);
      expect(queryResult.results.some((r: any) => r.id === 'doc-2')).toBe(true);
    });

    it('should search files with grep through AI Q&A', async () => {
      // Create test files to search
      await fs.writeFile(
        path.join(tempDir, 'search-test.ts'),
        'const API_KEY = "test-key";\nfunction getConfig() { return { api: API_KEY }; }',
        'utf-8'
      );
      await fs.writeFile(
        path.join(tempDir, 'other.ts'),
        'const otherVar = "something else";',
        'utf-8'
      );

      agent.registerTaskHandler(
        'ai:grep_search',
        createAIHandler(toolService, {
          answer: 'Grep search completed.',
          toolCalls: [
            {
              toolId: 'builtin:search',
              input: {
                operation: 'grep',
                pattern: 'API_KEY',
                paths: [tempDir],
                options: {
                  includeFilenames: true,
                  includeLineNumbers: true,
                  extensions: ['ts'],
                  excludeDirs: ['node_modules'],
                },
              },
            },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:grep_search',
        payload: { query: 'search_content' },
      });

      expect(result.success).toBe(true);
      const grepResult = result.data!.toolResults[0].data as any;
      expect(grepResult.count).toBeGreaterThanOrEqual(1);
      expect(grepResult.results[0].content).toContain('API_KEY');
    });

    it('should find files by name pattern through AI Q&A', async () => {
      await fs.writeFile(path.join(tempDir, 'config.json'), '{"key":"value"}', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'config.yaml'), 'key: value', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'readme.md'), '# Readme', 'utf-8');

      agent.registerTaskHandler(
        'ai:find_files',
        createAIHandler(toolService, {
          answer: 'File search completed.',
          toolCalls: [
            {
              toolId: 'builtin:search',
              input: {
                operation: 'find',
                pattern: 'config',
                paths: [tempDir],
                options: { excludeDirs: [] },
              },
            },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:find_files',
        payload: { query: 'search_content' },
      });

      expect(result.success).toBe(true);
      const findResult = result.data!.toolResults[0].data as any;
      expect(findResult.count).toBeGreaterThanOrEqual(2);
      expect(findResult.files.some((f: string) => f.includes('config'))).toBe(true);
    });
  });

  // ── Complex Multi-Tool Scenarios ───────────────────────────────

  describe('Complex Multi-Tool Scenarios', () => {
    it('should handle AI Q&A: read config, run command, write result', async () => {
      // Scenario: AI reads a config file, runs a command based on it, writes output
      const configPath = path.join(tempDir, 'app.config');
      const outputPath = path.join(tempDir, 'output.txt');
      await fs.writeFile(configPath, 'mode=production\nworkers=4', 'utf-8');

      agent.registerTaskHandler(
        'ai:read_config_and_exec',
        createAIHandler(toolService, {
          answer: 'Config read, command executed, result written.',
          toolCalls: [
            // Step 1: Read config file
            { toolId: 'builtin:file', input: { operation: 'read', path: configPath } },
            // Step 2: Execute command based on config
            {
              toolId: 'builtin:shell',
              input: {
                command: 'echo "Processing mode=production with 4 workers"',
                captureStdout: true,
              },
            },
            // Step 3: Write result to output file
            {
              toolId: 'builtin:file',
              input: {
                operation: 'write',
                path: outputPath,
                content: 'Result: processing completed in production mode',
              },
            },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:read_config_and_exec',
        payload: { query: 'complex_task' },
      });

      expect(result.success).toBe(true);
      expect(result.data!.toolResults).toHaveLength(3);

      // Verify config was read
      expect(result.data!.toolResults[0].success).toBe(true);
      expect(result.data!.toolResults[0].data).toContain('mode=production');

      // Verify command executed
      expect(result.data!.toolResults[1].success).toBe(true);

      // Verify output was written
      expect(result.data!.toolResults[2].success).toBe(true);
      const outputContent = await fs.readFile(outputPath, 'utf-8');
      expect(outputContent).toContain('production mode');
    });

    it('should handle AI Q&A: search codebase, analyze, generate report', async () => {
      // Create source files
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'src', 'main.ts'),
        'import { Kernel } from "@organic/kernel";\nconst kernel = new Kernel();',
        'utf-8'
      );
      await fs.writeFile(
        path.join(tempDir, 'src', 'utils.ts'),
        'export function helper() { return "organic"; }',
        'utf-8'
      );

      const reportPath = path.join(tempDir, 'report.txt');

      agent.registerTaskHandler(
        'ai:search_and_report',
        createAIHandler(toolService, {
          answer: 'Codebase searched and report generated.',
          toolCalls: [
            // Search for Kernel imports
            {
              toolId: 'builtin:search',
              input: {
                operation: 'grep',
                pattern: 'Kernel',
                paths: [path.join(tempDir, 'src')],
                options: { includeFilenames: true, extensions: ['ts'] },
              },
            },
            // Search for exports
            {
              toolId: 'builtin:search',
              input: {
                operation: 'grep',
                pattern: 'export',
                paths: [path.join(tempDir, 'src')],
                options: { includeFilenames: true, extensions: ['ts'] },
              },
            },
            // Write analysis report
            {
              toolId: 'builtin:file',
              input: {
                operation: 'write',
                path: reportPath,
                content:
                  'Code Analysis Report:\n- Found Kernel usage in main.ts\n- Found 1 export in utils.ts',
              },
            },
          ],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:search_and_report',
        payload: { query: 'complex_task' },
      });

      expect(result.success).toBe(true);
      expect(result.data!.toolResults).toHaveLength(3);

      // Kernel search found
      const kernelSearch = result.data!.toolResults[0].data as any;
      expect(kernelSearch.count).toBeGreaterThanOrEqual(1);

      // Export search found
      const exportSearch = result.data!.toolResults[1].data as any;
      expect(exportSearch.count).toBeGreaterThanOrEqual(1);

      // Report written
      const reportContent = await fs.readFile(reportPath, 'utf-8');
      expect(reportContent).toContain('Kernel');
      expect(reportContent).toContain('export');
    });
  });

  // ── Agent State Management ────────────────────────────────────

  describe('Agent State Management', () => {
    it('should track agent state through Q&A lifecycle', async () => {
      expect(agent.getStatus()).toBe('idle');

      agent.registerTaskHandler('ai:state_track', async (payload: Record<string, unknown>) => {
        // Simulate AI processing
        return { status: 'ok', query: payload.query };
      });

      const result = await agent.execute({
        taskId: 'ai:state_track',
        payload: { query: 'state_test' },
      });

      expect(result.success).toBe(true);
      // After completion, agent should be idle again
      expect(agent.getStatus()).toBe('idle');
    });

    it('should track task statistics through multiple Q&A rounds', async () => {
      agent.registerTaskHandler('ai:stats_task', async (payload: Record<string, unknown>) => {
        return { answer: `Processed: ${payload.query}`, timestamp: Date.now() };
      });

      // Execute multiple tasks
      await agent.execute({ taskId: 'ai:stats_task', payload: { query: 'round 1' } });
      await agent.execute({ taskId: 'ai:stats_task', payload: { query: 'round 2' } });
      await agent.execute({ taskId: 'ai:stats_task', payload: { query: 'round 3' } });

      const stats = agent.getStats();
      expect(stats.completedTasks).toBe(3);
      expect(stats.failedTasks).toBe(0);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should handle AI Q&A task failure gracefully', async () => {
      agent.registerTaskHandler('ai:failing_task', async () => {
        throw new Error('AI model unavailable');
      });

      const result = await agent.execute({
        taskId: 'ai:failing_task',
        payload: { query: 'test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('AI model unavailable');

      const stats = agent.getStats();
      expect(stats.failedTasks).toBe(1);
    });
  });

  // ── Tool Validation ────────────────────────────────────────────

  describe('Tool Input Validation', () => {
    it('should validate file tool input before execution', async () => {
      agent.registerTaskHandler(
        'ai:validate_file',
        createAIHandler(toolService, {
          answer: 'Validation test.',
          toolCalls: [{ toolId: 'builtin:file', input: { operation: 'invalid_op' } }],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:validate_file',
        payload: { query: 'test' },
      });

      expect(result.success).toBe(true);
      const fileResult = result.data!.toolResults[0];
      expect(fileResult.success).toBe(false);
      expect(fileResult.error).toContain('Invalid operation');
    });

    it('should validate shell tool input before execution', async () => {
      agent.registerTaskHandler(
        'ai:validate_shell',
        createAIHandler(toolService, {
          answer: 'Validation test.',
          toolCalls: [{ toolId: 'builtin:shell', input: {} }],
        })
      );

      const result = await agent.execute<
        AgentTaskInput,
        { answer: string; toolResults: ToolResult[] }
      >({
        taskId: 'ai:validate_shell',
        payload: { query: 'test' },
      });

      expect(result.success).toBe(true);
      const shellResult = result.data!.toolResults[0];
      expect(shellResult.success).toBe(false);
      expect(shellResult.error).toContain('Command is required');
    });
  });

  // ── ToolService Metrics ────────────────────────────────────────

  describe('ToolService Metrics', () => {
    it('should track tool execution metrics across AI Q&A sessions', async () => {
      const testFilePath = path.join(tempDir, 'metrics-test.txt');
      await fs.writeFile(testFilePath, 'metrics', 'utf-8');

      agent.registerTaskHandler(
        'ai:metrics_test',
        createAIHandler(toolService, {
          answer: 'Metrics test.',
          toolCalls: [
            { toolId: 'builtin:file', input: { operation: 'read', path: testFilePath } },
            { toolId: 'builtin:file', input: { operation: 'exists', path: testFilePath } },
            { toolId: 'builtin:shell', input: { command: 'echo "metrics"', captureStdout: true } },
          ],
        })
      );

      await agent.execute({ taskId: 'ai:metrics_test', payload: { query: 'test' } });

      const serviceStats = toolService.getServiceStats();
      expect(serviceStats.totalTools).toBe(3);
      expect(serviceStats.totalExecutions).toBe(3);

      const fileStats = toolService.getToolStats('builtin:file');
      expect(fileStats).toBeDefined();
      expect(fileStats!.totalExecutions).toBe(2);
      expect(fileStats!.successfulExecutions).toBe(2);
      expect(fileStats!.avgExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });
});
