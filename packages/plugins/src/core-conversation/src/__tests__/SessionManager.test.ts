/**
 * SessionManager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager, type SessionStorage, type Session } from '../SessionManager.js';
import { SessionStatus } from '../types/session.js';

// Mock session storage for testing
class MockSessionStorage implements SessionStorage {
  private sessions: Map<string, Session> = new Map();

  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async load(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async list(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  clear(): void {
    this.sessions.clear();
  }
}

describe('SessionManager', () => {
  let manager: SessionManager;
  let mockStorage: MockSessionStorage;

  beforeEach(() => {
    mockStorage = new MockSessionStorage();
    manager = new SessionManager({
      storage: mockStorage,
      maxSessions: 10,
      defaultTtl: 60000,
      cleanupInterval: 300000,
    });
  });

  afterEach(() => {
    manager.shutdown();
    mockStorage.clear();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const session = await manager.createSession();

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.messageCount).toBe(0);
    });

    it('should create session with custom config', async () => {
      const session = await manager.createSession({
        config: {
          title: 'My Session',
          tags: ['important'],
          ttl: 120000,
        },
      });

      expect(session.title).toBe('My Session');
      expect(session.tags).toContain('important');
    });

    it('should track user sessions', async () => {
      await manager.createSession({ userId: 'user-1' });
      await manager.createSession({ userId: 'user-1' });
      await manager.createSession({ userId: 'user-2' });

      const user1Sessions = await manager.getUserSessions('user-1');
      expect(user1Sessions.length).toBe(2);
    });

    it('should enforce max sessions limit', async () => {
      const smallManager = new SessionManager({
        storage: mockStorage,
        maxSessions: 2,
        defaultTtl: 60000,
      });

      await smallManager.createSession();
      await smallManager.createSession();

      await expect(smallManager.createSession()).rejects.toThrow();
      smallManager.shutdown();
    });
  });

  describe('getSession', () => {
    it('should get existing session', async () => {
      const created = await manager.createSession();
      const session = await manager.getSession(created.id);

      expect(session).toBeDefined();
      expect(session?.id).toBe(created.id);
    });

    it('should return null for non-existent session', async () => {
      const session = await manager.getSession('non-existent');
      expect(session).toBeNull();
    });

    it('should load session from storage', async () => {
      const created = await manager.createSession();
      mockStorage.sessions.set(created.id, { ...created });

      // Create new manager with same storage
      const newManager = new SessionManager({
        storage: mockStorage,
        maxSessions: 10,
        defaultTtl: 60000,
      });

      const session = await newManager.getSession(created.id);
      expect(session).toBeDefined();
      expect(session?.id).toBe(created.id);

      newManager.shutdown();
    });
  });

  describe('resumeSession', () => {
    it('should resume existing session', async () => {
      const created = await manager.createSession();
      const resumed = await manager.resumeSession(created.id);

      expect(resumed).toBeDefined();
      expect(resumed?.id).toBe(created.id);
    });

    it('should update last active time', async () => {
      const created = await manager.createSession();
      const originalTime = created.lastActiveAt;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const resumed = await manager.resumeSession(created.id);
      expect(resumed!.lastActiveAt).toBeGreaterThanOrEqual(originalTime);
    });

    it('should throw for closed session', async () => {
      const created = await manager.createSession();
      await manager.closeSession(created.id);

      await expect(manager.resumeSession(created.id)).rejects.toThrow();
    });
  });

  describe('updateSession', () => {
    it('should update session title', async () => {
      const created = await manager.createSession();
      const updated = await manager.updateSession(created.id, {
        title: 'Updated Title',
      });

      expect(updated.title).toBe('Updated Title');
    });

    it('should update session tags', async () => {
      const created = await manager.createSession();
      const updated = await manager.updateSession(created.id, {
        tags: ['tag1', 'tag2'],
      });

      expect(updated.tags).toEqual(['tag1', 'tag2']);
    });

    it('should update session metadata', async () => {
      const created = await manager.createSession();
      const updated = await manager.updateSession(created.id, {
        metadata: { key: 'value' },
      });

      expect(updated.metadata.key).toBe('value');
    });

    it('should throw for non-existent session', async () => {
      await expect(manager.updateSession('non-existent', { title: 'Test' })).rejects.toThrow();
    });
  });

  describe('closeSession', () => {
    it('should close session', async () => {
      const created = await manager.createSession();
      await manager.closeSession(created.id);

      const session = await manager.getSession(created.id);
      expect(session?.status).toBe(SessionStatus.CLOSED);
    });

    it('should remove from active sessions', async () => {
      const created = await manager.createSession();
      expect(manager.getActiveCount()).toBe(1);

      await manager.closeSession(created.id);
      expect(manager.getActiveCount()).toBe(0);
    });
  });

  describe('deleteSession', () => {
    it('should delete session', async () => {
      const created = await manager.createSession();
      await manager.deleteSession(created.id);

      const session = await manager.getSession(created.id);
      expect(session).toBeNull();
    });

    it('should remove from user sessions', async () => {
      const created = await manager.createSession({ userId: 'user-1' });
      await manager.deleteSession(created.id);

      const sessions = await manager.getUserSessions('user-1');
      expect(sessions.length).toBe(0);
    });
  });

  describe('listSessions', () => {
    it('should list all sessions', async () => {
      await manager.createSession();
      await manager.createSession();
      await manager.createSession();

      const sessions = await manager.listSessions();
      expect(sessions.length).toBe(3);
    });

    it('should filter by status', async () => {
      const session1 = await manager.createSession();
      await manager.createSession();
      await manager.closeSession(session1.id);

      const activeSessions = await manager.listSessions({
        status: SessionStatus.ACTIVE,
      });
      expect(activeSessions.length).toBe(1);
    });

    it('should filter by tags', async () => {
      await manager.createSession({ config: { tags: ['important'] } });
      await manager.createSession({ config: { tags: ['normal'] } });

      const taggedSessions = await manager.listSessions({
        tags: ['important'],
      });
      expect(taggedSessions.length).toBe(1);
    });

    it('should filter by keyword', async () => {
      await manager.createSession({ config: { title: 'Search Me' } });
      await manager.createSession({ config: { title: 'No Match' } });

      const matched = await manager.listSessions({ keyword: 'search' });
      expect(matched.length).toBe(1);
    });

    it('should sort by last active time', async () => {
      await manager.createSession();
      await new Promise(resolve => setTimeout(resolve, 10));
      await manager.createSession();

      const sessions = await manager.listSessions();
      expect(sessions[0].lastActiveAt).toBeGreaterThanOrEqual(sessions[1].lastActiveAt);
    });
  });

  describe('incrementMessageCount', () => {
    it('should increment message count', async () => {
      const created = await manager.createSession();
      expect(created.messageCount).toBe(0);

      await manager.incrementMessageCount(created.id);
      await manager.incrementMessageCount(created.id);

      const session = await manager.getSession(created.id);
      expect(session?.messageCount).toBe(2);
    });
  });

  describe('getActiveCount', () => {
    it('should return active session count', async () => {
      expect(manager.getActiveCount()).toBe(0);

      await manager.createSession();
      await manager.createSession();
      await manager.createSession();

      expect(manager.getActiveCount()).toBe(3);

      const session = await manager.createSession();
      await manager.closeSession(session.id);

      expect(manager.getActiveCount()).toBe(3);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions', async () => {
      // Create a session with very short TTL
      const session = await manager.createSession({
        config: {
          ttl: 50, // 50ms TTL
        },
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      await manager.cleanupExpiredSessions();

      const retrieved = await manager.getSession(session.id);
      // Session should be closed (status = closed, not null from getSession)
      expect(retrieved?.status).toBe(SessionStatus.CLOSED);
    });
  });

  describe('shutdown', () => {
    it('should clear all sessions on shutdown', async () => {
      await manager.createSession();
      await manager.createSession();

      expect(manager.getActiveCount()).toBe(2);

      manager.shutdown();

      expect(manager.getActiveCount()).toBe(0);
    });
  });

  describe('with persistence storage', () => {
    it('should persist sessions across manager instances', async () => {
      // Create session with first manager
      const session1 = await manager.createSession({ userId: 'persist-user' });
      await manager.incrementMessageCount(session1.id);
      await manager.incrementMessageCount(session1.id);

      // Create second manager with same storage
      const manager2 = new SessionManager({
        storage: mockStorage,
        maxSessions: 10,
        defaultTtl: 60000,
      });

      // Session should be available from storage
      const session2 = await manager2.getSession(session1.id);
      expect(session2).toBeDefined();
      expect(session2?.messageCount).toBe(2);

      // User sessions are tracked in memory, not persisted
      // So a new manager won't know about user sessions
      // This is expected behavior for the current implementation
      const userSessions = await manager2.getUserSessions('persist-user');
      expect(userSessions.length).toBe(0);

      manager2.shutdown();
    });
  });
});
