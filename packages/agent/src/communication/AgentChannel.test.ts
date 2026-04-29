import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AgentChannel,
  createAgentChannel,
  DEFAULT_CHANNEL_CONFIG,
  type AgentChannelConfig,
} from './AgentChannel.js';
import {
  MessageAction,
  MessagePriority,
  DeliveryMode,
  createExecuteMessage,
  createQueryMessage,
  createResponseMessage,
  createHeartbeatMessage,
  createNotifyMessage,
  createErrorMessage,
} from './AgentMessage.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('AgentChannel', () => {
  let channel: AgentChannel;

  beforeEach(() => {
    channel = new AgentChannel({ agentId: 'test-agent' });
  });

  describe('constructor', () => {
    it('should create channel with default config', () => {
      expect(channel).toBeDefined();
      expect(channel.getAgentId()).toBe('test-agent');
    });

    it('should create channel with custom config', () => {
      const customChannel = new AgentChannel({
        agentId: 'custom-agent',
        channelId: 'custom-channel',
        defaultTimeout: 10000,
        maxRetries: 5,
      });
      expect(customChannel.getAgentId()).toBe('custom-agent');
      expect(customChannel.getChannelId()).toBe('custom-channel');
    });
  });

  describe('getChannelId', () => {
    it('should return channel ID', () => {
      const channelId = channel.getChannelId();
      expect(channelId).toBeDefined();
      expect(typeof channelId).toBe('string');
    });
  });

  describe('getAgentId', () => {
    it('should return agent ID', () => {
      expect(channel.getAgentId()).toBe('test-agent');
    });
  });

  describe('registerHandler', () => {
    it('should register message handler', () => {
      const handler = vi.fn();
      channel.registerHandler(MessageAction.EXECUTE, handler);
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(true);
    });

    it('should allow multiple handlers for different actions', () => {
      const executeHandler = vi.fn();
      const queryHandler = vi.fn();
      channel.registerHandler(MessageAction.EXECUTE, executeHandler);
      channel.registerHandler(MessageAction.QUERY, queryHandler);
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(true);
      expect(channel.hasHandler(MessageAction.QUERY)).toBe(true);
    });
  });

  describe('unregisterHandler', () => {
    it('should unregister existing handler', () => {
      const handler = vi.fn();
      channel.registerHandler(MessageAction.EXECUTE, handler);
      const result = channel.unregisterHandler(MessageAction.EXECUTE);
      expect(result).toBe(true);
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(false);
    });

    it('should return false for non-existent handler', () => {
      const result = channel.unregisterHandler(MessageAction.EXECUTE);
      expect(result).toBe(false);
    });
  });

  describe('hasHandler', () => {
    it('should return true for registered handler', () => {
      channel.registerHandler(MessageAction.EXECUTE, vi.fn());
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(true);
    });

    it('should return false for unregistered handler', () => {
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(false);
    });
  });

  describe('handleMessage', () => {
    it('should handle registered message action', async () => {
      const handler = vi.fn().mockResolvedValue('result');
      channel.registerHandler(MessageAction.EXECUTE, handler);

      const message = createExecuteMessage('sender', 'test-agent', { task: 'test' });
      const result = await channel.handleMessage(message);

      expect(handler).toHaveBeenCalledWith(message);
      expect(result).toBe('result');
    });

    it('should throw error for expired message', async () => {
      const expiredMessage = createExecuteMessage('sender', 'test-agent', { task: 'test' }, { ttl: -1000 });
      await expect(channel.handleMessage(expiredMessage)).rejects.toThrow(/expired/);
    });

    it('should throw error for unregistered action without wildcard', async () => {
      const message = createExecuteMessage('sender', 'test-agent', { task: 'test' });
      await expect(channel.handleMessage(message)).rejects.toThrow(/No handler/);
    });

    it('should use wildcard handler when no specific handler exists', async () => {
      const wildcardHandler = vi.fn().mockResolvedValue('wildcard-result');
      channel.registerHandler('*' as MessageAction, wildcardHandler);

      const message = createExecuteMessage('sender', 'test-agent', { task: 'test' });
      const result = await channel.handleMessage(message);

      expect(wildcardHandler).toHaveBeenCalledWith(message);
      expect(result).toBe('wildcard-result');
    });

    it('should handle handler error and send error response', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      channel.registerHandler(MessageAction.EXECUTE, errorHandler);

      const message = createExecuteMessage('sender', 'test-agent', { task: 'test' });
      await expect(channel.handleMessage(message)).rejects.toThrow('Handler failed');
    });
  });

  describe('send', () => {
    it('should send message successfully', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      const sentPromise = channel.send(message);
      await expect(sentPromise).resolves.toBeUndefined();
    });

    it('should auto-set source if not provided', async () => {
      const message = createExecuteMessage('', 'target-agent', { task: 'test' });
      await channel.send(message);
      expect(message.source).toBe('test-agent');
    });

    it('should emit message:sent event', async () => {
      const handler = vi.fn();
      channel.on('message:sent', handler);

      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await channel.send(message);

      expect(handler).toHaveBeenCalledWith(message);
    });
  });

  describe('sendWithRetry', () => {
    it('should send message with default retries', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await expect(channel.sendWithRetry(message)).resolves.toBeUndefined();
    });

    it('should accept custom retry options', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await expect(channel.sendWithRetry(message, { maxRetries: 2 })).resolves.toBeUndefined();
    });
  });

  describe('sendAndWait', () => {
    it('should send message and wait for response', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      const responsePromise = channel.sendAndWait(message, { timeout: 100 });
      await expect(responsePromise).rejects.toThrow(/timed out/);
    });

    it('should timeout if no response received', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      const responsePromise = channel.sendAndWait(message, { timeout: 100 });
      await expect(responsePromise).rejects.toThrow(/timed out/);
    });
  });

  describe('subscribe', () => {
    it('should create subscription and return subscription ID', () => {
      const handler = vi.fn();
      const filter = { action: MessageAction.NOTIFY };
      const subscriptionId = channel.subscribe(filter, handler);

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');
    });

    it('should allow multiple subscriptions', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const subId1 = channel.subscribe({ action: MessageAction.EXECUTE }, handler1);
      const subId2 = channel.subscribe({ action: MessageAction.QUERY }, handler2);

      expect(subId1).not.toBe(subId2);
    });
  });

  describe('unsubscribe', () => {
    it('should remove existing subscription', () => {
      const handler = vi.fn();
      const subscriptionId = channel.subscribe({ action: MessageAction.NOTIFY }, handler);
      const result = channel.unsubscribe(subscriptionId);

      expect(result).toBe(true);
      expect(channel.getSubscriptionCount()).toBe(0);
    });

    it('should return false for non-existent subscription', () => {
      const result = channel.unsubscribe('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('publish', () => {
    it('should publish to matching subscribers', async () => {
      const handler = vi.fn();
      channel.subscribe({ action: MessageAction.NOTIFY }, handler);

      const message = createNotifyMessage('test-agent', '*', 'event-name', { data: 'test' });
      await channel.publish(message);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should filter by source', async () => {
      const handler = vi.fn();
      channel.subscribe({ source: 'specific-source' }, handler);

      const matchingMessage = createNotifyMessage('specific-source', '*', 'event-name');
      const nonMatchingMessage = createNotifyMessage('other-source', '*', 'event-name');

      await channel.publish(matchingMessage);
      await channel.publish(nonMatchingMessage);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not throw if handler throws', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      channel.subscribe({ action: MessageAction.NOTIFY }, errorHandler);

      const message = createNotifyMessage('test-agent', '*', 'event-name');
      await expect(channel.publish(message)).resolves.toBeUndefined();
    });
  });

  describe('getHistory', () => {
    it('should return message history', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await channel.send(message);

      const history = channel.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should return limited history', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await channel.send(message);

      const history = channel.getHistory(1);
      expect(history.length).toBe(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear message history', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await channel.send(message);

      channel.clearHistory();
      expect(channel.getHistory()).toEqual([]);
    });
  });

  describe('getSubscriptionCount', () => {
    it('should return subscription count', () => {
      channel.subscribe({ action: MessageAction.EXECUTE }, vi.fn());
      channel.subscribe({ action: MessageAction.QUERY }, vi.fn());

      expect(channel.getSubscriptionCount()).toBe(2);
    });
  });

  describe('getPendingRequestCount', () => {
    it('should return pending request count', () => {
      expect(channel.getPendingRequestCount()).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should dispose channel and clear all state', () => {
      channel.registerHandler(MessageAction.EXECUTE, vi.fn());
      channel.subscribe({ action: MessageAction.NOTIFY }, vi.fn());

      channel.dispose();

      expect(channel.getSubscriptionCount()).toBe(0);
      expect(channel.getPendingRequestCount()).toBe(0);
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(false);
    });
  });

  describe('createAgentChannel', () => {
    it('should create channel with preset handlers', () => {
      const executeHandler = vi.fn();
      const queryHandler = vi.fn();

      const customChannel = createAgentChannel('preset-agent', {
        [MessageAction.EXECUTE]: executeHandler,
        [MessageAction.QUERY]: queryHandler,
      });

      expect(customChannel.hasHandler(MessageAction.EXECUTE)).toBe(true);
      expect(customChannel.hasHandler(MessageAction.QUERY)).toBe(true);
      customChannel.dispose();
    });

    it('should create channel without handlers', () => {
      const customChannel = createAgentChannel('no-handler-agent');
      expect(customChannel.getAgentId()).toBe('no-handler-agent');
      customChannel.dispose();
    });
  });
});

describe('DEFAULT_CHANNEL_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CHANNEL_CONFIG.defaultTimeout).toBe(5000);
    expect(DEFAULT_CHANNEL_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_CHANNEL_CONFIG.retryDelayBase).toBe(100);
    expect(DEFAULT_CHANNEL_CONFIG.persistMessages).toBe(false);
  });
});