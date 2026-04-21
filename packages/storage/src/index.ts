/**
 * @organic/storage - Storage module
 */

export {
  createLogger,
  type Logger,
  type LogLevel,
} from '@organic/utils';

/**
 * Storage interface
 */
export interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Memory storage implementation
 */
export class MemoryStorage implements Storage {
  private store: Map<string, unknown> = new Map();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
