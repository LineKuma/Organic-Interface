import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OperationRecorder } from '../OperationRecorder.js';
import type { RecordingSession } from '../OperationRecorder.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function createMockInput(selector: string = '#test') {
  return { selector };
}

function createMockResult(overrides: Record<string, unknown> = {}) {
  return {
    operationId: 'op-1',
    type: 'click' as const,
    success: true,
    executionTime: 100,
    status: 'success' as const,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('OperationRecorder', () => {
  let recorder: OperationRecorder;

  beforeEach(() => {
    recorder = new OperationRecorder();
  });

  // ==================== Construction ====================

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(recorder).toBeDefined();
    });

    it('should not be recording initially', () => {
      expect(recorder.isRecording()).toBe(false);
    });

    it('should have no current session initially', () => {
      expect(recorder.getCurrentSession()).toBeNull();
    });

    it('should have no sessions initially', () => {
      expect(recorder.listSessions()).toEqual([]);
    });
  });

  // ==================== startRecording ====================

  describe('startRecording', () => {
    it('should start a new recording session', () => {
      const session = recorder.startRecording();
      expect(session).toBeDefined();
      expect(session.status).toBe('recording');
      expect(session.operations).toEqual([]);
      expect(recorder.isRecording()).toBe(true);
    });

    it('should generate a unique session ID', () => {
      const session1 = recorder.startRecording();
      recorder.stopRecording();
      const session2 = recorder.startRecording();
      expect(session1.id).not.toBe(session2.id);
    });

    it('should accept a custom name', () => {
      const session = recorder.startRecording('My Session');
      expect(session.name).toBe('My Session');
    });

    it('should auto-generate name if not provided', () => {
      const session = recorder.startRecording();
      expect(session.name).toContain('Recording');
    });

    it('should stop existing recording and start new one', () => {
      const session1 = recorder.startRecording('First');
      const session2 = recorder.startRecording('Second');
      expect(session1.status).toBe('stopped');
      expect(session2.status).toBe('recording');
      expect(recorder.getCurrentSession()?.id).toBe(session2.id);
    });

    it('should emit recording:start event', () => {
      const handler = vi.fn();
      recorder.on('recording:start', handler);
      recorder.startRecording('Test');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].session.name).toBe('Test');
    });
  });

  // ==================== stopRecording ====================

  describe('stopRecording', () => {
    it('should stop the current recording session', () => {
      const session = recorder.startRecording();
      const stopped = recorder.stopRecording();
      expect(stopped.id).toBe(session.id);
      expect(stopped.status).toBe('stopped');
      expect(stopped.endTime).toBeDefined();
      expect(recorder.isRecording()).toBe(false);
    });

    it('should throw if no active session', () => {
      expect(() => recorder.stopRecording()).toThrow('No active recording session');
    });

    it('should emit recording:stop event', () => {
      const handler = vi.fn();
      recorder.on('recording:stop', handler);
      recorder.startRecording();
      recorder.stopRecording();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== recordOperation ====================

  describe('recordOperation', () => {
    it('should record an operation in the current session', () => {
      const session = recorder.startRecording();
      const op = recorder.recordOperation('click', createMockInput('#btn'));
      expect(op).toBeDefined();
      expect(op.type).toBe('click');
      expect(op.input.selector).toBe('#btn');
      expect(session.operations).toHaveLength(1);
    });

    it('should record operation even without active session', () => {
      const op = recorder.recordOperation('click', createMockInput('#btn'));
      expect(op).toBeDefined();
      expect(op.type).toBe('click');
    });

    it('should use result data when provided', () => {
      recorder.startRecording();
      const result = createMockResult({ executionTime: 250, status: 'success' as const });
      const op = recorder.recordOperation('click', createMockInput('#btn'), result);
      expect(op.duration).toBe(250);
      expect(op.status).toBe('success');
      expect(op.result).toBe(result);
    });

    it('should default to pending status when no result', () => {
      recorder.startRecording();
      const op = recorder.recordOperation('click', createMockInput('#btn'));
      expect(op.status).toBe('pending');
      expect(op.duration).toBe(0);
    });

    it('should generate unique operation IDs', () => {
      recorder.startRecording();
      const op1 = recorder.recordOperation('click', createMockInput('#a'));
      const op2 = recorder.recordOperation('click', createMockInput('#b'));
      expect(op1.id).not.toBe(op2.id);
    });

    it('should emit operation:recorded event', () => {
      const handler = vi.fn();
      recorder.on('operation:recorded', handler);
      recorder.startRecording();
      recorder.recordOperation('click', createMockInput('#btn'));
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].operation.type).toBe('click');
    });
  });

  // ==================== isRecording ====================

  describe('isRecording', () => {
    it('should return true while recording', () => {
      recorder.startRecording();
      expect(recorder.isRecording()).toBe(true);
    });

    it('should return false after stopping', () => {
      recorder.startRecording();
      recorder.stopRecording();
      expect(recorder.isRecording()).toBe(false);
    });
  });

  // ==================== getCurrentSession ====================

  describe('getCurrentSession', () => {
    it('should return the current session', () => {
      const session = recorder.startRecording();
      expect(recorder.getCurrentSession()).toBe(session);
    });

    it('should return null when not recording', () => {
      expect(recorder.getCurrentSession()).toBeNull();
    });
  });

  // ==================== getSession ====================

  describe('getSession', () => {
    it('should return a session by ID', () => {
      const session = recorder.startRecording();
      recorder.stopRecording();
      expect(recorder.getSession(session.id)).toBe(session);
    });

    it('should return undefined for non-existent session', () => {
      expect(recorder.getSession('nonexistent')).toBeUndefined();
    });
  });

  // ==================== listSessions ====================

  describe('listSessions', () => {
    it('should list all sessions', () => {
      recorder.startRecording('Session 1');
      recorder.stopRecording();
      recorder.startRecording('Session 2');
      recorder.stopRecording();
      const sessions = recorder.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.name)).toContain('Session 1');
      expect(sessions.map(s => s.name)).toContain('Session 2');
    });
  });

  // ==================== deleteSession ====================

  describe('deleteSession', () => {
    it('should delete a session by ID', () => {
      const session = recorder.startRecording();
      recorder.stopRecording();
      const result = recorder.deleteSession(session.id);
      expect(result).toBe(true);
      expect(recorder.getSession(session.id)).toBeUndefined();
    });

    it('should clear current session if deleting active session', () => {
      const session = recorder.startRecording();
      recorder.deleteSession(session.id);
      expect(recorder.isRecording()).toBe(false);
      expect(recorder.getCurrentSession()).toBeNull();
    });

    it('should return false for non-existent session', () => {
      expect(recorder.deleteSession('nonexistent')).toBe(false);
    });

    it('should emit session:deleted event', () => {
      const handler = vi.fn();
      recorder.on('session:deleted', handler);
      const session = recorder.startRecording();
      recorder.stopRecording();
      recorder.deleteSession(session.id);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].sessionId).toBe(session.id);
    });
  });

  // ==================== clearSessions ====================

  describe('clearSessions', () => {
    it('should clear all sessions', () => {
      recorder.startRecording('S1');
      recorder.stopRecording();
      recorder.startRecording('S2');
      recorder.stopRecording();
      recorder.clearSessions();
      expect(recorder.listSessions()).toEqual([]);
    });

    it('should clear current session', () => {
      recorder.startRecording();
      recorder.clearSessions();
      expect(recorder.isRecording()).toBe(false);
      expect(recorder.getCurrentSession()).toBeNull();
    });
  });

  // ==================== exportSession ====================

  describe('exportSession', () => {
    it('should export a session as JSON', () => {
      const session = recorder.startRecording('Export Test');
      recorder.recordOperation('click', createMockInput('#btn'));
      recorder.stopRecording();
      const json = recorder.exportSession(session.id);
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(session.id);
      expect(parsed.name).toBe('Export Test');
      expect(parsed.operations).toHaveLength(1);
    });

    it('should throw for non-existent session', () => {
      expect(() => recorder.exportSession('nonexistent')).toThrow('Session not found');
    });
  });

  // ==================== importSession ====================

  describe('importSession', () => {
    it('should import a session from JSON', () => {
      const session = recorder.startRecording('Original');
      recorder.recordOperation('click', createMockInput('#btn'));
      recorder.stopRecording();
      const json = recorder.exportSession(session.id);

      const newRecorder = new OperationRecorder();
      const imported = newRecorder.importSession(json);
      expect(imported.name).toBe('Original');
      expect(imported.operations).toHaveLength(1);
      expect(imported.status).toBe('stopped');
    });

    it('should handle duplicate IDs by appending suffix', () => {
      const session = recorder.startRecording('Dup');
      recorder.stopRecording();
      const json = recorder.exportSession(session.id);
      const imported = recorder.importSession(json);
      expect(imported.id).not.toBe(session.id);
      expect(imported.id).toContain('_imported_');
    });

    it('should throw for invalid JSON', () => {
      expect(() => recorder.importSession('invalid')).toThrow('Failed to parse session JSON');
    });

    it('should throw for missing required fields', () => {
      expect(() => recorder.importSession('{}')).toThrow('Invalid session data');
    });

    it('should emit session:imported event', () => {
      const handler = vi.fn();
      recorder.on('session:imported', handler);
      const session = recorder.startRecording('Test');
      recorder.stopRecording();
      const json = recorder.exportSession(session.id);
      const newRecorder = new OperationRecorder();
      newRecorder.on('session:imported', handler);
      newRecorder.importSession(json);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== filterOperations ====================

  describe('filterOperations', () => {
    let session: RecordingSession;

    beforeEach(() => {
      session = recorder.startRecording('Filter Test');
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ status: 'success', executionTime: 100 })
      );
      recorder.recordOperation(
        'input',
        createMockInput('#field'),
        createMockResult({ status: 'failed', executionTime: 200 })
      );
      recorder.recordOperation(
        'scroll',
        createMockInput('#page'),
        createMockResult({ status: 'success', executionTime: 50 })
      );
      recorder.recordOperation(
        'wait',
        createMockInput('#loader'),
        createMockResult({ status: 'cancelled', executionTime: 300 })
      );
      recorder.stopRecording();
    });

    it('should filter by type', () => {
      const results = recorder.filterOperations(session.id, { types: ['click'] });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('click');
    });

    it('should filter by multiple types', () => {
      const results = recorder.filterOperations(session.id, { types: ['click', 'input'] });
      expect(results).toHaveLength(2);
    });

    it('should filter by status', () => {
      const results = recorder.filterOperations(session.id, { statuses: ['failed'] });
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failed');
    });

    it('should filter by minDuration', () => {
      const results = recorder.filterOperations(session.id, { minDuration: 150 });
      expect(results).toHaveLength(2); // 200 and 300
    });

    it('should filter by maxDuration', () => {
      const results = recorder.filterOperations(session.id, { maxDuration: 100 });
      expect(results).toHaveLength(2); // 100 and 50
    });

    it('should filter by duration range', () => {
      const results = recorder.filterOperations(session.id, { minDuration: 80, maxDuration: 250 });
      expect(results).toHaveLength(2); // 100 and 200
    });

    it('should combine multiple filters', () => {
      const results = recorder.filterOperations(session.id, {
        types: ['click', 'input'],
        statuses: ['success'],
      });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('click');
    });

    it('should return all operations with empty filter', () => {
      const results = recorder.filterOperations(session.id, {});
      expect(results).toHaveLength(4);
    });

    it('should throw for non-existent session', () => {
      expect(() => recorder.filterOperations('nonexistent', {})).toThrow('Session not found');
    });
  });

  // ==================== getOperationStats ====================

  describe('getOperationStats', () => {
    it('should return zero stats for empty session', () => {
      const session = recorder.startRecording('Empty');
      recorder.stopRecording();
      const stats = recorder.getOperationStats(session.id);
      expect(stats.total).toBe(0);
      expect(stats.success).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.cancelled).toBe(0);
      expect(stats.avgDuration).toBe(0);
      expect(stats.totalDuration).toBe(0);
      expect(stats.byType).toEqual({});
    });

    it('should calculate correct statistics', () => {
      const session = recorder.startRecording('Stats');
      recorder.recordOperation(
        'click',
        createMockInput('#a'),
        createMockResult({ status: 'success', executionTime: 100 })
      );
      recorder.recordOperation(
        'click',
        createMockInput('#b'),
        createMockResult({ status: 'success', executionTime: 200 })
      );
      recorder.recordOperation(
        'input',
        createMockInput('#c'),
        createMockResult({ status: 'failed', executionTime: 150 })
      );
      recorder.recordOperation(
        'scroll',
        createMockInput('#d'),
        createMockResult({ status: 'cancelled', executionTime: 50 })
      );
      recorder.stopRecording();

      const stats = recorder.getOperationStats(session.id);
      expect(stats.total).toBe(4);
      expect(stats.success).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.totalDuration).toBe(500);
      expect(stats.avgDuration).toBe(125);
      expect(stats.byType).toEqual({ click: 2, input: 1, scroll: 1 });
    });

    it('should throw for non-existent session', () => {
      expect(() => recorder.getOperationStats('nonexistent')).toThrow('Session not found');
    });
  });

  // ==================== EventEmitter ====================

  describe('events', () => {
    it('should support multiple listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      recorder.on('recording:start', handler1);
      recorder.on('recording:start', handler2);
      recorder.startRecording();
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should support removing listeners', () => {
      const handler = vi.fn();
      recorder.on('recording:start', handler);
      recorder.off('recording:start', handler);
      recorder.startRecording();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
