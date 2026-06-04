import { describe, it, expect } from 'vitest';
import { SessionError } from '../SessionError.js';
import { ConversationError, ConversationErrorCode } from '../ConversationError.js';

describe('SessionError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new SessionError('Session error message');

      expect(error.message).toBe('Session error message');
      expect(error.name).toBe('SessionError');
    });

    it('should create error with sessionId', () => {
      const error = new SessionError('Test', 'session-123');

      expect(error.sessionId).toBe('session-123');
    });

    it('should create error with details', () => {
      const details = { reason: 'test' };
      const error = new SessionError('Test', 'session-123', details);

      expect(error.details).toEqual(details);
    });

    it('should default code to SESSION_NOT_FOUND', () => {
      const error = new SessionError('Test');

      expect(error.code).toBe(ConversationErrorCode.SESSION_NOT_FOUND);
    });

    it('should have timestamp when created', () => {
      const before = Date.now();
      const error = new SessionError('Test', 'session-1');
      const after = Date.now();

      expect(error.timestamp).toBeGreaterThanOrEqual(before);
      expect(error.timestamp).toBeLessThanOrEqual(after);
    });

    it('should inherit from ConversationError', () => {
      const error = new SessionError('Test');

      expect(error).toBeInstanceOf(ConversationError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should capture stack trace', () => {
      const error = new SessionError('Stack test');

      expect(error.stack).toBeDefined();
    });

    it('should allow undefined sessionId', () => {
      const error = new SessionError('Test', undefined, { info: 'no-session' });

      expect(error.sessionId).toBeUndefined();
      expect(error.details).toEqual({ info: 'no-session' });
    });
  });

  describe('static factories', () => {
    describe('notFound', () => {
      it('should create notFound error', () => {
        const error = SessionError.notFound('session-123');

        expect(error.message).toBe('Session not found: session-123');
        expect(error.sessionId).toBe('session-123');
        expect(error.code).toBe(ConversationErrorCode.SESSION_NOT_FOUND);
      });

      it('should include default details', () => {
        const error = SessionError.notFound('session-123');

        expect(error.details).toEqual({ reason: 'Session does not exist' });
      });

      it('should work with UUID session IDs', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        const error = SessionError.notFound(uuid);

        expect(error.sessionId).toBe(uuid);
        expect(error.message).toContain(uuid);
      });
    });

    describe('alreadyExists', () => {
      it('should create alreadyExists error', () => {
        const error = SessionError.alreadyExists('session-123');

        expect(error.message).toBe('Session already exists: session-123');
        expect(error.sessionId).toBe('session-123');
      });

      it('should include correct details', () => {
        const error = SessionError.alreadyExists('session-123');

        expect(error.details).toEqual({ reason: 'Session with same ID already exists' });
      });
    });

    describe('closed', () => {
      it('should create closed error', () => {
        const error = SessionError.closed('session-123');

        expect(error.message).toBe('Session is closed: session-123');
        expect(error.sessionId).toBe('session-123');
      });

      it('should include correct details', () => {
        const error = SessionError.closed('session-123');

        expect(error.details).toEqual({ reason: 'Session has been closed' });
      });
    });

    describe('expired', () => {
      it('should create expired error with ttl', () => {
        const error = SessionError.expired('session-123', 3600);

        expect(error.message).toBe('Session expired: session-123');
        expect(error.sessionId).toBe('session-123');
        expect(error.details).toEqual({ reason: 'Session TTL exceeded', ttl: 3600 });
      });

      it('should create expired error without ttl', () => {
        const error = SessionError.expired('session-123');

        expect(error.details).toEqual({ reason: 'Session TTL exceeded', ttl: undefined });
      });

      it('should handle negative ttl gracefully', () => {
        const error = SessionError.expired('session-123', -1);

        expect(error.details).toEqual({ reason: 'Session TTL exceeded', ttl: -1 });
      });
    });

    describe('maxReached', () => {
      it('should create maxReached error', () => {
        const error = SessionError.maxReached(10);

        expect(error.message).toBe('Maximum number of sessions reached: 10');
        expect(error.sessionId).toBeUndefined();
        expect(error.details).toEqual({ max: 10, reason: 'Session limit exceeded' });
      });

      it('should handle different max values', () => {
        const error = SessionError.maxReached(100);

        expect(error.details).toEqual({ max: 100, reason: 'Session limit exceeded' });
      });

      it('should not include sessionId when max reached', () => {
        const error = SessionError.maxReached(5);

        expect(error.sessionId).toBeUndefined();
      });

      it('should handle zero max', () => {
        const error = SessionError.maxReached(0);

        expect(error.details).toEqual({ max: 0, reason: 'Session limit exceeded' });
      });
    });
  });

  describe('toJSON', () => {
    it('should serialize basic error', () => {
      const error = new SessionError('Test', 'session-123');
      const json = error.toJSON();

      expect(json).toMatchObject({
        name: 'SessionError',
        message: 'Test',
        code: ConversationErrorCode.SESSION_NOT_FOUND,
        sessionId: 'session-123',
      });
    });

    it('should include timestamp', () => {
      const error = new SessionError('Test', 's1');
      const json = error.toJSON();

      expect(json.timestamp).toBe(error.timestamp);
    });

    it('should include details', () => {
      const details = { custom: 'data' };
      const error = new SessionError('Test', 's1', details);
      const json = error.toJSON();

      expect(json.details).toEqual(details);
    });

    it('should not include stack trace in JSON (not in ConversationError.toJSON)', () => {
      const error = new SessionError('Test', 's1');
      const json = error.toJSON();

      expect(json.stack).toBeUndefined();
    });

    it('should serialize static factory errors', () => {
      const error = SessionError.notFound('session-1');
      const json = error.toJSON();

      expect(json.sessionId).toBe('session-1');
      expect(json.code).toBe(ConversationErrorCode.SESSION_NOT_FOUND);
    });

    it('should serialize maxReached error correctly', () => {
      const error = SessionError.maxReached(50);
      const json = error.toJSON();

      expect(json.sessionId).toBeUndefined();
      expect(json.details).toEqual({ max: 50, reason: 'Session limit exceeded' });
    });
  });

  describe('edge cases', () => {
    it('should handle unicode sessionId', () => {
      const error = SessionError.notFound('会话123');

      expect(error.sessionId).toBe('会话123');
    });

    it('should handle special characters in sessionId', () => {
      const error = SessionError.notFound('session:with:colons');

      expect(error.sessionId).toBe('session:with:colons');
    });

    it('should handle very long sessionId', () => {
      const longId = 's'.repeat(1000);
      const error = SessionError.notFound(longId);

      expect(error.sessionId).toBe(longId);
    });

    it('should handle empty string sessionId in factory', () => {
      const error = SessionError.notFound('');

      expect(error.message).toBe('Session not found: ');
      expect(error.sessionId).toBe('');
    });
  });
});
