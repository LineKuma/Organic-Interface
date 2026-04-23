/**
 * StorageService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService } from '../services/StorageService.js';
import { MemoryStorage } from '../backends/MemoryStorage.js';
import type { StorageEntity } from '../models/StorageEntity.js';

describe('StorageService', () => {
  let storage: StorageService;
  let backend: MemoryStorage;

  beforeEach(async () => {
    backend = new MemoryStorage();
    storage = new StorageService(backend);
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('create', () => {
    it('should create a new entity', async () => {
      const result = await storage.create('test', { name: 'test' });

      expect(result.success).toBe(true);
      expect(result.entity).toBeDefined();
      expect(result.entity?.type).toBe('test');
      expect(result.entity?.data.name).toBe('test');
      expect(result.entity?.id).toBeDefined();
    });

    it('should create entity with custom ID', async () => {
      const result = await storage.create('test', { name: 'test' }, { id: 'custom-id' });

      expect(result.success).toBe(true);
      expect(result.entity?.id).toBe('custom-id');
    });

    it('should reject duplicate ID', async () => {
      await storage.create('test', { name: 'first' }, { id: 'duplicate-id' });
      const result = await storage.create('test', { name: 'second' }, { id: 'duplicate-id' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('read', () => {
    it('should read existing entity', async () => {
      const created = await storage.create('test', { name: 'test' });
      const entity = await storage.read(created.entity!.id);

      expect(entity).toBeDefined();
      expect(entity?.id).toBe(created.entity?.id);
      expect(entity?.data.name).toBe('test');
    });

    it('should return null for non-existent entity', async () => {
      const entity = await storage.read('non-existent');
      expect(entity).toBeNull();
    });
  });

  describe('update', () => {
    it('should update entity data', async () => {
      const created = await storage.create('test', { name: 'original' });
      const result = await storage.update(created.entity!.id, { name: 'updated' });

      expect(result.success).toBe(true);
      expect(result.entity?.data.name).toBe('updated');
      expect(result.version).toBe(2);
    });

    it('should fail for non-existent entity', async () => {
      const result = await storage.update('non-existent', { name: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('delete', () => {
    it('should delete existing entity', async () => {
      const created = await storage.create('test', { name: 'test' });
      const result = await storage.delete(created.entity!.id);

      expect(result.success).toBe(true);

      const entity = await storage.read(created.entity!.id);
      expect(entity).toBeNull();
    });

    it('should fail for non-existent entity', async () => {
      const result = await storage.delete('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('batch operations', () => {
    it('should batch create entities', async () => {
      const entities = [
        { type: 'test', data: { name: 'first' } },
        { type: 'test', data: { name: 'second' } },
        { type: 'test', data: { name: 'third' } },
      ];

      const result = await storage.batchCreate(entities);

      expect(result.success).toBe(true);
      expect(result.created.length).toBe(3);
      expect(result.failed.length).toBe(0);
    });

    it('should batch update entities', async () => {
      const entities = [
        { type: 'test', data: { value: 1 } },
        { type: 'test', data: { value: 2 } },
      ];

      const created = await storage.batchCreate(entities);
      const updates = created.created.map((e, i) => ({
        id: e.id,
        data: { value: i + 10 } as Partial<Record<string, unknown>>,
      }));

      const result = await storage.batchUpdate(updates);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(2);
    });

    it('should batch delete entities', async () => {
      const entities = [
        { type: 'test', data: { name: 'first' } },
        { type: 'test', data: { name: 'second' } },
      ];

      const created = await storage.batchCreate(entities);
      const ids = created.created.map(e => e.id);

      const result = await storage.batchDelete(ids);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(2);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await storage.batchCreate([
        { type: 'user', data: { name: 'Alice', age: 25 } },
        { type: 'user', data: { name: 'Bob', age: 30 } },
        { type: 'product', data: { name: 'Widget', price: 100 } },
      ]);
    });

    it('should query by type', async () => {
      const result = await storage.query({ where: { type: 'user' } });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(2);
      expect(result.entities.every(e => e.type === 'user')).toBe(true);
    });

    it('should query with pagination', async () => {
      const result = await storage.query({
        where: { type: 'user' },
        limit: 1,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.entities.length).toBe(1);
    });

    it('should query with ordering', async () => {
      const result = await storage.query({
        where: { type: 'user' },
        orderBy: [{ field: 'data.age', direction: 'desc' }],
      });

      expect(result.success).toBe(true);
      expect(result.entities[0].data.age).toBe(30);
    });
  });

  describe('findByType', () => {
    it('should find entities by type', async () => {
      await storage.batchCreate([
        { type: 'cat', data: { name: 'Whiskers' } },
        { type: 'dog', data: { name: 'Buddy' } },
        { type: 'cat', data: { name: 'Felix' } },
      ]);

      const cats = await storage.findByType('cat');

      expect(cats.length).toBe(2);
      expect(cats.every(c => c.type === 'cat')).toBe(true);
    });
  });

  describe('transactions', () => {
    it('should begin a transaction', async () => {
      const tx = await storage.beginTransaction();

      expect(tx).toBeDefined();
      expect(tx.id).toBeDefined();
      expect(tx.status).toBe('active');
    });

    it('should commit a transaction', async () => {
      await storage.beginTransaction();
      await storage.commitTransaction();

      const tx = storage.getCurrentTransaction();
      expect(tx).toBeNull();
    });

    it('should rollback a transaction', async () => {
      await storage.beginTransaction();
      await storage.rollbackTransaction();

      const tx = storage.getCurrentTransaction();
      expect(tx).toBeNull();
    });

    it('should reject nested transactions', async () => {
      await storage.beginTransaction();

      await expect(storage.beginTransaction()).rejects.toThrow();
    });
  });

  describe('clearExpired', () => {
    it('should clear expired entities', async () => {
      await storage.create('test', { name: 'expired' }, {
        metadata: { expires_at: Date.now() - 1000 },
      });
      await storage.create('test', { name: 'valid' }, {
        metadata: { expires_at: Date.now() + 60000 },
      });

      const result = await storage.clearExpired();

      expect(result.success).toBe(true);
      expect(result.cleared).toBe(1);

      const all = await backend.getAll();
      expect(all.length).toBe(1);
      expect(all[0].data.name).toBe('valid');
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage info', async () => {
      await storage.create('test', { name: 'test' });

      const info = await storage.getStorageInfo();

      expect(info.backend).toBeDefined();
      expect(info.backend.count).toBe(1);
      expect(info.transactionActive).toBe(false);
    });
  });
});
