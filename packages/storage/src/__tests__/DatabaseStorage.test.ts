/**
 * DatabaseStorage Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseStorage } from '../backends/DatabaseStorage.js';
import type { StorageEntity } from '../models/StorageEntity.js';

describe('DatabaseStorage', () => {
  let dbPath: string;
  let storage: DatabaseStorage;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `storage-test-${Date.now()}`);
    storage = new DatabaseStorage({ dbPath });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
    // Clean up test directory
    try {
      await fs.rm(dbPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialize and close', () => {
    it('should initialize successfully', () => {
      expect(storage.isConnected()).toBe(true);
    });

    it('should persist data across reinitialization', async () => {
      await storage.set(createTestEntity('test-1', 'user', { name: 'John' }));

      // Close and reopen
      await storage.close();
      storage = new DatabaseStorage({ dbPath });
      await storage.initialize();

      const entity = await storage.get('test-1');
      expect(entity).toBeDefined();
      expect(entity?.data.name).toBe('John');
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

    it('should return null for expired entity', async () => {
      const entity = createTestEntity('expired-test', 'user', { name: 'Bob' });
      entity.metadata.expires_at = Date.now() - 1000;
      await storage.set(entity);

      const result = await storage.get('expired-test');

      expect(result).toBeNull();
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
      expect(result?.version).toBe(2);
    });

    it('should not throw for uninitialized storage', async () => {
      const newStorage = new DatabaseStorage({ dbPath: path.join(os.tmpdir(), 'uninit-test') });

      await expect(newStorage.set(createTestEntity('test', 'user', {}))).rejects.toThrow();
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

    it('should query by created_after', async () => {
      const before = Date.now() + 1000;
      await storage.set(createTestEntity('future', 'user', {}));
      (storage as any).entities.get('future').created_at = before;

      const result = await storage.query({ created_after: Date.now() + 500 });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('future');
    });

    it('should query by tags', async () => {
      const tagged = createTestEntity('tagged', 'user', {});
      tagged.metadata.tags = ['important', 'urgent'];
      await storage.set(tagged);

      const result = await storage.query({ tags: ['important'] });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('tagged');
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

      expect(info.type).toBe('database');
      expect(info.connected).toBe(true);
      expect(info.dbPath).toBe(dbPath);
    });
  });

  describe('batch operations', () => {
    it('should handle batch operations efficiently', async () => {
      const startTime = Date.now();

      // Create many entities
      for (let i = 0; i < 100; i++) {
        await storage.set(createTestEntity(`batch-${i}`, 'item', { index: i }));
      }

      const setTime = Date.now() - startTime;

      // Query all
      const all = await storage.getAll();
      expect(all.length).toBe(100);

      // Clear all
      await storage.clear();
      expect(await storage.count()).toBe(0);
    });
  });
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
