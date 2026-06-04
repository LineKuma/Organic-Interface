/**
 * Session Persistence Storage Implementation
 *
 * Provides persistent storage for session data using the StorageService backend.
 * Enables sessions to survive application restarts.
 */

import type { StorageService } from './StorageService.js';

/**
 * Session status enum
 */
export enum SessionPersistenceStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

/**
 * Context window configuration
 */
export interface SessionPersistenceContextWindow {
  windowSize: number;
  windowType: string;
  includeSystemMessages: boolean;
  includeToolCalls: boolean;
  maxTokens?: number;
}

/**
 * Session persistence interface (storage-agnostic representation)
 */
export interface SessionPersistence {
  /** Unique session identifier */
  id: string;
  /** Session title */
  title: string;
  /** Current session status */
  status: SessionPersistenceStatus;
  /** Session tags */
  tags: string[];
  /** Session metadata */
  metadata: Record<string, unknown>;
  /** Context window configuration */
  contextWindow: SessionPersistenceContextWindow;
  /** Creation timestamp */
  createdAt: number;
  /** Last activity timestamp */
  lastActiveAt: number;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Message count */
  messageCount: number;
  /** Associated project ID */
  projectId?: string;
}

/**
 * Session entity type for storage
 */
const SESSION_ENTITY_TYPE = 'session';

/**
 * Session persistence storage configuration
 */
export interface SessionPersistenceStorageConfig {
  /** Storage service instance */
  storage: StorageService;
  /** Auto-save on changes (default: true) */
  autoSave?: boolean;
  /** TTL for session entities in milliseconds (default: 24 hours) */
  entityTtl?: number;
}

/**
 * Session persistence storage implementation
 *
 * Wraps a StorageService to provide session persistence capabilities.
 * Sessions are stored as entities with type 'session'.
 */
export class SessionPersistenceStorage {
  private storage: StorageService;
  private autoSave: boolean;
  private entityTtl: number;
  private cache: Map<string, SessionPersistence> = new Map();
  private initialized: boolean = false;

  /**
   * Create a new session persistence storage
   */
  constructor(config: SessionPersistenceStorageConfig) {
    this.storage = config.storage;
    this.autoSave = config.autoSave ?? true;
    this.entityTtl = config.entityTtl ?? 24 * 60 * 60 * 1000; // 24 hours default
  }

  /**
   * Initialize the storage
   */
  async initialize(): Promise<void> {
    // Initialize storage service if not already done
    await this.storage.initialize();

    // Load all existing sessions from storage into cache
    const sessions = await this.storage.findByType(SESSION_ENTITY_TYPE);
    for (const entity of sessions) {
      const session = this.entityToSession(entity);
      if (session) {
        this.cache.set(session.id, session);
      }
    }

    this.initialized = true;
  }

  /**
   * Save a session to storage
   */
  async save(session: SessionPersistence): Promise<void> {
    if (!this.initialized) {
      throw new Error('SessionPersistenceStorage is not initialized');
    }

    // Update cache
    this.cache.set(session.id, { ...session });

    // Save to storage if auto-save is enabled
    if (this.autoSave) {
      const entity = this.sessionToEntity(session);

      // Check if session exists first
      const existing = await this.storage.read(session.id);
      if (existing) {
        await this.storage.update(session.id, entity.data as Record<string, unknown>);
      } else {
        const result = await this.storage.create(
          SESSION_ENTITY_TYPE,
          entity.data as Record<string, unknown>,
          {
            id: session.id,
            metadata: entity.metadata,
          }
        );

        // If create failed due to duplicate, update instead
        if (!result.success && result.error?.includes('already exists')) {
          await this.storage.update(session.id, entity.data as Record<string, unknown>);
        }
      }
    }
  }

  /**
   * Load a session from storage
   */
  async load(sessionId: string): Promise<SessionPersistence | null> {
    if (!this.initialized) {
      throw new Error('SessionPersistenceStorage is not initialized');
    }

    // Check cache first
    const cached = this.cache.get(sessionId);
    if (cached) {
      // Check if session is still valid
      if (this.isSessionValid(cached)) {
        return { ...cached };
      } else {
        // Session has expired, remove from cache
        this.cache.delete(sessionId);
        return null;
      }
    }

    // Load from storage
    const entity = await this.storage.read(sessionId);
    if (!entity || entity.type !== SESSION_ENTITY_TYPE) {
      return null;
    }

    const session = this.entityToSession(entity);
    if (session && this.isSessionValid(session)) {
      this.cache.set(session.id, session);
      return { ...session };
    }

    return null;
  }

  /**
   * Delete a session from storage
   */
  async delete(sessionId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('SessionPersistenceStorage is not initialized');
    }

    // Remove from cache
    this.cache.delete(sessionId);

    // Delete from storage
    await this.storage.delete(sessionId);
  }

  /**
   * List all sessions from storage
   */
  async list(): Promise<SessionPersistence[]> {
    if (!this.initialized) {
      throw new Error('SessionPersistenceStorage is not initialized');
    }

    // Get all session entities from storage
    const entities = await this.storage.findByType(SESSION_ENTITY_TYPE);
    const sessions: SessionPersistence[] = [];

    for (const entity of entities) {
      const session = this.entityToSession(entity);
      if (session && this.isSessionValid(session)) {
        sessions.push(session);
        this.cache.set(session.id, session);
      } else if (session) {
        // Session is expired, clean it up
        await this.storage.delete(session.id);
      }
    }

    return sessions;
  }

  /**
   * Clear all sessions from storage
   */
  async clear(): Promise<void> {
    if (!this.initialized) {
      throw new Error('SessionPersistenceStorage is not initialized');
    }

    // Clear cache
    this.cache.clear();

    // Get all session IDs and delete them
    const entities = await this.storage.findByType(SESSION_ENTITY_TYPE);
    const ids = entities.map(e => e.id);

    for (const id of ids) {
      await this.storage.delete(id);
    }
  }

  /**
   * Get session count
   */
  async count(): Promise<number> {
    if (!this.initialized) {
      throw new Error('SessionPersistenceStorage is not initialized');
    }

    const entities = await this.storage.findByType(SESSION_ENTITY_TYPE);
    return entities.length;
  }

  /**
   * Close the storage
   */
  async close(): Promise<void> {
    // Save any pending changes
    if (this.autoSave) {
      for (const session of this.cache.values()) {
        const entity = this.sessionToEntity(session);
        await this.storage.update(session.id, entity.data as Record<string, unknown>);
      }
    }

    this.cache.clear();
    await this.storage.close();
    this.initialized = false;
  }

  /**
   * Check if storage is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // Private helper methods

  /**
   * Convert a session to a storage entity
   */
  private sessionToEntity(session: SessionPersistence): {
    data: Record<string, unknown>;
    metadata: {
      tags: string[];
      expires_at?: number;
    };
  } {
    return {
      data: {
        id: session.id,
        title: session.title,
        status: session.status,
        tags: session.tags,
        metadata: session.metadata,
        contextWindow: session.contextWindow,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt,
        messageCount: session.messageCount,
        projectId: session.projectId,
      },
      metadata: {
        tags: [SESSION_ENTITY_TYPE, ...session.tags],
        expires_at: this.calculateExpiresAt(session),
      },
    };
  }

  /**
   * Convert a storage entity to a session
   */
  private entityToSession(entity: {
    id: string;
    data: Record<string, unknown>;
    metadata: { tags?: string[]; expires_at?: number };
  }): SessionPersistence | null {
    try {
      const data = entity.data;
      return {
        id: entity.id,
        title: (data.title as string) || `Session ${entity.id.substring(0, 8)}`,
        status: (data.status as SessionPersistenceStatus) || SessionPersistenceStatus.ACTIVE,
        tags: (data.tags as string[]) || [],
        metadata: (data.metadata as Record<string, unknown>) || {},
        contextWindow: (data.contextWindow as SessionPersistenceContextWindow) || {
          windowSize: 50,
          windowType: 'recent_messages',
          includeSystemMessages: true,
          includeToolCalls: true,
        },
        createdAt: (data.createdAt as number) || Date.now(),
        lastActiveAt: (data.lastActiveAt as number) || Date.now(),
        expiresAt: data.expiresAt as number | undefined,
        messageCount: (data.messageCount as number) || 0,
        projectId: data.projectId as string | undefined,
      };
    } catch {
      // Invalid entity data
      return null;
    }
  }

  /**
   * Check if a session is still valid
   */
  private isSessionValid(session: SessionPersistence): boolean {
    // Check explicit expiration
    if (session.expiresAt && session.expiresAt < Date.now()) {
      return false;
    }

    // Check if session is closed
    if (
      session.status === SessionPersistenceStatus.CLOSED ||
      session.status === SessionPersistenceStatus.ARCHIVED
    ) {
      return false;
    }

    return true;
  }

  /**
   * Calculate expiration time for session entity
   */
  private calculateExpiresAt(session: SessionPersistence): number | undefined {
    // If session has explicit expiration, use that
    if (session.expiresAt) {
      return session.expiresAt;
    }

    // Otherwise, calculate based on last activity
    return session.lastActiveAt + this.entityTtl;
  }
}

/**
 * Create a session persistence storage with database backend
 */
export async function createSessionPersistenceStorage(
  dbPath: string,
  options?: {
    autoSave?: boolean;
    entityTtl?: number;
  }
): Promise<SessionPersistenceStorage> {
  const { DatabaseStorage } = await import('../backends/index.js');
  const { StorageService } = await import('./StorageService.js');
  const { createLogger } = await import('@organic/utils');

  const backend = new DatabaseStorage({
    dbPath,
    enableTypeIndex: true,
    autoSaveInterval: 5000,
  });

  const storage = new StorageService(backend, createLogger({ prefix: 'SessionStorage' }));

  const persistence = new SessionPersistenceStorage({
    storage,
    autoSave: options?.autoSave ?? true,
    entityTtl: options?.entityTtl ?? 24 * 60 * 60 * 1000,
  });

  await persistence.initialize();

  return persistence;
}

/**
 * Adapter to convert between plugin Session type and persistence Session type
 */
export class SessionAdapter {
  /**
   * Convert plugin session to persistence session
   */
  static toPersistence(session: {
    id: string;
    title: string;
    status: { toString(): string };
    tags: string[];
    metadata: Record<string, unknown>;
    contextWindow: SessionPersistenceContextWindow;
    createdAt: number;
    lastActiveAt: number;
    expiresAt?: number;
    messageCount: number;
    projectId?: string;
  }): SessionPersistence {
    return {
      id: session.id,
      title: session.title,
      status: session.status.toString() as SessionPersistenceStatus,
      tags: session.tags,
      metadata: session.metadata,
      contextWindow: session.contextWindow,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt,
      messageCount: session.messageCount,
      projectId: session.projectId,
    };
  }

  /**
   * Convert persistence session to plugin session format
   */
  static toPlugin(session: SessionPersistence): {
    id: string;
    title: string;
    status: { toString(): string };
    tags: string[];
    metadata: Record<string, unknown>;
    contextWindow: SessionPersistenceContextWindow;
    createdAt: number;
    lastActiveAt: number;
    expiresAt?: number;
    messageCount: number;
    projectId?: string;
  } {
    return {
      id: session.id,
      title: session.title,
      status: { toString: () => session.status } as any,
      tags: session.tags,
      metadata: session.metadata,
      contextWindow: session.contextWindow,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt,
      messageCount: session.messageCount,
      projectId: session.projectId,
    };
  }
}
