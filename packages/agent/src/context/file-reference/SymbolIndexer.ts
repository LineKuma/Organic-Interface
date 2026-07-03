/**
 * SymbolIndexer - Indexes parsed files for symbol lookup and dependency tracking
 *
 * Provides efficient lookup, search, and dependency analysis across indexed files.
 */

import { createLogger, type Logger } from '@organic/utils';
import {
  SymbolKind,
  type ParsedFile,
  type FileSymbol,
  type FileReferenceResult,
  type FileIndex,
} from './types.js';

/**
 * SymbolIndexer for file symbol indexing and querying
 */
export class SymbolIndexer {
  private index: FileIndex;
  private logger: Logger;

  constructor() {
    this.index = {
      files: new Map(),
      symbols: new Map(),
      dependencies: new Map(),
    };
    this.logger = createLogger({ prefix: 'symbol-indexer' });
  }

  /**
   * Add a parsed file to the index
   */
  addFile(parsedFile: ParsedFile): void {
    // Remove existing entry if present
    this.removeFile(parsedFile.path);

    // Add file
    this.index.files.set(parsedFile.path, parsedFile);

    // Index symbols
    for (const symbol of parsedFile.symbols) {
      const key = this.getSymbolKey(symbol.name, symbol.kind);
      if (!this.index.symbols.has(key)) {
        this.index.symbols.set(key, []);
      }
      this.index.symbols.get(key)!.push(symbol);
    }

    // Index dependencies
    this.index.dependencies.set(parsedFile.path, parsedFile.imports);

    this.logger.debug(`Indexed file: ${parsedFile.path} (${parsedFile.symbols.length} symbols)`);
  }

  /**
   * Remove a file from the index
   */
  removeFile(filePath: string): void {
    const existingFile = this.index.files.get(filePath);
    if (existingFile) {
      // Remove symbols
      for (const symbol of existingFile.symbols) {
        const key = this.getSymbolKey(symbol.name, symbol.kind);
        const syms = this.index.symbols.get(key);
        if (syms) {
          const filtered = syms.filter(s => s.path !== filePath);
          if (filtered.length === 0) {
            this.index.symbols.delete(key);
          } else {
            this.index.symbols.set(key, filtered);
          }
        }
      }
    }

    this.index.files.delete(filePath);
    this.index.dependencies.delete(filePath);

    this.logger.debug(`Removed file from index: ${filePath}`);
  }

  /**
   * Get indexed file by path
   */
  getFile(filePath: string): ParsedFile | undefined {
    return this.index.files.get(filePath);
  }

  /**
   * Find symbols by name (optionally filtered by kind)
   */
  findSymbol(name: string, kind?: SymbolKind): FileSymbol[] {
    if (kind) {
      const key = this.getSymbolKey(name, kind);
      return this.index.symbols.get(key) ?? [];
    }

    // Search across all kinds
    const results: FileSymbol[] = [];
    for (const kindValue of Object.values(SymbolKind)) {
      const key = this.getSymbolKey(name, kindValue);
      const syms = this.index.symbols.get(key);
      if (syms) {
        results.push(...syms);
      }
    }
    return results;
  }

  /**
   * Find all symbols of a specific kind
   */
  findSymbolsByKind(kind: SymbolKind): FileSymbol[] {
    const results: FileSymbol[] = [];
    for (const [key, syms] of this.index.symbols) {
      if (key.endsWith(`:${kind}`)) {
        results.push(...syms);
      }
    }
    return results;
  }

  /**
   * Get file dependencies (files that this file imports)
   */
  getDependencies(filePath: string): string[] {
    return this.index.dependencies.get(filePath) ?? [];
  }

  /**
   * Get files that depend on this file (reverse dependency lookup)
   */
  getDependents(filePath: string): string[] {
    const dependents: string[] = [];
    const normalized = this.normalizePath(filePath);
    for (const [depPath, deps] of this.index.dependencies) {
      if (deps.some(dep => this.pathsMatch(dep, normalized))) {
        dependents.push(depPath);
      }
    }
    return dependents;
  }

  /**
   * Full-text search across indexed files
   */
  search(query: string): FileReferenceResult[] {
    const lowerQuery = query.toLowerCase();
    const results: FileReferenceResult[] = [];

    for (const [filePath, parsedFile] of this.index.files) {
      const contentLower = parsedFile.content.toLowerCase();
      if (contentLower.includes(lowerQuery)) {
        // Find relevant symbols (those matching the query)
        const matchingSymbols = parsedFile.symbols.filter(
          s => s.name.toLowerCase().includes(lowerQuery),
        );

        results.push({
          file: parsedFile,
          relatedFiles: this.findRelatedFiles(parsedFile),
          symbols: matchingSymbols,
          dependencies: this.getDependencies(filePath),
        });
      }
    }

    return results;
  }

  /**
   * Clear the entire index
   */
  clear(): void {
    this.index.files.clear();
    this.index.symbols.clear();
    this.index.dependencies.clear();
    this.logger.debug('Index cleared');
  }

  /**
   * Get index statistics
   */
  getStats(): { fileCount: number; symbolCount: number } {
    let symbolCount = 0;
    for (const syms of this.index.symbols.values()) {
      symbolCount += syms.length;
    }
    return {
      fileCount: this.index.files.size,
      symbolCount,
    };
  }

  /**
   * Get all indexed file paths
   */
  getAllFilePaths(): string[] {
    return Array.from(this.index.files.keys());
  }

  // ==================== Private Helpers ====================

  /**
   * Find files related to the given parsed file
   */
  private findRelatedFiles(parsedFile: ParsedFile): string[] {
    const related = new Set<string>();

    // Files that share symbols
    for (const symbol of parsedFile.symbols) {
      const key = this.getSymbolKey(symbol.name, symbol.kind);
      const syms = this.index.symbols.get(key);
      if (syms) {
        for (const sym of syms) {
          if (sym.path !== parsedFile.path) {
            related.add(sym.path);
          }
        }
      }
    }

    // Files that are dependencies
    for (const dep of parsedFile.imports) {
      for (const [filePath] of this.index.files) {
        if (filePath.includes(dep) || dep.includes(filePath)) {
          related.add(filePath);
        }
      }
    }

    return Array.from(related);
  }

  /**
   * Create a symbol key for lookup
   */
  private getSymbolKey(name: string, kind: SymbolKind): string {
    return `${name}:${kind}`;
  }

  /**
   * Normalize a file path for comparison
   */
  private normalizePath(filePath: string): string {
    // Remove leading ./ or ../
    let normalized = filePath.replace(/^\.\//, '');
    // Remove file extension
    normalized = normalized.replace(/\.[^./]+$/, '');
    return normalized;
  }

  /**
   * Check if a dependency path matches a target file path
   */
  private pathsMatch(dep: string, target: string): boolean {
    const normalizedDep = this.normalizePath(dep);
    return normalizedDep === target ||
      normalizedDep.includes(target) ||
      target.includes(normalizedDep) ||
      dep.includes(target) ||
      target.includes(dep);
  }
}