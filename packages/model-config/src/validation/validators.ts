/**
 * Field-level validators for model configuration
 *
 * Validates individual fields against type constraints,
 * range limits, and format requirements.
 */

import type {
  ProviderConfig,
  ApiKeyConfig,
  RateLimitConfig,
  ModelConfig,
  ModelParameters,
  PresetDefinition,
  GlobalSettings,
  ParamConstraint,
  ProviderId,
} from '../types/index.js';

/** Validation result for a single field */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Field name that failed */
  field?: string;
  /** Error message */
  message?: string;
}

/** Aggregate validation result */
export interface ValidationReport {
  /** Whether all validations passed */
  valid: boolean;
  /** List of individual results */
  results: ValidationResult[];
}

/** Helper to create a passing result */
export function validResult(): ValidationResult {
  return { valid: true };
}

/** Helper to create a failing result */
export function invalidResult(field: string, message: string): ValidationResult {
  return { valid: false, field, message };
}

/** Helper to aggregate results into a report */
export function createReport(results: ValidationResult[]): ValidationReport {
  return {
    valid: results.every(r => r.valid),
    results,
  };
}

// ── Primitive Validators ────────────────────────────────────────

/** Validate a required string field */
export function validateRequiredString(
  value: unknown,
  field: string,
  minLength = 1,
  maxLength = 256
): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return invalidResult(field, `${field} is required`);
  }
  if (typeof value !== 'string') {
    return invalidResult(field, `${field} must be a string`);
  }
  if (value.trim().length < minLength) {
    return invalidResult(field, `${field} must be at least ${minLength} characters`);
  }
  if (value.trim().length > maxLength) {
    return invalidResult(field, `${field} must be at most ${maxLength} characters`);
  }
  return validResult();
}

/** Validate a non-negative integer */
export function validateNonNegativeInt(
  value: unknown,
  field: string,
  max?: number
): ValidationResult {
  if (value === undefined || value === null) {
    return validResult(); // optional field
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return invalidResult(field, `${field} must be an integer`);
  }
  if (value < 0) {
    return invalidResult(field, `${field} must be non-negative`);
  }
  if (max !== undefined && value > max) {
    return invalidResult(field, `${field} must be at most ${max}`);
  }
  return validResult();
}

/** Validate a positive integer */
export function validatePositiveInt(value: unknown, field: string, max?: number): ValidationResult {
  if (value === undefined || value === null) {
    return validResult();
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return invalidResult(field, `${field} must be an integer`);
  }
  if (value <= 0) {
    return invalidResult(field, `${field} must be positive`);
  }
  if (max !== undefined && value > max) {
    return invalidResult(field, `${field} must be at most ${max}`);
  }
  return validResult();
}

/** Validate a number in range */
export function validateNumberInRange(
  value: unknown,
  field: string,
  min: number,
  max: number
): ValidationResult {
  if (value === undefined || value === null) {
    return validResult();
  }
  if (typeof value !== 'number' || isNaN(value)) {
    return invalidResult(field, `${field} must be a number`);
  }
  if (value < min || value > max) {
    return invalidResult(field, `${field} must be between ${min} and ${max}`);
  }
  return validResult();
}

/** Validate a timestamp */
export function validateTimestamp(value: unknown, field: string): ValidationResult {
  if (value === undefined || value === null) {
    return validResult();
  }
  if (typeof value !== 'number' || isNaN(value) || value < 0) {
    return invalidResult(field, `${field} must be a valid timestamp`);
  }
  return validResult();
}

/** Validate a boolean */
export function validateBoolean(value: unknown, field: string): ValidationResult {
  if (value === undefined || value === null) {
    return validResult();
  }
  if (typeof value !== 'boolean') {
    return invalidResult(field, `${field} must be a boolean`);
  }
  return validResult();
}

/** Validate an enum value */
export function validateEnumValue<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[]
): ValidationResult {
  if (value === undefined || value === null) {
    return validResult();
  }
  if (!allowed.includes(value as T)) {
    return invalidResult(field, `${field} must be one of: ${allowed.join(', ')}`);
  }
  return validResult();
}

/** Validate a URL */
export function validateUrl(value: unknown, field: string): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return validResult();
  }
  if (typeof value !== 'string') {
    return invalidResult(field, `${field} must be a string`);
  }
  try {
    new URL(value);
    return validResult();
  } catch {
    return invalidResult(field, `${field} must be a valid URL`);
  }
}

// ── Model Parameter Validators ───────────────────────────────────

/** Validate a model parameter against its constraint */
export function validateParameter(
  value: unknown,
  constraint: ParamConstraint,
  field: string
): ValidationResult {
  if (value === undefined || value === null) {
    if (constraint.required) {
      return invalidResult(field, `${field} is required`);
    }
    return validResult();
  }

  switch (constraint.type) {
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return invalidResult(field, `${field} must be a number`);
      }
      if (constraint.min !== undefined && value < constraint.min) {
        return invalidResult(field, `${field} must be >= ${constraint.min}`);
      }
      if (constraint.max !== undefined && value > constraint.max) {
        return invalidResult(field, `${field} must be <= ${constraint.max}`);
      }
      return validResult();

    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return invalidResult(field, `${field} must be an integer`);
      }
      if (constraint.min !== undefined && value < constraint.min) {
        return invalidResult(field, `${field} must be >= ${constraint.min}`);
      }
      if (constraint.max !== undefined && value > constraint.max) {
        return invalidResult(field, `${field} must be <= ${constraint.max}`);
      }
      return validResult();

    case 'string':
      if (typeof value !== 'string') {
        return invalidResult(field, `${field} must be a string`);
      }
      return validResult();

    case 'boolean':
      if (typeof value !== 'boolean') {
        return invalidResult(field, `${field} must be a boolean`);
      }
      return validResult();

    case 'enum':
      if (!constraint.values?.includes(String(value))) {
        return invalidResult(field, `${field} must be one of: ${constraint.values?.join(', ')}`);
      }
      return validResult();

    default:
      return validResult();
  }
}

/** Validate all model parameters against their constraints */
export function validateModelParameters(
  params: ModelParameters,
  constraints: Record<string, ParamConstraint>
): ValidationReport {
  const results: ValidationResult[] = [];

  for (const [key, constraint] of Object.entries(constraints)) {
    const value = (params as Record<string, unknown>)[key];
    results.push(validateParameter(value, constraint, key));
  }

  return createReport(results);
}

// ── Object Validators ────────────────────────────────────────────

/** Validate an API key configuration */
export function validateApiKey(key: ApiKeyConfig): ValidationReport {
  const results: ValidationResult[] = [
    validateRequiredString(key.id, 'key.id'),
    validateRequiredString(key.label, 'key.label'),
    validateNonNegativeInt(key.priority, 'key.priority'),
    validateBoolean(key.enabled, 'key.enabled'),
    validateRequiredString(key.keyRef, 'key.keyRef'),
    validateTimestamp(key.expiresAt, 'key.expiresAt'),
    validateTimestamp(key.lastUsedAt, 'key.lastUsedAt'),
    validateNonNegativeInt(key.usageCount, 'key.usageCount'),
  ];

  if (key.rateLimit) {
    results.push(validateRateLimit(key.rateLimit));
  }

  return createReport(results);
}

/** Validate a rate limit configuration */
export function validateRateLimit(config: RateLimitConfig): ValidationResult {
  const checks: ValidationResult[] = [
    validateNonNegativeInt(config.rpm, 'rateLimit.rpm'),
    validateNonNegativeInt(config.rpd, 'rateLimit.rpd'),
    validateNonNegativeInt(config.tpm, 'rateLimit.tpm'),
    validateNonNegativeInt(config.tpd, 'rateLimit.tpd'),
    validateNonNegativeInt(config.concurrency, 'rateLimit.concurrency'),
  ];

  const errors = checks.filter(c => !c.valid);
  if (errors.length > 0) {
    return invalidResult('rateLimit', errors.map(e => e.message).join('; '));
  }
  return validResult();
}

/** Validate a provider configuration */
export function validateProvider(
  config: ProviderConfig,
  validIds: readonly ProviderId[]
): ValidationReport {
  const results: ValidationResult[] = [
    validateEnumValue(config.provider, 'provider', validIds),
    validateRequiredString(config.label, 'label'),
    validateUrl(config.baseUrlOverride, 'baseUrlOverride'),
    validateBoolean(config.enabled, 'enabled'),
    validateTimestamp(config.createdAt, 'createdAt'),
    validateTimestamp(config.updatedAt, 'updatedAt'),
  ];

  if (config.rateLimit) {
    results.push(validateRateLimit(config.rateLimit));
  }

  for (const key of config.keys) {
    results.push(...validateApiKey(key).results);
  }

  return createReport(results);
}

/** Validate a model configuration */
export function validateModelConfig(config: ModelConfig): ValidationReport {
  const results: ValidationResult[] = [
    validateRequiredString(config.id, 'id'),
    validateRequiredString(config.modelId, 'modelId'),
    validateRequiredString(config.label, 'label'),
    validateRequiredString(config.provider, 'provider'),
    validateBoolean(config.enabled, 'enabled'),
    validateTimestamp(config.createdAt, 'createdAt'),
    validateTimestamp(config.updatedAt, 'updatedAt'),
  ];

  return createReport(results);
}

/** Validate a preset definition */
export function validatePreset(preset: PresetDefinition): ValidationReport {
  const results: ValidationResult[] = [
    validateRequiredString(preset.id, 'id'),
    validateRequiredString(preset.name, 'name'),
    validateRequiredString(preset.description, 'description'),
    validateTimestamp(preset.createdAt, 'createdAt'),
    validateTimestamp(preset.updatedAt, 'updatedAt'),
  ];

  // Validate parameters
  if (preset.parameters) {
    const paramChecks: ValidationResult[] = [];
    if (preset.parameters.temperature !== undefined) {
      paramChecks.push(validateNumberInRange(preset.parameters.temperature, 'temperature', 0, 2));
    }
    if (preset.parameters.topP !== undefined) {
      paramChecks.push(validateNumberInRange(preset.parameters.topP, 'topP', 0, 1));
    }
    if (preset.parameters.presencePenalty !== undefined) {
      paramChecks.push(
        validateNumberInRange(preset.parameters.presencePenalty, 'presencePenalty', -2, 2)
      );
    }
    if (preset.parameters.frequencyPenalty !== undefined) {
      paramChecks.push(
        validateNumberInRange(preset.parameters.frequencyPenalty, 'frequencyPenalty', -2, 2)
      );
    }
    results.push(...paramChecks);
  }

  return createReport(results);
}

/** Validate global settings */
export function validateGlobalSettings(settings: GlobalSettings): ValidationReport {
  const results: ValidationResult[] = [
    validatePositiveInt(settings.maxRetries, 'maxRetries', 10),
    validatePositiveInt(settings.requestTimeout, 'requestTimeout', 300000),
    validateBoolean(settings.autoKeyRotation, 'autoKeyRotation'),
    validateBoolean(settings.autoModelFallback, 'autoModelFallback'),
    validateEnumValue(settings.logLevel, 'logLevel', ['debug', 'info', 'warn', 'error'] as const),
  ];

  return createReport(results);
}
