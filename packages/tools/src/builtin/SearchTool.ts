/**
 * SearchTool - Built-in tool for search operations
 */

import { createLogger, type Logger } from '@organic/utils';
import {
  type Tool,
  type ToolDefinition,
  type ToolResult,
  type ToolExecutionContext,
  type ToolValidationError,
} from '../types/index.js';

/**
 * SearchTool input schema
 */
interface SearchToolInput {
  /** Search operation type */
  operation: 'grep' | 'find' | 'query' | 'index' | 'suggest';

  /** Search pattern or query */
  pattern?: string;

  /** Query text (for query operation) */
  query?: string;

  /** File paths to search */
  paths?: string[];

  /** Search options */
  options?: SearchOptions;

  /** Index name (for index/suggest operations) */
  index?: string;

  /** Document content (for index operation) */
  document?: Record<string, unknown>;

  /** Document ID (for index operation) */
  documentId?: string;
}

/**
 * Search options
 */
interface SearchOptions {
  /** Case sensitive search */
  caseSensitive?: boolean;

  /** Use regex pattern */
  regex?: boolean;

  /** Include file names in results */
  includeFilenames?: boolean;

  /** Include line numbers in results */
  includeLineNumbers?: boolean;

  /** Maximum number of results */
  limit?: number;

  /** File extensions to include */
  extensions?: string[];

  /** Directories to exclude */
  excludeDirs?: string[];

  /** Search context lines */
  context?: number;
}

/**
 * Search result entry
 */
interface SearchResult {
  /** File path */
  file: string;

  /** Line number */
  line?: number;

  /** Matched content */
  content?: string;

  /** Context lines before match */
  before?: string[];

  /** Context lines after match */
  after?: string[];
}

/**
 * SearchTool - Built-in search operation tool
 */
export class SearchTool implements Tool {
  private definition: ToolDefinition;
  private logger: Logger;

  // Simple in-memory index for demonstration
  private index: Map<string, Map<string, string>> = new Map(); // indexName -> documentId -> content

  constructor() {
    this.logger = createLogger({ prefix: 'search-tool' });

    this.definition = {
      id: 'builtin:search',
      name: 'SearchTool',
      description: 'Built-in tool for searching files, text patterns, and maintaining search indices',
      category: 'search',
      inputSchema: {
        type: 'object',
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: ['grep', 'find', 'query', 'index', 'suggest'],
            description: 'Search operation to perform',
          },
          pattern: {
            type: 'string',
            description: 'Search pattern (for grep/find operations)',
          },
          query: {
            type: 'string',
            description: 'Query text (for query operation)',
          },
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'File paths or directories to search',
          },
          options: {
            type: 'object',
            description: 'Search options',
            properties: {
              caseSensitive: { type: 'boolean' },
              regex: { type: 'boolean' },
              includeFilenames: { type: 'boolean' },
              includeLineNumbers: { type: 'boolean' },
              limit: { type: 'number' },
              extensions: { type: 'array', items: { type: 'string' } },
              excludeDirs: { type: 'array', items: { type: 'string' } },
              context: { type: 'number' },
            },
          },
          index: {
            type: 'string',
            description: 'Index name (for index/suggest operations)',
          },
          document: {
            type: 'object',
            description: 'Document content (for index operation)',
          },
          documentId: {
            type: 'string',
            description: 'Document ID (for index operation)',
          },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'any' },
          error: { type: 'string' },
        },
      },
      enabled: true,
      timeout: 30000,
      permissions: [
        { type: 'read', scope: 'filesystem', granted: true },
      ],
    };
  }

  getDefinition(): ToolDefinition {
    return this.definition;
  }

  validate(input: unknown): ToolValidationError[] {
    const errors: ToolValidationError[] = [];
    const data = input as Partial<SearchToolInput>;
    const operation = data.operation;

    if (!operation) {
      errors.push({
        path: 'operation',
        message: 'Operation is required',
        expected: 'string',
        actual: operation,
      });
    } else {
      if (['grep', 'find'].includes(operation) && !data.pattern) {
        errors.push({
          path: 'pattern',
          message: 'Pattern is required for grep/find operations',
          expected: 'string',
          actual: data.pattern,
        });
      }

      if (operation === 'query' && !data.query) {
        errors.push({
          path: 'query',
          message: 'Query is required for query operation',
          expected: 'string',
          actual: data.query,
        });
      }

      if (['grep', 'find', 'query'].includes(operation) && !data.paths?.length) {
        errors.push({
          path: 'paths',
          message: 'At least one path is required for this operation',
          expected: 'array of strings',
          actual: data.paths,
        });
      }
    }

    return errors;
  }

  async execute(input: unknown, _context: ToolExecutionContext): Promise<ToolResult> {
    const data = input as SearchToolInput;
    const startTime = Date.now();

    try {
      let result: unknown;

      switch (data.operation) {
        case 'grep':
          result = await this.grep(data.pattern!, data.paths!, data.options);
          break;

        case 'find':
          result = await this.find(data.pattern!, data.paths!, data.options);
          break;

        case 'query':
          result = await this.query(data.query!, data.index!, data.options);
          break;

        case 'index':
          result = await this.indexDocument(
            data.index!,
            data.documentId!,
            data.document!
          );
          break;

        case 'suggest':
          result = await this.suggest(data.query!, data.index!);
          break;

        default:
          throw new Error(`Unknown operation: ${data.operation}`);
      }

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Grep: Search for pattern in files
   */
  private async grep(
    pattern: string,
    paths: string[],
    options?: SearchOptions
  ): Promise<{ results: SearchResult[]; count: number }> {
    const { readFile } = await import('fs/promises');

    const results: SearchResult[] = [];
    const regex = this.createRegex(pattern, options?.regex, options?.caseSensitive);
    const limit = options?.limit ?? 1000;

    for (const searchPath of paths) {
      if (results.length >= limit) break;

      try {
        const files = await this.getFiles(searchPath, options);

        for (const file of files) {
          if (results.length >= limit) break;

          try {
            const content = await readFile(file, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              if (results.length >= limit) break;

              const line = lines[i];
              if (regex.test(line)) {
                const result: SearchResult = {
                  file,
                  line: i + 1,
                  content: line.trim(),
                };

                if (options?.context) {
                  result.before = lines.slice(Math.max(0, i - options.context), i);
                  result.after = lines.slice(i + 1, Math.min(lines.length, i + options.context + 1));
                }

                results.push(result);
                regex.lastIndex = 0; // Reset regex state
              }
            }
          } catch (err) {
            // Skip files that can't be read
            this.logger.debug(`Could not read file: ${file}`);
          }
        }
      } catch (err) {
        this.logger.debug(`Could not access path: ${searchPath}`);
      }
    }

    return { results, count: results.length };
  }

  /**
   * Find: Find files by name pattern
   */
  private async find(
    pattern: string,
    paths: string[],
    options?: SearchOptions
  ): Promise<{ files: string[]; count: number }> {

    const pathModule = await import("path");
    const files: string[] = [];
    const regex = this.createRegex(pattern, true, options?.caseSensitive);
    const limit = options?.limit ?? 1000;

    for (const searchPath of paths) {
      if (files.length >= limit) break;

      try {
        const matchedFiles = await this.getFiles(searchPath, options);

        for (const file of matchedFiles) {
          if (files.length >= limit) break;

          const filename = pathModule.basename(file);
          if (regex.test(filename)) {
            files.push(file);
            regex.lastIndex = 0;
          }
        }
      } catch (err) {
        this.logger.debug(`Could not access path: ${searchPath}`);
      }
    }

    return { files, count: files.length };
  }

  /**
   * Query: Search indexed documents
   */
  private query(query: string, indexName: string, options?: SearchOptions): {
    results: Array<{ id: string; score: number; content: string }>;
    count: number;
  } {
    const index = this.index.get(indexName);
    if (!index) {
      return { results: [], count: 0 };
    }

    const results: Array<{ id: string; score: number; content: string }> = [];
    const queryLower = query.toLowerCase();
    const limit = options?.limit ?? 100;

    for (const [docId, content] of index) {
      if (results.length >= limit) break;

      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
      const contentLower = contentStr.toLowerCase();

      // Simple relevance scoring
      let score = 0;
      const queryWords = queryLower.split(/\s+/);

      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          score += 1;
          // Bonus for exact match
          if (contentLower.includes(queryLower)) {
            score += 2;
          }
        }
      }

      if (score > 0) {
        results.push({ id: docId, score, content: contentStr.substring(0, 200) });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return { results, count: results.length };
  }

  /**
   * Index: Add document to index
   */
  private indexDocument(
    indexName: string,
    documentId: string,
    document: Record<string, unknown>
  ): { index: string; documentId: string; indexed: boolean } {
    let indexMap = this.index.get(indexName);
    if (!indexMap) {
      indexMap = new Map();
      this.index.set(indexName, indexMap);
    }

    const content = JSON.stringify(document);
    indexMap.set(documentId, content);

    return { index: indexName, documentId, indexed: true };
  }

  /**
   * Suggest: Provide search suggestions
   */
  private suggest(query: string, indexName: string): { suggestions: string[] } {
    const index = this.index.get(indexName);
    if (!index) {
      return { suggestions: [] };
    }

    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();

    for (const [docId, content] of index) {
      const contentStr = typeof content === 'string' ? content : '';

      // Extract words that start with query
      const words = contentStr.match(/\b\w{3,}\b/g) || [];
      for (const word of words) {
        if (word.toLowerCase().startsWith(queryLower)) {
          suggestions.add(word);
          if (suggestions.size >= 10) break;
        }
      }

      if (suggestions.size >= 10) break;
    }

    return { suggestions: Array.from(suggestions) };
  }

  /**
   * Create regex from pattern
   */
  private createRegex(pattern: string, useRegex?: boolean, caseSensitive?: boolean): RegExp {
    if (useRegex) {
      return new RegExp(pattern, caseSensitive ? '' : 'i');
    }

    // Escape special regex characters for literal search
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, caseSensitive ? '' : 'i');
  }

  /**
   * Get files from path
   */
  private async getFiles(
    searchPath: string,
    options?: SearchOptions
  ): Promise<string[]> {
    const pathModule = await import("path"); const { readdir, stat } = await import("fs/promises");

    const files: string[] = [];
    const extensions = options?.extensions?.map((ext) => ext.toLowerCase()) ?? [];
    const excludeDirs = options?.excludeDirs ?? ['node_modules', '.git', 'dist', 'build'];

    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = pathModule.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          if (extensions.length === 0) {
            files.push(fullPath);
          } else {
            const ext = pathModule.extname(entry.name).toLowerCase().slice(1);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      }
    };

    await walk(searchPath);
    return files;
  }
}

/**
 * Create a SearchTool instance
 */
export function createSearchTool(): SearchTool {
  return new SearchTool();
}
