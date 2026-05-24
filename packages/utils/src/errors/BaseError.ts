/**
 * Base error class for Organic Interface
 * Provides common error functionality across the application
 */

/**
 * Base error class providing common error functionality for the application.
 * All domain-specific errors should extend this class to ensure consistent
 * error handling and structured error responses.
 *
 * @remarks
 * This class provides:
 * - Structured error codes for programmatic error handling
 * - Detailed error information for debugging
 * - Timestamp tracking for when errors occurred
 * - JSON serialization for logging and API responses
 * - Human-readable error summaries
 *
 * @example
 * ```typescript
 * class DatabaseError extends BaseError {
 *   constructor(operation: string, details?: unknown) {
 *     super(
 *       `Database operation failed: ${operation}`,
 *       'DATABASE_ERROR',
 *       details
 *     );
 *   }
 * }
 * ```
 */
export class BaseError extends Error {
  /** Error code for programmatic handling - use this to identify error type in catch blocks */
  public readonly code: string;
  /** Error details for debugging - contains additional context about the error */
  public readonly details?: unknown;
  /** Timestamp when the error occurred - milliseconds since Unix epoch */
  public readonly timestamp: number;

  /**
   * Create a new BaseError
   * @param message - Human-readable error description
   * @param code - Error code for programmatic handling (default: 'UNKNOWN_ERROR')
   * @param details - Additional error context for debugging
   */
  constructor(message: string, code: string = 'UNKNOWN_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Get a human-readable error summary
   */
  toString(): string {
    return `[${this.code}] ${this.name}: ${this.message}`;
  }
}