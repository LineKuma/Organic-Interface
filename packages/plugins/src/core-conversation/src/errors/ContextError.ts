/**
 * Context-related errors for conversation plugin
 */

import { ConversationError, ConversationErrorCode } from './ConversationError.js';

/**
 * ContextError - Error class for context-related errors
 */
export class ContextError extends ConversationError {
  /** Associated session ID */
  readonly sessionId?: string;

  /** Context window ID if available */
  readonly contextId?: string;

  /**
   * Create a new ContextError
   * @param message - Error message
   * @param sessionId - Associated session ID
   * @param contextId - Context window ID
   * @param details - Additional error details
   */
  constructor(
    message: string,
    sessionId?: string,
    contextId?: string,
    details?: unknown
  ) {
    super(message, ConversationErrorCode.CONTEXT_NOT_FOUND, details);
    this.name = 'ContextError';
    this.sessionId = sessionId;
    this.contextId = contextId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextError);
    }
  }

  /**
   * Create context not found error
   */
  static notFound(sessionId: string, contextId?: string): ContextError {
    return new ContextError(
      contextId
        ? `Context not found: ${contextId} in session ${sessionId}`
        : `Context not found for session: ${sessionId}`,
      sessionId,
      contextId,
      { reason: 'Context does not exist' }
    );
  }

  /**
   * Create context expired error
   */
  static expired(sessionId: string, reason?: string): ContextError {
    return new ContextError(
      `Context expired for session: ${sessionId}`,
      sessionId,
      undefined,
      { reason: reason || 'Context window expired' }
    );
  }

  /**
   * Create context full error
   */
  static full(sessionId: string, maxSize: number): ContextError {
    return new ContextError(
      `Context full for session: ${sessionId}`,
      sessionId,
      undefined,
      { reason: 'Context window is full', maxSize }
    );
  }

  /**
   * Create context invalid error
   */
  static invalid(sessionId: string, reason: string): ContextError {
    return new ContextError(
      `Invalid context for session: ${sessionId}`,
      sessionId,
      undefined,
      { reason }
    );
  }

  /**
   * Create message not found error
   */
  static messageNotFound(sessionId: string, messageId: string): ContextError {
    return new ContextError(
      `Message not found: ${messageId} in session ${sessionId}`,
      sessionId,
      undefined,
      { messageId, reason: 'Message does not exist' }
    );
  }

  /**
   * Convert to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      sessionId: this.sessionId,
      contextId: this.contextId,
    };
  }
}