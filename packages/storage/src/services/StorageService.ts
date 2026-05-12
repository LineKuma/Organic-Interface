/**
 * Storage Service for Organic Interface Storage
 * Core storage interface providing CRUD, query, and transaction operations
 */

import type { Logger } from '@organic/utils';
import { createLogger } from '@organic/utils';
import { BaseError } from '@organic/utils';

import type {
  StorageEntity,
  StorageIndex,
  EntityMetadata} from '../models/index.js';
import {
  StorageEntityImpl,
  IndexType,
  createStorageEntity,
} from '../models/index.js';
import type { IStorageBackend, StorageBackendInfo } from '../backends/index.js';

/**
 * Isolation level for transactions
 */
export enum IsolationLevel {
  READ_UNCOMMITTED = 'read_uncommitted',
  READ_COMMITTED = 'read_committed',
  REPEATABLE_READ = 'repeatable_read',
  SERIALIZABLE = 'serializable',
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  ACTIVE = 'active',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled_back',
  EXPIRED = 'expired',
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  /** Isolation level */
  isolation?: IsolationLevel;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Retry on conflict */
  retryOnConflict?: boolean;
}

/**
 * Transaction interface
 */
export interface Transaction {
  /** Transaction ID */
  id: string;
  /** Start time */
  startTime: number;
  /** Isolation level */
  isolation: IsolationLevel;
  /** Transaction status */
  status: TransactionStatus;
}

/**
 * Query filter for entity queries
 */
export interface QueryFilter {
  /** AND conditions */
  where?: Record<string, unknown>;
  /** OR conditions */
  orWhere?: Record<string, unknown>;
  /** Order specifications */
  orderBy?: OrderSpec[];
  /** Result limit */
  limit?: number;
  /** Result offset */
  offset?: number;
  /** Include fields */
  include?: string[];
  /** Exclude fields */
  exclude?: string[];
  /** Created after timestamp */
  createdAfter?: number;
  /** Created before timestamp */
  createdBefore?: number;
  /** Updated after timestamp */
  updatedAfter?: number;
  /** Updated before timestamp */
  updatedBefore?: number;
}

/**
 * Order specification
 */
export interface OrderSpec {
  /** Field to order by */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Update operation for batch updates
 */
export interface UpdateOperation {
  /** Entity ID */
  id: string;
  /** Update data */
  data: Partial<StorageEntity>;
}

/**
 * Create result
 */
export interface CreateResult {
  success: boolean;
  entity?: StorageEntity;
  error?: string;
}

/**
 * Update result
 */
export interface UpdateResult {
  success: boolean;
  entity?: StorageEntity;
  error?: string;
  version?: number;
}

/**
 * Delete result
 */
export interface DeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Batch create result
 */
export interface BatchCreateResult {
  success: boolean;
  created: StorageEntity[];
  failed: Array<{ entity: StorageEntity; error: string }>;
}

/**
 * Batch update result
 */
export interface BatchUpdateResult {
  success: boolean;
  updated: number;
  failed: Array<{ id: string; error: string }>;
}

/**
 * Batch delete result
 */
export interface BatchDeleteResult {
  success: boolean;
  deleted: number;
  failed: Array<{ id: string; error: string }>;
}

/**
 * Query result
 */
export interface QueryResult {
  success: boolean;
  entities: StorageEntity[];
  total: number;
  error?: string;
}

/**
 * Clear result
 */
export interface ClearResult {
  success: boolean;
  cleared: number;
  error?: string;
}

/**
 * Storage info
 */
export interface StorageInfo {
  backend: StorageBackendInfo;
  transactionActive: boolean;
  indexes: StorageIndex[];
}

/**
 * Storage service error codes
 */
export enum StorageErrorCode {
  NOT_INITIALIZED = 'STORAGE_NOT_INITIALIZED',
  ENTITY_NOT_FOUND = 'STORAGE_ENTITY_NOT_FOUND',
  DUPLICATE_ENTITY = 'STORAGE_DUPLICATE_ENTITY',
  INVALID_FILTER = 'STORAGE_INVALID_FILTER',
  TRANSACTION_FAILED = 'STORAGE_TRANSACTION_FAILED',
  OPERATION_FAILED = 'STORAGE_OPERATION_FAILED',
}

/**
 * Storage service error
 */
export class StorageError extends BaseError {
  constructor(message: string, code: StorageErrorCode, details?: unknown) {
    super(message, code, details);
    this.name = 'StorageError';
  }
}

/**
 * Storage Service Implementation
 * Provides unified interface for storage operations
 */
export class StorageService {
  private backend: IStorageBackend;
  private logger: Logger;
  private indexes: StorageIndex[] = [];
  private currentTransaction: Transaction | null = null;
  private transactionTimeout: NodeJS.Timeout | null = null;

  constructor(backend: IStorageBackend, logger?: Logger) {
    this.backend = backend;
    this.logger = logger || createLogger({ prefix: 'StorageService' });
  }

  /**
   * Initialize the storage service
   */
  async initialize(): Promise<void> {
    await this.backend.initialize();
    this.logger.info('Storage service initialized');
  }

  /**
   * Close the storage service
   */
  async close(): Promise<void> {
    if (this.currentTransaction) {
      await this.rollbackTransaction();
    }
    await this.backend.close();
    this.logger.info('Storage service closed');
  }

  /**
   * Create a new entity
   */
  async create(
    type: string,
    data: Record<string, unknown>,
    options?: {
      id?: string;
      metadata?: EntityMetadata;
    }
  ): Promise<CreateResult> {
    try {
      // Check for duplicate ID if specified
      if (options?.id) {
        const existing = await this.backend.get(options.id);
        if (existing) {
          return {
            success: false,
            error: `Entity with ID ${options.id} already exists`,
          };
        }
      }

      const entity = createStorageEntity(type, data, options);

      // Check unique indexes
      for (const index of this.indexes) {
        if (index.type === IndexType.UNIQUE) {
          const existing = await this.checkUniqueIndex(index, entity);
          if (existing) {
            return {
              success: false,
              error: `Unique constraint violation on index ${index.name}`,
            };
          }
        }
      }

      await this.backend.set(entity.toObject());
      this.logger.debug(`Created entity: ${entity.id}`);

      return {
        success: true,
        entity: entity.toObject(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create entity: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Read an entity by ID
   */
  async read(id: string): Promise<StorageEntity | null> {
    return this.backend.get(id);
  }

  /**
   * Update an entity
   */
  async update(
    id: string,
    data: Partial<Record<string, unknown>>,
    updatedBy?: string
  ): Promise<UpdateResult> {
    try {
      const entity = await this.backend.get(id);
      if (!entity) {
        return {
          success: false,
          error: `Entity with ID ${id} not found`,
        };
      }

      // Check version if using transactions
      const impl = new StorageEntityImpl(
        entity.type,
        entity.data,
        entity.id,
        entity.metadata
      );
      impl.created_at = entity.created_at;
      impl.updated_at = entity.updated_at;
      impl.version = entity.version;

      impl.updateData(data, updatedBy);
      await this.backend.set(impl.toObject());
      this.logger.debug(`Updated entity: ${id}`);

      return {
        success: true,
        entity: impl.toObject(),
        version: impl.version,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update entity: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<DeleteResult> {
    try {
      const deleted = await this.backend.delete(id);
      if (!deleted) {
        return {
          success: false,
          error: `Entity with ID ${id} not found`,
        };
      }
      this.logger.debug(`Deleted entity: ${id}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete entity: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Batch create entities
   */
  async batchCreate(
    entities: Array<{
      type: string;
      data: Record<string, unknown>;
      id?: string;
      metadata?: EntityMetadata;
    }>
  ): Promise<BatchCreateResult> {
    const created: StorageEntity[] = [];
    const failed: Array<{ entity: StorageEntity; error: string }> = [];

    for (const item of entities) {
      const result = await this.create(item.type, item.data, {
        id: item.id,
        metadata: item.metadata,
      });

      if (result.success && result.entity) {
        created.push(result.entity);
      } else {
        failed.push({
          entity: createStorageEntity(item.type, item.data, { id: item.id, metadata: item.metadata }).toObject(),
          error: result.error || 'Unknown error',
        });
      }
    }

    return {
      success: failed.length === 0,
      created,
      failed,
    };
  }

  /**
   * Batch update entities
   */
  async batchUpdate(updates: UpdateOperation[]): Promise<BatchUpdateResult> {
    let updated = 0;
    const failed: Array<{ id: string; error: string }> = [];

    for (const update of updates) {
      const result = await this.update(update.id, update.data);
      if (result.success) {
        updated++;
      } else {
        failed.push({
          id: update.id,
          error: result.error || 'Unknown error',
        });
      }
    }

    return {
      success: failed.length === 0,
      updated,
      failed,
    };
  }

  /**
   * Batch delete entities
   */
  async batchDelete(ids: string[]): Promise<BatchDeleteResult> {
    let deleted = 0;
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      const result = await this.delete(id);
      if (result.success) {
        deleted++;
      } else {
        failed.push({
          id,
          error: result.error || 'Unknown error',
        });
      }
    }

    return {
      success: failed.length === 0,
      deleted,
      failed,
    };
  }

  /**
   * Query entities with filter
   */
  async query(filter: QueryFilter): Promise<QueryResult> {
    try {
      // Build backend filter
      const backendFilter: Record<string, unknown> = {};

      if (filter.where) {
        Object.assign(backendFilter, filter.where);
      }

      if (filter.createdAfter) {
        backendFilter.created_after = filter.createdAfter;
      }
      if (filter.createdBefore) {
        backendFilter.created_before = filter.createdBefore;
      }
      if (filter.updatedAfter) {
        backendFilter.updated_after = filter.updatedAfter;
      }
      if (filter.updatedBefore) {
        backendFilter.updated_before = filter.updatedBefore;
      }

      let entities = await this.backend.query(backendFilter);

      // Apply OR conditions
      if (filter.orWhere && Object.keys(filter.orWhere).length > 0) {
        const orEntities = await this.backend.query(filter.orWhere);
        const idSet = new Set(entities.map(e => e.id));
        for (const entity of orEntities) {
          if (!idSet.has(entity.id)) {
            entities.push(entity);
          }
        }
      }

      // Apply ordering
      if (filter.orderBy && filter.orderBy.length > 0) {
        entities = this.applyOrderBy(entities, filter.orderBy);
      }

      const total = entities.length;

      // Apply pagination
      if (filter.offset !== undefined) {
        entities = entities.slice(filter.offset);
      }
      if (filter.limit !== undefined) {
        entities = entities.slice(0, filter.limit);
      }

      // Apply field filtering
      if (filter.include || filter.exclude) {
        entities = entities.map(e => this.filterFields(e, filter.include, filter.exclude));
      }

      return {
        success: true,
        entities,
        total,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to query entities: ${message}`);
      return {
        success: false,
        entities: [],
        total: 0,
        error: message,
      };
    }
  }

  /**
   * Find entities by type
   */
  async findByType(type: string): Promise<StorageEntity[]> {
    return this.backend.getByType(type);
  }

  /**
   * Find entities by tags
   */
  async findByTags(tags: string[]): Promise<StorageEntity[]> {
    const result = await this.query({
      where: { tags },
    });
    return result.entities;
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(options?: TransactionOptions): Promise<Transaction> {
    if (this.currentTransaction) {
      throw new StorageError(
        'A transaction is already active',
        StorageErrorCode.TRANSACTION_FAILED
      );
    }

    const transaction: Transaction = {
      id: this.generateTransactionId(),
      startTime: Date.now(),
      isolation: options?.isolation || IsolationLevel.READ_COMMITTED,
      status: TransactionStatus.ACTIVE,
    };

    this.currentTransaction = transaction;

    // Set timeout if specified
    if (options?.timeout) {
      this.transactionTimeout = setTimeout(async () => {
        await this.rollbackTransaction();
      }, options.timeout);
    }

    this.logger.debug(`Transaction started: ${transaction.id}`);
    return transaction;
  }

  /**
   * Commit the current transaction
   */
  async commitTransaction(): Promise<void> {
    if (!this.currentTransaction) {
      throw new StorageError(
        'No active transaction to commit',
        StorageErrorCode.TRANSACTION_FAILED
      );
    }

    this.clearTransactionTimeout();
    this.currentTransaction.status = TransactionStatus.COMMITTED;
    this.logger.debug(`Transaction committed: ${this.currentTransaction.id}`);
    this.currentTransaction = null;
  }

  /**
   * Rollback the current transaction
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.currentTransaction) {
      throw new StorageError(
        'No active transaction to rollback',
        StorageErrorCode.TRANSACTION_FAILED
      );
    }

    this.clearTransactionTimeout();
    this.currentTransaction.status = TransactionStatus.ROLLED_BACK;
    this.logger.debug(`Transaction rolled back: ${this.currentTransaction.id}`);
    this.currentTransaction = null;
  }

  /**
   * Clear expired entities
   */
  async clearExpired(): Promise<ClearResult> {
    try {
      const all = await this.backend.getAll();
      const now = Date.now();
      let cleared = 0;

      for (const entity of all) {
        if (entity.metadata.expires_at && now > entity.metadata.expires_at) {
          await this.backend.delete(entity.id);
          cleared++;
        }
      }

      this.logger.info(`Cleared ${cleared} expired entities`);
      return {
        success: true,
        cleared,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to clear expired entities: ${message}`);
      return {
        success: false,
        cleared: 0,
        error: message,
      };
    }
  }

  /**
   * Get storage info
   */
  async getStorageInfo(): Promise<StorageInfo> {
    return {
      backend: this.backend.getInfo(),
      transactionActive: this.currentTransaction !== null,
      indexes: this.indexes,
    };
  }

  /**
   * Register an index
   */
  registerIndex(index: StorageIndex): void {
    this.indexes.push(index);
  }

  /**
   * Get current transaction
   */
  getCurrentTransaction(): Transaction | null {
    return this.currentTransaction;
  }

  // Helper methods

  private async checkUniqueIndex(index: StorageIndex, entity: StorageEntityImpl): Promise<boolean> {
    const filter: Record<string, unknown> = {};
    for (const field of index.fields) {
      if (field === 'type') {
        filter.type = entity.type;
      } else if (field.startsWith('data.')) {
        const dataKey = field.substring(5);
        filter[field] = entity.data[dataKey];
      }
    }

    const results = await this.backend.query(filter);
    return results.length > 0 && results[0].id !== entity.id;
  }

  private applyOrderBy(entities: StorageEntity[], orderBy: OrderSpec[]): StorageEntity[] {
    return [...entities].sort((a, b) => {
      for (const spec of orderBy) {
        const aVal = this.getFieldValue(a, spec.field);
        const bVal = this.getFieldValue(b, spec.field);

        if (aVal === bVal) continue;

        // Handle null/undefined comparisons
        if (aVal == null) return spec.direction === 'desc' ? 1 : -1;
        if (bVal == null) return spec.direction === 'desc' ? -1 : 1;

        // Handle different types by converting to string for comparison
        const aStr = String(aVal);
        const bStr = String(bVal);
        const comparison = aStr < bStr ? -1 : 1;
        return spec.direction === 'desc' ? -comparison : comparison;
      }
      return 0;
    });
  }

  private getFieldValue(entity: StorageEntity, field: string): unknown {
    if (field === 'id') return entity.id;
    if (field === 'type') return entity.type;
    if (field === 'created_at') return entity.created_at;
    if (field === 'updated_at') return entity.updated_at;
    if (field === 'version') return entity.version;
    if (field.startsWith('data.')) {
      const dataKey = field.substring(5);
      return entity.data[dataKey];
    }
    if (field.startsWith('metadata.')) {
      const metaKey = field.substring(9);
      return (entity.metadata as unknown as Record<string, unknown>)[metaKey];
    }
    return (entity as unknown as Record<string, unknown>)[field];
  }

  private filterFields(
    entity: StorageEntity,
    include?: string[],
    exclude?: string[]
  ): StorageEntity {
    const result = { ...entity };

    if (include && include.length > 0) {
      const includedData: Record<string, unknown> = {};
      for (const field of include) {
        if (field.startsWith('data.')) {
          const dataKey = field.substring(5);
          includedData[dataKey] = entity.data[dataKey];
        }
      }
      result.data = includedData;
    }

    if (exclude && exclude.length > 0) {
      const filteredData = { ...entity.data };
      for (const field of exclude) {
        if (field.startsWith('data.')) {
          const dataKey = field.substring(5);
          delete filteredData[dataKey];
        }
      }
      result.data = filteredData;
    }

    return result;
  }

  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `tx-${timestamp}-${random}`;
  }

  private clearTransactionTimeout(): void {
    if (this.transactionTimeout) {
      clearTimeout(this.transactionTimeout);
      this.transactionTimeout = null;
    }
  }
}
