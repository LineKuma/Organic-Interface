/**
 * PromptEnginePlugin Tests
 *
 * Tests for the full plugin lifecycle, command handling, and integration
 * between TemplateEngine, VersionManager, and PromptRegistry.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptEnginePlugin } from '../PromptEnginePlugin.js';
import type { PluginContext, PluginInput, KernelApi } from '@organic/utils';
import type { PromptTemplate, TemplateVersion } from '../types/template.js';

// Mock KernelApi
const mockKernelApi: Partial<KernelApi> = {
  getConfig: vi.fn(() => ({ name: 'test-kernel', version: '1.0.0' })),
  getVersion: vi.fn(() => '1.0.0'),
  registerPlugin: vi.fn(),
  unregisterPlugin: vi.fn(),
  getPlugin: vi.fn(),
  listPlugins: vi.fn(() => []),
  executeTool: vi.fn(),
};

// Helper to create plugin context
function createMockContext(config?: Record<string, unknown>): PluginContext {
  return {
    kernel: mockKernelApi as KernelApi,
    config: {
      name: 'prompt-engine',
      enabled: true,
      ...config,
    },
  };
}

// Helper to create plugin input
function createPluginInput(action: string, params?: Record<string, unknown>): PluginInput {
  return {
    action,
    params,
  };
}

// Helper to create a test template
function createTestTemplate(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  const now = Date.now();
  return {
    id: 'custom-1',
    name: 'Custom Template',
    description: 'A custom template',
    category: 'custom',
    content: 'Hello {{name}}!',
    variables: [{ name: 'name', type: 'string', required: true }],
    versions: [],
    currentVersion: '1.0.0',
    createdAt: now,
    updatedAt: now,
    tags: ['custom'],
    metadata: {},
    ...overrides,
  };
}

describe('PromptEnginePlugin', () => {
  let plugin: PromptEnginePlugin;

  beforeEach(() => {
    plugin = new PromptEnginePlugin();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await plugin.shutdown();
  });

  // ==================== Initialization ====================

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const result = await plugin.initialize(createMockContext());
      expect(result.success).toBe(true);
      expect(plugin.isInitialized()).toBe(true);
    });

    it('should create engine instances', async () => {
      await plugin.initialize(createMockContext());
      expect(plugin.getTemplateEngine()).not.toBeNull();
      expect(plugin.getVersionManager()).not.toBeNull();
      expect(plugin.getPromptRegistry()).not.toBeNull();
    });

    it('should register built-in templates', async () => {
      await plugin.initialize(createMockContext());
      const registry = plugin.getPromptRegistry()!;
      expect(registry.get('builtin-code-review')).toBeDefined();
      expect(registry.get('builtin-refactoring')).toBeDefined();
      expect(registry.get('builtin-bug-fix')).toBeDefined();
      expect(registry.get('builtin-documentation')).toBeDefined();
      expect(registry.get('builtin-explain-code')).toBeDefined();
      expect(registry.get('builtin-test-generation')).toBeDefined();
    });

    it('should return metadata', () => {
      const metadata = plugin.getMetadata();
      expect(metadata.id).toBe('prompt-engine');
      expect(metadata.name).toBe('prompt-engine');
      expect(metadata.version).toBe('1.0.0');
    });
  });

  // ==================== execute() - Before Init ====================

  describe('execute() before initialization', () => {
    it('should return error when not initialized', async () => {
      const result = await plugin.execute(createPluginInput('compile'));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });
  });

  // ==================== compile action ====================

  describe('compile action', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
    });

    it('should compile inline template', async () => {
      const result = await plugin.execute(
        createPluginInput('compile', {
          template: 'Hello {{name}}!',
          variables: { name: 'World' },
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as { compiled: string };
      expect(data.compiled).toBe('Hello World!');
    });

    it('should compile registered template by ID', async () => {
      // Register a custom template first
      await plugin.execute(
        createPluginInput('register', {
          template: createTestTemplate({ id: 'hello-tpl', content: 'Hi {{name}}' }),
        })
      );

      const result = await plugin.execute(
        createPluginInput('compile', {
          templateId: 'hello-tpl',
          variables: { name: 'Alice' },
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as { compiled: string };
      expect(data.compiled).toBe('Hi Alice');
    });

    it('should throw error when no template provided', async () => {
      const result = await plugin.execute(createPluginInput('compile', { variables: {} }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('template');
    });

    it('should throw error for non-existent template ID', async () => {
      const result = await plugin.execute(
        createPluginInput('compile', {
          templateId: 'non-existent',
          variables: {},
        })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ==================== register action ====================

  describe('register action', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
    });

    it('should register a new template', async () => {
      const result = await plugin.execute(
        createPluginInput('register', {
          template: createTestTemplate(),
        })
      );

      expect(result.success).toBe(true);
      const template = result.data as PromptTemplate;
      expect(template.id).toBe('custom-1');
      expect(template.name).toBe('Custom Template');
    });

    it('should create initial version', async () => {
      const result = await plugin.execute(
        createPluginInput('register', {
          template: createTestTemplate(),
        })
      );

      expect(result.success).toBe(true);
      const template = result.data as PromptTemplate;
      expect(template.currentVersion).toBe('1.0.0');
    });

    it('should throw error when no template provided', async () => {
      const result = await plugin.execute(createPluginInput('register', {}));
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  // ==================== get action ====================

  describe('get action', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
    });

    it('should get a template by ID', async () => {
      await plugin.execute(
        createPluginInput('register', {
          template: createTestTemplate(),
        })
      );

      const result = await plugin.execute(createPluginInput('get', { id: 'custom-1' }));
      expect(result.success).toBe(true);
      const template = result.data as PromptTemplate;
      expect(template.id).toBe('custom-1');
    });

    it('should return null for non-existent template', async () => {
      const result = await plugin.execute(createPluginInput('get', { id: 'non-existent' }));
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should throw error when no ID provided', async () => {
      const result = await plugin.execute(createPluginInput('get', {}));
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  // ==================== list action ====================

  describe('list action', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
    });

    it('should list all templates (including builtins)', async () => {
      const result = await plugin.execute(createPluginInput('list'));
      expect(result.success).toBe(true);
      const templates = result.data as PromptTemplate[];
      expect(templates.length).toBeGreaterThanOrEqual(6); // Built-in templates
    });

    it('should list with filter', async () => {
      const result = await plugin.execute(
        createPluginInput('list', {
          filter: { category: 'code' },
        })
      );
      expect(result.success).toBe(true);
      const templates = result.data as PromptTemplate[];
      for (const t of templates) {
        expect(t.category).toBe('code');
      }
    });
  });

  // ==================== search action ====================

  describe('search action', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
    });

    it('should search templates', async () => {
      const result = await plugin.execute(createPluginInput('search', { query: 'code review' }));
      expect(result.success).toBe(true);
      const templates = result.data as PromptTemplate[];
      expect(templates.length).toBeGreaterThanOrEqual(1);
      expect(templates.some(t => t.id === 'builtin-code-review')).toBe(true);
    });

    it('should throw error when no query provided', async () => {
      const result = await plugin.execute(createPluginInput('search', {}));
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  // ==================== update action ====================

  describe('update action', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
      await plugin.execute(
        createPluginInput('register', {
          template: createTestTemplate(),
        })
      );
    });

    it('should update template properties', async () => {
      const result = await plugin.execute(
        createPluginInput('update', {
          id: 'custom-1',
          updates: { name: 'Updated Name' },
        })
      );

      expect(result.success).toBe(true);
      const template = result.data as PromptTemplate;
      expect(template.name).toBe('Updated Name');
    });

    it('should create version when content changes', async () => {
      const result = await plugin.execute(
        createPluginInput('update', {
          id: 'custom-1',
          updates: { content: 'New content {{name}}' },
          message: 'Content update',
        })
      );

      expect(result.success).toBe(true);
      const template = result.data as PromptTemplate;
      expect(template.content).toBe('New content {{name}}');
    });

    it('should throw for non-existent template', async () => {
      const result = await plugin.execute(
        createPluginInput('update', {
          id: 'non-existent',
          updates: { name: 'test' },
        })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ==================== delete action ====================

  describe('delete action', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
      await plugin.execute(
        createPluginInput('register', {
          template: createTestTemplate(),
        })
      );
    });

    it('should delete a template', async () => {
      const result = await plugin.execute(createPluginInput('delete', { id: 'custom-1' }));
      expect(result.success).toBe(true);
      const data = result.data as { deleted: boolean };
      expect(data.deleted).toBe(true);

      const getResult = await plugin.execute(createPluginInput('get', { id: 'custom-1' }));
      expect(getResult.data).toBeNull();
    });

    it('should return false for non-existent template', async () => {
      const result = await plugin.execute(createPluginInput('delete', { id: 'non-existent' }));
      expect(result.success).toBe(true);
      const data = result.data as { deleted: boolean };
      expect(data.deleted).toBe(false);
    });
  });

  // ==================== version actions ====================

  describe('version actions', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
      await plugin.execute(
        createPluginInput('register', {
          template: createTestTemplate({
            id: 'tpl-1',
            content: 'Version 1 content',
          }),
        })
      );
    });

    it('should get version history', async () => {
      // Update to create new versions
      await plugin.execute(
        createPluginInput('update', {
          id: 'tpl-1',
          updates: { content: 'Version 2 content' },
          message: 'v2',
        })
      );
      await plugin.execute(
        createPluginInput('update', {
          id: 'tpl-1',
          updates: { content: 'Version 3 content' },
          message: 'v3',
        })
      );

      const result = await plugin.execute(createPluginInput('history', { templateId: 'tpl-1' }));
      expect(result.success).toBe(true);
      const history = result.data as TemplateVersion[];
      expect(history.length).toBeGreaterThanOrEqual(3);
    });

    it('should diff two versions', async () => {
      await plugin.execute(
        createPluginInput('update', {
          id: 'tpl-1',
          updates: { content: 'Modified content' },
          message: 'modified',
        })
      );

      const result = await plugin.execute(
        createPluginInput('diff', {
          templateId: 'tpl-1',
          v1: '1.0.0',
          v2: '1.0.1',
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as { diff: string };
      expect(data.diff).toContain('---');
      expect(data.diff).toContain('+++');
    });

    it('should rollback to a previous version', async () => {
      await plugin.execute(
        createPluginInput('update', {
          id: 'tpl-1',
          updates: { content: 'Modified content' },
          message: 'modified',
        })
      );

      const result = await plugin.execute(
        createPluginInput('rollback', {
          templateId: 'tpl-1',
          targetVersion: '1.0.0',
        })
      );

      expect(result.success).toBe(true);
      const version = result.data as TemplateVersion;
      expect(version.content).toBe('Version 1 content');
      expect(version.message).toContain('Rollback');
    });

    it('should throw rollback for non-existent version', async () => {
      const result = await plugin.execute(
        createPluginInput('rollback', {
          templateId: 'tpl-1',
          targetVersion: '9.9.9',
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ==================== import/export actions ====================

  describe('import/export actions', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
    });

    it('should import templates', async () => {
      const templates = [
        createTestTemplate({ id: 'import-1', name: 'Import 1' }),
        createTestTemplate({ id: 'import-2', name: 'Import 2' }),
      ];

      const result = await plugin.execute(createPluginInput('import', { templates }));
      expect(result.success).toBe(true);
      const importResult = result.data as { success: boolean; imported: number };
      expect(importResult.imported).toBe(2);
    });

    it('should export all templates', async () => {
      const result = await plugin.execute(createPluginInput('export', {}));
      expect(result.success).toBe(true);
      const templates = result.data as PromptTemplate[];
      expect(templates.length).toBeGreaterThanOrEqual(6);
    });

    it('should export specific templates', async () => {
      const result = await plugin.execute(
        createPluginInput('export', {
          ids: ['builtin-code-review', 'builtin-bug-fix'],
        })
      );
      expect(result.success).toBe(true);
      const templates = result.data as PromptTemplate[];
      expect(templates).toHaveLength(2);
    });
  });

  // ==================== validate action ====================

  describe('validate action', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
    });

    it('should validate a correct template', async () => {
      const result = await plugin.execute(
        createPluginInput('validate', {
          template: 'Hello {{name}}!',
          variables: [{ name: 'name', type: 'string', required: true }],
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as { valid: boolean };
      expect(data.valid).toBe(true);
    });

    it('should detect invalid template', async () => {
      const result = await plugin.execute(
        createPluginInput('validate', {
          template: 'Hello {{name',
          variables: [],
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as { valid: boolean };
      expect(data.valid).toBe(false);
    });
  });

  // ==================== extractVariables action ====================

  describe('extractVariables action', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
    });

    it('should extract variables from template', async () => {
      const result = await plugin.execute(
        createPluginInput('extractVariables', {
          template: 'Hello {{name}}, your role is {{role}}',
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as { variables: string[] };
      expect(data.variables).toContain('name');
      expect(data.variables).toContain('role');
    });
  });

  // ==================== getCategories/getTags actions ====================

  describe('getCategories/getTags actions', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
    });

    it('should return categories', async () => {
      const result = await plugin.execute(createPluginInput('getCategories'));
      expect(result.success).toBe(true);
      const data = result.data as { categories: string[] };
      expect(data.categories).toContain('code');
      expect(data.categories).toContain('documentation');
    });

    it('should return tags', async () => {
      const result = await plugin.execute(createPluginInput('getTags'));
      expect(result.success).toBe(true);
      const data = result.data as { tags: string[] };
      expect(data.tags).toContain('builtin');
    });
  });

  // ==================== unknown action ====================

  describe('unknown action', () => {
    beforeEach(async () => {
      await plugin.initialize(createMockContext());
    });

    it('should return error for unknown action', async () => {
      const result = await plugin.execute(createPluginInput('unknown_action'));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });
  });

  // ==================== shutdown ====================

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await plugin.initialize(createMockContext());
      await expect(plugin.shutdown()).resolves.not.toThrow();
      expect(plugin.isInitialized()).toBe(false);
    });

    it('should cleanup engine instances', async () => {
      await plugin.initialize(createMockContext());
      await plugin.shutdown();

      expect(plugin.getTemplateEngine()).toBeNull();
      expect(plugin.getVersionManager()).toBeNull();
      expect(plugin.getPromptRegistry()).toBeNull();
    });

    it('should be safe to call multiple times', async () => {
      await plugin.initialize(createMockContext());
      await plugin.shutdown();
      await expect(plugin.shutdown()).resolves.not.toThrow();
    });
  });

  // ==================== Integration Scenarios ====================

  describe('integration scenarios', () => {
    it('should handle full template lifecycle', async () => {
      await plugin.initialize(createMockContext());

      // 1. Register a template
      const regResult = await plugin.execute(
        createPluginInput('register', {
          template: createTestTemplate({ id: 'lifecycle-test', content: 'Hello {{name}}!' }),
        })
      );
      expect(regResult.success).toBe(true);

      // 2. Get the template
      const getResult = await plugin.execute(createPluginInput('get', { id: 'lifecycle-test' }));
      expect(getResult.success).toBe(true);

      // 3. Compile the template
      const compileResult = await plugin.execute(
        createPluginInput('compile', {
          templateId: 'lifecycle-test',
          variables: { name: 'World' },
        })
      );
      expect(compileResult.success).toBe(true);
      expect((compileResult.data as { compiled: string }).compiled).toBe('Hello World!');

      // 4. Update the template
      const updateResult = await plugin.execute(
        createPluginInput('update', {
          id: 'lifecycle-test',
          updates: { content: 'Goodbye {{name}}!' },
          message: 'Changed greeting',
        })
      );
      expect(updateResult.success).toBe(true);

      // 5. Check history
      const historyResult = await plugin.execute(
        createPluginInput('history', { templateId: 'lifecycle-test' })
      );
      expect(historyResult.success).toBe(true);
      const history = historyResult.data as TemplateVersion[];
      expect(history.length).toBeGreaterThanOrEqual(2);

      // 6. Rollback
      const rollbackResult = await plugin.execute(
        createPluginInput('rollback', {
          templateId: 'lifecycle-test',
          targetVersion: '1.0.0',
        })
      );
      expect(rollbackResult.success).toBe(true);

      // 7. Export
      const exportResult = await plugin.execute(
        createPluginInput('export', { ids: ['lifecycle-test'] })
      );
      expect(exportResult.success).toBe(true);
      const exported = exportResult.data as PromptTemplate[];
      expect(exported).toHaveLength(1);

      // 8. Delete
      const deleteResult = await plugin.execute(
        createPluginInput('delete', { id: 'lifecycle-test' })
      );
      expect(deleteResult.success).toBe(true);
      expect((deleteResult.data as { deleted: boolean }).deleted).toBe(true);
    });

    it('should handle built-in template compilation', async () => {
      await plugin.initialize(createMockContext());

      const result = await plugin.execute(
        createPluginInput('compile', {
          templateId: 'builtin-code-review',
          variables: {
            language: 'typescript',
            code: 'function add(a: number, b: number) { return a + b; }',
            focus: ['security', 'performance'],
          },
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as { compiled: string };
      expect(data.compiled).toContain('typescript');
      expect(data.compiled).toContain('function add');
      expect(data.compiled).toContain('security');
      expect(data.compiled).toContain('performance');
    });
  });
});
