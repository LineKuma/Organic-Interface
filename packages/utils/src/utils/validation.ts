/**
 * Validation utilities for Organic Interface
 */

import { ValidationError, ValidationErrorCode } from '../errors/ValidationError.js';

/**
 * Check if a value is a plain object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (isObject(value)) return Object.keys(value).length === 0;
  return false;
}

/**
 * Validate required fields in an object
 */
export function validateRequired<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): void {
  for (const field of fields) {
    if (isEmpty(obj[field])) {
      throw ValidationError.requiredField(String(field));
    }
  }
}

/**
 * Validate field type
 */
export function validateType(
  value: unknown,
  expectedType: 'string' | 'number' | 'boolean' | 'object' | 'array',
  fieldName: string
): void {
  const actualType = Array.isArray(value) ? 'array' : typeof value;

  if (actualType !== expectedType) {
    throw ValidationError.invalidType(fieldName, expectedType, actualType);
  }
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  minLength?: number,
  maxLength?: number,
  fieldName?: string
): void {
  if (minLength !== undefined && value.length < minLength) {
    throw new ValidationError(
      minLength === maxLength
        ? `Length must be exactly ${minLength} characters`
        : `Length must be at least ${minLength} characters`,
      fieldName,
      value,
      ValidationErrorCode.OUT_OF_RANGE
    );
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new ValidationError(
      minLength === maxLength
        ? `Length must be exactly ${maxLength} characters`
        : `Length must be at most ${maxLength} characters`,
      fieldName,
      value,
      ValidationErrorCode.OUT_OF_RANGE
    );
  }
}

/**
 * Validate number range
 */
export function validateRange(value: number, min?: number, max?: number, fieldName?: string): void {
  if (min !== undefined && value < min) {
    throw ValidationError.outOfRange(fieldName || '', min, max);
  }

  if (max !== undefined && value > max) {
    throw ValidationError.outOfRange(fieldName || '', min, max);
  }
}

/**
 * Validate string pattern
 */
export function validatePattern(value: string, pattern: RegExp, fieldName?: string): void {
  if (!pattern.test(value)) {
    throw ValidationError.patternMismatch(fieldName || '', pattern.source);
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T>(
  value: unknown,
  allowedValues: T[],
  fieldName?: string
): asserts value is T {
  if (!allowedValues.includes(value as T)) {
    throw ValidationError.enumMismatch(fieldName || '', allowedValues);
  }
}

/**
 * Validation schema definition
 */
export interface ValidationSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: RegExp;
  enum?: unknown[];
  properties?: Record<string, ValidationSchema>;
  items?: ValidationSchema;
}

/**
 * Validate an object against a schema
 */
export function validateSchema(
  value: unknown,
  schema: ValidationSchema,
  fieldName = 'value'
): void {
  // Check type
  validateType(value, schema.type, fieldName);

  if (schema.type === 'string') {
    const strValue = value as string;
    validateLength(strValue, schema.minLength, schema.maxLength, fieldName);
    if (schema.pattern) {
      validatePattern(strValue, schema.pattern, fieldName);
    }
    if (schema.enum) {
      validateEnum(strValue, schema.enum, fieldName);
    }
  }

  if (schema.type === 'number') {
    const numValue = value as number;
    validateRange(numValue, schema.minimum, schema.maximum, fieldName);
  }

  if (schema.type === 'array') {
    const arrValue = value as unknown[];
    for (let i = 0; i < arrValue.length; i++) {
      if (schema.items) {
        validateSchema(arrValue[i], schema.items, `${fieldName}[${i}]`);
      }
    }
  }

  if (schema.type === 'object') {
    const objValue = value as Record<string, unknown>;

    // Validate required fields
    const requiredFields = Object.entries(schema.properties || {})
      .filter(([_, schema]) => schema.required)
      .map(([name]) => name);

    validateRequired(objValue, requiredFields as (keyof typeof objValue)[]);

    // Validate each property
    for (const [key, propSchema] of Object.entries(schema.properties || {})) {
      if (objValue[key] !== undefined) {
        validateSchema(objValue[key], propSchema, `${fieldName}.${key}`);
      }
    }
  }
}
