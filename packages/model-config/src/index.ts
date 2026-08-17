/**
 * @organic/model-config - Model Configuration Management
 *
 * Comprehensive model configuration storage with:
 * - Multi-provider, multi-model, multi-key coexistence
 * - Parameter presets and constraints
 * - Field-level validation and cross-field integrity checks
 * - Interactive CLI editing interface
 *
 * @example
 * ```typescript
 * import { ModelConfigStore, ModelConfigService, ModelConfigCLI } from '@organic/model-config';
 *
 * // Create a store
 * const store = new ModelConfigStore();
 *
 * // Quick setup a provider with models
 * const service = new ModelConfigService(store);
 * service.setupProviderWithModels('openai', 'my-key', 'OPENAI_API_KEY');
 *
 * // Run integrity checks
 * const integrity = store.checkIntegrity();
 *
 * // Launch interactive CLI
 * const cli = new ModelConfigCLI(store);
 * await cli.start();
 * ```
 */

// Types
export * from './types/index.js';

// Validation
export * from './validation/index.js';

// Services
export * from './services/index.js';

// CLI
export * from './cli/index.js';

/**
 * Package version
 */
export const VERSION = '0.1.0';
