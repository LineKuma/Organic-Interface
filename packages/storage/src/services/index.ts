/**
 * Service exports for Organic Interface Storage
 */

export {
  StorageService,
  StorageError,
  StorageErrorCode,
  IsolationLevel,
  TransactionStatus,
  Transaction,
  TransactionOptions,
  QueryFilter,
  OrderSpec,
  UpdateOperation,
  CreateResult,
  UpdateResult,
  DeleteResult,
  BatchCreateResult,
  BatchUpdateResult,
  BatchDeleteResult,
  QueryResult,
  ClearResult,
  StorageInfo,
} from './StorageService.js';

export {
  StorageManager,
  StorageManagerConfig,
} from './StorageManager.js';
