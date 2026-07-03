/**
 * FileParser - Parses source files to extract symbols, imports, and exports
 *
 * Provides regex-based parsing for multiple programming languages.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { createLogger, type Logger } from '@organic/utils';
import {
  SupportedLanguage,
  SymbolKind,
  type ParsedFile,
  type FileSymbol,
  type ParseOptions,
  DEFAULT_PARSE_OPTIONS,
} from './types.js';
import { LanguageRegistry } from './LanguageRegistry.js';

/**
 * FileParser for source code analysis
 */
export class FileParser {
  private logger: Logger;

  constructor() {
    this.logger = createLogger({ prefix: 'file-parser' });
  }

  /**
   * Parse a file from disk
   */
  async parse(filePath: string, options?: ParseOptions): Promise<ParsedFile> {
    const opts = { ...DEFAULT_PARSE_OPTIONS, ...options };

    const stats = await fs.promises.stat(filePath);
    if (stats.size > opts.maxFileSize) {
      throw new Error(`File ${filePath} exceeds max size of ${opts.maxFileSize} bytes`);
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const language = LanguageRegistry.detect(filePath);

    return this.parseContent(content, language, filePath, opts);
  }

  /**
   * Parse raw content with known language
   */
  parseContent(
    content: string,
    language: SupportedLanguage,
    filePath: string,
    options?: ParseOptions,
  ): ParsedFile {
    const opts = { ...DEFAULT_PARSE_OPTIONS, ...options };
    const lines = content.split('\n');
    const size = Buffer.byteLength(content, 'utf-8');
    const hash = this.computeHash(content);

    const parsedFile: ParsedFile = {
      path: filePath,
      language,
      content,
      symbols: [],
      imports: [],
      exports: [],
      lines: lines.length,
      size,
      hash,
      parsedAt: Date.now(),
    };

    if (opts.includeSymbols) {
      parsedFile.symbols = this.extractSymbols(content, language, filePath);
    }

    if (opts.includeDependencies) {
      parsedFile.imports = this.extractImports(content, language);
      parsedFile.exports = this.extractExports(content, language);
    }

    return parsedFile;
  }

  /**
   * Extract symbols from source code content
   */
  extractSymbols(content: string, language: SupportedLanguage, filePath: string = ''): FileSymbol[] {
    const symbols: FileSymbol[] = [];

    switch (language) {
      case SupportedLanguage.TYPESCRIPT:
      case SupportedLanguage.JAVASCRIPT:
        this.extractTypeScriptSymbols(content, filePath, symbols);
        break;
      case SupportedLanguage.PYTHON:
        this.extractPythonSymbols(content, filePath, symbols);
        break;
      case SupportedLanguage.JAVA:
        this.extractJavaSymbols(content, filePath, symbols);
        break;
      case SupportedLanguage.GO:
        this.extractGoSymbols(content, filePath, symbols);
        break;
      case SupportedLanguage.RUST:
        this.extractRustSymbols(content, filePath, symbols);
        break;
      case SupportedLanguage.CPP:
        this.extractCppSymbols(content, filePath, symbols);
        break;
      case SupportedLanguage.CSHARP:
        this.extractCSharpSymbols(content, filePath, symbols);
        break;
      default:
        this.extractGenericSymbols(content, filePath, symbols);
        break;
    }

    return symbols;
  }

  /**
   * Extract import statements from content
   */
  extractImports(content: string, language: SupportedLanguage): string[] {
    const imports: string[] = [];

    switch (language) {
      case SupportedLanguage.TYPESCRIPT:
      case SupportedLanguage.JAVASCRIPT: {
        const importRegex = /import\s+(?:(?:\{[^}]*\}|[^'"]*)\s+from\s+)?['"]([^'"]+)['"]/g;
        let match: RegExpExecArray | null;
        while ((match = importRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
        // Also match require() calls
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
        break;
      }
      case SupportedLanguage.PYTHON: {
        const importRegex = /^import\s+(\S+)/gm;
        let match: RegExpExecArray | null;
        while ((match = importRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
        const fromImportRegex = /^from\s+(\S+)\s+import/gm;
        while ((match = fromImportRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
        break;
      }
      case SupportedLanguage.JAVA: {
        const importRegex = /^import\s+([^;]+);/gm;
        let match: RegExpExecArray | null;
        while ((match = importRegex.exec(content)) !== null) {
          imports.push(match[1].trim());
        }
        break;
      }
      case SupportedLanguage.GO: {
        const singleImportRegex = /^import\s+"([^"]+)"/gm;
        let match: RegExpExecArray | null;
        while ((match = singleImportRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
        const multiImportRegex = /import\s*\(\s*([\s\S]*?)\)/g;
        while ((match = multiImportRegex.exec(content)) !== null) {
          const inner = match[1];
          const innerMatches = inner.matchAll(/"([^"]+)"/g);
          for (const im of innerMatches) {
            imports.push(im[1]);
          }
        }
        break;
      }
      case SupportedLanguage.RUST: {
        const useRegex = /^use\s+([^;]+);/gm;
        let match: RegExpExecArray | null;
        while ((match = useRegex.exec(content)) !== null) {
          imports.push(match[1].trim());
        }
        break;
      }
      case SupportedLanguage.CSHARP: {
        const usingRegex = /^using\s+([^;]+);/gm;
        let match: RegExpExecArray | null;
        while ((match = usingRegex.exec(content)) !== null) {
          imports.push(match[1].trim());
        }
        break;
      }
      default:
        break;
    }

    return imports;
  }

  /**
   * Extract export statements from content
   */
  extractExports(content: string, language: SupportedLanguage): string[] {
    const exports: string[] = [];

    switch (language) {
      case SupportedLanguage.TYPESCRIPT:
      case SupportedLanguage.JAVASCRIPT: {
        // Named exports
        const exportRegex = /export\s+(?:default\s+)?(?:(?:const|let|var|function|class|interface|type|enum|abstract\s+class)\s+)?(\w+)/g;
        let match: RegExpExecArray | null;
        while ((match = exportRegex.exec(content)) !== null) {
          if (!['default', 'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum', 'abstract'].includes(match[1])) {
            exports.push(match[1]);
          }
        }
        // Export blocks: export { foo, bar }
        const exportBlockRegex = /export\s*\{([^}]*)\}/g;
        while ((match = exportBlockRegex.exec(content)) !== null) {
          const names = match[1].match(/\w+/g);
          if (names) {
            exports.push(...names);
          }
        }
        break;
      }
      case SupportedLanguage.PYTHON: {
        // Python doesn't have explicit exports, but __all__ covers it
        const allRegex = /__all__\s*=\s*\[([^\]]*)\]/g;
        let match: RegExpExecArray | null;
        while ((match = allRegex.exec(content)) !== null) {
          const names = match[1].match(/'([^']+)'|"([^"]+)"/g);
          if (names) {
            exports.push(...names.map(n => n.replace(/['"]/g, '')));
          }
        }
        break;
      }
      case SupportedLanguage.GO: {
        // Exported identifiers start with uppercase
        const goExportRegex = /^(?:func|type|var|const)\s+([A-Z]\w*)/gm;
        let match: RegExpExecArray | null;
        while ((match = goExportRegex.exec(content)) !== null) {
          exports.push(match[1]);
        }
        break;
      }
      case SupportedLanguage.RUST: {
        const pubRegex = /^pub\s+(?:fn|struct|enum|trait|type|const|static|mod)\s+(\w+)/gm;
        let match: RegExpExecArray | null;
        while ((match = pubRegex.exec(content)) !== null) {
          exports.push(match[1]);
        }
        break;
      }
      default:
        break;
    }

    return exports;
  }

  /**
   * Compute a simple hash of content
   */
  computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // ==================== Private: TypeScript/JavaScript Symbol Extraction ====================

  private extractTypeScriptSymbols(content: string, filePath: string, symbols: FileSymbol[]): void {
    // Strip comments
    const stripped = this.stripComments(content, '//', ['/*', '*/']);

    // Function declarations
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
    this.addSymbols(stripped, funcRegex, SymbolKind.FUNCTION, filePath, symbols);

    // Arrow functions assigned to const/let/var
    const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
    this.addSymbols(stripped, arrowRegex, SymbolKind.FUNCTION, filePath, symbols);

    // Class declarations
    const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
    this.addSymbols(stripped, classRegex, SymbolKind.CLASS, filePath, symbols);

    // Method declarations inside classes
    const methodRegex = /(?:public|private|protected|static|async|abstract)?\s*(?:public|private|protected|static|async|abstract)?\s*(\w+)\s*\([^)]*\)\s*\{/g;
    this.addSymbols(stripped, methodRegex, SymbolKind.METHOD, filePath, symbols);

    // Variable declarations (const/let/var - not arrow functions)
    const varRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/g;
    this.addSymbols(stripped, varRegex, SymbolKind.VARIABLE, filePath, symbols);

    // Constants (uppercase)
    const constRegex = /(?:export\s+)?const\s+([A-Z][A-Z_]+)\s*=/g;
    this.addSymbols(stripped, constRegex, SymbolKind.CONSTANT, filePath, symbols);

    // Interface declarations
    const interfaceRegex = /(?:export\s+)?interface\s+(\w+)/g;
    this.addSymbols(stripped, interfaceRegex, SymbolKind.INTERFACE, filePath, symbols);

    // Type aliases
    const typeRegex = /(?:export\s+)?type\s+(\w+)\s*=/g;
    this.addSymbols(stripped, typeRegex, SymbolKind.TYPE, filePath, symbols);

    // Enum declarations
    const enumRegex = /(?:export\s+)?enum\s+(\w+)/g;
    this.addSymbols(stripped, enumRegex, SymbolKind.ENUM, filePath, symbols);

    // Import statements
    const importRegex = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from/g;
    let importMatch: RegExpExecArray | null;
    while ((importMatch = importRegex.exec(stripped)) !== null) {
      const name = importMatch[0].match(/(?:as\s+)?(\w+)\s+from/)?.[1];
      if (name) {
        symbols.push(this.createSymbol(name, SymbolKind.IMPORT, stripped, importMatch.index, filePath));
      }
    }

    // Export re-exports
    const reExportRegex = /export\s+\{[^}]*\}/g;
    let reExportMatch: RegExpExecArray | null;
    while ((reExportMatch = reExportRegex.exec(stripped)) !== null) {
      const names = reExportMatch[0].match(/\b(\w+)\b/g);
      if (names) {
        for (const name of names) {
          if (name !== 'export' && name !== 'as') {
            symbols.push(this.createSymbol(name, SymbolKind.EXPORT, stripped, reExportMatch.index, filePath));
          }
        }
      }
    }
  }

  // ==================== Private: Python Symbol Extraction ====================

  private extractPythonSymbols(content: string, filePath: string, symbols: FileSymbol[]): void {
    // Function definitions
    const funcRegex = /def\s+(\w+)\s*\(/g;
    this.addSymbols(content, funcRegex, SymbolKind.FUNCTION, filePath, symbols);

    // Class definitions
    const classRegex = /class\s+(\w+)\s*[:\(]/g;
    this.addSymbols(content, classRegex, SymbolKind.CLASS, filePath, symbols);

    // Variable assignments (top-level)
    const varRegex = /^(\w+)\s*=/gm;
    this.addSymbols(content, varRegex, SymbolKind.VARIABLE, filePath, symbols);

    // Constants (uppercase)
    const constRegex = /^([A-Z][A-Z_]+)\s*=/gm;
    this.addSymbols(content, constRegex, SymbolKind.CONSTANT, filePath, symbols);

    // Import statements
    const importRegex = /^import\s+(\S+)/gm;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      symbols.push(this.createSymbol(match[1], SymbolKind.IMPORT, content, match.index, filePath));
    }
  }

  // ==================== Private: Java Symbol Extraction ====================

  private extractJavaSymbols(content: string, filePath: string, symbols: FileSymbol[]): void {
    const stripped = this.stripComments(content, '//', ['/*', '*/']);

    // Class declarations
    const classRegex = /(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+(\w+)/g;
    this.addSymbols(stripped, classRegex, SymbolKind.CLASS, filePath, symbols);

    // Interface declarations
    const interfaceRegex = /(?:public|private|protected)?\s*interface\s+(\w+)/g;
    this.addSymbols(stripped, interfaceRegex, SymbolKind.INTERFACE, filePath, symbols);

    // Enum declarations
    const enumRegex = /(?:public|private|protected)?\s*enum\s+(\w+)/g;
    this.addSymbols(stripped, enumRegex, SymbolKind.ENUM, filePath, symbols);

    // Method declarations
    const methodRegex = /(?:public|private|protected)?\s*(?:static|abstract|final|synchronized)?\s*(?:\w+(?:<[^>]*>)?)\s+(\w+)\s*\(/g;
    this.addSymbols(stripped, methodRegex, SymbolKind.METHOD, filePath, symbols);

    // Field declarations
    const fieldRegex = /(?:public|private|protected)?\s*(?:static|final)?\s*(?:\w+(?:<[^>]*>)?)\s+(\w+)\s*[=;]/g;
    this.addSymbols(stripped, fieldRegex, SymbolKind.VARIABLE, filePath, symbols);

    // Package declarations
    const packageRegex = /^package\s+([\w.]+);/gm;
    let match: RegExpExecArray | null;
    while ((match = packageRegex.exec(stripped)) !== null) {
      symbols.push(this.createSymbol(match[1], SymbolKind.MODULE, stripped, match.index, filePath));
    }
  }

  // ==================== Private: Go Symbol Extraction ====================

  private extractGoSymbols(content: string, filePath: string, symbols: FileSymbol[]): void {
    const stripped = this.stripComments(content, '//', ['/*', '*/']);

    // Function declarations
    const funcRegex = /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/g;
    this.addSymbols(stripped, funcRegex, SymbolKind.FUNCTION, filePath, symbols);

    // Type declarations
    const typeRegex = /type\s+(\w+)\s+/g;
    this.addSymbols(stripped, typeRegex, SymbolKind.TYPE, filePath, symbols);

    // Struct declarations
    const structRegex = /type\s+(\w+)\s+struct/g;
    this.addSymbols(stripped, structRegex, SymbolKind.CLASS, filePath, symbols);

    // Interface declarations
    const interfaceRegex = /type\s+(\w+)\s+interface/g;
    this.addSymbols(stripped, interfaceRegex, SymbolKind.INTERFACE, filePath, symbols);

    // Variable declarations
    const varRegex = /var\s+(\w+)\s+/g;
    this.addSymbols(stripped, varRegex, SymbolKind.VARIABLE, filePath, symbols);

    // Constant declarations
    const constRegex = /const\s+(\w+)\s*=/g;
    this.addSymbols(stripped, constRegex, SymbolKind.CONSTANT, filePath, symbols);

    // Package declarations
    const packageRegex = /^package\s+(\w+)/gm;
    let match: RegExpExecArray | null;
    while ((match = packageRegex.exec(stripped)) !== null) {
      symbols.push(this.createSymbol(match[1], SymbolKind.MODULE, stripped, match.index, filePath));
    }
  }

  // ==================== Private: Rust Symbol Extraction ====================

  private extractRustSymbols(content: string, filePath: string, symbols: FileSymbol[]): void {
    const stripped = this.stripComments(content, '//', ['/*', '*/']);

    // Function declarations
    const funcRegex = /fn\s+(\w+)\s*[<\(]/g;
    this.addSymbols(stripped, funcRegex, SymbolKind.FUNCTION, filePath, symbols);

    // Struct declarations
    const structRegex = /struct\s+(\w+)/g;
    this.addSymbols(stripped, structRegex, SymbolKind.CLASS, filePath, symbols);

    // Enum declarations
    const enumRegex = /enum\s+(\w+)/g;
    this.addSymbols(stripped, enumRegex, SymbolKind.ENUM, filePath, symbols);

    // Trait declarations
    const traitRegex = /trait\s+(\w+)/g;
    this.addSymbols(stripped, traitRegex, SymbolKind.INTERFACE, filePath, symbols);

    // Type aliases
    const typeRegex = /type\s+(\w+)\s*=/g;
    this.addSymbols(stripped, typeRegex, SymbolKind.TYPE, filePath, symbols);

    // Module declarations
    const modRegex = /mod\s+(\w+)/g;
    this.addSymbols(stripped, modRegex, SymbolKind.MODULE, filePath, symbols);

    // Constants
    const constRegex = /const\s+(\w+)\s*:/g;
    this.addSymbols(stripped, constRegex, SymbolKind.CONSTANT, filePath, symbols);

    // Static variables
    const staticRegex = /static\s+(\w+)\s*:/g;
    this.addSymbols(stripped, staticRegex, SymbolKind.VARIABLE, filePath, symbols);
  }

  // ==================== Private: C++ Symbol Extraction ====================

  private extractCppSymbols(content: string, filePath: string, symbols: FileSymbol[]): void {
    const stripped = this.stripComments(content, '//', ['/*', '*/']);

    // Function declarations (simplified)
    const funcRegex = /(?:virtual\s+)?(?:static\s+)?(?:inline\s+)?(?:const\s+)?(?:\w+(?:<[^>]*>)?)\s+(\w+)\s*\([^)]*\)\s*(?:const)?\s*[;{]/g;
    this.addSymbols(stripped, funcRegex, SymbolKind.FUNCTION, filePath, symbols);

    // Class declarations
    const classRegex = /class\s+(\w+)/g;
    this.addSymbols(stripped, classRegex, SymbolKind.CLASS, filePath, symbols);

    // Struct declarations
    const structRegex = /struct\s+(\w+)/g;
    this.addSymbols(stripped, structRegex, SymbolKind.CLASS, filePath, symbols);

    // Enum declarations
    const enumRegex = /enum\s+(?:class\s+)?(\w+)/g;
    this.addSymbols(stripped, enumRegex, SymbolKind.ENUM, filePath, symbols);

    // Namespace declarations
    const namespaceRegex = /namespace\s+(\w+)/g;
    this.addSymbols(stripped, namespaceRegex, SymbolKind.MODULE, filePath, symbols);
  }

  // ==================== Private: C# Symbol Extraction ====================

  private extractCSharpSymbols(content: string, filePath: string, symbols: FileSymbol[]): void {
    const stripped = this.stripComments(content, '//', ['/*', '*/']);

    // Class declarations
    const classRegex = /(?:public|private|protected|internal)?\s*(?:static|abstract|sealed)?\s*class\s+(\w+)/g;
    this.addSymbols(stripped, classRegex, SymbolKind.CLASS, filePath, symbols);

    // Interface declarations
    const interfaceRegex = /(?:public|private|protected|internal)?\s*interface\s+(\w+)/g;
    this.addSymbols(stripped, interfaceRegex, SymbolKind.INTERFACE, filePath, symbols);

    // Enum declarations
    const enumRegex = /(?:public|private|protected|internal)?\s*enum\s+(\w+)/g;
    this.addSymbols(stripped, enumRegex, SymbolKind.ENUM, filePath, symbols);

    // Method declarations
    const methodRegex = /(?:public|private|protected|internal)?\s*(?:static|virtual|abstract|override|async)?\s*(?:\w+(?:<[^>]*>)?)\s+(\w+)\s*[<\(]/g;
    this.addSymbols(stripped, methodRegex, SymbolKind.METHOD, filePath, symbols);

    // Namespace declarations
    const namespaceRegex = /namespace\s+(\w+)/g;
    this.addSymbols(stripped, namespaceRegex, SymbolKind.MODULE, filePath, symbols);
  }

  // ==================== Private: Generic Symbol Extraction ====================

  private extractGenericSymbols(content: string, filePath: string, symbols: FileSymbol[]): void {
    // Generic function pattern
    const funcRegex = /(?:function|func|fn|def|sub)\s+(\w+)/g;
    this.addSymbols(content, funcRegex, SymbolKind.FUNCTION, filePath, symbols);

    // Generic class pattern
    const classRegex = /(?:class|struct|interface|trait|enum)\s+(\w+)/g;
    this.addSymbols(content, classRegex, SymbolKind.CLASS, filePath, symbols);
  }

  // ==================== Private: Helpers ====================

  /**
   * Strip comments from source code
   */
  private stripComments(content: string, singleLine: string, multiLine: [string, string]): string {
    let result = content;
    // Remove multi-line comments
    if (multiLine[0] && multiLine[1]) {
      const escapedStart = multiLine[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedEnd = multiLine[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, 'g'), '');
    }
    // Remove single-line comments
    if (singleLine) {
      const escaped = singleLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`${escaped}.*$`, 'gm'), '');
    }
    return result;
  }

  /**
   * Add matched symbols to the array
   */
  private addSymbols(
    content: string,
    regex: RegExp,
    kind: SymbolKind,
    filePath: string,
    symbols: FileSymbol[],
  ): void {
    // Reset regex state
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      // Skip common keywords
      if (this.isKeyword(name)) {
        continue;
      }
      symbols.push(this.createSymbol(name, kind, content, match.index, filePath));
    }
  }

  /**
   * Create a FileSymbol from a match
   */
  private createSymbol(
    name: string,
    kind: SymbolKind,
    content: string,
    position: number,
    filePath: string,
  ): FileSymbol {
    const line = this.getLineNumber(content, position);
    const column = this.getColumnNumber(content, position);
    const endLine = line;
    const endColumn = column + name.length;

    return {
      name,
      kind,
      line,
      column,
      endLine,
      endColumn,
      path: filePath,
    };
  }

  /**
   * Get line number from position (1-based)
   */
  private getLineNumber(content: string, position: number): number {
    let line = 1;
    for (let i = 0; i < position && i < content.length; i++) {
      if (content[i] === '\n') {
        line++;
      }
    }
    return line;
  }

  /**
   * Get column number from position (1-based)
   */
  private getColumnNumber(content: string, position: number): number {
    let column = 1;
    for (let i = position - 1; i >= 0 && content[i] !== '\n'; i--) {
      column++;
    }
    return column;
  }

  /**
   * Check if a name is a common keyword
   */
  private isKeyword(name: string): boolean {
    const keywords = new Set([
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
      'return', 'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
      'instanceof', 'in', 'of', 'void', 'this', 'super', 'true', 'false', 'null',
      'undefined', 'import', 'export', 'default', 'from', 'as', 'async', 'await',
      'yield', 'let', 'var', 'const', 'function', 'class', 'extends', 'implements',
      'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'abstract',
      'static', 'public', 'private', 'protected', 'readonly', 'get', 'set',
      'package', 'int', 'long', 'float', 'double', 'char', 'boolean', 'byte',
      'short', 'string', 'void', 'bool', 'String', 'Integer', 'int32', 'int64',
      'struct', 'impl', 'trait', 'pub', 'use', 'where', 'fn', 'mod', 'crate',
      'self', 'Self', 'mut', 'ref', 'unsafe', 'extern', 'dyn', 'move', 'box',
      'is', 'not', 'and', 'or', 'pass', 'raise', 'with', 'nonlocal', 'global',
      'elif', 'lambda', 'assert', 'del', 'exec', 'print', 'def',
    ]);
    return keywords.has(name);
  }
}