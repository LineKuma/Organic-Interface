/**
 * FileReferenceService - Integrates file parsing with ContextManager
 *
 * Provides file referencing capabilities that create ContextItems
 * for parsed files, enabling file-based context in agent execution.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger, type Logger } from '@organic/utils';
import {
  type ParsedFile,
  type FileReferenceResult,
  type ParseOptions,
  DEFAULT_PARSE_OPTIONS,
} from './types.js';
import { FileParser } from './FileParser.js';
import { SymbolIndexer } from './SymbolIndexer.js';
import type { ContextManager } from '../ContextManager.js';
import {
  type ContextItem,
  type ContextItemMetadata,
  ContextItemType,
  ContextItemPriority,
  createContextItem,
} from '../models/ContextItem.js';

/**
 * FileReferenceService configuration
 */
export interface FileReferenceServiceConfig {
  /** Enable caching of parsed files */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Default parse options */
  defaultParseOptions?: ParseOptions;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<FileReferenceServiceConfig> = {
  enableCache: true,
  cacheTTL: 300000, // 5 minutes
  defaultParseOptions: DEFAULT_PARSE_OPTIONS,
};

/**
 * Cached file entry
 */
interface CacheEntry {
  parsedFile: ParsedFile;
  cachedAt: number;
}

/**
 * FileReferenceService
 *
 * Bridges file parsing and symbol indexing with the context management system.
 */
export class FileReferenceService {
  private config: Required<FileReferenceServiceConfig>;
  private parser: FileParser;
  private indexer: SymbolIndexer;
  private contextManager: ContextManager;
  private cache: Map<string, CacheEntry> = new Map();
  private logger: Logger;

  /**
   * Create a new FileReferenceService
   */
  constructor(contextManager: ContextManager, config: FileReferenceServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.parser = new FileParser();
    this.indexer = new SymbolIndexer();
    this.contextManager = contextManager;
    this.logger = createLogger({ prefix: 'file-reference-service' });
  }

  /**
   * Parse and reference a file into context
   */
  async referenceFile(
    filePath: string,
    contextId: string,
    options?: ParseOptions
  ): Promise<FileReferenceResult> {
    const opts = { ...this.config.defaultParseOptions, ...options };

    // Check cache
    const cached = this.getCachedFile(filePath);
    let parsedFile: ParsedFile;

    if (cached) {
      parsedFile = cached;
      this.logger.debug(`Using cached file: ${filePath}`);
    } else {
      parsedFile = await this.parser.parse(filePath, opts);
      if (this.config.enableCache) {
        this.cache.set(filePath, { parsedFile, cachedAt: Date.now() });
      }
    }

    // Index the file
    this.indexer.addFile(parsedFile);

    // Create context item for the file
    this.createFileContextItem(parsedFile, contextId);

    // Build result
    const relatedFiles = this.findRelatedFiles(filePath);
    const dependencies = this.indexer.getDependencies(filePath);

    const result: FileReferenceResult = {
      file: parsedFile,
      relatedFiles,
      symbols: parsedFile.symbols,
      dependencies,
    };

    this.logger.info(`Referenced file: ${filePath} (${parsedFile.symbols.length} symbols)`);
    return result;
  }

  /**
   * Reference all files in a directory
   */
  async referenceDirectory(
    dirPath: string,
    contextId: string,
    options?: ParseOptions
  ): Promise<FileReferenceResult[]> {
    const opts = { ...this.config.defaultParseOptions, ...options };
    const depth = opts.depth ?? 1;
    const results: FileReferenceResult[] = [];

    const files = await this.collectFiles(dirPath, depth);
    this.logger.info(`Found ${files.length} files in directory: ${dirPath}`);

    for (const filePath of files) {
      try {
        const result = await this.referenceFile(filePath, contextId, opts);
        results.push(result);
      } catch (error) {
        this.logger.warn(`Failed to reference file: ${filePath}`, error);
      }
    }

    return results;
  }

  /**
   * Get cached file context
   */
  getFileContext(filePath: string): ParsedFile | undefined {
    return this.getCachedFile(filePath);
  }

  /**
   * Invalidate cached file
   */
  invalidateCache(filePath: string): void {
    this.cache.delete(filePath);
    this.indexer.removeFile(filePath);
    this.logger.debug(`Cache invalidated for: ${filePath}`);
  }

  /**
   * Find files that reference symbols from this file
   */
  findRelatedFiles(filePath: string): string[] {
    return this.indexer.getDependents(filePath);
  }

  /**
   * Get full project structure
   */
  async getProjectStructure(
    rootPath: string
  ): Promise<{ files: ParsedFile[]; dependencies: Map<string, string[]> }> {
    const files: ParsedFile[] = [];
    const allDeps = new Map<string, string[]>();

    // Collect all files recursively
    const collected = await this.collectFiles(rootPath, Number.MAX_SAFE_INTEGER);

    for (const filePath of collected) {
      try {
        const parsed = await this.parser.parse(filePath);
        this.indexer.addFile(parsed);
        files.push(parsed);
        allDeps.set(filePath, parsed.imports);
      } catch (error) {
        this.logger.warn(`Failed to parse file in project structure: ${filePath}`, error);
      }
    }

    return { files, dependencies: allDeps };
  }

  /**
   * Get the internal symbol indexer
   */
  getSymbolIndexer(): SymbolIndexer {
    return this.indexer;
  }

  /**
   * Get the internal file parser
   */
  getFileParser(): FileParser {
    return this.parser;
  }

  /**
   * Clear all caches and index
   */
  clearAll(): void {
    this.cache.clear();
    this.indexer.clear();
    this.logger.info('All caches and index cleared');
  }

  // ==================== Private Helpers ====================

  /**
   * Get cached file if still valid
   */
  private getCachedFile(filePath: string): ParsedFile | undefined {
    if (!this.config.enableCache) {
      return undefined;
    }

    const entry = this.cache.get(filePath);
    if (!entry) {
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.cachedAt > this.config.cacheTTL) {
      this.cache.delete(filePath);
      return undefined;
    }

    return entry.parsedFile;
  }

  /**
   * Create a ContextItem for a parsed file
   */
  private createFileContextItem(parsedFile: ParsedFile, contextId: string): ContextItem {
    const metadata: ContextItemMetadata = {
      priority: ContextItemPriority.NORMAL,
      tags: ['file-reference', parsedFile.language],
      filePath: parsedFile.path,
      language: parsedFile.language,
      symbolCount: parsedFile.symbols.length,
      lines: parsedFile.lines,
      size: parsedFile.size,
      hash: parsedFile.hash,
    };

    const item = createContextItem({
      type: ContextItemType.CUSTOM,
      content: {
        filePath: parsedFile.path,
        language: parsedFile.language,
        symbols: parsedFile.symbols.map(s => ({
          name: s.name,
          kind: s.kind,
          line: s.line,
        })),
        imports: parsedFile.imports,
        exports: parsedFile.exports,
        snippet: parsedFile.content.substring(0, 500), // First 500 chars as preview
      },
      contextId,
      metadata,
      size: parsedFile.size,
    });

    // Store in context manager's state
    this.contextManager.setState(contextId, `file_ref:${parsedFile.path}`, item, {
      namespace: 'file-reference',
    });

    return item;
  }

  /**
   * Collect files in a directory up to a given depth
   */
  private async collectFiles(dirPath: string, maxDepth: number): Promise<string[]> {
    const results: string[] = [];

    const collect = async (currentPath: string, currentDepth: number): Promise<void> => {
      if (currentDepth > maxDepth) {
        return;
      }

      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        // Skip common non-source directories
        if (entry.isDirectory()) {
          const skipDirs = [
            'node_modules',
            '.git',
            'dist',
            'build',
            '__pycache__',
            '.turbo',
            'coverage',
          ];
          if (!skipDirs.includes(entry.name) && !entry.name.startsWith('.')) {
            await collect(fullPath, currentDepth + 1);
          }
        } else if (entry.isFile()) {
          // Only include source files
          const ext = path.extname(entry.name).toLowerCase();
          const sourceExts = [
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '.mjs',
            '.cjs',
            '.py',
            '.pyi',
            '.java',
            '.go',
            '.rs',
            '.cpp',
            '.cc',
            '.cxx',
            '.c',
            '.h',
            '.hpp',
            '.cs',
            '.rb',
            '.php',
            '.swift',
            '.kt',
            '.kts',
            '.sql',
            '.yaml',
            '.yml',
            '.json',
            '.md',
            '.mdx',
          ];
          if (sourceExts.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    };

    await collect(dirPath, 0);
    return results;
  }
}
