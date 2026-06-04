import { describe, it, expect, vi } from 'vitest';
import { BaseError } from '../BaseError.js';

describe('BaseError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new BaseError('Test error message');

      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('BaseError');
      expect(error.code).toBe('UNKNOWN_ERROR');
    });

    it('should create error with custom code', () => {
      const error = new BaseError('Test', 'CUSTOM_ERROR');

      expect(error.code).toBe('CUSTOM_ERROR');
    });

    it('should create error with details', () => {
      const details = { key: 'value', num: 123 };
      const error = new BaseError('Test', 'ERR_DETAILS', details);

      expect(error.details).toEqual(details);
    });

    it('should create error with all parameters', () => {
      const details = { info: 'test' };
      const error = new BaseError('Full test', 'FULL_ERROR', details);

      expect(error.message).toBe('Full test');
      expect(error.code).toBe('FULL_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should have timestamp when created', () => {
      const before = Date.now();
      const error = new BaseError('Test');
      const after = Date.now();

      expect(error.timestamp).toBeGreaterThanOrEqual(before);
      expect(error.timestamp).toBeLessThanOrEqual(after);
    });

    it('should capture stack trace', () => {
      const error = new BaseError('Stack trace test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('BaseError');
    });

    it('should have different timestamps for different instances', () => {
      vi.useFakeTimers();
      const error1 = new BaseError('First');
      vi.advanceTimersByTime(1);
      const error2 = new BaseError('Second');
      vi.useRealTimers();

      expect(error1.timestamp).not.toBe(error2.timestamp);
      expect(error2.timestamp).toBeGreaterThan(error1.timestamp);
    });
  });

  describe('toJSON', () => {
    it('should serialize basic error', () => {
      const error = new BaseError('Test message', 'TEST_CODE');
      const json = error.toJSON();

      expect(json).toMatchObject({
        name: 'BaseError',
        message: 'Test message',
        code: 'TEST_CODE',
        details: undefined,
        timestamp: error.timestamp,
      });
    });

    it('should serialize error with details', () => {
      const details = { field: 'test', nested: { a: 1 } };
      const error = new BaseError('Test', 'CODE', details);
      const json = error.toJSON();

      expect(json.details).toEqual(details);
      expect(json.stack).toBeDefined();
    });

    it('should include stack trace in JSON', () => {
      const error = new BaseError('Stack test');
      const json = error.toJSON();

      expect(json.stack).toBeTypeOf('string');
    });

    it('should preserve all properties in JSON', () => {
      const details = { key: 'value' };
      const error = new BaseError('Complete', 'COMPLETE', details);
      const json = error.toJSON();

      expect(json.name).toBe('BaseError');
      expect(json.message).toBe('Complete');
      expect(json.code).toBe('COMPLETE');
      expect(json.details).toEqual(details);
      expect(json.timestamp).toBe(error.timestamp);
      expect(json.stack).toBeTypeOf('string');
    });

    it('should handle circular reference in details gracefully', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      const error = new BaseError('Circular', 'CIRC', circular);
      const json = error.toJSON();

      expect(json.name).toBe('BaseError');
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      const error = new BaseError('Test message', 'TEST_CODE');
      const str = error.toString();

      expect(str).toBe('[TEST_CODE] BaseError: Test message');
    });

    it('should use default code when not provided', () => {
      const error = new BaseError('Default code');
      const str = error.toString();

      expect(str).toBe('[UNKNOWN_ERROR] BaseError: Default code');
    });

    it('should handle empty message', () => {
      const error = new BaseError('', 'EMPTY');
      const str = error.toString();

      expect(str).toBe('[EMPTY] BaseError: ');
    });

    it('should handle special characters in message', () => {
      const error = new BaseError('Special chars: !@#$%^&*()', 'SPECIAL');
      const str = error.toString();

      expect(str).toBe('[SPECIAL] BaseError: Special chars: !@#$%^&*()');
    });
  });

  describe('error chaining', () => {
    it('should be instance of Error', () => {
      const error = new BaseError('Test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
    });

    it('should work with Error.captureStackTrace', () => {
      const error = new BaseError('Capture test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('BaseError');
    });
  });

  describe('edge cases', () => {
    it('should handle very long message', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new BaseError(longMessage, 'LONG');

      expect(error.message).toBe(longMessage);
    });

    it('should handle unicode characters in message', () => {
      const unicodeMessage = '你好世界 🌍 مرحبا';
      const error = new BaseError(unicodeMessage, 'UNICODE');

      expect(error.message).toBe(unicodeMessage);
    });

    it('should handle undefined details', () => {
      const error = new BaseError('Test', 'ERR', undefined);

      expect(error.details).toBeUndefined();
    });

    it('should handle null as details', () => {
      const error = new BaseError('Test', 'ERR', null);

      expect(error.details).toBeNull();
    });

    it('should handle number as details', () => {
      const error = new BaseError('Test', 'ERR', 42);

      expect(error.details).toBe(42);
    });

    it('should handle string as details', () => {
      const error = new BaseError('Test', 'ERR', 'details string');

      expect(error.details).toBe('details string');
    });

    it('should handle array as details', () => {
      const details = [1, 2, 3, 'four'];
      const error = new BaseError('Test', 'ERR', details);

      expect(error.details).toEqual(details);
    });
  });
});
