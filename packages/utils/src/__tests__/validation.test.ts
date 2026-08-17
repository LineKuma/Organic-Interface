import { describe, it, expect } from 'vitest';
import {
  isObject,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isEmpty,
  validateRequired,
  validateType,
  validateLength,
  validateRange,
  validatePattern,
  validateEnum,
  validateSchema,
  type ValidationSchema,
} from '../utils/validation.js';
import { ValidationError } from '../errors/ValidationError.js';

describe('validation utilities', () => {
  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject(() => {})).toBe(false);
    });
  });

  describe('isString', () => {
    it('should return true for strings', () => {
      expect(isString('')).toBe(true);
      expect(isString('hello')).toBe(true);
    });

    it('should return false for non-strings', () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString([])).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('should return true for numbers', () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(123)).toBe(true);
      expect(isNumber(-456)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isNumber(NaN)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
    });
  });

  describe('isBoolean', () => {
    it('should return true for booleans', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
    });

    it('should return false for non-booleans', () => {
      expect(isBoolean(0)).toBe(false);
      expect(isBoolean('true')).toBe(false);
      expect(isBoolean(null)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isArray({})).toBe(false);
      expect(isArray('string')).toBe(false);
      expect(isArray(null)).toBe(false);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty values', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('   ')).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty({})).toBe(true);
    });

    it('should return false for non-empty values', () => {
      expect(isEmpty('hello')).toBe(false);
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty({ key: 'value' })).toBe(false);
      expect(isEmpty(0)).toBe(false);
      expect(isEmpty(false)).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should not throw for valid required fields', () => {
      expect(() => validateRequired({ name: 'test', value: 123 }, ['name', 'value'])).not.toThrow();
    });

    it('should throw for missing required fields', () => {
      expect(() =>
        validateRequired({ name: 'test', value: 123 } as Record<string, unknown>, [
          'name',
          'missing',
        ])
      ).toThrow(ValidationError);
    });

    it('should throw for empty required fields', () => {
      expect(() => validateRequired({ name: '', value: 0 }, ['name'])).toThrow(ValidationError);
    });
  });

  describe('validateType', () => {
    it('should not throw for matching types', () => {
      expect(() => validateType('hello', 'string', 'field')).not.toThrow();
      expect(() => validateType(123, 'number', 'field')).not.toThrow();
      expect(() => validateType(true, 'boolean', 'field')).not.toThrow();
      expect(() => validateType({}, 'object', 'field')).not.toThrow();
      expect(() => validateType([], 'array', 'field')).not.toThrow();
    });

    it('should throw for mismatched types', () => {
      expect(() => validateType(123, 'string', 'field')).toThrow(ValidationError);
      expect(() => validateType('123', 'number', 'field')).toThrow(ValidationError);
      expect(() => validateType({}, 'array', 'field')).toThrow(ValidationError);
    });
  });

  describe('validateLength', () => {
    it('should not throw for valid length', () => {
      expect(() => validateLength('hello', 3, 10, 'field')).not.toThrow();
      expect(() => validateLength('hello', 5, 5, 'field')).not.toThrow();
    });

    it('should throw for too short', () => {
      expect(() => validateLength('hi', 3, 10, 'field')).toThrow(ValidationError);
    });

    it('should throw for too long', () => {
      expect(() => validateLength('hello world', 3, 5, 'field')).toThrow(ValidationError);
    });

    it('should handle exact length requirement', () => {
      expect(() => validateLength('abc', 3, 3, 'field')).not.toThrow();
      expect(() => validateLength('abcd', 3, 3, 'field')).toThrow(ValidationError);
    });

    it('should work without fieldName', () => {
      expect(() => validateLength('hello', 1, 10)).not.toThrow();
    });
  });

  describe('validateRange', () => {
    it('should not throw for values in range', () => {
      expect(() => validateRange(5, 0, 10, 'field')).not.toThrow();
      expect(() => validateRange(0, 0, 10, 'field')).not.toThrow();
      expect(() => validateRange(10, 0, 10, 'field')).not.toThrow();
    });

    it('should throw for values below range', () => {
      expect(() => validateRange(-1, 0, 10, 'field')).toThrow(ValidationError);
    });

    it('should throw for values above range', () => {
      expect(() => validateRange(11, 0, 10, 'field')).toThrow(ValidationError);
    });

    it('should work without fieldName', () => {
      expect(() => validateRange(5, 0, 10)).not.toThrow();
    });
  });

  describe('validatePattern', () => {
    it('should not throw for matching pattern', () => {
      expect(() => validatePattern('hello123', /^\w+\d+$/, 'field')).not.toThrow();
    });

    it('should throw for non-matching pattern', () => {
      expect(() => validatePattern('hello', /^\d+$/, 'field')).toThrow(ValidationError);
    });

    it('should work without fieldName', () => {
      expect(() => validatePattern('hello', /hello/)).not.toThrow();
    });
  });

  describe('validateEnum', () => {
    it('should not throw for valid enum value', () => {
      expect(() => validateEnum('red', ['red', 'green', 'blue'], 'field')).not.toThrow();
      expect(() => validateEnum(1, [1, 2, 3], 'field')).not.toThrow();
    });

    it('should throw for invalid enum value', () => {
      expect(() => validateEnum('yellow', ['red', 'green', 'blue'], 'field')).toThrow(
        ValidationError
      );
    });
  });

  describe('validateSchema', () => {
    describe('string schema', () => {
      it('should validate string with length constraints', () => {
        const schema: ValidationSchema = {
          type: 'string',
          minLength: 3,
          maxLength: 10,
        };
        expect(() => validateSchema('hello', schema, 'field')).not.toThrow();
      });

      it('should validate string with pattern', () => {
        const schema: ValidationSchema = {
          type: 'string',
          pattern: /^\w+$/,
        };
        expect(() => validateSchema('hello', schema, 'field')).not.toThrow();
        expect(() => validateSchema('hello world', schema, 'field')).toThrow();
      });

      it('should validate string enum', () => {
        const schema: ValidationSchema = {
          type: 'string',
          enum: ['admin', 'user', 'guest'],
        };
        expect(() => validateSchema('admin', schema, 'field')).not.toThrow();
        expect(() => validateSchema('root', schema, 'field')).toThrow();
      });
    });

    describe('number schema', () => {
      it('should validate number with range', () => {
        const schema: ValidationSchema = {
          type: 'number',
          minimum: 0,
          maximum: 100,
        };
        expect(() => validateSchema(50, schema, 'field')).not.toThrow();
        expect(() => validateSchema(-1, schema, 'field')).toThrow();
        expect(() => validateSchema(101, schema, 'field')).toThrow();
      });
    });

    describe('array schema', () => {
      it('should validate array items', () => {
        const schema: ValidationSchema = {
          type: 'array',
          items: { type: 'string' },
        };
        expect(() => validateSchema(['a', 'b', 'c'], schema, 'field')).not.toThrow();
        expect(() => validateSchema([1, 2, 3], schema, 'field')).toThrow();
      });
    });

    describe('object schema', () => {
      it('should validate required properties', () => {
        const schema: ValidationSchema = {
          type: 'object',
          properties: {
            name: { type: 'string', required: true },
            age: { type: 'number', required: true },
          },
        };
        expect(() => validateSchema({ name: 'John', age: 30 }, schema, 'field')).not.toThrow();
        expect(() => validateSchema({ name: 'John' }, schema, 'field')).toThrow();
      });

      it('should validate nested objects', () => {
        const schema: ValidationSchema = {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string', required: true },
              },
            },
          },
        };
        expect(() => validateSchema({ user: { name: 'John' } }, schema, 'field')).not.toThrow();
      });

      it('should skip validation for undefined properties', () => {
        const schema: ValidationSchema = {
          type: 'object',
          properties: {
            optional: { type: 'string' },
          },
        };
        expect(() => validateSchema({}, schema, 'field')).not.toThrow();
      });
    });
  });
});
