/**
 * Base error class for conversation plugin
 */

/**
 * ConversationError - Base error class for all conversation-related errors
 */
export class ConversationError extends Error {
  /** Error code */
  readonly code: string;

  /** Error details */
  readonly details?: unknown;

  /** Timestamp when error occurred */
  readonly timestamp: number;

  /**
   * Create a new ConversationError
   * @param message - Error message
   * @param code - Error code
   * @param details - Additional error details
   */
  constructor(message: string, code: string = 'CONVERSATION_ERROR', details?: unknown) {
    super(message);
    this.name = 'ConversationError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConversationError);
    }
  }

  /**
   * Convert error to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
    };
  }

  /**
   * Create error from plain object
   */
  static fromJSON(obj: Record<string, unknown>): ConversationError {
    const error = new ConversationError(
      obj.message as string,
      obj.code as string,
      obj.details
    );
    return error;
  }
}

/**
 * Error codes
 */
export const ConversationErrorCode = {
  // General errors
  UNKNOWN: 'UNKNOWN',
  INTERNAL: 'INTERNAL',
  INVALID_INPUT: 'INVALID_INPUT',

  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXISTS: 'SESSION_EXISTS',
  SESSION_CLOSED: 'SESSION_CLOSED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Context errors
  CONTEXT_NOT_FOUND: 'CONTEXT_NOT_FOUND',
  CONTEXT_EXPIRED: 'CONTEXT_EXPIRED',
  CONTEXT_FULL: 'CONTEXT_FULL',
  CONTEXT_INVALID: 'CONTEXT_INVALID',

  // Parsing errors
  PARSE_ERROR: 'PARSE_ERROR',
  INVALID_COMMAND: 'INVALID_COMMAND',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Timeout errors
  TIMEOUT: 'TIMEOUT',
  SESSION_TIMEOUT: 'SESSION_TIMEOUT',

  // Kernel errors
  KERNEL_ERROR: 'KERNEL_ERROR',
  KERNEL_NOT_AVAILABLE: 'KERNEL_NOT_AVAILABLE',
  KERNEL_UNREACHABLE: 'KERNEL_UNREACHABLE',
} as const;

/**
 * Error code type
 */
export type ConversationErrorCodeType = typeof ConversationErrorCode[keyof typeof ConversationErrorCode];