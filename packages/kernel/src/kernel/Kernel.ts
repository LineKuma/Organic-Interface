/**
 * Kernel - Core runtime for Organic Interface
 */

import type {
  KernelConfig,
  KernelApi,
  PluginInterface,
  PluginInput,
  PluginOutput,
  PluginConfig,
  ToolResult,
  ToolError,
  ToolErrorCode,
} from '@organic/utils';
import { createLogger, type Logger } from '@organic/utils';
import { EventBus, KernelEvents } from './EventBus.js';
import { LifecycleManager, LifecycleState } from './LifecycleManager.js';
import { PluginManager } from './PluginManager.js';
import { TextService, InfoService, type TextServiceConfig, type InfoServiceConfig } from '../services/index.js';

/**
 * Kernel options for creation
 */
export interface KernelOptions {
  /** Kernel configuration */
  config: KernelConfig;
  /** Custom logger instance */
  logger?: Logger;
  /** Enable debug logging */
  debug?: boolean;
  /** Text service configuration */
  textServiceConfig?: TextServiceConfig;
  /** Info service configuration */
  infoServiceConfig?: InfoServiceConfig;
}

/**
 * Kernel implementation - Core runtime for Organic Interface
 */
export class Kernel implements KernelApi {
  private config: KernelConfig;
  private logger: Logger;
  private eventBus: EventBus;
  private lifecycle: LifecycleManager;
  private pluginManager: PluginManager;
  private requestCounter: number = 0;

  /** Text service for CLI output */
  public readonly text: TextService;

  /** Info service for system information */
  public readonly info: InfoService;

  constructor(options: KernelOptions) {
    this.config = { ...options.config };
    this.logger = options.logger ?? createLogger({ prefix: 'kernel' });

    // Initialize event bus
    this.eventBus = new EventBus({ logger: this.logger });

    // Initialize lifecycle manager
    this.lifecycle = new LifecycleManager({ logger: this.logger });

    // Initialize plugin manager with kernel API
    this.pluginManager = new PluginManager({
      kernelApi: this,
      eventBus: this.eventBus,
      logger: this.logger,
    });

    // Initialize text service
    this.text = new TextService(options.textServiceConfig);

    // Initialize info service
    this.info = new InfoService(options.infoServiceConfig);
  }

  // ==================== KernelApi Implementation ====================

  /**
   * Get kernel configuration
   */
  getConfig(): KernelConfig {
    return { ...this.config };
  }

  /**
   * Get kernel version
   */
  getVersion(): string {
    return this.config.version;
  }

  /**
   * Register a plugin
   */
  async registerPlugin(plugin: PluginInterface): Promise<void> {
    this.ensureLifecycleState(LifecycleState.INITIALIZED, LifecycleState.RUNNING);
    await this.pluginManager.register(plugin);
  }

  /**
   * Unregister a plugin by name
   */
  async unregisterPlugin(name: string): Promise<void> {
    this.ensureLifecycleState(LifecycleState.INITIALIZED, LifecycleState.RUNNING);
    await this.pluginManager.unregister(name);
  }

  /**
   * Get a plugin by name
   */
  getPlugin(name: string): PluginInterface | undefined {
    return this.pluginManager.get(name);
  }

  /**
   * List all registered plugins
   */
  listPlugins(): PluginInterface[] {
    return this.pluginManager.list();
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    this.ensureLifecycleState(LifecycleState.RUNNING);

    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.logger.info(`Executing tool: ${name}`, { requestId });

    try {
      // Find plugin that owns this tool
      const plugins = this.pluginManager.list();

      for (const plugin of plugins) {
        const result = await plugin.execute({
          action: 'executeTool',
          params: { name, params, requestId },
        });

        if (result.success && result.data) {
          return result.data as ToolResult;
        }
      }

      return this.createToolResult(
        name,
        requestId,
        startTime,
        false,
        undefined,
        {
          code: 'TOOL_NOT_FOUND' as ToolErrorCode,
          message: `Tool ${name} not found`,
        }
      );
    } catch (error) {
      this.logger.error(`Tool execution error: ${name}`, error);
      return this.createToolResult(
        name,
        requestId,
        startTime,
        false,
        undefined,
        {
          code: 'EXECUTION_ERROR' as ToolErrorCode,
          message: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Initialize the kernel
   */
  async initialize(): Promise<void> {
    if (this.lifecycle.isState(LifecycleState.INITIALIZED) ||
        this.lifecycle.isState(LifecycleState.RUNNING)) {
      this.logger.warn('Kernel already initialized');
      return;
    }

    this.logger.info(`Initializing Kernel: ${this.config.name} v${this.config.version}`);

    await this.lifecycle.transition(LifecycleState.INITIALIZING);

    try {
      // Emit init event
      this.eventBus.emit(KernelEvents.KERNEL_INIT, {
        name: this.config.name,
        version: this.config.version,
      });

      await this.lifecycle.transition(LifecycleState.INITIALIZED, {
        plugins: this.config.plugins,
        tools: this.config.tools,
      });

      this.logger.info('Kernel initialized successfully');
    } catch (error) {
      await this.lifecycle.transition(LifecycleState.ERROR, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start the kernel
   */
  async start(): Promise<void> {
    if (this.lifecycle.isState(LifecycleState.RUNNING)) {
      this.logger.warn('Kernel already running');
      return;
    }

    this.ensureLifecycleState(LifecycleState.INITIALIZED);

    this.logger.info('Starting kernel');

    await this.lifecycle.transition(LifecycleState.STARTING);

    // Initialize enabled plugins
    const plugins = this.pluginManager.listWithMetadata();
    for (const metadata of plugins) {
      if (metadata.enabled) {
        await this.pluginManager.initialize(metadata.plugin.name);
      }
    }

    await this.lifecycle.transition(LifecycleState.RUNNING);

    // Emit start event
    this.eventBus.emit(KernelEvents.KERNEL_START, {
      name: this.config.name,
      version: this.config.version,
    });

    this.logger.info('Kernel started successfully');
  }

  /**
   * Stop the kernel
   */
  async stop(): Promise<void> {
    if (this.lifecycle.isState(LifecycleState.STOPPED)) {
      this.logger.warn('Kernel already stopped');
      return;
    }

    this.logger.info('Stopping kernel');

    await this.lifecycle.transition(LifecycleState.STOPPING);

    // Shutdown all plugins
    await this.pluginManager.shutdownAll();

    await this.lifecycle.transition(LifecycleState.STOPPED);

    // Emit stop event
    this.eventBus.emit(KernelEvents.KERNEL_STOP, {
      name: this.config.name,
    });

    this.logger.info('Kernel stopped successfully');
  }

  // ==================== Configuration Methods ====================

  /**
   * Update kernel configuration
   */
  updateConfig(config: Partial<KernelConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    this.logger.info('Kernel configuration updated');

    this.eventBus.emit(KernelEvents.CONFIG_UPDATE, {
      oldConfig: { ...this.config, ...config },
      newConfig: this.config,
    });
  }

  // ==================== Plugin Management Methods ====================

  /**
   * Get plugin manager instance
   */
  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  /**
   * Get event bus instance
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Get lifecycle manager instance
   */
  getLifecycleManager(): LifecycleManager {
    return this.lifecycle;
  }

  /**
   * Execute a plugin action directly
   */
  async executePlugin(name: string, input: PluginInput): Promise<PluginOutput> {
    return this.pluginManager.execute(name, input);
  }

  // ==================== Event Methods ====================

  /**
   * Subscribe to an event
   */
  onEvent<T = unknown>(
    event: string,
    listener: (data: T) => void
  ): { unsubscribe: () => void } {
    return this.eventBus.on(event, (e) => listener(e.data as T));
  }

  /**
   * Subscribe to an event once
   */
  onceEvent<T = unknown>(
    event: string,
    listener: (data: T) => void
  ): { unsubscribe: () => void } {
    return this.eventBus.once(event, (e) => listener(e.data as T));
  }

  // ==================== Status Methods ====================

  /**
   * Get kernel status
   */
  getStatus(): {
    name: string;
    version: string;
    state: LifecycleState;
    pluginCount: number;
    isRunning: boolean;
    isActive: boolean;
  } {
    return {
      name: this.config.name,
      version: this.config.version,
      state: this.lifecycle.getState(),
      pluginCount: this.pluginManager.count(),
      isRunning: this.lifecycle.isRunning(),
      isActive: this.lifecycle.isActive(),
    };
  }

  // ==================== Private Methods ====================

  /**
   * Ensure kernel is in one of the allowed lifecycle states
   */
  private ensureLifecycleState(...allowedStates: LifecycleState[]): void {
    if (!this.lifecycle.isAnyState(...allowedStates)) {
      const currentState = this.lifecycle.getState();
      throw new Error(
        `Invalid kernel state: ${currentState}. Expected one of: ${allowedStates.join(', ')}`
      );
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  /**
   * Create a tool result object
   */
  private createToolResult(
    toolName: string,
    requestId: string,
    startTime: number,
    success: boolean,
    data?: unknown,
    error?: ToolError
  ): ToolResult {
    const endTime = Date.now();
    return {
      success,
      data,
      error,
      metadata: {
        tool_name: toolName,
        start_time: startTime,
        end_time: endTime,
        execution_time: endTime - startTime,
        request_id: requestId,
      },
    };
  }
}
