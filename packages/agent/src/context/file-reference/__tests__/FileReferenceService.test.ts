import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileReferenceService } from '../FileReferenceService.js';
import { ContextManager } from '../../ContextManager.js';
import { SupportedLanguage, SymbolKind } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('FileReferenceService', () => {
  let service: FileReferenceService;
  let contextManager: ContextManager;
  let tempDir: string;

  beforeEach(() => {
    contextManager = new ContextManager();
    service = new FileReferenceService(contextManager);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-ref-test-'));
  });

  afterEach(() => {
    service.clearAll();
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  function createTempFile(filename: string, content: string): string {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  describe('constructor', () => {
    it('should create service with default config', () => {
      expect(service).toBeDefined();
    });

    it('should create service with custom config', () => {
      const customService = new FileReferenceService(contextManager, {
        enableCache: false,
        cacheTTL: 60000,
      });
      expect(customService).toBeDefined();
      customService.clearAll();
    });
  });

  describe('referenceFile', () => {
    it('should parse and reference a TypeScript file', async () => {
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
      ]);

      const tsContent = `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export const PI = 3.14159;
`;
      const filePath = createTempFile('calculator.ts', tsContent);

      const result = await service.referenceFile(filePath, context.id);

      expect(result).toBeDefined();
      expect(result.file.path).toBe(filePath);
      expect(result.file.language).toBe(SupportedLanguage.TYPESCRIPT);
      expect(result.file.symbols.length).toBeGreaterThan(0);
      expect(result.symbols.length).toBeGreaterThan(0);

      const classSymbol = result.symbols.find(s => s.name === 'Calculator');
      expect(classSymbol).toBeDefined();
      expect(classSymbol?.kind).toBe(SymbolKind.CLASS);

      const funcSymbol = result.symbols.find(s => s.name === 'multiply');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol?.kind).toBe(SymbolKind.FUNCTION);
    });

    it('should parse and reference a Python file', async () => {
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
      ]);

      const pyContent = `
class Database:
    def connect(self):
        return True

    def query(self, sql):
        pass

def create_connection(url):
    return Database()

MAX_CONNECTIONS = 10
`;
      const filePath = createTempFile('database.py', pyContent);

      const result = await service.referenceFile(filePath, context.id);

      expect(result).toBeDefined();
      expect(result.file.language).toBe(SupportedLanguage.PYTHON);
      expect(result.file.symbols.length).toBeGreaterThan(0);

      const classSymbol = result.symbols.find(s => s.name === 'Database');
      expect(classSymbol).toBeDefined();
      expect(classSymbol?.kind).toBe(SymbolKind.CLASS);
    });

    it('should create ContextItem for referenced file', async () => {
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
      ]);

      const content = 'export const hello = "world";';
      const filePath = createTempFile('hello.ts', content);

      await service.referenceFile(filePath, context.id);

      // Check that state was stored
      const stateItem = contextManager.getState(
        context.id,
        `file_ref:${filePath}`,
        'file-reference'
      );
      expect(stateItem).toBeDefined();
    });

    it('should cache files when enabled', async () => {
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
      ]);

      const content = 'export const x = 1;';
      const filePath = createTempFile('cached.ts', content);

      const result1 = await service.referenceFile(filePath, context.id);
      const cached = service.getFileContext(filePath);

      expect(cached).toBeDefined();
      expect(cached?.hash).toBe(result1.file.hash);
    });

    it('should not cache files when disabled', async () => {
      const noCacheService = new FileReferenceService(contextManager, { enableCache: false });
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
      ]);

      const content = 'export const y = 2;';
      const filePath = createTempFile('nocache.ts', content);

      await noCacheService.referenceFile(filePath, context.id);
      const cached = noCacheService.getFileContext(filePath);

      expect(cached).toBeUndefined();
      noCacheService.clearAll();
    });

    it('should throw error for non-existent file', async () => {
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
      ]);

      await expect(
        service.referenceFile('/nonexistent/path/file.ts', context.id)
      ).rejects.toThrow();
    });
  });

  describe('referenceDirectory', () => {
    it('should reference all files in a directory', async () => {
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
      ]);

      createTempFile('a.ts', 'export const a = 1;');
      createTempFile('b.ts', 'export const b = 2;');
      createTempFile('c.py', 'def foo(): pass');

      const results = await service.referenceDirectory(tempDir, context.id);

      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it('should skip non-existent directories gracefully', async () => {
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
      ]);

      const results = await service.referenceDirectory('/nonexistent/dir', context.id);
      expect(results).toHaveLength(0);
    });
  });

  describe('getFileContext', () => {
    it('should return undefined for non-cached file', () => {
      const result = service.getFileContext('/nonexistent/file.ts');
      expect(result).toBeUndefined();
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate cached file', async () => {
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
      ]);

      const filePath = createTempFile('invalidate.ts', 'export const z = 3;');
      await service.referenceFile(filePath, context.id);

      expect(service.getFileContext(filePath)).toBeDefined();

      service.invalidateCache(filePath);

      expect(service.getFileContext(filePath)).toBeUndefined();
    });
  });

  describe('findRelatedFiles', () => {
    it('should find files that depend on a given file', async () => {
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
      ]);

      const utilPath = createTempFile('util.ts', 'export function helper() {}');
      const appPath = createTempFile(
        'app.ts',
        "import { helper } from './util';\nexport function main() { helper(); }"
      );

      await service.referenceFile(utilPath, context.id);
      await service.referenceFile(appPath, context.id);

      const related = service.findRelatedFiles(utilPath);
      expect(related).toContain(appPath);
    });
  });

  describe('getProjectStructure', () => {
    it('should get project structure from directory', async () => {
      createTempFile('index.ts', 'export * from "./lib";');
      createTempFile('lib.ts', 'export function lib() {}');

      const result = await service.getProjectStructure(tempDir);

      expect(result.files.length).toBeGreaterThanOrEqual(2);
      expect(result.dependencies).toBeDefined();
    });
  });

  describe('getSymbolIndexer', () => {
    it('should return the symbol indexer', () => {
      const indexer = service.getSymbolIndexer();
      expect(indexer).toBeDefined();
      expect(indexer.getStats().fileCount).toBe(0);
    });
  });

  describe('getFileParser', () => {
    it('should return the file parser', () => {
      const parser = service.getFileParser();
      expect(parser).toBeDefined();
      expect(parser.computeHash('test')).toBeDefined();
    });
  });

  describe('clearAll', () => {
    it('should clear all caches and index', async () => {
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
      ]);

      const filePath = createTempFile('clear.ts', 'export const x = 1;');
      await service.referenceFile(filePath, context.id);

      expect(service.getFileContext(filePath)).toBeDefined();

      service.clearAll();

      expect(service.getFileContext(filePath)).toBeUndefined();
      expect(service.getSymbolIndexer().getStats().fileCount).toBe(0);
    });
  });

  describe('integration with ContextManager', () => {
    it('should work within a full context lifecycle', async () => {
      const context = contextManager.create('session-1', [
        { id: 'user-1', type: 'user', name: 'User', joinedAt: Date.now() },
        { id: 'agent-1', type: 'agent', name: 'Agent', joinedAt: Date.now() },
      ]);

      const appContent = `
import { Database } from "./database";

export class App {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  async run(): Promise<void> {
    await this.db.connect();
  }
}

export const VERSION = "1.0.0";
`;
      const filePath = createTempFile('app.ts', appContent);

      const result = await service.referenceFile(filePath, context.id);

      // Verify result
      expect(result.file.path).toBe(filePath);
      expect(result.file.language).toBe(SupportedLanguage.TYPESCRIPT);

      // Verify class symbol
      const appClass = result.symbols.find(s => s.name === 'App' && s.kind === SymbolKind.CLASS);
      expect(appClass).toBeDefined();
      expect(appClass?.line).toBeGreaterThan(0);

      // Verify constant
      const version = result.symbols.find(s => s.name === 'VERSION');
      expect(version).toBeDefined();

      // Verify imports
      expect(result.file.imports).toContain('./database');

      // Verify exports
      expect(result.file.exports.some(e => e === 'App' || e === 'VERSION')).toBe(true);

      // Verify context state
      const stateItem = contextManager.getState(
        context.id,
        `file_ref:${filePath}`,
        'file-reference'
      );
      expect(stateItem).toBeDefined();

      const item = stateItem as any;
      expect(item.content.filePath).toBe(filePath);
      expect(item.content.language).toBe(SupportedLanguage.TYPESCRIPT);
      expect(item.metadata.tags).toContain('file-reference');

      // Verify index stats
      const stats = service.getSymbolIndexer().getStats();
      expect(stats.fileCount).toBe(1);
      expect(stats.symbolCount).toBeGreaterThan(0);
    });
  });
});
