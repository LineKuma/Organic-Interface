/**
 * Model Config Store Tests
 *
 * Comprehensive tests for the ModelConfigStore covering:
 * - Provider CRUD operations
 * - API key management with rotation
 * - Model CRUD operations
 * - Preset management
 * - Global settings
 * - Validation and integrity checks
 * - Serialization/deserialization
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { ModelConfigStore } from '../services/ModelConfigStore.js';
import { ModelConfigService } from '../services/ModelConfigService.js';
import type {
  ProviderConfig,
  ApiKeyConfig,
  ModelConfig,
  PresetDefinition,
} from '../types/index.js';
import { MODEL_DEFINITIONS } from '../types/model.js';

// ── Helpers ──────────────────────────────────────────────────────

function createKey(overrides: Partial<ApiKeyConfig> = {}): ApiKeyConfig {
  return {
    id: `test-key-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    label: 'test-key',
    priority: 10,
    enabled: true,
    usageCount: 0,
    keyRef: 'env:TEST_API_KEY',
    ...overrides,
  };
}

function createProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  const now = Date.now();
  return {
    provider: 'openai',
    label: 'test-openai',
    keys: [createKey()],
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  const now = Date.now();
  return {
    id: `test-model-${Date.now()}`,
    modelId: 'gpt-4o',
    label: 'Test GPT-4o',
    provider: 'openai',
    enabled: true,
    parameters: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createPreset(overrides: Partial<PresetDefinition> = {}): PresetDefinition {
  return {
    id: `test-preset-${Date.now()}`,
    name: 'Test Preset',
    category: 'custom',
    description: 'Test preset for unit tests',
    parameters: { temperature: 0.5, topP: 0.9 },
    builtIn: false,
    ...overrides,
  };
}

// ── ModelConfigStore ─────────────────────────────────────────────

describe('ModelConfigStore', () => {
  let store: ModelConfigStore;

  beforeEach(() => {
    store = new ModelConfigStore();
  });

  // ── Initial State ──────────────────────────────────────

  describe('initial state', () => {
    it('should have empty providers', () => {
      expect(store.getProviders()).toEqual([]);
    });

    it('should have empty models', () => {
      expect(store.getModels()).toEqual([]);
    });

    it('should have built-in presets', () => {
      const presets = store.getPresets();
      expect(presets.length).toBeGreaterThanOrEqual(7);
      expect(presets.every(p => p.builtIn)).toBe(true);
    });

    it('should have default settings', () => {
      const settings = store.getSettings();
      expect(settings.maxRetries).toBe(3);
      expect(settings.requestTimeout).toBe(60000);
      expect(settings.autoKeyRotation).toBe(true);
      expect(settings.autoModelFallback).toBe(false);
      expect(settings.logLevel).toBe('info');
    });

    it('should be valid initially', () => {
      expect(store.isValid()).toBe(true);
    });
  });

  // ── Provider Operations ────────────────────────────────

  describe('providers', () => {
    it('should add a provider', () => {
      const result = store.addProvider(createProvider() as ProviderConfig);
      expect(result.success).toBe(true);
      expect(result.data?.provider).toBe('openai');
      expect(store.getProviders()).toHaveLength(1);
    });

    it('should reject duplicate provider', () => {
      const provider = createProvider();
      store.addProvider(provider);
      const result = store.addProvider(provider);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should reject unknown provider ID', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = store.addProvider(createProvider({ provider: 'unknown' as any }));
      expect(result.success).toBe(false);
    });

    it('should get provider by ID', () => {
      store.addProvider(createProvider({ provider: 'openai', label: 'my-openai' }));
      const p = store.getProvider('openai');
      expect(p).toBeDefined();
      expect(p?.label).toBe('my-openai');
    });

    it('should get enabled providers only', () => {
      store.addProvider(createProvider({ provider: 'openai', enabled: true }));
      store.addProvider(createProvider({ provider: 'anthropic', enabled: false }));
      expect(store.getEnabledProviders()).toHaveLength(1);
    });

    it('should update a provider', () => {
      store.addProvider(createProvider({ provider: 'openai', label: 'my-openai' }));
      const result = store.updateProvider('openai', 'my-openai', { label: 'updated' });
      expect(result.success).toBe(true);
      expect(store.getProvider('openai')?.label).toBe('updated');
    });

    it('should reject update on non-existent provider', () => {
      const result = store.updateProvider('openai', 'nonexistent', { label: 'x' });
      expect(result.success).toBe(false);
    });

    it('should remove a provider', () => {
      store.addProvider(createProvider({ provider: 'openai' }));
      const result = store.removeProvider('openai', 'test-openai');
      expect(result.success).toBe(true);
      expect(store.getProviders()).toHaveLength(0);
    });

    it('should reject removing provider with dependent models', () => {
      store.addProvider(createProvider({ provider: 'openai' }));
      store.addModel(createModel({ provider: 'openai' }));
      const result = store.removeProvider('openai', 'test-openai');
      expect(result.success).toBe(false);
      expect(result.error).toContain('depend');
    });
  });

  // ── API Key Operations ─────────────────────────────────

  describe('api keys', () => {
    beforeEach(() => {
      store.addProvider(createProvider({ provider: 'openai', keys: [] }));
    });

    it('should add a key', () => {
      const key = createKey();
      const result = store.addKey('openai', key);
      expect(result.success).toBe(true);
      expect(store.getKeys('openai')).toHaveLength(1);
    });

    it('should reject duplicate key ID', () => {
      const key = createKey();
      store.addKey('openai', key);
      const result = store.addKey('openai', key);
      expect(result.success).toBe(false);
    });

    it('should update a key', () => {
      const key = createKey();
      store.addKey('openai', key);
      const result = store.updateKey('openai', key.id, { label: 'updated-key' });
      expect(result.success).toBe(true);
      expect(store.getKeys('openai')[0].label).toBe('updated-key');
    });

    it('should remove a key', () => {
      const key = createKey();
      store.addKey('openai', key);
      const result = store.removeKey('openai', key.id);
      expect(result.success).toBe(true);
      expect(store.getKeys('openai')).toHaveLength(0);
    });

    it('should record key usage', () => {
      const key = createKey();
      store.addKey('openai', key);
      const result = store.recordKeyUsage('openai', key.id);
      expect(result.success).toBe(true);
      const keys = store.getKeys('openai');
      expect(keys[0].usageCount).toBe(1);
      expect(keys[0].lastUsedAt).toBeDefined();
    });

    it('should get next available key by priority', () => {
      const key1 = createKey({ id: 'key-1', priority: 20, enabled: true });
      const key2 = createKey({ id: 'key-2', priority: 10, enabled: true });
      store.addKey('openai', key1);
      store.addKey('openai', key2);

      const result = store.getNextAvailableKey('openai');
      expect(result.success).toBe(true);
      expect(result.data?.priority).toBe(10); // lower priority = higher preference
    });

    it('should skip disabled keys when getting next available', () => {
      const key1 = createKey({ id: 'key-1', priority: 10, enabled: false });
      const key2 = createKey({ id: 'key-2', priority: 20, enabled: true });
      store.addKey('openai', key1);
      store.addKey('openai', key2);

      const result = store.getNextAvailableKey('openai');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('key-2');
    });

    it('should skip expired keys', () => {
      const key1 = createKey({
        id: 'key-1',
        priority: 10,
        enabled: true,
        expiresAt: Date.now() - 1000,
      });
      const key2 = createKey({ id: 'key-2', priority: 20, enabled: true });
      store.addKey('openai', key1);
      store.addKey('openai', key2);

      const result = store.getNextAvailableKey('openai');
      expect(result.data?.id).toBe('key-2');
    });

    it('should return error when no keys available', () => {
      const result = store.getNextAvailableKey('openai');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No available keys');
    });
  });

  // ── Model Operations ───────────────────────────────────

  describe('models', () => {
    beforeEach(() => {
      store.addProvider(createProvider({ provider: 'openai' }));
    });

    it('should add a model', () => {
      const result = store.addModel(createModel());
      expect(result.success).toBe(true);
      expect(store.getModels()).toHaveLength(1);
    });

    it('should reject model without provider', () => {
      const result = store.addModel(createModel({ provider: 'anthropic' }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should reject duplicate model ID', () => {
      const model = createModel();
      store.addModel(model);
      const result = store.addModel(model);
      expect(result.success).toBe(false);
    });

    it('should get models by provider', () => {
      store.addModel(createModel({ provider: 'openai', modelId: 'gpt-4o', id: 'model-1' }));
      store.addModel(createModel({ provider: 'openai', modelId: 'gpt-4o-mini', id: 'model-2' }));
      expect(store.getModelsByProvider('openai')).toHaveLength(2);
    });

    it('should update a model', () => {
      const model = createModel();
      store.addModel(model);
      const result = store.updateModel(model.id, { label: 'updated' });
      expect(result.success).toBe(true);
      expect(store.getModel(model.id)?.label).toBe('updated');
    });

    it('should remove a model', () => {
      const model = createModel();
      store.addModel(model);
      const result = store.removeModel(model.id);
      expect(result.success).toBe(true);
      expect(store.getModels()).toHaveLength(0);
    });
  });

  // ── Preset Operations ──────────────────────────────────

  describe('presets', () => {
    it('should add a user-defined preset', () => {
      const preset = createPreset();
      const result = store.addPreset(preset);
      expect(result.success).toBe(true);
      const presets = store.getPresets();
      const custom = presets.filter(p => !p.builtIn);
      expect(custom).toHaveLength(1);
    });

    it('should reject duplicate preset ID', () => {
      const preset = createPreset();
      store.addPreset(preset);
      const result = store.addPreset(preset);
      expect(result.success).toBe(false);
    });

    it('should not allow modifying built-in presets', () => {
      const result = store.updatePreset('creative', { name: 'Modified' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot modify built-in');
    });

    it('should update a user-defined preset', () => {
      const preset = createPreset();
      store.addPreset(preset);
      const result = store.updatePreset(preset.id, { name: 'Updated' });
      expect(result.success).toBe(true);
      expect(store.getPreset(preset.id)?.name).toBe('Updated');
    });

    it('should not allow removing built-in presets', () => {
      const result = store.removePreset('creative');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot remove built-in');
    });

    it('should remove a user-defined preset', () => {
      const preset = createPreset();
      store.addPreset(preset);
      const result = store.removePreset(preset.id);
      expect(result.success).toBe(true);
    });
  });

  // ── Settings ───────────────────────────────────────────

  describe('settings', () => {
    it('should update settings', () => {
      const result = store.updateSettings({ maxRetries: 5 });
      expect(result.success).toBe(true);
      expect(store.getSettings().maxRetries).toBe(5);
    });

    it('should validate settings', () => {
      const result = store.updateSettings({ maxRetries: -1 });
      expect(result.success).toBe(false);
    });

    it('should merge partial settings', () => {
      store.updateSettings({ maxRetries: 5 });
      const settings = store.getSettings();
      expect(settings.maxRetries).toBe(5);
      expect(settings.requestTimeout).toBe(60000); // unchanged
    });
  });

  // ── Integrity ──────────────────────────────────────────

  describe('integrity', () => {
    it('should pass integrity check on empty store', () => {
      const report = store.checkIntegrity();
      expect(report.valid).toBe(true);
    });

    it('should reject model without provider being configured', () => {
      const result = store.addModel(createModel({ provider: 'openai' }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should detect default provider not configured', () => {
      store.updateSettings({ defaultProvider: 'openai' });
      const report = store.checkIntegrity();
      expect(report.valid).toBe(false);
      expect(report.errors.some(e => e.message.includes('Default provider'))).toBe(true);
    });
  });

  // ── Serialization ──────────────────────────────────────

  describe('serialization', () => {
    it('should serialize and deserialize', () => {
      store.addProvider(createProvider({ provider: 'openai' }));
      store.addModel(createModel({ provider: 'openai' }));

      const json = store.serialize();
      const parsed = JSON.parse(json);
      expect(parsed.providers).toHaveLength(1);
      expect(parsed.models).toHaveLength(1);

      const newStore = new ModelConfigStore();
      const result = newStore.deserialize(json);
      expect(result.success).toBe(true);
      expect(newStore.getProviders()).toHaveLength(1);
      expect(newStore.getModels()).toHaveLength(1);
    });

    it('should restore built-in presets on deserialize', () => {
      const json = JSON.stringify({
        version: 1,
        settings: {},
        providers: [],
        models: [],
        presets: [],
        updatedAt: 0,
      });
      const result = store.deserialize(json);
      expect(result.success).toBe(true);
      expect(store.getPresets().length).toBeGreaterThanOrEqual(7);
    });

    it('should handle invalid JSON', () => {
      const result = store.deserialize('not valid json');
      expect(result.success).toBe(false);
    });

    it('should reset store', () => {
      store.addProvider(createProvider());
      store.addModel(createModel());
      store.reset();
      expect(store.getProviders()).toHaveLength(0);
      expect(store.getModels()).toHaveLength(0);
    });
  });

  // ── Lookups ────────────────────────────────────────────

  describe('lookups', () => {
    it('should get provider definition', () => {
      const def = store.getProviderDefinition('openai');
      expect(def).toBeDefined();
      expect(def?.name).toBe('OpenAI');
    });

    it('should get model definition', () => {
      const def = store.getModelDefinition('gpt-4o');
      expect(def).toBeDefined();
      expect(def?.name).toBe('GPT-4o');
    });

    it('should get models for provider', () => {
      const models = store.getModelsForProvider('openai');
      expect(models.length).toBeGreaterThan(0);
      expect(models.every(m => m.provider === 'openai')).toBe(true);
    });
  });
});

// ── ModelConfigService ───────────────────────────────────────────

describe('ModelConfigService', () => {
  let store: ModelConfigStore;
  let service: ModelConfigService;

  beforeEach(() => {
    store = new ModelConfigStore();
    service = new ModelConfigService(store);
  });

  describe('quick setup', () => {
    it('should quick setup a provider', () => {
      const result = service.quickSetupProvider('openai', 'my-key', 'env:OPENAI_KEY');
      expect(result.success).toBe(true);
      expect(store.getProviders()).toHaveLength(1);
      expect(store.getKeys('openai')).toHaveLength(1);
    });

    it('should quick setup a model', () => {
      service.quickSetupProvider('openai', 'my-key', 'env:OPENAI_KEY');
      const result = service.quickSetupModel('gpt-4o');
      expect(result.success).toBe(true);
      expect(store.getModels()).toHaveLength(1);
    });

    it('should reject model without provider', () => {
      const result = service.quickSetupModel('gpt-4o');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should setup provider with all models', () => {
      const result = service.setupProviderWithModels('openai', 'my-key', 'env:OPENAI_KEY');
      expect(result.provider.success).toBe(true);
      const openaiModels = MODEL_DEFINITIONS.filter(m => m.provider === 'openai');
      expect(result.models).toHaveLength(openaiModels.length);
    });
  });

  describe('bulk operations', () => {
    beforeEach(() => {
      service.quickSetupProvider('openai', 'my-key', 'env:OPENAI_KEY');
    });

    it('should bulk add keys', () => {
      const results = service.bulkAddKeys('openai', [
        { label: 'key-1', keyRef: 'env:KEY_1' },
        { label: 'key-2', keyRef: 'env:KEY_2' },
      ]);
      expect(results.every(r => r.success)).toBe(true);
      expect(store.getKeys('openai')).toHaveLength(3); // 1 original + 2 new
    });

    it('should set models enabled/disabled', () => {
      service.quickSetupModel('gpt-4o');
      const result = service.setModelsEnabled('openai', false);
      expect(result.success).toBe(true);
      const models = store.getModelsByProvider('openai');
      expect(models.every(m => !m.enabled)).toBe(true);
    });

    it('should reset key usage', () => {
      service.quickSetupModel('gpt-4o');
      const key = store.getKeys('openai')[0];
      store.recordKeyUsage('openai', key.id);
      const result = service.resetKeyUsage('openai');
      expect(result.success).toBe(true);
      expect(store.getKeys('openai')[0].usageCount).toBe(0);
    });
  });

  describe('preset operations', () => {
    it('should create preset from model', () => {
      service.quickSetupProvider('openai', 'my-key', 'env:OPENAI_KEY');
      const modelResult = service.quickSetupModel('gpt-4o', { parameters: { temperature: 0.5 } });
      const result = service.createPresetFromModel(
        modelResult.data!.id,
        'My Preset',
        'Description'
      );
      expect(result.success).toBe(true);
      const preset = store.getPreset(result.data!.id);
      expect(preset?.parameters.temperature).toBe(0.5);
    });

    it('should clone preset', () => {
      const result = service.clonePreset('creative', 'creative-clone', 'Cloned Creative');
      expect(result.success).toBe(true);
      const cloned = store.getPreset('creative-clone');
      expect(cloned).toBeDefined();
      expect(cloned?.parameters.temperature).toBe(0.9);
    });
  });

  describe('health summary', () => {
    it('should report empty state', () => {
      const summary = service.getHealthSummary();
      expect(summary.healthy).toBe(true);
      expect(summary.providers.total).toBe(0);
      expect(summary.models.total).toBe(0);
    });

    it('should report populated state', () => {
      service.setupProviderWithModels('openai', 'my-key', 'env:OPENAI_KEY');
      const summary = service.getHealthSummary();
      expect(summary.providers.total).toBe(1);
      expect(summary.models.total).toBeGreaterThan(0);
    });
  });

  describe('validate all', () => {
    it('should report models without provider', () => {
      const validation = service.validateAll();
      expect(validation.modelsWithoutProvider).toHaveLength(0);
    });

    it('should report providers without keys', () => {
      store.addProvider({
        provider: 'openai',
        label: 'openai',
        keys: [],
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const validation = service.validateAll();
      expect(validation.providersWithoutKeys).toHaveLength(1);
    });
  });
});
