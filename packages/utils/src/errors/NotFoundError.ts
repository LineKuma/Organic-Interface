/**
 * Not found error for Organic Interface
 */

import { BaseError } from './BaseError.js';

/**
 * Error codes for not found errors
 * Used to identify the specific type of resource that was not found
 */
export enum NotFoundErrorCode {
  /** Generic resource not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Plugin not found in registry or loader */
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  /** Tool not found in tool registry */
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  /** Configuration key not found */
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  /** File or directory not found on filesystem */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
}

/**
 * NotFoundError class for resource lookup failures.
 * Use the static factory methods (plugin, tool, config, file) for common scenarios,
 * or the constructor for custom resource types.
 *
 * @example
 * ```typescript
 * // Using factory methods
 * throw NotFoundError.plugin('auth-plugin');
 * throw NotFoundError.tool('SearchTool');
 *
 * // Using constructor for custom resource types
 * throw new NotFoundError(
 *   'User profile not found',
 *   'user',
 *   userId,
 *   NotFoundErrorCode.NOT_FOUND,
 *   { searchParams: { userId, timestamp } }
 * );
 * ```
 */
export class NotFoundError extends BaseError {
  /** The type of resource that was not found (e.g., 'plugin', 'tool', 'config', 'file') */
  public readonly resourceType: string;
  /** The identifier that was used for the lookup that failed */
  public readonly resourceId: string;

  /**
   * Create a NotFoundError
   * @param message - Human-readable error description
   * @param resourceType - Type of resource that was not found
   * @param resourceId - Identifier used for the failed lookup
   * @param code - Error code from NotFoundErrorCode enum (default: NOT_FOUND)
   * @param details - Additional context for debugging
   */
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