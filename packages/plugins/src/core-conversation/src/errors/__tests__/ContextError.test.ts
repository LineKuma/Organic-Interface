import { describe, it, expect, vi } from 'vitest';
import { ContextError } from '../ContextError.js';
import { ConversationError, ConversationErrorCode } from '../ConversationError.js';

describe('ContextError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new ContextError('Context error message');

      expect(error.message).toBe('Context error message');
      expect(error.name).toBe('ContextError');
    });

    it('should create error with sessionId', () => {
      const error = new ContextError('Test', 'session-123');

      expect(error.sessionId).toBe('session-123');
    });

    it('should create error with sessionId and contextId', () => {
      const error = new ContextError('Test', 'session-123', 'ctx-456');

      expect(error.sessionId).toBe('session-123');
      expect(error.contextId).toBe('ctx-456');
    });

    it('should create error with details', () => {
      const details = { reason: 'test' };
      const error = new ContextError('Test', 's1', 'c1', details);

      expect(error.details).toEqual(details);
    });

    it('should default code to CONTEXT_NOT_FOUND', () => {
      const error = new ContextError('Test');

      expect(error.code).toBe(ConversationErrorCode.CONTEXT_NOT_FOUND);
    });

    it('should have timestamp when created', () => {
      const before = Date.now();
      const error = new ContextError('Test', 'session-1');
      const after = Date.now();

      expect(error.timestamp).toBeGreaterThanOrEqual(before);
      expect(error.timestamp).toBeLessThanOrEqual(after);
    });

    it('should inherit from ConversationError', () => {
      const error = new ContextError('Test');

      expect(error).toBeInstanceOf(ConversationError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should capture stack trace', () => {
      const error = new ContextError('Stack test');

      expect(error.stack).toBeDefined();
    });
  });

  describe('static factories', () => {
    describe('notFound', () => {
      it('should create notFound error with contextId', () => {
        const error = ContextError.notFound('session-123', 'ctx-456');

        expect(error.message).toBe('Context not found: ctx-456 in session session-123');
        expect(error.sessionId).toBe('session-123');
        expect(error.contextId).toBe('ctx-456');
        expect(error.code).toBe(ConversationErrorCode.CONTEXT_NOT_FOUND);
      });

      it('should create notFound error without contextId', () => {
        const error = ContextError.notFound('session-123');

        expect(error.message).toBe('Context not found for session: session-123');
        expect(error.contextId).toBeUndefined();
      });

      it('should include default details', () => {
        const error = ContextError.notFound('session-123', 'ctx-456');

        expect(error.details).toEqual({ reason: 'Context does not exist' });
      });
    });

    describe('expired', () => {
      it('should create expired error with custom reason', () => {
        const error = ContextError.expired('session-123', 'Token expired');

        expect(error.message).toBe('Context expired for session: session-123');
        expect(error.sessionId).toBe('session-123');
        expect(error.details).toEqual({ reason: 'Token expired' });
      });

      it('should create expired error with default reason', () => {
        const error = ContextError.expired('session-123');

        expect(error.details).toEqual({ reason: 'Context window expired' });
      });

      it('should not include contextId', () => {
        const error = ContextError.expired('session-123');

        expect(error.contextId).toBeUndefined();
      });
    });

    describe('full', () => {
      it('should create full error with maxSize', () => {
        const error = ContextError.full('session-123', 1000);

        expect(error.message).toBe('Context full for session: session-123');
        expect(error.sessionId).toBe('session-123');
        expect(error.details).toEqual({ reason: 'Context window is full', maxSize: 1000 });
      });

      it('should handle different maxSize values', () => {
        const error = ContextError.full('session-1', 5000);

        expect(error.details).toEqual({ reason: 'Context window is full', maxSize: 5000 });
      });
    });

    describe('invalid', () => {
      it('should create invalid error with reason', () => {
        const error = ContextError.invalid('session-123', 'Invalid state');

        expect(error.message).toBe('Invalid context for session: session-123');
        expect(error.sessionId).toBe('session-123');
        expect(error.details).toEqual({ reason: 'Invalid state' });
      });

      it('should handle empty reason', () => {
        const error = ContextError.invalid('session-123', '');

        expect(error.details).toEqual({ reason: '' });
      });
    });

    describe('messageNotFound', () => {
      it('should create messageNotFound error', () => {
        const error = ContextError.messageNotFound('session-123', 'msg-789');

        expect(error.message).toBe('Message not found: msg-789 in session session-123');
        expect(error.sessionId).toBe('session-123');
        expect(error.details).toEqual({
          messageId: 'msg-789',
          reason: 'Message does not exist'
        });
      });

      it('should handle UUID message IDs', () => {
        const msgId = '550e8400-e29b-41d4-a716-446655440000';
        const error = ContextError.messageNotFound('session-1', msgId);

        expect(error.details).toEqual({
          messageId: msgId,
          reason: 'Message does not exist'
        });
      });
    });
  });

  describe('toJSON', () => {
    it('should serialize basic error', () => {
      const error = new ContextError('Test', 'session-123', 'ctx-456');
      const json = error.toJSON();

      expect(json).toMatchObject({
        name: 'ContextError',
        message: 'Test',
        code: ConversationErrorCode.CONTEXT_NOT_FOUND,
        sessionId: 'session-123',
        contextId: 'ctx-456',
      });
    });

    it('should include timestamp', () => {
      const error = new ContextError('Test', 's1');
      const json = error.toJSON();

      expect(json.timestamp).toBe(error.timestamp);
    });

    it('should include details', () => {
      const details = { custom: 'data' };
      const error = new ContextError('Test', 's1', 'c1', details);
      const json = error.toJSON();

      expect(json.details).toEqual(details);
    });

    it('should not include stack trace in JSON (not in ConversationError.toJSON)', () => {
      const error = new ContextError('Test', 's1');
      const json = error.toJSON();

      expect(json.stack).toBeUndefined();
    });

    it('should serialize static factory errors', () => {
      const error = ContextError.notFound('session-1', 'ctx-1');
      const json = error.toJSON();

      expect(json.sessionId).toBe('session-1');
      expect(json.contextId).toBe('ctx-1');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined sessionId', () => {
      const error = new ContextError('Test');

      expect(error.sessionId).toBeUndefined();
    });

    it('should handle undefined contextId', () => {
      const error = new ContextError('Test', 'session-1');

      expect(error.contextId).toBeUndefined();
    });

    it('should handle unicode in sessionId', () => {
      const error = ContextError.notFound('会话123', 'ctx-456');

      expect(error.sessionId).toBe('会话123');
    });

    it('should handle empty strings', () => {
      const error = new ContextError('', '', '');

      expect(error.message).toBe('');
      expect(error.sessionId).toBe('');
      expect(error.contextId).toBe('');
    });
  });
});