/**
 * PromptRegistry - Manages prompt template registration, lookup, and lifecycle
 *
 * Provides CRUD operations, search/filter, import/export, and category/tag management.
 */

import { createLogger, type Logger } from '@organic/utils';
import type {
  PromptTemplate,
  TemplateFilter,
  ImportResult,
  ImportError,
} from './types/template.js';

/**
 * PromptRegistry class
 */
export class PromptRegistry {
  private logger: Logger;
  private templates: Map<string, PromptTemplate>;

  constructor() {
    this.logger = createLogger({ prefix: 'PromptRegistry' });
    this.templates = new Map();
  }

  // ==================== Public API ====================

  /**
   * Register a new template
   * @param template - Template to register
   * @throws If template with same ID already exists
   */
  register(template: PromptTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Template with id "${template.id}" already exists`);
    }

    this.templates.set(template.id, { ...template });
    this.logger.info(`Template registered: "${template.id}"`);
  }

  /**
   * Unregister a template
   * @param id - Template identifier
   * @returns True if the template was unregistered
   */
  unregister(id: string): boolean {
    const result = this.templates.delete(id);
    if (result) {
      this.logger.info(`Template unregistered: "${id}"`);
    }
    return result;
  }

  /**
   * Get a template by ID
   * @param id - Template identifier
   * @returns The template or undefined if not found
   */
  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Find templates matching the given filter criteria
   * @param filter - Filter criteria
   * @returns Array of matching templates
   */
  find(filter: TemplateFilter): PromptTemplate[] {
    let results = Array.from(this.templates.values());

    // Filter by category
    if (filter.category) {
      results = results.filter(t => t.category === filter.category);
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(t =>
        filter.tags!.some(tag => t.tags.includes(tag))
      );
    }

    // Full-text search
    if (filter.search) {
      const query = filter.search.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    if (filter.sortBy) {
      const order = filter.order === 'desc' ? -1 : 1;
      results.sort((a, b) => {
        if (filter.sortBy === 'name') {
          return order * a.name.localeCompare(b.name);
        }
        if (filter.sortBy === 'createdAt') {
          return order * (a.createdAt - b.createdAt);
        }
        if (filter.sortBy === 'updatedAt') {
          return order * (a.updatedAt - b.updatedAt);
        }
        return 0;
      });
    }

    return results;
  }

  /**
   * List all registered templates
   * @returns Array of all templates
   */
  list(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Update a template's properties
   * @param id - Template identifier
   * @param updates - Partial template updates
   * @returns The updated template
   * @throws If template not found
   */
  update(id: string, updates: Partial<PromptTemplate>): PromptTemplate {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template "${id}" not found`);
    }

    const updated: PromptTemplate = {
      ...template,
      ...updates,
      id: template.id, // ID cannot be changed
      updatedAt: Date.now(),
    };

    this.templates.set(id, updated);
    this.logger.info(`Template updated: "${id}"`);

    return updated;
  }

  /**
   * Import multiple templates
   * @param templates - Templates to import
   * @returns Import result with success/error details
   */
  import(templates: PromptTemplate[]): ImportResult {
    const errors: ImportError[] = [];
    let imported = 0;

    for (const template of templates) {
      try {
        if (this.templates.has(template.id)) {
          // Update existing template
          this.update(template.id, template);
          imported++;
        } else {
          this.register(template);
          imported++;
        }
      } catch (err) {
        errors.push({
          templateId: template.id,
          templateName: template.name,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      success: errors.length === 0,
      imported,
      errors,
    };
  }

  /**
   * Export templates
   * @param ids - Optional array of template IDs to export. If omitted, exports all.
   * @returns Array of exported templates
   */
  export(ids?: string[]): PromptTemplate[] {
    if (!ids) {
      return this.list();
    }

    return ids
      .map(id => this.templates.get(id))
      .filter((t): t is PromptTemplate => t !== undefined);
  }

  /**
   * Get all templates in a category
   * @param category - Category name
   * @returns Array of templates in the category
   */
  getByCategory(category: string): PromptTemplate[] {
    return this.find({ category });
  }

  /**
   * Get all templates with a specific tag
   * @param tag - Tag name
   * @returns Array of templates with the tag
   */
  getByTag(tag: string): PromptTemplate[] {
    return this.find({ tags: [tag] });
  }

  /**
   * Full-text search across templates
   * @param query - Search query
   * @returns Array of matching templates
   */
  search(query: string): PromptTemplate[] {
    return this.find({ search: query });
  }

  /**
   * Get unique categories from all templates
   * @returns Array of category names
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const template of this.templates.values()) {
      if (template.category) {
        categories.add(template.category);
      }
    }
    return Array.from(categories);
  }

  /**
   * Get all unique tags from all templates
   * @returns Array of tag names
   */
  getTags(): string[] {
    const tags = new Set<string>();
    for (const template of this.templates.values()) {
      for (const tag of template.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags);
  }

  /**
   * Get the total number of registered templates
   */
  get count(): number {
    return this.templates.size;
  }

  /**
   * Clear all templates from the registry
   */
  clear(): void {
    this.templates.clear();
    this.logger.info('Registry cleared');
  }
}