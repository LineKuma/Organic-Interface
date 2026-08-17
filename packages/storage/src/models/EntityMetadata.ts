/**
 * Entity metadata for Organic Interface Storage
 */

/**
 * Entity metadata interface
 * Contains additional information about a storage entity
 */
export interface EntityMetadata {
  /** User who created the entity */
  created_by?: string;
  /** User who last updated the entity */
  updated_by?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Expiration timestamp */
  expires_at?: number;
  /** Data source identifier */
  source?: string;
  /** Custom metadata fields */
  [key: string]: unknown;
}

/**
 * Create default entity metadata
 */
export function createDefaultMetadata(): EntityMetadata {
  return {
    created_by: undefined,
    updated_by: undefined,
    tags: [],
    expires_at: undefined,
    source: undefined,
  };
}

/**
 * Check if an entity has expired
 */
export function isMetadataExpired(metadata: EntityMetadata): boolean {
  if (metadata.expires_at === undefined) {
    return false;
  }
  return Date.now() > metadata.expires_at;
}

/**
 * Clone metadata
 */
export function cloneMetadata(metadata: EntityMetadata): EntityMetadata {
  return {
    ...metadata,
    tags: metadata.tags ? [...metadata.tags] : undefined,
  };
}
