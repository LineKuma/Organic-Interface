import { describe, it, expect, vi } from 'vitest';
import { ConversationError, ConversationErrorCode } from '../ConversationError.js';

describe('ConversationError', () => {
  describe('constructor', () => {
    it('should create error with message and default code', () => {
      const error = new ConversationError('Test error message');

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('CONVERSATION_ERROR');
    });

    it('should create error with custom code', () => {
      const error = new ConversationError('Custom code error', 'CUSTOM_CODE');

      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should create error with details', () => {
      const details = { key: 'value', num: 123 };
      const error = new ConversationError('Test', 'ERR_DETAILS', details);

      expect(error.details).toEqual(details);
    });

    it('should create error with all parameters', () => {
      const details = { info: 'test' };
      const error = new ConversationError('Full test', 'FULL_ERROR', details);

      expect(error.message).toBe('Full test');
      expect(error.code).toBe('FULL_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should have name "ConversationError"', () => {
      const error = new ConversationError('Name test');

      expect(error.name).toBe('ConversationError');
    });

    it('should have timestamp when created', () => {
      const before = Date.now();
      const error = new ConversationError('Timestamp test');
      const after = Date.now();

      expect(error.timestamp).toBeGreaterThanOrEqual(before);
      expect(error.timestamp).toBeLessThanOrEqual(after);
    });

    it('should have different timestamps for different instances', () => {
      vi.useFakeTimers();
      const error1 = new ConversationError('First');
      vi.advanceTimersByTime(1);
      const error2 = new ConversationError('Second');
      vi.useRealTimers();

      expect(error1.timestamp).not.toBe(error2.timestamp);
      expect(error2.timestamp).toBeGreaterThan(error1.timestamp);
    });

    it('should inherit from Error', () => {
      const error = new ConversationError('Inheritance test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConversationError);
    });

    it('should capture stack trace', () => {
      const error = new ConversationError('Stack test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ConversationError');
    });
  });

  describe('toJSON', () => {
    it('should serialize basic error', () => {
      const error = new ConversationError('Test message', 'TEST_CODE');
      const json = error.toJSON();

      expect(json).toMatchObject({
        name: 'ConversationError',
        message: 'Test message',
        code: 'TEST_CODE',
        details: undefined,
        timestamp: error.timestamp,
      });
    });

    it('should serialize error with details', () => {
      const details = { field: 'test', nested: { a: 1 } };
      const error = new ConversationError('Test', 'CODE', details);
      const json = error.toJSON();

      expect(json.details).toEqual(details);
    });

    it('should preserve all properties in JSON', () => {
      const details = { key: 'value' };
      const error = new ConversationError('Complete', 'COMPLETE', details);
      const json = error.toJSON();

      expect(json.name).toBe('ConversationError');
      expect(json.message).toBe('Complete');
      expect(json.code).toBe('COMPLETE');
      expect(json.details).toEqual(details);
      expect(json.timestamp).toBe(error.timestamp);
    });

    it('should handle undefined details', () => {
      const error = new ConversationError('Test');
      const json = error.toJSON();

      expect(json.details).toBeUndefined();
    });

    it('should handle null details', () => {
      const error = new ConversationError('Test', 'ERR', null);
      const json = error.toJSON();

      expect(json.details).toBeNull();
    });
  });

  describe('fromJSON', () => {
    it('should deserialize from plain object', () => {
      const obj = {
        name: 'ConversationError',
        message: 'Deserialized error',
        code: 'FROM_JSON_CODE',
        details: { test: true },
        timestamp: Date.now(),
      };
      const error = ConversationError.fromJSON(obj);

      expect(error).toBeInstanceOf(ConversationError);
      expect(error.message).toBe('Deserialized error');
      expect(error.code).toBe('FROM_JSON_CODE');
      expect(error.details).toEqual({ test: true });
    });

    it('should deserialize without details', () => {
      const obj = {
        name: 'ConversationError',
        message: 'No details',
        code: 'NO_DETAILS',
      };
      const error = ConversationError.fromJSON(obj);

      expect(error.message).toBe('No details');
      expect(error.details).toBeUndefined();
    });

    it('should have new timestamp after deserialization', () => {
      const obj = {
        name: 'ConversationError',
        message: 'New timestamp',
        code: 'NEW_TS',
      };
      const error = ConversationError.fromJSON(obj);

      expect(error.timestamp).toBeGreaterThan(0);
    });

    it('should have name as "ConversationError" after deserialization', () => {
      const obj = {
        message: 'Name check',
        code: 'NAME_CHECK',
      };
      const error = ConversationError.fromJSON(obj);

      expect(error.name).toBe('ConversationError');
    });
  });

  describe('ConversationErrorCode', () => {
    it('should have general error codes', () => {
      expect(ConversationErrorCode.UNKNOWN).toBe('UNKNOWN');
      expect(ConversationErrorCode.INTERNAL).toBe('INTERNAL');
      expect(ConversationErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
    });

    it('should have session error codes', () => {
      expect(ConversationErrorCode.SESSION_NOT_FOUND).toBe('SESSION_NOT_FOUND');
      expect(ConversationErrorCode.SESSION_EXISTS).toBe('SESSION_EXISTS');
      expect(ConversationErrorCode.SESSION_CLOSED).toBe('SESSION_CLOSED');
      expect(ConversationErrorCode.SESSION_EXPIRED).toBe('SESSION_EXPIRED');
    });

    it('should have context error codes', () => {
      expect(ConversationErrorCode.CONTEXT_NOT_FOUND).toBe('CONTEXT_NOT_FOUND');
      expect(ConversationErrorCode.CONTEXT_EXPIRED).toBe('CONTEXT_EXPIRED');
      expect(ConversationErrorCode.CONTEXT_FULL).toBe('CONTEXT_FULL');
      expect(ConversationErrorCode.CONTEXT_INVALID).toBe('CONTEXT_INVALID');
    });

    it('should have parsing error codes', () => {
      expect(ConversationErrorCode.PARSE_ERROR).toBe('PARSE_ERROR');
      expect(ConversationErrorCode.INVALID_COMMAND).toBe('INVALID_COMMAND');
      expect(ConversationErrorCode.INVALID_FORMAT).toBe('INVALID_FORMAT');
    });

    it('should have timeout error codes', () => {
      expect(ConversationErrorCode.TIMEOUT).toBe('TIMEOUT');
      expect(ConversationErrorCode.SESSION_TIMEOUT).toBe('SESSION_TIMEOUT');
    });

    it('should have kernel error codes', () => {
      expect(ConversationErrorCode.KERNEL_ERROR).toBe('KERNEL_ERROR');
      expect(ConversationErrorCode.KERNEL_NOT_AVAILABLE).toBe('KERNEL_NOT_AVAILABLE');
      expect(ConversationErrorCode.KERNEL_UNREACHABLE).toBe('KERNEL_UNREACHABLE');
    });

    it('should have all codes as string values', () => {
      const codes = Object.values(ConversationErrorCode);
      codes.forEach((code) => {
        expect(typeof code).toBe('string');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', () => {
      const error = new ConversationError('');

      expect(error.message).toBe('');
    });

    it('should handle empty code', () => {
      const error = new ConversationError('Test', '');

      expect(error.code).toBe('');
    });

    it('should handle unicode in message', () => {
      const unicodeMessage = '你好世界 🌍 مرحبا';
      const error = new ConversationError(unicodeMessage);

      expect(error.message).toBe(unicodeMessage);
    });

    it('should handle very long message', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new ConversationError(longMessage, 'LONG');

      expect(error.message).toBe(longMessage);
    });

    it('should handle number as details', () => {
      const error = new ConversationError('Test', 'ERR', 42);

      expect(error.details).toBe(42);
    });

    it('should handle string as details', () => {
      const error = new ConversationError('Test', 'ERR', 'details string');

      expect(error.details).toBe('details string');
    });

    it('should handle array as details', () => {
      const details = [1, 2, 3, 'four'];
      const error = new ConversationError('Test', 'ERR', details);

      expect(error.details).toEqual(details);
    });

    it('should round-trip serialize and deserialize', () => {
      const original = new ConversationError('Round-trip test', 'ROUND_TRIP', { data: 42 });
      const json = original.toJSON();
      const restored = ConversationError.fromJSON(json);

      expect(restored.message).toBe(original.message);
      expect(restored.code).toBe(original.code);
      expect(restored.details).toEqual(original.details);
      expect(restored.name).toBe(original.name);
    });
  });
});