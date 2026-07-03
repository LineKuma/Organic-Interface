import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SymbolIndexer } from '../SymbolIndexer.js';
import { SupportedLanguage, SymbolKind, type ParsedFile } from '../types.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function createParsedFile(overrides: Partial<ParsedFile> = {}): ParsedFile {
  return {
    path: 'test.ts',
    language: SupportedLanguage.TYPESCRIPT,
    content: '',
    symbols: [],
    imports: [],
    exports: [],
    lines: 0,
    size: 0,
    hash: 'abc123',
    parsedAt: Date.now(),
    ...overrides,
  };
}

describe('SymbolIndexer', () => {
  let indexer: SymbolIndexer;

  beforeEach(() => {
    indexer = new SymbolIndexer();
  });

  describe('addFile', () => {
    it('should add a file to the index', () => {
      const file = createParsedFile({
        symbols: [
          {
            name: 'myFunction',
            kind: SymbolKind.FUNCTION,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 10,
            path: 'test.ts',
          },
        ],
        imports: ['./foo', './bar'],
      });

      indexer.addFile(file);

      expect(indexer.getFile('test.ts')).toBeDefined();
      expect(indexer.getStats().fileCount).toBe(1);
      expect(indexer.getStats().symbolCount).toBe(1);
    });

    it('should index multiple files', () => {
      const file1 = createParsedFile({
        path: 'file1.ts',
        symbols: [
          {
            name: 'Foo',
            kind: SymbolKind.CLASS,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 4,
            path: 'file1.ts',
          },
        ],
      });

      const file2 = createParsedFile({
        path: 'file2.ts',
        symbols: [
          {
            name: 'Bar',
            kind: SymbolKind.CLASS,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 4,
            path: 'file2.ts',
          },
        ],
      });

      indexer.addFile(file1);
      indexer.addFile(file2);

      expect(indexer.getStats().fileCount).toBe(2);
      expect(indexer.getStats().symbolCount).toBe(2);
    });

    it('should replace existing file when re-added', () => {
      const file1 = createParsedFile({
        path: 'test.ts',
        symbols: [
          {
            name: 'OldFunction',
            kind: SymbolKind.FUNCTION,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 12,
            path: 'test.ts',
          },
        ],
      });

      const file2 = createParsedFile({
        path: 'test.ts',
        symbols: [
          {
            name: 'NewFunction',
            kind: SymbolKind.FUNCTION,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 12,
            path: 'test.ts',
          },
        ],
      });

      indexer.addFile(file1);
      indexer.addFile(file2);

      expect(indexer.getStats().symbolCount).toBe(1);
      const results = indexer.findSymbol('NewFunction', SymbolKind.FUNCTION);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('NewFunction');

      const oldResults = indexer.findSymbol('OldFunction', SymbolKind.FUNCTION);
      expect(oldResults).toHaveLength(0);
    });
  });

  describe('removeFile', () => {
    it('should remove a file from the index', () => {
      const file = createParsedFile({ path: 'test.ts' });
      indexer.addFile(file);
      indexer.removeFile('test.ts');

      expect(indexer.getFile('test.ts')).toBeUndefined();
      expect(indexer.getStats().fileCount).toBe(0);
    });

    it('should remove symbols when file is removed', () => {
      const file = createParsedFile({
        path: 'test.ts',
        symbols: [
          {
            name: 'myFunc',
            kind: SymbolKind.FUNCTION,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 7,
            path: 'test.ts',
          },
        ],
      });

      indexer.addFile(file);
      indexer.removeFile('test.ts');

      expect(indexer.getStats().symbolCount).toBe(0);
      const results = indexer.findSymbol('myFunc');
      expect(results).toHaveLength(0);
    });

    it('should handle removing non-existent file gracefully', () => {
      expect(() => indexer.removeFile('nonexistent.ts')).not.toThrow();
    });
  });

  describe('getFile', () => {
    it('should return undefined for non-existent file', () => {
      expect(indexer.getFile('nonexistent.ts')).toBeUndefined();
    });

    it('should return the parsed file', () => {
      const file = createParsedFile({ path: 'test.ts' });
      indexer.addFile(file);

      const retrieved = indexer.getFile('test.ts');
      expect(retrieved).toBeDefined();
      expect(retrieved?.path).toBe('test.ts');
    });
  });

  describe('findSymbol', () => {
    it('should find symbol by name', () => {
      const file = createParsedFile({
        path: 'test.ts',
        symbols: [
          {
            name: 'hello',
            kind: SymbolKind.FUNCTION,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 6,
            path: 'test.ts',
          },
        ],
      });

      indexer.addFile(file);

      const results = indexer.findSymbol('hello');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('hello');
      expect(results[0].kind).toBe(SymbolKind.FUNCTION);
    });

    it('should find symbol by name and kind', () => {
      const file = createParsedFile({
        path: 'test.ts',
        symbols: [
          {
            name: 'User',
            kind: SymbolKind.CLASS,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 5,
            path: 'test.ts',
          },
          {
            name: 'User',
            kind: SymbolKind.INTERFACE,
            line: 10,
            column: 1,
            endLine: 10,
            endColumn: 5,
            path: 'test.ts',
          },
        ],
      });

      indexer.addFile(file);

      const classResults = indexer.findSymbol('User', SymbolKind.CLASS);
      expect(classResults).toHaveLength(1);
      expect(classResults[0].kind).toBe(SymbolKind.CLASS);

      const interfaceResults = indexer.findSymbol('User', SymbolKind.INTERFACE);
      expect(interfaceResults).toHaveLength(1);
      expect(interfaceResults[0].kind).toBe(SymbolKind.INTERFACE);
    });

    it('should return empty array for non-existent symbol', () => {
      const results = indexer.findSymbol('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should find symbols across multiple files', () => {
      const file1 = createParsedFile({
        path: 'file1.ts',
        symbols: [
          {
            name: 'shared',
            kind: SymbolKind.FUNCTION,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 7,
            path: 'file1.ts',
          },
        ],
      });

      const file2 = createParsedFile({
        path: 'file2.ts',
        symbols: [
          {
            name: 'shared',
            kind: SymbolKind.VARIABLE,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 7,
            path: 'file2.ts',
          },
        ],
      });

      indexer.addFile(file1);
      indexer.addFile(file2);

      const results = indexer.findSymbol('shared');
      expect(results).toHaveLength(2);
    });
  });

  describe('findSymbolsByKind', () => {
    it('should find all symbols of a specific kind', () => {
      const file = createParsedFile({
        path: 'test.ts',
        symbols: [
          {
            name: 'ClassA',
            kind: SymbolKind.CLASS,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 7,
            path: 'test.ts',
          },
          {
            name: 'ClassB',
            kind: SymbolKind.CLASS,
            line: 10,
            column: 1,
            endLine: 10,
            endColumn: 7,
            path: 'test.ts',
          },
          {
            name: 'funcA',
            kind: SymbolKind.FUNCTION,
            line: 20,
            column: 1,
            endLine: 20,
            endColumn: 6,
            path: 'test.ts',
          },
        ],
      });

      indexer.addFile(file);

      const classes = indexer.findSymbolsByKind(SymbolKind.CLASS);
      expect(classes).toHaveLength(2);
      expect(classes.map(s => s.name)).toContain('ClassA');
      expect(classes.map(s => s.name)).toContain('ClassB');

      const functions = indexer.findSymbolsByKind(SymbolKind.FUNCTION);
      expect(functions).toHaveLength(1);
      expect(functions[0].name).toBe('funcA');
    });

    it('should return empty array for kind with no symbols', () => {
      const results = indexer.findSymbolsByKind(SymbolKind.ENUM);
      expect(results).toHaveLength(0);
    });
  });

  describe('getDependencies', () => {
    it('should return file dependencies', () => {
      const file = createParsedFile({
        path: 'test.ts',
        imports: ['./foo', './bar', 'lodash'],
      });

      indexer.addFile(file);

      const deps = indexer.getDependencies('test.ts');
      expect(deps).toHaveLength(3);
      expect(deps).toContain('./foo');
      expect(deps).toContain('./bar');
      expect(deps).toContain('lodash');
    });

    it('should return empty array for non-existent file', () => {
      const deps = indexer.getDependencies('nonexistent.ts');
      expect(deps).toHaveLength(0);
    });
  });

  describe('getDependents', () => {
    it('should find files that depend on a given file', () => {
      const file1 = createParsedFile({
        path: 'component.ts',
        imports: [],
      });

      const file2 = createParsedFile({
        path: 'app.ts',
        imports: ['./component'],
      });

      const file3 = createParsedFile({
        path: 'test.ts',
        imports: ['./component'],
      });

      indexer.addFile(file1);
      indexer.addFile(file2);
      indexer.addFile(file3);

      const dependents = indexer.getDependents('component.ts');
      expect(dependents).toHaveLength(2);
      expect(dependents).toContain('app.ts');
      expect(dependents).toContain('test.ts');
    });

    it('should return empty array if no files depend on it', () => {
      const file = createParsedFile({ path: 'orphan.ts', imports: [] });
      indexer.addFile(file);

      const dependents = indexer.getDependents('orphan.ts');
      expect(dependents).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('should search across indexed files', () => {
      const file1 = createParsedFile({
        path: 'user.ts',
        content: 'export class User { name: string; }',
        symbols: [
          {
            name: 'User',
            kind: SymbolKind.CLASS,
            line: 1,
            column: 14,
            endLine: 1,
            endColumn: 18,
            path: 'user.ts',
          },
        ],
      });

      const file2 = createParsedFile({
        path: 'service.ts',
        content: 'import { User } from "./user"; export class UserService { getUser() {} }',
        symbols: [
          {
            name: 'UserService',
            kind: SymbolKind.CLASS,
            line: 1,
            column: 50,
            endLine: 1,
            endColumn: 61,
            path: 'service.ts',
          },
        ],
      });

      indexer.addFile(file1);
      indexer.addFile(file2);

      const results = indexer.search('User');
      expect(results.length).toBeGreaterThanOrEqual(2);

      const userResult = results.find(r => r.file.path === 'user.ts');
      expect(userResult).toBeDefined();
      expect(userResult?.symbols.some(s => s.name === 'User')).toBe(true);

      const serviceResult = results.find(r => r.file.path === 'service.ts');
      expect(serviceResult).toBeDefined();
    });

    it('should return empty array for no matches', () => {
      const results = indexer.search('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all indexed data', () => {
      const file = createParsedFile({
        symbols: [
          {
            name: 'test',
            kind: SymbolKind.FUNCTION,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 5,
            path: 'test.ts',
          },
        ],
      });

      indexer.addFile(file);
      expect(indexer.getStats().fileCount).toBe(1);

      indexer.clear();
      expect(indexer.getStats().fileCount).toBe(0);
      expect(indexer.getStats().symbolCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty index', () => {
      const stats = indexer.getStats();
      expect(stats.fileCount).toBe(0);
      expect(stats.symbolCount).toBe(0);
    });

    it('should return accurate stats', () => {
      const file1 = createParsedFile({
        path: 'file1.ts',
        symbols: [
          {
            name: 'a',
            kind: SymbolKind.FUNCTION,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 2,
            path: 'file1.ts',
          },
          {
            name: 'b',
            kind: SymbolKind.CLASS,
            line: 2,
            column: 1,
            endLine: 2,
            endColumn: 2,
            path: 'file1.ts',
          },
        ],
      });

      const file2 = createParsedFile({
        path: 'file2.ts',
        symbols: [
          {
            name: 'c',
            kind: SymbolKind.VARIABLE,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 2,
            path: 'file2.ts',
          },
        ],
      });

      indexer.addFile(file1);
      indexer.addFile(file2);

      const stats = indexer.getStats();
      expect(stats.fileCount).toBe(2);
      expect(stats.symbolCount).toBe(3);
    });
  });

  describe('getAllFilePaths', () => {
    it('should return all indexed file paths', () => {
      const file1 = createParsedFile({ path: 'file1.ts' });
      const file2 = createParsedFile({ path: 'file2.ts' });

      indexer.addFile(file1);
      indexer.addFile(file2);

      const paths = indexer.getAllFilePaths();
      expect(paths).toHaveLength(2);
      expect(paths).toContain('file1.ts');
      expect(paths).toContain('file2.ts');
    });
  });
});
