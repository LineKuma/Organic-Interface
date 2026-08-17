/**
 * File Reference - Type definitions for file parsing and symbol indexing
 *
 * Provides types for language detection, file parsing, symbol extraction,
 * and file indexing within the context management system.
 */

/**
 * Supported programming languages
 */
export enum SupportedLanguage {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  JAVA = 'java',
  GO = 'go',
  RUST = 'rust',
  CPP = 'cpp',
  CSHARP = 'csharp',
  RUBY = 'ruby',
  PHP = 'php',
  SWIFT = 'swift',
  KOTLIN = 'kotlin',
  SQL = 'sql',
  YAML = 'yaml',
  JSON = 'json',
  MARKDOWN = 'markdown',
  UNKNOWN = 'unknown',
}

/**
 * Language configuration
 */
export interface LanguageConfig {
  /** File extensions associated with this language */
  extensions: string[];
  /** Comment patterns */
  commentPatterns: {
    /** Single-line comment prefix */
    single: string;
    /** Multi-line comment delimiters [start, end] */
    multi: [string, string];
  };
  /** Language keywords */
  keywords: string[];
  /** Language operators */
  operators: string[];
}

/**
 * Symbol kind enumeration
 */
export enum SymbolKind {
  FUNCTION = 'FUNCTION',
  CLASS = 'CLASS',
  METHOD = 'METHOD',
  VARIABLE = 'VARIABLE',
  CONSTANT = 'CONSTANT',
  INTERFACE = 'INTERFACE',
  TYPE = 'TYPE',
  ENUM = 'ENUM',
  MODULE = 'MODULE',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * A symbol extracted from source code
 */
export interface FileSymbol {
  /** Symbol name */
  name: string;
  /** Kind of symbol */
  kind: SymbolKind;
  /** Starting line (1-based) */
  line: number;
  /** Starting column (1-based) */
  column: number;
  /** Ending line (1-based) */
  endLine: number;
  /** Ending column (1-based) */
  endColumn: number;
  /** File path of the containing file */
  path: string;
  /** Parent symbol name (e.g., class name for a method) */
  parent?: string;
  /** Child symbol names */
  children?: string[];
  /** Symbol modifiers (e.g., 'static', 'async', 'private') */
  modifiers?: string[];
  /** JSDoc/documentation comment */
  documentation?: string;
}

/**
 * Parsed file representation
 */
export interface ParsedFile {
  /** Absolute or relative file path */
  path: string;
  /** Detected language */
  language: SupportedLanguage;
  /** Raw file content */
  content: string;
  /** Extracted symbols */
  symbols: FileSymbol[];
  /** Import statements */
  imports: string[];
  /** Export statements */
  exports: string[];
  /** Number of lines */
  lines: number;
  /** File size in bytes */
  size: number;
  /** Content hash */
  hash: string;
  /** Parsing timestamp */
  parsedAt: number;
}

/**
 * File index for symbol lookup and dependency tracking
 */
export interface FileIndex {
  /** Map of file path to parsed file */
  files: Map<string, ParsedFile>;
  /** Map of symbol name to symbols across files */
  symbols: Map<string, FileSymbol[]>;
  /** Map of file path to its dependencies */
  dependencies: Map<string, string[]>;
}

/**
 * File reference result
 */
export interface FileReferenceResult {
  /** The parsed file */
  file: ParsedFile;
  /** Related file paths */
  relatedFiles: string[];
  /** Extracted symbols */
  symbols: FileSymbol[];
  /** Dependency file paths */
  dependencies: string[];
}

/**
 * Parsing options
 */
export interface ParseOptions {
  /** Maximum file size in bytes (files larger are skipped) */
  maxFileSize?: number;
  /** Whether to extract symbols */
  includeSymbols?: boolean;
  /** Whether to extract dependencies */
  includeDependencies?: boolean;
  /** Directory traversal depth */
  depth?: number;
}

/**
 * Indexing options
 */
export interface IndexOptions {
  /** Whether to watch for file changes */
  watchMode?: boolean;
  /** Glob patterns to exclude */
  excludePatterns?: string[];
  /** Glob patterns to include */
  includePatterns?: string[];
}

/**
 * Default parse options
 */
export const DEFAULT_PARSE_OPTIONS: Required<ParseOptions> = {
  maxFileSize: 1024 * 1024, // 1MB
  includeSymbols: true,
  includeDependencies: true,
  depth: 1,
};

/**
 * Default index options
 */
export const DEFAULT_INDEX_OPTIONS: Required<IndexOptions> = {
  watchMode: false,
  excludePatterns: ['node_modules', 'dist', '.git', 'build', '__pycache__', '*.min.*'],
  includePatterns: ['*'],
};
