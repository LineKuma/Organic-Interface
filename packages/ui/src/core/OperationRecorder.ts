/**
 * OperationRecorder - Records UI operations into sessions
 *
 * Provides recording capabilities for UI operations, enabling
 * session management, filtering, statistics, and import/export.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import type { UIOperationType, UIOperationInput, UIOperationResult, UIOperationStatus } from './UIOperation.js';

/**
 * A single recorded operation within a session
 */
export interface RecordedOperation {
  /** Unique operation ID */
  id: string;

  /** Operation type */
  type: UIOperationType;

  /** Operation input */
  input: UIOperationInput;

  /** Operation result (if completed) */
  result?: UIOperationResult;

  /** Timestamp when recorded */
  timestamp: number;

  /** Duration in milliseconds */
  duration: number;

  /** Operation status */
  status: UIOperationStatus;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A recording session containing multiple operations
 */
export interface RecordingSession {
  /** Unique session ID */
  id: string;

  /** Session name */
  name: string;

  /** Recorded operations */
  operations: RecordedOperation[];

  /** Session start time */
  startTime: number;

  /** Session end time */
  endTime?: number;

  /** Session status */
  status: 'recording' | 'stopped' | 'playing';

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Filter criteria for recorded operations
 */
export interface RecordingFilter {
  /** Filter by operation types */
  types?: UIOperationType[];

  /** Filter by statuses */
  statuses?: UIOperationStatus[];

  /** Filter by start time (inclusive) */
  startTime?: number;

  /** Filter by end time (inclusive) */
  endTime?: number;

  /** Filter by minimum duration */
  minDuration?: number;

  /** Filter by maximum duration */
  maxDuration?: number;
}

/**
 * Statistics for a recording session
 */
export interface OperationStats {
  /** Total number of operations */
  total: number;

  /** Number of successful operations */
  success: number;

  /** Number of failed operations */
  failed: number;

  /** Number of cancelled operations */
  cancelled: number;

  /** Average duration in milliseconds */
  avgDuration: number;

  /** Total duration in milliseconds */
  totalDuration: number;

  /** Operation count by type */
  byType: Record<string, number>;
}

/**
 * Events emitted by OperationRecorder
 */
export interface OperationRecorderEvents {
  'recording:start': { session: RecordingSession; timestamp: number };
  'recording:stop': { session: RecordingSession; timestamp: number };
  'operation:recorded': { operation: RecordedOperation; sessionId: string; timestamp: number };
  'session:deleted': { sessionId: string; timestamp: number };
  'session:imported': { session: RecordingSession; timestamp: number };
}

/**
 * OperationRecorder - Records and manages UI operation sessions
 */
export class OperationRecorder extends EventEmitter {
  /** All recording sessions */
  private sessions: Map<string, RecordingSession> = new Map();

  /** Current active session */
  private currentSession: RecordingSession | null = null;

  /** Logger instance */
  private logger: Logger;

  /** Operation counter for ID generation */
  private operationCounter: number = 0;

  /**
   * Create a new OperationRecorder
   */
  constructor() {
    super();
    this.logger = createLogger({ prefix: 'operation-recorder' });
  }

  // ==================== Recording Lifecycle ====================

  /**
   * Start a new recording session
   */
  startRecording(name?: string): RecordingSession {
    if (this.currentSession) {
      this.logger.warn('Already recording. Stopping current session first.');
      this.stopRecording();
    }

    const session: RecordingSession = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: name ?? `Recording ${this.sessions.size + 1}`,
      operations: [],
      startTime: Date.now(),
      status: 'recording',
    };

    this.sessions.set(session.id, session);
    this.currentSession = session;

    this.logger.info(`Started recording session: ${session.id} (${session.name})`);

    this.emit('recording:start', { session, timestamp: Date.now() });

    return session;
  }

  /**
   * Stop the current recording session
   */
  stopRecording(): RecordingSession {
    if (!this.currentSession) {
      throw new Error('No active recording session');
    }

    const session = this.currentSession;
    session.endTime = Date.now();
    session.status = 'stopped';
    this.currentSession = null;

    this.logger.info(`Stopped recording session: ${session.id} (${session.operations.length} operations)`);

    this.emit('recording:stop', { session, timestamp: Date.now() });

    return session;
  }

  /**
   * Record a single operation in the current session
   */
  recordOperation(
    type: UIOperationType,
    input: UIOperationInput,
    result?: UIOperationResult
  ): RecordedOperation {
    const session = this.currentSession;
    const timestamp = Date.now();

    const operation: RecordedOperation = {
      id: `op_${++this.operationCounter}_${timestamp}`,
      type,
      input,
      result,
      timestamp,
      duration: result?.executionTime ?? 0,
      status: result?.status ?? 'pending',
      metadata: result?.metadata,
    };

    if (session) {
      session.operations.push(operation);
    }

    this.logger.debug(`Recorded operation: ${operation.id} (${type})`);

    this.emit('operation:recorded', {
      operation,
      sessionId: session?.id ?? '',
      timestamp,
    });

    return operation;
  }

  // ==================== State Queries ====================

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.currentSession !== null;
  }

  /**
   * Get the current session
   */
  getCurrentSession(): RecordingSession | null {
    return this.currentSession;
  }

  // ==================== Session Management ====================

  /**
   * Get a specific session by ID
   */
  getSession(id: string): RecordingSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * List all sessions
   */
  listSessions(): RecordingSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Delete a session by ID
   */
  deleteSession(id: string): boolean {
    if (this.currentSession?.id === id) {
      this.currentSession = null;
    }

    const result = this.sessions.delete(id);

    if (result) {
      this.logger.info(`Deleted session: ${id}`);
      this.emit('session:deleted', { sessionId: id, timestamp: Date.now() });
    }

    return result;
  }

  /**
   * Clear all sessions
   */
  clearSessions(): void {
    this.currentSession = null;
    this.sessions.clear();
    this.operationCounter = 0;
    this.logger.info('Cleared all sessions');
  }

  // ==================== Import / Export ====================

  /**
   * Export a session as JSON string
   */
  exportSession(id: string): string {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    return JSON.stringify(session, null, 2);
  }

  /**
   * Import a session from JSON string
   */
  importSession(json: string): RecordingSession {
    let parsed: RecordingSession;

    try {
      parsed = JSON.parse(json);
    } catch (error) {
      throw new Error(`Failed to parse session JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!parsed.id || !parsed.operations || !parsed.startTime) {
      throw new Error('Invalid session data: missing required fields');
    }

    // Ensure the session has a unique ID if it conflicts
    if (this.sessions.has(parsed.id)) {
      parsed.id = `${parsed.id}_imported_${Date.now()}`;
    }

    parsed.status = 'stopped';
    this.sessions.set(parsed.id, parsed);

    this.logger.info(`Imported session: ${parsed.id} (${parsed.operations.length} operations)`);

    this.emit('session:imported', { session: parsed, timestamp: Date.now() });

    return parsed;
  }

  // ==================== Filtering ====================

  /**
   * Filter operations in a session
   */
  filterOperations(sessionId: string, filter: RecordingFilter): RecordedOperation[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session.operations.filter(op => {
      if (filter.types && filter.types.length > 0 && !filter.types.includes(op.type)) {
        return false;
      }

      if (filter.statuses && filter.statuses.length > 0 && !filter.statuses.includes(op.status)) {
        return false;
      }

      if (filter.startTime !== undefined && op.timestamp < filter.startTime) {
        return false;
      }

      if (filter.endTime !== undefined && op.timestamp > filter.endTime) {
        return false;
      }

      if (filter.minDuration !== undefined && op.duration < filter.minDuration) {
        return false;
      }

      if (filter.maxDuration !== undefined && op.duration > filter.maxDuration) {
        return false;
      }

      return true;
    });
  }

  // ==================== Statistics ====================

  /**
   * Get statistics for a session
   */
  getOperationStats(sessionId: string): OperationStats {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const ops = session.operations;
    const total = ops.length;

    if (total === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        cancelled: 0,
        avgDuration: 0,
        totalDuration: 0,
        byType: {},
      };
    }

    const byType: Record<string, number> = {};
    let successCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;
    let totalDuration = 0;

    for (const op of ops) {
      byType[op.type] = (byType[op.type] ?? 0) + 1;

      switch (op.status) {
        case 'success':
          successCount++;
          break;
        case 'failed':
          failedCount++;
          break;
        case 'cancelled':
          cancelledCount++;
          break;
      }

      totalDuration += op.duration;
    }

    return {
      total,
      success: successCount,
      failed: failedCount,
      cancelled: cancelledCount,
      avgDuration: totalDuration / total,
      totalDuration,
      byType,
    };
  }
}