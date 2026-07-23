import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OperationRecorder } from '../OperationRecorder.js';
import { OperationReplayer } from '../OperationReplayer.js';
import type { RecordedOperation } from '../OperationRecorder.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function createMockInput(selector = '#test') {
  return { selector };
}

function createMockResult(overrides: Record<string, unknown> = {}) {
  return {
    operationId: 'op-1',
    type: 'click' as const,
    success: overrides.status === 'failed' ? false : true,
    executionTime: (overrides.executionTime as number) ?? 100,
    status: (overrides.status as 'success' | 'failed' | 'cancelled') ?? 'success',
    timestamp: Date.now(),
    error: overrides.error as string | undefined,
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

describe('OperationReplayer', () => {
  let recorder: OperationRecorder;
  let replayer: OperationReplayer;

  beforeEach(() => {
    recorder = new OperationRecorder();
    replayer = new OperationReplayer(recorder);
  });

  // ==================== Construction ====================

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(replayer).toBeDefined();
    });

    it('should not be playing initially', () => {
      expect(replayer.isPlaying()).toBe(false);
    });
  });

  // ==================== replay ====================

  describe('replay', () => {
    it('should throw for non-existent session', async () => {
      await expect(replayer.replay('nonexistent')).rejects.toThrow('Session not found');
    });

    it('should replay all operations in a session', async () => {
      const session = recorder.startRecording('Test');
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ executionTime: 10 })
      );
      recorder.recordOperation(
        'input',
        createMockInput('#field'),
        createMockResult({ executionTime: 10 })
      );
      recorder.stopRecording();

      const result = await replayer.replay(session.id);
      expect(result.totalOperations).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(0);
      expect(result.skipCount).toBe(0);
    });

    it('should replay with custom speed', async () => {
      const session = recorder.startRecording('Speed Test');
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ executionTime: 100 })
      );
      recorder.stopRecording();

      const startTime = Date.now();
      const result = await replayer.replay(session.id, { speed: 10 });
      const elapsed = Date.now() - startTime;
      expect(result.successCount).toBe(1);
      // With 10x speed, 100ms becomes 10ms, should be very fast
      expect(elapsed).toBeLessThan(50);
    });

    it('should replay with fixed delay', async () => {
      const session = recorder.startRecording('Delay Test');
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ executionTime: 1000 })
      );
      recorder.stopRecording();

      const startTime = Date.now();
      const result = await replayer.replay(session.id, { delay: 10 });
      const elapsed = Date.now() - startTime;
      expect(result.successCount).toBe(1);
      expect(elapsed).toBeLessThan(50);
    });

    it('should handle failed operations', async () => {
      const session = recorder.startRecording('Error Test');
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ status: 'failed', executionTime: 10, success: false })
      );
      recorder.stopRecording();

      const result = await replayer.replay(session.id);
      expect(result.totalOperations).toBe(1);
      expect(result.successCount).toBe(0);
      expect(result.failCount).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle cancelled operations', async () => {
      const session = recorder.startRecording('Cancel Test');
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ status: 'cancelled', executionTime: 10 })
      );
      recorder.stopRecording();

      const result = await replayer.replay(session.id);
      expect(result.skipCount).toBe(1);
      expect(result.successCount).toBe(0);
    });

    it('should stop on error when stopOnError is true', async () => {
      const session = recorder.startRecording('Stop Test');
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ status: 'success', executionTime: 10 })
      );
      recorder.recordOperation(
        'input',
        createMockInput('#field'),
        createMockResult({ status: 'failed', executionTime: 10, success: false })
      );
      recorder.recordOperation(
        'scroll',
        createMockInput('#page'),
        createMockResult({ status: 'success', executionTime: 10 })
      );
      recorder.stopRecording();

      const result = await replayer.replay(session.id, { stopOnError: true });
      expect(result.totalOperations).toBe(3);
      // Only first 2 operations should be counted (the 3rd was not reached)
      expect(result.successCount + result.failCount).toBeLessThanOrEqual(2);
    });

    it('should not stop on error by default', async () => {
      const session = recorder.startRecording('NoStop Test');
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ status: 'success', executionTime: 10 })
      );
      recorder.recordOperation(
        'input',
        createMockInput('#field'),
        createMockResult({ status: 'failed', executionTime: 10, success: false })
      );
      recorder.recordOperation(
        'scroll',
        createMockInput('#page'),
        createMockResult({ status: 'success', executionTime: 10 })
      );
      recorder.stopRecording();

      const result = await replayer.replay(session.id);
      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(1);
    });

    it('should emit replay:start event', async () => {
      const handler = vi.fn();
      replayer.on('replay:start', handler);
      const session = recorder.startRecording();
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ executionTime: 10 })
      );
      recorder.stopRecording();
      await replayer.replay(session.id);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should emit replay:end event', async () => {
      const handler = vi.fn();
      replayer.on('replay:end', handler);
      const session = recorder.startRecording();
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ executionTime: 10 })
      );
      recorder.stopRecording();
      await replayer.replay(session.id);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].result.successCount).toBe(1);
    });

    it('should emit operation:start and operation:end events', async () => {
      const startHandler = vi.fn();
      const endHandler = vi.fn();
      replayer.on('operation:start', startHandler);
      replayer.on('operation:end', endHandler);
      const session = recorder.startRecording();
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ executionTime: 10 })
      );
      recorder.stopRecording();
      await replayer.replay(session.id);
      expect(startHandler).toHaveBeenCalledTimes(1);
      expect(endHandler).toHaveBeenCalledTimes(1);
    });

    it('should emit operation:error event for failed operations', async () => {
      const handler = vi.fn();
      replayer.on('operation:error', handler);
      const session = recorder.startRecording();
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ status: 'failed', executionTime: 10, success: false })
      );
      recorder.stopRecording();
      await replayer.replay(session.id);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should emit replay:progress events', async () => {
      const handler = vi.fn();
      replayer.on('replay:progress', handler);
      const session = recorder.startRecording();
      recorder.recordOperation(
        'click',
        createMockInput('#btn'),
        createMockResult({ executionTime: 10 })
      );
      recorder.stopRecording();
      await replayer.replay(session.id);
      expect(handler).toHaveBeenCalled();
    });
  });

  // ==================== replayOperations ====================

  describe('replayOperations', () => {
    it('should replay a list of operations directly', async () => {
      const ops: RecordedOperation[] = [
        createMockOp({ type: 'click', id: 'op1', duration: 10 }),
        createMockOp({ type: 'input', id: 'op2', duration: 10 }),
      ];

      const result = await replayer.replayOperations(ops);
      expect(result.totalOperations).toBe(2);
      expect(result.successCount).toBe(2);
    });

    it('should throw if already replaying', async () => {
      const ops: RecordedOperation[] = [createMockOp({ id: 'op1', duration: 100 })];

      // Start replay but don't await
      const replayPromise = replayer.replayOperations(ops);

      // Should throw for concurrent replay
      await expect(replayer.replayOperations(ops)).rejects.toThrow('Already replaying');

      await replayPromise;
    });

    it('should apply filter when provided', async () => {
      const ops: RecordedOperation[] = [
        createMockOp({ type: 'click', id: 'op1', duration: 10 }),
        createMockOp({ type: 'input', id: 'op2', duration: 10 }),
        createMockOp({ type: 'scroll', id: 'op3', duration: 10 }),
      ];

      const result = await replayer.replayOperations(ops, {
        filter: { types: ['click'] },
      });
      expect(result.totalOperations).toBe(1);
    });
  });

  // ==================== pause / resume ====================

  describe('pause and resume', () => {
    it('should warn when pausing while not playing', () => {
      replayer.pause();
      expect(replayer.isPlaying()).toBe(false);
    });

    it('should warn when resuming while not paused', () => {
      replayer.resume();
      expect(replayer.isPlaying()).toBe(false);
    });

    it('should emit replay:pause on pause', async () => {
      const handler = vi.fn();
      replayer.on('replay:pause', handler);

      const ops: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 50 }),
        createMockOp({ id: 'op2', duration: 50 }),
      ];

      const replayPromise = replayer.replayOperations(ops);
      // Small delay so the replay starts
      await new Promise(r => setTimeout(r, 5));
      replayer.pause();
      expect(handler).toHaveBeenCalledTimes(1);

      replayer.resume();
      await replayPromise;
    });

    it('should emit replay:resume on resume', async () => {
      const handler = vi.fn();
      replayer.on('replay:resume', handler);

      const ops: RecordedOperation[] = [createMockOp({ id: 'op1', duration: 50 })];

      const replayPromise = replayer.replayOperations(ops);
      await new Promise(r => setTimeout(r, 5));
      replayer.pause();
      replayer.resume();
      expect(handler).toHaveBeenCalledTimes(1);

      await replayPromise;
    });

    it('should pause and resume replay', async () => {
      const ops: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 50 }),
        createMockOp({ id: 'op2', duration: 50 }),
        createMockOp({ id: 'op3', duration: 50 }),
      ];

      const replayPromise = replayer.replayOperations(ops);

      // Pause after first operation
      await new Promise(r => setTimeout(r, 20));
      replayer.pause();
      const progressDuringPause = replayer.getProgress();
      expect(progressDuringPause.total).toBe(3);

      // Resume after a short delay
      await new Promise(r => setTimeout(r, 30));
      replayer.resume();

      const result = await replayPromise;
      expect(result.totalOperations).toBe(3);
      expect(result.successCount).toBe(3);
    });
  });

  // ==================== stop ====================

  describe('stop', () => {
    it('should warn when stopping while not playing or paused', () => {
      replayer.stop();
      expect(replayer.isPlaying()).toBe(false);
    });

    it('should stop an active replay', async () => {
      const ops: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 100 }),
        createMockOp({ id: 'op2', duration: 100 }),
        createMockOp({ id: 'op3', duration: 100 }),
        createMockOp({ id: 'op4', duration: 100 }),
      ];

      const replayPromise = replayer.replayOperations(ops);
      await new Promise(r => setTimeout(r, 10));
      replayer.stop();

      const result = await replayPromise;
      // Should have stopped before completing all operations
      expect(result.totalOperations).toBe(4);
      expect(result.successCount + result.failCount + result.skipCount).toBeLessThanOrEqual(2);
    });

    it('should stop a paused replay', async () => {
      const ops: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 100 }),
        createMockOp({ id: 'op2', duration: 100 }),
      ];

      const replayPromise = replayer.replayOperations(ops);
      await new Promise(r => setTimeout(r, 10));
      replayer.pause();
      replayer.stop();
      await replayPromise;
      expect(replayer.isPlaying()).toBe(false);
    });
  });

  // ==================== getProgress ====================

  describe('getProgress', () => {
    it('should return empty progress when not playing', () => {
      const progress = replayer.getProgress();
      expect(progress.current).toBe(0);
      expect(progress.total).toBe(0);
      expect(progress.percent).toBe(0);
    });

    it('should return progress during replay', async () => {
      const ops: RecordedOperation[] = [
        createMockOp({ id: 'op1', duration: 50 }),
        createMockOp({ id: 'op2', duration: 50 }),
      ];

      const replayPromise = replayer.replayOperations(ops);
      await new Promise(r => setTimeout(r, 10));

      const progress = replayer.getProgress();
      expect(progress.total).toBe(2);
      expect(progress.percent).toBeGreaterThanOrEqual(0);

      await replayPromise;
    });
  });

  // ==================== isPlaying ====================

  describe('isPlaying', () => {
    it('should return false initially', () => {
      expect(replayer.isPlaying()).toBe(false);
    });

    it('should return true during replay', async () => {
      const ops: RecordedOperation[] = [createMockOp({ id: 'op1', duration: 50 })];

      const replayPromise = replayer.replayOperations(ops);
      expect(replayer.isPlaying()).toBe(true);
      await replayPromise;
      expect(replayer.isPlaying()).toBe(false);
    });
  });

  // ==================== Speed ====================

  describe('speed', () => {
    it('should clamp speed to minimum 0.1', async () => {
      const ops: RecordedOperation[] = [createMockOp({ id: 'op1', duration: 100 })];

      const result = await replayer.replayOperations(ops, { speed: -1 });
      expect(result.successCount).toBe(1);
    });

    it('should clamp speed to maximum 10', async () => {
      const ops: RecordedOperation[] = [createMockOp({ id: 'op1', duration: 100 })];

      const result = await replayer.replayOperations(ops, { speed: 100 });
      expect(result.successCount).toBe(1);
    });
  });

  // ==================== Error Handling ====================

  describe('error handling', () => {
    it('should include errors in replay result', async () => {
      const ops: RecordedOperation[] = [
        createMockOp({
          id: 'op1',
          status: 'failed',
          duration: 10,
          result: createMockResult({ status: 'failed', success: false, error: 'Test error' }),
        }),
      ];

      const result = await replayer.replayOperations(ops);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Test error');
      expect(result.failCount).toBe(1);
    });

    it('should handle mixed operation results', async () => {
      const ops: RecordedOperation[] = [
        createMockOp({ id: 'op1', type: 'click', duration: 10, status: 'success' }),
        createMockOp({
          id: 'op2',
          type: 'input',
          duration: 10,
          status: 'failed',
          result: createMockResult({ status: 'failed', success: false }),
        }),
        createMockOp({
          id: 'op3',
          type: 'scroll',
          duration: 10,
          status: 'cancelled',
          result: createMockResult({ status: 'cancelled' }),
        }),
        createMockOp({ id: 'op4', type: 'wait', duration: 10, status: 'success' }),
      ];

      const result = await replayer.replayOperations(ops);
      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(1);
      expect(result.skipCount).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });
});
