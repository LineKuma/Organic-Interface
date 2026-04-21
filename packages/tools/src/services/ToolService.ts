/**
 * Tool Service - Core tool registration, discovery, and invocation management
 */

import type {
  ToolDefinition,
  ToolResult,
  ToolError,
  ToolErrorCode,
  ToolType,
  ToolCallLevel,
  ToolExecutionContext,
  Logger,
} from '@organic/utils';
import { ToolErrorCode as ErrorCode } from '@organic/utils';

/**
 * Tool service options
 */
export interface ToolServiceOptions {
  /** Logger instance */
  logger?: Logger;
  /** Default tool execution timeout in milliseconds */
  defaultTimeout?: number;
  /** Enable tool execution */
  enabled?: boolean;
}

/**
 * Tool registry entry with metadata
 */
interface ToolRegistryEntry {
  /** Tool definition */
  definition: ToolDefinition;
  /** Handler function */
  handler: (params: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
  /** Plugin that registered this tool */
  pluginId?: string;
  /** When the tool was registered */
  registeredAt: number;
  /** Tool enabled status */
  enabled: boolean;
}

/**
 * Permission entry for tool access control
 */
interface PermissionEntry {
  /** Allowed plugin IDs */
  pluginIds: Set<string>;
  /** Permission granted at timestamp */
  grantedAt: number;
  /** Permission expires at (0 = never expires) */
  expiresAt: number;
}

/**
 * KernelToolService - Core tool management service
 */
export class ToolService {
  private logger: Logger;
  private defaultTimeout: number;
  private enabled: boolean;
  private tools: Map<string, ToolRegistryEntry>;
  private permissions: Map<string, PermissionEntry>;
  private requestCounter: number = 0;

  constructor(options: ToolServiceOptions = {}) {
    const { logger, defaultTimeout = 30000, enabled = true } = options;
    
    // Use logger from utils
    const { createLogger } = require('@organic/utils');
    this.logger = logger ?? createLogger({ prefix: 'tool-service' });
    this.defaultTimeout = defaultTimeout;
    this.enabled = enabled;
    this.tools = new Map();
    this.permissions = new Map();
  }

  // ==================== Tool Invocation ====================

  /**
   * Call a tool and return execution result
   */
  async call_tool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.logger.info(`Calling tool: ${toolName}`, { requestId });

    const tool = this.tools.get(toolName);
    if (!tool) {
      return this.createToolResult(toolName, requestId, startTime, false, undefined, {
        code: ErrorCode.TOOL_NOT_FOUND,
        message: `Tool '${toolName}' not found`,
      });
    }

    if (!tool.enabled) {
      return this.createToolResult(toolName, requestId, startTime, false, undefined, {
        code: ErrorCode.TOOL_DISABLED,
        message: `Tool '${toolName}' is disabled`,
      });
    }

    // Create execution context
    const context: ToolExecutionContext = {
      request_id: requestId,
      caller_plugin_id: 'kernel',
      caller_plugin_name: 'kernel',
      timestamp: startTime,
      logger: this.logger,
    };

    try {
      // Execute with timeout
      const timeout = tool.definition.max_execution_time ?? this.defaultTimeout;
      const result = await this.executeWithTimeout(
        tool.handler(args, context),
        timeout,
        toolName
      );

      return {
        ...result,
        metadata: {
          ...result.metadata,
          request_id: requestId,
          start_time: startTime,
          end_time: Date.now(),
        },
      };
    } catch (error) {
      this.logger.error(`Tool execution error: ${toolName}`, error);
      return this.createToolResult(toolName, requestId, startTime, false, undefined, {
        code: ErrorCode.EXECUTION_ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Asynchronously call a tool
   */
  async call_tool_async(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    return this.call_tool(toolName, args);
  }

  // ==================== Tool Registration ====================

  /**
   * Register a new tool
   */
  register_tool(tool: ToolDefinition, handler: ToolRegistryEntry['handler']): void {
    // Validate tool definition
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Invalid tool name');
    }

    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool '${tool.name}' already registered, replacing`);
    }

    this.tools.set(tool.name, {
      definition: tool,
      handler,
      registeredAt: Date.now(),
      enabled: true,
    });

    // Initialize permission entry for this tool
    if (!this.permissions.has(tool.name)) {
      this.permissions.set(tool.name, {
        pluginIds: new Set(),
        grantedAt: Date.now(),
        expiresAt: 0,
      });
    }

    this.logger.info(`Tool registered: ${tool.name}`, {
      type: tool.type,
      call_level: tool.call_level,
    });
  }

  /**
   * Batch register multiple tools
   */
  register_tools(
    tools: Array<{
      definition: ToolDefinition;
      handler: ToolRegistryEntry['handler'];
    }>
  ): void {
    for (const { definition, handler } of tools) {
      this.register_tool(definition, handler);
    }
  }

  /**
   * Unregister a tool
   */
  unregister_tool(toolName: string): boolean {
    const existed = this.tools.has(toolName);
    this.tools.delete(toolName);
    this.permissions.delete(toolName);
    
    if (existed) {
      this.logger.info(`Tool unregistered: ${toolName}`);
    }
    
    return existed;
  }

  // ==================== Tool Query ====================

  /**
   * Get list of all registered tools
   */
  list_tools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(entry => entry.definition);
  }

  /**
   * Get tool definition by name
   */
  get_tool(toolName: string): ToolDefinition | null {
    const entry = this.tools.get(toolName);
    return entry?.definition ?? null;
  }

  /**
   * List tools by type
   */
  list_tools_by_type(type: ToolType): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(entry => entry.definition.type === type)
      .map(entry => entry.definition);
  }

  /**
   * Get enabled status of a tool
   */
  is_tool_enabled(toolName: string): boolean {
    const entry = this.tools.get(toolName);
    return entry?.enabled ?? false;
  }

  /**
   * Enable or disable a tool
   */
  set_tool_enabled(toolName: string, enabled: boolean): boolean {
    const entry = this.tools.get(toolName);
    if (!entry) {
      return false;
    }
    entry.enabled = enabled;
    this.logger.info(`Tool ${toolName} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  // ==================== Permission Management ====================

  /**
   * Check if plugin has permission to call tool
   */
  check_permission(pluginId: string, toolName: string): boolean {
    const permission = this.permissions.get(toolName);
    
    // If no permission entry exists, check if tool allows any caller
    if (!permission) {
      // Default: allow calls without explicit permissions
      return true;
    }

    // Check if permission has expired
    if (permission.expiresAt > 0 && permission.expiresAt < Date.now()) {
      return false;
    }

    return permission.pluginIds.has(pluginId);
  }

  /**
   * Grant permission to plugin for tool
   */
  grant_permission(pluginId: string, toolName: string): void {
    if (!this.tools.has(toolName)) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    let permission = this.permissions.get(toolName);
    if (!permission) {
      permission = {
        pluginIds: new Set(),
        grantedAt: Date.now(),
        expiresAt: 0,
      };
      this.permissions.set(toolName, permission);
    }

    permission.pluginIds.add(pluginId);
    this.logger.info(`Permission granted: ${pluginId} -> ${toolName}`);
  }

  /**
   * Revoke permission from plugin for tool
   */
  revoke_permission(pluginId: string, toolName: string): void {
    const permission = this.permissions.get(toolName);
    if (permission) {
      permission.pluginIds.delete(pluginId);
      this.logger.info(`Permission revoked: ${pluginId} -> ${toolName}`);
    }
  }

  /**
   * Grant permission with expiration
   */
  grant_permission_with_expiry(
    pluginId: string,
    toolName: string,
    expiresInMs: number
  ): void {
    this.grant_permission(pluginId, toolName);
    
    const permission = this.permissions.get(toolName);
    if (permission) {
      permission.expiresAt = Date.now() + expiresInMs;
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable the service
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.logger.info(`Tool service ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    this.permissions.clear();
    this.logger.info('Tool registry cleared');
  }

  // ==================== Private Methods ====================

  /**
   * Execute with timeout
   */
  private async executeWithTimeout(
    promise: Promise<ToolResult>,
    timeoutMs: number,
    toolName: string
  ): Promise<ToolResult> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Tool '${toolName}' execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Generate unique request ID
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
