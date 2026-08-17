/**
 * ChildProcessIsolation - Isolated execution in a child process
 *
 * Spawns a child Node.js process for each task and communicates via a
 * JSON-line protocol over stdin/stdout. This provides OS-level process
 * isolation:
 *
 * - Separate memory space (heap isolation)
 * - Process-level timeout (SIGTERM then SIGKILL)
 * - Resource limits (--max-old-space-size)
 * - Genuine V8 sandbox via node:vm inside the worker
 * - No lingering state between tasks
 *
 * Communication protocol:
 *   Parent → Child (stdin):  {"type":"task","requestId","handler","payload"}
 *   Child → Parent (stdout): {"type":"result","requestId","data"}
 *                             {"type":"error","requestId","error"}
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { createLogger, type Logger } from '@organic/utils';
import {
  type ExecutionIsolation,
  type IsolatedExecutionRequest,
  type IsolatedExecutionResult,
} from './ExecutionIsolation.js';

/**
 * Child process isolation configuration
 */
export interface ChildProcessIsolationConfig {
  /** Default timeout in ms */
  defaultTimeout?: number;
  /** Maximum concurrent child processes */
  maxConcurrent?: number;
  /** Node.js executable path */
  nodeExecPath?: string;
  /** Max old space size in MB (passed to --max-old-space-size) */
  maxOldSpaceSize?: number;
  /** Extra flags passed to the node binary */
  execArgv?: string[];
}

/**
 * Default child process isolation configuration
 */
export const DEFAULT_CHILD_PROCESS_CONFIG: Required<ChildProcessIsolationConfig> = {
  defaultTimeout: 60000,
  maxConcurrent: 4,
  nodeExecPath: process.execPath,
  maxOldSpaceSize: 128,
  execArgv: [],
};

/**
 * Worker bootstrap script evaluated inside the child process.
 *
 * Reads JSON-line messages from stdin, reconstructs the handler
 * function inside a node:vm sandbox, executes it, and writes the
 * result back to stdout.
 *
 * The handler must be self-contained: it is serialized via
 * Function.prototype.toString() and reconstructed in the worker.
 */
const WORKER_BOOTSTRAP = `
const vm = require('vm');
const sandbox = {};
vm.createContext(sandbox);

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\\n')) >= 0) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (line.trim()) {
      handleLine(line);
    }
  }
});

function handleLine(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch (err) {
    return;
  }
  if (!msg || msg.type !== 'task') {
    return;
  }
  runTask(msg);
}

function runTask(msg) {
  let handler;
  try {
    handler = vm.runInContext('(' + msg.handler + ')', sandbox, { timeout: 10000 });
  } catch (err) {
    sendError(msg.requestId, 'BOOTSTRAP_ERROR', err);
    return;
  }
  if (typeof handler !== 'function') {
    sendError(msg.requestId, 'BOOTSTRAP_ERROR', new Error('Handler did not produce a function'));
    return;
  }
  let result;
  try {
    result = handler(msg.payload);
  } catch (err) {
    sendError(msg.requestId, 'HANDLER_ERROR', err);
    return;
  }
  Promise.resolve(result)
    .then((data) => {
      sendResult(msg.requestId, data);
    })
    .catch((err) => {
      sendError(msg.requestId, 'HANDLER_ERROR', err);
    });
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\\n');
}

function sendResult(requestId, data) {
  send({ type: 'result', requestId, data });
  process.exit(0);
}

function sendError(requestId, code, err) {
  send({
    type: 'error',
    requestId,
    error: {
      code,
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : undefined,
    },
  });
  process.exit(0);
}
`;

/**
 * ChildProcessIsolation - OS-level process isolation
 *
 * Features:
 * - Separate Node.js process per execution
 * - Genuine V8 sandbox via node:vm
 * - Memory limit via --max-old-space-size
 * - Timeout via SIGTERM/SIGKILL
 * - Concurrency limiting
 * - JSON-line IPC protocol
 */
export class ChildProcessIsolation implements ExecutionIsolation {
  readonly name = 'child-process';

  private config: Required<ChildProcessIsolationConfig>;
  private logger: Logger;
  private activeCount = 0;
  private waiters: Array<() => void> = [];

  constructor(config: ChildProcessIsolationConfig = {}) {
    this.config = {
      ...DEFAULT_CHILD_PROCESS_CONFIG,
      ...config,
    };
    this.logger = createLogger({ prefix: 'isolation:child-process' });
  }

  /**
   * Execute a task handler in a child process
   *
   * Note: The handler function is serialized via toString() and sent
   * to the child process. It must be self-contained (no closures over
   * external scope).
   */
  async execute<T = unknown>(
    request: IsolatedExecutionRequest,
    handler: (payload: unknown) => Promise<unknown> | unknown
  ): Promise<IsolatedExecutionResult<T>> {
    const startTime = Date.now();

    await this.acquire();

    let child: ChildProcessWithoutNullStreams | null = null;

    try {
      child = this.spawnWorker();
      const timeout = request.timeout ?? this.config.defaultTimeout;

      const result = await this.runInChild<T>(child, handler, request, timeout);
      result.executionTime = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CHILD_PROCESS_ERROR',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        executionTime: Date.now() - startTime,
      };
    } finally {
      if (child && child.exitCode === null) {
        child.kill('SIGTERM');
      }
      this.release();
    }
  }

  /**
   * Check if child process isolation is available
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Get the number of currently active child processes
   */
  getActiveCount(): number {
    return this.activeCount;
  }

  /**
   * Spawn a child process worker
   */
  private spawnWorker(): ChildProcessWithoutNullStreams {
    const args = [...this.config.execArgv];

    if (this.config.maxOldSpaceSize > 0) {
      args.push(`--max-old-space-size=${this.config.maxOldSpaceSize}`);
    }

    args.push('-e', WORKER_BOOTSTRAP);

    const child = spawn(this.config.nodeExecPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ISOLATED_WORKER: '1',
      },
    });

    child.on('error', (error: Error) => {
      this.logger.error('Child process error', error);
    });

    return child;
  }

  /**
   * Run a task in a child process and wait for the result
   */
  private runInChild<T>(
    child: ChildProcessWithoutNullStreams,
    handler: (payload: unknown) => Promise<unknown> | unknown,
    request: IsolatedExecutionRequest,
    timeout: number
  ): Promise<IsolatedExecutionResult<T>> {
    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      let output = '';
      let settled = false;

      const finish = (result: IsolatedExecutionResult<T> | Error): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(killTimer);
        cleanup();
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      };

      const killTimer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (child.exitCode === null && !child.killed) {
            child.kill('SIGKILL');
          }
        }, 2000);
        finish(new Error(`Child process task timed out after ${timeout}ms`));
      }, timeout);

      const onData = (chunk: Buffer | string): void => {
        output += chunk.toString();
        let idx: number;
        while ((idx = output.indexOf('\n')) >= 0) {
          const line = output.slice(0, idx);
          output = output.slice(idx + 1);
          if (!line.trim()) {
            continue;
          }
          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          if (msg.requestId !== requestId) {
            continue;
          }
          if (msg.type === 'result') {
            finish({
              success: true,
              data: msg.data as T,
              executionTime: 0,
            });
          } else if (msg.type === 'error') {
            const err = (msg.error ?? {}) as Record<string, string | undefined>;
            finish({
              success: false,
              error: {
                code: err.code ?? 'WORKER_ERROR',
                message: err.message ?? 'Unknown error',
                stack: err.stack,
              },
              executionTime: 0,
            });
          }
        }
      };

      const onError = (error: Error): void => {
        finish(error);
      };

      const onClose = (code: number | null): void => {
        if (!settled) {
          finish(new Error(`Child process exited with code ${code} before returning a result`));
        }
      };

      const cleanup = (): void => {
        child.stdout.removeListener('data', onData);
        child.removeListener('error', onError);
        child.removeListener('close', onClose);
      };

      child.stdout.on('data', onData);
      child.on('error', onError);
      child.on('close', onClose);

      // Send the task (guard against EPIPE if the worker already exited)
      try {
        child.stdin.write(
          `${JSON.stringify({
            type: 'task',
            requestId,
            handler: handler.toString(),
            payload: request.payload,
            metadata: request.metadata,
          })}\n`
        );
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Acquire a concurrency slot
   */
  private async acquire(): Promise<void> {
    if (this.activeCount < this.config.maxConcurrent) {
      this.activeCount++;
      return;
    }

    await new Promise<void>(resolve => {
      this.waiters.push(resolve);
    });
    // Slot is handed over by release(); do not increment again.
  }

  /**
   * Release a concurrency slot
   */
  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      // Hand the freed slot directly to the next waiter
      next();
    } else {
      this.activeCount--;
    }
  }
}
