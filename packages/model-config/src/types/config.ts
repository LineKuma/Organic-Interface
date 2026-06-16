/**
 * Full configuration schema for model configuration
 *
 * Defines the aggregate state of all model config data:
 * providers, models, presets, API keys, and global settings.
 */

import type { ProviderConfig } from './provider.js';
import type { ModelConfig } from './model.js';
import type { PresetDefinition } from './preset.js';

/** Global model configuration settings */
export interface GlobalSettings {
  /** Default provider for new models */
  defaultProvider?: string;
  /** Default model for new requests */
  defaultModel?: string;
  /** Default preset for new models */
  defaultPreset?: string;
  /** Maximum retries for failed requests */
  maxRetries: number;
  /** Request timeout in milliseconds */
  requestTimeout: number;
  /** Whether to auto-fallback to next key on rate limit */
  autoKeyRotation: boolean;
  /** Whether to auto-fallback to next model on failure */
  autoModelFallback: boolean;
  /** Log level for model operations */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/** The complete model configuration data state */
export interface ModelConfigData {
  /** Schema version for migration support */
  version: number;
  /** Global settings */
  settings: GlobalSettings;
  /** Configured providers */
  providers: ProviderConfig[];
  /** Configured models */
  models: ModelConfig[];
  /** Presets (built-in + user-defined) */
  presets: PresetDefinition[];
  /** Last modification timestamp */
  updatedAt: number;
}

/** Default global settings */
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  maxRetries: 3,
  requestTimeout: 60000,
  autoKeyRotation: true,
  autoModelFallback: false,
  logLevel: 'info',
};

/** Default empty config data */
export const DEFAULT_MODEL_CONFIG_DATA: ModelConfigData = {
  version: 1,
  settings: { ...DEFAULT_GLOBAL_SETTINGS },
  providers: [],
  models: [],
  presets: [],
  updatedAt: 0,
};

/** Schema version for the config store */
export const CURRENT_SCHEMA_VERSION = 1;
