/**
 * Agent - Core agent implementation
 *
 * The Agent is the main class that orchestrates task execution,
 * manages sub-agents, and communicates with the kernel.
 */

import type { KernelApi } from '@organic/kernel';
import { createLogger, type Logger } from '@organic/utils';
import { EventEmitter } from 'events';
import { type AgentConfig, type AgentConfigOptions, createAgentConfig } from './AgentConfig.js';
import {
  type AgentState,
  type AgentStats,
  AgentStatus,
  createAgentState,
  getAgentStats,
} from './AgentState.js';

/**
 * Agent task execution result
 */
export interface AgentResult<T = unknown> {
  /** Whether execution was successful */
  success: boolean;

  /** Result data */
  data?: T;

  /** Error message if failed */
  error?: string;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent task input
 */
export interface AgentTaskInput {
  /** Task name/identifier */
  taskId: string;

  /** Task payload */
  payload: Record<string, unknown>;

  /** Task priority */
  priority?: number;

  /** Parent task ID */
  parentTaskId?: string;

  /** Dependencies */
  dependencies?: string[];

  /** Timeout in milliseconds */
  timeout?: number;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent task handler type
 */
export type AgentTaskHandler<T = unknown, R = unknown> = (
  input: T,
  context: AgentExecutionContext
) => Promise<R>;

/**
 * Agent execution context
 */
export interface AgentExecutionContext {
  /** Agent instance */
  agent: Agent;

  /** Task ID */
  taskId: string;

  /** Parent context (for nested calls) */
  parentContext?: AgentExecutionContext;

  /** Execution depth */
  depth: number;

  /** Start time */
  startTime: number;

  /** Cancellation flag */
  cancelled: boolean;

  /** Abort signal */
  signal?: AbortSignal;

  /** Custom metadata */
  metadata: Record<string, unknown>;
}

/**
 * Agent events
 */
export interface AgentEvents {
  'task:start': { taskId: string; timestamp: number };
  'task:complete': { taskId: string; result: AgentResult; timestamp: number };
  'task:error': { taskId: string; error: Error; timestamp: number };
  'status:change': { oldStatus: AgentStatus; newStatus: AgentStatus; timestamp: number };
  'child:register': { childId: string; timestamp: number };
  'child:unregister': { childId: string; timestamp: number };
  heartbeat: { timestamp: number; load: number };
}

/**
 * Agent - Core agent implementation
 *
 * Agents are the primary actors in the system, capable of executing tasks,
 * managing sub-agents, and coordinating with other agents.
 */
export class Agent extends EventEmitter {
  /** Agent configuration */
  private config: AgentConfig;

  /** Agent state */
  private state: AgentState;

  /** Kernel API reference */
  private kernel: KernelApi;

  /** Logger instance */
  private logger: Logger;

  /** Registered task handlers */
  private taskHandlers: Map<string, AgentTaskHandler> = new Map();

  /** Active child agents */
  private childAgents: Map<string, Agent> = new Map();

  /** Heartbeat interval ID */
  private heartbeatInterval?: ReturnType<typeof setInterval>;

  /** Execution counter for statistics */
  private executionCount: number = 0;

  /** Total execution time for statistics */
  private totalExecutionTime: number = 0;

  /** Whether agent is initialized */
  private initialized: boolean = false;

  /**
   * Create a new Agent instance
   */
  constructor(options: AgentConfigOptions) {
    super();
    this.kernel = options.kernel;
    this.config = createAgentConfig({
      id: options.config.id ?? `agent_${Date.now()}`,
      name: options.config.name ?? 'Agent',
      version: options.config.version ?? '0.1.0',
      ...options.config,
    });

    this.state = createAgentState({
      agentId: this.config.id,
      name: this.config.name,
      capabilities: this.config.capabilities,
      parentId: this.config.parentId,
    });

    this.logger = createLogger({
      prefix: `agent:${this.config.name}`,
    });
  }

  // ==================== Initialization ====================

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Agent already initialized');
      return;
    }

    this.setStatus(AgentStatus.INITIALIZING);
    this.logger.info(`Initializing agent: ${this.config.name} v${this.config.version}`);

    try {
      // Register with parent if exists
      if (this.config.parentId) {
        this.logger.debug(`Registered as child of: ${this.config.parentId}`);
      }

      // Start heartbeat
      this.startHeartbeat();

      this.initialized = true;
      this.setStatus(AgentStatus.IDLE);
      this.logger.info('Agent initialized successfully');
    } catch (error) {
      this.setStatus(AgentStatus.ERROR, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Shutdown the agent gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('Agent not initialized, nothing to shutdown');
      return;
    }

    this.setStatus(AgentStatus.SHUTTING_DOWN);
    this.logger.info('Shutting down agent');

    try {
      // Stop heartbeat
      this.stopHeartbeat();

      // Shutdown all child agents
      await this.shutdownChildren();

      // Clear task handlers
      this.taskHandlers.clear();

      this.initialized = false;
      this.setStatus(AgentStatus.OFFLINE);
      this.logger.info('Agent shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown', error);
      throw error;
    }
  }

  // ==================== Configuration & State ====================

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Get agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get agent statistics
   */
  getStats(): AgentStats {
    return getAgentStats(this.state);
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * Get agent name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get agent status
   */
  getStatus(): AgentStatus {
    return this.state.status;
  }

  /**
   * Update agent status
   */
  private setStatus(status: AgentStatus, errorMessage?: string): void {
    const oldStatus = this.state.status;
    this.state.status = status;
    this.state.errorMessage = errorMessage;

    if (oldStatus !== status) {
      this.emit('status:change', { oldStatus, newStatus: status, timestamp: Date.now() });
    }
  }

  // ==================== Task Management ====================

  /**
   * Register a task handler
   */
  registerTaskHandler<T = unknown, R = unknown>(
    taskName: string,
    handler: AgentTaskHandler<T, R>
  ): void {
    this.taskHandlers.set(taskName, handler as AgentTaskHandler);
    this.logger.debug(`Registered task handler: ${taskName}`);
  }

  /**
   * Unregister a task handler
   */
  unregisterTaskHandler(taskName: string): boolean {
    const deleted = this.taskHandlers.delete(taskName);
    if (deleted) {
      this.logger.debug(`Unregistered task handler: ${taskName}`);
    }
    return deleted;
  }

  /**
   * Execute a task
   */
  async execute<T = unknown, R = unknown>(
    input: AgentTaskInput,
    taskHandler?: AgentTaskHandler<T, R>
  ): Promise<AgentResult<R>> {
    const startTime = Date.now();

    // Validate initialization
    if (!this.initialized) {
      throw new Error('Agent not initialized');
    }

    // Set busy status
    this.setStatus(AgentStatus.BUSY);
    this.state.activeTaskCount++;
    this.updateLoad();

    this.emit('task:start', { taskId: input.taskId, timestamp: startTime });

    try {
      // Find handler
      const handler = taskHandler ?? this.taskHandlers.get(input.taskId);
      if (!handler) {
        throw new Error(`No handler registered for task: ${input.taskId}`);
      }

      // Create execution context
      const context = this.createExecutionContext(input);

      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => handler(input.payload as T, context),
        input.timeout ?? this.config.communicationTimeout
      );

      const executionTime = Date.now() - startTime;

      // Update statistics
      this.recordCompletion(executionTime);

      this.emit('task:complete', {
        taskId: input.taskId,
        result: { success: true, data: result as R, executionTime },
        timestamp: Date.now(),
      });

      return {
        success: true,
        data: result as R,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Update statistics
      this.recordFailure(executionTime);

      const errorResult: AgentResult<R> = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      };

      this.emit('task:error', {
        taskId: input.taskId,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now(),
      });

      return errorResult;
    } finally {
      this.state.activeTaskCount--;
      this.updateLoad();
      if (this.state.activeTaskCount === 0) {
        this.setStatus(AgentStatus.IDLE);
      }
    }
  }

  /**
   * Execute task with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task execution timed out after ${timeout}ms`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Create execution context
   */
  private createExecutionContext(input: AgentTaskInput): AgentExecutionContext {
    return {
      agent: this,
      taskId: input.taskId,
      depth: 0,
      startTime: Date.now(),
      cancelled: false,
      metadata: {
        ...input.metadata,
        parentTaskId: input.parentTaskId,
        dependencies: input.dependencies,
      },
    };
  }

  // ==================== Child Agent Management ====================

  /**
   * Register a child agent
   */
  registerChildAgent(agent: Agent): void {
    if (this.childAgents.has(agent.getId())) {
      this.logger.warn(`Child agent already registered: ${agent.getId()}`);
      return;
    }

    this.childAgents.set(agent.getId(), agent);
    this.state.childIds.push(agent.getId());

    this.emit('child:register', { childId: agent.getId(), timestamp: Date.now() });
    this.logger.debug(`Registered child agent: ${agent.getId()}`);
  }

  /**
   * Unregister a child agent
   */
  unregisterChildAgent(agentId: string): boolean {
    const deleted = this.childAgents.delete(agentId);
    if (deleted) {
      const index = this.state.childIds.indexOf(agentId);
      if (index > -1) {
        this.state.childIds.splice(index, 1);
      }

      this.emit('child:unregister', { childId: agentId, timestamp: Date.now() });
      this.logger.debug(`Unregistered child agent: ${agentId}`);
    }
    return deleted;
  }

  /**
   * Get all child agents
   */
  getChildAgents(): Agent[] {
    return Array.from(this.childAgents.values());
  }

  /**
   * Get child agent by ID
   */
  getChildAgent(agentId: string): Agent | undefined {
    return this.childAgents.get(agentId);
  }

  /**
   * Shutdown all child agents
   */
  private async shutdownChildren(): Promise<void> {
    const shutdownPromises = Array.from(this.childAgents.values()).map(agent => agent.shutdown());
    await Promise.all(shutdownPromises);
    this.childAgents.clear();
    this.state.childIds = [];
  }

  // ==================== Heartbeat ====================

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      this.state.lastHeartbeat = Date.now();
      this.emit('heartbeat', { timestamp: Date.now(), load: this.state.load });
    }, this.config.heartbeatInterval * 1000);
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  // ==================== Statistics ====================

  /**
   * Update agent load
   */
  private updateLoad(): void {
    this.state.load = Math.min(1, this.state.activeTaskCount / this.config.maxParallelTasks);
  }

  /**
   * Record task completion
   */
  private recordCompletion(executionTime: number): void {
    this.state.completedTaskCount++;
    this.totalExecutionTime += executionTime;
    this.executionCount++;
    this.state.totalExecutionTime = this.totalExecutionTime;
    this.state.avgResponseTime = this.totalExecutionTime / this.executionCount;
  }

  /**
   * Record task failure
   */
  private recordFailure(executionTime: number): void {
    this.state.failedTaskCount++;
    this.totalExecutionTime += executionTime;
    this.executionCount++;
    this.state.totalExecutionTime = this.totalExecutionTime;
    this.state.avgResponseTime = this.totalExecutionTime / this.executionCount;
  }

  // ==================== Communication ====================

  /**
   * Send message to another agent
   */
  async sendMessage(
    targetAgentId: string,
    action: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    this.logger.debug(`Sending message to ${targetAgentId}: ${action}`);

    // This is a placeholder for agent-to-agent communication
    // In a real implementation, this would use the kernel's message passing
    try {
      // Emit message event
      this.emit('message:send', {
        target: targetAgentId,
        action,
        payload,
        timestamp: Date.now(),
      });

      return { success: true, action, payload };
    } catch (error) {
      this.logger.error(`Failed to send message to ${targetAgentId}`, error);
      throw error;
    }
  }

  /**
   * Check if agent has a specific capability
   */
  hasCapability(capability: string): boolean {
    return this.config.capabilities.includes(capability);
  }

  /**
   * Check if agent can accept more tasks
   */
  canAcceptTasks(): boolean {
    return (
      this.state.activeTaskCount < this.config.maxParallelTasks &&
      this.state.status === AgentStatus.IDLE
    );
  }
}
