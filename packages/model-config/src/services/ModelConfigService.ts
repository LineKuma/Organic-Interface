/**
 * Model Config Service - Business logic layer
 *
 * Provides higher-level operations on top of ModelConfigStore,
 * including setup wizards, bulk operations, and migration.
 */

import type { Logger } from '@organic/utils';
import { createLogger } from '@organic/utils';

import type {
  ProviderConfig,
  ProviderId,
  ModelConfig,
  PresetDefinition,
  ApiKeyConfig,
  ModelParameters,
} from '../types/index.js';
import { PROVIDER_DEFINITIONS } from '../types/provider.js';
import { MODEL_DEFINITIONS } from '../types/model.js';

import type { ModelConfigStore, StoreResult } from './ModelConfigStore.js';

/** Result of a setup wizard operation */
export interface SetupResult {
  success: boolean;
  provider?: ProviderConfig;
  model?: ModelConfig;
  error?: string;
}

/**
 * Model Config Service
 *
 * Business logic layer that wraps ModelConfigStore.
 * Provides convenience methods for common operations,
 * wizard-based setup, and bulk configuration.
 */
export class ModelConfigService {
  private store: ModelConfigStore;
  private logger: Logger;

  constructor(store: ModelConfigStore, logger?: Logger) {
    this.store = store;
    this.logger = logger ?? createLogger({ prefix: 'ModelConfigService' });
  }

  /** Get the underlying store */
  getStore(): ModelConfigStore {
    return this.store;
  }

  // ── Quick Setup ────────────────────────────────────────────────

  /**
   * Quick setup: add a provider with a single API key.
   * Creates a minimal provider config with sensible defaults.
   */
  quickSetupProvider(
    providerId: ProviderId,
    keyLabel: string,
    keyRef: string,
    options?: {
      label?: string;
      baseUrl?: string;
      priority?: number;
    }
  ): StoreResult<ProviderConfig> {
    const def = PROVIDER_DEFINITIONS[providerId];
    if (!def) {
      return { success: false, error: `Unknown provider: ${providerId}` };
    }

    const now = Date.now();
    const key: ApiKeyConfig = {
      id: `${providerId}-key-${now}`,
      label: keyLabel,
      priority: options?.priority ?? 10,
      enabled: true,
      usageCount: 0,
      keyRef,
    };

    const config: ProviderConfig = {
      provider: providerId,
      label: options?.label ?? def.name,
      baseUrlOverride: options?.baseUrl,
      keys: [key],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    return this.store.addProvider(config);
  }

  /**
   * Quick setup: add a model for a provider.
   * Creates a minimal model config with default parameters.
   */
  quickSetupModel(
    modelId: string,
    options?: {
      label?: string;
      defaultPreset?: string;
      parameters?: ModelParameters;
    }
  ): StoreResult<ModelConfig> {
    const modelDef = MODEL_DEFINITIONS.find(m => m.id === modelId);
    if (!modelDef) {
      return { success: false, error: `Unknown model: ${modelId}` };
    }

    // Check provider is configured
    const provider = this.store.getProvider(modelDef.provider);
    if (!provider) {
      return {
        success: false,
        error: `Provider "${modelDef.provider}" is not configured. Run quickSetupProvider first.`,
      };
    }

    const now = Date.now();
    const config: ModelConfig = {
      id: `model-${modelId}-${now}`,
      modelId,
      label: options?.label ?? modelDef.name,
      provider: modelDef.provider,
      enabled: true,
      parameters: { ...options?.parameters },
      defaultPreset: options?.defaultPreset,
      createdAt: now,
      updatedAt: now,
    };

    return this.store.addModel(config);
  }

  /**
   * Full setup: add provider and all its models at once.
   * Returns the provider and all added models.
   */
  setupProviderWithModels(
    providerId: ProviderId,
    keyLabel: string,
    keyRef: string,
    options?: {
      providerLabel?: string;
      baseUrl?: string;
      presetId?: string;
    }
  ): { provider: StoreResult<ProviderConfig>; models: StoreResult<ModelConfig>[] } {
    const providerResult = this.quickSetupProvider(providerId, keyLabel, keyRef, {
      label: options?.providerLabel,
      baseUrl: options?.baseUrl,
    });

    if (!providerResult.success) {
      return { provider: providerResult, models: [] };
    }

    const providerModels = MODEL_DEFINITIONS.filter(m => m.provider === providerId);
    const modelResults: StoreResult<ModelConfig>[] = [];

    for (const modelDef of providerModels) {
      const result = this.quickSetupModel(modelDef.id, {
        defaultPreset: options?.presetId,
      });
      modelResults.push(result);
    }

    this.logger.info(
      `Setup complete for ${providerId}: ${modelResults.filter(r => r.success).length}/${modelResults.length} models`
    );

    return { provider: providerResult, models: modelResults };
  }

  // ── Bulk Operations ────────────────────────────────────────────

  /** Add multiple API keys to a provider */
  bulkAddKeys(
    providerId: ProviderId,
    keys: Array<{ label: string; keyRef: string; priority?: number }>
  ): StoreResult<ApiKeyConfig>[] {
    const provider = this.store.getProvider(providerId);
    if (!provider) {
      return [{ success: false, error: `Provider "${providerId}" not found` }];
    }

    const results: StoreResult<ApiKeyConfig>[] = [];
    const now = Date.now();

    for (let i = 0; i < keys.length; i++) {
      const keyConfig: ApiKeyConfig = {
        id: `${providerId}-key-${now}-${i}`,
        label: keys[i].label,
        priority: keys[i].priority ?? 10 + i,
        enabled: true,
        usageCount: 0,
        keyRef: keys[i].keyRef,
      };
      results.push(this.store.addKey(providerId, keyConfig));
    }

    return results;
  }

  /** Enable or disable all models for a provider */
  setModelsEnabled(providerId: ProviderId, enabled: boolean): StoreResult<void> {
    const models = this.store.getModelsByProvider(providerId);
    if (models.length === 0) {
      return { success: false, error: `No models for provider "${providerId}"` };
    }

    for (const model of models) {
      this.store.updateModel(model.id, { enabled });
    }

    this.logger.info(
      `${enabled ? 'Enabled' : 'Disabled'} ${models.length} models for ${providerId}`
    );
    return { success: true };
  }

  /** Reset all key usage counters for a provider */
  resetKeyUsage(providerId: ProviderId): StoreResult<void> {
    const provider = this.store.getProvider(providerId);
    if (!provider) {
      return { success: false, error: `Provider "${providerId}" not found` };
    }

    for (const key of provider.keys) {
      this.store.updateKey(providerId, key.id, { usageCount: 0 });
    }

    this.logger.info(`Reset usage counters for ${provider.keys.length} keys in ${providerId}`);
    return { success: true };
  }

  // ── Preset Operations ──────────────────────────────────────────

  /** Create a preset from an existing model's parameters */
  createPresetFromModel(
    modelId: string,
    presetName: string,
    presetDescription: string
  ): StoreResult<PresetDefinition> {
    const model = this.store.getModel(modelId);
    if (!model) {
      return { success: false, error: `Model "${modelId}" not found` };
    }

    const preset: PresetDefinition = {
      id: `preset-${modelId}-${Date.now()}`,
      name: presetName,
      category: 'custom',
      description: presetDescription,
      parameters: { ...model.parameters },
      builtIn: false,
    };

    return this.store.addPreset(preset);
  }

  /** Clone a preset with a new name */
  clonePreset(sourceId: string, newId: string, newName: string): StoreResult<PresetDefinition> {
    const source = this.store.getPreset(sourceId);
    if (!source) {
      return { success: false, error: `Preset "${sourceId}" not found` };
    }

    const cloned: PresetDefinition = {
      ...source,
      id: newId,
      name: newName,
      builtIn: false,
      createdAt: undefined,
      updatedAt: undefined,
    };

    return this.store.addPreset(cloned);
  }

  // ── Health & Status ────────────────────────────────────────────

  /** Get overall config health summary */
  getHealthSummary() {
    const integrity = this.store.checkIntegrity();
    const providers = this.store.getProviders();
    const models = this.store.getModels();
    const presets = this.store.getPresets();

    const enabledProviders = providers.filter(p => p.enabled);
    const enabledModels = models.filter(m => m.enabled);
    const totalKeys = providers.reduce((sum, p) => sum + p.keys.length, 0);
    const activeKeys = providers.reduce((sum, p) => sum + p.keys.filter(k => k.enabled).length, 0);

    return {
      healthy: integrity.valid,
      providers: {
        total: providers.length,
        enabled: enabledProviders.length,
        disabled: providers.length - enabledProviders.length,
      },
      models: {
        total: models.length,
        enabled: enabledModels.length,
        disabled: models.length - enabledModels.length,
      },
      keys: {
        total: totalKeys,
        active: activeKeys,
        inactive: totalKeys - activeKeys,
      },
      presets: {
        total: presets.length,
        builtIn: presets.filter(p => p.builtIn).length,
        userDefined: presets.filter(p => !p.builtIn).length,
      },
      integrityErrors: integrity.errors,
    };
  }

  /** Validate all configured data */
  validateAll() {
    const integrity = this.store.checkIntegrity();
    const providers = this.store.getProviders();
    const models = this.store.getModels();

    return {
      integrity,
      modelsWithoutProvider: models.filter(m => !providers.some(p => p.provider === m.provider)),
      providersWithoutKeys: providers.filter(p => p.keys.length === 0),
      providersWithoutModels: providers.filter(p => !models.some(m => m.provider === p.provider)),
    };
  }
}
