import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorage } from '../backends/MemoryStorage.js';
import { StorageBackendType } from '../backends/IStorageBackend.js';
import type { StorageEntity } from '../models/StorageEntity.js';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage();
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  function createTestEntity(id: string, type: string, data: Record<string, unknown>): StorageEntity {
    return {
      id,
      type,
      data,
      metadata: {
        created_by: 'test',
        tags: [],
      },
      created_at: Date.now(),
      updated_at: Date.now(),
      version: 1,
    };
  }

  describe('constructor', () => {
    it('should create MemoryStorage with default config', () => {
      const storage = new MemoryStorage();
      expect(storage).toBeDefined();
    });

    it('should create MemoryStorage with custom config', () => {
      const storage = new MemoryStorage({ initialCapacity: 500, checkExpiration: false });
      expect(storage).toBeDefined();
    });

    it('should set default initial capacity', () => {
      const storage = new MemoryStorage();
      expect((storage as any).config.initialCapacity).toBe(1000);
    });

    it('should enable expiration check by default', () => {
      const storage = new MemoryStorage();
      expect((storage as any).config.checkExpiration).toBe(true);
    });

    it('should accept custom initial capacity', () => {
      const storage = new MemoryStorage({ initialCapacity: 2000 });
      expect((storage as any).config.initialCapacity).toBe(2000);
    });

    it('should accept custom checkExpiration', () => {
      const storage = new MemoryStorage({ checkExpiration: false });
      expect((storage as any).config.checkExpiration).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', () => {
      expect(storage.isConnected()).toBe(true);
    });

    it('should create empty store', async () => {
      const storage = new MemoryStorage();
      await storage.initialize();
      const count = await storage.count();
      expect(count).toBe(0);
      await storage.close();
    });
  });

  describe('close', () => {
    it('should clear store after close', async () => {
      await storage.set(createTestEntity('close-test', 'user', {}));
      await storage.close();

      expect((storage as any).store.size).toBe(0);
      expect((storage as any).connected).toBe(false);
    });

    it('should clear type index after close', async () => {
      await storage.set(createTestEntity('index-test', 'user', {}));
      await storage.close();

      expect((storage as any).typeIndex.size).toBe(0);
    });
  });

  describe('isConnected', () => {
    it('should return true after initialize', () => {
      expect(storage.isConnected()).toBe(true);
    });

    it('should return false after close', async () => {
      await storage.close();
      expect(storage.isConnected()).toBe(false);
    });

    it('should return false before initialize', async () => {
      const newStorage = new MemoryStorage();
      expect(newStorage.isConnected()).toBe(false);
    });
  });

  describe('get', () => {
    it('should get existing entity', async () => {
      const entity = createTestEntity('get-test', 'user', { name: 'Alice' });
      await storage.set(entity);

      const result = await storage.get('get-test');

      expect(result).toBeDefined();
      expect(result?.id).toBe('get-test');
      expect(result?.data.name).toBe('Alice');
    });

    it('should return null for non-existent entity', async () => {
      const result = await storage.get('non-existent');
      expect(result).toBeNull();
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new MemoryStorage();
      await expect(uninitStorage.get('test')).rejects.toThrow('Memory storage is not initialized');
    });

    it('should return null for expired entity', async () => {
      const entity = createTestEntity('expired-test', 'user', { name: 'Bob' });
      entity.metadata.expires_at = Date.now() - 1000;
      await storage.set(entity);

      const result = await storage.get('expired-test');

      expect(result).toBeNull();
    });

    it('should return copy of entity data', async () => {
      const entity = createTestEntity('copy-test', 'user', { name: 'Test' });
      await storage.set(entity);

      const result = await storage.get('copy-test');
      result!.data.name = 'Modified';

      const result2 = await storage.get('copy-test');
      expect(result2?.data.name).toBe('Test');
    });

    it('should not delete expired entity when checkExpiration is false', async () => {
      const noCheckStorage = new MemoryStorage({ checkExpiration: false });
      await noCheckStorage.initialize();

      const entity = createTestEntity('no-check-expired', 'user', { name: 'Bob' });
      entity.metadata.expires_at = Date.now() - 1000;
      await noCheckStorage.set(entity);

      const result = await noCheckStorage.get('no-check-expired');
      expect(result).toBeDefined();
      expect(result?.data.name).toBe('Bob');

      await noCheckStorage.close();
    });
  });

  describe('set', () => {
    it('should set entity', async () => {
      const entity = createTestEntity('set-test', 'product', { price: 100 });
      await storage.set(entity);

      const result = await storage.get('set-test');
      expect(result?.data.price).toBe(100);
    });

    it('should update existing entity', async () => {
      const entity = createTestEntity('update-test', 'product', { price: 100 });
      await storage.set(entity);

      entity.data.price = 200;
      await storage.set(entity);

      const result = await storage.get('update-test');
      expect(result?.data.price).toBe(200);
    });

    it('should add to type index', async () => {
      const entity = createTestEntity('index-add', 'user', {});
      await storage.set(entity);

      expect((storage as any).typeIndex.has('user')).toBe(true);
      expect((storage as any).typeIndex.get('user')?.has('index-add')).toBe(true);
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new MemoryStorage();
      await expect(uninitStorage.set(createTestEntity('test', 'user', {}))).rejects.toThrow('Memory storage is not initialized');
    });
  });

  describe('delete', () => {
    it('should delete existing entity', async () => {
      const entity = createTestEntity('delete-test', 'user', { name: 'Delete Me' });
      await storage.set(entity);

      const result = await storage.delete('delete-test');

      expect(result).toBe(true);
      expect(await storage.get('delete-test')).toBeNull();
    });

    it('should return false for non-existent entity', async () => {
      const result = await storage.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should remove from type index', async () => {
      const entity = createTestEntity('index-remove', 'user', {});
      await storage.set(entity);

      await storage.delete('index-remove');

      const typeSet = (storage as any).typeIndex.get('user');
      if (typeSet) {
        expect(typeSet.has('index-remove')).toBe(false);
      } else {
        expect(typeSet).toBeUndefined();
      }
    });

    it('should clean up empty type index', async () => {
      const entity = createTestEntity('index-cleanup', 'unique-type', {});
      await storage.set(entity);

      await storage.delete('index-cleanup');

      expect((storage as any).typeIndex.has('unique-type')).toBe(false);
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new MemoryStorage();
      await expect(uninitStorage.delete('test')).rejects.toThrow('Memory storage is not initialized');
    });
  });

  describe('has', () => {
    it('should return true for existing entity', async () => {
      const entity = createTestEntity('has-test', 'user', {});
      await storage.set(entity);

      expect(await storage.has('has-test')).toBe(true);
    });

    it('should return false for non-existent entity', async () => {
      expect(await storage.has('non-existent')).toBe(false);
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new MemoryStorage();
      await expect(uninitStorage.has('test')).rejects.toThrow('Memory storage is not initialized');
    });
  });

  describe('getAll', () => {
    it('should get all entities', async () => {
      await storage.set(createTestEntity('all-1', 'type1', {}));
      await storage.set(createTestEntity('all-2', 'type2', {}));
      await storage.set(createTestEntity('all-3', 'type1', {}));

      const entities = await storage.getAll();

      expect(entities.length).toBe(3);
    });

    it('should exclude expired entities', async () => {
      await storage.set(createTestEntity('valid', 'user', {}));
      const expired = createTestEntity('expired', 'user', {});
      expired.metadata.expires_at = Date.now() - 1000;
      await storage.set(expired);

      const entities = await storage.getAll();

      expect(entities.length).toBe(1);
      expect(entities[0].id).toBe('valid');
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new MemoryStorage();
      await expect(uninitStorage.getAll()).rejects.toThrow('Memory storage is not initialized');
    });
  });

  describe('getByType', () => {
    it('should get entities by type', async () => {
      await storage.set(createTestEntity('type-1', 'cat', { name: 'Whiskers' }));
      await storage.set(createTestEntity('type-2', 'dog', { name: 'Buddy' }));
      await storage.set(createTestEntity('type-3', 'cat', { name: 'Felix' }));

      const cats = await storage.getByType('cat');

      expect(cats.length).toBe(2);
      expect(cats.every(c => c.type === 'cat')).toBe(true);
    });

    it('should return empty array for non-existent type', async () => {
      const result = await storage.getByType('non-existent');
      expect(result).toEqual([]);
    });

    it('should exclude expired entities', async () => {
      await storage.set(createTestEntity('type-valid', 'cat', { name: 'Valid' }));
      const expired = createTestEntity('type-expired', 'cat', { name: 'Expired' });
      expired.metadata.expires_at = Date.now() - 1000;
      await storage.set(expired);

      const cats = await storage.getByType('cat');

      expect(cats.length).toBe(1);
      expect(cats[0].id).toBe('type-valid');
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new MemoryStorage();
      await expect(uninitStorage.getByType('user')).rejects.toThrow('Memory storage is not initialized');
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await storage.set(createTestEntity('q1', 'user', { name: 'Alice', age: 25 }));
      await storage.set(createTestEntity('q2', 'user', { name: 'Bob', age: 30 }));
      await storage.set(createTestEntity('q3', 'product', { name: 'Widget' }));
    });

    it('should query by type', async () => {
      const result = await storage.query({ type: 'user' });

      expect(result.length).toBe(2);
      expect(result.every(e => e.type === 'user')).toBe(true);
    });

    it('should query by data field', async () => {
      const result = await storage.query({ 'data.name': 'Alice' });

      expect(result.length).toBe(1);
      expect(result[0].data.name).toBe('Alice');
    });

    it('should query by tags', async () => {
      const tagged = createTestEntity('tagged', 'user', {});
      tagged.metadata.tags = ['important', 'urgent'];
      await storage.set(tagged);

      const result = await storage.query({ tags: ['important'] });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('tagged');
    });

    it('should throw error when not initialized', async () => {
      const uninitStorage = new MemoryStorage();
      await expect(uninitStorage.query({ type: 'user' })).rejects.toThrow('Memory storage is not initialized');
    });
  });

  describe('clear', () => {
    it('should clear all entities', async () => {
      await storage.set(createTestEntity('clear-1', 'user', {}));
      await storage.set(createTestEntity('clear-2', 'user', {}));

      await storage.clear();

      const count = await storage.count();
      expect(count).toBe(0);
    });

    it('should clear type index', async () => {
      await storage.set(createTestEntity('clear-index-1', 'user', {}));
      await storage.set(createTestEntity('clear-index-2', 'user', {}));

      await storage.clear();

      expect((storage as any).typeIndex.size).toBe(0);
    });
  });

  describe('count', () => {
    it('should return entity count', async () => {
      expect(await storage.count()).toBe(0);

      await storage.set(createTestEntity('count-1', 'user', {}));
      await storage.set(createTestEntity('count-2', 'user', {}));

      expect(await storage.count()).toBe(2);
    });
  });

  describe('getInfo', () => {
    it('should return storage info', () => {
      const info = storage.getInfo();

      expect(info.type).toBe(StorageBackendType.MEMORY);
      expect(info.connected).toBe(true);
      expect(info.count).toBe(0);
    });

    it('should return correct type count', async () => {
      await storage.set(createTestEntity('info-1', 'user', {}));
      await storage.set(createTestEntity('info-2', 'user', {}));
      await storage.set(createTestEntity('info-3', 'product', {}));

      const info = storage.getInfo();

      expect(info.count).toBe(3);
      expect(info.typeCount).toBe(2);
    });
  });
});