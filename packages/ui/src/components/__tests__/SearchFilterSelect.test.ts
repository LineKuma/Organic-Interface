import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SearchFilterSelect,
  type SearchFilterOption,
  type SearchFilterConfig,
} from '../SearchFilterSelect.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Helper to create test options
function createOptions(count: number, prefix = 'Option'): SearchFilterOption[] {
  return Array.from({ length: count }, (_, i) => ({
    value: `${prefix.toLowerCase()}-${i + 1}`,
    label: `${prefix} ${i + 1}`,
    description: `Description for ${prefix} ${i + 1}`,
    tags: i % 2 === 0 ? ['frontend', 'ui'] : ['backend', 'api'],
    disabled: i === count - 1,
    metadata: { index: i },
  }));
}

describe('SearchFilterSelect', () => {
  let select: SearchFilterSelect;

  beforeEach(() => {
    select = new SearchFilterSelect();
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(select).toBeDefined();
    });
  });

  describe('render', () => {
    it('should return first option in non-interactive mode', async () => {
      const options = createOptions(5);
      const result = await select.render(options);
      expect(result).toBeDefined();
      expect(result!.value).toBe('option-1');
    });

    it('should return null when no options', async () => {
      const result = await select.render([]);
      expect(result).toBeNull();
    });

    it('should filter out disabled options', async () => {
      const options: SearchFilterOption[] = [
        { value: 'a', label: 'A', disabled: true },
        { value: 'b', label: 'B' },
      ];
      const result = await select.render(options);
      expect(result).toBeDefined();
      expect(result!.value).toBe('b');
    });

    it('should return null when all options are disabled', async () => {
      const options: SearchFilterOption[] = [
        { value: 'a', label: 'A', disabled: true },
        { value: 'b', label: 'B', disabled: true },
      ];
      const result = await select.render(options);
      expect(result).toBeNull();
    });
  });

  describe('renderMulti', () => {
    it('should return first option in non-interactive mode', async () => {
      const options = createOptions(5);
      const result = await select.renderMulti(options);
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('option-1');
    });

    it('should return empty array when no options', async () => {
      const result = await select.renderMulti([]);
      expect(result).toEqual([]);
    });
  });

  describe('search', () => {
    it('should filter by fuzzy match on label', () => {
      const options = createOptions(10);
      const results = select.search(options, 'Option 1');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every(r => r.label.includes('1'))).toBe(true);
    });

    it('should filter by fuzzy match on value', () => {
      const options = createOptions(10);
      const results = select.search(options, 'option-2');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by fuzzy match on description', () => {
      const options = createOptions(10);
      const results = select.search(options, 'Description');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for no matches', () => {
      const options = createOptions(5);
      const results = select.search(options, 'zzzznotfound');
      expect(results).toHaveLength(0);
    });

    it('should exclude disabled options from search results', () => {
      const options = createOptions(5);
      const results = select.search(options, 'Option 5');
      expect(results).toHaveLength(0);
    });

    it('should support case-sensitive search', () => {
      const options = createOptions(5);
      const caseSensitive = select.search(options, 'OPTION', true);
      const caseInsensitive = select.search(options, 'OPTION', false);
      expect(caseInsensitive.length).toBeGreaterThanOrEqual(caseSensitive.length);
    });

    it('should return all non-disabled options for empty query', () => {
      const options = createOptions(5);
      const results = select.search(options, '');
      expect(results.length).toBe(4); // 5 total, 1 disabled
    });
  });

  describe('filterByTag', () => {
    it('should filter by single tag', () => {
      const options = createOptions(10);
      const results = select.filterByTag(options, ['frontend']);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.tags?.includes('frontend'))).toBe(true);
    });

    it('should filter by multiple tags', () => {
      const options = createOptions(10);
      const results = select.filterByTag(options, ['frontend', 'backend']);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return all non-disabled options for empty tags', () => {
      const options = createOptions(5);
      const results = select.filterByTag(options, []);
      expect(results.length).toBe(4);
    });

    it('should return empty for non-matching tags', () => {
      const options = createOptions(5);
      const results = select.filterByTag(options, ['nonexistent']);
      expect(results).toHaveLength(0);
    });
  });

  describe('getTags', () => {
    it('should collect all unique tags', () => {
      const options = createOptions(10);
      const tags = select.getTags(options);
      expect(tags).toContain('api');
      expect(tags).toContain('backend');
      expect(tags).toContain('frontend');
      expect(tags).toContain('ui');
    });

    it('should return empty array for options without tags', () => {
      const options: SearchFilterOption[] = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      const tags = select.getTags(options);
      expect(tags).toEqual([]);
    });
  });

  describe('paginate', () => {
    it('should return first page', () => {
      const options = createOptions(25);
      const page = select.paginate(options, 0, 10);
      expect(page).toHaveLength(10);
      expect(page[0].value).toBe('option-1');
    });

    it('should return second page', () => {
      const options = createOptions(25);
      const page = select.paginate(options, 1, 10);
      expect(page).toHaveLength(10);
      expect(page[0].value).toBe('option-11');
    });

    it('should return partial last page', () => {
      const options = createOptions(25);
      const page = select.paginate(options, 2, 10);
      expect(page).toHaveLength(5);
    });

    it('should return empty for out of bounds', () => {
      const options = createOptions(25);
      const page = select.paginate(options, 10, 10);
      expect(page).toEqual([]);
    });
  });

  describe('highlightText', () => {
    it('should highlight matching characters', () => {
      const result = select.highlightText('Hello World', 'Hel');
      // Should contain ANSI highlight codes
      expect(result).toContain('\x1b[7m');
    });

    it('should return original text for empty query', () => {
      const result = select.highlightText('Hello', '');
      expect(result).toBe('Hello');
    });

    it('should handle case-insensitive highlighting', () => {
      const result = select.highlightText('Hello', 'hel', false);
      expect(result).toContain('\x1b[7m');
    });
  });

  describe('formatOption', () => {
    it('should format option with label and value', () => {
      const option: SearchFilterOption = { value: 'test', label: 'Test' };
      const config: Required<SearchFilterConfig> = {
        placeholder: 'Search...',
        pageSize: 10,
        enableSearch: true,
        enableTags: true,
        enableDescriptions: true,
        sortBy: 'relevance',
        caseSensitive: false,
      };
      const formatted = select.formatOption(option, 1, config, '', false, false);
      expect(formatted).toContain('Test');
      expect(formatted).toContain('test');
    });

    it('should format option with cursor indicator', () => {
      const option: SearchFilterOption = { value: 'test', label: 'Test' };
      const config: Required<SearchFilterConfig> = {
        placeholder: 'Search...',
        pageSize: 10,
        enableSearch: true,
        enableTags: true,
        enableDescriptions: true,
        sortBy: 'relevance',
        caseSensitive: false,
      };
      const formatted = select.formatOption(option, 1, config, '', false, true);
      expect(formatted).toContain('>');
    });

    it('should format option with selected indicator', () => {
      const option: SearchFilterOption = { value: 'test', label: 'Test' };
      const config: Required<SearchFilterConfig> = {
        placeholder: 'Search...',
        pageSize: 10,
        enableSearch: true,
        enableTags: true,
        enableDescriptions: true,
        sortBy: 'relevance',
        caseSensitive: false,
      };
      const formatted = select.formatOption(option, 1, config, '', true, false);
      expect(formatted).toContain('●');
    });

    it('should include description when enabled', () => {
      const option: SearchFilterOption = {
        value: 'test',
        label: 'Test',
        description: 'A test option',
      };
      const config: Required<SearchFilterConfig> = {
        placeholder: 'Search...',
        pageSize: 10,
        enableSearch: true,
        enableTags: true,
        enableDescriptions: true,
        sortBy: 'relevance',
        caseSensitive: false,
      };
      const formatted = select.formatOption(option, 1, config, '', false, false);
      expect(formatted).toContain('A test option');
    });

    it('should include tags when enabled', () => {
      const option: SearchFilterOption = {
        value: 'test',
        label: 'Test',
        tags: ['ui', 'react'],
      };
      const config: Required<SearchFilterConfig> = {
        placeholder: 'Search...',
        pageSize: 10,
        enableSearch: true,
        enableTags: true,
        enableDescriptions: true,
        sortBy: 'relevance',
        caseSensitive: false,
      };
      const formatted = select.formatOption(option, 1, config, '', false, false);
      expect(formatted).toContain('ui');
      expect(formatted).toContain('react');
    });

    it('should show disabled indicator', () => {
      const option: SearchFilterOption = {
        value: 'test',
        label: 'Test',
        disabled: true,
      };
      const config: Required<SearchFilterConfig> = {
        placeholder: 'Search...',
        pageSize: 10,
        enableSearch: true,
        enableTags: true,
        enableDescriptions: true,
        sortBy: 'relevance',
        caseSensitive: false,
      };
      const formatted = select.formatOption(option, 1, config, '', false, false);
      expect(formatted).toContain('disabled');
    });
  });

  describe('formatDisplay', () => {
    it('should format the full display', () => {
      const options = createOptions(5);
      const config: Required<SearchFilterConfig> = {
        placeholder: 'Search...',
        pageSize: 10,
        enableSearch: true,
        enableTags: true,
        enableDescriptions: true,
        sortBy: 'relevance',
        caseSensitive: false,
      };
      const state = {
        query: '',
        selectedTags: new Set<string>(),
        currentPage: 0,
        totalPages: 1,
        filteredOptions: options,
        selectedMulti: new Set<string>(),
        cursor: 0,
      };
      const allTags = select.getTags(options);
      const display = select.formatDisplay(options, config, state, allTags, false);
      expect(display).toContain('SearchFilterSelect');
      expect(display).toContain('Search:');
    });

    it('should show no results message', () => {
      const config: Required<SearchFilterConfig> = {
        placeholder: 'Search...',
        pageSize: 10,
        enableSearch: true,
        enableTags: true,
        enableDescriptions: true,
        sortBy: 'relevance',
        caseSensitive: false,
      };
      const state = {
        query: '',
        selectedTags: new Set<string>(),
        currentPage: 0,
        totalPages: 0,
        filteredOptions: [],
        selectedMulti: new Set<string>(),
        cursor: 0,
      };
      const display = select.formatDisplay([], config, state, [], false);
      expect(display).toContain('No results');
    });
  });

  describe('sorting', () => {
    it('should sort by label when configured', async () => {
      const options: SearchFilterOption[] = [
        { value: 'c', label: 'C' },
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      const result = await select.render(options, { sortBy: 'label' });
      expect(result).toBeDefined();
      // In non-interactive mode, sorted by label first should return 'A'
      expect(result!.value).toBe('a');
    });

    it('should sort by value when configured', async () => {
      const options: SearchFilterOption[] = [
        { value: 'c', label: 'C Option' },
        { value: 'a', label: 'A Option' },
        { value: 'b', label: 'B Option' },
      ];
      const result = await select.render(options, { sortBy: 'value' });
      expect(result).toBeDefined();
      expect(result!.value).toBe('a');
    });
  });

  describe('pagination in render', () => {
    it('should handle large option lists', async () => {
      const options = createOptions(50);
      const result = await select.render(options, { pageSize: 10 });
      expect(result).toBeDefined();
    });

    it('should handle custom page size', async () => {
      const options = createOptions(100);
      const result = await select.render(options, { pageSize: 5 });
      expect(result).toBeDefined();
    });
  });

  describe('config options', () => {
    it('should disable search when configured', async () => {
      const options = createOptions(5);
      const result = await select.render(options, { enableSearch: false });
      expect(result).toBeDefined();
    });

    it('should disable tags when configured', async () => {
      const options = createOptions(5);
      const result = await select.render(options, { enableTags: false });
      expect(result).toBeDefined();
    });

    it('should disable descriptions when configured', async () => {
      const options = createOptions(5);
      const result = await select.render(options, { enableDescriptions: false });
      expect(result).toBeDefined();
    });
  });
});
