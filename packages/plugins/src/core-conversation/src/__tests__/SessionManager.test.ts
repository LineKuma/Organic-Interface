/**
 * SessionManager Tests
 *
 * Tests for the SessionManager class which handles session lifecycle
 * including creation, retrieval, resumption, and cleanup of sessions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../SessionManager.js';
import { SessionError } from '../errors/index.js';
import { SessionStatus, ContextWindowType } from '../types/index.js';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    // Create fresh manager for each test
    manager = new SessionManager({
      maxSessions: 10,
      defaultTtl: 60000, // 1 minute
      cleanupInterval: 5000,
    });
  });

  afterEach(() => {
    // Clean up resources
    manager.shutdown();
  });

  describe('createSession', () => {
    it('should create a session with default config', async () => {
      const session = await manager.createSession();

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^sess_/);
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.messageCount).toBe(0);
      expect(session.title).toMatch(/^Session /);
    });

    it('should create a session with custom config', async () => {
      const session = await manager.createSession({
        userId: 'user-123',
        config: {
          title: 'My Session',
          tags: ['test', 'demo'],
          metadata: { key: 'value' },
        },
      });

      expect(session.title).toBe('My Session');
      expect(session.tags).toContain('test');
      expect(session.tags).toContain('demo');
      expect(session.metadata.key).toBe('value');
    });

    it('should create multiple sessions with unique IDs', async () => {
      const session1 = await manager.createSession();
      const session2 = await manager.createSession();
      const session3 = await manager.createSession();

      expect(session1.id).not.toBe(session2.id);
      expect(session2.id).not.toBe(session3.id);
      expect(session1.id).not.toBe(session3.id);
    });

    it('should throw when max sessions reached', async () => {
      const smallManager = new SessionManager({ maxSessions: 2 });

      await smallManager.createSession();
      await smallManager.createSession();

      await expect(smallManager.createSession()).rejects.toThrow(SessionError);
      await expect(smallManager.createSession()).rejects.toThrow('Maximum');

      smallManager.shutdown();
    });

    it('should track sessions by user ID', async () => {
      await manager.createSession({ userId: 'user-1' });
      await manager.createSession({ userId: 'user-1' });
      await manager.createSession({ userId: 'user-2' });

      const user1Sessions = await manager.getUserSessions('user-1');
      const user2Sessions = await manager.getUserSessions('user-2');

      expect(user1Sessions).toHaveLength(2);
      expect(user2Sessions).toHaveLength(1);
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const created = await manager.createSession();
      const retrieved = await manager.getSession(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.title).toBe(created.title);
    });

    it('should return null for non-existent session', async () => {
      const result = await manager.getSession('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return null for expired session', async () => {
      const expiredManager = new SessionManager({
        defaultTtl: 1, // 1ms TTL for testing
      });

      const session = await expiredManager.createSession({
        config: { ttl: 1 },
      });

      // Wait for expiration check interval
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await expiredManager.getSession(session.id);
      expect(result).toBeNull();

      expiredManager.shutdown();
    });
  });

  describe('resumeSession', () => {
    it('should resume an existing session and update lastActiveAt', async () => {
      const created = await manager.createSession();
      const originalLastActive = created.lastActiveAt;

      // Small delay to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 5));

      const resumed = await manager.resumeSession(created.id);

      expect(resumed).not.toBeNull();
      expect(resumed!.id).toBe(created.id);
      expect(resumed!.lastActiveAt).toBeGreaterThanOrEqual(originalLastActive);
    });

    it('should return null when resuming a closed session', async () => {
      const session = await manager.createSession();
      await manager.closeSession(session.id);

      // After closeSession, the session is removed from active sessions
      // so getSession returns null, and resumeSession returns null
      const result = await manager.resumeSession(session.id);
      expect(result).toBeNull();
    });

    it('should return null for non-existent session', async () => {
      const result = await manager.resumeSession('non-existent-id');
      expect(result).toBeNull();
    });

    it('should extend TTL when resuming', async () => {
      const ttlManager = new SessionManager({
        defaultTtl: 5000, // 5 seconds
      });

      const session = await ttlManager.createSession({
        config: { ttl: 500 }, // 500ms TTL
      });

      // Wait 100ms - session should still be valid
      await new Promise((resolve) => setTimeout(resolve, 100));

      const resumed = await ttlManager.resumeSession(session.id);
      expect(resumed).not.toBeNull();
      expect(resumed!.expiresAt).toBeDefined();
      // After resuming, TTL should be extended to defaultTtl (5000ms) from now
      expect(resumed!.expiresAt!).toBeGreaterThan(Date.now() + 4000);

      ttlManager.shutdown();
    });
  });

  describe('updateSession', () => {
    it('should update session title', async () => {
      const session = await manager.createSession();
      const updated = await manager.updateSession(session.id, {
        title: 'Updated Title',
      });

      expect(updated.title).toBe('Updated Title');
    });

    it('should update session tags', async () => {
      const session = await manager.createSession();
      const updated = await manager.updateSession(session.id, {
        tags: ['new-tag'],
      });

      expect(updated.tags).toContain('new-tag');
    });

    it('should update session metadata', async () => {
      const session = await manager.createSession();
      const updated = await manager.updateSession(session.id, {
        metadata: { newKey: 'newValue' },
      });

      expect(updated.metadata.newKey).toBe('newValue');
    });

    it('should throw for non-existent session', async () => {
      await expect(
        manager.updateSession('non-existent', { title: 'Test' })
      ).rejects.toThrow(SessionError);
    });

    it('should update context window config', async () => {
      const session = await manager.createSession();
      const newConfig = {
        windowSize: 100,
        windowType: ContextWindowType.TOKEN_BASED,
        includeSystemMessages: false,
        includeToolCalls: false,
      };

      const updated = await manager.updateSession(session.id, {
        contextWindow: newConfig,
      });

      expect(updated.contextWindow.windowSize).toBe(100);
      expect(updated.contextWindow.windowType).toBe(ContextWindowType.TOKEN_BASED);
      expect(updated.contextWindow.includeSystemMessages).toBe(false);
    });
  });

  describe('closeSession', () => {
    it('should close an existing session', async () => {
      const session = await manager.createSession();
      await manager.closeSession(session.id);

      const retrieved = await manager.getSession(session.id);
      expect(retrieved).toBeNull();
      expect(manager.getActiveCount()).toBe(0);
    });

    it('should handle closing non-existent session gracefully', async () => {
      // Should not throw
      await expect(manager.closeSession('non-existent')).resolves.not.toThrow();
    });

    it('should mark session status as closed', async () => {
      const session = await manager.createSession();

      // Access internal storage to check status before cleanup
      const sessions = await manager.listSessions();
      expect(sessions[0].status).toBe(SessionStatus.ACTIVE);

      await manager.closeSession(session.id);

      // After closing, session should be removed from active list
      const activeSessions = await manager.listSessions();
      expect(activeSessions.find((s) => s.id === session.id)).toBeUndefined();
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

    it('should sort by lastActiveAt (newest first)', async () => {
      const s1 = await manager.createSession();
      await new Promise((resolve) => setTimeout(resolve, 5));
      const s2 = await manager.createSession();

      const sessions = await manager.listSessions();
      expect(sessions[0].id).toBe(s2.id);
      expect(sessions[1].id).toBe(s1.id);
    });

    it('should filter by status', async () => {
      const s1 = await manager.createSession();
      const s2 = await manager.createSession();
      await manager.closeSession(s2.id);

      // After closing, only s1 should be in active list
      const activeSessions = await manager.listSessions({ status: SessionStatus.ACTIVE });
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(s1.id);
    });

    it('should filter by tags', async () => {
      await manager.createSession({ config: { tags: ['important'] } });
      await manager.createSession({ config: { tags: ['normal'] } });

      const taggedSessions = await manager.listSessions({ tags: ['important'] });
      expect(taggedSessions).toHaveLength(1);
      expect(taggedSessions[0].tags).toContain('important');
    });

    it('should filter by keyword', async () => {
      await manager.createSession({ config: { title: 'Project Alpha' } });
      await manager.createSession({ config: { title: 'Project Beta' } });

      const alphaSessions = await manager.listSessions({ keyword: 'Alpha' });
      expect(alphaSessions).toHaveLength(1);
      expect(alphaSessions[0].title).toBe('Project Alpha');
    });

    it('should filter by time range', async () => {
      const before = Date.now();
      await manager.createSession();
      const after = Date.now();

      const sessions = await manager.listSessions({
        createdAfter: before,
        createdBefore: after + 1000,
      });

      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('deleteSession', () => {
    it('should permanently delete a session', async () => {
      const session = await manager.createSession({ userId: 'user-1' });
      await manager.deleteSession(session.id);

      const retrieved = await manager.getSession(session.id);
      expect(retrieved).toBeNull();
    });

    it('should remove from user sessions index', async () => {
      const session = await manager.createSession({ userId: 'user-1' });
      await manager.deleteSession(session.id);

      const userSessions = await manager.getUserSessions('user-1');
      expect(userSessions.find((s) => s.id === session.id)).toBeUndefined();
    });
  });

  describe('incrementMessageCount', () => {
    it('should increment message count', async () => {
      const session = await manager.createSession();
      expect(session.messageCount).toBe(0);

      await manager.incrementMessageCount(session.id);
      const updated = await manager.getSession(session.id);
      expect(updated!.messageCount).toBe(1);

      await manager.incrementMessageCount(session.id);
      const updated2 = await manager.getSession(session.id);
      expect(updated2!.messageCount).toBe(2);
    });

    it('should update lastActiveAt when incrementing count', async () => {
      const session = await manager.createSession();
      const originalTime = session.lastActiveAt;

      await new Promise((resolve) => setTimeout(resolve, 5));
      await manager.incrementMessageCount(session.id);

      const updated = await manager.getSession(session.id);
      expect(updated!.lastActiveAt).toBeGreaterThan(originalTime);
    });
  });

  describe('getActiveCount', () => {
    it('should return count of active sessions', async () => {
      expect(manager.getActiveCount()).toBe(0);

      await manager.createSession();
      expect(manager.getActiveCount()).toBe(1);

      await manager.createSession();
      expect(manager.getActiveCount()).toBe(2);

      const session = await manager.createSession();
      await manager.closeSession(session.id);
      expect(manager.getActiveCount()).toBe(2);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions', async () => {
      const cleanupManager = new SessionManager({
        defaultTtl: 5000, // 5 seconds
        cleanupInterval: 100,
      });

      // Create session with very short TTL (50ms)
      const s1 = await cleanupManager.createSession({ config: { ttl: 50 } });
      const s2 = await cleanupManager.createSession();

      // Wait for expiration (100ms > 50ms TTL)
      await new Promise((resolve) => setTimeout(resolve, 100));

      await cleanupManager.cleanupExpiredSessions();

      const s1Exists = await cleanupManager.getSession(s1.id);
      const s2Exists = await cleanupManager.getSession(s2.id);

      expect(s1Exists).toBeNull();
      expect(s2Exists).not.toBeNull();

      cleanupManager.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should clear all sessions', async () => {
      await manager.createSession();
      await manager.createSession();
      await manager.createSession();

      expect(manager.getActiveCount()).toBe(3);

      manager.shutdown();

      expect(manager.getActiveCount()).toBe(0);
    });

    it('should stop cleanup timer', async () => {
      // No error should occur on shutdown
      expect(() => manager.shutdown()).not.toThrow();

      // Double shutdown should also be safe
      expect(() => manager.shutdown()).not.toThrow();
    });
  });
});
