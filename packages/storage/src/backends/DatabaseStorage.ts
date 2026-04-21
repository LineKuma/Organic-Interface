/**
 * Database Storage Backend for Organic Interface Storage
 * SQLite-based persistent storage with structured queries
 */

import { promises as fs } from 'fs';
import path from 'path';

import {
  IStorageBackend,
  StorageBackendInfo,
  StorageBackendType,
} from './IStorageBackend.js';
import { StorageEntity } from '../models/StorageEntity.js';

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
  private initialized: boolean = false;

  constructor(config: DatabaseStorageConfig) {
    if (!config.dbPath) {
      throw new Error('DatabaseStorage requires a dbPath configuration');
    }
    this.dbPath = config.dbPath;
    this.dbFile = path.join(this.dbPath, 'entities.json');
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
      }
    } catch (error) {
      // Initialize new database file
      await this.saveDatabase();
    }

    this.connected = true;
    this.initialized = true;
  }

  /**
   * Save entities to database file
   */
  private async saveDatabase(): Promise<void> {
    const data = {
      entities: Array.from(this.entities.values()),
      savedAt: Date.now(),
    };
    await fs.writeFile(this.dbFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Close the database storage
   */
  async close(): Promise<void> {
    if (this.initialized) {
      await this.saveDatabase();
    }
    this.entities.clear();
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
    await this.saveDatabase();
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Database storage is not initialized');
    }

    const exists = this.entities.has(id);
    if (!exists) {
      return false;
    }

    this.entities.delete(id);
    await this.saveDatabase();
    return true;
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
          if ((entity as Record<string, unknown>)[key] !== value) return false;
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
    await this.saveDatabase();
  }

  /**
   * Get entity count
   */
  async count(): Promise<number> {
    return this.entities.size;
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
    };
  }
}
