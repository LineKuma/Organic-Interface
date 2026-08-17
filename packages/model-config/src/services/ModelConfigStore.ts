/**
 * Model Config Store - In-memory storage for model configuration
 *
 * Provides a self-contained storage layer for model config data
 * with CRUD operations, querying, and serialization support.
 * Follows the pattern of the StorageService but is specialized
 * for model configuration data.
 */

import type { Logger } from '@organic/utils';
import { createLogger } from '@organic/utils';

import type {
  ModelConfigData,
  ProviderConfig,
  ModelConfig,
  PresetDefinition,
  ApiKeyConfig,
  GlobalSettings,
  ProviderId,
} from '../types/index.js';
import {
  DEFAULT_MODEL_CONFIG_DATA,
  DEFAULT_GLOBAL_SETTINGS,
  CURRENT_SCHEMA_VERSION,
} from '../types/config.js';
import { PROVIDER_DEFINITIONS } from '../types/provider.js';
import { MODEL_DEFINITIONS } from '../types/model.js';
import { BUILTIN_PRESETS } from '../types/preset.js';

import type { ValidationReport } from '../validation/index.js';
import {
  validateProvider,
  validateModelConfig,
  validatePreset,
  validateGlobalSettings,
  validateApiKey,
  validateStoreIntegrity,
  type IntegrityReport,
} from '../validation/index.js';

/** Provider IDs from definitions */
const VALID_PROVIDER_IDS = Object.keys(PROVIDER_DEFINITIONS) as ProviderId[];

/** Operation result */
export interface StoreResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  validation?: ValidationReport;
  integrity?: IntegrityReport;
}

/**
 * Model Config Store
 *
 * In-memory store with full validation and integrity checking.
 * Supports load/save for persistence via external serialization.
 */
export class ModelConfigStore {
  private store: ModelConfigData;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.store = this.createDefaultStore();
    this.logger = logger ?? createLogger({ prefix: 'ModelConfigStore' });
  }

  /** Create a default store with built-in presets */
  private createDefaultStore(): ModelConfigData {
    return {
      version: DEFAULT_MODEL_CONFIG_DATA.version,
      settings: { ...DEFAULT_MODEL_CONFIG_DATA.settings },
      providers: [],
      models: [],
      presets: [...BUILTIN_PRESETS],
      updatedAt: Date.now(),
    };
  }

  // ── Store Access ───────────────────────────────────────────────

  /** Get the full store state (read-only copy) */
  getState(): ModelConfigData {
    return JSON.parse(JSON.stringify(this.store));
  }

  /** Get global settings */
  getSettings(): GlobalSettings {
    return { ...this.store.settings };
  }

  /** Update global settings */
  updateSettings(settings: Partial<GlobalSettings>): StoreResult<GlobalSettings> {
    const merged = { ...this.store.settings, ...settings };
    const validation = validateGlobalSettings(merged);

    if (!validation.valid) {
      return { success: false, error: 'Settings validation failed', validation };
    }

    this.store.settings = merged;
    this.touch();
    this.logger.info('Global settings updated');
    return { success: true, data: merged };
  }

  // ── Provider Operations ────────────────────────────────────────

  /** Get all providers */
  getProviders(): ProviderConfig[] {
    return [...this.store.providers];
  }

  /** Get a provider by provider ID */
  getProvider(provider: ProviderId): ProviderConfig | undefined {
    return this.store.providers.find(p => p.provider === provider);
  }

  /** Get all enabled providers */
  getEnabledProviders(): ProviderConfig[] {
    return this.store.providers.filter(p => p.enabled);
  }

  /** Add a new provider */
  addProvider(config: ProviderConfig): StoreResult<ProviderConfig> {
    const validation = validateProvider(config, VALID_PROVIDER_IDS);
    if (!validation.valid) {
      return { success: false, error: 'Provider validation failed', validation };
    }

    // Check for duplicate
    const existing = this.store.providers.find(
      p => p.provider === config.provider && p.label === config.label
    );
    if (existing) {
      return {
        success: false,
        error: `Provider "${config.provider}" with label "${config.label}" already exists`,
      };
    }

    const now = Date.now();
    const provider: ProviderConfig = {
      ...config,
      createdAt: config.createdAt || now,
      updatedAt: now,
    };

    this.store.providers.push(provider);
    this.touch();
    this.logger.info(`Provider added: ${provider.provider} (${provider.label})`);
    return { success: true, data: provider };
  }

  /** Update an existing provider */
  updateProvider(
    provider: ProviderId,
    label: string,
    updates: Partial<ProviderConfig>
  ): StoreResult<ProviderConfig> {
    const idx = this.store.providers.findIndex(p => p.provider === provider && p.label === label);
    if (idx === -1) {
      return { success: false, error: `Provider "${provider}:${label}" not found` };
    }

    const updated = { ...this.store.providers[idx], ...updates, updatedAt: Date.now() };
    const validation = validateProvider(updated, VALID_PROVIDER_IDS);
    if (!validation.valid) {
      return { success: false, error: 'Provider validation failed', validation };
    }

    this.store.providers[idx] = updated;
    this.touch();
    this.logger.info(`Provider updated: ${provider} (${label})`);
    return { success: true, data: updated };
  }

  /** Remove a provider */
  removeProvider(provider: ProviderId, label: string): StoreResult<void> {
    const idx = this.store.providers.findIndex(p => p.provider === provider && p.label === label);
    if (idx === -1) {
      return { success: false, error: `Provider "${provider}:${label}" not found` };
    }

    // Check if any models reference this provider
    const dependentModels = this.store.models.filter(m => m.provider === provider);
    if (dependentModels.length > 0) {
      return {
        success: false,
        error: `Cannot remove provider "${provider}:${label}" - ${dependentModels.length} model(s) depend on it`,
      };
    }

    this.store.providers.splice(idx, 1);
    this.touch();
    this.logger.info(`Provider removed: ${provider} (${label})`);
    return { success: true };
  }

  // ── API Key Operations ─────────────────────────────────────────

  /** Get all keys for a provider */
  getKeys(provider: ProviderId): ApiKeyConfig[] {
    const p = this.getProvider(provider);
    return p ? [...p.keys] : [];
  }

  /** Add an API key to a provider */
  addKey(provider: ProviderId, key: ApiKeyConfig): StoreResult<ApiKeyConfig> {
    const p = this.store.providers.find(p => p.provider === provider);
    if (!p) {
      return { success: false, error: `Provider "${provider}" not found` };
    }

    const validation = validateApiKey(key);
    if (!validation.valid) {
      return { success: false, error: 'API key validation failed', validation };
    }

    // Check for duplicate key ID
    if (p.keys.some(k => k.id === key.id)) {
      return {
        success: false,
        error: `Key with ID "${key.id}" already exists in provider "${provider}"`,
      };
    }

    p.keys.push(key);
    p.updatedAt = Date.now();
    this.touch();
    this.logger.info(`Key added to ${provider}: ${key.label}`);
    return { success: true, data: key };
  }

  /** Update an API key */
  updateKey(
    provider: ProviderId,
    keyId: string,
    updates: Partial<ApiKeyConfig>
  ): StoreResult<ApiKeyConfig> {
    const p = this.store.providers.find(p => p.provider === provider);
    if (!p) {
      return { success: false, error: `Provider "${provider}" not found` };
    }

    const keyIdx = p.keys.findIndex(k => k.id === keyId);
    if (keyIdx === -1) {
      return { success: false, error: `Key "${keyId}" not found in provider "${provider}"` };
    }

    const updated = { ...p.keys[keyIdx], ...updates };
    const validation = validateApiKey(updated);
    if (!validation.valid) {
      return { success: false, error: 'API key validation failed', validation };
    }

    p.keys[keyIdx] = updated;
    p.updatedAt = Date.now();
    this.touch();
    this.logger.info(`Key updated in ${provider}: ${keyId}`);
    return { success: true, data: updated };
  }

  /** Remove an API key */
  removeKey(provider: ProviderId, keyId: string): StoreResult<void> {
    const p = this.store.providers.find(p => p.provider === provider);
    if (!p) {
      return { success: false, error: `Provider "${provider}" not found` };
    }

    const keyIdx = p.keys.findIndex(k => k.id === keyId);
    if (keyIdx === -1) {
      return { success: false, error: `Key "${keyId}" not found in provider "${provider}"` };
    }

    p.keys.splice(keyIdx, 1);
    p.updatedAt = Date.now();
    this.touch();
    this.logger.info(`Key removed from ${provider}: ${keyId}`);
    return { success: true };
  }

  /** Record key usage */
  recordKeyUsage(provider: ProviderId, keyId: string): StoreResult<void> {
    const p = this.store.providers.find(p => p.provider === provider);
    if (!p) {
      return { success: false, error: `Provider "${provider}" not found` };
    }

    const key = p.keys.find(k => k.id === keyId);
    if (!key) {
      return { success: false, error: `Key "${keyId}" not found in provider "${provider}"` };
    }

    key.lastUsedAt = Date.now();
    key.usageCount++;
    this.touch();
    return { success: true };
  }

  /** Get the next available key (by priority, respecting rate limits) */
  getNextAvailableKey(provider: ProviderId): StoreResult<ApiKeyConfig> {
    const p = this.store.providers.find(p => p.provider === provider);
    if (!p) {
      return { success: false, error: `Provider "${provider}" not found` };
    }

    const now = Date.now();
    const enabledKeys = p.keys
      .filter(k => k.enabled)
      .filter(k => !k.expiresAt || k.expiresAt > now)
      .sort((a, b) => a.priority - b.priority);

    if (enabledKeys.length === 0) {
      return { success: false, error: `No available keys for provider "${provider}"` };
    }

    // Return the key with highest priority (lowest number) and least recent usage
    const key = enabledKeys.reduce((best, current) => {
      const bestLastUsed = best.lastUsedAt ?? 0;
      const currentLastUsed = current.lastUsedAt ?? 0;
      return currentLastUsed < bestLastUsed ? current : best;
    });

    return { success: true, data: key };
  }

  // ── Model Operations ───────────────────────────────────────────

  /** Get all models */
  getModels(): ModelConfig[] {
    return [...this.store.models];
  }

  /** Get models by provider */
  getModelsByProvider(provider: ProviderId): ModelConfig[] {
    return this.store.models.filter(m => m.provider === provider);
  }

  /** Get a model by ID */
  getModel(id: string): ModelConfig | undefined {
    return this.store.models.find(m => m.id === id);
  }

  /** Add a new model */
  addModel(config: ModelConfig): StoreResult<ModelConfig> {
    const validation = validateModelConfig(config);
    if (!validation.valid) {
      return { success: false, error: 'Model validation failed', validation };
    }

    // Check provider exists
    if (!this.store.providers.some(p => p.provider === config.provider)) {
      return {
        success: false,
        error: `Provider "${config.provider}" is not configured. Add it first.`,
      };
    }

    // Check for duplicate
    if (this.store.models.some(m => m.id === config.id)) {
      return { success: false, error: `Model with ID "${config.id}" already exists` };
    }

    const now = Date.now();
    const model: ModelConfig = {
      ...config,
      createdAt: config.createdAt || now,
      updatedAt: now,
    };

    this.store.models.push(model);
    this.touch();
    this.logger.info(`Model added: ${model.id}`);
    return { success: true, data: model };
  }

  /** Update an existing model */
  updateModel(id: string, updates: Partial<ModelConfig>): StoreResult<ModelConfig> {
    const idx = this.store.models.findIndex(m => m.id === id);
    if (idx === -1) {
      return { success: false, error: `Model "${id}" not found` };
    }

    const updated = { ...this.store.models[idx], ...updates, updatedAt: Date.now() };
    const validation = validateModelConfig(updated);
    if (!validation.valid) {
      return { success: false, error: 'Model validation failed', validation };
    }

    this.store.models[idx] = updated;
    this.touch();
    this.logger.info(`Model updated: ${id}`);
    return { success: true, data: updated };
  }

  /** Remove a model */
  removeModel(id: string): StoreResult<void> {
    const idx = this.store.models.findIndex(m => m.id === id);
    if (idx === -1) {
      return { success: false, error: `Model "${id}" not found` };
    }

    this.store.models.splice(idx, 1);
    this.touch();
    this.logger.info(`Model removed: ${id}`);
    return { success: true };
  }

  // ── Preset Operations ──────────────────────────────────────────

  /** Get all presets (built-in + user-defined) */
  getPresets(): PresetDefinition[] {
    return [...this.store.presets];
  }

  /** Get a preset by ID */
  getPreset(id: string): PresetDefinition | undefined {
    return this.store.presets.find(p => p.id === id);
  }

  /** Add a user-defined preset */
  addPreset(preset: PresetDefinition): StoreResult<PresetDefinition> {
    const validation = validatePreset(preset);
    if (!validation.valid) {
      return { success: false, error: 'Preset validation failed', validation };
    }

    // Check for duplicate
    if (this.store.presets.some(p => p.id === preset.id)) {
      return { success: false, error: `Preset "${preset.id}" already exists` };
    }

    const now = Date.now();
    const def: PresetDefinition = {
      ...preset,
      builtIn: false,
      createdAt: preset.createdAt || now,
      updatedAt: now,
    };

    this.store.presets.push(def);
    this.touch();
    this.logger.info(`Preset added: ${def.id}`);
    return { success: true, data: def };
  }

  /** Update a user-defined preset */
  updatePreset(id: string, updates: Partial<PresetDefinition>): StoreResult<PresetDefinition> {
    const idx = this.store.presets.findIndex(p => p.id === id);
    if (idx === -1) {
      return { success: false, error: `Preset "${id}" not found` };
    }

    const existing = this.store.presets[idx];
    if (existing.builtIn) {
      return { success: false, error: `Cannot modify built-in preset "${id}"` };
    }

    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    const validation = validatePreset(updated);
    if (!validation.valid) {
      return { success: false, error: 'Preset validation failed', validation };
    }

    this.store.presets[idx] = updated;
    this.touch();
    this.logger.info(`Preset updated: ${id}`);
    return { success: true, data: updated };
  }

  /** Remove a user-defined preset */
  removePreset(id: string): StoreResult<void> {
    const idx = this.store.presets.findIndex(p => p.id === id);
    if (idx === -1) {
      return { success: false, error: `Preset "${id}" not found` };
    }

    if (this.store.presets[idx].builtIn) {
      return { success: false, error: `Cannot remove built-in preset "${id}"` };
    }

    this.store.presets.splice(idx, 1);
    this.touch();
    this.logger.info(`Preset removed: ${id}`);
    return { success: true };
  }

  // ── Integrity & Validation ─────────────────────────────────────

  /** Run full integrity check on the store */
  checkIntegrity(): IntegrityReport {
    return validateStoreIntegrity(this.store);
  }

  /** Check if the store is in a valid state */
  isValid(): boolean {
    const integrity = this.checkIntegrity();
    return integrity.valid;
  }

  // ── Persistence ────────────────────────────────────────────────

  /** Serialize the store to JSON */
  serialize(): string {
    return JSON.stringify(this.store, null, 2);
  }

  /** Load the store from serialized JSON */
  deserialize(data: string): StoreResult<ModelConfigData> {
    try {
      const parsed = JSON.parse(data) as ModelConfigData;

      // Version check
      if (parsed.version !== CURRENT_SCHEMA_VERSION) {
        this.logger.warn(
          `Schema version mismatch: expected ${CURRENT_SCHEMA_VERSION}, got ${parsed.version}`
        );
      }

      // Ensure built-in presets are present
      const existingPresetIds = new Set(parsed.presets?.map(p => p.id) ?? []);

      for (const preset of BUILTIN_PRESETS) {
        if (!existingPresetIds.has(preset.id)) {
          parsed.presets = parsed.presets ?? [];
          parsed.presets.push(preset);
        }
      }

      this.store = {
        version: CURRENT_SCHEMA_VERSION,
        settings: { ...DEFAULT_GLOBAL_SETTINGS, ...parsed.settings },
        providers: parsed.providers ?? [],
        models: parsed.models ?? [],
        presets: parsed.presets ?? [...BUILTIN_PRESETS],
        updatedAt: parsed.updatedAt || Date.now(),
      };

      this.logger.info('Store loaded successfully');
      return { success: true, data: this.getState() };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to deserialize: ${message}` };
    }
  }

  /** Reset the store to defaults */
  reset(): void {
    this.store = this.createDefaultStore();
    this.logger.info('Store reset to defaults');
  }

  // ── Lookup ─────────────────────────────────────────────────────

  /** Get provider definition by ID */
  getProviderDefinition(providerId: ProviderId) {
    return PROVIDER_DEFINITIONS[providerId];
  }

  /** Get model definition by ID */
  getModelDefinition(modelId: string) {
    return MODEL_DEFINITIONS.find(m => m.id === modelId);
  }

  /** Get all known model definitions */
  getModelDefinitions() {
    return [...MODEL_DEFINITIONS];
  }

  /** Get models available for a specific provider */
  getModelsForProvider(providerId: ProviderId) {
    return MODEL_DEFINITIONS.filter(m => m.provider === providerId);
  }

  // ── Helpers ────────────────────────────────────────────────────

  /** Update the last modified timestamp */
  private touch(): void {
    this.store.updatedAt = Date.now();
  }
}
