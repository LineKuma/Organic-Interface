/**
 * SessionManager - Manages conversation sessions
 *
 * Provides session lifecycle management including creation, retrieval,
 * resumption, and cleanup of conversation sessions.
 */

import {
  type Session,
  type SessionConfig,
  SessionStatus,
  type SessionUpdates,
  type SessionFilter,
  type SessionCreateOptions,
  type ContextWindowConfig,
  ContextWindowType,
} from './types/index.js';
import { SessionError } from './errors/index.js';

/**
 * Default context window configuration
 */
const DEFAULT_CONTEXT_WINDOW: ContextWindowConfig = {
  windowSize: 50,
  windowType: ContextWindowType.RECENT_MESSAGES,
  includeSystemMessages: true,
  includeToolCalls: true,
};

/**
 * Session manager options
 */
export interface SessionManagerOptions {
  /** Maximum concurrent sessions */
  maxSessions?: number;
  /** Default TTL in milliseconds */
  defaultTtl?: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
  /** Session storage backend */
  storage?: SessionStorage;
}

/**
 * Session storage interface
 */
export interface SessionStorage {
  /** Save session */
  save(session: Session): Promise<void>;
  /** Load session */
  load(sessionId: string): Promise<Session | null>;
  /** Delete session */
  delete(sessionId: string): Promise<void>;
  /** List all sessions */
  list(): Promise<Session[]>;
}

/**
 * SessionManager - Manages conversation sessions
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private options: Required<SessionManagerOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  /**
   * Create a new SessionManager
   * @param options - Manager options
   */
  constructor(options: SessionManagerOptions = {}) {
    this.options = {
      maxSessions: options.maxSessions ?? 100,
      defaultTtl: options.defaultTtl ?? 30 * 60 * 1000, // 30 minutes
      cleanupInterval: options.cleanupInterval ?? 5 * 60 * 1000, // 5 minutes
      storage: options.storage ?? new InMemorySessionStorage(this.sessions),
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  // ==================== Public Methods ====================

  /**
   * Create a new session
   * @param options - Session creation options
   * @returns Created session
   */
  async createSession(options: SessionCreateOptions = {}): Promise<Session> {
    // Check max sessions limit
    if (this.sessions.size >= this.options.maxSessions) {
      throw SessionError.maxReached(this.options.maxSessions);
    }

    const sessionId = this.generateSessionId();
    const now = Date.now();

    // Merge config with defaults
    const config: SessionConfig = {
      title: options.config?.title ?? `Session ${sessionId.substring(0, 8)}`,
      tags: options.config?.tags ?? [],
      metadata: options.config?.metadata ?? {},
      contextWindow: options.config?.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
      autoSaveInterval: options.config?.autoSaveInterval,
      ttl: options.config?.ttl ?? this.options.defaultTtl,
    };

    const session: Session = {
      id: sessionId,
      title: config.title ?? `Session ${sessionId.substring(0, 8)}`,
      status: SessionStatus.ACTIVE,
      tags: config.tags ?? [],
      metadata: config.metadata ?? {},
      contextWindow: config.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: config.ttl ? now + config.ttl : undefined,
      messageCount: 0,
    };

    // Store session
    this.sessions.set(sessionId, session);

    // Track user sessions if userId provided
    if (options.userId) {
      this.trackUserSession(options.userId, sessionId);
    }

    // Persist if storage available
    await this.options.storage.save(session);

    return session;
  }

  /**
   * Get a session by ID
   * @param sessionId - Session identifier
   * @returns Session or null if not found
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      // Try to load from storage
      const stored = await this.options.storage.load(sessionId);
      if (stored) {
        this.sessions.set(sessionId, stored);
        return stored;
      }
      return null;
    }

    // Check if expired
    if (this.isExpired(session)) {
      await this.closeSession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Resume a session (get session and update last active time)
   * @param sessionId - Session identifier
   * @returns Resumed session or null if not found
   */
  async resumeSession(sessionId: string): Promise<Session | null> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    // Check if session is closable
    if (session.status === SessionStatus.CLOSED) {
      throw SessionError.closed(sessionId);
    }

    // Update last active time
    session.lastActiveAt = Date.now();

    // Extend TTL if applicable
    if (session.expiresAt && session.expiresAt < Date.now() + this.options.defaultTtl) {
      session.expiresAt = Date.now() + this.options.defaultTtl;
    }

    // Save updated session
    await this.options.storage.save(session);

    return session;
  }

  /**
   * Update a session
   * @param sessionId - Session identifier
   * @param updates - Session updates
   * @returns Updated session
   */
  async updateSession(sessionId: string, updates: SessionUpdates): Promise<Session> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw SessionError.notFound(sessionId);
    }

    // Apply updates
    if (updates.title !== undefined) session.title = updates.title;
    if (updates.tags !== undefined) session.tags = updates.tags;
    if (updates.metadata !== undefined) session.metadata = { ...session.metadata, ...updates.metadata };
    if (updates.status !== undefined) session.status = updates.status;
    if (updates.contextWindow !== undefined) session.contextWindow = updates.contextWindow;

    session.lastActiveAt = Date.now();

    // Save updates
    await this.options.storage.save(session);

    return session;
  }

  /**
   * Close a session
   * @param sessionId - Session identifier
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      // Try to load and delete from storage
      const stored = await this.options.storage.load(sessionId);
      if (stored) {
        stored.status = SessionStatus.CLOSED;
        await this.options.storage.save(stored);
      }
      return;
    }

    // Update status
    session.status = SessionStatus.CLOSED;
    session.lastActiveAt = Date.now();

    // Save updated status
    await this.options.storage.save(session);

    // Remove from active sessions
    this.sessions.delete(sessionId);
  }

  /**
   * List all sessions with optional filter
   * @param filter - Optional filter criteria
   * @returns List of sessions
   */
  async listSessions(filter?: SessionFilter): Promise<Session[]> {
    let sessions = await this.options.storage.list();

    // Apply filters
    if (filter) {
      sessions = sessions.filter((session) => this.matchesFilter(session, filter));
    }

    // Sort by last active time (newest first)
    sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);

    return sessions;
  }

  /**
   * Delete a session permanently
   * @param sessionId - Session identifier
   */
  async deleteSession(sessionId: string): Promise<void> {
    // Remove from active sessions
    this.sessions.delete(sessionId);

    // Remove from user session index
    for (const [userId, sessionIds] of this.userSessions) {
      sessionIds.delete(sessionId);
      if (sessionIds.size === 0) {
        this.userSessions.delete(userId);
      }
    }

    // Delete from storage
    await this.options.storage.delete(sessionId);
  }

  /**
   * Get sessions for a specific user
   * @param userId - User identifier
   * @returns List of user's sessions
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    const sessionIds = this.userSessions.get(userId);

    if (!sessionIds || sessionIds.size === 0) {
      return [];
    }

    const sessions: Session[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Increment message count for a session
   * @param sessionId - Session identifier
   */
  async incrementMessageCount(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageCount++;
      session.lastActiveAt = Date.now();
      await this.options.storage.save(session);
    }
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const expired: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (this.isExpired(session)) {
        expired.push(sessionId);
      }
    }

    for (const sessionId of expired) {
      await this.closeSession(sessionId);
    }
  }

  /**
   * Shutdown the session manager
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.sessions.clear();
    this.userSessions.clear();
  }

  // ==================== Private Methods ====================

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `sess_${timestamp}_${random}`;
  }

  /**
   * Check if a session is expired
   */
  private isExpired(session: Session): boolean {
    return session.expiresAt !== undefined && session.expiresAt < Date.now();
  }

  /**
   * Track session for a user
   */
  private trackUserSession(userId: string, sessionId: string): void {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);
  }

  /**
   * Check if session matches filter
   */
  private matchesFilter(session: Session, filter: SessionFilter): boolean {
    // Status filter
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (!statuses.includes(session.status)) {
        return false;
      }
    }

    // Tags filter
    if (filter.tags && filter.tags.length > 0) {
      if (!filter.tags.some((tag) => session.tags.includes(tag))) {
        return false;
      }
    }

    // Project filter
    if (filter.projectId && session.projectId !== filter.projectId) {
      return false;
    }

    // Time range filters
    if (filter.createdAfter && session.createdAt < filter.createdAfter) {
      return false;
    }
    if (filter.createdBefore && session.createdAt > filter.createdBefore) {
      return false;
    }

    // Keyword filter
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      const searchable = `${session.title} ${session.tags.join(' ')}`.toLowerCase();
      if (!searchable.includes(keyword)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Start cleanup timer for expired sessions
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions().catch(console.error);
    }, this.options.cleanupInterval);
  }
}

/**
 * In-memory session storage implementation
 */
class InMemorySessionStorage implements SessionStorage {
  private sessions: Map<string, Session>;

  constructor(sessions: Map<string, Session>) {
    this.sessions = sessions;
  }

  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async load(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async list(): Promise<Session[]> {
    return Array.from(this.sessions.values()).map((s) => ({ ...s }));
  }
}