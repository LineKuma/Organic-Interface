import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SessionAutoRecovery,
  type RecoveryState,
  type RecoveryResult,
} from '../SessionAutoRecovery.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock SessionPersistenceStorage
function createMockStorage() {
  const sessions = new Map<string, any>();

  return {
    sessions,
    save: vi.fn(async (session: any) => {
      sessions.set(session.id, { ...session });
    }),
    load: vi.fn(async (id: string) => {
      return sessions.get(id) ?? null;
    }),
    delete: vi.fn(async (id: string) => {
      sessions.delete(id);
    }),
    list: vi.fn(async () => {
      return Array.from(sessions.values());
    }),
    initialize: vi.fn(async () => {}),
    isInitialized: vi.fn(() => true),
    close: vi.fn(async () => {}),
    clear: vi.fn(async () => {
      sessions.clear();
    }),
    count: vi.fn(async () => sessions.size),
  };
}

// Helper to create a recovery state
function createRecoveryState(
  sessionId: string,
  checkpoint: number,
  overrides: Partial<RecoveryState> = {}
): RecoveryState {
  return {
    sessionId,
    lastCheckpoint: checkpoint,
    pendingTasks: overrides.pendingTasks ?? ['task-1', 'task-2'],
    completedTasks: overrides.completedTasks ?? ['task-3', 'task-4'],
    failedTasks: overrides.failedTasks ?? [],
    state: overrides.state ?? { custom: 'data' },
  };
}

describe('SessionAutoRecovery', () => {
  let recovery: SessionAutoRecovery;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    recovery = new SessionAutoRecovery();
    mockStorage = createMockStorage();
    recovery.setStorage(mockStorage as any);
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(recovery).toBeDefined();
    });
  });

  describe('setStorage', () => {
    it('should set storage backend', () => {
      const newRecovery = new SessionAutoRecovery();
      expect(() => newRecovery.setStorage(mockStorage as any)).not.toThrow();
    });
  });

  describe('saveCheckpoint', () => {
    it('should save a checkpoint', async () => {
      const state = createRecoveryState('session-1', 1);
      await recovery.saveCheckpoint('session-1', state);

      expect(mockStorage.save).toHaveBeenCalled();
      const savedSession = mockStorage.save.mock.calls[0][0];
      expect(savedSession.tags).toContain('recovery');
      expect(savedSession.tags).toContain('checkpoint');
      expect(savedSession.tags).toContain('session-1');
    });

    it('should save multiple checkpoints', async () => {
      const state1 = createRecoveryState('session-1', 1);
      const state2 = createRecoveryState('session-1', 2, {
        pendingTasks: ['task-5'],
        completedTasks: ['task-1', 'task-2', 'task-3', 'task-4'],
      });

      await recovery.saveCheckpoint('session-1', state1);
      await recovery.saveCheckpoint('session-1', state2);

      expect(mockStorage.save).toHaveBeenCalledTimes(2);
    });

    it('should throw if storage is not set', async () => {
      const noStorage = new SessionAutoRecovery();
      const state = createRecoveryState('session-1', 1);
      await expect(noStorage.saveCheckpoint('session-1', state)).rejects.toThrow(
        'StorageProvider not set'
      );
    });
  });

  describe('loadCheckpoint', () => {
    it('should load the latest checkpoint', async () => {
      const state1 = createRecoveryState('session-1', 1);
      const state2 = createRecoveryState('session-1', 2, {
        pendingTasks: ['task-5'],
        completedTasks: ['task-1', 'task-2', 'task-3', 'task-4'],
      });

      await recovery.saveCheckpoint('session-1', state1);
      await recovery.saveCheckpoint('session-1', state2);

      const loaded = await recovery.loadCheckpoint('session-1');
      expect(loaded).toBeDefined();
      expect(loaded!.lastCheckpoint).toBe(2);
      expect(loaded!.pendingTasks).toEqual(['task-5']);
    });

    it('should return null for unknown session', async () => {
      const loaded = await recovery.loadCheckpoint('unknown-session');
      expect(loaded).toBeNull();
    });

    it('should return null when no checkpoints exist', async () => {
      const loaded = await recovery.loadCheckpoint('session-no-checkpoints');
      expect(loaded).toBeNull();
    });
  });

  describe('recover', () => {
    it('should recover from checkpoint', async () => {
      const state = createRecoveryState('session-1', 1, {
        completedTasks: ['task-1', 'task-2'],
        failedTasks: ['task-3'],
        pendingTasks: ['task-4'],
      });

      await recovery.saveCheckpoint('session-1', state);

      const result = await recovery.recover('session-1');
      expect(result.success).toBe(true);
      expect(result.recoveredTasks).toBe(2);
      expect(result.failedTasks).toBe(1);
      expect(result.lostTasks).toBe(1);
      expect(result.recoveryTime).toBeGreaterThanOrEqual(0);
    });

    it('should return failure when no checkpoint exists', async () => {
      const result = await recovery.recover('unknown');
      expect(result.success).toBe(false);
      expect(result.recoveredTasks).toBe(0);
      expect(result.failedTasks).toBe(0);
      expect(result.lostTasks).toBe(0);
    });
  });

  describe('listCheckpoints', () => {
    it('should list all checkpoints for a session', async () => {
      await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', 1));
      await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', 2));
      await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', 3));

      const checkpoints = await recovery.listCheckpoints('session-1');
      expect(checkpoints).toHaveLength(3);
    });

    it('should only return checkpoints for the specified session', async () => {
      await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', 1));
      await recovery.saveCheckpoint('session-2', createRecoveryState('session-2', 1));

      const checkpoints = await recovery.listCheckpoints('session-1');
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0].sessionId).toBe('session-1');
    });

    it('should return empty array for unknown session', async () => {
      const checkpoints = await recovery.listCheckpoints('unknown');
      expect(checkpoints).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should keep only the most recent checkpoints', async () => {
      for (let i = 1; i <= 10; i++) {
        await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', i));
      }

      // Check that we have 10 checkpoints
      const before = await recovery.listCheckpoints('session-1');
      expect(before).toHaveLength(10);

      // Clean up, keeping only 3
      await recovery.cleanup('session-1', 3);

      const after = await recovery.listCheckpoints('session-1');
      expect(after).toHaveLength(3);
    });

    it('should not delete if under limit', async () => {
      await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', 1));
      await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', 2));

      await recovery.cleanup('session-1', 5);

      const checkpoints = await recovery.listCheckpoints('session-1');
      expect(checkpoints).toHaveLength(2);
    });

    it('should handle empty checkpoints', async () => {
      await expect(recovery.cleanup('session-1', 5)).resolves.not.toThrow();
    });
  });

  describe('shouldRecover', () => {
    it('should return true when there are pending tasks', async () => {
      const state = createRecoveryState('session-1', 1, {
        pendingTasks: ['task-1'],
        completedTasks: [],
        failedTasks: [],
      });
      await recovery.saveCheckpoint('session-1', state);

      const should = await recovery.shouldRecover('session-1');
      expect(should).toBe(true);
    });

    it('should return true when there are failed tasks', async () => {
      const state = createRecoveryState('session-1', 1, {
        pendingTasks: [],
        completedTasks: [],
        failedTasks: ['task-1'],
      });
      await recovery.saveCheckpoint('session-1', state);

      const should = await recovery.shouldRecover('session-1');
      expect(should).toBe(true);
    });

    it('should return false when all tasks are completed', async () => {
      const state = createRecoveryState('session-1', 1, {
        pendingTasks: [],
        completedTasks: ['task-1'],
        failedTasks: [],
      });
      await recovery.saveCheckpoint('session-1', state);

      const should = await recovery.shouldRecover('session-1');
      expect(should).toBe(false);
    });

    it('should return false for unknown session', async () => {
      const should = await recovery.shouldRecover('unknown');
      expect(should).toBe(false);
    });
  });

  describe('getLatestCheckpointNumber', () => {
    it('should return the latest checkpoint number', async () => {
      await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', 1));
      await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', 5));
      await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', 3));

      const num = await recovery.getLatestCheckpointNumber('session-1');
      expect(num).toBe(5);
    });

    it('should return 0 for unknown session', async () => {
      const num = await recovery.getLatestCheckpointNumber('unknown');
      expect(num).toBe(0);
    });
  });

  describe('deleteAllCheckpoints', () => {
    it('should delete all checkpoints for a session', async () => {
      await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', 1));
      await recovery.saveCheckpoint('session-1', createRecoveryState('session-1', 2));
      await recovery.saveCheckpoint('session-2', createRecoveryState('session-2', 1));

      await recovery.deleteAllCheckpoints('session-1');

      const checkpoints1 = await recovery.listCheckpoints('session-1');
      expect(checkpoints1).toHaveLength(0);

      const checkpoints2 = await recovery.listCheckpoints('session-2');
      expect(checkpoints2).toHaveLength(1);
    });

    it('should handle no checkpoints gracefully', async () => {
      await expect(recovery.deleteAllCheckpoints('unknown')).resolves.not.toThrow();
    });
  });

  describe('recovery result', () => {
    it('should include recovery time', async () => {
      const state = createRecoveryState('session-1', 1);
      await recovery.saveCheckpoint('session-1', state);

      const result = await recovery.recover('session-1');
      expect(result.recoveryTime).toBeGreaterThanOrEqual(0);
    });

    it('should correctly count recovered tasks', async () => {
      const state = createRecoveryState('session-1', 1, {
        completedTasks: ['a', 'b', 'c', 'd'],
        failedTasks: ['e'],
        pendingTasks: ['f', 'g'],
      });
      await recovery.saveCheckpoint('session-1', state);

      const result = await recovery.recover('session-1');
      expect(result.recoveredTasks).toBe(4);
      expect(result.failedTasks).toBe(1);
      expect(result.lostTasks).toBe(2);
    });
  });

  describe('checkpoint ID format', () => {
    it('should use consistent checkpoint ID format', async () => {
      const state = createRecoveryState('test-session', 42);
      await recovery.saveCheckpoint('test-session', state);

      const savedSession = mockStorage.save.mock.calls[0][0];
      expect(savedSession.id).toContain('recovery_checkpoint_');
      expect(savedSession.id).toContain('test-session');
      expect(savedSession.id).toContain('42');
    });
  });

  describe('multiple sessions', () => {
    it('should keep checkpoints separate between sessions', async () => {
      await recovery.saveCheckpoint('session-a', createRecoveryState('session-a', 1));
      await recovery.saveCheckpoint('session-a', createRecoveryState('session-a', 2));
      await recovery.saveCheckpoint('session-b', createRecoveryState('session-b', 1));

      const checkpointsA = await recovery.listCheckpoints('session-a');
      const checkpointsB = await recovery.listCheckpoints('session-b');

      expect(checkpointsA).toHaveLength(2);
      expect(checkpointsB).toHaveLength(1);
      expect(checkpointsA[0].sessionId).toBe('session-a');
      expect(checkpointsB[0].sessionId).toBe('session-b');
    });
  });
});