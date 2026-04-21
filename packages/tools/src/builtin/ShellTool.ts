/**
 * ShellTool - Built-in shell command execution tools
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import type {
  ToolDefinition,
  ToolResult,
  ToolExecutionContext,
  ToolType,
  ToolCallLevel,
} from '@organic/utils';
import { ToolErrorCode as ErrorCode } from '@organic/utils';

const execAsync = promisify(exec);

/**
 * Shell tool handler functions
 */
export const shellToolHandlers = {
  /**
   * shell_exec - Execute a shell command (sync)
   */
  async shell_exec(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const command = String(params.command);
    const cwd = String(params.cwd ?? context.logger ? process.cwd() : process.cwd());
    const timeout = Number(params.timeout ?? 30000);
    const env = params.env as Record<string, string> | undefined;

    // Security: Validate command for dangerous patterns
    if (isDangerousCommand(command)) {
      return {
        success: false,
        error: {
          code: ErrorCode.EXECUTION_ERROR,
          message: 'Command contains potentially dangerous patterns and was blocked',
        },
        metadata: {
          tool_name: 'shell_exec',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }

    try {
      context.logger.debug(`Executing command: ${command}`, { cwd });

      const result = await execAsync(command, {
        cwd,
        timeout,
        env: { ...process.env, ...env },
        maxBuffer: 1024 * 1024 * 10, // 10MB max buffer
      });

      return {
        success: true,
        data: {
          command,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: 0,
        },
        metadata: {
          tool_name: 'shell_exec',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    } catch (error: unknown) {
      const execError = error as { code?: string; killed?: boolean; signal?: string; stdout?: string; stderr?: string };
      
      context.logger.error(`Command execution failed: ${command}`, error);

      // Handle timeout
      if (execError.killed || execError.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: {
            code: ErrorCode.TIMEOUT,
            message: `Command timed out after ${timeout}ms`,
            details: { command, timeout },
          },
          metadata: {
            tool_name: 'shell_exec',
            start_time: startTime,
            end_time: Date.now(),
            execution_time: Date.now() - startTime,
            request_id: context.request_id,
          },
        };
      }

      return {
        success: false,
        data: {
          command,
          stdout: execError.stdout ?? '',
          stderr: execError.stderr ?? '',
          exitCode: execError.code ? parseInt(String(execError.code), 10) : 1,
        },
        error: {
          code: ErrorCode.EXECUTION_ERROR,
          message: `Command failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          tool_name: 'shell_exec',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }
  },

  /**
   * shell_spawn - Execute a shell command (async/streaming)
   */
  async shell_spawn(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const command = String(params.command);
    const args = (params.args as string[]) ?? [];
    const cwd = String(params.cwd ?? process.cwd());
    const timeout = Number(params.timeout ?? 30000);

    // Security: Validate command for dangerous patterns
    if (isDangerousCommand(command)) {
      return {
        success: false,
        error: {
          code: ErrorCode.EXECUTION_ERROR,
          message: 'Command contains potentially dangerous patterns and was blocked',
        },
        metadata: {
          tool_name: 'shell_spawn',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }

    return new Promise((resolve) => {
      context.logger.debug(`Spawning command: ${command}`, { cwd, args });

      let stdout = '';
      let stderr = '';
      let killed = false;

      const child = spawn(command, args, {
        cwd,
        env: process.env,
        shell: true,
      });

      const timeoutId = setTimeout(() => {
        killed = true;
        child.kill('SIGKILL');
      }, timeout);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const executionTime = Date.now() - startTime;

        resolve({
          success: !killed && (code === 0 || code === null),
          data: {
            command,
            args,
            stdout,
            stderr,
            exitCode: code,
            killed,
          },
          metadata: {
            tool_name: 'shell_spawn',
            start_time: startTime,
            end_time: Date.now(),
            execution_time: executionTime,
            request_id: context.request_id,
          },
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        context.logger.error(`Spawn failed: ${command}`, error);

        resolve({
          success: false,
          error: {
            code: ErrorCode.EXECUTION_ERROR,
            message: `Spawn failed: ${error.message}`,
          },
          metadata: {
            tool_name: 'shell_spawn',
            start_time: startTime,
            end_time: Date.now(),
            execution_time: Date.now() - startTime,
            request_id: context.request_id,
          },
        });
      });
    });
  },
};

/**
 * Check if command contains dangerous patterns
 */
function isDangerousCommand(command: string): boolean {
  const dangerousPatterns = [
    /\brsync\b/i,
    /\brm\s+-rf\b/i,
    /\bmkfs\b/i,
    /\bdd\b.*\bof=\/dev\//i,
    /\bparted\b.*\brm\b/i,
    /\:()\{.*:\|.*&\};:/i, // Fork bomb
  ];

  return dangerousPatterns.some(pattern => pattern.test(command));
}

/**
 * Get shell tool definitions
 */
export function getShellToolDefinitions(): Array<{
  definition: ToolDefinition;
  handler: (params: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
}> {
  return [
    {
      definition: {
        name: 'shell_exec',
        version: '1.0.0',
        description: 'Execute a shell command synchronously',
        type: ToolType.EXECUTION,
        call_level: ToolCallLevel.RESTRICTED,
        parameters: {
          type: 'object',
          properties: {
            command: {
              name: 'command',
              type: 'string',
              description: 'Shell command to execute',
              required: true,
            },
            cwd: {
              name: 'cwd',
              type: 'string',
              description: 'Working directory',
              required: false,
            },
            timeout: {
              name: 'timeout',
              type: 'number',
              description: 'Timeout in milliseconds (default: 30000)',
              required: false,
              default: 30000,
              minimum: 100,
              maximum: 300000,
            },
            env: {
              name: 'env',
              type: 'object',
              description: 'Environment variables',
              required: false,
            },
          },
          required: ['command'],
          additionalProperties: false,
        },
        max_execution_time: 60000,
      },
      handler: shellToolHandlers.shell_exec,
    },
    {
      definition: {
        name: 'shell_spawn',
        version: '1.0.0',
        description: 'Spawn a shell command with streaming output',
        type: ToolType.EXECUTION,
        call_level: ToolCallLevel.RESTRICTED,
        parameters: {
          type: 'object',
          properties: {
            command: {
              name: 'command',
              type: 'string',
              description: 'Command to execute',
              required: true,
            },
            args: {
              name: 'args',
              type: 'array',
              description: 'Command arguments',
              required: false,
            },
            cwd: {
              name: 'cwd',
              type: 'string',
              description: 'Working directory',
              required: false,
            },
            timeout: {
              name: 'timeout',
              type: 'number',
              description: 'Timeout in milliseconds (default: 30000)',
              required: false,
              default: 30000,
              minimum: 100,
              maximum: 300000,
            },
          },
          required: ['command'],
          additionalProperties: false,
        },
        max_execution_time: 60000,
      },
      handler: shellToolHandlers.shell_spawn,
    },
  ];
}
