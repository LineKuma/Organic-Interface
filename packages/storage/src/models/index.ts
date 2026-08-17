/**
 * Model exports for Organic Interface Storage
 */

export {
  EntityMetadata,
  createDefaultMetadata,
  isMetadataExpired,
  cloneMetadata,
} from './EntityMetadata.js';

export {
  StorageEntity,
  StorageEntityImpl,
  StorageIndex,
  IndexType,
  createStorageEntity,
  isValidEntity,
} from './StorageEntity.js';
