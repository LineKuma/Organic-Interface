import { describe, it, expect, vi } from 'vitest';
import { ValidationError, ValidationErrorCode } from '../ValidationError.js';
import { BaseError } from '../BaseError.js';

describe('ValidationError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new ValidationError('Test error message');

      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe(ValidationErrorCode.VALIDATION_FAILED);
    });

    it('should create error with field name', () => {
      const error = new ValidationError('Test', 'username');

      expect(error.field).toBe('username');
    });

    it('should create error with invalid value', () => {
      const error = new ValidationError('Test', 'age', -5);

      expect(error.field).toBe('age');
      expect(error.invalidValue).toBe(-5);
    });

    it('should create error with custom code', () => {
      const error = new ValidationError(
        'Custom code',
        'email',
        null,
        ValidationErrorCode.PATTERN_MISMATCH
      );

      expect(error.code).toBe(ValidationErrorCode.PATTERN_MISMATCH);
    });

    it('should create error with details', () => {
      const details = { reason: 'Invalid format', expected: 'email' };
      const error = new ValidationError(
        'Details test',
        'email',
        'bad-email',
        ValidationErrorCode.INVALID_TYPE,
        details
      );

      expect(error.details).toEqual(details);
    });

    it('should create error with all parameters', () => {
      const details = { info: 'test' };
      const error = new ValidationError(
        'Full test',
        'score',
        101,
        ValidationErrorCode.OUT_OF_RANGE,
        details
      );

      expect(error.message).toBe('Full test');
      expect(error.field).toBe('score');
      expect(error.invalidValue).toBe(101);
      expect(error.code).toBe(ValidationErrorCode.OUT_OF_RANGE);
      expect(error.details).toEqual(details);
    });

    it('should have name "ValidationError"', () => {
      const error = new ValidationError('Name test');

      expect(error.name).toBe('ValidationError');
    });

    it('should have timestamp when created', () => {
      const before = Date.now();
      const error = new ValidationError('Timestamp test');
      const after = Date.now();

      expect(error.timestamp).toBeGreaterThanOrEqual(before);
      expect(error.timestamp).toBeLessThanOrEqual(after);
    });

    it('should have different timestamps for different instances', () => {
      vi.useFakeTimers();
      const error1 = new ValidationError('First');
      vi.advanceTimersByTime(1);
      const error2 = new ValidationError('Second');
      vi.useRealTimers();

      expect(error1.timestamp).not.toBe(error2.timestamp);
      expect(error2.timestamp).toBeGreaterThan(error1.timestamp);
    });

    it('should inherit from BaseError', () => {
      const error = new ValidationError('Inheritance test');

      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('should capture stack trace', () => {
      const error = new ValidationError('Stack test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ValidationError');
    });

    it('should have field and invalidValue as undefined when not provided', () => {
      const error = new ValidationError('Test');

      expect(error.field).toBeUndefined();
      expect(error.invalidValue).toBeUndefined();
    });
  });

  describe('static factories', () => {
    describe('requiredField', () => {
      it('should create requiredField error', () => {
        const error = ValidationError.requiredField('email');

        expect(error.message).toBe("Required field 'email' is missing");
        expect(error.field).toBe('email');
        expect(error.invalidValue).toBeUndefined();
        expect(error.code).toBe(ValidationErrorCode.REQUIRED_FIELD_MISSING);
        expect(error).toBeInstanceOf(ValidationError);
      });

      it('should handle field names with special characters', () => {
        const error = ValidationError.requiredField('user.email.address');

        expect(error.field).toBe('user.email.address');
      });
    });

    describe('invalidType', () => {
      it('should create invalidType error', () => {
        const error = ValidationError.invalidType('age', 'number', 'string');

        expect(error.message).toBe(
          "Field 'age' has invalid type. Expected 'number' but got 'string'"
        );
        expect(error.field).toBe('age');
        expect(error.invalidValue).toBe('string');
        expect(error.code).toBe(ValidationErrorCode.INVALID_TYPE);
        expect(error.details).toEqual({ expected: 'number', actual: 'string' });
        expect(error).toBeInstanceOf(ValidationError);
      });

      it('should handle different type values', () => {
        const error = ValidationError.invalidType('count', 'boolean', 'undefined');

        expect(error.invalidValue).toBe('undefined');
        expect(error.details).toEqual({ expected: 'boolean', actual: 'undefined' });
      });
    });

    describe('outOfRange', () => {
      it('should create outOfRange error with min only', () => {
        const error = ValidationError.outOfRange('score', 0);

        expect(error.message).toBe("Field 'score' value is out of range (at least 0)");
        expect(error.field).toBe('score');
        expect(error.code).toBe(ValidationErrorCode.OUT_OF_RANGE);
        expect(error.details).toEqual({ min: 0, max: undefined });
        expect(error).toBeInstanceOf(ValidationError);
      });

      it('should create outOfRange error with max only', () => {
        const error = ValidationError.outOfRange('score', undefined, 100);

        expect(error.message).toBe("Field 'score' value is out of range (at most 100)");
        expect(error.field).toBe('score');
        expect(error.code).toBe(ValidationErrorCode.OUT_OF_RANGE);
        expect(error.details).toEqual({ min: undefined, max: 100 });
      });

      it('should create outOfRange error with both min and max', () => {
        const error = ValidationError.outOfRange('age', 0, 150);

        expect(error.message).toBe("Field 'age' value is out of range (between 0 and 150)");
        expect(error.field).toBe('age');
        expect(error.code).toBe(ValidationErrorCode.OUT_OF_RANGE);
        expect(error.details).toEqual({ min: 0, max: 150 });
      });

      it('should handle zero as min value', () => {
        const error = ValidationError.outOfRange('index', 0);

        expect(error.message).toBe("Field 'index' value is out of range (at least 0)");
        expect((error.details as Record<string, unknown>)?.min).toBe(0);
      });

      it('should handle negative min value', () => {
        const error = ValidationError.outOfRange('temperature', -273);

        expect((error.details as Record<string, unknown>)?.min).toBe(-273);
      });
    });

    describe('patternMismatch', () => {
      it('should create patternMismatch error', () => {
        const error = ValidationError.patternMismatch('email', '^[a-z]+@[a-z]+\\.[a-z]+$');

        expect(error.message).toBe(
          "Field 'email' value does not match pattern '^[a-z]+@[a-z]+\\.[a-z]+$'"
        );
        expect(error.field).toBe('email');
        expect(error.code).toBe(ValidationErrorCode.PATTERN_MISMATCH);
        expect(error.details).toEqual({ pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' });
        expect(error).toBeInstanceOf(ValidationError);
      });

      it('should handle empty pattern', () => {
        const error = ValidationError.patternMismatch('field', '');

        expect(error.message).toBe("Field 'field' value does not match pattern ''");
        expect(error.details).toEqual({ pattern: '' });
      });
    });

    describe('enumMismatch', () => {
      it('should create enumMismatch error', () => {
        const error = ValidationError.enumMismatch('status', ['active', 'inactive', 'pending']);

        expect(error.message).toBe(
          "Field 'status' value is not in allowed values: [active, inactive, pending]"
        );
        expect(error.field).toBe('status');
        expect(error.code).toBe(ValidationErrorCode.ENUM_MISMATCH);
        expect(error.details).toEqual({ allowedValues: ['active', 'inactive', 'pending'] });
        expect(error).toBeInstanceOf(ValidationError);
      });

      it('should handle single allowed value', () => {
        const error = ValidationError.enumMismatch('flag', ['true']);

        expect(error.message).toBe("Field 'flag' value is not in allowed values: [true]");
        expect(error.details).toEqual({ allowedValues: ['true'] });
      });

      it('should handle numeric allowed values', () => {
        const error = ValidationError.enumMismatch('level', [1, 2, 3]);

        expect(error.details).toEqual({ allowedValues: [1, 2, 3] });
      });

      it('should handle empty allowed list', () => {
        const error = ValidationError.enumMismatch('field', []);

        expect(error.message).toBe("Field 'field' value is not in allowed values: []");
        expect(error.details).toEqual({ allowedValues: [] });
      });
    });
  });

  describe('toJSON', () => {
    it('should include field and invalidValue', () => {
      const error = new ValidationError('Test', 'email', 'bad-email');
      const json = error.toJSON();

      expect(json.field).toBe('email');
      expect(json.invalidValue).toBe('bad-email');
    });

    it('should include BaseError properties', () => {
      const error = new ValidationError('Test', 'name', '', ValidationErrorCode.PATTERN_MISMATCH);
      const json = error.toJSON();

      expect(json.name).toBe('ValidationError');
      expect(json.message).toBe('Test');
      expect(json.code).toBe(ValidationErrorCode.PATTERN_MISMATCH);
      expect(json.timestamp).toBe(error.timestamp);
      expect(json.stack).toBeTypeOf('string');
    });

    it('should handle undefined field and invalidValue', () => {
      const error = new ValidationError('Test');
      const json = error.toJSON();

      expect(json.field).toBeUndefined();
      expect(json.invalidValue).toBeUndefined();
    });

    it('should serialize static factory error to JSON', () => {
      const error = ValidationError.requiredField('username');
      const json = error.toJSON();

      expect(json.field).toBe('username');
      expect(json.code).toBe(ValidationErrorCode.REQUIRED_FIELD_MISSING);
    });

    it('should include stack from BaseError', () => {
      const error = new ValidationError('Stack in JSON test');
      const json = error.toJSON();

      expect(json.stack).toBeTypeOf('string');
    });
  });

  describe('ValidationErrorCode', () => {
    it('should have REQUIRED_FIELD_MISSING', () => {
      expect(ValidationErrorCode.REQUIRED_FIELD_MISSING).toBe('VALIDATION_REQUIRED_FIELD_MISSING');
    });

    it('should have INVALID_TYPE', () => {
      expect(ValidationErrorCode.INVALID_TYPE).toBe('VALIDATION_INVALID_TYPE');
    });

    it('should have OUT_OF_RANGE', () => {
      expect(ValidationErrorCode.OUT_OF_RANGE).toBe('VALIDATION_OUT_OF_RANGE');
    });

    it('should have PATTERN_MISMATCH', () => {
      expect(ValidationErrorCode.PATTERN_MISMATCH).toBe('VALIDATION_PATTERN_MISMATCH');
    });

    it('should have ENUM_MISMATCH', () => {
      expect(ValidationErrorCode.ENUM_MISMATCH).toBe('VALIDATION_ENUM_MISMATCH');
    });

    it('should have VALIDATION_FAILED', () => {
      expect(ValidationErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
    });

    it('should have 6 distinct codes', () => {
      const codes = Object.values(ValidationErrorCode);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(6);
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', () => {
      const error = new ValidationError('');

      expect(error.message).toBe('');
    });

    it('should handle empty field name', () => {
      const error = new ValidationError('Test', '');

      expect(error.field).toBe('');
    });

    it('should handle unicode in message', () => {
      const unicodeMessage = '验证失败 🌍';
      const error = new ValidationError(unicodeMessage);

      expect(error.message).toBe(unicodeMessage);
    });

    it('should handle unicode in field name', () => {
      const error = ValidationError.requiredField('用户名');

      expect(error.field).toBe('用户名');
    });

    it('should handle very long message', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new ValidationError(longMessage);

      expect(error.message).toBe(longMessage);
    });

    it('should handle null as invalid value', () => {
      const error = new ValidationError('Test', 'field', null);

      expect(error.invalidValue).toBeNull();
    });

    it('should handle object as invalid value', () => {
      const obj = { complex: true, nested: { a: 1 } };
      const error = new ValidationError('Test', 'config', obj);

      expect(error.invalidValue).toEqual(obj);
    });

    it('should handle array as invalid value', () => {
      const arr = [1, 2, 3];
      const error = new ValidationError('Test', 'items', arr);

      expect(error.invalidValue).toEqual(arr);
    });

    it('should use ValidationErrorCode enum as default code', () => {
      const error = new ValidationError('Default code test');

      expect(error.code).toBe(ValidationErrorCode.VALIDATION_FAILED);
    });

    it('should have toString from BaseError', () => {
      const error = new ValidationError('ToString test', 'email', 'bad');

      const str = error.toString();
      expect(str).toContain('ValidationError');
      expect(str).toContain('ToString test');
    });
  });
});
