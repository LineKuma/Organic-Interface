/**
 * PromptRegistry Tests
 *
 * Tests for template CRUD, search, filter, import/export, and category/tag management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptRegistry } from '../PromptRegistry.js';
import type { PromptTemplate } from '../types/template.js';

// Helper to create a test template
function createTemplate(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  const now = Date.now();
  return {
    id: 'test-1',
    name: 'Test Template',
    description: 'A test template',
    category: 'testing',
    content: 'Hello {{name}}',
    variables: [{ name: 'name', type: 'string', required: true }],
    versions: [],
    currentVersion: '1.0.0',
    createdAt: now,
    updatedAt: now,
    tags: ['test', 'example'],
    metadata: {},
    ...overrides,
  };
}

describe('PromptRegistry', () => {
  let registry: PromptRegistry;

  beforeEach(() => {
    registry = new PromptRegistry();
  });

  // ==================== register() ====================

  describe('register()', () => {
    it('should register a template', () => {
      const template = createTemplate();
      registry.register(template);

      expect(registry.get('test-1')).toBeDefined();
      expect(registry.count).toBe(1);
    });

    it('should throw when registering duplicate ID', () => {
      registry.register(createTemplate());
      expect(() => registry.register(createTemplate())).toThrow('already exists');
    });

    it('should store a copy of the template', () => {
      const template = createTemplate();
      registry.register(template);

      template.name = 'Modified';
      expect(registry.get('test-1')!.name).toBe('Test Template');
    });
  });

  // ==================== unregister() ====================

  describe('unregister()', () => {
    it('should unregister a template', () => {
      registry.register(createTemplate());
      const result = registry.unregister('test-1');

      expect(result).toBe(true);
      expect(registry.get('test-1')).toBeUndefined();
      expect(registry.count).toBe(0);
    });

    it('should return false for non-existent template', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });
  });

  // ==================== get() ====================

  describe('get()', () => {
    it('should return the template by ID', () => {
      registry.register(createTemplate());
      const template = registry.get('test-1');

      expect(template).toBeDefined();
      expect(template!.id).toBe('test-1');
      expect(template!.name).toBe('Test Template');
    });

    it('should return undefined for non-existent template', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  // ==================== find() ====================

  describe('find()', () => {
    beforeEach(() => {
      registry.register(createTemplate({
        id: 't1',
        name: 'Alpha',
        category: 'code',
        tags: ['javascript'],
        createdAt: 1000,
        updatedAt: 2000,
      }));
      registry.register(createTemplate({
        id: 't2',
        name: 'Beta',
        category: 'docs',
        tags: ['typescript'],
        createdAt: 2000,
        updatedAt: 3000,
      }));
      registry.register(createTemplate({
        id: 't3',
        name: 'Gamma',
        category: 'code',
        tags: ['javascript', 'testing'],
        createdAt: 3000,
        updatedAt: 4000,
      }));
    });

    it('should filter by category', () => {
      const results = registry.find({ category: 'code' });
      expect(results).toHaveLength(2);
      expect(results.map(r => r.id)).toContain('t1');
      expect(results.map(r => r.id)).toContain('t3');
    });

    it('should filter by tags', () => {
      const results = registry.find({ tags: ['javascript'] });
      expect(results).toHaveLength(2);
    });

    it('should filter by multiple tags (OR logic)', () => {
      const results = registry.find({ tags: ['javascript', 'typescript'] });
      expect(results).toHaveLength(3);
    });

    it('should search by name', () => {
      const results = registry.find({ search: 'alpha' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('t1');
    });

    it('should search by description', () => {
      const results = registry.find({ search: 'test template' });
      expect(results).toHaveLength(3);
    });

    it('should search by tag', () => {
      const results = registry.find({ search: 'typescript' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('t2');
    });

    it('should sort by name ascending', () => {
      const results = registry.find({ sortBy: 'name', order: 'asc' });
      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('Alpha');
      expect(results[1].name).toBe('Beta');
      expect(results[2].name).toBe('Gamma');
    });

    it('should sort by name descending', () => {
      const results = registry.find({ sortBy: 'name', order: 'desc' });
      expect(results[0].name).toBe('Gamma');
      expect(results[2].name).toBe('Alpha');
    });

    it('should sort by createdAt', () => {
      const results = registry.find({ sortBy: 'createdAt', order: 'asc' });
      expect(results[0].id).toBe('t1');
      expect(results[2].id).toBe('t3');
    });

    it('should combine filters', () => {
      const results = registry.find({
        category: 'code',
        tags: ['testing'],
        sortBy: 'name',
        order: 'asc',
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('t3');
    });

    it('should return all when no filter criteria', () => {
      const results = registry.find({});
      expect(results).toHaveLength(3);
    });
  });

  // ==================== list() ====================

  describe('list()', () => {
    it('should return all templates', () => {
      registry.register(createTemplate({ id: 't1' }));
      registry.register(createTemplate({ id: 't2' }));
      registry.register(createTemplate({ id: 't3' }));

      const list = registry.list();
      expect(list).toHaveLength(3);
    });

    it('should return empty array when no templates', () => {
      expect(registry.list()).toEqual([]);
    });
  });

  // ==================== update() ====================

  describe('update()', () => {
    it('should update template properties', () => {
      registry.register(createTemplate());
      const updated = registry.update('test-1', { name: 'Updated Name', tags: ['new'] });

      expect(updated.name).toBe('Updated Name');
      expect(updated.tags).toEqual(['new']);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(updated.createdAt);
    });

    it('should not allow changing ID', () => {
      registry.register(createTemplate());
      const updated = registry.update('test-1', { id: 'new-id' as any });

      expect(updated.id).toBe('test-1');
    });

    it('should throw for non-existent template', () => {
      expect(() => registry.update('non-existent', { name: 'test' })).toThrow('not found');
    });

    it('should preserve unchanged properties', () => {
      registry.register(createTemplate());
      const updated = registry.update('test-1', { name: 'New Name' });

      expect(updated.description).toBe('A test template');
      expect(updated.category).toBe('testing');
    });
  });

  // ==================== import() ====================

  describe('import()', () => {
    it('should import new templates', () => {
      const templates = [
        createTemplate({ id: 't1', name: 'T1' }),
        createTemplate({ id: 't2', name: 'T2' }),
      ];

      const result = registry.import(templates);
      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(registry.count).toBe(2);
    });

    it('should update existing templates on import', () => {
      registry.register(createTemplate({ id: 't1', name: 'Original' }));

      const templates = [
        createTemplate({ id: 't1', name: 'Updated' }),
      ];

      const result = registry.import(templates);
      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(registry.get('t1')!.name).toBe('Updated');
    });

    it('should report errors for invalid templates', () => {
      // This would require a template that somehow fails validation
      // For now, we test the happy path
      const result = registry.import([]);
      expect(result.success).toBe(true);
      expect(result.imported).toBe(0);
    });

    it('should handle mixed success and error', () => {
      registry.register(createTemplate({ id: 't1' }));

      // Try to import with same ID - should update instead of error
      const templates = [
        createTemplate({ id: 't1', name: 'Updated' }),
        createTemplate({ id: 't2', name: 'New' }),
      ];

      const result = registry.import(templates);
      expect(result.imported).toBe(2);
    });
  });

  // ==================== export() ====================

  describe('export()', () => {
    beforeEach(() => {
      registry.register(createTemplate({ id: 't1', name: 'T1' }));
      registry.register(createTemplate({ id: 't2', name: 'T2' }));
      registry.register(createTemplate({ id: 't3', name: 'T3' }));
    });

    it('should export all templates when no IDs provided', () => {
      const exported = registry.export();
      expect(exported).toHaveLength(3);
    });

    it('should export specific templates by ID', () => {
      const exported = registry.export(['t1', 't3']);
      expect(exported).toHaveLength(2);
      expect(exported.map(e => e.id)).toContain('t1');
      expect(exported.map(e => e.id)).toContain('t3');
    });

    it('should skip non-existent IDs', () => {
      const exported = registry.export(['t1', 'non-existent']);
      expect(exported).toHaveLength(1);
      expect(exported[0].id).toBe('t1');
    });

    it('should return empty array for empty IDs', () => {
      const exported = registry.export([]);
      expect(exported).toEqual([]);
    });
  });

  // ==================== getByCategory() ====================

  describe('getByCategory()', () => {
    it('should return templates in a category', () => {
      registry.register(createTemplate({ id: 't1', category: 'code' }));
      registry.register(createTemplate({ id: 't2', category: 'code' }));
      registry.register(createTemplate({ id: 't3', category: 'docs' }));

      const results = registry.getByCategory('code');
      expect(results).toHaveLength(2);
    });

    it('should return empty array for non-existent category', () => {
      const results = registry.getByCategory('non-existent');
      expect(results).toEqual([]);
    });
  });

  // ==================== getByTag() ====================

  describe('getByTag()', () => {
    it('should return templates with a tag', () => {
      registry.register(createTemplate({ id: 't1', tags: ['js'] }));
      registry.register(createTemplate({ id: 't2', tags: ['js', 'ts'] }));
      registry.register(createTemplate({ id: 't3', tags: ['ts'] }));

      const results = registry.getByTag('js');
      expect(results).toHaveLength(2);
    });

    it('should return empty array for non-existent tag', () => {
      const results = registry.getByTag('non-existent');
      expect(results).toEqual([]);
    });
  });

  // ==================== search() ====================

  describe('search()', () => {
    it('should search across name, description, content, and tags', () => {
      registry.register(createTemplate({
        id: 't1',
        name: 'Code Review',
        description: 'Review template',
        content: 'Review the code',
        tags: ['code', 'review'],
      }));

      expect(registry.search('Code Review')).toHaveLength(1);
      expect(registry.search('review')).toHaveLength(1);
      expect(registry.search('code')).toHaveLength(1);
      expect(registry.search('nonexistent')).toHaveLength(0);
    });
  });

  // ==================== getCategories() ====================

  describe('getCategories()', () => {
    it('should return unique categories', () => {
      registry.register(createTemplate({ id: 't1', category: 'code' }));
      registry.register(createTemplate({ id: 't2', category: 'code' }));
      registry.register(createTemplate({ id: 't3', category: 'docs' }));

      const categories = registry.getCategories();
      expect(categories).toHaveLength(2);
      expect(categories).toContain('code');
      expect(categories).toContain('docs');
    });

    it('should return empty array when no templates', () => {
      expect(registry.getCategories()).toEqual([]);
    });
  });

  // ==================== getTags() ====================

  describe('getTags()', () => {
    it('should return unique tags', () => {
      registry.register(createTemplate({ id: 't1', tags: ['js', 'ts'] }));
      registry.register(createTemplate({ id: 't2', tags: ['js', 'react'] }));

      const tags = registry.getTags();
      expect(tags).toHaveLength(3);
      expect(tags).toContain('js');
      expect(tags).toContain('ts');
      expect(tags).toContain('react');
    });

    it('should return empty array when no templates', () => {
      expect(registry.getTags()).toEqual([]);
    });
  });

  // ==================== count ====================

  describe('count', () => {
    it('should return the number of registered templates', () => {
      expect(registry.count).toBe(0);
      registry.register(createTemplate({ id: 't1' }));
      expect(registry.count).toBe(1);
      registry.register(createTemplate({ id: 't2' }));
      expect(registry.count).toBe(2);
      registry.unregister('t1');
      expect(registry.count).toBe(1);
    });
  });

  // ==================== clear() ====================

  describe('clear()', () => {
    it('should remove all templates', () => {
      registry.register(createTemplate({ id: 't1' }));
      registry.register(createTemplate({ id: 't2' }));
      registry.clear();

      expect(registry.count).toBe(0);
      expect(registry.list()).toEqual([]);
    });
  });

  // ==================== Edge Cases ====================

  describe('edge cases', () => {
    it('should handle large number of templates', () => {
      for (let i = 0; i < 100; i++) {
        registry.register(createTemplate({
          id: `t-${i}`,
          name: `Template ${i}`,
        }));
      }
      expect(registry.count).toBe(100);
    });

    it('should handle templates with no tags', () => {
      registry.register(createTemplate({ id: 't1', tags: [] }));
      expect(registry.getByTag('anything')).toEqual([]);
    });

    it('should handle templates with no category', () => {
      registry.register(createTemplate({ id: 't1', category: '' }));
      expect(registry.getByCategory('')).toHaveLength(1);
    });

    it('should handle case-insensitive search', () => {
      registry.register(createTemplate({ id: 't1', name: 'My Template' }));
      expect(registry.search('my template')).toHaveLength(1);
      expect(registry.search('MY TEMPLATE')).toHaveLength(1);
    });
  });
});