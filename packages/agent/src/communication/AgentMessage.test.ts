import { describe, it, expect, vi } from 'vitest';
import {
  MessageAction,
  MessagePriority,
  DeliveryMode,
  MessageFlag,
  type AgentMessage,
  type MessageMetadata,
  type MessageError,
  type MessageOptions,
  createAgentMessage,
  createExecuteMessage,
  createQueryMessage,
  createResponseMessage,
  createHeartbeatMessage,
  createNotifyMessage,
  createErrorMessage,
  isMessageExpired,
  isValidMessage,
  compareMessagePriority,
} from './AgentMessage.js';

describe('AgentMessage', () => {
  describe('MessageAction enum', () => {
    it('should have correct values', () => {
      expect(MessageAction.EXECUTE).toBe('execute');
      expect(MessageAction.QUERY).toBe('query');
      expect(MessageAction.RESPONSE).toBe('response');
      expect(MessageAction.SUBSCRIBE).toBe('subscribe');
      expect(MessageAction.NOTIFY).toBe('notify');
      expect(MessageAction.HEARTBEAT).toBe('heartbeat');
      expect(MessageAction.ERROR).toBe('error');
    });
  });

  describe('MessagePriority enum', () => {
    it('should have correct values', () => {
      expect(MessagePriority.HIGH).toBe(0);
      expect(MessagePriority.NORMAL).toBe(1);
      expect(MessagePriority.LOW).toBe(2);
    });
  });

  describe('DeliveryMode enum', () => {
    it('should have correct values', () => {
      expect(DeliveryMode.ONE_WAY).toBe('one_way');
      expect(DeliveryMode.REQUEST_RESPONSE).toBe('request_response');
      expect(DeliveryMode.BROADCAST).toBe('broadcast');
    });
  });

  describe('MessageFlag enum', () => {
    it('should have correct values', () => {
      expect(MessageFlag.PERSISTENT).toBe('persistent');
      expect(MessageFlag.REDELIVER).toBe('redeliver');
      expect(MessageFlag.PRIORITY).toBe('priority');
      expect(MessageFlag.BATCH).toBe('batch');
    });
  });

  describe('createAgentMessage', () => {
    it('should create message with required fields', () => {
      const message = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: { task: 'test' },
      });

      expect(message.id).toBeDefined();
      expect(message.source).toBe('agent-1');
      expect(message.target).toBe('agent-2');
      expect(message.action).toBe(MessageAction.EXECUTE);
      expect(message.payload).toEqual({ task: 'test' });
      expect(message.timestamp).toBeDefined();
    });

    it('should use custom ID if provided', () => {
      const message = createAgentMessage({
        id: 'custom-id',
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: { task: 'test' },
      });

      expect(message.id).toBe('custom-id');
    });

    it('should set default priority and delivery mode', () => {
      const message = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: { task: 'test' },
      });

      expect(message.priority).toBe(MessagePriority.NORMAL);
      expect(message.deliveryMode).toBe(DeliveryMode.REQUEST_RESPONSE);
    });

    it('should calculate expiresAt when ttl is provided', () => {
      const ttl = 5000;
      const before = Date.now();
      const message = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: { task: 'test' },
        ttl,
      });
      const after = Date.now();

      expect(message.expiresAt).toBeDefined();
      expect(message.expiresAt!).toBeGreaterThanOrEqual(before + ttl);
      expect(message.expiresAt!).toBeLessThanOrEqual(after + ttl);
    });

    it('should set correlationId in metadata', () => {
      const message = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: { task: 'test' },
        correlationId: 'corr-123',
      });

      expect(message.metadata?.correlationId).toBe('corr-123');
    });
  });

  describe('createExecuteMessage', () => {
    it('should create execute message', () => {
      const message = createExecuteMessage('agent-1', 'agent-2', { task: 'execute-me' });

      expect(message.action).toBe(MessageAction.EXECUTE);
      expect(message.source).toBe('agent-1');
      expect(message.target).toBe('agent-2');
      expect(message.payload).toEqual({ task: 'execute-me' });
    });

    it('should accept optional parameters', () => {
      const message = createExecuteMessage('agent-1', 'agent-2', { task: 'test' }, {
        priority: MessagePriority.HIGH,
        correlationId: 'corr-123',
        ttl: 3000,
      });

      expect(message.priority).toBe(MessagePriority.HIGH);
      expect(message.metadata?.correlationId).toBe('corr-123');
      expect(message.expiresAt).toBeDefined();
    });
  });

  describe('createQueryMessage', () => {
    it('should create query message', () => {
      const message = createQueryMessage('agent-1', 'agent-2', { query: 'get-info' });

      expect(message.action).toBe(MessageAction.QUERY);
      expect(message.source).toBe('agent-1');
      expect(message.target).toBe('agent-2');
      expect(message.payload).toEqual({ query: 'get-info' });
    });
  });

  describe('createResponseMessage', () => {
    it('should create response message', () => {
      const message = createResponseMessage('agent-1', 'agent-2', { result: 'success' }, 'corr-123');

      expect(message.action).toBe(MessageAction.RESPONSE);
      expect(message.source).toBe('agent-1');
      expect(message.target).toBe('agent-2');
      expect(message.payload).toEqual({ result: 'success' });
      expect(message.metadata?.correlationId).toBe('corr-123');
    });

    it('should create error response when isError is true', () => {
      const message = createResponseMessage('agent-1', 'agent-2', null, 'corr-123', {
        isError: true,
        error: { code: 'ERR_001', message: 'Error occurred' },
      });

      expect(message.action).toBe(MessageAction.ERROR);
    });
  });

  describe('createHeartbeatMessage', () => {
    it('should create heartbeat message', () => {
      const message = createHeartbeatMessage('agent-1', 'agent-2');

      expect(message.action).toBe(MessageAction.HEARTBEAT);
      expect(message.payload.load).toBe(0);
      expect(message.payload.activeTasks).toBe(0);
      expect(message.payload.completedTasks).toBe(0);
      expect(message.deliveryMode).toBe(DeliveryMode.ONE_WAY);
    });

    it('should accept custom stats', () => {
      const message = createHeartbeatMessage('agent-1', 'agent-2', {
        load: 0.5,
        activeTasks: 3,
        completedTasks: 10,
      });

      expect(message.payload.load).toBe(0.5);
      expect(message.payload.activeTasks).toBe(3);
      expect(message.payload.completedTasks).toBe(10);
    });
  });

  describe('createNotifyMessage', () => {
    it('should create notify message', () => {
      const message = createNotifyMessage('agent-1', 'agent-2', 'task-completed', { taskId: '123' });

      expect(message.action).toBe(MessageAction.NOTIFY);
      expect(message.payload.event).toBe('task-completed');
      expect(message.payload.data).toEqual({ taskId: '123' });
      expect(message.deliveryMode).toBe(DeliveryMode.BROADCAST);
    });
  });

  describe('createErrorMessage', () => {
    it('should create error message', () => {
      const message = createErrorMessage('agent-1', 'agent-2', 'ERR_001', 'Something went wrong');

      expect(message.action).toBe(MessageAction.ERROR);
      expect(message.payload).toBeNull();
      expect(message.priority).toBe(MessagePriority.HIGH);
    });

    it('should include correlation ID when provided', () => {
      const message = createErrorMessage('agent-1', 'agent-2', 'ERR_001', 'Error', 'corr-123');

      expect(message.metadata?.correlationId).toBe('corr-123');
    });

    it('should include error details in headers', () => {
      const details = { stack: 'error stack trace' };
      const message = createErrorMessage('agent-1', 'agent-2', 'ERR_001', 'Error', undefined, details);

      expect(message.metadata?.headers?.['x-error-details']).toBe(JSON.stringify(details));
    });
  });

  describe('isMessageExpired', () => {
    it('should return false if no expiration set', () => {
      const message = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: {},
      });

      expect(isMessageExpired(message)).toBe(false);
    });

    it('should return false if not expired', () => {
      const message = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: {},
        ttl: 10000,
      });

      expect(isMessageExpired(message)).toBe(false);
    });

    it('should return true if expired', () => {
      const message = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: {},
        ttl: -1000,
      });

      expect(isMessageExpired(message)).toBe(true);
    });
  });

  describe('isValidMessage', () => {
    it('should return true for valid message', () => {
      const message = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: { task: 'test' },
      });

      expect(isValidMessage(message)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidMessage(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidMessage('string')).toBe(false);
      expect(isValidMessage(123)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      const invalidMessage = {
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: { task: 'test' },
        priority: MessagePriority.NORMAL,
      } as AgentMessage;

      expect(isValidMessage(invalidMessage)).toBe(false);
    });

    it('should return false for invalid action', () => {
      const invalidMessage = {
        id: 'msg-1',
        source: 'agent-1',
        target: 'agent-2',
        action: 'invalid-action',
        payload: { task: 'test' },
        priority: MessagePriority.NORMAL,
      } as AgentMessage;

      expect(isValidMessage(invalidMessage)).toBe(false);
    });
  });

  describe('compareMessagePriority', () => {
    it('should return negative when a has higher priority', () => {
      const a = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: {},
        priority: MessagePriority.HIGH,
      });
      const b = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: {},
        priority: MessagePriority.NORMAL,
      });

      expect(compareMessagePriority(a, b)).toBeLessThan(0);
    });

    it('should return positive when b has higher priority', () => {
      const a = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: {},
        priority: MessagePriority.NORMAL,
      });
      const b = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: {},
        priority: MessagePriority.HIGH,
      });

      expect(compareMessagePriority(a, b)).toBeGreaterThan(0);
    });

    it('should return 0 for same priority', () => {
      const a = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: {},
        priority: MessagePriority.NORMAL,
      });
      const b = createAgentMessage({
        source: 'agent-1',
        target: 'agent-2',
        action: MessageAction.EXECUTE,
        payload: {},
        priority: MessagePriority.NORMAL,
      });

      expect(compareMessagePriority(a, b)).toBe(0);
    });
  });
});