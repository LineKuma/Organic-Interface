import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ContextWindowManager,
  ContextWindowType,
  DEFAULT_CONTEXT_WINDOW_CONFIG,
  DEFAULT_CONTEXT_WINDOW_MANAGER_CONFIG,
  type ContextWindowConfig,
  type ContextWindow,
} from './ContextWindowManager.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ContextWindowManager', () => {
  let manager: ContextWindowManager;

  const createTestMessages = (count: number) => {
    const messages = [];
    for (let i = 0; i < count; i++) {
      messages.push({
        id: `msg-${i}`,
        sender: { id: 'user-1', type: 'user' as const, name: 'User' },
        content: { text: `Message ${i}`, format: 'plain_text' as const },
        type: 'user_message' as const,
        timestamp: Date.now() + i * 1000,
        status: 'sent' as const,
        flags: [],
      });
    }
    return messages;
  };

  beforeEach(() => {
    manager = new ContextWindowManager();
  });

  describe('constructor', () => {
    it('should create manager with default config', () => {
      expect(manager).toBeDefined();
    });

    it('should accept custom config', () => {
      const customManager = new ContextWindowManager({
        defaultConfig: {
          windowSize: 100,
          windowType: ContextWindowType.RECENT_MINUTES,
          includeSystemMessages: false,
          includeToolCalls: false,
          maxTokens: 8192,
          timeWindowMinutes: 60,
          overlapSize: 10,
        },
        maxWindowsPerContext: 20,
        charsPerToken: 5,
      });
      expect(customManager).toBeDefined();
    });
  });

  describe('createWindow', () => {
    it('should create window with default config', () => {
      const messages = createTestMessages(50);
      const window = manager.createWindow('ctx-1', messages);

      expect(window).toBeDefined();
      expect(window.id).toBeDefined();
      expect(window.contextId).toBe('ctx-1');
      expect(window.messages.length).toBeLessThanOrEqual(50);
      expect(window.tokenCount).toBeGreaterThan(0);
    });

    it('should create window with custom config', () => {
      const messages = createTestMessages(100);
      const window = manager.createWindow('ctx-1', messages, {
        windowSize: 20,
        windowType: ContextWindowType.RECENT_MESSAGES,
      });

      expect(window.messages.length).toBe(20);
      expect(window.config.windowSize).toBe(20);
    });

    it('should set hasNext correctly based on message count', () => {
      const messages = createTestMessages(100);
      const window = manager.createWindow('ctx-1', messages, { windowSize: 50 });

      expect(window.hasNext).toBe(true);
      expect(window.hasPrevious).toBe(false);
    });

    it('should filter system messages when configured', () => {
      const messages = [
        ...createTestMessages(10),
        {
          id: 'sys-msg',
          sender: { id: 'system', type: 'system' as const, name: 'System' },
          content: { text: 'System message', format: 'plain_text' as const },
          type: 'system_message' as const,
          timestamp: Date.now(),
          status: 'sent' as const,
          flags: [],
        },
      ];

      const window = manager.createWindow('ctx-1', messages, { includeSystemMessages: false });
      const hasSystemMessage = window.messages.some((m) => m.type === 'system_message');
      expect(hasSystemMessage).toBe(false);
    });

    it('should filter tool calls when configured', () => {
      const messages = [
        ...createTestMessages(10),
        {
          id: 'tool-call',
          sender: { id: 'agent-1', type: 'agent' as const, name: 'Agent' },
          content: { text: 'Calling tool', format: 'plain_text' as const },
          type: 'tool_call' as const,
          timestamp: Date.now(),
          status: 'sent' as const,
          flags: [],
        },
      ];

      const window = manager.createWindow('ctx-1', messages, { includeToolCalls: false });
      const hasToolCall = window.messages.some((m) => m.type === 'tool_call');
      expect(hasToolCall).toBe(false);
    });
  });

  describe('getWindow', () => {
    it('should return window by ID', () => {
      const messages = createTestMessages(50);
      const created = manager.createWindow('ctx-1', messages);
      const retrieved = manager.getWindow(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent window', () => {
      const result = manager.getWindow('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getWindowsForContext', () => {
    it('should return all windows for context', () => {
      const messages = createTestMessages(50);
      manager.createWindow('ctx-1', messages);
      manager.createWindow('ctx-1', messages);

      const windows = manager.getWindowsForContext('ctx-1');
      expect(windows).toHaveLength(2);
    });

    it('should return empty array for context with no windows', () => {
      const windows = manager.getWindowsForContext('non-existent');
      expect(windows).toEqual([]);
    });
  });

  describe('slideForward', () => {
    it('should slide window forward', () => {
      const messages = createTestMessages(100);
      const window = manager.createWindow('ctx-1', messages, { windowSize: 20, overlapSize: 5 });

      const slid = manager.slideForward(window.id, messages);

      expect(slid).toBeDefined();
      expect(slid?.startIndex).toBeGreaterThan(window.startIndex);
    });

    it('should return null when at end', () => {
      const messages = createTestMessages(10);
      const window = manager.createWindow('ctx-1', messages, { windowSize: 5, overlapSize: 0 });

      manager.slideForward(window.id, messages);
      const slid = manager.slideForward(window.id, messages);
      expect(slid).toBeNull();
    });

    it('should return null for non-existent window', () => {
      const messages = createTestMessages(50);
      const result = manager.slideForward('non-existent-id', messages);
      expect(result).toBeNull();
    });

    it('should respect overlap size', () => {
      const messages = createTestMessages(100);
      const window = manager.createWindow('ctx-1', messages, { windowSize: 20, overlapSize: 10 });

      const slid = manager.slideForward(window.id, messages);

      expect(slid?.startIndex).toBe(window.endIndex - 9);
    });
  });

  describe('slideBackward', () => {
    it('should slide window backward', () => {
      const messages = createTestMessages(100);
      const window = manager.createWindow('ctx-1', messages, { windowSize: 20, overlapSize: 5 });

      manager.slideForward(window.id, messages);
      const slid = manager.slideBackward(window.id, messages);

      expect(slid).toBeDefined();
      expect(slid?.startIndex).toBeLessThanOrEqual(window.startIndex);
    });

    it('should return null when at beginning', () => {
      const messages = createTestMessages(10);
      const window = manager.createWindow('ctx-1', messages, { windowSize: 5, overlapSize: 0 });

      const slid = manager.slideBackward(window.id, messages);
      expect(slid).toBeNull();
    });

    it('should return null for non-existent window', () => {
      const messages = createTestMessages(50);
      const result = manager.slideBackward('non-existent-id', messages);
      expect(result).toBeNull();
    });
  });

  describe('optimizeWindow', () => {
    it('should return same window if under token limit', () => {
      const messages = createTestMessages(10);
      const window = manager.createWindow('ctx-1', messages, { maxTokens: 10000 });

      const optimized = manager.optimizeWindow(window.id);
      expect(optimized?.messages.length).toBe(window.messages.length);
    });

    it('should trim messages to fit token limit', () => {
      const messages = createTestMessages(50);
      const window = manager.createWindow('ctx-1', messages, {
        windowSize: 50,
        maxTokens: 100,
        charsPerToken: 4,
      });

      const optimized = manager.optimizeWindow(window.id);
      expect(optimized?.tokenCount).toBeLessThanOrEqual(window.config.maxTokens);
    });

    it('should return null for non-existent window', () => {
      const result = manager.optimizeWindow('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getOptimalWindowSize', () => {
    it('should calculate optimal window size for token limit', () => {
      const size = manager.getOptimalWindowSize(1000);
      expect(size).toBe(250);
    });
  });

  describe('deleteWindow', () => {
    it('should delete existing window', () => {
      const messages = createTestMessages(50);
      const window = manager.createWindow('ctx-1', messages);

      const result = manager.deleteWindow(window.id);
      expect(result).toBe(true);
      expect(manager.getWindow(window.id)).toBeNull();
    });

    it('should return false for non-existent window', () => {
      const result = manager.deleteWindow('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('deleteWindowsForContext', () => {
    it('should delete all windows for context', () => {
      const messages = createTestMessages(50);
      manager.createWindow('ctx-1', messages);
      manager.createWindow('ctx-1', messages);

      const count = manager.deleteWindowsForContext('ctx-1');
      expect(count).toBe(2);
      expect(manager.getWindowsForContext('ctx-1')).toEqual([]);
    });

    it('should return 0 for non-existent context', () => {
      const count = manager.deleteWindowsForContext('non-existent');
      expect(count).toBe(0);
    });
  });

  describe('getWindowCount', () => {
    it('should return total window count', () => {
      const messages = createTestMessages(50);
      manager.createWindow('ctx-1', messages);
      manager.createWindow('ctx-2', messages);

      expect(manager.getWindowCount()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all windows', () => {
      const messages = createTestMessages(50);
      manager.createWindow('ctx-1', messages);
      manager.createWindow('ctx-2', messages);

      manager.clear();
      expect(manager.getWindowCount()).toBe(0);
    });
  });

  describe('events', () => {
    it('should emit window:created event', () => {
      const handler = vi.fn();
      manager.on('window:created', handler);

      const messages = createTestMessages(50);
      manager.createWindow('ctx-1', messages);

      expect(handler).toHaveBeenCalled();
    });

    it('should emit window:slid event', () => {
      const handler = vi.fn();
      manager.on('window:slid', handler);

      const messages = createTestMessages(100);
      const window = manager.createWindow('ctx-1', messages, { windowSize: 20, overlapSize: 5 });
      manager.slideForward(window.id, messages);

      expect(handler).toHaveBeenCalled();
    });

    it('should emit window:optimized event', () => {
      const handler = vi.fn();
      manager.on('window:optimized', handler);

      const messages = createTestMessages(50);
      const window = manager.createWindow('ctx-1', messages, { windowSize: 50, maxTokens: 100 });
      manager.optimizeWindow(window.id);

      expect(handler).toHaveBeenCalled();
    });

    it('should emit window:deleted event', () => {
      const handler = vi.fn();
      manager.on('window:deleted', handler);

      const messages = createTestMessages(50);
      const window = manager.createWindow('ctx-1', messages);
      manager.deleteWindow(window.id);

      expect(handler).toHaveBeenCalledWith(window.id);
    });

    it('should emit windows:cleared event', () => {
      const handler = vi.fn();
      manager.on('windows:cleared', handler);

      const messages = createTestMessages(50);
      manager.createWindow('ctx-1', messages);
      manager.clear();

      expect(handler).toHaveBeenCalled();
    });
  });
});

describe('DEFAULT_CONTEXT_WINDOW_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CONTEXT_WINDOW_CONFIG.windowSize).toBe(50);
    expect(DEFAULT_CONTEXT_WINDOW_CONFIG.windowType).toBe(ContextWindowType.RECENT_MESSAGES);
    expect(DEFAULT_CONTEXT_WINDOW_CONFIG.includeSystemMessages).toBe(true);
    expect(DEFAULT_CONTEXT_WINDOW_CONFIG.includeToolCalls).toBe(true);
    expect(DEFAULT_CONTEXT_WINDOW_CONFIG.maxTokens).toBe(4096);
    expect(DEFAULT_CONTEXT_WINDOW_CONFIG.timeWindowMinutes).toBe(30);
    expect(DEFAULT_CONTEXT_WINDOW_CONFIG.overlapSize).toBe(5);
  });
});

describe('DEFAULT_CONTEXT_WINDOW_MANAGER_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CONTEXT_WINDOW_MANAGER_CONFIG.autoOptimize).toBe(true);
    expect(DEFAULT_CONTEXT_WINDOW_MANAGER_CONFIG.maxWindowsPerContext).toBe(10);
    expect(DEFAULT_CONTEXT_WINDOW_MANAGER_CONFIG.charsPerToken).toBe(4);
  });
});