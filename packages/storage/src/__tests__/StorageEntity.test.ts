import { describe, it, expect } from 'vitest';
import {
  StorageEntityImpl,
  IndexType,
  createStorageEntity,
  isValidEntity,
  type StorageEntity,
} from '../models/StorageEntity.js';
import { createDefaultMetadata } from '../models/EntityMetadata.js';

describe('StorageEntity', () => {
  describe('StorageEntityImpl', () => {
    describe('constructor', () => {
      it('should create entity with generated id', () => {
        const entity = new StorageEntityImpl('user', { name: 'Test' });

        expect(entity.id).toBeDefined();
        expect(entity.type).toBe('user');
        expect(entity.data.name).toBe('Test');
        expect(entity.version).toBe(1);
      });

      it('should create entity with custom id', () => {
        const entity = new StorageEntityImpl('user', { name: 'Test' }, 'custom-id');

        expect(entity.id).toBe('custom-id');
      });

      it('should create entity with custom metadata', () => {
        const metadata = createDefaultMetadata();
        metadata.created_by = 'creator';
        const entity = new StorageEntityImpl('user', { name: 'Test' }, undefined, metadata);

        expect(entity.metadata.created_by).toBe('creator');
      });

      it('should set created_at and updated_at timestamps', () => {
        const before = Date.now();
        const entity = new StorageEntityImpl('user', {});
        const after = Date.now();

        expect(entity.created_at).toBeGreaterThanOrEqual(before);
        expect(entity.created_at).toBeLessThanOrEqual(after);
        expect(entity.updated_at).toBeGreaterThanOrEqual(before);
        expect(entity.updated_at).toBeLessThanOrEqual(after);
      });

      it('should copy data object', () => {
        const data = { name: 'Test' };
        const entity = new StorageEntityImpl('user', data);
        data.name = 'Modified';

        expect(entity.data.name).toBe('Test');
      });
    });

    describe('updateData', () => {
      it('should update entity data', () => {
        const entity = new StorageEntityImpl('user', { name: 'Original' });
        const originalVersion = entity.version;
        const originalUpdatedAt = entity.updated_at;

        entity.updateData({ name: 'Updated' });

        expect(entity.data.name).toBe('Updated');
        expect(entity.version).toBe(originalVersion + 1);
        expect(entity.updated_at).toBeGreaterThanOrEqual(originalUpdatedAt);
      });

      it('should merge data with existing', () => {
        const entity = new StorageEntityImpl('user', { name: 'Original', age: 25 });
        const originalVersion = entity.version;

        entity.updateData({ age: 30 });

        expect(entity.data.name).toBe('Original');
        expect(entity.data.age).toBe(30);
        expect(entity.version).toBe(originalVersion + 1);
      });

      it('should update metadata when updatedBy is provided', () => {
        const entity = new StorageEntityImpl('user', {});

        entity.updateData({ name: 'Updated' }, 'user-123');

        expect(entity.metadata.updated_by).toBe('user-123');
      });

      it('should increment version on each update', () => {
        const entity = new StorageEntityImpl('user', {});
        const initialVersion = entity.version;

        entity.updateData({ field1: 'value1' });
        expect(entity.version).toBe(initialVersion + 1);

        entity.updateData({ field2: 'value2' });
        expect(entity.version).toBe(initialVersion + 2);
      });
    });

    describe('updateMetadata', () => {
      it('should update metadata', () => {
        const entity = new StorageEntityImpl('user', {});

        entity.updateMetadata({ tags: ['important'] });

        expect(entity.metadata.tags).toEqual(['important']);
      });

      it('should update updated_at timestamp', () => {
        const entity = new StorageEntityImpl('user', {});
        const originalUpdatedAt = entity.updated_at;

        entity.updateMetadata({ source: 'test' });

        expect(entity.updated_at).toBeGreaterThanOrEqual(originalUpdatedAt);
      });
    });

    describe('isExpired', () => {
      it('should return false when expires_at is undefined', () => {
        const entity = new StorageEntityImpl('user', {});

        expect(entity.isExpired()).toBe(false);
      });

      it('should return true when entity is expired', () => {
        const entity = new StorageEntityImpl('user', {});
        entity.metadata.expires_at = Date.now() - 1000;

        expect(entity.isExpired()).toBe(true);
      });

      it('should return false when entity is not expired', () => {
        const entity = new StorageEntityImpl('user', {});
        entity.metadata.expires_at = Date.now() + 10000;

        expect(entity.isExpired()).toBe(false);
      });
    });

    describe('toJSON', () => {
      it('should serialize entity to JSON string', () => {
        const entity = new StorageEntityImpl('user', { name: 'Test' }, 'test-id');
        const json = entity.toJSON();
        const parsed = JSON.parse(json);

        expect(parsed.id).toBe('test-id');
        expect(parsed.type).toBe('user');
        expect(parsed.data.name).toBe('Test');
        expect(parsed.version).toBe(1);
      });
    });

    describe('fromJSON', () => {
      it('should deserialize entity from JSON string', () => {
        const original = new StorageEntityImpl('user', { name: 'Test' }, 'test-id');
        const json = original.toJSON();

        const restored = StorageEntityImpl.fromJSON(json);

        expect(restored.id).toBe('test-id');
        expect(restored.type).toBe('user');
        expect(restored.data.name).toBe('Test');
        expect(restored.version).toBe(1);
      });

      it('should preserve all timestamps', () => {
        const original = new StorageEntityImpl('user', { name: 'Test' }, 'test-id');
        const json = original.toJSON();

        const restored = StorageEntityImpl.fromJSON(json);

        expect(restored.created_at).toBe(original.created_at);
        expect(restored.updated_at).toBe(original.updated_at);
      });
    });

    describe('clone', () => {
      it('should create a copy of the entity', () => {
        const original = new StorageEntityImpl('user', { name: 'Original' }, 'clone-id');
        original.metadata.tags = ['tag1'];

        const cloned = original.clone();

        expect(cloned.id).toBe(original.id);
        expect(cloned.type).toBe(original.type);
        expect(cloned.data.name).toBe('Original');
        expect(cloned.version).toBe(original.version);
        expect(cloned.created_at).toBe(original.created_at);
      });

      it('should create new metadata instance', () => {
        const original = new StorageEntityImpl('user', {});
        original.metadata.tags = ['tag1'];

        const cloned = original.clone();

        expect(cloned.metadata).not.toBe(original.metadata);
        expect(cloned.metadata.tags).toEqual(['tag1']);
      });

      it('should create new data instance', () => {
        const original = new StorageEntityImpl('user', { name: 'Test' });

        const cloned = original.clone();

        expect(cloned.data).not.toBe(original.data);
      });
    });

    describe('toObject', () => {
      it('should return plain object representation', () => {
        const entity = new StorageEntityImpl('user', { name: 'Test' }, 'test-id');

        const obj = entity.toObject();

        expect(obj.id).toBe('test-id');
        expect(obj.type).toBe('user');
        expect(obj.data.name).toBe('Test');
        expect(typeof obj.metadata).toBe('object');
      });

      it('should return copies of data and metadata', () => {
        const entity = new StorageEntityImpl('user', { name: 'Test' });
        entity.metadata.tags = ['tag1'];

        const obj = entity.toObject();

        expect(obj.data).not.toBe(entity.data);
        expect(obj.metadata).not.toBe(entity.metadata);
      });
    });
  });

  describe('IndexType', () => {
    it('should have correct enum values', () => {
      expect(IndexType.PRIMARY).toBe('primary');
      expect(IndexType.UNIQUE).toBe('unique');
      expect(IndexType.MULTI).toBe('multi');
      expect(IndexType.TEXT).toBe('text');
    });
  });

  describe('createStorageEntity', () => {
    it('should create storage entity with type and data', () => {
      const entity = createStorageEntity('user', { name: 'Test' });

      expect(entity.type).toBe('user');
      expect(entity.data.name).toBe('Test');
    });

    it('should accept options with custom id', () => {
      const entity = createStorageEntity('user', { name: 'Test' }, { id: 'custom-id' });

      expect(entity.id).toBe('custom-id');
    });

    it('should accept options with custom metadata', () => {
      const metadata = createDefaultMetadata();
      metadata.created_by = 'creator';
      const entity = createStorageEntity('user', { name: 'Test' }, { metadata });

      expect(entity.metadata.created_by).toBe('creator');
    });
  });

  describe('isValidEntity', () => {
    it('should return true for valid entity', () => {
      const entity: StorageEntity = {
        id: 'test',
        type: 'user',
        data: {},
        metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        version: 1,
      };

      expect(isValidEntity(entity)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidEntity(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidEntity(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidEntity('string')).toBe(false);
      expect(isValidEntity(123)).toBe(false);
    });

    it('should return false when missing id', () => {
      const entity = {
        type: 'user',
        data: {},
        metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        version: 1,
      } as unknown as StorageEntity;

      expect(isValidEntity(entity)).toBe(false);
    });

    it('should return false when id is not string', () => {
      const entity = {
        id: 123,
        type: 'user',
        data: {},
        metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        version: 1,
      } as unknown as StorageEntity;

      expect(isValidEntity(entity)).toBe(false);
    });

    it('should return false when missing type', () => {
      const entity = {
        id: 'test',
        data: {},
        metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        version: 1,
      } as unknown as StorageEntity;

      expect(isValidEntity(entity)).toBe(false);
    });

    it('should return false when data is not object', () => {
      const entity = {
        id: 'test',
        type: 'user',
        data: 'not-an-object',
        metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        version: 1,
      } as unknown as StorageEntity;

      expect(isValidEntity(entity)).toBe(false);
    });

    it('should return false when missing timestamps', () => {
      const entity = {
        id: 'test',
        type: 'user',
        data: {},
        metadata: {},
        version: 1,
      } as unknown as StorageEntity;

      expect(isValidEntity(entity)).toBe(false);
    });

    it('should return false when version is not number', () => {
      const entity = {
        id: 'test',
        type: 'user',
        data: {},
        metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        version: '1',
      } as unknown as StorageEntity;

      expect(isValidEntity(entity)).toBe(false);
    });

    it('should return true for entity with custom fields', () => {
      const entity: StorageEntity = {
        id: 'test',
        type: 'user',
        data: { custom: 'field' },
        metadata: { customField: 'value' },
        created_at: Date.now(),
        updated_at: Date.now(),
        version: 1,
      };

      expect(isValidEntity(entity)).toBe(true);
    });
  });
});
