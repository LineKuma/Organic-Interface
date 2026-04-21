/**
 * File Storage Backend for Organic Interface Storage
 * Persistent file-based storage implementation
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
 * File storage configuration
 */
export interface FileStorageConfig {
  /** Base directory for storage */
  basePath: string;
  /** File extension for entity files */
  fileExtension?: string;
  /** Enable automatic flushing */
  autoFlush?: boolean;
  /** Flush interval in milliseconds */
  flushInterval?: number;
}

/**
 * File storage backend implementation
 * Stores entities as JSON files on the filesystem
 */
export class FileStorage implements IStorageBackend {
  private basePath: string;
  private fileExtension: string;
  private autoFlush: boolean;
  private flushInterval: number;
  private cache: Map<string, StorageEntity> = new Map();
  private flushTimer?: NodeJS.Timeout;
  private connected: boolean = false;
  private dirty: Set<string> = new Set();
  private metadataFile: string;
  private entityDir: string;

  constructor(config: FileStorageConfig) {
    if (!config.basePath) {
      throw new Error('FileStorage requires a basePath configuration');
    }
    this.basePath = config.basePath;
    this.fileExtension = config.fileExtension || '.json';
    this.autoFlush = config.autoFlush ?? true;
    this.flushInterval = config.flushInterval || 5000;
    this.metadataFile = path.join(this.basePath, 'metadata.json');
    this.entityDir = path.join(this.basePath, 'entities');
  }

  /**
   * Initialize the file storage
   */
  async initialize(): Promise<void> {
    // Create directories if they don't exist
    await fs.mkdir(this.basePath, { recursive: true });
    await fs.mkdir(this.entityDir, { recursive: true });

    // Load existing entities into cache
    await this.loadCache();

    this.connected = true;

    // Start auto-flush timer
    if (this.autoFlush) {
      this.startFlushTimer();
    }
  }

  /**
   * Load all entities from files into cache
   */
  private async loadCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.entityDir);
      for (const file of files) {
        if (file.endsWith(this.fileExtension)) {
          const filePath = path.join(this.entityDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const entity: StorageEntity = JSON.parse(content);
          this.cache.set(entity.id, entity);
        }
      }
    } catch (error) {
      // Ignore if directory doesn't exist yet
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Start the auto-flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flush();
    }, this.flushInterval);
  }

  /**
   * Flush dirty entities to disk
   */
  private async flush(): Promise<void> {
    const dirtyIds = Array.from(this.dirty);
    for (const id of dirtyIds) {
      const entity = this.cache.get(id);
      if (entity) {
        const filePath = this.getEntityFilePath(id);
        await fs.writeFile(filePath, JSON.stringify(entity, null, 2), 'utf-8');
      } else {
        // Entity was deleted
        const filePath = this.getEntityFilePath(id);
        try {
          await fs.unlink(filePath);
        } catch {
          // Ignore if file doesn't exist
        }
      }
      this.dirty.delete(id);
    }
  }

  /**
   * Get entity file path
   */
  private getEntityFilePath(id: string): string {
    return path.join(this.entityDir, `${id}${this.fileExtension}`);
  }

  /**
   * Close the file storage
   */
  async close(): Promise<void> {
    // Flush all dirty entities
    await this.flush();

    // Stop auto-flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    this.cache.clear();
    this.dirty.clear();
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
      throw new Error('File storage is not initialized');
    }

    const entity = this.cache.get(id);
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
      throw new Error('File storage is not initialized');
    }

    const entityCopy: StorageEntity = {
      ...entity,
      data: { ...entity.data },
    };
    this.cache.set(entity.id, entityCopy);
    this.dirty.add(entity.id);

    // Write to file immediately if not using auto-flush
    if (!this.autoFlush) {
      const filePath = this.getEntityFilePath(entity.id);
      await fs.writeFile(filePath, JSON.stringify(entityCopy, null, 2), 'utf-8');
      this.dirty.delete(entity.id);
    }
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('File storage is not initialized');
    }

    const exists = this.cache.has(id);
    if (!exists) {
      return false;
    }

    this.cache.delete(id);
    this.dirty.add(id);

    // Delete file immediately if not using auto-flush
    if (!this.autoFlush) {
      const filePath = this.getEntityFilePath(id);
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore if file doesn't exist
      }
      this.dirty.delete(id);
    }

    return true;
  }

  /**
   * Check if entity exists
   */
  async has(id: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('File storage is not initialized');
    }
    return this.cache.has(id);
  }

  /**
   * Get all entities
   */
  async getAll(): Promise<StorageEntity[]> {
    if (!this.connected) {
      throw new Error('File storage is not initialized');
    }

    const now = Date.now();
    const entities: StorageEntity[] = [];

    for (const [id, entity] of this.cache.entries()) {
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
      throw new Error('File storage is not initialized');
    }

    const now = Date.now();
    const entities: StorageEntity[] = [];

    for (const [id, entity] of this.cache.entries()) {
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
      throw new Error('File storage is not initialized');
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
      throw new Error('File storage is not initialized');
    }

    // Delete all entity files
    for (const id of this.cache.keys()) {
      const filePath = this.getEntityFilePath(id);
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore if file doesn't exist
      }
    }

    this.cache.clear();
    this.dirty.clear();
  }

  /**
   * Get entity count
   */
  async count(): Promise<number> {
    return this.cache.size;
  }

  /**
   * Get storage info
   */
  getInfo(): StorageBackendInfo {
    return {
      type: StorageBackendType.FILE,
      connected: this.connected,
      count: this.cache.size,
      dirtyCount: this.dirty.size,
      basePath: this.basePath,
      autoFlush: this.autoFlush,
    };
  }
}
