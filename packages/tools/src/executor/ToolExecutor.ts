/**
 * Tool Executor - Handles tool execution with validation and security
 */

import type {
  ToolDefinition,
  ToolResult,
  ToolError,
  ToolParameterDefinition,
  ToolParameter,
  ToolExecutionContext,
  Logger,
} from '@organic/utils';
import { ToolErrorCode as ErrorCode } from '@organic/utils';
import { ToolContext } from './ToolContext.js';

/**
 * Execution options
 */
export interface ExecutionOptions {
  /** Request ID for tracking */
  requestId?: string;
  /** Caller plugin ID */
  callerPluginId?: string;
  /** Caller plugin name */
  callerPluginName?: string;
  /** Working directory */
  workingDirectory?: string;
  /** Execution timeout override */
  timeout?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Tool executor options
 */
export interface ToolExecutorOptions {
  /** Logger instance */
  logger?: Logger;
  /** Default execution timeout in milliseconds */
  defaultTimeout?: number;
  /** Maximum output size in bytes */
  maxOutputSize?: number;
  /** Enable parameter validation */
  validateParameters?: boolean;
}

/**
 * Parameter validation result
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedParams?: Record<string, unknown>;
}

/**
 * ToolExecutor - Handles the complete tool execution lifecycle
 */
export class ToolExecutor {
  private logger: Logger;
  private defaultTimeout: number;
  private maxOutputSize: number;
  private validateParameters: boolean;
  private executionCounter: number = 0;

  constructor(options: ToolExecutorOptions = {}) {
    const { 
      logger, 
      defaultTimeout = 30000, 
      maxOutputSize = 1024 * 1024, // 1MB
      validateParameters = true 
    } = options;
    
    const { createLogger } = require('@organic/utils');
    this.logger = logger ?? createLogger({ prefix: 'tool-executor' });
    this.defaultTimeout = defaultTimeout;
    this.maxOutputSize = maxOutputSize;
    this.validateParameters = validateParameters;
  }

  /**
   * Execute a tool
   */
  async execute(
    tool: ToolDefinition,
    handler: (params: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>,
    params: Record<string, unknown>,
    options: ExecutionOptions = {}
  ): Promise<ToolResult> {
    const requestId = options.requestId ?? this.generateRequestId();
    const startTime = Date.now();
    const executionId = ++this.executionCounter;

    this.logger.info(`[${executionId}] Executing tool: ${tool.name}`, {
      requestId,
      params: this.validateParameters ? params : '[hidden]',
    });

    // Phase 1: Parameter Validation
    if (this.validateParameters) {
      const validationResult = this.validateParams(params, tool.parameters);
      if (!validationResult.valid) {
        return this.createToolResult(tool.name, requestId, startTime, false, undefined, {
          code: ErrorCode.INVALID_ARGUMENTS,
          message: `Parameter validation failed: ${validationResult.errors.join(', ')}`,
          details: validationResult.errors,
        });
      }
      params = validationResult.sanitizedParams!;
    }

    // Create execution context
    const context = new ToolContext({
      request_id: requestId,
      caller_plugin_id: options.callerPluginId ?? 'kernel',
      caller_plugin_name: options.callerPluginName ?? 'kernel',
      timestamp: startTime,
      verbose: options.verbose ?? false,
      logger: this.logger,
      working_directory: options.workingDirectory ?? process.cwd(),
    });

    // Phase 2: Execution
    try {
      const timeout = options.timeout ?? tool.max_execution_time ?? this.defaultTimeout;
      const result = await this.executeWithTimeout(
        handler(params, context.getContext()),
        timeout,
        tool.name
      );

      // Phase 3: Result Processing
      const processedResult = this.processResult(result, startTime, requestId);

      this.logger.info(`[${executionId}] Tool executed successfully: ${tool.name}`, {
        requestId,
        executionTime: processedResult.metadata.execution_time,
      });

      return processedResult;
    } catch (error) {
      this.logger.error(`[${executionId}] Tool execution failed: ${tool.name}`, error);

      if (error instanceof Error && error.message.includes('timeout')) {
        return this.createToolResult(tool.name, requestId, startTime, false, undefined, {
          code: ErrorCode.TIMEOUT,
          message: error.message,
        });
      }

      return this.createToolResult(tool.name, requestId, startTime, false, undefined, {
        code: ErrorCode.EXECUTION_ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate parameters against definition
   */
  private validateParams(
    params: Record<string, unknown>,
    definition: ToolParameterDefinition
  ): ValidationResult {
    const errors: string[] = [];
    const sanitized: Record<string, unknown> = {};

    // Check required parameters
    for (const required of definition.required) {
      if (!(required in params) || params[required] === undefined || params[required] === null) {
        errors.push(`Missing required parameter: ${required}`);
      }
    }

    // Validate each provided parameter
    for (const [key, value] of Object.entries(params)) {
      const property = definition.properties[key];

      if (!property) {
        if (!definition.additionalProperties) {
          errors.push(`Unknown parameter: ${key}`);
        }
        sanitized[key] = value;
        continue;
      }

      const paramError = this.validateParameter(key, value, property);
      if (paramError) {
        errors.push(paramError);
      } else {
        sanitized[key] = this.sanitizeValue(value, property);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedParams: errors.length === 0 ? sanitized : undefined,
    };
  }

  /**
   * Validate a single parameter
   */
  private validateParameter(
    name: string,
    value: unknown,
    property: ToolParameter
  ): string | null {
    // Type check
    if (value === undefined || value === null) {
      return null; // Let required check handle this
    }

    const expectedType = property.type;
    let actualType: string = typeof value;

    if (Array.isArray(value)) {
      actualType = 'array';
    } else if (typeof value === 'object') {
      actualType = 'object';
    }

    if (expectedType !== actualType) {
      return `Parameter '${name}' expected type '${expectedType}', got '${actualType}'`;
    }

    // Type-specific validation
    if (expectedType === 'string') {
      const strValue = String(value);

      if (property.minLength !== undefined && strValue.length < property.minLength) {
        return `Parameter '${name}' must be at least ${property.minLength} characters`;
      }

      if (property.maxLength !== undefined && strValue.length > property.maxLength) {
        return `Parameter '${name}' must be at most ${property.maxLength} characters`;
      }

      if (property.pattern) {
        const regex = new RegExp(property.pattern);
        if (!regex.test(strValue)) {
          return `Parameter '${name}' does not match required pattern`;
        }
      }
    }

    if (expectedType === 'number') {
      const numValue = Number(value);

      if (property.minimum !== undefined && numValue < property.minimum) {
        return `Parameter '${name}' must be at least ${property.minimum}`;
      }

      if (property.maximum !== undefined && numValue > property.maximum) {
        return `Parameter '${name}' must be at most ${property.maximum}`;
      }
    }

    if (property.enum && property.enum.length > 0) {
      if (!property.enum.includes(value)) {
        return `Parameter '${name}' must be one of: ${property.enum.join(', ')}`;
      }
    }

    return null;
  }

  /**
   * Sanitize parameter value
   */
  private sanitizeValue(value: unknown, property: ToolParameter): unknown {
    if (property.type === 'string') {
      return String(value).trim();
    }
    if (property.type === 'number') {
      return Number(value);
    }
    if (property.type === 'boolean') {
      return Boolean(value);
    }
    return value;
  }

  /**
   * Process result and ensure it matches expected format
   */
  private processResult(result: ToolResult, startTime: number, requestId: string): ToolResult {
    const endTime = Date.now();

    // Ensure metadata is complete
    return {
      success: result.success,
      data: result.data,
      error: result.error,
      metadata: {
        tool_name: result.metadata.tool_name,
        start_time: result.metadata.start_time || startTime,
        end_time: endTime,
        execution_time: result.metadata.execution_time || (endTime - startTime),
        request_id: requestId,
      },
    };
  }

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
    return `req_${Date.now()}_${++this.executionCounter}`;
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
