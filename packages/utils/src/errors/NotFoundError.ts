/**
 * Not found error for Organic Interface
 */

import { BaseError } from './BaseError.js';

/**
 * Error codes for not found errors
 */
export enum NotFoundErrorCode {
  /** Resource not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Plugin not found */
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  /** Tool not found */
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  /** Configuration not found */
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  /** File not found */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
}

/**
 * Not found error class for resource lookup failures
 */
export class NotFoundError extends BaseError {
  /** The type of resource that was not found */
  public readonly resourceType: string;
  /** The identifier that was used for lookup */
  public readonly resourceId: string;

  constructor(
    message: string,
    resourceType: string,
    resourceId: string,
    code: NotFoundErrorCode = NotFoundErrorCode.NOT_FOUND,
    details?: unknown
  ) {
    super(message, code, details);
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }

  /**
   * Create error for plugin not found
   */
  static plugin(pluginName: string): NotFoundError {
    return new NotFoundError(
      `Plugin '${pluginName}' not found`,
      'plugin',
      pluginName,
      NotFoundErrorCode.PLUGIN_NOT_FOUND
    );
  }

  /**
   * Create error for tool not found
   */
  static tool(toolName: string): NotFoundError {
    return new NotFoundError(
      `Tool '${toolName}' not found`,
      'tool',
      toolName,
      NotFoundErrorCode.TOOL_NOT_FOUND
    );
  }

  /**
   * Create error for configuration not found
   */
  static config(configKey: string): NotFoundError {
    return new NotFoundError(
      `Configuration '${configKey}' not found`,
      'config',
      configKey,
      NotFoundErrorCode.CONFIG_NOT_FOUND
    );
  }

  /**
   * Create error for file not found
   */
  static file(filePath: string): NotFoundError {
    return new NotFoundError(
      `File '${filePath}' not found`,
      'file',
      filePath,
      NotFoundErrorCode.FILE_NOT_FOUND
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      resourceType: this.resourceType,
      resourceId: this.resourceId,
    };
  }
}