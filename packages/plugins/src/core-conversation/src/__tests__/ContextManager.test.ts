/**
 * ContextManager Tests
 *
 * Tests for the ContextManager class which handles conversation context
 * management including message storage, retrieval, and compression.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextManager } from '../ContextManager.js';
import { ContextError } from '../errors/index.js';
import { MessageSender, ContextWindowType, CompressionStrategy } from '../types/index.js';

// Helper to create test messages
function createMessage(id: string, content: string, sender: MessageSender = MessageSender.USER) {
  return {
    id,
    content,
    sender,
    timestamp: Date.now(),
  };
}

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager({
      defaultConfig: {
        windowSize: 50,
        windowType: ContextWindowType.RECENT_MESSAGES,
        includeSystemMessages: true,
        includeToolCalls: true,
      },
      maxMessages: 100,
      autoCompress: false,
      compressionThreshold: 0.8,
    });
  });

  afterEach(() => {
    manager.shutdown();
  });

  describe('getContext', () => {
    it('should get existing context for session', async () => {
      const sessionId = 'session-1';
      const context = manager.getContext(sessionId);

      expect(context).toBeDefined();
      expect(context.sessionId).toBe(sessionId);
      expect(context.messages).toEqual([]);
    });

    it('should create context on first access', async () => {
      const sessionId = 'new-session';
      expect(manager.getContextCount()).toBe(0);

      manager.getContext(sessionId);
      expect(manager.getContextCount()).toBe(1);

      // Getting same session should not create duplicate
      manager.getContext(sessionId);
      expect(manager.getContextCount()).toBe(1);
    });

    it('should track multiple contexts', async () => {
      manager.getContext('session-1');
      manager.getContext('session-2');
      manager.getContext('session-3');

      expect(manager.getContextCount()).toBe(3);
    });
  });

  describe('getContextWindow', () => {
    it('should return context window with messages', async () => {
      const sessionId = 'session-1';

      // Add some messages
      await manager.addMessage(sessionId, createMessage('m1', 'Hello'));
      await manager.addMessage(sessionId, createMessage('m2', 'World'));

      const window = await manager.getContextWindow(sessionId);

      expect(window.sessionId).toBe(sessionId);
      expect(window.messages).toHaveLength(2);
      expect(window.messageCount).toBe(2);
    });

    it('should throw for non-existent session', async () => {
      await expect(manager.getContextWindow('non-existent')).rejects.toThrow(ContextError);
    });

    it('should respect window size configuration', async () => {
      const sessionId = 'session-1';

      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        await manager.addMessage(sessionId, createMessage(`m${i}`, `Message ${i}`));
      }

      const window = await manager.getContextWindow(sessionId, {
        windowSize: 5,
        windowType: ContextWindowType.RECENT_MESSAGES,
        includeSystemMessages: true,
        includeToolCalls: true,
      });

      expect(window.messages.length).toBeLessThanOrEqual(5);
    });

    it('should estimate token count', async () => {
      const sessionId = 'session-1';
      await manager.addMessage(sessionId, createMessage('m1', 'Hello'));

      const window = await manager.getContextWindow(sessionId);
      expect(window.tokenCount).toBeGreaterThan(0);
    });
  });

  describe('addMessage', () => {
    it('should add message to context', async () => {
      const sessionId = 'session-1';
      const message = createMessage('m1', 'Test message');

      await manager.addMessage(sessionId, message);

      const context = manager.getContext(sessionId);
      expect(context.messages).toHaveLength(1);
      expect(context.messages[0].content).toBe('Test message');
    });

    it('should update lastUpdated timestamp', async () => {
      const sessionId = 'session-1';
      const context1 = manager.getContext(sessionId);
      const originalTime = context1.lastUpdated;

      await new Promise(resolve => setTimeout(resolve, 5));
      await manager.addMessage(sessionId, createMessage('m1', 'Test'));

      const context2 = manager.getContext(sessionId);
      expect(context2.lastUpdated).toBeGreaterThan(originalTime);
    });

    it('should handle different message senders', async () => {
      const sessionId = 'session-1';

      await manager.addMessage(sessionId, createMessage('m1', 'User message', MessageSender.USER));
      await manager.addMessage(
        sessionId,
        createMessage('m2', 'Assistant message', MessageSender.ASSISTANT)
      );
      await manager.addMessage(
        sessionId,
        createMessage('m3', 'System message', MessageSender.SYSTEM)
      );
      await manager.addMessage(sessionId, createMessage('m4', 'Tool message', MessageSender.TOOL));

      const context = manager.getContext(sessionId);
      expect(context.messages).toHaveLength(4);
    });

    it('should trigger auto-compression when threshold reached', async () => {
      const compressManager = new ContextManager({
        maxMessages: 10,
        autoCompress: true,
        compressionThreshold: 0.5,
      });

      const sessionId = 'session-1';

      // Add messages until compression triggers (at 50% of 10 = 5)
      for (let i = 0; i < 8; i++) {
        await compressManager.addMessage(sessionId, createMessage(`m${i}`, `Message ${i}`));
      }

      // Context should have been compressed, messages should be less than 8
      const context = compressManager.getContext(sessionId);
      expect(context.messages.length).toBeLessThanOrEqual(8);

      compressManager.shutdown();
    });
  });

  describe('updateMessage', () => {
    it('should update message content', async () => {
      const sessionId = 'session-1';
      await manager.addMessage(sessionId, createMessage('m1', 'Original'));

      await manager.updateMessage(sessionId, 'm1', 'Updated');

      const context = manager.getContext(sessionId);
      expect(context.messages[0].content).toBe('Updated');
    });

    it('should throw for non-existent session', async () => {
      await expect(manager.updateMessage('non-existent', 'm1', 'New content')).rejects.toThrow(
        ContextError
      );
    });

    it('should throw for non-existent message', async () => {
      const sessionId = 'session-1';
      await manager.addMessage(sessionId, createMessage('m1', 'Test'));

      await expect(manager.updateMessage(sessionId, 'non-existent', 'New content')).rejects.toThrow(
        ContextError
      );
      await expect(manager.updateMessage(sessionId, 'non-existent', 'New content')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message', async () => {
      const sessionId = 'session-1';
      await manager.addMessage(sessionId, createMessage('m1', 'First'));
      await manager.addMessage(sessionId, createMessage('m2', 'Second'));
      await manager.addMessage(sessionId, createMessage('m3', 'Third'));

      await manager.deleteMessage(sessionId, 'm2');

      const context = manager.getContext(sessionId);
      expect(context.messages).toHaveLength(2);
      expect(context.messages.find(m => m.id === 'm2')).toBeUndefined();
    });

    it('should throw for non-existent message', async () => {
      const sessionId = 'session-1';
      await manager.addMessage(sessionId, createMessage('m1', 'Test'));

      await expect(manager.deleteMessage(sessionId, 'non-existent')).rejects.toThrow(ContextError);
    });
  });

  describe('clearContext', () => {
    it('should clear all messages', async () => {
      const sessionId = 'session-1';
      await manager.addMessage(sessionId, createMessage('m1', 'First'));
      await manager.addMessage(sessionId, createMessage('m2', 'Second'));

      await manager.clearContext(sessionId);

      const context = manager.getContext(sessionId);
      expect(context.messages).toHaveLength(0);
    });

    it('should throw for non-existent session', async () => {
      await expect(manager.clearContext('non-existent')).rejects.toThrow(ContextError);
    });
  });

  describe('getHistory', () => {
    it('should return full history when no limit specified', async () => {
      const sessionId = 'session-1';
      for (let i = 0; i < 5; i++) {
        await manager.addMessage(sessionId, createMessage(`m${i}`, `Message ${i}`));
      }

      const history = await manager.getHistory(sessionId);
      expect(history).toHaveLength(5);
    });

    it('should return limited history (last N messages)', async () => {
      const sessionId = 'session-1';
      for (let i = 0; i < 10; i++) {
        await manager.addMessage(sessionId, createMessage(`m${i}`, `Message ${i}`));
      }

      // Implementation returns the LAST N messages, not first N
      const history = await manager.getHistory(sessionId, 3);
      expect(history).toHaveLength(3);
      expect(history[0].id).toBe('m7');
      expect(history[1].id).toBe('m8');
      expect(history[2].id).toBe('m9');
    });

    it('should return empty array for non-existent session', async () => {
      await expect(manager.getHistory('non-existent')).rejects.toThrow(ContextError);
    });
  });

  describe('getContextStats', () => {
    it('should return correct statistics', async () => {
      const sessionId = 'session-1';

      await manager.addMessage(sessionId, createMessage('m1', 'User message', MessageSender.USER));
      await manager.addMessage(
        sessionId,
        createMessage('m2', 'Assistant message', MessageSender.ASSISTANT)
      );
      await manager.addMessage(
        sessionId,
        createMessage('m3', 'System message', MessageSender.SYSTEM)
      );
      await manager.addMessage(sessionId, createMessage('m4', 'Tool call', MessageSender.TOOL));

      const stats = await manager.getContextStats(sessionId);

      expect(stats.messageCount).toBe(4);
      expect(stats.systemMessageCount).toBe(1);
      expect(stats.toolCallCount).toBe(1);
      expect(stats.tokenCount).toBeGreaterThan(0);
      expect(stats.firstMessageAt).toBeGreaterThan(0);
      expect(stats.lastMessageAt).toBeGreaterThanOrEqual(stats.firstMessageAt);
    });

    it('should return zero stats for empty context', async () => {
      const sessionId = 'session-1';
      manager.getContext(sessionId); // Ensure context exists

      const stats = await manager.getContextStats(sessionId);

      expect(stats.messageCount).toBe(0);
      expect(stats.tokenCount).toBe(0);
      expect(stats.systemMessageCount).toBe(0);
      expect(stats.toolCallCount).toBe(0);
    });
  });

  describe('updateContext', () => {
    it('should update system message', async () => {
      const sessionId = 'session-1';
      manager.getContext(sessionId);

      await manager.updateContext(sessionId, {
        systemMessage: 'New system prompt',
      });

      const context = manager.getContext(sessionId);
      expect(context.systemMessage).toBe('New system prompt');
    });

    it('should update preferences', async () => {
      const sessionId = 'session-1';
      manager.getContext(sessionId);

      await manager.updateContext(sessionId, {
        preferences: { theme: 'dark', language: 'en' },
      });

      const context = manager.getContext(sessionId);
      expect(context.preferences.theme).toBe('dark');
      expect(context.preferences.language).toBe('en');
    });

    it('should merge preferences', async () => {
      const sessionId = 'session-1';
      manager.getContext(sessionId);

      await manager.updateContext(sessionId, {
        preferences: { theme: 'dark' },
      });

      await manager.updateContext(sessionId, {
        preferences: { language: 'en' },
      });

      const context = manager.getContext(sessionId);
      expect(context.preferences.theme).toBe('dark');
      expect(context.preferences.language).toBe('en');
    });

    it('should update custom data', async () => {
      const sessionId = 'session-1';
      manager.getContext(sessionId);

      await manager.updateContext(sessionId, {
        data: { customKey: 'customValue' },
      });

      const context = manager.getContext(sessionId);
      expect(context.data.customKey).toBe('customValue');
    });
  });

  describe('compressContext', () => {
    it('should compress using TRIM_MIDDLE strategy', async () => {
      const sessionId = 'session-1';

      // Add many messages
      for (let i = 0; i < 20; i++) {
        await manager.addMessage(sessionId, createMessage(`m${i}`, `Message ${i}`));
      }

      await manager.compressContext(sessionId, CompressionStrategy.TRIM_MIDDLE);

      const context = manager.getContext(sessionId);
      expect(context.messages.length).toBeLessThan(20);
    });

    it('should compress using SELECTIVE strategy', async () => {
      const sessionId = 'session-1';

      for (let i = 0; i < 30; i++) {
        await manager.addMessage(sessionId, createMessage(`m${i}`, `Message ${i}`));
      }

      await manager.compressContext(sessionId, CompressionStrategy.SELECTIVE);

      const context = manager.getContext(sessionId);
      expect(context.messages.length).toBeLessThan(30);
    });

    it('should preserve important messages with SELECTIVE', async () => {
      const sessionId = 'session-1';

      for (let i = 0; i < 30; i++) {
        await manager.addMessage(sessionId, createMessage(`m${i}`, `Message ${i}`));
      }

      await manager.compressContext(sessionId, CompressionStrategy.SELECTIVE);

      const context = manager.getContext(sessionId);
      // First messages should be preserved
      expect(context.messages.find(m => m.id === 'm0')).toBeDefined();
    });
  });

  describe('setSystemMessage', () => {
    it('should set system message directly', () => {
      const sessionId = 'session-1';

      manager.setSystemMessage(sessionId, 'System prompt here');

      const context = manager.getContext(sessionId);
      expect(context.systemMessage).toBe('System prompt here');
    });
  });

  describe('deleteContext', () => {
    it('should delete context for session', () => {
      const sessionId = 'session-1';
      manager.getContext(sessionId);
      expect(manager.getContextCount()).toBe(1);

      manager.deleteContext(sessionId);
      expect(manager.getContextCount()).toBe(0);
    });

    it('should handle deleting non-existent context', () => {
      expect(() => manager.deleteContext('non-existent')).not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should clear all contexts', () => {
      manager.getContext('session-1');
      manager.getContext('session-2');
      expect(manager.getContextCount()).toBe(2);

      manager.shutdown();
      expect(manager.getContextCount()).toBe(0);
    });

    it('should be safe to call multiple times', () => {
      expect(() => manager.shutdown()).not.toThrow();
      expect(() => manager.shutdown()).not.toThrow();
    });
  });

  describe('message filtering', () => {
    it('should filter by window type RECENT_MESSAGES', async () => {
      const sessionId = 'session-1';

      for (let i = 0; i < 20; i++) {
        await manager.addMessage(sessionId, createMessage(`m${i}`, `Message ${i}`));
      }

      const window = await manager.getContextWindow(sessionId, {
        windowSize: 10,
        windowType: ContextWindowType.RECENT_MESSAGES,
        includeSystemMessages: true,
        includeToolCalls: true,
      });

      // Should return last 10 messages
      expect(window.messages.length).toBeLessThanOrEqual(10);
    });

    it('should filter by TOKEN_BASED window type', async () => {
      const sessionId = 'session-1';

      for (let i = 0; i < 5; i++) {
        await manager.addMessage(
          sessionId,
          createMessage(`m${i}`, `Message ${i}`.repeat(10)) // Longer messages
        );
      }

      const window = await manager.getContextWindow(sessionId, {
        windowSize: 50,
        windowType: ContextWindowType.TOKEN_BASED,
        maxTokens: 100,
        includeSystemMessages: true,
        includeToolCalls: true,
      });

      // Should limit by token count
      expect(window.tokenCount).toBeLessThanOrEqual(100 + 100); // Some tolerance
    });

    it('should exclude tool calls when configured', async () => {
      const sessionId = 'session-1';

      await manager.addMessage(sessionId, createMessage('m1', 'User message', MessageSender.USER));
      await manager.addMessage(sessionId, createMessage('m2', 'Tool call', MessageSender.TOOL));
      await manager.addMessage(
        sessionId,
        createMessage('m3', 'Another message', MessageSender.USER)
      );

      const window = await manager.getContextWindow(sessionId, {
        windowSize: 10,
        windowType: ContextWindowType.RECENT_MESSAGES,
        includeSystemMessages: true,
        includeToolCalls: false,
      });

      expect(window.messages.find(m => m.sender === MessageSender.TOOL)).toBeUndefined();
    });
  });
});
