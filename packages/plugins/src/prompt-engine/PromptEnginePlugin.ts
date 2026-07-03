/**
 * PromptEnginePlugin - Prompt template system plugin for Organic Interface
 *
 * Provides template compilation, registration, versioning, and management
 * for prompt engineering workflows. Supports variable interpolation,
 * conditionals, loops, includes, filters, and version history.
 */

import type {
  PluginContext,
  PluginInput,
  PluginOutput,
  InitializeResult,
  KernelApi,
} from '@organic/utils';

import { createLogger, type Logger } from '@organic/utils';
import { TemplateEngine } from './TemplateEngine.js';
import { VersionManager } from './VersionManager.js';
import { PromptRegistry } from './PromptRegistry.js';
import type {
  PromptTemplate,
  TemplateVariable,
  TemplateVersion,
  TemplateFilter,
  ImportResult,
  TemplateValidationResult,
} from './types/template.js';

/**
 * Plugin metadata
 */
const METADATA = {
  id: 'prompt-engine',
  name: 'prompt-engine',
  version: '1.0.0',
  description: 'Prompt template engine for composing, managing, and versioning prompt templates',
  apiVersion: '1.0.0',
  minKernelVersion: '1.0.0',
  dependencies: [],
  defaultConfig: {
    enableVersioning: true,
    enableValidation: true,
    maxTemplateSize: 50000,
    cacheEnabled: true,
    defaultCategory: 'general',
  },
};

/**
 * Prompt engine action types
 */
enum PromptEngineAction {
  COMPILE = 'compile',
  REGISTER = 'register',
  GET = 'get',
  LIST = 'list',
  SEARCH = 'search',
  UPDATE = 'update',
  DELETE = 'delete',
  ROLLBACK = 'rollback',
  HISTORY = 'history',
  DIFF = 'diff',
  IMPORT = 'import',
  EXPORT = 'export',
  VALIDATE = 'validate',
  EXTRACT_VARIABLES = 'extractVariables',
  GET_CATEGORIES = 'getCategories',
  GET_TAGS = 'getTags',
}

/**
 * PromptEnginePlugin implementation
 */
export class PromptEnginePlugin {
  /** Plugin name */
  readonly name: string = METADATA.name;

  /** Plugin version */
  readonly version: string = METADATA.version;

  /** Plugin description */
  readonly description: string = METADATA.description;

  /** Kernel API interface */
  private kernel: KernelApi | null = null;

  /** Plugin configuration */
  private config: Record<string, unknown> = {};

  /** Whether plugin is initialized */
  private initialized: boolean = false;

  /** Template engine instance */
  private templateEngine: TemplateEngine | null = null;

  /** Version manager instance */
  private versionManager: VersionManager | null = null;

  /** Prompt registry instance */
  private promptRegistry: PromptRegistry | null = null;

  /** Logger instance */
  private logger: Logger | null = null;

  /**
   * Create a new PromptEnginePlugin
   */
  constructor() {
    // Constructor is minimal - initialization happens in initialize()
  }

  // ==================== PluginInterface Implementation ====================

  /**
   * Get plugin metadata
   */
  getMetadata(): typeof METADATA {
    return { ...METADATA };
  }

  /**
   * Initialize the plugin
   * @param context - Plugin context with kernel API and configuration
   */
  async initialize(context: PluginContext): Promise<InitializeResult> {
    try {
      this.kernel = context.kernel;
      this.logger = createLogger({ prefix: 'PromptEnginePlugin' });

      this.config = {
        ...METADATA.defaultConfig,
        ...context.config,
      };

      // Initialize core components
      this.templateEngine = new TemplateEngine();
      this.versionManager = new VersionManager();
      this.promptRegistry = new PromptRegistry();

      // Register built-in templates
      this.registerBuiltinTemplates();

      this.initialized = true;
      this.logger.info('Plugin initialized successfully');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a plugin action
   * @param input - Plugin input with action and parameters
   */
  async execute(input: PluginInput): Promise<PluginOutput> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Plugin not initialized',
      };
    }

    try {
      const action = input.action as PromptEngineAction;
      const params = input.params ?? {};

      let result: unknown;

      switch (action) {
        case PromptEngineAction.COMPILE:
          result = this.handleCompile(params);
          break;

        case PromptEngineAction.REGISTER:
          result = this.handleRegister(params);
          break;

        case PromptEngineAction.GET:
          result = this.handleGet(params);
          break;

        case PromptEngineAction.LIST:
          result = this.handleList(params);
          break;

        case PromptEngineAction.SEARCH:
          result = this.handleSearch(params);
          break;

        case PromptEngineAction.UPDATE:
          result = this.handleUpdate(params);
          break;

        case PromptEngineAction.DELETE:
          result = this.handleDelete(params);
          break;

        case PromptEngineAction.ROLLBACK:
          result = this.handleRollback(params);
          break;

        case PromptEngineAction.HISTORY:
          result = this.handleHistory(params);
          break;

        case PromptEngineAction.DIFF:
          result = this.handleDiff(params);
          break;

        case PromptEngineAction.IMPORT:
          result = this.handleImport(params);
          break;

        case PromptEngineAction.EXPORT:
          result = this.handleExport(params);
          break;

        case PromptEngineAction.VALIDATE:
          result = this.handleValidate(params);
          break;

        case PromptEngineAction.EXTRACT_VARIABLES:
          result = this.handleExtractVariables(params);
          break;

        case PromptEngineAction.GET_CATEGORIES:
          result = this.handleGetCategories();
          break;

        case PromptEngineAction.GET_TAGS:
          result = this.handleGetTags();
          break;

        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
          };
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger?.error('Execution error', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Shutdown the plugin gracefully
   */
  async shutdown(): Promise<void> {
    this.logger?.info('Shutting down plugin');

    this.kernel = null;
    this.templateEngine = null;
    this.versionManager = null;
    this.promptRegistry = null;
    this.initialized = false;

    this.logger?.info('Plugin shutdown complete');
  }

  // ==================== Action Handlers ====================

  /**
   * Handle compile action
   */
  private handleCompile(params: Record<string, unknown>): { compiled: string } {
    const templateId = params.templateId as string;
    const variables = (params.variables as Record<string, unknown>) || {};

    let templateContent: string;

    if (templateId) {
      const template = this.promptRegistry!.get(templateId);
      if (!template) {
        throw new Error(`Template "${templateId}" not found`);
      }
      templateContent = template.content;
    } else {
      templateContent = params.template as string;
      if (!templateContent) {
        throw new Error('Either templateId or template content must be provided');
      }
    }

    const compiled = this.templateEngine!.compile(templateContent, variables);
    return { compiled };
  }

  /**
   * Handle register action
   */
  private handleRegister(params: Record<string, unknown>): PromptTemplate {
    const template = params.template as PromptTemplate;
    if (!template) {
      throw new Error('Template data is required');
    }

    const now = Date.now();
    const templateToRegister: PromptTemplate = {
      ...template,
      createdAt: template.createdAt || now,
      updatedAt: now,
      currentVersion: template.currentVersion || '1.0.0',
      versions: template.versions || [],
      tags: template.tags || [],
      metadata: template.metadata || {},
    };

    this.promptRegistry!.register(templateToRegister);

    // Create initial version if versioning is enabled
    if (this.config.enableVersioning && templateToRegister.versions.length === 0) {
      this.versionManager!.createVersion(
        templateToRegister.id,
        templateToRegister.content,
        'Initial version'
      );
    }

    return templateToRegister;
  }

  /**
   * Handle get action
   */
  private handleGet(params: Record<string, unknown>): PromptTemplate | null {
    const id = params.id as string;
    if (!id) {
      throw new Error('Template ID is required');
    }

    const template = this.promptRegistry!.get(id);
    if (!template) {
      return null;
    }

    return template;
  }

  /**
   * Handle list action
   */
  private handleList(params: Record<string, unknown>): PromptTemplate[] {
    const filter = params.filter as TemplateFilter | undefined;
    if (filter) {
      return this.promptRegistry!.find(filter);
    }
    return this.promptRegistry!.list();
  }

  /**
   * Handle search action
   */
  private handleSearch(params: Record<string, unknown>): PromptTemplate[] {
    const query = params.query as string;
    if (!query) {
      throw new Error('Search query is required');
    }
    return this.promptRegistry!.search(query);
  }

  /**
   * Handle update action
   */
  private handleUpdate(params: Record<string, unknown>): PromptTemplate {
    const id = params.id as string;
    const updates = params.updates as Partial<PromptTemplate>;

    if (!id) {
      throw new Error('Template ID is required');
    }
    if (!updates) {
      throw new Error('Updates are required');
    }

    const updated = this.promptRegistry!.update(id, updates);

    // Create a new version if content changed and versioning is enabled
    if (this.config.enableVersioning && updates.content) {
      this.versionManager!.createVersion(
        id,
        updates.content,
        (params.message as string) || 'Content updated'
      );
    }

    return updated;
  }

  /**
   * Handle delete action
   */
  private handleDelete(params: Record<string, unknown>): { deleted: boolean } {
    const id = params.id as string;
    if (!id) {
      throw new Error('Template ID is required');
    }

    const deleted = this.promptRegistry!.unregister(id);
    if (deleted) {
      this.versionManager!.removeTemplate(id);
    }

    return { deleted };
  }

  /**
   * Handle rollback action
   */
  private handleRollback(params: Record<string, unknown>): TemplateVersion {
    const templateId = params.templateId as string;
    const targetVersion = params.targetVersion as string;

    if (!templateId) {
      throw new Error('Template ID is required');
    }
    if (!targetVersion) {
      throw new Error('Target version is required');
    }

    const version = this.versionManager!.rollback(templateId, targetVersion);

    // Update the template content to the rolled-back version
    this.promptRegistry!.update(templateId, {
      content: version.content,
      currentVersion: version.version,
    });

    return version;
  }

  /**
   * Handle history action
   */
  private handleHistory(params: Record<string, unknown>): TemplateVersion[] {
    const templateId = params.templateId as string;
    if (!templateId) {
      throw new Error('Template ID is required');
    }

    return this.versionManager!.getHistory(templateId);
  }

  /**
   * Handle diff action
   */
  private handleDiff(params: Record<string, unknown>): { diff: string } {
    const templateId = params.templateId as string;
    const v1 = params.v1 as string;
    const v2 = params.v2 as string;

    if (!templateId) throw new Error('Template ID is required');
    if (!v1) throw new Error('Version 1 is required');
    if (!v2) throw new Error('Version 2 is required');

    const diff = this.versionManager!.diff(templateId, v1, v2);
    return { diff };
  }

  /**
   * Handle import action
   */
  private handleImport(params: Record<string, unknown>): ImportResult {
    const templates = params.templates as PromptTemplate[];
    if (!templates || !Array.isArray(templates)) {
      throw new Error('Templates array is required');
    }

    return this.promptRegistry!.import(templates);
  }

  /**
   * Handle export action
   */
  private handleExport(params: Record<string, unknown>): PromptTemplate[] {
    const ids = params.ids as string[] | undefined;
    return this.promptRegistry!.export(ids);
  }

  /**
   * Handle validate action
   */
  private handleValidate(params: Record<string, unknown>): TemplateValidationResult {
    const template = params.template as string;
    const variables = (params.variables as TemplateVariable[]) || [];

    if (!template) {
      throw new Error('Template content is required');
    }

    return this.templateEngine!.validate(template, variables);
  }

  /**
   * Handle extractVariables action
   */
  private handleExtractVariables(params: Record<string, unknown>): { variables: string[] } {
    const template = params.template as string;
    if (!template) {
      throw new Error('Template content is required');
    }

    const variables = this.templateEngine!.extractVariables(template);
    return { variables };
  }

  /**
   * Handle getCategories action
   */
  private handleGetCategories(): { categories: string[] } {
    return { categories: this.promptRegistry!.getCategories() };
  }

  /**
   * Handle getTags action
   */
  private handleGetTags(): { tags: string[] } {
    return { tags: this.promptRegistry!.getTags() };
  }

  // ==================== Public API ====================

  /**
   * Get the template engine instance
   */
  getTemplateEngine(): TemplateEngine | null {
    return this.templateEngine;
  }

  /**
   * Get the version manager instance
   */
  getVersionManager(): VersionManager | null {
    return this.versionManager;
  }

  /**
   * Get the prompt registry instance
   */
  getPromptRegistry(): PromptRegistry | null {
    return this.promptRegistry;
  }

  /**
   * Check if plugin is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ==================== Private Methods ====================

  /**
   * Register built-in templates for common scenarios
   */
  private registerBuiltinTemplates(): void {
    const now = Date.now();
    const builtins: PromptTemplate[] = [
      {
        id: 'builtin-code-review',
        name: 'Code Review',
        description: 'Prompt for reviewing code changes',
        category: 'code',
        content:
          'Please review the following code:\n\n```{{language}}\n{{code}}\n```\n\nFocus on:\n{{#if focus}}\n{{#each focus as item}}\n- {{item}}\n{{/each}}\n{{/if}}\n{{default "Please provide a thorough review."}}',
        variables: [
          { name: 'language', type: 'string', required: true, description: 'Programming language' },
          { name: 'code', type: 'string', required: true, description: 'Code to review' },
          { name: 'focus', type: 'array', required: false, description: 'Focus areas' },
        ],
        versions: [],
        currentVersion: '1.0.0',
        createdAt: now,
        updatedAt: now,
        tags: ['code', 'review', 'builtin'],
        metadata: { builtin: true },
      },
      {
        id: 'builtin-refactoring',
        name: 'Refactoring',
        description: 'Prompt for code refactoring',
        category: 'code',
        content:
          'Refactor the following {{language}} code:\n\n```{{language}}\n{{code}}\n```\n\n{{#if goal}}Goal: {{goal}}{{/if}}\n{{#if constraints}}\nConstraints:\n{{#each constraints as item}}\n- {{item}}\n{{/each}}\n{{/if}}',
        variables: [
          { name: 'language', type: 'string', required: true, description: 'Programming language' },
          { name: 'code', type: 'string', required: true, description: 'Code to refactor' },
          { name: 'goal', type: 'string', required: false, description: 'Refactoring goal' },
          { name: 'constraints', type: 'array', required: false, description: 'Constraints' },
        ],
        versions: [],
        currentVersion: '1.0.0',
        createdAt: now,
        updatedAt: now,
        tags: ['code', 'refactoring', 'builtin'],
        metadata: { builtin: true },
      },
      {
        id: 'builtin-bug-fix',
        name: 'Bug Fix',
        description: 'Prompt for fixing bugs',
        category: 'code',
        content:
          'Fix the bug in the following {{language}} code:\n\n```{{language}}\n{{code}}\n```\n\nError: {{error}}\n\n{{#if expected}}Expected behavior: {{expected}}{{/if}}',
        variables: [
          { name: 'language', type: 'string', required: true, description: 'Programming language' },
          { name: 'code', type: 'string', required: true, description: 'Code with bug' },
          { name: 'error', type: 'string', required: true, description: 'Error message' },
          { name: 'expected', type: 'string', required: false, description: 'Expected behavior' },
        ],
        versions: [],
        currentVersion: '1.0.0',
        createdAt: now,
        updatedAt: now,
        tags: ['code', 'bug', 'fix', 'builtin'],
        metadata: { builtin: true },
      },
      {
        id: 'builtin-documentation',
        name: 'Documentation',
        description: 'Prompt for generating documentation',
        category: 'documentation',
        content:
          'Generate documentation for the following {{language}} code:\n\n```{{language}}\n{{code}}\n```\n\n{{#if style}}Style: {{style}}{{/if}}\n{{#if audience}}Target audience: {{audience}}{{/if}}',
        variables: [
          { name: 'language', type: 'string', required: true, description: 'Programming language' },
          { name: 'code', type: 'string', required: true, description: 'Code to document' },
          { name: 'style', type: 'string', required: false, description: 'Documentation style' },
          { name: 'audience', type: 'string', required: false, description: 'Target audience' },
        ],
        versions: [],
        currentVersion: '1.0.0',
        createdAt: now,
        updatedAt: now,
        tags: ['documentation', 'builtin'],
        metadata: { builtin: true },
      },
      {
        id: 'builtin-explain-code',
        name: 'Explain Code',
        description: 'Prompt for explaining code',
        category: 'explanation',
        content:
          'Explain the following {{language}} code:\n\n```{{language}}\n{{code}}\n```\n\n{{#if level}}Detail level: {{level}}{{/if}}',
        variables: [
          { name: 'language', type: 'string', required: true, description: 'Programming language' },
          { name: 'code', type: 'string', required: true, description: 'Code to explain' },
          {
            name: 'level',
            type: 'string',
            required: false,
            description: 'Detail level',
            defaultValue: 'intermediate',
          },
        ],
        versions: [],
        currentVersion: '1.0.0',
        createdAt: now,
        updatedAt: now,
        tags: ['explanation', 'code', 'builtin'],
        metadata: { builtin: true },
      },
      {
        id: 'builtin-test-generation',
        name: 'Test Generation',
        description: 'Prompt for generating unit tests',
        category: 'testing',
        content:
          'Generate unit tests for the following {{language}} code:\n\n```{{language}}\n{{code}}\n```\n\n{{#if framework}}Using test framework: {{framework}}{{/if}}\n{{#if coverage}}Target coverage: {{coverage}}{{/if}}',
        variables: [
          { name: 'language', type: 'string', required: true, description: 'Programming language' },
          { name: 'code', type: 'string', required: true, description: 'Code to test' },
          { name: 'framework', type: 'string', required: false, description: 'Test framework' },
          { name: 'coverage', type: 'string', required: false, description: 'Coverage target' },
        ],
        versions: [],
        currentVersion: '1.0.0',
        createdAt: now,
        updatedAt: now,
        tags: ['testing', 'builtin'],
        metadata: { builtin: true },
      },
    ];

    for (const template of builtins) {
      try {
        this.promptRegistry!.register(template);

        // Create initial version
        if (this.config.enableVersioning) {
          this.versionManager!.createVersion(
            template.id,
            template.content,
            'Initial version (builtin)'
          );
        }
      } catch (err) {
        this.logger?.warn(`Failed to register builtin template "${template.id}"`, err);
      }
    }

    this.logger?.info(`Registered ${builtins.length} builtin templates`);
  }
}

// Export metadata for discovery
export { METADATA };
