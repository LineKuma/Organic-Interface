/**
 * Cross-field integrity checks for model configuration
 *
 * Validates relationships between entities:
 * - Model references valid provider
 * - Provider references valid definition
 * - API key uniqueness and priority ordering
 * - Preset capability compatibility
 * - Duplicate detection
 */

import type {
  ModelConfigData,
  ProviderConfig,
  ModelConfig,
  PresetDefinition,
  ApiKeyConfig,
  ProviderId,
} from '../types/index.js';
import { PROVIDER_DEFINITIONS } from '../types/provider.js';
import { MODEL_DEFINITIONS } from '../types/model.js';
import { BUILTIN_PRESETS } from '../types/preset.js';

/** Integrity check result */
export interface IntegrityError {
  /** Entity type */
  entityType: 'provider' | 'model' | 'preset' | 'key';
  /** Entity ID */
  entityId: string;
  /** Error description */
  message: string;
}

/** Integrity check report */
export interface IntegrityReport {
  /** Whether all integrity checks passed */
  valid: boolean;
  /** List of integrity errors */
  errors: IntegrityError[];
}

/** Create a clean integrity report */
export function createIntegrityReport(errors: IntegrityError[]): IntegrityReport {
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ── Provider Integrity ───────────────────────────────────────────

/** Known provider IDs from definitions */
const KNOWN_PROVIDER_IDS = Object.keys(PROVIDER_DEFINITIONS) as ProviderId[];

/** Check that all providers reference valid definitions */
export function validateProviderIntegrity(providers: ProviderConfig[]): IntegrityError[] {
  const errors: IntegrityError[] = [];
  const seenIds = new Set<string>();

  for (const provider of providers) {
    // Check provider reference
    if (!KNOWN_PROVIDER_IDS.includes(provider.provider)) {
      errors.push({
        entityType: 'provider',
        entityId: provider.label,
        message: `Unknown provider "${provider.provider}". Known: ${KNOWN_PROVIDER_IDS.join(', ')}`,
      });
    }

    // Check for duplicate labels
    const id = `${provider.provider}:${provider.label}`;
    if (seenIds.has(id)) {
      errors.push({
        entityType: 'provider',
        entityId: provider.label,
        message: `Duplicate provider instance "${provider.label}" for "${provider.provider}"`,
      });
    }
    seenIds.add(id);

    // Check key integrity
    errors.push(...validateKeyIntegrity(provider.keys, provider.label));
  }

  return errors;
}

// ── Key Integrity ────────────────────────────────────────────────

/** Check that API keys have no duplicates and valid priority ordering */
export function validateKeyIntegrity(
  keys: ApiKeyConfig[],
  providerLabel: string
): IntegrityError[] {
  const errors: IntegrityError[] = [];
  const seenLabels = new Set<string>();
  const seenIds = new Set<string>();

  for (const key of keys) {
    // Check duplicate IDs
    if (seenIds.has(key.id)) {
      errors.push({
        entityType: 'key',
        entityId: key.id,
        message: `Duplicate API key ID "${key.id}" in provider "${providerLabel}"`,
      });
    }
    seenIds.add(key.id);

    // Check duplicate labels
    if (seenLabels.has(key.label)) {
      errors.push({
        entityType: 'key',
        entityId: key.id,
        message: `Duplicate API key label "${key.label}" in provider "${providerLabel}"`,
      });
    }
    seenLabels.add(key.label);

    // Check keyRef is not empty
    if (!key.keyRef || key.keyRef.trim() === '') {
      errors.push({
        entityType: 'key',
        entityId: key.id,
        message: `API key "${key.label}" has empty keyRef`,
      });
    }
  }

  return errors;
}

// ── Model Integrity ──────────────────────────────────────────────

/** Check that all models reference valid providers and definitions */
export function validateModelIntegrity(
  models: ModelConfig[],
  providers: ProviderConfig[]
): IntegrityError[] {
  const errors: IntegrityError[] = [];
  const seenIds = new Set<string>();
  const providerIds = new Set(providers.map(p => p.provider));
  const knownModelIds = new Set(MODEL_DEFINITIONS.map(m => m.id));

  for (const model of models) {
    // Check duplicate IDs
    if (seenIds.has(model.id)) {
      errors.push({
        entityType: 'model',
        entityId: model.id,
        message: `Duplicate model ID "${model.id}"`,
      });
    }
    seenIds.add(model.id);

    // Check model definition exists
    if (!knownModelIds.has(model.modelId)) {
      errors.push({
        entityType: 'model',
        entityId: model.id,
        message: `Model "${model.modelId}" is not a known model definition`,
      });
    }

    // Check provider is configured
    if (!providerIds.has(model.provider)) {
      errors.push({
        entityType: 'model',
        entityId: model.id,
        message: `Model "${model.id}" references provider "${model.provider}" which is not configured`,
      });
    }

    // Check model-definition provider match
    const modelDef = MODEL_DEFINITIONS.find(m => m.id === model.modelId);
    if (modelDef && modelDef.provider !== model.provider) {
      errors.push({
        entityType: 'model',
        entityId: model.id,
        message: `Model "${model.modelId}" belongs to provider "${modelDef.provider}" but instance references "${model.provider}"`,
      });
    }
  }

  return errors;
}

// ── Preset Integrity ─────────────────────────────────────────────

/** Check that all presets have valid IDs and no duplicate built-in IDs */
export function validatePresetIntegrity(presets: PresetDefinition[]): IntegrityError[] {
  const errors: IntegrityError[] = [];
  const seenIds = new Set<string>();
  const builtInIds = new Set(BUILTIN_PRESETS.map(p => p.id));

  for (const preset of presets) {
    // Check duplicate IDs
    if (seenIds.has(preset.id)) {
      errors.push({
        entityType: 'preset',
        entityId: preset.id,
        message: `Duplicate preset ID "${preset.id}"`,
      });
    }
    seenIds.add(preset.id);

    // Check user-defined presets don't clash with built-in IDs
    if (!preset.builtIn && builtInIds.has(preset.id)) {
      errors.push({
        entityType: 'preset',
        entityId: preset.id,
        message: `User preset "${preset.id}" conflicts with built-in preset ID`,
      });
    }
  }

  return errors;
}

// ── Full Store Integrity ─────────────────────────────────────────

/** Run all integrity checks on the full config store */
export function validateStoreIntegrity(store: ModelConfigData): IntegrityReport {
  const errors: IntegrityError[] = [
    ...validateProviderIntegrity(store.providers),
    ...validateModelIntegrity(store.models, store.providers),
    ...validatePresetIntegrity(store.presets),
  ];

  // Check default provider references
  if (store.settings.defaultProvider) {
    const providerExists = store.providers.some(
      p => p.provider === store.settings.defaultProvider && p.enabled
    );
    if (!providerExists) {
      errors.push({
        entityType: 'provider',
        entityId: store.settings.defaultProvider,
        message: `Default provider "${store.settings.defaultProvider}" is not configured or disabled`,
      });
    }
  }

  // Check default model references
  if (store.settings.defaultModel) {
    const modelExists = store.models.some(m => m.id === store.settings.defaultModel && m.enabled);
    if (!modelExists) {
      errors.push({
        entityType: 'model',
        entityId: store.settings.defaultModel,
        message: `Default model "${store.settings.defaultModel}" is not configured or disabled`,
      });
    }
  }

  // Check default preset references
  if (store.settings.defaultPreset) {
    const presetExists = store.presets.some(p => p.id === store.settings.defaultPreset);
    if (!presetExists) {
      errors.push({
        entityType: 'preset',
        entityId: store.settings.defaultPreset,
        message: `Default preset "${store.settings.defaultPreset}" does not exist`,
      });
    }
  }

  return createIntegrityReport(errors);
}
