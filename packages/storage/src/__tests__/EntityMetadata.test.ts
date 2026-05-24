import { describe, it, expect } from 'vitest';
import {
  EntityMetadata,
  createDefaultMetadata,
  isMetadataExpired,
  cloneMetadata,
} from '../models/EntityMetadata.js';

describe('EntityMetadata', () => {
  describe('createDefaultMetadata', () => {
    it('should create default metadata with empty values', () => {
      const metadata = createDefaultMetadata();

      expect(metadata.created_by).toBeUndefined();
      expect(metadata.updated_by).toBeUndefined();
      expect(metadata.tags).toEqual([]);
      expect(metadata.expires_at).toBeUndefined();
      expect(metadata.source).toBeUndefined();
    });

    it('should return empty tags array', () => {
      const metadata = createDefaultMetadata();
      expect(Array.isArray(metadata.tags)).toBe(true);
      expect(metadata.tags.length).toBe(0);
    });
  });

  describe('isMetadataExpired', () => {
    it('should return false when expires_at is undefined', () => {
      const metadata: EntityMetadata = {};
      expect(isMetadataExpired(metadata)).toBe(false);
    });

    it('should return false when expires_at is in the future', () => {
      const metadata: EntityMetadata = {
        expires_at: Date.now() + 10000,
      };
      expect(isMetadataExpired(metadata)).toBe(false);
    });

    it('should return true when expires_at is in the past', () => {
      const metadata: EntityMetadata = {
        expires_at: Date.now() - 10000,
      };
      expect(isMetadataExpired(metadata)).toBe(true);
    });

    it('should return false when expires_at equals current time', () => {
      const now = Date.now();
      const metadata: EntityMetadata = {
        expires_at: now,
      };
      expect(isMetadataExpired(metadata)).toBe(false);
    });

    it('should return false when expires_at is just in the future', () => {
      const metadata: EntityMetadata = {
        expires_at: Date.now() + 1,
      };
      expect(isMetadataExpired(metadata)).toBe(false);
    });
  });

  describe('cloneMetadata', () => {
    it('should clone metadata with all properties', () => {
      const original: EntityMetadata = {
        created_by: 'user1',
        updated_by: 'user2',
        tags: ['tag1', 'tag2'],
        expires_at: Date.now() + 10000,
        source: 'test',
      };

      const cloned = cloneMetadata(original);

      expect(cloned.created_by).toBe(original.created_by);
      expect(cloned.updated_by).toBe(original.updated_by);
      expect(cloned.tags).toEqual(original.tags);
      expect(cloned.expires_at).toBe(original.expires_at);
      expect(cloned.source).toBe(original.source);
    });

    it('should create new tags array instance', () => {
      const original: EntityMetadata = {
        tags: ['tag1', 'tag2'],
      };

      const cloned = cloneMetadata(original);

      expect(cloned.tags).not.toBe(original.tags);
      cloned.tags?.push('tag3');
      expect(original.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle undefined tags', () => {
      const original: EntityMetadata = {
        tags: undefined,
      };

      const cloned = cloneMetadata(original);

      expect(cloned.tags).toBeUndefined();
    });

    it('should handle empty tags', () => {
      const original: EntityMetadata = {
        tags: [],
      };

      const cloned = cloneMetadata(original);

      expect(cloned.tags).toEqual([]);
      expect(cloned.tags).not.toBe(original.tags);
    });

    it('should preserve custom fields', () => {
      const original: EntityMetadata = {
        customField: 'value',
        anotherField: 123,
      };

      const cloned = cloneMetadata(original);

      expect(cloned.customField).toBe('value');
      expect(cloned.anotherField).toBe(123);
    });
  });

  describe('EntityMetadata interface', () => {
    it('should allow custom fields', () => {
      const metadata: EntityMetadata = {
        created_by: 'user',
        customField: 'any value',
        anotherCustom: { nested: true },
      };

      expect(metadata.created_by).toBe('user');
      expect(metadata.customField).toBe('any value');
      expect((metadata.anotherCustom as any).nested).toBe(true);
    });

    it('should support index signature', () => {
      const metadata: EntityMetadata = {};
      metadata['dynamicKey'] = 'dynamicValue';
      metadata[123] = 'numberKey';

      expect(metadata['dynamicKey']).toBe('dynamicValue');
      expect(metadata[123]).toBe('numberKey');
    });
  });
});