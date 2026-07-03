/**
 * File Reference module exports
 */

// Types
export {
  SupportedLanguage,
  SymbolKind,
  type LanguageConfig,
  type FileSymbol,
  type ParsedFile,
  type FileIndex,
  type FileReferenceResult,
  type ParseOptions,
  type IndexOptions,
  DEFAULT_PARSE_OPTIONS,
  DEFAULT_INDEX_OPTIONS,
} from './types.js';

// LanguageRegistry
export { LanguageRegistry } from './LanguageRegistry.js';

// FileParser
export { FileParser } from './FileParser.js';

// SymbolIndexer
export { SymbolIndexer } from './SymbolIndexer.js';

// FileReferenceService
export {
  FileReferenceService,
  type FileReferenceServiceConfig,
} from './FileReferenceService.js';