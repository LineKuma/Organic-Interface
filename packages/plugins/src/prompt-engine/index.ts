/**
 * Prompt Engine Plugin - Main module exports
 *
 * Provides a complete prompt template system with:
 * - Template compilation with variable substitution
 * - Conditional and loop blocks
 * - Template includes and filters
 * - Version management and rollback
 * - Template registry with search/filter
 */

// Plugin main class
export { PromptEnginePlugin, METADATA } from './PromptEnginePlugin.js';

// Template engine
export { TemplateEngine } from './TemplateEngine.js';

// Version manager
export { VersionManager } from './VersionManager.js';

// Prompt registry
export { PromptRegistry } from './PromptRegistry.js';

// Types
export type {
  TemplateVariableType,
  TemplateVariableValidation,
  TemplateVariable,
  TemplateBlockType,
  TemplateBlock,
  TemplateVersion,
  PromptTemplate,
  TemplateCategory,
  TemplateFilter,
  ImportResult,
  ImportError,
  TemplateValidationResult,
  TemplateValidationError,
  TemplateValidationWarning,
} from './types/index.js';

/**
 * Plugin version
 */
export const VERSION = '1.0.0';

/**
 * Plugin identifier
 */
export const PLUGIN_ID = 'prompt-engine';
