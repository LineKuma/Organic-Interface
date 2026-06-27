/**
 * Tool Context - Provides execution context for tool handlers
 */

import type { ToolExecutionContext, Logger } from '@organic/utils';

/**
 * Tool context options
 */
export interface ToolContextOptions {
  /** Request identifier */
  request_id: string;
  /** Caller plugin identifier */
  caller_plugin_id: string;
  /** Caller plugin name */
  caller_plugin_name: string;
  /** Execution timestamp */
  timestamp: number;
  /** Logger instance */
  logger: Logger;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Working directory */
  working_directory?: string;
}

/**
 * Execution state tracking
 */
interface ExecutionState {
  /** Start time */
  startTime: number;
  /** Progress percentage */
  progress: number;
  /** Status message */
  status: string;
  /** Intermediate results */
  intermediateResults: unknown[];
}

/**
 * ToolContext - Manages execution context and state during tool execution
 */
export class ToolContext {
  private requestId: string;
  private callerPluginId: string;
  private callerPluginName: string;
  private timestamp: number;
  private verbose: boolean;
  private logger: Logger;
  private workingDirectory: string;
  private state: ExecutionState;
  private cancelled: boolean = false;

  constructor(options: ToolContextOptions) {
    this.requestId = options.request_id;
    this.callerPluginId = options.caller_plugin_id;
    this.callerPluginName = options.caller_plugin_name;
    this.timestamp = options.timestamp;
    this.verbose = options.verbose ?? false;
    this.logger = options.logger;
    this.workingDirectory = options.working_directory ?? process.cwd();
    this.state = {
      startTime: options.timestamp,
      progress: 0,
      status: 'initialized',
      intermediateResults: [],
    };
  }

  /**
   * Get the execution context object
   */
  getContext(): ToolExecutionContext {
    return {
      request_id: this.requestId,
      caller_plugin_id: this.callerPluginId,
      caller_plugin_name: this.callerPluginName,
      timestamp: this.timestamp,
      logger: this.logger,
    };
  }

  // ==================== Request Information ====================

  /**
   * Get request ID
   */
  getRequestId(): string {
    return this.requestId;
  }

  /**
   * Get caller plugin ID
   */
  getCallerPluginId(): string {
    return this.callerPluginId;
  }

  /**
   * Get caller plugin name
   */
  getCallerPluginName(): string {
    return this.callerPluginName;
  }

  /**
   * Get execution timestamp
   */
  getTimestamp(): number {
    return this.timestamp;
  }

  // ==================== Configuration ====================

  /**
   * Get working directory
   */
  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  /**
   * Check if verbose mode is enabled
   */
  isVerbose(): boolean {
    return this.verbose;
  }

  // ==================== State Management ====================

  /**
   * Update progress
   */
  setProgress(progress: number, status?: string): void {
    this.state.progress = Math.max(0, Math.min(100, progress));
    if (status) {
      this.state.status = status;
    }
    this.logDebug(`Progress: ${this.state.progress}% - ${this.state.status}`);
  }

  /**
   * Get current progress
   */
  getProgress(): number {
    return this.state.progress;
  }

  /**
   * Update status message
   */
  setStatus(status: string): void {
    this.state.status = status;
    this.logDebug(`Status: ${status}`);
  }

  /**
   * Get current status
   */
  getStatus(): string {
    return this.state.status;
  }

  /**
   * Add intermediate result
   */
  addIntermediateResult(result: unknown): void {
    this.state.intermediateResults.push(result);
    this.logDebug('Intermediate result added');
  }

  /**
   * Get all intermediate results
   */
  getIntermediateResults(): unknown[] {
    return [...this.state.intermediateResults];
  }

  /**
   * Check if execution is cancelled
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Cancel execution
   */
  cancel(): void {
    this.cancelled = true;
    this.state.status = 'cancelled';
    this.logger.info(`Execution cancelled: ${this.requestId}`);
  }

  // ==================== Elapsed Time ====================

  /**
   * Get elapsed time in milliseconds
   */
  getElapsedTime(): number {
    return Date.now() - this.state.startTime;
  }

  /**
   * Check if timeout exceeded
   */
  isTimeoutExceeded(maxTimeMs: number): boolean {
    return this.getElapsedTime() > maxTimeMs;
  }

  // ==================== Logging ====================

  /**
   * Log debug message (only if verbose mode)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.verbose) {
      this.logger.debug(`[${this.requestId}] ${message}`, ...args);
    }
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    this.logger.info(`[${this.requestId}] ${message}`, ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(`[${this.requestId}] ${message}`, ...args);
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    this.logger.error(`[${this.requestId}] ${message}`, ...args);
  }

  /**
   * Internal debug log helper
   */
  private logDebug(message: string): void {
    if (this.verbose) {
      this.logger.debug(`[${this.requestId}] ${message}`);
    }
  }

  // ==================== Context Data ====================

  /**
   * Custom data storage
   */
  private customData: Map<string, unknown> = new Map();

  /**
   * Store custom data
   */
  setData(key: string, value: unknown): void {
    this.customData.set(key, value);
  }

  /**
   * Get custom data
   */
  getData<T>(key: string): T | undefined {
    return this.customData.get(key) as T | undefined;
  }

  /**
   * Delete custom data
   */
  deleteData(key: string): boolean {
    return this.customData.delete(key);
  }

  /**
   * Get all custom data keys
   */
  getDataKeys(): string[] {
    return Array.from(this.customData.keys());
  }

  // ==================== Clone ====================

  /**
   * Create a child context
   */
  createChildContext(options: Partial<ToolContextOptions>): ToolContext {
    return new ToolContext({
      request_id: this.requestId,
      caller_plugin_id: this.callerPluginId,
      caller_plugin_name: this.callerPluginName,
      timestamp: this.timestamp,
      logger: this.logger,
      verbose: this.verbose,
      working_directory: this.workingDirectory,
      ...options,
    });
  }

  /**
   * Clone the current context
   */
  clone(): ToolContext {
    const cloned = new ToolContext({
      request_id: this.requestId,
      caller_plugin_id: this.callerPluginId,
      caller_plugin_name: this.callerPluginName,
      timestamp: this.timestamp,
      logger: this.logger,
      verbose: this.verbose,
      working_directory: this.workingDirectory,
    });

    // Copy state
    cloned.state = {
      ...this.state,
      intermediateResults: [...this.state.intermediateResults],
    };
    cloned.cancelled = this.cancelled;

    // Copy custom data
    for (const [key, value] of this.customData) {
      cloned.customData.set(key, value);
    }

    return cloned;
  }
}
