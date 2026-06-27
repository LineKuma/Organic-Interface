/**
 * ToolService - Manages tool registration, discovery, and execution
 *
 * Provides a unified interface for tool management in the Organic system.
 */

import { createLogger, type Logger } from '@organic/utils';
import { EventEmitter } from 'events';
import {
  type Tool,
  type ToolDefinition,
  type ToolResult,
  type ToolExecutionContext,
  type ToolRegistryEntry,
  type ToolStats,
  type ToolServiceConfig,
  type ToolValidationError,
  type ToolExecutionOptions,
  type ToolPermissionType,
} from '../types/index.js';
import type { SecurityGuard } from '../security/SecurityGuard.js';

/**
 * Default tool service configuration
 */
export const DEFAULT_TOOL_SERVICE_CONFIG: ToolServiceConfig = {
  defaultTimeout: 30000,
  maxConcurrentExecutions: 10,
  enableValidation: true,
  enableLogging: true,
  enableMetrics: true,
};

/**
 * ToolService events
 */
export interface ToolServiceEvents {
  'tool:registered': { toolId: string; timestamp: number };
  'tool:unregistered': { toolId: string; timestamp: number };
  'tool:enabled': { toolId: string; timestamp: number };
  'tool:disabled': { toolId: string; timestamp: number };
  'execution:start': { toolId: string; executionId: string; timestamp: number };
  'execution:complete': {
    toolId: string;
    executionId: string;
    result: ToolResult;
    timestamp: number;
  };
  'execution:error': { toolId: string; executionId: string; error: Error; timestamp: number };
}

/**
 * ToolService - Manages tool registration and execution
 */
export class ToolService extends EventEmitter {
  /** Service configuration */
  private config: ToolServiceConfig;

  /** Tool registry */
  private tools: Map<string, ToolRegistryEntry> = new Map();

  /** Logger instance */
  private logger: Logger;

  /** Active executions */
  private activeExecutions: Map<string, { toolId: string; startTime: number }> = new Map();

  /** Execution counter */
  private executionCounter: number = 0;

  /** Security guard for preset-based authorization */
  private securityGuard: SecurityGuard | null = null;

  /**
   * Create a new ToolService instance
   */
  constructor(config: Partial<ToolServiceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_TOOL_SERVICE_CONFIG, ...config };
    this.logger = createLogger({ prefix: 'tool-service' });
  }

  // ==================== Tool Registration ====================

  /**
   * Register a tool
   */
  registerTool(tool: Tool): void {
    const definition = tool.getDefinition();

    if (this.tools.has(definition.id)) {
      this.logger.warn(`Tool already registered: ${definition.id}`);
      return;
    }

    const entry: ToolRegistryEntry = {
      definition,
      instance: tool,
      registeredAt: Date.now(),
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0,
        avgExecutionTime: 0,
      },
    };

    this.tools.set(definition.id, entry);
    this.logger.info(`Registered tool: ${definition.name} (${definition.id})`);
    this.emit('tool:registered', { toolId: definition.id, timestamp: Date.now() });
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolId: string): boolean {
    const entry = this.tools.get(toolId);
    if (!entry) {
      this.logger.warn(`Tool not found: ${toolId}`);
      return false;
    }

    // Check if tool is currently executing
    for (const execution of this.activeExecutions.values()) {
      if (execution.toolId === toolId) {
        this.logger.warn(`Cannot unregister tool while executing: ${toolId}`);
        return false;
      }
    }

    this.tools.delete(toolId);
    this.logger.info(`Unregistered tool: ${toolId}`);
    this.emit('tool:unregistered', { toolId, timestamp: Date.now() });
    return true;
  }

  /**
   * Get a tool by ID
   */
  getTool(toolId: string): Tool | undefined {
    return this.tools.get(toolId)?.instance;
  }

  /**
   * Get tool definition by ID
   */
  getToolDefinition(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId)?.definition;
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(entry => entry.definition);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): ToolDefinition[] {
    return this.getAllTools().filter(tool => tool.category === category);
  }

  /**
   * Enable a tool
   */
  enableTool(toolId: string): boolean {
    const entry = this.tools.get(toolId);
    if (!entry) {
      this.logger.warn(`Tool not found: ${toolId}`);
      return false;
    }

    entry.definition.enabled = true;
    this.logger.info(`Enabled tool: ${toolId}`);
    this.emit('tool:enabled', { toolId, timestamp: Date.now() });
    return true;
  }

  /**
   * Disable a tool
   */
  disableTool(toolId: string): boolean {
    const entry = this.tools.get(toolId);
    if (!entry) {
      this.logger.warn(`Tool not found: ${toolId}`);
      return false;
    }

    entry.definition.enabled = false;
    this.logger.info(`Disabled tool: ${toolId}`);
    this.emit('tool:disabled', { toolId, timestamp: Date.now() });
    return true;
  }

  // ==================== Security ====================

  /**
   * Set the security guard for preset-based authorization
   */
  setSecurityGuard(guard: SecurityGuard): this {
    this.securityGuard = guard;
    this.logger.info(`Security guard set with preset: ${guard.getPreset()}`);
    return this;
  }

  /**
   * Get the security guard instance
   */
  getSecurityGuard(): SecurityGuard | null {
    return this.securityGuard;
  }

  /**
   * Map a tool and its input to the required permission type for authorization.
   * Derives the operation type from the tool category and the specific operation being performed.
   */
  private mapCategoryToPermission(toolId: string, input: unknown): ToolPermissionType {
    const entry = this.tools.get(toolId);
    const category = entry?.definition.category ?? 'unknown';

    // For file tools, check the specific operation to distinguish read/write
    if (category === 'file' && input && typeof input === 'object') {
      const op = (input as Record<string, unknown>).operation;
      if (op === 'read' || op === 'exists' || op === 'stat' || op === 'list') {
        return 'read';
      }
      if (op === 'write' || op === 'copy' || op === 'move' || op === 'delete' || op === 'mkdir') {
        return 'write';
      }
      return 'filesystem';
    }

    switch (category) {
      case 'shell':
        return 'execute';
      case 'search':
        return 'read';
      case 'http':
        return 'network';
      default:
        return 'execute';
    }
  }

  // ==================== Tool Execution ====================

  /**
   * Execute a tool by ID
   */
  async execute(
    toolId: string,
    input: unknown,
    context: Partial<ToolExecutionContext> = {},
    options: ToolExecutionOptions = {}
  ): Promise<ToolResult> {
    const entry = this.tools.get(toolId);
    if (!entry) {
      return {
        success: false,
        error: `Tool not found: ${toolId}`,
        executionTime: 0,
      };
    }

    if (!entry.definition.enabled) {
      return {
        success: false,
        error: `Tool is disabled: ${toolId}`,
        executionTime: 0,
      };
    }

    // Generate execution ID
    const executionId = `${toolId}_${++this.executionCounter}_${Date.now()}`;

    // Validate input
    if (this.config.enableValidation) {
      const errors = entry.instance.validate(input);
      if (errors.length > 0) {
        return {
          success: false,
          error: `Validation failed: ${errors.map(e => e.message).join(', ')}`,
          executionTime: 0,
          metadata: { validationErrors: errors },
        };
      }
    }

    // Security guard authorization
    if (this.securityGuard) {
      const operation = this.mapCategoryToPermission(toolId, input);
      const authResult = await this.securityGuard.authorize(toolId, input, operation, {
        category: entry.definition.category,
      });

      if (!authResult.approved) {
        return {
          success: false,
          error: `Authorization denied: ${authResult.reason ?? 'Blocked by security policy'}`,
          executionTime: 0,
          metadata: { authResult },
        };
      }
    }

    // Create full execution context
    const fullContext: ToolExecutionContext = {
      toolId,
      executionId,
      workingDirectory: context.workingDirectory ?? process.cwd(),
      environment: context.environment ?? {},
      cancelled: false,
      permissionLevel: context.permissionLevel ?? 'L2',
      metadata: context.metadata ?? {},
      ...context,
    };

    // Start execution
    const startTime = Date.now();
    this.activeExecutions.set(executionId, { toolId, startTime });
    this.emit('execution:start', { toolId, executionId, timestamp: startTime });

    // Apply timeout
    const timeout = options.timeout ?? entry.definition.timeout ?? this.config.defaultTimeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms`));
      }, timeout);
    });

    try {
      // Execute with timeout
      const result = await Promise.race([
        entry.instance.execute(input, fullContext),
        timeoutPromise,
      ]);

      // Update stats
      this.updateStats(toolId, result, Date.now() - startTime);

      this.emit('execution:complete', { toolId, executionId, result, timestamp: Date.now() });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorResult: ToolResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      };

      this.updateStats(toolId, errorResult, executionTime);

      this.emit('execution:error', {
        toolId,
        executionId,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now(),
      });

      return errorResult;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Validate tool input
   */
  validate(toolId: string, input: unknown): ToolValidationError[] {
    const tool = this.getTool(toolId);
    if (!tool) {
      return [{ path: '', message: `Tool not found: ${toolId}` }];
    }

    return tool.validate(input);
  }

  // ==================== Statistics ====================

  /**
   * Get tool statistics
   */
  getToolStats(toolId: string): ToolStats | undefined {
    return this.tools.get(toolId)?.stats;
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    totalTools: number;
    enabledTools: number;
    activeExecutions: number;
    totalExecutions: number;
    avgExecutionTime: number;
  } {
    let totalExecutions = 0;
    let totalTime = 0;

    for (const entry of this.tools.values()) {
      totalExecutions += entry.stats.totalExecutions;
      totalTime += entry.stats.totalExecutionTime;
    }

    return {
      totalTools: this.tools.size,
      enabledTools: this.getAllTools().filter(t => t.enabled).length,
      activeExecutions: this.activeExecutions.size,
      totalExecutions,
      avgExecutionTime: totalExecutions > 0 ? totalTime / totalExecutions : 0,
    };
  }

  /**
   * Update tool statistics
   */
  private updateStats(toolId: string, result: ToolResult, executionTime: number): void {
    if (!this.config.enableMetrics) return;

    const entry = this.tools.get(toolId);
    if (!entry) return;

    entry.stats.totalExecutions++;
    entry.stats.totalExecutionTime += executionTime;
    entry.stats.avgExecutionTime = entry.stats.totalExecutionTime / entry.stats.totalExecutions;
    entry.stats.lastExecutionAt = Date.now();

    if (result.success) {
      entry.stats.successfulExecutions++;
      entry.stats.lastSuccessAt = Date.now();
    } else {
      entry.stats.failedExecutions++;
      entry.stats.lastFailureAt = Date.now();
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Check if a tool is registered
   */
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Check if a tool is enabled
   */
  isToolEnabled(toolId: string): boolean {
    return this.tools.get(toolId)?.definition.enabled ?? false;
  }

  /**
   * Get active execution count
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Check if service can accept more executions
   */
  canAcceptExecution(): boolean {
    return this.activeExecutions.size < this.config.maxConcurrentExecutions;
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    this.logger.info('Tool registry cleared');
  }
}

/**
 * Create a tool service instance
 */
export function createToolService(config?: Partial<ToolServiceConfig>): ToolService {
  return new ToolService(config);
}
