/**
 * ToolExecutor - Handles tool execution with sandbox support
 *
 * Manages the actual execution of tools with proper isolation,
 * resource limits, and error handling.
 */

import { createLogger, type Logger } from '@organic/utils';
import { EventEmitter } from 'events';
import {
  type Tool,
  type ToolResult,
  type ToolExecutionContext,
  type SandboxConfig,
  type ToolExecutionOptions,
  type PermissionLevel,
} from '../types/index.js';

/**
 * Execution request
 */
interface ExecutionRequest {
  tool: Tool;
  input: unknown;
  context: ToolExecutionContext;
  options: ToolExecutionOptions;
}

/**
 * Execution queue item
 */
interface QueueItem {
  request: ExecutionRequest;
  resolve: (result: ToolResult) => void;
  reject: (error: Error) => void;
  priority: number;
  enqueuedAt: number;
}

/**
 * ToolExecutor events
 */
export interface ToolExecutorEvents {
  'execution:queued': { toolId: string; queueLength: number; timestamp: number };
  'execution:started': { toolId: string; executionId: string; timestamp: number };
  'execution:completed': {
    toolId: string;
    executionId: string;
    duration: number;
    timestamp: number;
  };
  'execution:failed': {
    toolId: string;
    executionId: string;
    error: string;
    duration: number;
    timestamp: number;
  };
  'execution:cancelled': { toolId: string; executionId: string; timestamp: number };
  'queue:empty': { timestamp: number };
  'queue:full': { timestamp: number };
}

/**
 * ToolExecutor configuration
 */
export interface ToolExecutorConfig {
  /** Maximum concurrent executions */
  maxConcurrent: number;

  /** Maximum queue size (0 = unlimited) */
  maxQueueSize: number;

  /** Enable sandbox */
  enableSandbox: boolean;

  /** Sandbox configuration */
  sandboxConfig?: SandboxConfig;

  /** Default execution timeout */
  defaultTimeout: number;

  /** Enable execution cancellation */
  enableCancellation: boolean;
}

/**
 * Default executor configuration
 */
export const DEFAULT_EXECUTOR_CONFIG: ToolExecutorConfig = {
  maxConcurrent: 5,
  maxQueueSize: 100,
  enableSandbox: true,
  defaultTimeout: 30000,
  enableCancellation: true,
};

/**
 * ToolExecutor - Executes tools with resource management
 */
export class ToolExecutor extends EventEmitter {
  /** Executor configuration */
  private config: ToolExecutorConfig;

  /** Active executions */
  private activeExecutions: Map<string, ExecutionRequest> = new Map();

  /** Execution queue */
  private executionQueue: QueueItem[] = [];

  /** Logger instance */
  private logger: Logger;

  /** Whether executor is running */
  private running: boolean = false;

  /** Process interval ID */
  private processIntervalId?: ReturnType<typeof setInterval>;

  /**
   * Create a new ToolExecutor instance
   */
  constructor(config: Partial<ToolExecutorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
    this.logger = createLogger({ prefix: 'tool-executor' });
  }

  // ==================== Lifecycle ====================

  /**
   * Start the executor
   */
  start(): void {
    if (this.running) {
      this.logger.warn('Executor already running');
      return;
    }

    this.running = true;
    this.startProcessing();
    this.logger.info('ToolExecutor started');
  }

  /**
   * Stop the executor
   */
  async stop(): Promise<void> {
    if (!this.running) {
      this.logger.warn('Executor not running');
      return;
    }

    this.running = false;
    this.stopProcessing();

    // Wait for active executions to complete
    if (this.activeExecutions.size > 0) {
      this.logger.info(`Waiting for ${this.activeExecutions.size} active executions to complete`);
      await this.waitForActiveExecutions();
    }

    // Clear queue
    this.clearQueue();

    this.logger.info('ToolExecutor stopped');
  }

  // ==================== Execution ====================

  /**
   * Execute a tool
   */
  async execute(
    tool: Tool,
    input: unknown,
    context: ToolExecutionContext,
    options: ToolExecutionOptions = {}
  ): Promise<ToolResult> {
    const definition = tool.getDefinition();

    // Check if we can execute directly
    if (this.activeExecutions.size < this.config.maxConcurrent) {
      return this.executeDirect(tool, input, context, options);
    }

    // Check queue size
    if (this.config.maxQueueSize > 0 && this.executionQueue.length >= this.config.maxQueueSize) {
      this.emit('queue:full', { timestamp: Date.now() });
      return {
        success: false,
        error: 'Execution queue is full',
        executionTime: 0,
      };
    }

    // Add to queue
    return new Promise((resolve, reject) => {
      const priority = (context.metadata?.priority as number) ?? 0;

      const queueItem: QueueItem = {
        request: { tool, input, context, options },
        resolve,
        reject,
        priority,
        enqueuedAt: Date.now(),
      };

      // Insert in priority order
      const insertIndex = this.executionQueue.findIndex(item => item.priority < priority);
      if (insertIndex === -1) {
        this.executionQueue.push(queueItem);
      } else {
        this.executionQueue.splice(insertIndex, 0, queueItem);
      }

      this.emit('execution:queued', {
        toolId: definition.id,
        queueLength: this.executionQueue.length,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Execute a tool directly
   */
  private async executeDirect(
    tool: Tool,
    input: unknown,
    context: ToolExecutionContext,
    options: ToolExecutionOptions
  ): Promise<ToolResult> {
    const definition = tool.getDefinition();
    const executionId = context.executionId;

    this.activeExecutions.set(executionId, { tool, input, context, options });

    this.emit('execution:started', {
      toolId: definition.id,
      executionId,
      timestamp: Date.now(),
    });

    const startTime = Date.now();

    try {
      // Apply sandbox if enabled
      const effectiveContext = this.config.enableSandbox ? this.applySandbox(context) : context;

      // Apply timeout
      const timeout = options.timeout ?? this.config.defaultTimeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Execution timed out after ${timeout}ms`));
        }, timeout);
        // Store timer for cleanup
        effectiveContext.metadata = {
          ...effectiveContext.metadata,
          _timeoutTimer: timer,
        };
      });

      // Apply cancellation
      if (this.config.enableCancellation && options.signal) {
        options.signal.addEventListener('abort', () => {
          this.cancelExecution(executionId);
        });
      }

      // Execute
      const result = await Promise.race([tool.execute(input, effectiveContext), timeoutPromise]);

      const duration = Date.now() - startTime;

      this.emit('execution:completed', {
        toolId: definition.id,
        executionId,
        duration,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.emit('execution:failed', {
        toolId: definition.id,
        executionId,
        error: error instanceof Error ? error.message : String(error),
        duration,
        timestamp: Date.now(),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: duration,
      };
    } finally {
      this.activeExecutions.delete(executionId);

      // Clear timeout timer if exists
      const timeoutTimer = context.metadata?._timeoutTimer as
        | ReturnType<typeof setTimeout>
        | undefined;
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
    }
  }

  /**
   * Cancel an execution
   */
  cancelExecution(executionId: string): boolean {
    const request = this.activeExecutions.get(executionId);
    if (!request) {
      return false;
    }

    request.context.cancelled = true;
    this.emit('execution:cancelled', {
      toolId: request.tool.getDefinition().id,
      executionId,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Apply sandbox restrictions to context
   */
  private applySandbox(context: ToolExecutionContext): ToolExecutionContext {
    if (!this.config.sandboxConfig?.enabled) {
      return context;
    }

    // Create sandboxed context with restrictions
    return {
      ...context,
      permissionLevel: this.getRestrictedPermissionLevel(context.permissionLevel),
      environment: this.filterEnvironment(context.environment),
    };
  }

  /**
   * Get restricted permission level based on sandbox config
   */
  private getRestrictedPermissionLevel(level: PermissionLevel): PermissionLevel {
    // Sandbox restricts L4 to L3
    if (level === 'L4') return 'L3';
    return level;
  }

  /**
   * Filter environment variables for sandbox
   */
  private filterEnvironment(env: Record<string, string>): Record<string, string> {
    // Remove sensitive environment variables in sandbox
    const sensitive = ['API_KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'PRIVATE_KEY'];
    const filtered: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      const isSensitive = sensitive.some(s => key.toUpperCase().includes(s));
      if (!isSensitive) {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  // ==================== Queue Processing ====================

  /**
   * Start queue processing
   */
  private startProcessing(): void {
    if (this.processIntervalId) return;

    this.processIntervalId = setInterval(() => {
      this.processQueue();
    }, 100); // Process every 100ms
  }

  /**
   * Stop queue processing
   */
  private stopProcessing(): void {
    if (this.processIntervalId) {
      clearInterval(this.processIntervalId);
      this.processIntervalId = undefined;
    }
  }

  /**
   * Process the execution queue
   */
  private async processQueue(): Promise<void> {
    if (this.executionQueue.length === 0) {
      return;
    }

    if (this.activeExecutions.size >= this.config.maxConcurrent) {
      return;
    }

    // Get next item from queue
    const item = this.executionQueue.shift();
    if (!item) return;

    const { request, resolve, reject } = item;

    try {
      const result = await this.executeDirect(
        request.tool,
        request.input,
        request.context,
        request.options
      );
      resolve(result);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Clear the execution queue
   */
  private clearQueue(): void {
    for (const item of this.executionQueue) {
      item.reject(new Error('Executor stopped'));
    }
    this.executionQueue = [];
  }

  /**
   * Wait for all active executions to complete
   */
  private waitForActiveExecutions(): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        if (this.activeExecutions.size === 0) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // ==================== Status ====================

  /**
   * Get executor status
   */
  getStatus(): {
    running: boolean;
    activeExecutions: number;
    queueLength: number;
    maxConcurrent: number;
  } {
    return {
      running: this.running,
      activeExecutions: this.activeExecutions.size,
      queueLength: this.executionQueue.length,
      maxConcurrent: this.config.maxConcurrent,
    };
  }

  /**
   * Check if executor is idle
   */
  isIdle(): boolean {
    return this.activeExecutions.size === 0 && this.executionQueue.length === 0;
  }
}

/**
 * Create a tool executor instance
 */
export function createToolExecutor(config?: Partial<ToolExecutorConfig>): ToolExecutor {
  return new ToolExecutor(config);
}
