/**
 * Validation error for Organic Interface
 */

import { BaseError } from './BaseError.js';

/**
 * Error codes for validation errors
 */
export enum ValidationErrorCode {
  /** Required field is missing */
  REQUIRED_FIELD_MISSING = 'VALIDATION_REQUIRED_FIELD_MISSING',
  /** Field value has invalid type */
  INVALID_TYPE = 'VALIDATION_INVALID_TYPE',
  /** Field value is out of range */
  OUT_OF_RANGE = 'VALIDATION_OUT_OF_RANGE',
  /** Field value does not match pattern */
  PATTERN_MISMATCH = 'VALIDATION_PATTERN_MISMATCH',
  /** Field value is not in enum */
  ENUM_MISMATCH = 'VALIDATION_ENUM_MISMATCH',
  /** General validation failure */
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

/**
 * Validation error class for input validation failures
 */
export class ValidationError extends BaseError {
  /** The field that failed validation */
  public readonly field?: string;
  /** The invalid value */
  public readonly invalidValue?: unknown;

  constructor(
    message: string,
    field?: string,
    invalidValue?: unknown,
    code: ValidationErrorCode = ValidationErrorCode.VALIDATION_FAILED,
    details?: unknown
  ) {
    super(message, code, details);
    this.name = 'ValidationError';
    this.field = field;
    this.invalidValue = invalidValue;
  }

  /**
   * Create error for missing required field
   */
  static requiredField(fieldName: string): ValidationError {
    return new ValidationError(
      `Required field '${fieldName}' is missing`,
      fieldName,
      undefined,
      ValidationErrorCode.REQUIRED_FIELD_MISSING
    );
  }

  /**
   * Create error for invalid type
   */
  static invalidType(fieldName: string, expectedType: string, actualType: string): ValidationError {
    return new ValidationError(
      `Field '${fieldName}' has invalid type. Expected '${expectedType}' but got '${actualType}'`,
      fieldName,
      actualType,
      ValidationErrorCode.INVALID_TYPE,
      { expected: expectedType, actual: actualType }
    );
  }

  /**
   * Create error for out of range value
   */
  static outOfRange(fieldName: string, min?: number, max?: number): ValidationError {
    const rangeStr =
      min !== undefined && max !== undefined
        ? `between ${min} and ${max}`
        : min !== undefined
          ? `at least ${min}`
          : `at most ${max}`;
    return new ValidationError(
      `Field '${fieldName}' value is out of range (${rangeStr})`,
      fieldName,
      undefined,
      ValidationErrorCode.OUT_OF_RANGE,
      { min, max }
    );
  }

  /**
   * Create error for pattern mismatch
   */
  static patternMismatch(fieldName: string, pattern: string): ValidationError {
    return new ValidationError(
      `Field '${fieldName}' value does not match pattern '${pattern}'`,
      fieldName,
      undefined,
      ValidationErrorCode.PATTERN_MISMATCH,
      { pattern }
    );
  }

  /**
   * Create error for enum mismatch
   */
  static enumMismatch(fieldName: string, allowedValues: unknown[]): ValidationError {
    return new ValidationError(
      `Field '${fieldName}' value is not in allowed values: [${allowedValues.join(', ')}]`,
      fieldName,
      undefined,
      ValidationErrorCode.ENUM_MISMATCH,
      { allowedValues }
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      field: this.field,
      invalidValue: this.invalidValue,
    };
  }
}
