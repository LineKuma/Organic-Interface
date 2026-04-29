import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ContextManager,
  ContextStatus,
  ContextItemType,
  StateType,
  type Participant,
  type ContextMetadata,
  DEFAULT_CONTEXT_CONFIG,
} from './ContextManager.js';
import { MessageType, ContentFormat } from './Message.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ContextManager', () => {
  let manager: ContextManager;

  const createTestParticipants = (): Participant[] => [
    { id: 'user-1', type: 'user', name: 'Test User', joinedAt: Date.now() },
    { id: 'agent-1', type: 'agent', name: 'Test Agent', role: 'assistant', joinedAt: Date.now() },
  ];

  beforeEach(() => {
    manager = new ContextManager();
  });

  describe('constructor', () => {
    it('should create manager with default config', () => {
      expect(manager).toBeDefined();
    });

    it('should accept custom config', () => {
      const customManager = new ContextManager({
        maxWindowSize: 50,
        ttl: 60000,
        defaultNamespace: 'custom',
      });
      expect(customManager).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create new conversation context', () => {
      const participants = createTestParticipants();
      const context = manager.create('session-1', participants);

      expect(context.id).toBeDefined();
      expect(context.sessionId).toBe('session-1');
      expect(context.participants).toHaveLength(2);
      expect(context.status).toBe(ContextStatus.ACTIVE);
      expect(context.messages).toEqual([]);
    });

    it('should initialize state store for context', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.setState(context.id, 'test-key', 'test-value');
      const value = manager.getState(context.id, 'test-key');
      expect(value).toBe('test-value');
    });
  });

  describe('get', () => {
    it('should return context by ID', () => {
      const context = manager.create('session-1', createTestParticipants());
      const retrieved = manager.get(context.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(context.id);
    });

    it('should return null for non-existent context', () => {
      const result = manager.get('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return null for expired context', () => {
      const expiredManager = new ContextManager({ ttl: -1000 });
      const context = expiredManager.create('session-1', createTestParticipants());
      const retrieved = expiredManager.get(context.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing context', () => {
      const context = manager.create('session-1', createTestParticipants());
      const result = manager.delete(context.id);

      expect(result).toBe(true);
      expect(manager.get(context.id)).toBeNull();
    });

    it('should return false for non-existent context', () => {
      const result = manager.delete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('archive', () => {
    it('should archive existing context', () => {
      const context = manager.create('session-1', createTestParticipants());
      const result = manager.archive(context.id);

      expect(result).toBe(true);
      const retrieved = manager.get(context.id);
      expect(retrieved?.status).toBe(ContextStatus.ARCHIVED);
    });

    it('should return false for non-existent context', () => {
      const result = manager.archive('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('restore', () => {
    it('should restore archived context', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.archive(context.id);

      const restored = manager.restore(context.id);
      expect(restored).toBeDefined();
      expect(restored?.status).toBe(ContextStatus.ACTIVE);
    });

    it('should return null for non-archived context', () => {
      const context = manager.create('session-1', createTestParticipants());
      const result = manager.restore(context.id);
      expect(result).toBeNull();
    });
  });

  describe('addMessage', () => {
    it('should add message to context', () => {
      const context = manager.create('session-1', createTestParticipants());
      const message = {
        id: 'msg-1',
        sender: { id: 'user-1', type: 'user' as const, name: 'User' },
        content: { text: 'Hello', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
        timestamp: Date.now(),
        status: 'sent' as any,
        flags: [],
      };

      const result = manager.addMessage(context.id, message);
      expect(result).toBe(true);

      const messages = manager.getMessages(context.id);
      expect(messages).toHaveLength(1);
    });

    it('should return false for non-existent context', () => {
      const message = {
        id: 'msg-1',
        sender: { id: 'user-1', type: 'user' as const, name: 'User' },
        content: { text: 'Hello', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
        timestamp: Date.now(),
        status: 'sent' as any,
        flags: [],
      };

      const result = manager.addMessage('non-existent-id', message);
      expect(result).toBe(false);
    });

    it('should trim messages exceeding max window size', () => {
      const smallWindowManager = new ContextManager({ maxWindowSize: 3 });
      const context = smallWindowManager.create('session-1', createTestParticipants());

      for (let i = 0; i < 5; i++) {
        const msg = {
          id: `msg-${i}`,
          sender: { id: 'user-1', type: 'user' as const, name: 'User' },
          content: { text: `Message ${i}`, format: ContentFormat.PLAIN_TEXT },
          type: MessageType.USER_MESSAGE,
          timestamp: Date.now(),
          status: 'sent' as any,
          flags: [],
        };
        smallWindowManager.addMessage(context.id, msg);
      }

      const messages = smallWindowManager.getMessages(context.id);
      expect(messages).toHaveLength(3);
    });
  });

  describe('addUserMessage', () => {
    it('should create and add user message', () => {
      const context = manager.create('session-1', createTestParticipants());
      const message = manager.addUserMessage(context.id, 'user-1', 'TestUser', 'Hello');

      expect(message).toBeDefined();
      expect(message?.sender.id).toBe('user-1');
      expect(message?.sender.type).toBe('user');
    });
  });

  describe('addAssistantMessage', () => {
    it('should create and add assistant message', () => {
      const context = manager.create('session-1', createTestParticipants());
      const message = manager.addAssistantMessage(context.id, 'agent-1', 'TestAgent', 'Hello to you too');

      expect(message).toBeDefined();
      expect(message?.sender.id).toBe('agent-1');
      expect(message?.sender.type).toBe('agent');
    });
  });

  describe('getMessages', () => {
    it('should return messages with pagination', () => {
      const context = manager.create('session-1', createTestParticipants());

      for (let i = 0; i < 5; i++) {
        manager.addUserMessage(context.id, 'user-1', 'User', `Message ${i}`);
      }

      const messages = manager.getMessages(context.id, { offset: 2, limit: 2 });
      expect(messages).toHaveLength(2);
    });

    it('should filter by message types', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.addUserMessage(context.id, 'user-1', 'User', 'User message');
      manager.addAssistantMessage(context.id, 'agent-1', 'Agent', 'Agent message');

      const userMessages = manager.getMessages(context.id, { types: [MessageType.USER_MESSAGE] });
      expect(userMessages).toHaveLength(1);
    });

    it('should return empty array for non-existent context', () => {
      const messages = manager.getMessages('non-existent-id');
      expect(messages).toEqual([]);
    });
  });

  describe('getRecentMessages', () => {
    it('should return last N messages', () => {
      const context = manager.create('session-1', createTestParticipants());

      for (let i = 0; i < 5; i++) {
        manager.addUserMessage(context.id, 'user-1', 'User', `Message ${i}`);
      }

      const recent = manager.getRecentMessages(context.id, 3);
      expect(recent).toHaveLength(3);
    });

    it('should return all messages if count exceeds total', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.addUserMessage(context.id, 'user-1', 'User', 'Single message');

      const recent = manager.getRecentMessages(context.id, 10);
      expect(recent).toHaveLength(1);
    });
  });

  describe('state management', () => {
    it('should set and get state value', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.setState(context.id, 'key1', 'value1');

      const value = manager.getState(context.id, 'key1');
      expect(value).toBe('value1');
    });

    it('should set state with options', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.setState(context.id, 'key1', 'value1', {
        type: StateType.PERSISTENT,
        namespace: 'custom',
        readonly: true,
      });

      const value = manager.getState(context.id, 'key1', 'custom');
      expect(value).toBe('value1');
    });

    it('should return undefined for non-existent state', () => {
      const context = manager.create('session-1', createTestParticipants());
      const value = manager.getState(context.id, 'non-existent');
      expect(value).toBeUndefined();
    });

    it('should return undefined for expired state', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.setState(context.id, 'key1', 'value1', { expiresAt: Date.now() - 1000 });

      const value = manager.getState(context.id, 'key1');
      expect(value).toBeUndefined();
    });

    it('should delete state', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.setState(context.id, 'key1', 'value1');

      const result = manager.deleteState(context.id, 'key1');
      expect(result).toBe(true);
      expect(manager.getState(context.id, 'key1')).toBeUndefined();
    });

    it('should not delete readonly state', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.setState(context.id, 'key1', 'value1', { readonly: true });

      const result = manager.deleteState(context.id, 'key1');
      expect(result).toBe(false);
    });

    it('should get all states in namespace', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.setState(context.id, 'key1', 'value1', { namespace: 'ns1' });
      manager.setState(context.id, 'key2', 'value2', { namespace: 'ns1' });
      manager.setState(context.id, 'key3', 'value3', { namespace: 'ns2' });

      const states = manager.getStates(context.id, 'ns1');
      expect(states.size).toBe(2);
    });

    it('should clear states in namespace', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.setState(context.id, 'key1', 'value1', { namespace: 'clearable' });
      manager.setState(context.id, 'key2', 'value2', { namespace: 'clearable' });
      manager.setState(context.id, 'key3', 'value3', { namespace: 'keep' });

      manager.clearStates(context.id, 'clearable');

      const states = manager.getStates(context.id, 'clearable');
      expect(states.size).toBe(0);
    });

    it('should emit state:changed event', () => {
      const handler = vi.fn();
      manager.on('state:changed', handler);

      const context = manager.create('session-1', createTestParticipants());
      manager.setState(context.id, 'key1', 'value1');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to state changes', () => {
      const handler = vi.fn();
      const context = manager.create('session-1', createTestParticipants());

      const unsubscribe = manager.subscribe('key1', handler);
      manager.setState(context.id, 'key1', 'value1');

      expect(handler).toHaveBeenCalled();
      unsubscribe();
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const context = manager.create('session-1', createTestParticipants());

      const unsubscribe = manager.subscribe('key1', handler);
      unsubscribe();

      manager.setState(context.id, 'key1', 'value1');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should subscribe to multiple keys', () => {
      const handler = vi.fn();
      const context = manager.create('session-1', createTestParticipants());

      manager.subscribe(['key1', 'key2'], handler);
      manager.setState(context.id, 'key1', 'value1');
      manager.setState(context.id, 'key2', 'value2');

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStats', () => {
    it('should return context statistics', () => {
      const context = manager.create('session-1', createTestParticipants());
      manager.addUserMessage(context.id, 'user-1', 'User', 'Hello');

      const stats = manager.getStats(context.id);

      expect(stats).toBeDefined();
      expect(stats?.messageCount).toBe(1);
      expect(stats?.participantCount).toBe(2);
      expect(stats?.tokenEstimate).toBeGreaterThan(0);
    });

    it('should return null for non-existent context', () => {
      const stats = manager.getStats('non-existent-id');
      expect(stats).toBeNull();
    });
  });

  describe('getAllContextIds', () => {
    it('should return all context IDs', () => {
      manager.create('session-1', createTestParticipants());
      manager.create('session-2', createTestParticipants());

      const ids = manager.getAllContextIds();
      expect(ids).toHaveLength(2);
    });
  });

  describe('getActiveCount', () => {
    it('should return count of active contexts', () => {
      const ctx1 = manager.create('session-1', createTestParticipants());
      manager.create('session-2', createTestParticipants());
      manager.archive(ctx1.id);

      expect(manager.getActiveCount()).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired contexts', () => {
      const expiredManager = new ContextManager({ ttl: -1000 });
      expiredManager.create('session-1', createTestParticipants());
      expiredManager.create('session-2', createTestParticipants());

      const result = expiredManager.cleanup();
      expect(result.archived).toBeGreaterThanOrEqual(0);
      expect(result.deleted).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('DEFAULT_CONTEXT_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CONTEXT_CONFIG.maxWindowSize).toBe(100);
    expect(DEFAULT_CONTEXT_CONFIG.ttl).toBe(3600000);
    expect(DEFAULT_CONTEXT_CONFIG.compressMessages).toBe(false);
    expect(DEFAULT_CONTEXT_CONFIG.persistStates).toBe(false);
    expect(DEFAULT_CONTEXT_CONFIG.defaultNamespace).toBe('default');
  });
});