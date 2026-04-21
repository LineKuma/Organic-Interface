/**
 * Memory Storage Backend for Organic Interface Storage
 * In-memory storage implementation for temporary data and caching
 */

import {
  IStorageBackend,
  StorageBackendInfo,
  StorageBackendType,
} from './IStorageBackend.js';
import { StorageEntity } from '../models/StorageEntity.js';

/**
 * Memory storage configuration
 */
export interface MemoryStorageConfig {
  /** Initial capacity */
  initialCapacity?: number;
  /** Enable expiration check on read */
  checkExpiration?: boolean;
}

/**
 * Memory storage backend implementation
 * High-speed in-memory storage, data is lost on shutdown
 */
export class MemoryStorage implements IStorageBackend {
  private store: Map<string, StorageEntity> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();
  private connected: boolean = false;
  private config: MemoryStorageConfig;

  constructor(config: MemoryStorageConfig = {}) {
    this.config = {
      initialCapacity: config.initialCapacity || 1000,
      checkExpiration: config.checkExpiration ?? true,
    };
  }

  /**
   * Initialize the memory storage
   */
  async initialize(): Promise<void> {
    this.store = new Map();
    this.typeIndex = new Map();
    this.connected = true;
  }

  /**
   * Close the memory storage
   */
  async close(): Promise<void> {
    this.store.clear();
    this.typeIndex.clear();
    this.connected = false;
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
      throw new Error('Memory storage is not initialized');
    }

    const entity = this.store.get(id);
    if (!entity) {
      return null;
    }

    // Check expiration if enabled
    if (this.config.checkExpiration && entity.metadata.expires_at) {
      if (Date.now() > entity.metadata.expires_at) {
        await this.delete(id);
        return null;
      }
    }

    return { ...entity, data: { ...entity.data } };
  }

  /**
   * Set entity
   */
  async set(entity: StorageEntity): Promise<void> {
    if (!this.connected) {
      throw new Error('Memory storage is not initialized');
    }

    const entityCopy = { ...entity, data: { ...entity.data } };
    this.store.set(entity.id, entityCopy);

    // Update type index
    if (!this.typeIndex.has(entity.type)) {
      this.typeIndex.set(entity.type, new Set());
    }
    this.typeIndex.get(entity.type)!.add(entity.id);
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Memory storage is not initialized');
    }

    const entity = this.store.get(id);
    if (!entity) {
      return false;
    }

    this.store.delete(id);

    // Update type index
    const typeSet = this.typeIndex.get(entity.type);
    if (typeSet) {
      typeSet.delete(id);
      if (typeSet.size === 0) {
        this.typeIndex.delete(entity.type);
      }
    }

    return true;
  }

  /**
   * Check if entity exists
   */
  async has(id: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Memory storage is not initialized');
    }
    return this.store.has(id);
  }

  /**
   * Get all entities
   */
  async getAll(): Promise<StorageEntity[]> {
    if (!this.connected) {
      throw new Error('Memory storage is not initialized');
    }

    const now = Date.now();
    const entities: StorageEntity[] = [];

    for (const [id, entity] of this.store.entries()) {
      // Check expiration
      if (this.config.checkExpiration && entity.metadata.expires_at) {
        if (now > entity.metadata.expires_at) {
          await this.delete(id);
          continue;
        }
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
      throw new Error('Memory storage is not initialized');
    }

    const typeSet = this.typeIndex.get(type);
    if (!typeSet) {
      return [];
    }

    const now = Date.now();
    const entities: StorageEntity[] = [];

    for (const id of typeSet) {
      const entity = this.store.get(id);
      if (entity) {
        // Check expiration
        if (this.config.checkExpiration && entity.metadata.expires_at) {
          if (now > entity.metadata.expires_at) {
            await this.delete(id);
            continue;
          }
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
      throw new Error('Memory storage is not initialized');
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
    this.store.clear();
    this.typeIndex.clear();
  }

  /**
   * Get entity count
   */
  async count(): Promise<number> {
    return this.store.size;
  }

  /**
   * Get storage info
   */
  getInfo(): StorageBackendInfo {
    return {
      type: StorageBackendType.MEMORY,
      connected: this.connected,
      count: this.store.size,
      typeCount: this.typeIndex.size,
    };
  }
}
