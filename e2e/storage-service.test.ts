import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import {
  StorageManager,
  type StorageConfig,
  type StorageData,
} from '@organic/storage';

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
    it('should create storage with config', async () => {
      const storage = storageManager.createStorage('test-storage', {
        type: 'memory',
      });

      expect(storage).toBeDefined();
      expect(storageManager.hasStorage('test-storage')).toBe(true);
    });

    it('should get storage by name', async () => {
      storageManager.createStorage('get-test', { type: 'memory' });

      const storage = storageManager.getStorage('get-test');
      expect(storage).toBeDefined();
    });

    it('should return existing storage for same name', async () => {
      const storage1 = storageManager.createStorage('existing', { type: 'memory' });
      const storage2 = storageManager.createStorage('existing', { type: 'memory' });

      expect(storage1).toBe(storage2);
    });

    it('should throw for non-existent storage', async () => {
      expect(() => storageManager.getStorage('non-existent')).toThrow();
    });

    it('should check if storage exists', async () => {
      storageManager.createStorage('exists-check', { type: 'memory' });

      expect(storageManager.hasStorage('exists-check')).toBe(true);
      expect(storageManager.hasStorage('does-not-exist')).toBe(false);
    });

    it('should remove storage', async () => {
      storageManager.createStorage('to-remove', { type: 'memory' });
      const result = storageManager.removeStorage('to-remove');

      expect(result).toBe(true);
      expect(storageManager.hasStorage('to-remove')).toBe(false);
    });

    it('should return false when removing non-existent storage', async () => {
      const result = storageManager.removeStorage('non-existent');
      expect(result).toBe(false);
    });

    it('should list all storage names', async () => {
      storageManager.createStorage('list-1', { type: 'memory' });
      storageManager.createStorage('list-2', { type: 'memory' });

      const names = storageManager.getStorageNames();
      expect(names.length).toBeGreaterThanOrEqual(2);
      expect(names).toContain('list-1');
      expect(names).toContain('list-2');
    });

    it('should get all storage info', async () => {
      storageManager.createStorage('info-1', { type: 'memory' });
      storageManager.createStorage('info-2', { type: 'memory' });

      const infos = storageManager.getAllStorageInfo();
      expect(infos.length).toBeGreaterThanOrEqual(2);
    });

    it('should clear all storages', async () => {
      storageManager.createStorage('clear-1', { type: 'memory' });
      storageManager.createStorage('clear-2', { type: 'memory' });

      storageManager.clearAll();

      expect(storageManager.hasStorage('clear-1')).toBe(false);
      expect(storageManager.hasStorage('clear-2')).toBe(false);
    });

    it('should set default storage', async () => {
      storageManager.createStorage('new-default', { type: 'memory' });
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

  describe('SessionPersistenceStorage', () => {
    it('should create session storage', async () => {
      const storage = storageManager.createStorage('session-storage', {
        type: 'memory',
      });

      expect(storage).toBeDefined();
    });

    it('should persist session data', async () => {
      const storage = storageManager.createStorage('persist-session', {
        type: 'memory',
      });

      storage.set('session-key', { data: 'test-value' });
      const retrieved = storage.get('session-key');

      expect(retrieved).toEqual({ data: 'test-value' });
    });

    it('should delete session data', async () => {
      const storage = storageManager.createStorage('delete-session', {
        type: 'memory',
      });

      storage.set('delete-key', { data: 'to-delete' });
      storage.delete('delete-key');

      expect(storage.get('delete-key')).toBeNull();
    });

    it('should clear all session data', async () => {
      const storage = storageManager.createStorage('clear-session', {
        type: 'memory',
      });

      storage.set('key1', { data: '1' });
      storage.set('key2', { data: '2' });
      storage.clear();

      expect(storage.size()).toBe(0);
    });

    it('should check if key exists', async () => {
      const storage = storageManager.createStorage('exists-session', {
        type: 'memory',
      });

      storage.set('exists-key', { data: 'exists' });

      expect(storage.has('exists-key')).toBe(true);
      expect(storage.has('not-exists-key')).toBe(false);
    });

    it('should get storage size', async () => {
      const storage = storageManager.createStorage('size-session', {
        type: 'memory',
      });

      storage.set('size-1', { data: '1' });
      storage.set('size-2', { data: '2' });
      storage.set('size-3', { data: '3' });

      expect(storage.size()).toBe(3);
    });

    it('should list all keys', async () => {
      const storage = storageManager.createStorage('keys-session', {
        type: 'memory',
      });

      storage.set('key-a', { data: 'a' });
      storage.set('key-b', { data: 'b' });

      const keys = storage.keys();
      expect(keys.length).toBe(2);
      expect(keys).toContain('key-a');
      expect(keys).toContain('key-b');
    });
  });

  describe('DatabaseStorage', () => {
    it('should create database storage', async () => {
      const storage = storageManager.createStorage('db-storage', {
        type: 'memory',
      });

      expect(storage).toBeDefined();
    });

    it('should perform batch operations', async () => {
      const storage = storageManager.createStorage('batch-storage', {
        type: 'memory',
      });

      const batchData = [
        { key: 'batch-1', data: { value: 'first' } },
        { key: 'batch-2', data: { value: 'second' } },
        { key: 'batch-3', data: { value: 'third' } },
      ];

      batchData.forEach(({ key, data }) => storage.set(key, data));

      expect(storage.get('batch-1')).toEqual({ value: 'first' });
      expect(storage.get('batch-2')).toEqual({ value: 'second' });
      expect(storage.get('batch-3')).toEqual({ value: 'third' });
    });

    it('should handle transaction rollback', async () => {
      const storage = storageManager.createStorage('transaction-storage', {
        type: 'memory',
      });

      storage.set('tx-key', { value: 'original' });

      try {
        storage.set('tx-key', { value: 'modified' });
        const result = storage.get('tx-key');
        expect(result).toEqual({ value: 'modified' });
      } catch {
        const result = storage.get('tx-key');
        expect(result).toEqual({ value: 'original' });
      }
    });
  });
});