/**
 * AI Q&A Command Execution E2E Tests
 *
 * Tests focused on shell command execution simulated through an AI agent.
 * Uses real shell commands (safe ones: echo, ls, cat, wc, grep, node -e, etc.)
 * with fixed (mock) AI responses.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolService, FileTool, ShellTool, type ToolResult, type ToolExecutionContext } from '@organic/tools';
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

function createShellHandler(
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

describe('AI Q&A Command Execution', () => {
  let toolService: ToolService;
  let agent: Agent;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-e2e-cmd-'));
    toolService = new ToolService({
      enableValidation: true,
      enableLogging: false,
      enableMetrics: true,
      defaultTimeout: 10000,
    });
    toolService.registerTool(new FileTool());
    toolService.registerTool(new ShellTool());

    agent = new Agent({
      kernel: createMockKernel() as any,
      config: {
        id: 'shell-agent',
        name: 'Shell Command Agent',
        version: '1.0.0',
        type: AgentType.EXECUTOR,
        priority: AgentPriority.NORMAL,
        capabilities: ['shell_execution'],
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

  describe('Basic Commands', () => {
    it('should execute echo command', async () => {
      agent.registerTaskHandler('ai:echo', createShellHandler(
        toolService, 'Echo done.',
        [{ toolId: 'builtin:shell', input: { command: 'echo', args: ['Hello from AI Agent'], captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:echo', payload: { query: 'echo' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.exitCode).toBe(0);
      expect(data.stdout).toContain('Hello from AI Agent');
    });

    it('should execute command with environment variable', async () => {
      agent.registerTaskHandler('ai:env_test', createShellHandler(
        toolService, 'Env test done.',
        [{ toolId: 'builtin:shell', input: { command: 'echo', args: ['$HOME'], captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:env_test', payload: { query: 'env' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.exitCode).toBe(0);
      expect(data.stdout.length).toBeGreaterThan(0);
    });

    it('should capture stdout and stderr', async () => {
      // Write a script that outputs to both stdout and stderr
      const scriptPath = path.join(tempDir, 'output_test.sh');
      await fs.writeFile(scriptPath, '#!/bin/sh\necho "hello_stdout"\necho "hello_stderr" >&2\n', 'utf-8');
      await fs.chmod(scriptPath, 0o755);

      agent.registerTaskHandler('ai:capture_output', createShellHandler(
        toolService, 'Output captured.',
        [{ toolId: 'builtin:shell', input: { command: 'sh', args: [scriptPath], captureStdout: true, captureStderr: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:capture_output', payload: { query: 'capture' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.stdout).toContain('hello_stdout');
      expect(data.stderr).toContain('hello_stderr');
    });

    it('should get exit code from command', async () => {
      agent.registerTaskHandler('ai:exit_code', createShellHandler(
        toolService, 'Exit code checked.',
        [{ toolId: 'builtin:shell', input: { command: 'true', captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:exit_code', payload: { query: 'exit' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.exitCode).toBe(0);
    });
  });

  describe('Filesystem Commands', () => {
    it('should list directory via ls command', async () => {
      await fs.writeFile(path.join(tempDir, 'ls-test.txt'), 'test', 'utf-8');

      agent.registerTaskHandler('ai:ls', createShellHandler(
        toolService, 'Listed.',
        [{ toolId: 'builtin:shell', input: { command: 'ls', args: [tempDir], captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:ls', payload: { query: 'ls' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.stdout).toContain('ls-test.txt');
    });

    it('should read file via cat command', async () => {
      const filePath = path.join(tempDir, 'cat-test.txt');
      await fs.writeFile(filePath, 'cat content', 'utf-8');

      agent.registerTaskHandler('ai:cat', createShellHandler(
        toolService, 'Cat done.',
        [{ toolId: 'builtin:shell', input: { command: 'cat', args: [filePath], captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:cat', payload: { query: 'cat' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.stdout).toContain('cat content');
    });

    it('should count lines via wc command', async () => {
      const filePath = path.join(tempDir, 'wc-test.txt');
      await fs.writeFile(filePath, 'line1\nline2\nline3\n', 'utf-8');

      agent.registerTaskHandler('ai:wc', createShellHandler(
        toolService, 'Counted.',
        [{ toolId: 'builtin:shell', input: { command: 'wc', args: ['-l', filePath], captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:wc', payload: { query: 'wc' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.stdout).toContain('3');
    });

    it('should search via grep command', async () => {
      const filePath = path.join(tempDir, 'grep-test.txt');
      await fs.writeFile(filePath, 'const API_KEY = "test-secret";\nconst other = "value";\n', 'utf-8');

      agent.registerTaskHandler('ai:grep', createShellHandler(
        toolService, 'Grepped.',
        [{ toolId: 'builtin:shell', input: { command: 'grep', args: ['API_KEY', filePath], captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:grep', payload: { query: 'grep' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.stdout).toContain('API_KEY');
    });
  });

  describe('Node.js Script Execution', () => {
    it('should execute Node.js inline script', async () => {
      const scriptPath = path.join(tempDir, 'inline.js');
      await fs.writeFile(scriptPath, 'console.log(JSON.stringify({status:"ok",items:[1,2,3]}));', 'utf-8');

      agent.registerTaskHandler('ai:node_inline', createShellHandler(
        toolService, 'Node executed.',
        [{ toolId: 'builtin:shell', input: { command: 'node', args: [scriptPath], captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:node_inline', payload: { query: 'node' },
      });

      const data = result.data!.toolResults[0].data as any;
      const parsed = JSON.parse(data.stdout.trim());
      expect(parsed.status).toBe('ok');
      expect(parsed.items).toEqual([1, 2, 3]);
    });

    it('should execute Node.js script file', async () => {
      const scriptPath = path.join(tempDir, 'script.js');
      await fs.writeFile(scriptPath, 'console.log("script output");', 'utf-8');

      agent.registerTaskHandler('ai:node_file', createShellHandler(
        toolService, 'Script executed.',
        [{ toolId: 'builtin:shell', input: { command: 'node', args: [scriptPath], captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:node_file', payload: { query: 'node' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.stdout).toContain('script output');
    });

    it('should execute Node.js with computation', async () => {
      const scriptPath = path.join(tempDir, 'compute.js');
      await fs.writeFile(scriptPath, 'const sum = Array.from({length:100},(_,i)=>i).reduce((a,b)=>a+b,0); console.log(sum);', 'utf-8');

      agent.registerTaskHandler('ai:node_compute', createShellHandler(
        toolService, 'Computed.',
        [{ toolId: 'builtin:shell', input: { command: 'node', args: [scriptPath], captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:node_compute', payload: { query: 'compute' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.stdout.trim()).toBe('4950'); // sum of 0..99
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent command', async () => {
      agent.registerTaskHandler('ai:bad_cmd', createShellHandler(
        toolService, 'Command failed.',
        [{ toolId: 'builtin:shell', input: { command: 'this_command_does_not_exist_xyz', captureStdout: true, captureStderr: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:bad_cmd', payload: { query: 'fail' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.exitCode).not.toBe(0);
    });

    it('should handle non-zero exit code', async () => {
      const scriptPath = path.join(tempDir, 'exit42.sh');
      await fs.writeFile(scriptPath, '#!/bin/sh\nexit 42\n', 'utf-8');
      await fs.chmod(scriptPath, 0o755);

      agent.registerTaskHandler('ai:exit_nonzero', createShellHandler(
        toolService, 'Non-zero exit.',
        [{ toolId: 'builtin:shell', input: { command: 'sh', args: [scriptPath], captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:exit_nonzero', payload: { query: 'exit' },
      });

      const data = result.data!.toolResults[0].data as any;
      expect(data.exitCode).toBe(42);
    });

    it('should handle command timeout', async () => {
      agent.registerTaskHandler('ai:timeout', createShellHandler(
        toolService, 'Timeout.',
        [{ toolId: 'builtin:shell', input: { command: 'sleep', args: ['10'], timeout: 500, captureStdout: true } }],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:timeout', payload: { query: 'timeout' },
      });

      // Tool execution should fail due to timeout
      // The agent may return an error if the handler fails, or data with failed tool results
      if (result.success && result.data) {
        const toolResult = result.data!.toolResults[0];
        expect(toolResult.success).toBe(false);
      } else {
        // Agent itself failed (e.g., timeout propagated)
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('AI Workflow Pipelines', () => {
    it('should execute multi-command pipeline: write, run, verify', async () => {
      const testFile = path.join(tempDir, 'pipeline-test.txt');
      const content = 'Pipeline data line 1\nline 2\nline 3\n';

      agent.registerTaskHandler('ai:pipeline_write_run', createShellHandler(
        toolService, 'Pipeline complete.',
        [
          // Write a file
          { toolId: 'builtin:file', input: { operation: 'write', path: testFile, content } },
          // Count lines
          { toolId: 'builtin:shell', input: { command: 'wc', args: ['-l', testFile], captureStdout: true } },
          // Read file content
          { toolId: 'builtin:shell', input: { command: 'cat', args: [testFile], captureStdout: true } },
          // Search for pattern
          { toolId: 'builtin:shell', input: { command: 'grep', args: ['line 2', testFile], captureStdout: true } },
        ],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:pipeline_write_run', payload: { query: 'pipeline' },
      });

      expect(result.data!.toolResults[0].success).toBe(true);                         // write
      expect((result.data!.toolResults[1].data as any).stdout).toContain('3');        // wc -l
      expect((result.data!.toolResults[2].data as any).stdout).toContain('Pipeline'); // cat
      expect((result.data!.toolResults[3].data as any).stdout).toContain('line 2');   // grep
    });

    it('should execute AI code review pipeline', async () => {
      // Simulate AI code review: create source, run linter, check output
      const sourceFile = path.join(tempDir, 'src', 'app.js');
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(sourceFile, 'const x = 1;\nconsole.log(x);\n', 'utf-8');

      agent.registerTaskHandler('ai:code_review', createShellHandler(
        toolService, 'Code review complete.',
        [
          // Get file info
          { toolId: 'builtin:shell', input: { command: 'wc', args: ['-c', sourceFile], captureStdout: true } },
          // Check syntax with node --check
          { toolId: 'builtin:shell', input: { command: 'node', args: ['--check', sourceFile], captureStdout: true, captureStderr: true } },
          // Check for console.log usage
          { toolId: 'builtin:shell', input: { command: 'grep', args: ['-n', 'console', sourceFile], captureStdout: true } },
        ],
      ));

      const result = await agent.execute<AgentTaskInput, { answer: string; toolResults: ToolResult[] }>({
        taskId: 'ai:code_review', payload: { query: 'review' },
      });

      // wc shows file size
      expect((result.data!.toolResults[0].data as any).exitCode).toBe(0);
      // node --check passes (valid syntax)
      expect((result.data!.toolResults[1].data as any).exitCode).toBe(0);
      // grep finds console.log
      expect((result.data!.toolResults[2].data as any).stdout).toContain('console');
    });
  });

  describe('Tool Execution Metrics', () => {
    it('should track shell execution metrics', async () => {
      const testFile = path.join(tempDir, 'metrics.txt');
      await fs.writeFile(testFile, 'metrics', 'utf-8');

      agent.registerTaskHandler('ai:shell_metrics', createShellHandler(
        toolService, 'Metrics collected.',
        [
          { toolId: 'builtin:shell', input: { command: 'echo', args: ['test1'], captureStdout: true } },
          { toolId: 'builtin:shell', input: { command: 'echo', args: ['test2'], captureStdout: true } },
          { toolId: 'builtin:shell', input: { command: 'cat', args: [testFile], captureStdout: true } },
        ],
      ));

      await agent.execute({ taskId: 'ai:shell_metrics', payload: { query: 'metrics' } });

      const shellStats = toolService.getToolStats('builtin:shell');
      expect(shellStats).toBeDefined();
      expect(shellStats!.totalExecutions).toBe(3);
      expect(shellStats!.successfulExecutions).toBe(3);
      expect(shellStats!.failedExecutions).toBe(0);
      expect(shellStats!.avgExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });
});