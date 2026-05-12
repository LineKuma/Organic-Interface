/**
 * Storage Entity for Organic Interface Storage
 */

import type { EntityMetadata} from './EntityMetadata.js';
import { createDefaultMetadata, cloneMetadata, isMetadataExpired } from './EntityMetadata.js';

/**
 * Storage index type enumeration
 */
export enum IndexType {
  PRIMARY = 'primary',
  UNIQUE = 'unique',
  MULTI = 'multi',
  TEXT = 'text',
}

/**
 * Storage index definition
 */
export interface StorageIndex {
  /** Index name */
  name: string;
  /** Fields to index */
  fields: string[];
  /** Whether this is a unique index */
  unique: boolean;
  /** Index type */
  type: IndexType;
}

/**
 * Base storage entity interface
 */
export interface StorageEntity {
  /** Unique identifier */
  id: string;
  /** Entity type */
  type: string;
  /** Entity data */
  data: Record<string, unknown>;
  /** Entity metadata */
  metadata: EntityMetadata;
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
  /** Version number for conflict detection */
  version: number;
}

/**
 * Storage entity implementation
 */
export class StorageEntityImpl implements StorageEntity {
  id: string;
  type: string;
  data: Record<string, unknown>;
  metadata: EntityMetadata;
  created_at: number;
  updated_at: number;
  version: number;

  /**
   * Create a new storage entity
   */
  constructor(type: string, data: Record<string, unknown>, id?: string, metadata?: EntityMetadata) {
    this.id = id || this.generateId();
    this.type = type;
    this.data = { ...data };
    this.metadata = metadata || createDefaultMetadata();
    this.created_at = Date.now();
    this.updated_at = this.created_at;
    this.version = 1;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomPart}`;
  }

  /**
   * Update entity data
   */
  updateData(data: Partial<Record<string, unknown>>, updatedBy?: string): void {
    this.data = { ...this.data, ...data };
    this.updated_at = Date.now();
    this.version += 1;
    if (updatedBy) {
      this.metadata = { ...this.metadata, updated_by: updatedBy };
    }
  }

  /**
   * Update metadata
   */
  updateMetadata(metadata: Partial<EntityMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.updated_at = Date.now();
  }

  /**
   * Check if entity is expired
   */
  isExpired(): boolean {
    return isMetadataExpired(this.metadata);
  }

  /**
   * Convert to JSON string
   */
  toJSON(): string {
    return JSON.stringify({
      id: this.id,
      type: this.type,
      data: this.data,
      metadata: this.metadata,
      created_at: this.created_at,
      updated_at: this.updated_at,
      version: this.version,
    });
  }

  /**
   * Create from JSON string
   */
  static fromJSON(json: string): StorageEntityImpl {
    const parsed = JSON.parse(json);
    const entity = new StorageEntityImpl(parsed.type, parsed.data, parsed.id, parsed.metadata);
    entity.created_at = parsed.created_at;
    entity.updated_at = parsed.updated_at;
    entity.version = parsed.version;
    return entity;
  }

  /**
   * Clone the entity
   */
  clone(): StorageEntityImpl {
    const cloned = new StorageEntityImpl(this.type, { ...this.data }, this.id, cloneMetadata(this.metadata));
    cloned.created_at = this.created_at;
    cloned.updated_at = this.updated_at;
    cloned.version = this.version;
    return cloned;
  }

  /**
   * Convert to plain object
   */
  toObject(): StorageEntity {
    return {
      id: this.id,
      type: this.type,
      data: { ...this.data },
      metadata: cloneMetadata(this.metadata),
      created_at: this.created_at,
      updated_at: this.updated_at,
      version: this.version,
    };
  }
}

/**
 * Create a new storage entity
 */
export function createStorageEntity(
  type: string,
  data: Record<string, unknown>,
  options?: {
    id?: string;
    metadata?: EntityMetadata;
  }
): StorageEntityImpl {
  return new StorageEntityImpl(type, data, options?.id, options?.metadata);
}

/**
 * Check if an entity is valid
 */
export function isValidEntity(entity: unknown): entity is StorageEntity {
  if (!entity || typeof entity !== 'object') {
    return false;
  }
  const e = entity as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.type === 'string' &&
    typeof e.data === 'object' &&
    typeof e.metadata === 'object' &&
    typeof e.created_at === 'number' &&
    typeof e.updated_at === 'number' &&
    typeof e.version === 'number'
  );
}
