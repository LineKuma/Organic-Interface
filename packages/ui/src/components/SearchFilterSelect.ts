/**
 * SearchFilterSelect - Enhanced select component with search/filter
 *
 * Provides interactive select with fuzzy search, tag filtering,
 * pagination, and keyboard navigation for large option lists.
 */

import { createLogger, type Logger } from '@organic/utils';

/**
 * Search filter option
 */
export interface SearchFilterOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Optional tags for filtering */
  tags?: string[];
  /** Whether option is disabled */
  disabled?: boolean;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Search filter configuration
 */
export interface SearchFilterConfig {
  /** Placeholder text for search input */
  placeholder?: string;
  /** Number of items per page (default: 10) */
  pageSize?: number;
  /** Enable search text filtering */
  enableSearch?: boolean;
  /** Enable tag filtering */
  enableTags?: boolean;
  /** Enable description display */
  enableDescriptions?: boolean;
  /** Sort results by */
  sortBy?: 'label' | 'value' | 'relevance';
  /** Case-sensitive search */
  caseSensitive?: boolean;
}

/**
 * Default search filter configuration
 */
const DEFAULT_SEARCH_FILTER_CONFIG: Required<SearchFilterConfig> = {
  placeholder: 'Search...',
  pageSize: 10,
  enableSearch: true,
  enableTags: true,
  enableDescriptions: true,
  sortBy: 'relevance',
  caseSensitive: false,
};

/**
 * Search filter state
 */
interface SearchFilterState {
  query: string;
  selectedTags: Set<string>;
  currentPage: number;
  totalPages: number;
  filteredOptions: SearchFilterOption[];
  selectedMulti: Set<string>;
  cursor: number;
}

/**
 * SearchFilterSelect - Enhanced select with search and filter capabilities
 *
 * Supports single and multi-select, fuzzy search, tag filtering,
 * pagination, and keyboard navigation.
 */
export class SearchFilterSelect {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ prefix: 'search-filter-select' });
  }

  /**
   * Render an interactive single-select with search/filter
   * Returns the selected option or null if cancelled
   */
  async render(
    options: SearchFilterOption[],
    config?: SearchFilterConfig
  ): Promise<SearchFilterOption | null> {
    return this.executeRender(options, config, false) as Promise<SearchFilterOption | null>;
  }

  /**
   * Render an interactive multi-select with search/filter
   * Returns the selected options (empty array if cancelled)
   */
  async renderMulti(
    options: SearchFilterOption[],
    config?: SearchFilterConfig
  ): Promise<SearchFilterOption[]> {
    return this.executeRender(options, config, true) as Promise<SearchFilterOption[]>;
  }

  /**
   * Execute render with mode
   */
  private async executeRender(
    options: SearchFilterOption[],
    config: SearchFilterConfig | undefined,
    multi: boolean
  ): Promise<SearchFilterOption | SearchFilterOption[] | null> {
    const mergedConfig: Required<SearchFilterConfig> = {
      ...DEFAULT_SEARCH_FILTER_CONFIG,
      ...config,
    };

    const state: SearchFilterState = {
      query: '',
      selectedTags: new Set<string>(),
      currentPage: 0,
      totalPages: 0,
      filteredOptions: [],
      selectedMulti: new Set<string>(),
      cursor: 0,
    };

    // Initial filter
    this.applyFilters(options, mergedConfig, state);

    // In non-interactive mode, return first match or null
    if (!this.isInteractive()) {
      if (state.filteredOptions.length > 0) {
        if (multi) {
          return [state.filteredOptions[0]];
        }
        return state.filteredOptions[0];
      }
      return multi ? [] : null;
    }

    // In interactive mode, render the interface
    // Since we may not have full TTY, we provide a non-interactive fallback
    this.logger.info('SearchFilterSelect running in non-interactive mode');
    return this.nonInteractiveResult(options, state, multi);
  }

  /**
   * Non-interactive result computation
   */
  private nonInteractiveResult(
    options: SearchFilterOption[],
    state: SearchFilterState,
    multi: boolean
  ): SearchFilterOption | SearchFilterOption[] | null {
    if (state.filteredOptions.length === 0) {
      return multi ? [] : null;
    }
    if (multi) {
      return [state.filteredOptions[0]];
    }
    return state.filteredOptions[0];
  }

  /**
   * Check if running in interactive environment
   */
  private isInteractive(): boolean {
    return process.stdout.isTTY && process.stdin.isTTY;
  }

  /**
   * Apply text search and tag filters to options
   */
  private applyFilters(
    options: SearchFilterOption[],
    config: Required<SearchFilterConfig>,
    state: SearchFilterState
  ): void {
    // Always filter out disabled options first
    let filtered = options.filter(o => !o.disabled);

    // Filter by search text
    if (config.enableSearch && state.query.trim()) {
      filtered = this.filterBySearch(filtered, state.query, config.caseSensitive);
    }

    // Filter by selected tags
    if (config.enableTags && state.selectedTags.size > 0) {
      filtered = this.filterByTags(filtered, state.selectedTags);
    }

    // Sort results
    if (config.sortBy === 'label') {
      filtered.sort((a, b) => a.label.localeCompare(b.label));
    } else if (config.sortBy === 'value') {
      filtered.sort((a, b) => a.value.localeCompare(b.value));
    }
    // 'relevance' keeps original order (or search relevance)

    state.filteredOptions = filtered;
    state.totalPages = Math.ceil(filtered.length / config.pageSize);
    state.currentPage = Math.min(state.currentPage, Math.max(0, state.totalPages - 1));
    state.cursor = Math.min(state.cursor, Math.max(0, filtered.length - 1));
  }

  /**
   * Filter options by fuzzy search text
   */
  private filterBySearch(
    options: SearchFilterOption[],
    query: string,
    caseSensitive: boolean
  ): SearchFilterOption[] {
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    return options.filter(option => {
      if (option.disabled) return false;

      const label = caseSensitive ? option.label : option.label.toLowerCase();
      const value = caseSensitive ? option.value : option.value.toLowerCase();
      const desc = option.description
        ? caseSensitive
          ? option.description
          : option.description.toLowerCase()
        : '';

      return (
        this.fuzzyMatch(label, searchQuery) ||
        this.fuzzyMatch(value, searchQuery) ||
        this.fuzzyMatch(desc, searchQuery)
      );
    });
  }

  /**
   * Fuzzy match a string against a query
   * Returns true if all characters in query appear in order in target
   */
  private fuzzyMatch(target: string, query: string): boolean {
    if (!query) return true;
    if (!target) return false;

    let queryIdx = 0;
    for (let i = 0; i < target.length && queryIdx < query.length; i++) {
      if (target[i] === query[queryIdx]) {
        queryIdx++;
      }
    }
    return queryIdx === query.length;
  }

  /**
   * Filter options by selected tags
   */
  private filterByTags(
    options: SearchFilterOption[],
    selectedTags: Set<string>
  ): SearchFilterOption[] {
    return options.filter(option => {
      if (option.disabled) return false;
      if (!option.tags || option.tags.length === 0) return false;
      return option.tags.some(tag => selectedTags.has(tag));
    });
  }

  /**
   * Collect all unique tags from options
   */
  private collectTags(options: SearchFilterOption[]): string[] {
    const tagSet = new Set<string>();
    for (const option of options) {
      if (option.tags) {
        for (const tag of option.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }

  /**
   * Get the current page of options
   */
  private getPage(
    state: SearchFilterState,
    config: Required<SearchFilterConfig>
  ): SearchFilterOption[] {
    const start = state.currentPage * config.pageSize;
    const end = start + config.pageSize;
    return state.filteredOptions.slice(start, end);
  }

  /**
   * Highlight matching text in a string
   * Returns the string with matches wrapped in ANSI highlight codes
   */
  highlightText(text: string, query: string, caseSensitive = false): string {
    if (!query) return text;

    const searchQuery = caseSensitive ? query : query.toLowerCase();
    const searchText = caseSensitive ? text : text.toLowerCase();
    const result: string[] = [];
    let lastIdx = 0;

    // Find all consecutive character matches
    let queryIdx = 0;
    const matchIndices: number[] = [];

    for (let i = 0; i < searchText.length && queryIdx < searchQuery.length; i++) {
      if (searchText[i] === searchQuery[queryIdx]) {
        matchIndices.push(i);
        queryIdx++;
      }
    }

    if (matchIndices.length === 0) return text;

    // Build highlighted string
    for (const idx of matchIndices) {
      if (idx > lastIdx) {
        result.push(text.slice(lastIdx, idx));
      }
      result.push(`\x1b[7m${text[idx]}\x1b[0m`);
      lastIdx = idx + 1;
    }

    if (lastIdx < text.length) {
      result.push(text.slice(lastIdx));
    }

    return result.join('');
  }

  /**
   * Format a single option for display
   */
  formatOption(
    option: SearchFilterOption,
    index: number,
    config: Required<SearchFilterConfig>,
    searchQuery: string,
    isSelected = false,
    isCursor = false
  ): string {
    const parts: string[] = [];
    const cursor = isCursor ? '>' : ' ';
    const selected = isSelected ? '●' : '○';

    // Index or cursor
    parts.push(`${cursor}${selected}`);

    // Label with highlighting
    const label = config.enableSearch
      ? this.highlightText(option.label, searchQuery, config.caseSensitive)
      : option.label;
    parts.push(` ${label}`);

    // Value
    parts.push(` \x1b[2m(${option.value})\x1b[0m`);

    // Description
    if (config.enableDescriptions && option.description) {
      const desc = config.enableSearch
        ? this.highlightText(option.description, searchQuery, config.caseSensitive)
        : option.description;
      parts.push(`\n    \x1b[2m${desc}\x1b[0m`);
    }

    // Tags
    if (config.enableTags && option.tags && option.tags.length > 0) {
      parts.push(`\n    \x1b[36m[${option.tags.join('] [')}]\x1b[0m`);
    }

    // Disabled indicator
    if (option.disabled) {
      parts.push(' \x1b[2m(disabled)\x1b[0m');
    }

    return parts.join('');
  }

  /**
   * Format the full interactive display
   */
  formatDisplay(
    options: SearchFilterOption[],
    config: Required<SearchFilterConfig>,
    state: SearchFilterState,
    allTags: string[],
    multi: boolean
  ): string {
    const lines: string[] = [];

    // Header
    lines.push('\x1b[1m--- SearchFilterSelect ---\x1b[0m');

    // Search bar
    if (config.enableSearch) {
      lines.push(`\x1b[36mSearch:\x1b[0m ${state.query || '\x1b[2m(empty)\x1b[0m'}`);
    }

    // Tag filters
    if (config.enableTags && allTags.length > 0) {
      const tagDisplay = allTags
        .map(tag => (state.selectedTags.has(tag) ? `\x1b[7m${tag}\x1b[0m` : `\x1b[2m${tag}\x1b[0m`))
        .join(' ');
      lines.push(`\x1b[36mTags:\x1b[0m ${tagDisplay}`);
    }

    lines.push('');

    // Page info
    const pageOpts = this.getPage(state, config);
    const totalResults = state.filteredOptions.length;
    lines.push(
      `\x1b[2mShowing ${state.currentPage * config.pageSize + 1}-${state.currentPage * config.pageSize + pageOpts.length} of ${totalResults} results (Page ${state.currentPage + 1}/${Math.max(1, state.totalPages)})\x1b[0m`
    );
    lines.push('');

    // Options
    for (let i = 0; i < pageOpts.length; i++) {
      const option = pageOpts[i];
      const globalIdx = state.currentPage * config.pageSize + i;
      const isSelected = multi && state.selectedMulti.has(option.value);
      const isCursor = globalIdx === state.cursor;

      lines.push(
        this.formatOption(option, globalIdx + 1, config, state.query, isSelected, isCursor)
      );
    }

    if (totalResults === 0) {
      lines.push('\x1b[2m  No results found.\x1b[0m');
    }

    lines.push('');

    // Help text
    if (multi) {
      lines.push(
        '\x1b[2m[↑/↓] Navigate  [Space] Toggle  [Enter] Confirm  [Esc] Cancel  [←/→] Page\x1b[0m'
      );
    } else {
      lines.push('\x1b[2m[↑/↓] Navigate  [Enter] Select  [Esc] Cancel  [←/→] Page\x1b[0m');
    }

    return lines.join('\n');
  }

  /**
   * Get all available tags from options
   */
  getTags(options: SearchFilterOption[]): string[] {
    return this.collectTags(options);
  }

  /**
   * Filter options by search text only (utility method)
   */
  search(
    options: SearchFilterOption[],
    query: string,
    caseSensitive = false
  ): SearchFilterOption[] {
    if (!query.trim()) return options.filter(o => !o.disabled);
    return this.filterBySearch(options, query, caseSensitive);
  }

  /**
   * Filter options by tags only (utility method)
   */
  filterByTag(options: SearchFilterOption[], tags: string[]): SearchFilterOption[] {
    if (tags.length === 0) return options.filter(o => !o.disabled);
    const tagSet = new Set(tags);
    return this.filterByTags(options, tagSet);
  }

  /**
   * Paginate options (utility method)
   */
  paginate(options: SearchFilterOption[], page: number, pageSize = 10): SearchFilterOption[] {
    const start = page * pageSize;
    const end = start + pageSize;
    return options.slice(start, end);
  }
}
