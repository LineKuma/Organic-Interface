/**
 * Prompt Template System - Type Definitions
 */

// ==================== Template Variable ====================

/**
 * Template variable type
 */
export type TemplateVariableType = 'string' | 'number' | 'boolean' | 'array' | 'object';

/**
 * Template variable validation rules
 */
export interface TemplateVariableValidation {
  /** Regex pattern for string validation */
  pattern?: string;
  /** Minimum value for numbers or minimum length for strings/arrays */
  min?: number;
  /** Maximum value for numbers or maximum length for strings/arrays */
  max?: number;
  /** Allowed enum values */
  enum?: unknown[];
  /** Custom validation function identifier */
  custom?: string;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: TemplateVariableType;
  /** Default value */
  defaultValue?: unknown;
  /** Description of the variable */
  description?: string;
  /** Whether this variable is required */
  required?: boolean;
  /** Validation rules */
  validation?: TemplateVariableValidation;
}

// ==================== Template Block (AST) ====================

/**
 * Template block types
 */
export type TemplateBlockType = 'text' | 'variable' | 'condition' | 'loop' | 'include';

/**
 * Template block - AST node
 */
export interface TemplateBlock {
  /** Block type */
  type: TemplateBlockType;
  /** Raw content for text blocks */
  content?: string;
  /** Child blocks for structural blocks (condition, loop) */
  children?: TemplateBlock[];
  /** Condition expression for conditional blocks */
  condition?: string;
  /** Variable name for variable blocks */
  variable?: string;
  /** Filter expression for variable blocks */
  filter?: string;
  /** Default value for variable blocks */
  defaultValue?: string;
  /** Collection name for loop blocks */
  collection?: string;
  /** Item name for loop blocks */
  itemName?: string;
  /** Template name for include blocks */
  templateName?: string;
}

// ==================== Template Version ====================

/**
 * Template version record
 */
export interface TemplateVersion {
  /** Semantic version string */
  version: string;
  /** Template content at this version */
  content: string;
  /** Creation timestamp */
  createdAt: number;
  /** Version message / changelog */
  message: string;
  /** Author of this version */
  author?: string;
}

// ==================== Prompt Template ====================

/**
 * Prompt template
 */
export interface PromptTemplate {
  /** Unique identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template category */
  category: string;
  /** Template content with variable placeholders */
  content: string;
  /** Template variables */
  variables: TemplateVariable[];
  /** Version history */
  versions: TemplateVersion[];
  /** Current active version */
  currentVersion: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Tags for categorization */
  tags: string[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

// ==================== Template Category ====================

/**
 * Template category
 */
export interface TemplateCategory {
  /** Category identifier */
  id: string;
  /** Category name */
  name: string;
  /** Category description */
  description: string;
  /** Optional icon identifier */
  icon?: string;
}

// ==================== Template Filter ====================

/**
 * Template filter/search criteria
 */
export interface TemplateFilter {
  /** Filter by category */
  category?: string;
  /** Filter by tags */
  tags?: string[];
  /** Search query (full-text) */
  search?: string;
  /** Sort field */
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  /** Sort order */
  order?: 'asc' | 'desc';
}

// ==================== Import/Export ====================

/**
 * Template import result
 */
export interface ImportResult {
  /** Whether the import was successful */
  success: boolean;
  /** Number of templates imported */
  imported: number;
  /** Import errors */
  errors: ImportError[];
}

/**
 * Import error entry
 */
export interface ImportError {
  /** Template ID that caused the error */
  templateId?: string;
  /** Error message */
  message: string;
  /** Template name that caused the error */
  templateName?: string;
}

// ==================== Validation ====================

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  /** Whether the template is valid */
  valid: boolean;
  /** Validation errors */
  errors: TemplateValidationError[];
  /** Validation warnings */
  warnings: TemplateValidationWarning[];
}

/**
 * Template validation error
 */
export interface TemplateValidationError {
  /** Error message */
  message: string;
  /** Line number where the error occurred */
  line?: number;
  /** Column number where the error occurred */
  column?: number;
  /** The problematic token or expression */
  token?: string;
}

/**
 * Template validation warning
 */
export interface TemplateValidationWarning {
  /** Warning message */
  message: string;
  /** Line number where the warning occurred */
  line?: number;
  /** The concerning token or expression */
  token?: string;
}
