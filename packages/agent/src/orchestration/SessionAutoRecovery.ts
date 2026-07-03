/**
 * SessionAutoRecovery - Automatic session state recovery after crashes
 *
 * Provides checkpoint-based recovery for orchestration sessions,
 * integrating with StorageProvider for durable state.
 */

import { createLogger, type Logger } from '@organic/utils';

/**
 * Minimal interface for storage operations needed by SessionAutoRecovery.
 * This avoids a direct dependency on @organic/storage while allowing
 * integration with any storage provider that implements this contract.
 */
interface StorageProvider {
  save(entity: unknown): Promise<unknown>;
  load(id: string): Promise<unknown>;
  list(): Promise<Array<{ id: string; tags: string[]; data: Record<string, unknown> }>>;
  delete(id: string): Promise<void>;
  update(id: string, entity: unknown): Promise<unknown>;
}

/**
 * Recovery state representing a session checkpoint
 */
export interface RecoveryState {
  /** Session identifier */
  sessionId: string;
  /** Sequence number of this checkpoint */
  lastCheckpoint: number;
  /** IDs of pending tasks */
  pendingTasks: string[];
  /** IDs of completed tasks */
  completedTasks: string[];
  /** IDs of failed tasks */
  failedTasks: string[];
  /** Arbitrary session state data */
  state: Record<string, unknown>;
}

/**
 * Recovery result after attempting recovery
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Number of tasks recovered */
  recoveredTasks: number;
  /** Number of failed tasks */
  failedTasks: number;
  /** Number of tasks lost (not recoverable) */
  lostTasks: number;
  /** Time spent on recovery in milliseconds */
  recoveryTime: number;
}

/**
 * SessionAutoRecovery - Automatic recovery for crashed sessions
 *
 * Manages periodic checkpoints, recovery from last known good state,
 * and cleanup of old checkpoints. Integrates with StorageProvider
 * for durable persistence.
 */
export class SessionAutoRecovery {
  private logger: Logger;
  private storage: StorageProvider | null = null;
  private checkpointPrefix: string = 'recovery_checkpoint_';

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ prefix: 'session-auto-recovery' });
  }

  /**
   * Set the session persistence storage backend
   */
  setStorage(storage: StorageProvider): void {
    this.storage = storage;
    this.logger.debug('Session persistence storage set');
  }

  /**
   * Save a recovery checkpoint for a session
   */
  async saveCheckpoint(sessionId: string, state: RecoveryState): Promise<void> {
    this.ensureStorage();

    const checkpointId = this.buildCheckpointId(sessionId, state.lastCheckpoint);

    try {
      await this.storage!.save({
        id: checkpointId,
        tags: ['recovery', 'checkpoint', sessionId],
        data: {
          sessionId: state.sessionId,
          lastCheckpoint: state.lastCheckpoint,
          pendingTasks: state.pendingTasks,
          completedTasks: state.completedTasks,
          failedTasks: state.failedTasks,
          state: state.state,
          savedAt: Date.now(),
        },
      });

      this.logger.debug(`Checkpoint saved: ${checkpointId} (seq: ${state.lastCheckpoint})`);
    } catch (error) {
      this.logger.error(
        `Failed to save checkpoint: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Load the latest checkpoint for a session
   */
  async loadCheckpoint(sessionId: string): Promise<RecoveryState | null> {
    this.ensureStorage();

    try {
      const checkpoints = await this.listCheckpoints(sessionId);

      if (checkpoints.length === 0) {
        this.logger.debug(`No checkpoints found for session: ${sessionId}`);
        return null;
      }

      // Return the latest checkpoint (highest sequence number)
      const latest = checkpoints.reduce((latest, cp) =>
        cp.lastCheckpoint > latest.lastCheckpoint ? cp : latest
      );

      this.logger.debug(
        `Loaded checkpoint for session ${sessionId}: seq ${latest.lastCheckpoint}`
      );
      return latest;
    } catch (error) {
      this.logger.error(
        `Failed to load checkpoint: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Attempt to recover a session from the latest checkpoint
   */
  async recover(sessionId: string): Promise<RecoveryResult> {
    const startTime = Date.now();

    this.logger.info(`Attempting recovery for session: ${sessionId}`);

    const checkpoint = await this.loadCheckpoint(sessionId);

    if (!checkpoint) {
      this.logger.warn(`No checkpoint available for recovery: ${sessionId}`);
      return {
        success: false,
        recoveredTasks: 0,
        failedTasks: 0,
        lostTasks: 0,
        recoveryTime: Date.now() - startTime,
      };
    }

    const recoveredTasks = checkpoint.completedTasks.length;
    const failedTasks = checkpoint.failedTasks.length;
    const lostTasks = checkpoint.pendingTasks.length;

    this.logger.info(
      `Recovery complete: ${recoveredTasks} recovered, ${failedTasks} failed, ${lostTasks} lost`
    );

    return {
      success: true,
      recoveredTasks,
      failedTasks,
      lostTasks,
      recoveryTime: Date.now() - startTime,
    };
  }

  /**
   * List all checkpoints for a session
   */
  async listCheckpoints(sessionId: string): Promise<RecoveryState[]> {
    this.ensureStorage();

    try {
      const sessions = await this.storage!.list();

      const checkpoints = sessions
        .filter((s) => s.tags.includes('recovery') && s.tags.includes(sessionId))
        .map((s) => this.sessionToRecoveryState(s))
        .filter((r): r is RecoveryState => r !== null);

      return checkpoints;
    } catch (error) {
      this.logger.error(
        `Failed to list checkpoints: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Clean up old checkpoints, keeping only the most recent ones
   */
  async cleanup(sessionId: string, keepLast: number = 5): Promise<void> {
    this.ensureStorage();

    try {
      const checkpoints = await this.listCheckpoints(sessionId);

      if (checkpoints.length <= keepLast) {
        this.logger.debug(
          `No cleanup needed: ${checkpoints.length} checkpoints, keep ${keepLast}`
        );
        return;
      }

      // Sort by checkpoint sequence number descending
      checkpoints.sort((a, b) => b.lastCheckpoint - a.lastCheckpoint);

      // Delete old checkpoints
      const toDelete = checkpoints.slice(keepLast);
      for (const cp of toDelete) {
        const checkpointId = this.buildCheckpointId(sessionId, cp.lastCheckpoint);
        try {
          await this.storage!.delete(checkpointId);
          this.logger.debug(`Deleted old checkpoint: ${checkpointId}`);
        } catch (error) {
          this.logger.warn(
            `Failed to delete checkpoint ${checkpointId}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      this.logger.info(
        `Cleaned up ${toDelete.length} old checkpoints for session ${sessionId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to clean up checkpoints: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if recovery is needed for a session
   * Recovery is needed if:
   * - A checkpoint exists with pending tasks
   * - A checkpoint exists with failed tasks
   */
  async shouldRecover(sessionId: string): Promise<boolean> {
    const checkpoint = await this.loadCheckpoint(sessionId);

    if (!checkpoint) {
      return false;
    }

    // Recovery is needed if there are pending or failed tasks
    const hasPendingWork =
      checkpoint.pendingTasks.length > 0 || checkpoint.failedTasks.length > 0;

    if (hasPendingWork) {
      this.logger.debug(`Recovery needed for session ${sessionId}`);
    }

    return hasPendingWork;
  }

  /**
   * Get the latest checkpoint sequence number
   */
  async getLatestCheckpointNumber(sessionId: string): Promise<number> {
    const checkpoint = await this.loadCheckpoint(sessionId);
    return checkpoint?.lastCheckpoint ?? 0;
  }

  /**
   * Delete all checkpoints for a session
   */
  async deleteAllCheckpoints(sessionId: string): Promise<void> {
    this.ensureStorage();

    try {
      const checkpoints = await this.listCheckpoints(sessionId);

      for (const cp of checkpoints) {
        const checkpointId = this.buildCheckpointId(sessionId, cp.lastCheckpoint);
        try {
          await this.storage!.delete(checkpointId);
        } catch {
          // Ignore individual delete errors
        }
      }

      this.logger.info(`Deleted all ${checkpoints.length} checkpoints for session ${sessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete all checkpoints: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Build a checkpoint ID from session and sequence number
   */
  private buildCheckpointId(sessionId: string, checkpoint: number): string {
    return `${this.checkpointPrefix}${sessionId}_${checkpoint}`;
  }

  /**
   * Convert a session persistence object to a recovery state
   */
  private sessionToRecoveryState(session: { id: string; tags: string[]; data: Record<string, unknown> }): RecoveryState | null {
    try {
      const metadata = (session.data as Record<string, unknown>) ?? {};
      return {
        sessionId: (metadata.sessionId as string) ?? session.id,
        lastCheckpoint: (metadata.lastCheckpoint as number) ?? 0,
        pendingTasks: (metadata.pendingTasks as string[]) ?? [],
        completedTasks: (metadata.completedTasks as string[]) ?? [],
        failedTasks: (metadata.failedTasks as string[]) ?? [],
        state: (metadata.state as Record<string, unknown>) ?? {},
      };
    } catch {
      return null;
    }
  }

  /**
   * Ensure storage is set
   */
  private ensureStorage(): void {
    if (!this.storage) {
      throw new Error(
        'StorageProvider not set. Call setStorage() before using recovery features.'
      );
    }
  }
}