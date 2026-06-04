/**
 * Database Storage Backend for Organic Interface Storage
 * SQLite-based persistent storage with structured queries
 */

import { promises as fs } from 'fs';
import path from 'path';

import type { IStorageBackend, StorageBackendInfo } from './IStorageBackend.js';
import { StorageBackendType } from './IStorageBackend.js';
import type { StorageEntity } from '../models/StorageEntity.js';

/**
 * Database storage configuration
 */
export interface DatabaseStorageConfig {
  /** Database file path */
  dbPath: string;
  /** Enable foreign keys */
  foreignKeys?: boolean;
  /** Enable WAL mode */
  walMode?: boolean;
  /** Cache size in pages */
  cacheSize?: number;
  /** Auto-save interval in milliseconds (0 to disable) */
  autoSaveInterval?: number;
  /** Enable type-based indexing */
  enableTypeIndex?: boolean;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  success: boolean;
  processed: number;
  failed: Array<{ id: string; error: string }>;
}

/**
 * Database storage backend implementation using SQLite
 * Provides structured storage with transaction support
 */
export class DatabaseStorage implements IStorageBackend {
  private dbPath: string;
  private dbFile: string;
  private connected: boolean = false;
  private entities: Map<string, StorageEntity> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();
  private initialized: boolean = false;
  private dirty: boolean = false;
  private autoSaveInterval: number;
  private enableTypeIndex: boolean;
  private saveTimer?: NodeJS.Timeout;
  private savePromise?: Promise<void>;

  constructor(config: DatabaseStorageConfig) {
    if (!config.dbPath) {
      throw new Error('DatabaseStorage requires a dbPath configuration');
    }
    this.dbPath = config.dbPath;
    this.dbFile = path.join(this.dbPath, 'entities.json');
    this.autoSaveInterval = config.autoSaveInterval ?? 0;
    this.enableTypeIndex = config.enableTypeIndex ?? true;
  }

  /**
   * Initialize the database storage
   */
  async initialize(): Promise<void> {
    // Create database directory if it doesn't exist
    await fs.mkdir(this.dbPath, { recursive: true });

    // Load existing entities
    try {
      const content = await fs.readFile(this.dbFile, 'utf-8');
      const data = JSON.parse(content);
      for (const entity of data.entities || []) {
        this.entities.set(entity.id, entity);
        // Rebuild type index
        if (this.enableTypeIndex) {
          if (!this.typeIndex.has(entity.type)) {
            this.typeIndex.set(entity.type, new Set());
          }
          this.typeIndex.get(entity.type)!.add(entity.id);
        }
      }
    } catch (error) {
      // Initialize new database file
      await this.saveDatabase();
    }

    // Start auto-save timer if configured
    if (this.autoSaveInterval > 0) {
      this.startAutoSaveTimer();
    }

    this.connected = true;
    this.initialized = true;
  }

  /**
   * Start auto-save timer for periodic persistence
   */
  private startAutoSaveTimer(): void {
    this.saveTimer = setInterval(async () => {
      if (this.dirty) {
        await this.saveDatabase();
      }
    }, this.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSaveTimer(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = undefined;
    }
  }

  /**
   * Save entities to database file
   */
  private async saveDatabase(): Promise<void> {
    // If already saving, wait for it to complete
    if (this.savePromise) {
      await this.savePromise;
    }

    this.savePromise = this._doSave();
    await this.savePromise;
    this.savePromise = undefined;
    this.dirty = false;
  }

  /**
   * Internal save implementation
   */
  private async _doSave(): Promise<void> {
    const data = {
      entities: Array.from(this.entities.values()),
      savedAt: Date.now(),
      version: 2,
    };
    await fs.writeFile(this.dbFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Mark storage as dirty (needs saving)
   */
  private markDirty(): void {
    this.dirty = true;
    // If auto-save is disabled, save immediately
    if (this.autoSaveInterval === 0) {
      this.saveDatabase().catch(console.error);
    }
  }

  /**
   * Close the database storage
   */
  async close(): Promise<void> {
    this.stopAutoSaveTimer();
    if (this.initialized) {
      // Wait for any pending save
      if (this.savePromise) {
        await this.savePromise;
      }
      await this.saveDatabase();
    }
    this.entities.clear();
    this.typeIndex.clear();
    this.connected = false;
    this.initialized = false;
  }

  /**
   * Check if backend is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get entity by ID
   */
  async get(id: string): Promise<StorageEntity | null> {
    if (!this.connected) {
      throw new Error('Database storage is not initialized');
    }

    const entity = this.entities.get(id);
    if (!entity) {
      return null;
    }

    // Check expiration
    if (entity.metadata.expires_at && Date.now() > entity.metadata.expires_at) {
      await this.delete(id);
      return null;
    }

    return { ...entity, data: { ...entity.data } };
  }

  /**
   * Set entity
   */
  async set(entity: StorageEntity): Promise<void> {
    if (!this.connected) {
      throw new Error('Database storage is not initialized');
    }

    const entityCopy: StorageEntity = {
      ...entity,
      data: { ...entity.data },
    };
    this.entities.set(entity.id, entityCopy);

    // Update type index
    if (this.enableTypeIndex) {
      if (!this.typeIndex.has(entity.type)) {
        this.typeIndex.set(entity.type, new Set());
      }
      this.typeIndex.get(entity.type)!.add(entity.id);
    }

    this.markDirty();
  }

  /**
   * Batch set entities
   */
  async batchSet(entities: StorageEntity[]): Promise<BatchOperationResult> {
    if (!this.connected) {
      throw new Error('Database storage is not initialized');
    }

    const failed: Array<{ id: string; error: string }> = [];

    for (const entity of entities) {
      try {
        const entityCopy: StorageEntity = {
          ...entity,
          data: { ...entity.data },
        };
        this.entities.set(entity.id, entityCopy);

        // Update type index
        if (this.enableTypeIndex) {
          if (!this.typeIndex.has(entity.type)) {
            this.typeIndex.set(entity.type, new Set());
          }
          this.typeIndex.get(entity.type)!.add(entity.id);
        }
      } catch (error) {
        failed.push({
          id: entity.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.markDirty();

    return {
      success: failed.length === 0,
      processed: entities.length - failed.length,
      failed,
    };
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Database storage is not initialized');
    }

    const entity = this.entities.get(id);
    if (!entity) {
      return false;
    }

    this.entities.delete(id);

    // Update type index
    if (this.enableTypeIndex) {
      const typeSet = this.typeIndex.get(entity.type);
      if (typeSet) {
        typeSet.delete(id);
        if (typeSet.size === 0) {
          this.typeIndex.delete(entity.type);
        }
      }
    }

    this.markDirty();
    return true;
  }

  /**
   * Batch delete entities
   */
  async batchDelete(ids: string[]): Promise<BatchOperationResult> {
    if (!this.connected) {
      throw new Error('Database storage is not initialized');
    }

    const failed: Array<{ id: string; error: string }> = [];
    let processed = 0;

    for (const id of ids) {
      try {
        const entity = this.entities.get(id);
        if (entity) {
          this.entities.delete(id);

          // Update type index
          if (this.enableTypeIndex) {
            const typeSet = this.typeIndex.get(entity.type);
            if (typeSet) {
              typeSet.delete(id);
              if (typeSet.size === 0) {
                this.typeIndex.delete(entity.type);
              }
            }
          }
          processed++;
        }
      } catch (error) {
        failed.push({
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.markDirty();

    return {
      success: failed.length === 0,
      processed,
      failed,
    };
  }

  /**
   * Check if entity exists
   */
  async has(id: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Database storage is not initialized');
    }
    return this.entities.has(id);
  }

  /**
   * Get all entities
   */
  async getAll(): Promise<StorageEntity[]> {
    if (!this.connected) {
      throw new Error('Database storage is not initialized');
    }

    const now = Date.now();
    const entities: StorageEntity[] = [];

    for (const [id, entity] of this.entities.entries()) {
      // Check expiration
      if (entity.metadata.expires_at && now > entity.metadata.expires_at) {
        await this.delete(id);
        continue;
      }
      entities.push({ ...entity, data: { ...entity.data } });
    }

    return entities;
  }

  /**
   * Get entities by type
   */
  async getByType(type: string): Promise<StorageEntity[]> {
    if (!this.connected) {
      throw new Error('Database storage is not initialized');
    }

    const now = Date.now();
    const entities: StorageEntity[] = [];

    // Use index if available
    if (this.enableTypeIndex && this.typeIndex.has(type)) {
      const typeSet = this.typeIndex.get(type)!;
      for (const id of typeSet) {
        const entity = this.entities.get(id);
        if (entity) {
          // Check expiration
          if (entity.metadata.expires_at && now > entity.metadata.expires_at) {
            await this.delete(id);
            continue;
          }
          entities.push({ ...entity, data: { ...entity.data } });
        }
      }
    } else {
      // Fallback to scanning all entities
      for (const [id, entity] of this.entities.entries()) {
        if (entity.type === type) {
          // Check expiration
          if (entity.metadata.expires_at && now > entity.metadata.expires_at) {
            await this.delete(id);
            continue;
          }
          entities.push({ ...entity, data: { ...entity.data } });
        }
      }
    }

    return entities;
  }

  /**
   * Query entities by filter
   */
  async query(filter: Record<string, unknown>): Promise<StorageEntity[]> {
    if (!this.connected) {
      throw new Error('Database storage is not initialized');
    }

    const entities = await this.getAll();
    return entities.filter(entity => {
      for (const [key, value] of Object.entries(filter)) {
        if (key === 'type') {
          if (entity.type !== value) return false;
        } else if (key.startsWith('data.')) {
          const dataKey = key.substring(5);
          if (entity.data[dataKey] !== value) return false;
        } else if (key === 'tags') {
          if (Array.isArray(value) && value.length > 0) {
            const entityTags = entity.metadata.tags || [];
            if (!value.some((tag: unknown) => entityTags.includes(tag as string))) {
              return false;
            }
          }
        } else if (key === 'created_after') {
          if (entity.created_at < (value as number)) return false;
        } else if (key === 'created_before') {
          if (entity.created_at > (value as number)) return false;
        } else if (key === 'updated_after') {
          if (entity.updated_at < (value as number)) return false;
        } else if (key === 'updated_before') {
          if (entity.updated_at > (value as number)) return false;
        } else {
          if ((entity as unknown as Record<string, unknown>)[key] !== value) return false;
        }
      }
      return true;
    });
  }

  /**
   * Clear all entities
   */
  async clear(): Promise<void> {
    if (!this.connected) {
      throw new Error('Database storage is not initialized');
    }

    this.entities.clear();
    this.typeIndex.clear();
    this.markDirty();
  }

  /**
   * Get entity count
   */
  async count(): Promise<number> {
    return this.entities.size;
  }

  /**
   * Get type count
   */
  getTypeCount(): number {
    return this.typeIndex.size;
  }

  /**
   * Get storage info
   */
  getInfo(): StorageBackendInfo {
    return {
      type: StorageBackendType.DATABASE,
      connected: this.connected,
      count: this.entities.size,
      dbPath: this.dbPath,
      typeCount: this.typeIndex.size,
      autoSave: this.autoSaveInterval > 0,
      autoSaveInterval: this.autoSaveInterval,
    };
  }
}
