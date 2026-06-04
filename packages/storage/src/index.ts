/**
 * @organic/storage - Storage module for Organic Interface
 *
 * Provides unified storage abstraction with support for multiple backends:
 * - Memory storage (high-speed, temporary)
 * - File storage (persistent, file-based)
 * - Database storage (structured, transactional)
 */

// Re-export logger from utils
export { createLogger, type Logger, type LogLevel } from '@organic/utils';

// Model exports
export {
  type EntityMetadata,
  createDefaultMetadata,
  isMetadataExpired,
  cloneMetadata,
  type StorageEntity,
  StorageEntityImpl,
  type StorageIndex,
  IndexType,
  createStorageEntity,
  isValidEntity,
} from './models/index.js';

// Backend exports
export {
  type IStorageBackend,
  type StorageBackendInfo,
  StorageBackendType,
  type MemoryStorageConfig,
  MemoryStorage,
  type FileStorageConfig,
  FileStorage,
  type DatabaseStorageConfig,
  DatabaseStorage,
  type BatchOperationResult,
} from './backends/index.js';

// Service exports
export {
  StorageService,
  StorageError,
  StorageErrorCode,
  IsolationLevel,
  TransactionStatus,
  type Transaction,
  type TransactionOptions,
  type QueryFilter,
  type OrderSpec,
  type UpdateOperation,
  type CreateResult,
  type UpdateResult,
  type DeleteResult,
  type BatchCreateResult,
  type BatchUpdateResult,
  type BatchDeleteResult,
  type QueryResult,
  type ClearResult,
  type StorageInfo,
  StorageManager,
  type StorageManagerConfig,
  SessionPersistenceStorage,
  type SessionPersistenceStorageConfig,
  createSessionPersistenceStorage,
  SessionAdapter,
  type SessionPersistence,
  type SessionPersistenceContextWindow,
  SessionPersistenceStatus,
} from './services/index.js';

/**
 * Module version
 */
export const VERSION = '0.1.0';
