import { describe, it, expect } from 'vitest';
import {
  MessageType,
  MessageStatus,
  MessageFlag,
  ContentFormat,
  AttachmentType,
  createMessage,
  createUserMessage,
  createAssistantMessage,
  createToolCallMessage,
  createToolResponseMessage,
  createSystemMessage,
  createErrorMessage,
  isValidMessage,
} from '../Message.js';
import type { Message, MessageSender, MessageContent, ToolCall, ToolResponse } from '../Message.js';

// Helper: create a minimal valid message
function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    sender: { id: 'user-1', type: 'user', name: 'TestUser' },
    content: { text: 'Hello', format: ContentFormat.PLAIN_TEXT },
    type: MessageType.USER_MESSAGE,
    timestamp: 1000,
    status: MessageStatus.SENT,
    flags: [],
    ...overrides,
  };
}

describe('Message', () => {
  // ===================== MessageType enum =====================
  describe('MessageType enum', () => {
    it('should have USER_MESSAGE value', () => {
      expect(MessageType.USER_MESSAGE).toBe('user_message');
    });

    it('should have ASSISTANT_MESSAGE value', () => {
      expect(MessageType.ASSISTANT_MESSAGE).toBe('assistant_message');
    });

    it('should have SYSTEM_MESSAGE value', () => {
      expect(MessageType.SYSTEM_MESSAGE).toBe('system_message');
    });

    it('should have TOOL_CALL value', () => {
      expect(MessageType.TOOL_CALL).toBe('tool_call');
    });

    it('should have TOOL_RESPONSE value', () => {
      expect(MessageType.TOOL_RESPONSE).toBe('tool_response');
    });

    it('should have ERROR_MESSAGE value', () => {
      expect(MessageType.ERROR_MESSAGE).toBe('error_message');
    });

    it('should have STATUS_UPDATE value', () => {
      expect(MessageType.STATUS_UPDATE).toBe('status_update');
    });

    it('should have exactly 7 values', () => {
      expect(Object.values(MessageType)).toHaveLength(7);
    });
  });

  // ===================== MessageStatus enum =====================
  describe('MessageStatus enum', () => {
    it('should have SENDING value', () => {
      expect(MessageStatus.SENDING).toBe('sending');
    });

    it('should have SENT value', () => {
      expect(MessageStatus.SENT).toBe('sent');
    });

    it('should have DELIVERED value', () => {
      expect(MessageStatus.DELIVERED).toBe('delivered');
    });

    it('should have READ value', () => {
      expect(MessageStatus.READ).toBe('read');
    });

    it('should have FAILED value', () => {
      expect(MessageStatus.FAILED).toBe('failed');
    });

    it('should have exactly 5 values', () => {
      expect(Object.values(MessageStatus)).toHaveLength(5);
    });
  });

  // ===================== MessageFlag enum =====================
  describe('MessageFlag enum', () => {
    it('should have FLAGGED value', () => {
      expect(MessageFlag.FLAGGED).toBe('flagged');
    });

    it('should have STARRED value', () => {
      expect(MessageFlag.STARRED).toBe('starred');
    });

    it('should have DELETED value', () => {
      expect(MessageFlag.DELETED).toBe('deleted');
    });

    it('should have ARCHIVED value', () => {
      expect(MessageFlag.ARCHIVED).toBe('archived');
    });

    it('should have PRIVATE value', () => {
      expect(MessageFlag.PRIVATE).toBe('private');
    });

    it('should have exactly 5 values', () => {
      expect(Object.values(MessageFlag)).toHaveLength(5);
    });
  });

  // ===================== ContentFormat enum =====================
  describe('ContentFormat enum', () => {
    it('should have PLAIN_TEXT value', () => {
      expect(ContentFormat.PLAIN_TEXT).toBe('plain_text');
    });

    it('should have MARKDOWN value', () => {
      expect(ContentFormat.MARKDOWN).toBe('markdown');
    });

    it('should have HTML value', () => {
      expect(ContentFormat.HTML).toBe('html');
    });

    it('should have JSON value', () => {
      expect(ContentFormat.JSON).toBe('json');
    });

    it('should have CODE value', () => {
      expect(ContentFormat.CODE).toBe('code');
    });

    it('should have exactly 5 values', () => {
      expect(Object.values(ContentFormat)).toHaveLength(5);
    });
  });

  // ===================== AttachmentType enum =====================
  describe('AttachmentType enum', () => {
    it('should have IMAGE value', () => {
      expect(AttachmentType.IMAGE).toBe('image');
    });

    it('should have VIDEO value', () => {
      expect(AttachmentType.VIDEO).toBe('video');
    });

    it('should have AUDIO value', () => {
      expect(AttachmentType.AUDIO).toBe('audio');
    });

    it('should have DOCUMENT value', () => {
      expect(AttachmentType.DOCUMENT).toBe('document');
    });

    it('should have CODE_FILE value', () => {
      expect(AttachmentType.CODE_FILE).toBe('code_file');
    });

    it('should have OTHER value', () => {
      expect(AttachmentType.OTHER).toBe('other');
    });

    it('should have exactly 6 values', () => {
      expect(Object.values(AttachmentType)).toHaveLength(6);
    });
  });

  // ===================== createMessage =====================
  describe('createMessage', () => {
    it('should create message with basic fields', () => {
      const sender: MessageSender = { id: 'u1', type: 'user', name: 'Alice' };
      const content: MessageContent = { text: 'Hi', format: ContentFormat.PLAIN_TEXT };
      const msg = createMessage({
        sender,
        content,
        type: MessageType.USER_MESSAGE,
      });

      expect(msg.sender).toEqual(sender);
      expect(msg.content).toEqual(content);
      expect(msg.type).toBe(MessageType.USER_MESSAGE);
    });

    it('should auto-generate ID with msg_ prefix', () => {
      const msg = createMessage({
        sender: { id: 'u1', type: 'user', name: 'Alice' },
        content: { text: 'Hi', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
      });

      expect(msg.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const msg1 = createMessage({
        sender: { id: 'u1', type: 'user', name: 'Alice' },
        content: { text: 'a', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
      });
      const msg2 = createMessage({
        sender: { id: 'u1', type: 'user', name: 'Alice' },
        content: { text: 'b', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
      });

      expect(msg1.id).not.toBe(msg2.id);
    });

    it('should set timestamp to current time', () => {
      const before = Date.now();
      const msg = createMessage({
        sender: { id: 'u1', type: 'user', name: 'Alice' },
        content: { text: 'Hi', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
      });
      const after = Date.now();

      expect(msg.timestamp).toBeGreaterThanOrEqual(before);
      expect(msg.timestamp).toBeLessThanOrEqual(after);
    });

    it('should default status to SENDING', () => {
      const msg = createMessage({
        sender: { id: 'u1', type: 'user', name: 'Alice' },
        content: { text: 'Hi', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
      });

      expect(msg.status).toBe(MessageStatus.SENDING);
    });

    it('should default flags to empty array', () => {
      const msg = createMessage({
        sender: { id: 'u1', type: 'user', name: 'Alice' },
        content: { text: 'Hi', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
      });

      expect(msg.flags).toEqual([]);
    });

    it('should set tool_call when provided', () => {
      const toolCall: ToolCall = { name: 'readFile', params: { path: '/f' } };
      const msg = createMessage({
        sender: { id: 'u1', type: 'agent', name: 'Bot' },
        content: { text: 'Calling tool', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.TOOL_CALL,
        tool_call: toolCall,
      });

      expect(msg.tool_call).toEqual(toolCall);
    });

    it('should set tool_response when provided', () => {
      const toolResp: ToolResponse = { name: 'readFile', success: true };
      const msg = createMessage({
        sender: { id: 'u1', type: 'system', name: 'Sys' },
        content: { text: 'Done', format: ContentFormat.JSON },
        type: MessageType.TOOL_RESPONSE,
        tool_response: toolResp,
      });

      expect(msg.tool_response).toEqual(toolResp);
    });

    it('should set reply_to when provided', () => {
      const msg = createMessage({
        sender: { id: 'u1', type: 'user', name: 'Alice' },
        content: { text: 'Hi', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
        reply_to: 'msg-other',
      });

      expect(msg.reply_to).toBe('msg-other');
    });

    it('should set context_id when provided', () => {
      const msg = createMessage({
        sender: { id: 'u1', type: 'user', name: 'Alice' },
        content: { text: 'Hi', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
        context_id: 'ctx-abc',
      });

      expect(msg.context_id).toBe('ctx-abc');
    });

    it('should set metadata when provided', () => {
      const meta = { key: 'value', count: 42 };
      const msg = createMessage({
        sender: { id: 'u1', type: 'user', name: 'Alice' },
        content: { text: 'Hi', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
        metadata: meta,
      });

      expect(msg.metadata).toEqual(meta);
    });

    it('should not set optional fields by default', () => {
      const msg = createMessage({
        sender: { id: 'u1', type: 'user', name: 'Alice' },
        content: { text: 'Hi', format: ContentFormat.PLAIN_TEXT },
        type: MessageType.USER_MESSAGE,
      });

      expect(msg.tool_call).toBeUndefined();
      expect(msg.tool_response).toBeUndefined();
      expect(msg.reply_to).toBeUndefined();
      expect(msg.context_id).toBeUndefined();
      expect(msg.metadata).toBeUndefined();
    });
  });

  // ===================== createUserMessage =====================
  describe('createUserMessage', () => {
    it('should create user message with correct type', () => {
      const msg = createUserMessage('u1', 'Alice', 'Hello');

      expect(msg.type).toBe(MessageType.USER_MESSAGE);
    });

    it('should set sender type to user', () => {
      const msg = createUserMessage('u1', 'Alice', 'Hello');

      expect(msg.sender.type).toBe('user');
      expect(msg.sender.id).toBe('u1');
      expect(msg.sender.name).toBe('Alice');
    });

    it('should set content text and format', () => {
      const msg = createUserMessage('u1', 'Alice', 'Hello world');

      expect(msg.content.text).toBe('Hello world');
      expect(msg.content.format).toBe(ContentFormat.PLAIN_TEXT);
    });

    it('should set context_id when provided', () => {
      const msg = createUserMessage('u1', 'Alice', 'Hello', 'ctx-1');

      expect(msg.context_id).toBe('ctx-1');
    });

    it('should not set context_id when not provided', () => {
      const msg = createUserMessage('u1', 'Alice', 'Hello');

      expect(msg.context_id).toBeUndefined();
    });

    it('should default status to SENDING', () => {
      const msg = createUserMessage('u1', 'Alice', 'Hello');

      expect(msg.status).toBe(MessageStatus.SENDING);
    });
  });

  // ===================== createAssistantMessage =====================
  describe('createAssistantMessage', () => {
    it('should create assistant message with correct type', () => {
      const msg = createAssistantMessage('agent-1', 'Bot', 'Response');

      expect(msg.type).toBe(MessageType.ASSISTANT_MESSAGE);
    });

    it('should set sender type to agent', () => {
      const msg = createAssistantMessage('agent-1', 'Bot', 'Response');

      expect(msg.sender.type).toBe('agent');
      expect(msg.sender.id).toBe('agent-1');
      expect(msg.sender.name).toBe('Bot');
    });

    it('should set content text and PLAIN_TEXT format', () => {
      const msg = createAssistantMessage('agent-1', 'Bot', 'Here is the answer');

      expect(msg.content.text).toBe('Here is the answer');
      expect(msg.content.format).toBe(ContentFormat.PLAIN_TEXT);
    });

    it('should set context_id when provided', () => {
      const msg = createAssistantMessage('agent-1', 'Bot', 'Response', 'ctx-2');

      expect(msg.context_id).toBe('ctx-2');
    });
  });

  // ===================== createToolCallMessage =====================
  describe('createToolCallMessage', () => {
    it('should create message with TOOL_CALL type', () => {
      const msg = createToolCallMessage('a1', 'Bot', 'readFile', { path: '/f' });

      expect(msg.type).toBe(MessageType.TOOL_CALL);
    });

    it('should set sender type to agent', () => {
      const msg = createToolCallMessage('a1', 'Bot', 'readFile', {});

      expect(msg.sender.type).toBe('agent');
      expect(msg.sender.id).toBe('a1');
      expect(msg.sender.name).toBe('Bot');
    });

    it('should set tool_call with name and params', () => {
      const params = { path: '/test', encoding: 'utf8' };
      const msg = createToolCallMessage('a1', 'Bot', 'readFile', params);

      expect(msg.tool_call).toEqual({ name: 'readFile', params });
    });

    it('should set content text mentioning the tool name', () => {
      const msg = createToolCallMessage('a1', 'Bot', 'execute', {});

      expect(msg.content.text).toContain('execute');
      expect(msg.content.text).toContain('Calling tool');
      expect(msg.content.format).toBe(ContentFormat.PLAIN_TEXT);
    });

    it('should set context_id when provided', () => {
      const msg = createToolCallMessage('a1', 'Bot', 'readFile', {}, 'ctx-tool');

      expect(msg.context_id).toBe('ctx-tool');
    });
  });

  // ===================== createToolResponseMessage =====================
  describe('createToolResponseMessage', () => {
    it('should create message with TOOL_RESPONSE type', () => {
      const response: ToolResponse = { name: 'readFile', success: true, data: 'content' };
      const msg = createToolResponseMessage('s1', 'System', response);

      expect(msg.type).toBe(MessageType.TOOL_RESPONSE);
    });

    it('should set sender type to system', () => {
      const response: ToolResponse = { name: 'readFile', success: true };
      const msg = createToolResponseMessage('s1', 'System', response);

      expect(msg.sender.type).toBe('system');
    });

    it('should include success text for successful response', () => {
      const response: ToolResponse = { name: 'readFile', success: true };
      const msg = createToolResponseMessage('s1', 'System', response);

      expect(msg.content.text).toContain('succeeded');
      expect(msg.content.text).toContain('readFile');
    });

    it('should include failure text for failed response', () => {
      const response: ToolResponse = {
        name: 'writeFile',
        success: false,
        error: 'permission denied',
      };
      const msg = createToolResponseMessage('s1', 'System', response);

      expect(msg.content.text).toContain('failed');
      expect(msg.content.text).toContain('writeFile');
    });

    it('should set content format to JSON', () => {
      const response: ToolResponse = { name: 'readFile', success: true };
      const msg = createToolResponseMessage('s1', 'System', response);

      expect(msg.content.format).toBe(ContentFormat.JSON);
    });

    it('should set structured_data with response', () => {
      const response: ToolResponse = { name: 'readFile', success: true, data: 'content' };
      const msg = createToolResponseMessage('s1', 'System', response);

      expect(msg.content.structured_data).toEqual({ response });
    });

    it('should set tool_response on the message', () => {
      const response: ToolResponse = {
        name: 'readFile',
        success: true,
        execution_time: 150,
      };
      const msg = createToolResponseMessage('s1', 'System', response);

      expect(msg.tool_response).toEqual(response);
    });

    it('should preserve original tool_call when provided', () => {
      const response: ToolResponse = { name: 'readFile', success: true };
      const originalCall: ToolCall = { name: 'readFile', params: { path: '/f' }, call_id: 'c1' };
      const msg = createToolResponseMessage('s1', 'System', response, originalCall);

      expect(msg.tool_call).toEqual(originalCall);
    });

    it('should set context_id when provided', () => {
      const response: ToolResponse = { name: 'readFile', success: true };
      const msg = createToolResponseMessage('s1', 'System', response, undefined, 'ctx-resp');

      expect(msg.context_id).toBe('ctx-resp');
    });
  });

  // ===================== createSystemMessage =====================
  describe('createSystemMessage', () => {
    it('should create message with SYSTEM_MESSAGE type', () => {
      const msg = createSystemMessage('System notification');

      expect(msg.type).toBe(MessageType.SYSTEM_MESSAGE);
    });

    it('should set sender id to system', () => {
      const msg = createSystemMessage('Notification');

      expect(msg.sender.id).toBe('system');
    });

    it('should set sender type to system', () => {
      const msg = createSystemMessage('Notification');

      expect(msg.sender.type).toBe('system');
    });

    it('should set sender name to System', () => {
      const msg = createSystemMessage('Notification');

      expect(msg.sender.name).toBe('System');
    });

    it('should set content text', () => {
      const msg = createSystemMessage('Important system message');

      expect(msg.content.text).toBe('Important system message');
      expect(msg.content.format).toBe(ContentFormat.PLAIN_TEXT);
    });

    it('should set context_id when provided', () => {
      const msg = createSystemMessage('Notification', 'ctx-sys');

      expect(msg.context_id).toBe('ctx-sys');
    });
  });

  // ===================== createErrorMessage =====================
  describe('createErrorMessage', () => {
    it('should create message with ERROR_MESSAGE type', () => {
      const msg = createErrorMessage('s1', 'System', 'Something went wrong');

      expect(msg.type).toBe(MessageType.ERROR_MESSAGE);
    });

    it('should set sender type to system', () => {
      const msg = createErrorMessage('s1', 'ErrorHandler', 'Error');

      expect(msg.sender.type).toBe('system');
      expect(msg.sender.id).toBe('s1');
      expect(msg.sender.name).toBe('ErrorHandler');
    });

    it('should set content text to error message', () => {
      const msg = createErrorMessage('s1', 'Sys', 'File not found: /path/to/file');

      expect(msg.content.text).toBe('File not found: /path/to/file');
      expect(msg.content.format).toBe(ContentFormat.PLAIN_TEXT);
    });

    it('should set context_id when provided', () => {
      const msg = createErrorMessage('s1', 'Sys', 'Error', 'ctx-err');

      expect(msg.context_id).toBe('ctx-err');
    });

    it('should not set context_id when not provided', () => {
      const msg = createErrorMessage('s1', 'Sys', 'Error');

      expect(msg.context_id).toBeUndefined();
    });
  });

  // ===================== isValidMessage =====================
  describe('isValidMessage', () => {
    it('should return true for valid message', () => {
      expect(isValidMessage(makeMsg())).toBe(true);
    });

    it('should return true for message with all optional fields', () => {
      const msg = makeMsg({
        tool_call: { name: 'test', params: {} },
        tool_response: { name: 'test', success: true },
        reply_to: 'msg-other',
        context_id: 'ctx-1',
        metadata: { key: 'value' },
      });
      expect(isValidMessage(msg)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidMessage(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidMessage(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isValidMessage('not an object')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isValidMessage(42)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isValidMessage({})).toBe(false);
    });

    it('should return false for array', () => {
      expect(isValidMessage([])).toBe(false);
    });

    it('should return false when id is missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _, ...noId } = makeMsg();
      expect(isValidMessage(noId)).toBe(false);
    });

    it('should return false when id is not a string', () => {
      expect(isValidMessage(makeMsg({ id: 123 as unknown as string }))).toBe(false);
    });

    it('should return false when sender is missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { sender: _, ...noSender } = makeMsg();
      expect(isValidMessage(noSender)).toBe(false);
    });

    it('should return false when sender is not an object', () => {
      expect(isValidMessage(makeMsg({ sender: 'not object' as unknown as MessageSender }))).toBe(
        false
      );
    });

    it('should return false when content is missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content: _, ...noContent } = makeMsg();
      expect(isValidMessage(noContent)).toBe(false);
    });

    it('should return false when content is not an object', () => {
      expect(isValidMessage(makeMsg({ content: 'text' as unknown as MessageContent }))).toBe(false);
    });

    it('should return false when type is invalid', () => {
      expect(isValidMessage(makeMsg({ type: 'invalid' as MessageType }))).toBe(false);
    });

    it('should accept all valid MessageType values', () => {
      for (const type of Object.values(MessageType)) {
        expect(isValidMessage(makeMsg({ type }))).toBe(true);
      }
    });
  });
});
