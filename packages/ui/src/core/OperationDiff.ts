/**
 * OperationDiff - Compares recording sessions and operations
 *
 * Provides diffing capabilities to compare two recording sessions
 * or operation lists, identifying added, removed, modified, and
 * unchanged operations.
 */

import { createLogger, type Logger } from '@organic/utils';
import type { RecordedOperation, RecordingSession } from './OperationRecorder.js';

/**
 * Result of comparing two sessions or operation lists
 */
export interface OperationDiffResult {
  /** Operations present in the second but not in the first */
  added: RecordedOperation[];

  /** Operations present in the first but not in the second */
  removed: RecordedOperation[];

  /** Operations that exist in both but have changed */
  modified: { before: RecordedOperation; after: RecordedOperation }[];

  /** Operations that are identical in both */
  unchanged: RecordedOperation[];
}

/**
 * Similarity match result
 */
export interface SimilarityMatch {
  /** The matched operation */
  operation: RecordedOperation;

  /** Similarity score (0-1) */
  score: number;
}

/**
 * OperationDiff - Compares recording sessions and operations
 */
export class OperationDiff {
  /** Logger instance */
  private logger: Logger;

  /**
   * Create a new OperationDiff instance
   */
  constructor() {
    this.logger = createLogger({ prefix: 'operation-diff' });
  }

  // ==================== Session Diffing ====================

  /**
   * Compare two recording sessions
   */
  diff(session1: RecordingSession, session2: RecordingSession): OperationDiffResult {
    this.logger.info(`Comparing sessions: ${session1.id} vs ${session2.id}`);
    return this.diffOperations(session1.operations, session2.operations);
  }

  /**
   * Compare two lists of operations
   */
  diffOperations(ops1: RecordedOperation[], ops2: RecordedOperation[]): OperationDiffResult {
    const result: OperationDiffResult = {
      added: [],
      removed: [],
      modified: [],
      unchanged: [],
    };

    // Build lookup maps by ID
    const map1 = new Map<string, RecordedOperation>();
    const map2 = new Map<string, RecordedOperation>();

    for (const op of ops1) {
      map1.set(op.id, op);
    }

    for (const op of ops2) {
      map2.set(op.id, op);
    }

    // Find added operations (in ops2 but not in ops1)
    for (const [id, op] of map2) {
      if (!map1.has(id)) {
        result.added.push(op);
      }
    }

    // Find removed operations (in ops1 but not in ops2)
    for (const [id, op] of map1) {
      if (!map2.has(id)) {
        result.removed.push(op);
      }
    }

    // Find modified and unchanged operations
    for (const [id, op1] of map1) {
      const op2 = map2.get(id);
      if (op2) {
        if (this.hasChanged(op1, op2)) {
          result.modified.push({ before: op1, after: op2 });
        } else {
          result.unchanged.push(op1);
        }
      }
    }

    this.logger.info(
      `Diff result: ${result.added.length} added, ${result.removed.length} removed, ` +
        `${result.modified.length} modified, ${result.unchanged.length} unchanged`
    );

    return result;
  }

  // ==================== Similarity Search ====================

  /**
   * Find operations in a session similar to a given operation
   */
  findSimilar(
    operation: RecordedOperation,
    session: RecordingSession,
    threshold = 0.5
  ): RecordedOperation[] {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }

    const matches: SimilarityMatch[] = [];

    for (const op of session.operations) {
      // Skip the exact same operation
      if (op.id === operation.id) {
        continue;
      }

      const score = this.calculateSimilarity(operation, op);
      if (score >= threshold) {
        matches.push({ operation: op, score });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    return matches.map(m => m.operation);
  }

  // ==================== Private Methods ====================

  /**
   * Check if an operation has changed between two versions
   */
  private hasChanged(op1: RecordedOperation, op2: RecordedOperation): boolean {
    // Check type
    if (op1.type !== op2.type) {
      return true;
    }

    // Check status
    if (op1.status !== op2.status) {
      return true;
    }

    // Check selector
    if (op1.input.selector !== op2.input.selector) {
      return true;
    }

    // Check input options (shallow compare)
    if (JSON.stringify(op1.input.options) !== JSON.stringify(op2.input.options)) {
      return true;
    }

    // Check duration (significant change: > 10% difference)
    if (op1.duration > 0 && op2.duration > 0) {
      const diff = Math.abs(op1.duration - op2.duration);
      const maxDuration = Math.max(op1.duration, op2.duration);
      if (maxDuration > 0 && diff / maxDuration > 0.1) {
        return true;
      }
    } else if (op1.duration !== op2.duration) {
      return true;
    }

    // Check metadata
    if (JSON.stringify(op1.metadata) !== JSON.stringify(op2.metadata)) {
      return true;
    }

    return false;
  }

  /**
   * Calculate similarity score between two operations (0-1)
   */
  private calculateSimilarity(op1: RecordedOperation, op2: RecordedOperation): number {
    let score = 0;
    let weight = 0;

    // Type match (weight: 0.3)
    weight += 0.3;
    if (op1.type === op2.type) {
      score += 0.3;
    }

    // Selector similarity (weight: 0.3)
    weight += 0.3;
    const selectorSim = this.stringSimilarity(op1.input.selector, op2.input.selector);
    score += selectorSim * 0.3;

    // Status match (weight: 0.2)
    weight += 0.2;
    if (op1.status === op2.status) {
      score += 0.2;
    }

    // Duration similarity (weight: 0.2)
    weight += 0.2;
    if (op1.duration > 0 && op2.duration > 0) {
      const ratio = Math.min(op1.duration, op2.duration) / Math.max(op1.duration, op2.duration);
      score += ratio * 0.2;
    } else if (op1.duration === op2.duration) {
      score += 0.2;
    }

    return score / weight;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const distance = this.levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);

    return 1 - distance / maxLen;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[a.length][b.length];
  }
}
