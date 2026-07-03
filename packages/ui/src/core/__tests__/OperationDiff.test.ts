import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OperationDiff } from '../OperationDiff.js';
import { OperationRecorder } from '../OperationRecorder.js';
import type { RecordedOperation, RecordingSession } from '../OperationRecorder.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function createMockInput(selector: string = '#test', options?: Record<string, unknown>) {
  return { selector, options };
}

function createMockResult(overrides: Record<string, unknown> = {}) {
  return {
    operationId: 'op-1',
    type: 'click' as const,
    success: true,
    executionTime: (overrides.executionTime as number) ?? 100,
    status: (overrides.status as 'success' | 'failed') ?? 'success',
    timestamp: Date.now(),
    ...overrides,
  };
}

function createMockOp(overrides: Partial<RecordedOperation> = {}): RecordedOperation {
  return {
    id: overrides.id ?? `op_${Date.now()}`,
    type: overrides.type ?? 'click',
    input: overrides.input ?? createMockInput('#btn'),
    result: overrides.result ?? createMockResult(),
    timestamp: overrides.timestamp ?? Date.now(),
    duration: overrides.duration ?? 100,
    status: overrides.status ?? 'success',
    metadata: overrides.metadata,
  };
}

function createMockSession(overrides: Partial<RecordingSession> = {}): RecordingSession {
  return {
    id: overrides.id ?? `session_${Date.now()}`,
    name: overrides.name ?? 'Test Session',
    operations: overrides.operations ?? [],
    startTime: overrides.startTime ?? Date.now(),
    endTime: overrides.endTime,
    status: overrides.status ?? 'stopped',
    metadata: overrides.metadata,
  };
}

describe('OperationDiff', () => {
  let diff: OperationDiff;
  let recorder: OperationRecorder;

  beforeEach(() => {
    diff = new OperationDiff();
    recorder = new OperationRecorder();
  });

  // ==================== Construction ====================

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(diff).toBeDefined();
    });
  });

  // ==================== diff ====================

  describe('diff', () => {
    it('should compare two sessions', () => {
      const session1 = createMockSession({
        id: 's1',
        operations: [
          createMockOp({ id: 'op1', type: 'click' }),
          createMockOp({ id: 'op2', type: 'input' }),
        ],
      });

      const session2 = createMockSession({
        id: 's2',
        operations: [
          createMockOp({ id: 'op1', type: 'click' }),
          createMockOp({ id: 'op3', type: 'scroll' }),
        ],
      });

      const result = diff.diff(session1, session2);
      expect(result.unchanged).toHaveLength(1);
      expect(result.unchanged[0].id).toBe('op1');
      expect(result.added).toHaveLength(1);
      expect(result.added[0].id).toBe('op3');
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0].id).toBe('op2');
      expect(result.modified).toHaveLength(0);
    });

    it('should detect modified operations', () => {
      const session1 = createMockSession({
        operations: [
          createMockOp({ id: 'op1', type: 'click', status: 'success' }),
        ],
      });

      const session2 = createMockSession({
        operations: [
          createMockOp({ id: 'op1', type: 'click', status: 'failed' }),
        ],
      });

      const result = diff.diff(session1, session2);
      expect(result.modified).toHaveLength(1);
      expect(result.modified[0].before.status).toBe('success');
      expect(result.modified[0].after.status).toBe('failed');
      expect(result.unchanged).toHaveLength(0);
    });

    it('should detect type changes as modified', () => {
      const session1 = createMockSession({
        operations: [
          createMockOp({ id: 'op1', type: 'click' }),
        ],
      });

      const session2 = createMockSession({
        operations: [
          createMockOp({ id: 'op1', type: 'input' }),
        ],
      });

      const result = diff.diff(session1, session2);
      expect(result.modified).toHaveLength(1);
    });

    it('should detect selector changes as modified', () => {
      const session1 = createMockSession({
        operations: [
          createMockOp({ id: 'op1', input: createMockInput('#old') }),
        ],
      });

      const session2 = createMockSession({
        operations: [
          createMockOp({ id: 'op1', input: createMockInput('#new') }),
        ],
      });

      const result = diff.diff(session1, session2);
      expect(result.modified).toHaveLength(1);
    });

    it('should handle empty sessions', () => {
      const session1 = createMockSession({ operations: [] });
      const session2 = createMockSession({ operations: [] });

      const result = diff.diff(session1, session2);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    it('should handle all added operations', () => {
      const session1 = createMockSession({ operations: [] });
      const session2 = createMockSession({
        operations: [
          createMockOp({ id: 'op1' }),
          createMockOp({ id: 'op2' }),
        ],
      });

      const result = diff.diff(session1, session2);
      expect(result.added).toHaveLength(2);
      expect(result.removed).toHaveLength(0);
    });

    it('should handle all removed operations', () => {
      const session1 = createMockSession({
        operations: [
          createMockOp({ id: 'op1' }),
          createMockOp({ id: 'op2' }),
        ],
      });
      const session2 = createMockSession({ operations: [] });

      const result = diff.diff(session1, session2);
      expect(result.removed).toHaveLength(2);
      expect(result.added).toHaveLength(0);
    });
  });

  // ==================== diffOperations ====================

  describe('diffOperations', () => {
    it('should compare two operation lists', () => {
      const ops1: RecordedOperation[] = [
        createMockOp({ id: 'op1', type: 'click' }),
        createMockOp({ id: 'op2', type: 'input' }),
      ];

      const ops2: RecordedOperation[] = [
        createMockOp({ id: 'op1', type: 'click' }),
        createMockOp({ id: 'op3', type: 'scroll' }),
      ];

      const result = diff.diffOperations(ops1, ops2);
      expect(result.unchanged).toHaveLength(1);
      expect(result.added).toHaveLength(1);
      expect(result.removed).toHaveLength(1);
    });

    it('should handle identical lists', () => {
      const ops: RecordedOperation[] = [
        createMockOp({ id: 'op1', type: 'click' }),
        createMockOp({ id: 'op2', type: 'input' }),
      ];

      const result = diff.diffOperations(ops, [...ops]);
      expect(result.unchanged).toHaveLength(2);
      expect(result.modified).toHaveLength(0);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it('should detect input options changes', () => {
      const ops1: RecordedOperation[] = [
        createMockOp({ id: 'op1', input: createMockInput('#btn', { timeout: 1000 }) }),
      ];

      const ops2: RecordedOperation[] = [
        createMockOp({ id: 'op1', input: createMockInput('#btn', { timeout: 5000 }) }),
      ];

      const result = diff.diffOperations(ops1, ops2);
      expect(result.modified).toHaveLength(1);
    });

    it('should detect metadata changes', () => {
      const ops1: RecordedOperation[] = [
        createMockOp({ id: 'op1', metadata: { key: 'value1' } }),
      ];

      const ops2: RecordedOperation[] = [
        createMockOp({ id: 'op1', metadata: { key: 'value2' } }),
      ];

      const result = diff.diffOperations(ops1, ops2);
      expect(result.modified).toHaveLength(1);
    });

    it('should detect significant duration changes', () => {
      const ops1: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 100 }),
      ];

      const ops2: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 200 }),
      ];

      const result = diff.diffOperations(ops1, ops2);
      // 100 vs 200: diff = 100, max = 200, ratio = 0.5 > 0.1 => modified
      expect(result.modified).toHaveLength(1);
    });

    it('should not detect small duration changes as modified', () => {
      const ops1: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 100 }),
      ];

      const ops2: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 105 }),
      ];

      const result = diff.diffOperations(ops1, ops2);
      // 100 vs 105: diff = 5, max = 105, ratio = 0.047 < 0.1 => unchanged
      expect(result.unchanged).toHaveLength(1);
      expect(result.modified).toHaveLength(0);
    });
  });

  // ==================== findSimilar ====================

  describe('findSimilar', () => {
    it('should find similar operations by type', () => {
      const target = createMockOp({ id: 'target', type: 'click', input: createMockInput('#submit-btn') });

      const session = createMockSession({
        operations: [
          createMockOp({ id: 'op1', type: 'click', input: createMockInput('#submit-button') }),
          createMockOp({ id: 'op2', type: 'input', input: createMockInput('#name-field') }),
          createMockOp({ id: 'op3', type: 'scroll', input: createMockInput('#page') }),
        ],
      });

      const results = diff.findSimilar(target, session);
      expect(results.length).toBeGreaterThan(0);
      // The click operation should be most similar
      expect(results[0].type).toBe('click');
    });

    it('should filter by threshold', () => {
      const target = createMockOp({ id: 'target', type: 'click', input: createMockInput('#submit-btn') });

      const session = createMockSession({
        operations: [
          createMockOp({ id: 'op1', type: 'click', input: createMockInput('#submit-button') }),
          createMockOp({ id: 'op2', type: 'input', input: createMockInput('#name-field') }),
        ],
      });

      const highResults = diff.findSimilar(target, session, 0.9);
      const lowResults = diff.findSimilar(target, session, 0.1);
      expect(lowResults.length).toBeGreaterThanOrEqual(highResults.length);
    });

    it('should not include the target operation itself', () => {
      const target = createMockOp({ id: 'target', type: 'click', input: createMockInput('#btn') });

      const session = createMockSession({
        operations: [
          target,
          createMockOp({ id: 'op1', type: 'click', input: createMockInput('#btn') }),
        ],
      });

      const results = diff.findSimilar(target, session);
      const ids = results.map(r => r.id);
      expect(ids).not.toContain('target');
    });

    it('should return empty array when no similar operations found', () => {
      const target = createMockOp({ id: 'target', type: 'click', input: createMockInput('#unique-selector-xyz') });

      const session = createMockSession({
        operations: [
          createMockOp({ id: 'op1', type: 'input', input: createMockInput('#completely-different') }),
          createMockOp({ id: 'op2', type: 'scroll', input: createMockInput('#also-different') }),
        ],
      });

      const results = diff.findSimilar(target, session, 0.8);
      expect(results).toHaveLength(0);
    });

    it('should throw for invalid threshold', () => {
      const target = createMockOp({ id: 'target' });
      const session = createMockSession({ operations: [] });

      expect(() => diff.findSimilar(target, session, -0.1)).toThrow('Threshold must be between 0 and 1');
      expect(() => diff.findSimilar(target, session, 1.1)).toThrow('Threshold must be between 0 and 1');
    });

    it('should rank results by similarity score', () => {
      const target = createMockOp({ id: 'target', type: 'click', input: createMockInput('#submit-btn') });

      const session = createMockSession({
        operations: [
          createMockOp({ id: 'op1', type: 'click', input: createMockInput('#submit-btn') }), // Very similar
          createMockOp({ id: 'op2', type: 'click', input: createMockInput('#submit-button') }), // Similar
          createMockOp({ id: 'op3', type: 'click', input: createMockInput('#cancel-btn') }), // Less similar
        ],
      });

      const results = diff.findSimilar(target, session, 0.3);
      // The first result should be the most similar
      expect(results[0].id).toBe('op1');
    });
  });

  // ==================== Edge Cases ====================

  describe('edge cases', () => {
    it('should handle sessions with no operations', () => {
      const session1 = createMockSession({ operations: [] });
      const session2 = createMockSession({ operations: [] });

      const result = diff.diff(session1, session2);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    it('should handle operations with zero duration', () => {
      const ops1: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 0 }),
      ];
      const ops2: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 0 }),
      ];

      const result = diff.diffOperations(ops1, ops2);
      expect(result.unchanged).toHaveLength(1);
    });

    it('should handle one zero and one non-zero duration', () => {
      const ops1: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 0 }),
      ];
      const ops2: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 100 }),
      ];

      const result = diff.diffOperations(ops1, ops2);
      expect(result.modified).toHaveLength(1);
    });
  });
});