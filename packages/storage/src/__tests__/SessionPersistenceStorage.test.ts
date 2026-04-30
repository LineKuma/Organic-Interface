import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SessionPersistenceStorage,
  SessionPersistenceStorageConfig,
  SessionPersistence,
  SessionPersistenceStatus,
  SessionPersistenceContextWindow,
  SessionAdapter,
} from '../services/SessionPersistenceStorage.js';
import { StorageService } from '../services/StorageService.js';
import { MemoryStorage } from '../backends/MemoryStorage.js';

describe('SessionPersistenceStorage', () => {
  let storage: SessionPersistenceStorage;
  let storageService: StorageService;
  let backend: MemoryStorage;

  const createTestSession = (overrides?: Partial<SessionPersistence>): SessionPersistence => ({
    id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Session',
    status: SessionPersistenceStatus.ACTIVE,
    tags: ['test'],
    metadata: { key: 'value' },
    contextWindow: {
      windowSize: 50,
      windowType: 'recent_messages',
      includeSystemMessages: true,
      includeToolCalls: true,
    },
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    messageCount: 0,
    ...overrides,
  });

  beforeEach(async () => {
    backend = new MemoryStorage();
    storageService = new StorageService(backend);
    await storageService.initialize();

    const config: SessionPersistenceStorageConfig = {
      storage: storageService,
      autoSave: true,
      entityTtl: 24 * 60 * 60 * 1000,
    };

    storage = new SessionPersistenceStorage(config);
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('constructor', () => {
    it('should create SessionPersistenceStorage', () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const s = new SessionPersistenceStorage(config);
      expect(s).toBeDefined();
    });

    it('should create with autoSave false', () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
        autoSave: false,
      };
      const s = new SessionPersistenceStorage(config);
      expect(s).toBeDefined();
    });

    it('should create with custom entityTtl', () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
        entityTtl: 60 * 60 * 1000,
      };
      const s = new SessionPersistenceStorage(config);
      expect(s).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should be initialized after construction', () => {
      expect(storage.isInitialized()).toBe(true);
    });
  });

  describe('save', () => {
    it('should save session', async () => {
      const session = createTestSession();
      await storage.save(session);
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
        autoSave: true,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      const session = createTestSession();
      await expect(uninitStorage.save(session)).rejects.toThrow();
    });

    it('should update existing session', async () => {
      const session = createTestSession();
      await storage.save(session);

      session.title = 'Updated Title';
      await storage.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded?.title).toBe('Updated Title');
    });

    it('should not persist when autoSave is false', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
        autoSave: false,
      };
      const noAutoSaveStorage = new SessionPersistenceStorage(config);
      await noAutoSaveStorage.initialize();

      const session = createTestSession();
      await noAutoSaveStorage.save(session);

      const loadedFromCache = await noAutoSaveStorage.load(session.id);
      expect(loadedFromCache).not.toBeNull();

      const newStorage = new SessionPersistenceStorage(config);
      await newStorage.initialize();
      const loadedFromStorage = await newStorage.load(session.id);
      expect(loadedFromStorage).toBeNull();

      await noAutoSaveStorage.close();
      await newStorage.close();
    });
  });

  describe('load', () => {
    it('should load saved session', async () => {
      const session = createTestSession();
      await storage.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(session.id);
      expect(loaded?.title).toBe(session.title);
    });

    it('should return null for non-existent session', async () => {
      const loaded = await storage.load('non-existent-id');
      expect(loaded).toBeNull();
    });

    it('should return null for expired session', async () => {
      const session = createTestSession({
        expiresAt: Date.now() - 1000,
      });
      await storage.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded).toBeNull();
    });

    it('should return null for closed session', async () => {
      const session = createTestSession({
        status: SessionPersistenceStatus.CLOSED,
      });
      await storage.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded).toBeNull();
    });

    it('should return null for archived session', async () => {
      const session = createTestSession({
        status: SessionPersistenceStatus.ARCHIVED,
      });
      await storage.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded).toBeNull();
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      await expect(uninitStorage.load('any-id')).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete session', async () => {
      const session = createTestSession();
      await storage.save(session);

      await storage.delete(session.id);

      const loaded = await storage.load(session.id);
      expect(loaded).toBeNull();
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      await expect(uninitStorage.delete('any-id')).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should list all sessions', async () => {
      const session1 = createTestSession({ id: 'session-1' });
      const session2 = createTestSession({ id: 'session-2' });

      await storage.save(session1);
      await storage.save(session2);

      const sessions = await storage.list();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });

    it('should clean up expired sessions', async () => {
      const expiredSession = createTestSession({
        id: 'expired-session',
        expiresAt: Date.now() - 1000,
      });
      await storage.save(expiredSession);

      const validSession = createTestSession({ id: 'valid-session' });
      await storage.save(validSession);

      const sessions = await storage.list();
      const ids = sessions.map(s => s.id);
      expect(ids).not.toContain('expired-session');
      expect(ids).toContain('valid-session');
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      await expect(uninitStorage.list()).rejects.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all sessions', async () => {
      const session1 = createTestSession({ id: 'clear-1' });
      const session2 = createTestSession({ id: 'clear-2' });

      await storage.save(session1);
      await storage.save(session2);

      await storage.clear();

      const count = await storage.count();
      expect(count).toBe(0);
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      await expect(uninitStorage.clear()).rejects.toThrow();
    });
  });

  describe('count', () => {
    it('should return session count', async () => {
      const initialCount = await storage.count();

      const session = createTestSession();
      await storage.save(session);

      const newCount = await storage.count();
      expect(newCount).toBe(initialCount + 1);
    });

    it('should throw if not initialized', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
      };
      const uninitStorage = new SessionPersistenceStorage(config);

      await expect(uninitStorage.count()).rejects.toThrow();
    });
  });

  describe('close', () => {
    it('should close storage', async () => {
      await storage.close();
      expect(storage.isInitialized()).toBe(false);
    });

    it('should save pending changes on close', async () => {
      const config: SessionPersistenceStorageConfig = {
        storage: storageService,
        autoSave: true,
      };
      const autoSaveStorage = new SessionPersistenceStorage(config);
      await autoSaveStorage.initialize();

      const session = createTestSession();
      await autoSaveStorage.save(session);

      await autoSaveStorage.close();
    });
  });

  describe('SessionAdapter', () => {
    describe('toPersistence', () => {
      it('should convert plugin session to persistence session', () => {
        const pluginSession = {
          id: 'plugin-session',
          title: 'Plugin Session',
          status: { toString: () => 'active' },
          tags: ['plugin'],
          metadata: { plugin: true },
          contextWindow: {
            windowSize: 100,
            windowType: 'all_messages',
            includeSystemMessages: false,
            includeToolCalls: false,
          },
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          messageCount: 10,
        };

        const persistence = SessionAdapter.toPersistence(pluginSession);

        expect(persistence.id).toBe('plugin-session');
        expect(persistence.title).toBe('Plugin Session');
        expect(persistence.status).toBe('active');
        expect(persistence.tags).toEqual(['plugin']);
        expect(persistence.metadata).toEqual({ plugin: true });
      });
    });

    describe('toPlugin', () => {
      it('should convert persistence session to plugin format', () => {
        const persistenceSession: SessionPersistence = {
          id: 'persistence-session',
          title: 'Persistence Session',
          status: SessionPersistenceStatus.ACTIVE,
          tags: ['persistence'],
          metadata: { persistence: true },
          contextWindow: {
            windowSize: 75,
            windowType: 'recent',
            includeSystemMessages: true,
            includeToolCalls: false,
          },
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          messageCount: 5,
        };

        const plugin = SessionAdapter.toPlugin(persistenceSession);

        expect(plugin.id).toBe('persistence-session');
        expect(plugin.title).toBe('Persistence Session');
        expect(plugin.status.toString()).toBe('active');
        expect(plugin.tags).toEqual(['persistence']);
      });
    });
  });
});
