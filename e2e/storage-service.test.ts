import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { StorageManager, StorageBackendType } from '@organic/storage';

describe('Storage Service', () => {
  let kernel: Kernel;
  let storageManager: StorageManager;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
    await kernel.initialize();

    storageManager = new StorageManager();
    await storageManager.initialize();
  });

  afterEach(async () => {
    await storageManager.close();
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  describe('StorageManager', () => {
    it('should create storage with type', async () => {
      const storage = await storageManager.createStorage('test-storage', StorageBackendType.MEMORY);

      expect(storage).toBeDefined();
      expect(storageManager.hasStorage('test-storage')).toBe(true);
    });

    it('should get storage by name', async () => {
      await storageManager.createStorage('get-test', StorageBackendType.MEMORY);

      const storage = storageManager.getStorage('get-test');
      expect(storage).toBeDefined();
    });

    it('should return existing storage for same name', async () => {
      const storage1 = await storageManager.createStorage('existing', StorageBackendType.MEMORY);
      const storage2 = await storageManager.createStorage('existing', StorageBackendType.MEMORY);

      expect(storage1).toBe(storage2);
    });

    it('should throw for non-existent storage', async () => {
      expect(() => storageManager.getStorage('non-existent')).toThrow();
    });

    it('should check if storage exists', async () => {
      await storageManager.createStorage('exists-check', StorageBackendType.MEMORY);

      expect(storageManager.hasStorage('exists-check')).toBe(true);
      expect(storageManager.hasStorage('does-not-exist')).toBe(false);
    });

    it('should remove storage', async () => {
      await storageManager.createStorage('to-remove', StorageBackendType.MEMORY);
      const result = await storageManager.removeStorage('to-remove');

      expect(result).toBe(true);
      expect(storageManager.hasStorage('to-remove')).toBe(false);
    });

    it('should return false when removing non-existent storage', async () => {
      const result = await storageManager.removeStorage('non-existent');
      expect(result).toBe(false);
    });

    it('should list all storage names', async () => {
      await storageManager.createStorage('list-1', StorageBackendType.MEMORY);
      await storageManager.createStorage('list-2', StorageBackendType.MEMORY);

      const names = storageManager.getStorageNames();
      expect(names.length).toBeGreaterThanOrEqual(2);
      expect(names).toContain('list-1');
      expect(names).toContain('list-2');
    });

    it('should get all storage info', async () => {
      await storageManager.createStorage('info-1', StorageBackendType.MEMORY);
      await storageManager.createStorage('info-2', StorageBackendType.MEMORY);

      const infos = await storageManager.getAllStorageInfo();
      expect(infos.size).toBeGreaterThanOrEqual(2);
    });

    it('should clear all storages', async () => {
      await storageManager.createStorage('clear-1', StorageBackendType.MEMORY);
      const storage1 = storageManager.getStorage('clear-1');
      await storage1.create('test', { data: 'value1' });

      await storageManager.createStorage('clear-2', StorageBackendType.MEMORY);
      const storage2 = storageManager.getStorage('clear-2');
      await storage2.create('test', { data: 'value2' });

      await storageManager.clearAll();

      const cleared1 = await storageManager.getStorage('clear-1').findByType('test');
      const cleared2 = await storageManager.getStorage('clear-2').findByType('test');
      expect(cleared1.length).toBe(0);
      expect(cleared2.length).toBe(0);
    });

    it('should set default storage', async () => {
      await storageManager.createStorage('new-default', StorageBackendType.MEMORY);
      storageManager.setDefaultStorage('new-default');

      expect(storageManager.getDefaultStorageName()).toBe('new-default');
    });

    it('should get default storage name', async () => {
      const defaultName = storageManager.getDefaultStorageName();
      expect(defaultName).toBeDefined();
    });

    it('should check initialization status', async () => {
      expect(storageManager.isInitialized()).toBe(true);
    });

    it('should close storage manager', async () => {
      const localManager = new StorageManager();
      await localManager.initialize();

      expect(localManager.isInitialized()).toBe(true);
      await localManager.close();
      expect(localManager.isInitialized()).toBe(false);
    });
  });

  describe('StorageService', () => {
    it('should create entity', async () => {
      const storage = await storageManager.createStorage(
        'entity-storage',
        StorageBackendType.MEMORY
      );

      const result = await storage.create('user', { name: 'Alice' });

      expect(result.success).toBe(true);
      expect(result.entity).toBeDefined();
      expect(result.entity?.data.name).toBe('Alice');
    });

    it('should read entity', async () => {
      const storage = await storageManager.createStorage('read-storage', StorageBackendType.MEMORY);
      const created = await storage.create('user', { name: 'Bob' });

      const retrieved = await storage.read(created.entity!.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.data.name).toBe('Bob');
    });

    it('should update entity', async () => {
      const storage = await storageManager.createStorage(
        'update-storage',
        StorageBackendType.MEMORY
      );
      const created = await storage.create('user', { name: 'Charlie' });

      const result = await storage.update(created.entity!.id, { name: 'Chuck' });

      expect(result.success).toBe(true);
      expect(result.entity?.data.name).toBe('Chuck');
    });

    it('should delete entity', async () => {
      const storage = await storageManager.createStorage(
        'delete-storage',
        StorageBackendType.MEMORY
      );
      const created = await storage.create('user', { name: 'Dave' });

      const result = await storage.delete(created.entity!.id);

      expect(result.success).toBe(true);

      const retrieved = await storage.read(created.entity!.id);
      expect(retrieved).toBeNull();
    });

    it('should batch create entities', async () => {
      const storage = await storageManager.createStorage(
        'batch-create-storage',
        StorageBackendType.MEMORY
      );

      const result = await storage.batchCreate([
        { type: 'user', data: { name: 'Eve' } },
        { type: 'user', data: { name: 'Frank' } },
      ]);

      expect(result.success).toBe(true);
      expect(result.created.length).toBe(2);
    });

    it('should find entities by type', async () => {
      const storage = await storageManager.createStorage(
        'find-type-storage',
        StorageBackendType.MEMORY
      );

      await storage.create('item', { name: 'Item1' });
      await storage.create('item', { name: 'Item2' });
      await storage.create('user', { name: 'Grace' });

      const items = await storage.findByType('item');

      expect(items.length).toBe(2);
    });
  });
});
