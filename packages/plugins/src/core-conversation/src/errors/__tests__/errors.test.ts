import { describe, it, expect } from 'vitest';
import { ConversationError, ConversationErrorCode, ConversationErrorCodeType } from '../ConversationError.js';
import { SessionError } from '../SessionError.js';
import { ContextError } from '../ContextError.js';

describe('ConversationError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new ConversationError('Test error message');

      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('ConversationError');
      expect(error.code).toBe('CONVERSATION_ERROR');
    });

    it('should create error with custom code', () => {
      const error = new ConversationError('Test', ConversationErrorCode.INVALID_INPUT);

      expect(error.code).toBe('INVALID_INPUT');
    });

    it('should create error with details', () => {
      const details = { field: 'test', reason: 'invalid' };
      const error = new ConversationError('Test', 'TEST_CODE', details);

      expect(error.details).toEqual(details);
    });

    it('should have timestamp', () => {
      const before = Date.now();
      const error = new ConversationError('Test');
      const after = Date.now();

      expect(error.timestamp).toBeGreaterThanOrEqual(before);
      expect(error.timestamp).toBeLessThanOrEqual(after);
    });

    it('should capture stack trace', () => {
      const error = new ConversationError('Stack trace test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ConversationError');
    });

    it('should use default code when not provided', () => {
      const error = new ConversationError('Default code test');

      expect(error.code).toBe('CONVERSATION_ERROR');
    });

    it('should inherit from Error', () => {
      const error = new ConversationError('Inheritance test');

      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON correctly', () => {
      const error = new ConversationError('Test message', 'TEST_CODE', { key: 'value' });
      const json = error.toJSON();

      expect(json).toMatchObject({
        name: 'ConversationError',
        message: 'Test message',
        code: 'TEST_CODE',
        details: { key: 'value' },
        timestamp: error.timestamp,
      });
    });

    it('should include stack trace in JSON', () => {
      const error = new ConversationError('JSON stack test');
      const json = error.toJSON();

      expect(json.stack).toBeTypeOf('string');
    });

    it('should serialize with undefined details', () => {
      const error = new ConversationError('No details');
      const json = error.toJSON();

      expect(json.details).toBeUndefined();
    });

    it('should serialize with complex details object', () => {
      const details = { nested: { deep: { value: 123 } }, array: [1, 2, 3] };
      const error = new ConversationError('Complex', 'COMPLEX', details);
      const json = error.toJSON();

      expect(json.details).toEqual(details);
    });
  });

  describe('fromJSON', () => {
    it('should reconstruct error from JSON', () => {
      const original = new ConversationError('Test message', 'TEST_CODE', { key: 'value' });
      const json = original.toJSON();
      const reconstructed = ConversationError.fromJSON(json);

      expect(reconstructed.message).toBe(original.message);
      expect(reconstructed.code).toBe(original.code);
      expect(reconstructed.details).toEqual(original.details);
    });

    it('should reconstruct with all error codes', () => {
      const original = new ConversationError('Full test', ConversationErrorCode.INTERNAL, { info: 'test' });
      const json = original.toJSON();
      const reconstructed = ConversationError.fromJSON(json);

      expect(reconstructed.code).toBe(ConversationErrorCode.INTERNAL);
      expect(reconstructed.details).toEqual({ info: 'test' });
    });

    it('should preserve timestamp in reconstruction', () => {
      const original = new ConversationError('Timestamp test', 'TS_CODE');
      const json = original.toJSON();
      const reconstructed = ConversationError.fromJSON(json);

      expect(reconstructed.timestamp).toBe(original.timestamp);
    });
  });

  describe('ConversationErrorCode', () => {
    it('should have all expected error codes', () => {
      expect(ConversationErrorCode.UNKNOWN).toBe('UNKNOWN');
      expect(ConversationErrorCode.INTERNAL).toBe('INTERNAL');
      expect(ConversationErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
      expect(ConversationErrorCode.SESSION_NOT_FOUND).toBe('SESSION_NOT_FOUND');
      expect(ConversationErrorCode.SESSION_EXISTS).toBe('SESSION_EXISTS');
      expect(ConversationErrorCode.SESSION_CLOSED).toBe('SESSION_CLOSED');
      expect(ConversationErrorCode.SESSION_EXPIRED).toBe('SESSION_EXPIRED');
      expect(ConversationErrorCode.CONTEXT_NOT_FOUND).toBe('CONTEXT_NOT_FOUND');
      expect(ConversationErrorCode.CONTEXT_EXPIRED).toBe('CONTEXT_EXPIRED');
      expect(ConversationErrorCode.CONTEXT_FULL).toBe('CONTEXT_FULL');
      expect(ConversationErrorCode.CONTEXT_INVALID).toBe('CONTEXT_INVALID');
      expect(ConversationErrorCode.PARSE_ERROR).toBe('PARSE_ERROR');
      expect(ConversationErrorCode.INVALID_COMMAND).toBe('INVALID_COMMAND');
      expect(ConversationErrorCode.INVALID_FORMAT).toBe('INVALID_FORMAT');
      expect(ConversationErrorCode.TIMEOUT).toBe('TIMEOUT');
      expect(ConversationErrorCode.SESSION_TIMEOUT).toBe('SESSION_TIMEOUT');
      expect(ConversationErrorCode.KERNEL_ERROR).toBe('KERNEL_ERROR');
      expect(ConversationErrorCode.KERNEL_NOT_AVAILABLE).toBe('KERNEL_NOT_AVAILABLE');
      expect(ConversationErrorCode.KERNEL_UNREACHABLE).toBe('KERNEL_UNREACHABLE');
    });

    it('should have correct number of error codes', () => {
      const codes = Object.keys(ConversationErrorCode);
      expect(codes.length).toBe(19);
    });

    it('should have valid string values for all codes', () => {
      const codes = Object.values(ConversationErrorCode);
      codes.forEach(code => {
        expect(typeof code).toBe('string');
        expect(code.length).toBeGreaterThan(0);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty string message', () => {
      const error = new ConversationError('', 'EMPTY');

      expect(error.message).toBe('');
      expect(error.code).toBe('EMPTY');
    });

    it('should handle unicode in message', () => {
      const error = new ConversationError('こんにちは مرحبا', 'UNICODE');

      expect(error.message).toBe('こんにちは مرحبا');
    });

    it('should handle special characters in code', () => {
      const error = new ConversationError('Test', 'CODE_WITH_UNDERSCORE');

      expect(error.code).toBe('CODE_WITH_UNDERSCORE');
    });

    it('should handle null details', () => {
      const error = new ConversationError('Null details', 'NULL_DETAILS', null);

      expect(error.details).toBeNull();
    });

    it('should handle number as details', () => {
      const error = new ConversationError('Number details', 'NUM_DETAILS', 42);

      expect(error.details).toBe(42);
    });

    it('should handle array as details', () => {
      const error = new ConversationError('Array details', 'ARRAY_DETAILS', [1, 2, 3]);

      expect(error.details).toEqual([1, 2, 3]);
    });
  });
});

describe('SessionError', () => {
  describe('constructor', () => {
    it('should create session error', () => {
      const error = new SessionError('Session error', 'session-123');

      expect(error.message).toBe('Session error');
      expect(error.name).toBe('SessionError');
      expect(error.code).toBe(ConversationErrorCode.SESSION_NOT_FOUND);
      expect(error.sessionId).toBe('session-123');
    });

    it('should inherit from ConversationError', () => {
      const error = new SessionError('Test', 'session-1');

      expect(error).toBeInstanceOf(ConversationError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('static factories', () => {
    it('should create notFound error', () => {
      const error = SessionError.notFound('session-123');

      expect(error.message).toBe('Session not found: session-123');
      expect(error.sessionId).toBe('session-123');
      expect(error.details).toEqual({ reason: 'Session does not exist' });
    });

    it('should create alreadyExists error', () => {
      const error = SessionError.alreadyExists('session-123');

      expect(error.message).toBe('Session already exists: session-123');
      expect(error.sessionId).toBe('session-123');
    });

    it('should create closed error', () => {
      const error = SessionError.closed('session-123');

      expect(error.message).toBe('Session is closed: session-123');
      expect(error.sessionId).toBe('session-123');
    });

    it('should create expired error', () => {
      const error = SessionError.expired('session-123', 3600);

      expect(error.message).toBe('Session expired: session-123');
      expect(error.sessionId).toBe('session-123');
      expect(error.details).toEqual({ reason: 'Session TTL exceeded', ttl: 3600 });
    });

    it('should create maxReached error', () => {
      const error = SessionError.maxReached(10);

      expect(error.message).toBe('Maximum number of sessions reached: 10');
      expect(error.sessionId).toBeUndefined();
      expect(error.details).toEqual({ max: 10, reason: 'Session limit exceeded' });
    });
  });

  describe('toJSON', () => {
    it('should include sessionId in JSON', () => {
      const error = SessionError.notFound('session-123');
      const json = error.toJSON();

      expect(json.sessionId).toBe('session-123');
      expect(json.code).toBe(ConversationErrorCode.SESSION_NOT_FOUND);
    });
  });
});

describe('ContextError', () => {
  describe('constructor', () => {
    it('should create context error', () => {
      const error = new ContextError('Context error', 'session-123', 'ctx-456');

      expect(error.message).toBe('Context error');
      expect(error.name).toBe('ContextError');
      expect(error.code).toBe(ConversationErrorCode.CONTEXT_NOT_FOUND);
      expect(error.sessionId).toBe('session-123');
      expect(error.contextId).toBe('ctx-456');
    });

    it('should inherit from ConversationError', () => {
      const error = new ContextError('Test', 'session-1');

      expect(error).toBeInstanceOf(ConversationError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('static factories', () => {
    it('should create notFound error', () => {
      const error = ContextError.notFound('session-123', 'ctx-456');

      expect(error.message).toBe('Context not found: ctx-456 in session session-123');
      expect(error.sessionId).toBe('session-123');
      expect(error.contextId).toBe('ctx-456');
    });

    it('should create notFound error without contextId', () => {
      const error = ContextError.notFound('session-123');

      expect(error.message).toBe('Context not found for session: session-123');
    });

    it('should create expired error', () => {
      const error = ContextError.expired('session-123', 'Context window expired');

      expect(error.message).toBe('Context expired for session: session-123');
      expect(error.sessionId).toBe('session-123');
    });

    it('should create full error', () => {
      const error = ContextError.full('session-123', 1000);

      expect(error.message).toBe('Context full for session: session-123');
      expect(error.sessionId).toBe('session-123');
      expect(error.details).toEqual({ reason: 'Context window is full', maxSize: 1000 });
    });

    it('should create invalid error', () => {
      const error = ContextError.invalid('session-123', 'Invalid state');

      expect(error.message).toBe('Invalid context for session: session-123');
      expect(error.sessionId).toBe('session-123');
      expect(error.details).toEqual({ reason: 'Invalid state' });
    });

    it('should create messageNotFound error', () => {
      const error = ContextError.messageNotFound('session-123', 'msg-789');

      expect(error.message).toBe('Message not found: msg-789 in session session-123');
      expect(error.sessionId).toBe('session-123');
      expect(error.details).toEqual({ messageId: 'msg-789', reason: 'Message does not exist' });
    });
  });

  describe('toJSON', () => {
    it('should include sessionId and contextId in JSON', () => {
      const error = ContextError.notFound('session-123', 'ctx-456');
      const json = error.toJSON();

      expect(json.sessionId).toBe('session-123');
      expect(json.contextId).toBe('ctx-456');
      expect(json.code).toBe(ConversationErrorCode.CONTEXT_NOT_FOUND);
    });
  });
});