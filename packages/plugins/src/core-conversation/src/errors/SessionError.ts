/**
 * Session-related errors for conversation plugin
 */

import { ConversationError, ConversationErrorCode } from './ConversationError.js';

/**
 * SessionError - Error class for session-related errors
 */
export class SessionError extends ConversationError {
  /** Associated session ID */
  readonly sessionId?: string;

  /**
   * Create a new SessionError
   * @param message - Error message
   * @param sessionId - Associated session ID
   * @param details - Additional error details
   */
  constructor(
    message: string,
    sessionId?: string,
    details?: unknown
  ) {
    super(message, ConversationErrorCode.SESSION_NOT_FOUND, details);
    this.name = 'SessionError';
    this.sessionId = sessionId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionError);
    }
  }

  /**
   * Create session not found error
   */
  static notFound(sessionId: string): SessionError {
    return new SessionError(
      `Session not found: ${sessionId}`,
      sessionId,
      { reason: 'Session does not exist' }
    );
  }

  /**
   * Create session already exists error
   */
  static alreadyExists(sessionId: string): SessionError {
    return new SessionError(
      `Session already exists: ${sessionId}`,
      sessionId,
      { reason: 'Session with same ID already exists' }
    );
  }

  /**
   * Create session closed error
   */
  static closed(sessionId: string): SessionError {
    return new SessionError(
      `Session is closed: ${sessionId}`,
      sessionId,
      { reason: 'Session has been closed' }
    );
  }

  /**
   * Create session expired error
   */
  static expired(sessionId: string, ttl?: number): SessionError {
    return new SessionError(
      `Session expired: ${sessionId}`,
      sessionId,
      { reason: 'Session TTL exceeded', ttl }
    );
  }

  /**
   * Create maximum sessions error
   */
  static maxReached(max: number): SessionError {
    return new SessionError(
      `Maximum number of sessions reached: ${max}`,
      undefined,
      { max, reason: 'Session limit exceeded' }
    );
  }

  /**
   * Convert to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      sessionId: this.sessionId,
    };
  }
}