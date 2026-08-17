/**
 * AgentRunner - Abstract base class for agent execution runners
 *
 * Defines the common interface for all runner implementations:
 * local in-process, remote HTTP, and sandboxed subprocess.
 *
 * A Runner is responsible for executing agent tasks with a specific
 * execution environment. It abstracts away the "where" and "how"
 * of task execution from the agent's business logic.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import { type AgentResult, type AgentTaskInput } from '../core/Agent.js';

/**
 * Runner execution mode
 */
export enum RunnerMode {
  /** In-process execution (same Node.js process) */
  LOCAL = 'local',
  /** Remote execution via HTTP/WebSocket */
  REMOTE = 'remote',
  /** Isolated subprocess execution */
  SANDBOXED = 'sandboxed',
}

/**
 * Runner health status
 */
export enum RunnerHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  OFFLINE = 'offline',
}

/**
 * Runner capability descriptor
 */
export interface RunnerCapability {
  /** Capability identifier */
  id: string;
  /** Human-readable description */
  description?: string;
  /** Supported version range */
  version?: string;
}

/**
 * Runner configuration
 */
export interface RunnerConfig {
  /** Unique runner identifier */
  runnerId: string;
  /** Runner name */
  name: string;
  /** Execution mode */
  mode: RunnerMode;
  /** Maximum concurrent tasks */
  maxConcurrentTasks?: number;
  /** Default task timeout in ms */
  defaultTimeout?: number;
  /** Heartbeat interval in ms */
  heartbeatInterval?: number;
  /** Runner capabilities */
  capabilities?: RunnerCapability[];
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Runner statistics
 */
export interface RunnerStats {
  /** Runner ID */
  runnerId: string;
  /** Current mode */
  mode: RunnerMode;
  /** Health status */
  health: RunnerHealthStatus;
  /** Active task count */
  activeTaskCount: number;
  /** Completed task count */
  completedTaskCount: number;
  /** Failed task count */
  failedTaskCount: number;
  /** Current load (0-1) */
  load: number;
  /** Uptime in ms */
  uptime: number;
  /** Last health check timestamp */
  lastHealthCheckAt: number;
}

/**
 * Runner events
 */
export interface RunnerEvents {
  'task:start': { taskId: string; runnerId: string; timestamp: number };
  'task:complete': { taskId: string; runnerId: string; result: AgentResult; timestamp: number };
  'task:error': { taskId: string; runnerId: string; error: Error; timestamp: number };
  'health:change': {
    runnerId: string;
    oldStatus: RunnerHealthStatus;
    newStatus: RunnerHealthStatus;
  };
  heartbeat: { runnerId: string; timestamp: number; load: number };
  error: { runnerId: string; error: Error };
}

/**
 * Default runner configuration
 */
export const DEFAULT_RUNNER_CONFIG: Partial<RunnerConfig> = {
  maxConcurrentTasks: 10,
  defaultTimeout: 30000,
  heartbeatInterval: 15000,
  capabilities: [],
  metadata: {},
};

/**
 * AgentRunner - Abstract base class
 *
 * All runner implementations must extend this class and implement
 * the execute(), start(), stop(), and healthCheck() methods.
 */
export abstract class AgentRunner extends EventEmitter {
  protected config: RunnerConfig;
  protected logger: Logger;
  protected started = false;
  protected startTime = 0;
  protected activeTaskCount = 0;
  protected completedTaskCount = 0;
  protected failedTaskCount = 0;
  protected healthStatus: RunnerHealthStatus = RunnerHealthStatus.OFFLINE;
  protected heartbeatTimer?: ReturnType<typeof setInterval>;

  constructor(config: RunnerConfig) {
    super();
    this.config = {
      ...DEFAULT_RUNNER_CONFIG,
      ...config,
    } as RunnerConfig;
    this.logger = createLogger({ prefix: `runner:${this.config.name}` });
  }

  // ==================== Lifecycle ====================

  /**
   * Start the runner
   */
  async start(): Promise<void> {
    if (this.started) {
      this.logger.warn('Runner already started');
      return;
    }
    this.started = true;
    this.startTime = Date.now();
    this.healthStatus = RunnerHealthStatus.HEALTHY;
    this.startHeartbeat();
    this.logger.info(`Runner started: ${this.config.name} (${this.config.mode})`);
  }

  /**
   * Stop the runner gracefully
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.stopHeartbeat();
    this.healthStatus = RunnerHealthStatus.OFFLINE;
    this.logger.info(`Runner stopped: ${this.config.name}`);
  }

  /**
   * Check if runner is started
   */
  isStarted(): boolean {
    return this.started;
  }

  // ==================== Configuration ====================

  /**
   * Get runner ID
   */
  getRunnerId(): string {
    return this.config.runnerId;
  }

  /**
   * Get runner name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get runner mode
   */
  getMode(): RunnerMode {
    return this.config.mode;
  }

  /**
   * Get runner config
   */
  getConfig(): RunnerConfig {
    return { ...this.config };
  }

  // ==================== Abstract Methods ====================

  /**
   * Execute a task on this runner
   */
  abstract execute<R = unknown>(input: AgentTaskInput): Promise<AgentResult<R>>;

  /**
   * Perform a health check
   */
  abstract healthCheck(): Promise<RunnerHealthStatus>;

  // ==================== Statistics ====================

  /**
   * Get runner statistics
   */
  getStats(): RunnerStats {
    return {
      runnerId: this.config.runnerId,
      mode: this.config.mode,
      health: this.healthStatus,
      activeTaskCount: this.activeTaskCount,
      completedTaskCount: this.completedTaskCount,
      failedTaskCount: this.failedTaskCount,
      load: this.config.maxConcurrentTasks
        ? this.activeTaskCount / this.config.maxConcurrentTasks
        : 0,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      lastHealthCheckAt: Date.now(),
    };
  }

  /**
   * Check if runner can accept more tasks
   */
  canAcceptTasks(): boolean {
    return (
      this.started &&
      this.healthStatus === RunnerHealthStatus.HEALTHY &&
      this.activeTaskCount < (this.config.maxConcurrentTasks ?? 10)
    );
  }

  /**
   * Get current load (0-1)
   */
  getLoad(): number {
    return this.config.maxConcurrentTasks
      ? this.activeTaskCount / this.config.maxConcurrentTasks
      : 0;
  }

  // ==================== Heartbeat ====================

  /**
   * Start heartbeat
   */
  protected startHeartbeat(): void {
    const interval = this.config.heartbeatInterval ?? 15000;
    this.heartbeatTimer = setInterval(() => {
      this.emit('heartbeat', {
        runnerId: this.config.runnerId,
        timestamp: Date.now(),
        load: this.getLoad(),
      });
    }, interval);
  }

  /**
   * Stop heartbeat
   */
  protected stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  // ==================== Task Tracking ====================

  /**
   * Track a task start
   */
  protected trackTaskStart(taskId: string): void {
    this.activeTaskCount++;
    this.emit('task:start', {
      taskId,
      runnerId: this.config.runnerId,
      timestamp: Date.now(),
    });
  }

  /**
   * Track a task completion
   */
  protected trackTaskComplete(taskId: string, result: AgentResult): void {
    this.activeTaskCount--;
    if (result.success) {
      this.completedTaskCount++;
    } else {
      this.failedTaskCount++;
    }
    this.emit('task:complete', {
      taskId,
      runnerId: this.config.runnerId,
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Track a task error
   */
  protected trackTaskError(taskId: string, error: Error): void {
    this.activeTaskCount--;
    this.failedTaskCount++;
    this.emit('task:error', {
      taskId,
      runnerId: this.config.runnerId,
      error,
      timestamp: Date.now(),
    });
  }

  // ==================== Utilities ====================

  /**
   * Update health status
   */
  protected setHealth(status: RunnerHealthStatus): void {
    const oldStatus = this.healthStatus;
    this.healthStatus = status;
    if (oldStatus !== status) {
      this.emit('health:change', {
        runnerId: this.config.runnerId,
        oldStatus,
        newStatus: status,
      });
    }
  }
}
