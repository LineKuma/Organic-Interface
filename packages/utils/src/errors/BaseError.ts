/**
 * Base error class for Organic Interface
 */

/**
 * Base error class providing common error functionality
 */
export class BaseError extends Error {
  /** Error code for programmatic handling */
  public readonly code: string;
  /** Error details for debugging */
  public readonly details?: unknown;
  /** Timestamp when the error occurred */
  public readonly timestamp: number;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();

    // Maintains proper stack trace for where error was thrown (only available on V8)
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