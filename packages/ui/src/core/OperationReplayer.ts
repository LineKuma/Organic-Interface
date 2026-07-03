/**
 * OperationReplayer - Replays recorded UI operations
 *
 * Provides controlled replay of recorded operations with configurable
 * speed, pausing, stopping, and progress tracking.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import type { RecordedOperation, RecordingFilter } from './OperationRecorder.js';
import type { OperationRecorder } from './OperationRecorder.js';

/**
 * Replay options
 */
export interface ReplayOptions {
  /** Playback speed multiplier (0.1-10x, default: 1) */
  speed?: number;

  /** Stop replay on first error */
  stopOnError?: boolean;

  /** Delay between operations in milliseconds (overrides speed-based timing) */
  delay?: number;

  /** Filter to apply to operations */
  filter?: RecordingFilter;
}

/**
 * Replay progress information
 */
export interface ReplayProgress {
  /** Current operation index */
  current: number;

  /** Total operations to replay */
  total: number;

  /** Completion percentage (0-100) */
  percent: number;

  /** Current operation being replayed */
  currentOperation: RecordedOperation;

  /** Elapsed time in milliseconds */
  elapsed: number;

  /** Estimated remaining time in milliseconds */
  estimated: number;
}

/**
 * Result of a replay operation
 */
export interface ReplayResult {
  /** Session ID */
  sessionId: string;

  /** Total operations attempted */
  totalOperations: number;

  /** Number of successful replays */
  successCount: number;

  /** Number of failed replays */
  failCount: number;

  /** Number of skipped operations */
  skipCount: number;

  /** Total duration in milliseconds */
  duration: number;

  /** Errors encountered during replay */
  errors: ReplayError[];
}

/**
 * Error during replay
 */
export interface ReplayError {
  /** The operation that caused the error */
  operation: RecordedOperation;

  /** Error message */
  error: string;

  /** Timestamp of the error */
  timestamp: number;
}

/**
 * Replay events
 */
export interface ReplayEvents {
  'operation:start': { operation: RecordedOperation; index: number; total: number };
  'operation:end': { operation: RecordedOperation; index: number; total: number };
  'operation:error': { operation: RecordedOperation; error: string; index: number };
  'replay:start': { totalOperations: number; timestamp: number };
  'replay:end': { result: ReplayResult; timestamp: number };
  'replay:pause': { progress: ReplayProgress; timestamp: number };
  'replay:resume': { progress: ReplayProgress; timestamp: number };
  'replay:progress': { progress: ReplayProgress };
}

/**
 * Internal replay state
 */
type ReplayState = 'idle' | 'playing' | 'paused' | 'stopped';

/**
 * OperationReplayer - Replays recorded UI operations
 */
export class OperationReplayer extends EventEmitter {
  /** Reference to the recorder for session access */
  private recorder: OperationRecorder;

  /** Logger instance */
  private logger: Logger;

  /** Current replay state */
  private state: ReplayState = 'idle';

  /** Current progress */
  private progress: ReplayProgress | null = null;

  /** Replay start time */
  private startTime: number = 0;

  /** Elapsed time before pause */
  private elapsedBeforePause: number = 0;

  /** Pause timestamp */
  private pauseTime: number = 0;

  /** Abort controller for stopping replay */
  private abortController: AbortController | null = null;

  /** Resolve function for pause */
  private pauseResolve: (() => void) | null = null;

  /** Current operation index */
  private currentIndex: number = 0;

  /** Total operations in current replay */
  private totalOps: number = 0;

  /** Current operation */
  private currentOp: RecordedOperation | null = null;

  /**
   * Create a new OperationReplayer
   */
  constructor(recorder: OperationRecorder) {
    super();
    this.recorder = recorder;
    this.logger = createLogger({ prefix: 'operation-replayer' });
  }

  // ==================== Replay ====================

  /**
   * Replay a session by ID
   */
  async replay(sessionId: string, options?: ReplayOptions): Promise<ReplayResult> {
    const session = this.recorder.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return this.replayOperations(session.operations, { ...options });
  }

  /**
   * Replay a specific list of operations
   */
  async replayOperations(
    operations: RecordedOperation[],
    options?: ReplayOptions
  ): Promise<ReplayResult> {
    if (this.state === 'playing') {
      throw new Error('Already replaying. Stop the current replay first.');
    }

    const speed = this.clampSpeed(options?.speed ?? 1);
    const stopOnError = options?.stopOnError ?? false;
    const delay = options?.delay;
    const filter = options?.filter;

    // Apply filter if provided
    let ops = operations;
    if (filter) {
      ops = this.applyFilter(ops, filter);
    }

    this.totalOps = ops.length;
    this.currentIndex = 0;
    this.state = 'playing';
    this.startTime = Date.now();
    this.elapsedBeforePause = 0;
    this.abortController = new AbortController();

    const errors: ReplayError[] = [];
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    this.logger.info(`Starting replay: ${ops.length} operations, speed: ${speed}x`);

    this.emit('replay:start', {
      totalOperations: ops.length,
      timestamp: Date.now(),
    });

    for (let i = 0; i < ops.length; i++) {
      // Check for abort
      if (this.abortController.signal.aborted) {
        this.logger.info('Replay aborted');
        break;
      }

      // Handle pause (state may be changed externally by pause() call)
      const currentState = this.state as ReplayState;
      if (currentState === 'paused') {
        await this.waitForResume();
      }

      if (currentState === 'stopped') {
        break;
      }

      const op = ops[i];
      this.currentIndex = i;
      this.currentOp = op;

      this.updateProgress();

      this.emit('operation:start', {
        operation: op,
        index: i,
        total: ops.length,
      });

      this.emit('replay:progress', { progress: this.progress! });

      try {
        // Simulate the operation execution time, adjusted by speed
        const operationDelay = delay ?? op.duration / speed;
        await this.delay(operationDelay, this.abortController.signal);

        this.emit('operation:end', {
          operation: op,
          index: i,
          total: ops.length,
        });

        // Check result status
        if (op.status === 'failed') {
          failCount++;
          const replayError: ReplayError = {
            operation: op,
            error: op.result?.error ?? 'Operation failed during recording',
            timestamp: Date.now(),
          };
          errors.push(replayError);

          this.emit('operation:error', {
            operation: op,
            error: replayError.error,
            index: i,
          });

          if (stopOnError) {
            this.logger.warn(`Stopping replay on error at operation ${i}`);
            break;
          }
        } else if (op.status === 'cancelled') {
          skipCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          break;
        }

        failCount++;
        const replayError: ReplayError = {
          operation: op,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        };
        errors.push(replayError);

        this.emit('operation:error', {
          operation: op,
          error: replayError.error,
          index: i,
        });

        if (stopOnError) {
          this.logger.warn(`Stopping replay on error at operation ${i}`);
          break;
        }
      }
    }

    const duration = Date.now() - this.startTime;

    const result: ReplayResult = {
      sessionId: '',
      totalOperations: ops.length,
      successCount,
      failCount,
      skipCount,
      duration,
      errors,
    };

    this.state = 'idle';
    this.progress = null;
    this.currentOp = null;
    this.abortController = null;

    this.logger.info(
      `Replay completed: ${successCount} success, ${failCount} failed, ${skipCount} skipped`
    );

    this.emit('replay:end', { result, timestamp: Date.now() });

    return result;
  }

  // ==================== Playback Control ====================

  /**
   * Pause the current replay
   */
  pause(): void {
    if (this.state !== 'playing') {
      this.logger.warn('Cannot pause: not currently playing');
      return;
    }

    this.state = 'paused';
    this.pauseTime = Date.now();

    this.logger.info('Replay paused');

    this.emit('replay:pause', {
      progress: this.progress!,
      timestamp: Date.now(),
    });
  }

  /**
   * Resume the paused replay
   */
  resume(): void {
    if (this.state !== 'paused') {
      this.logger.warn('Cannot resume: not currently paused');
      return;
    }

    this.elapsedBeforePause += Date.now() - this.pauseTime;
    this.state = 'playing';

    this.logger.info('Replay resumed');

    this.emit('replay:resume', {
      progress: this.progress!,
      timestamp: Date.now(),
    });

    // Signal the waiting loop to continue
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pauseResolve = null;
    }
  }

  /**
   * Stop the current replay
   */
  stop(): void {
    if (this.state !== 'playing' && this.state !== 'paused') {
      this.logger.warn('Cannot stop: not currently playing or paused');
      return;
    }

    this.state = 'stopped';

    // Resume if paused so the loop can exit
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pauseResolve = null;
    }

    // Abort any ongoing delay
    if (this.abortController) {
      this.abortController.abort();
    }

    this.logger.info('Replay stopped');
  }

  // ==================== State Queries ====================

  /**
   * Get current replay progress
   */
  getProgress(): ReplayProgress {
    if (!this.progress) {
      return {
        current: 0,
        total: 0,
        percent: 0,
        currentOperation: null as unknown as RecordedOperation,
        elapsed: 0,
        estimated: 0,
      };
    }

    return { ...this.progress };
  }

  /**
   * Check if currently replaying
   */
  isPlaying(): boolean {
    return this.state === 'playing';
  }

  // ==================== Private Methods ====================

  /**
   * Update the current progress
   */
  private updateProgress(): void {
    const elapsed =
      this.state === 'playing'
        ? Date.now() - this.startTime - this.elapsedBeforePause
        : this.elapsedBeforePause;

    const percent = this.totalOps > 0 ? Math.round((this.currentIndex / this.totalOps) * 100) : 0;

    const avgTimePerOp = this.currentIndex > 0 ? elapsed / this.currentIndex : 0;
    const remaining = this.totalOps - this.currentIndex;
    const estimated = avgTimePerOp * remaining;

    this.progress = {
      current: this.currentIndex,
      total: this.totalOps,
      percent,
      currentOperation: this.currentOp!,
      elapsed,
      estimated,
    };
  }

  /**
   * Wait for resume from pause
   */
  private waitForResume(): Promise<void> {
    return new Promise(resolve => {
      this.pauseResolve = resolve;
    });
  }

  /**
   * Apply filter to operations list
   */
  private applyFilter(
    operations: RecordedOperation[],
    filter: RecordingFilter
  ): RecordedOperation[] {
    return operations.filter(op => {
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

  /**
   * Clamp speed to valid range
   */
  private clampSpeed(speed: number): number {
    return Math.max(0.1, Math.min(10, speed));
  }

  /**
   * Delay helper with abort support
   */
  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const timeout = setTimeout(resolve, ms);

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true }
        );
      }
    });
  }
}
