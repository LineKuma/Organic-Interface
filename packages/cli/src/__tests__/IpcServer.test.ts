/**
 * CLI Package Tests
 *
 * Comprehensive tests for the OI CLI system:
 * - IPC protocol types and environment variable handling
 * - IpcServer host-side socket server with handlers
 * - IpcClient lightweight helper communication
 * - OiHelper command routing and AI terminal guard
 * - History, Macro, and Config commands
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as net from 'node:net';
import * as fs from 'node:fs';

import { IpcServer, type IpcServerContext } from '../host/IpcServer.js';

import type {
  IpcRequest,
  IpcResponse,
  HistoryListResponse,
  HistoryGetResponse,
  HistoryMessageItem,
  MacroResolveResponse,
  MacroPreviewResponse,
  ConfigListResponse,
} from '../types/ipc.js';

import {
  ENV_AI_TERMINAL,
  ENV_CONVERSATION_ID,
  ENV_IPC_SOCKET,
  isAiTerminal,
  getConversationId,
  getSocketPath,
  getDefaultSocketPath,
} from '../types/ipc.js';

// ── Test Helpers ─────────────────────────────────────────────────

/** Generate unique socket path */
function testSocketPath(): string {
  return `/tmp/oi-ipc-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.sock`;
}

/** Sample messages */
const SAMPLE_MESSAGES: HistoryMessageItem[] = [
  {
    index: 1,
    id: 'msg-1',
    senderType: 'system',
    senderName: 'System',
    type: 'system_message',
    content: 'System prompt',
    timestamp: 1000,
  },
  {
    index: 2,
    id: 'msg-2',
    senderType: 'user',
    senderName: 'User',
    type: 'user_message',
    content: 'Hello!',
    timestamp: 2000,
  },
  {
    index: 3,
    id: 'msg-3',
    senderType: 'agent',
    senderName: 'Agent',
    type: 'assistant_message',
    content: 'Hi there!',
    timestamp: 3000,
  },
  {
    index: 4,
    id: 'msg-4',
    senderType: 'user',
    senderName: 'User',
    type: 'user_message',
    content: 'What is 2+2?',
    timestamp: 4000,
  },
  {
    index: 5,
    id: 'msg-5',
    senderType: 'agent',
    senderName: 'Agent',
    type: 'assistant_message',
    content: '2+2 = 4',
    timestamp: 5000,
  },
];

/** Create a test context */
function createTestContext(): IpcServerContext {
  return {
    getContexts: () => [
      {
        contextId: 'ctx_1',
        messageCount: 5,
        firstMessageAt: 1000,
        lastMessageAt: 5000,
        sessionId: 'session-1',
      },
      {
        contextId: 'ctx_2',
        messageCount: 3,
        firstMessageAt: 2000,
        lastMessageAt: 4000,
        sessionId: 'session-2',
      },
    ],
    getMessages: (contextId, range, lastN) => {
      let msgs = [...SAMPLE_MESSAGES].filter(m => {
        // Simulate different contexts
        if (contextId === 'ctx_1') return true;
        if (contextId === 'ctx_2') return m.index <= 3;
        return true;
      });
      if (lastN) msgs = msgs.slice(-lastN);
      if (range) msgs = msgs.slice(range.start ?? 0, range.end);
      return msgs;
    },
    getMessageCount: contextId => {
      if (contextId === 'ctx_1') return 5;
      if (contextId === 'ctx_2') return 3;
      return 0;
    },
    resolveMacro: async (text, _contextId) => ({
      original: text,
      resolved: text.replace('{{system:test}}', 'resolved-content'),
      macroCount: 1,
      allResolved: true,
      unresolvedCount: 0,
    }),
    previewMacro: text => {
      const macros: Array<{ type: string; args: string[]; raw: string }> = [];
      if (text.includes('{{system:test}}')) {
        macros.push({ type: 'system', args: ['test'], raw: '{{system:test}}' });
      }
      return { macros };
    },
    getConfig: key => {
      const config: Record<string, unknown> = {
        'app.name': 'Organic Interface',
        'app.version': '0.1.0',
      };
      return config[key];
    },
    listConfig: () => [
      { key: 'app.name', value: 'Organic Interface', description: 'Application name' },
      { key: 'app.version', value: '0.1.0', description: 'Application version' },
    ],
  };
}

/** Send an IPC request directly to a socket */
function sendRequest(socketPath: string, request: IpcRequest): Promise<IpcResponse> {
  return new Promise(resolve => {
    const client = new net.Socket();
    let data = '';

    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ id: request.id, success: false, error: 'Timeout', errorCode: 'TIMEOUT' });
    }, 3000);

    client.on('data', chunk => {
      data += chunk.toString();
      try {
        const response = JSON.parse(data) as IpcResponse;
        if (response.id === request.id) {
          clearTimeout(timeout);
          client.destroy();
          resolve(response);
        }
      } catch {
        // Wait for more data
      }
    });

    client.on('error', err => {
      clearTimeout(timeout);
      resolve({
        id: request.id,
        success: false,
        error: err.message,
        errorCode: 'CONNECTION_ERROR',
      });
    });

    client.connect(socketPath, () => {
      client.write(JSON.stringify(request) + '\n');
    });
  });
}

// ── Environment Variables ────────────────────────────────────────

describe('Environment Variables', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('should detect AI terminal mode', () => {
    process.env[ENV_AI_TERMINAL] = 'true';
    expect(isAiTerminal()).toBe(true);
  });

  it('should detect non-AI terminal mode', () => {
    delete process.env[ENV_AI_TERMINAL];
    expect(isAiTerminal()).toBe(false);
  });

  it('should get conversation ID', () => {
    process.env[ENV_CONVERSATION_ID] = 'ctx_test_123';
    expect(getConversationId()).toBe('ctx_test_123');
  });

  it('should return undefined for missing conversation ID', () => {
    delete process.env[ENV_CONVERSATION_ID];
    expect(getConversationId()).toBeUndefined();
  });

  it('should get socket path from env', () => {
    process.env[ENV_IPC_SOCKET] = '/custom/path.sock';
    expect(getSocketPath()).toBe('/custom/path.sock');
  });

  it('should return default socket path', () => {
    delete process.env[ENV_IPC_SOCKET];
    const path = getDefaultSocketPath();
    expect(path).toContain('/tmp/oi-ipc-');
  });

  it('should create AI terminal env', () => {
    const env = IpcServer.createAiTerminalEnv('ctx_123', '/tmp/test.sock');
    expect(env[ENV_AI_TERMINAL]).toBe('true');
    expect(env[ENV_CONVERSATION_ID]).toBe('ctx_123');
    expect(env['OI_IPC_SOCKET']).toBe('/tmp/test.sock');
  });
});

// ── IpcServer ────────────────────────────────────────────────────

describe('IpcServer', () => {
  let server: IpcServer;
  let socketPath: string;

  beforeEach(async () => {
    socketPath = testSocketPath();
    server = new IpcServer(socketPath);
    server.setContext(createTestContext());
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    try {
      fs.unlinkSync(socketPath);
    } catch {
      /* ignore */
    }
  });

  it('should start and stop', () => {
    expect(server.getSocketPath()).toBe(socketPath);
  });

  it('should respond to ping', async () => {
    const response = await sendRequest(socketPath, {
      id: 'test-1',
      method: 'ping',
    });
    expect(response.success).toBe(true);
    const data = response.data as { pong: boolean };
    expect(data.pong).toBe(true);
  });

  describe('history.list', () => {
    it('should list contexts', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-2',
        method: 'history.list',
      });
      expect(response.success).toBe(true);
      const data = response.data as HistoryListResponse;
      expect(data.contexts).toHaveLength(2);
      expect(data.contexts[0].contextId).toBe('ctx_1');
    });

    it('should include current context ID', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-3',
        method: 'history.list',
        conversationId: 'ctx_1',
      });
      expect(response.success).toBe(true);
      const data = response.data as HistoryListResponse;
      expect(data.currentContextId).toBe('ctx_1');
    });
  });

  describe('history.get', () => {
    it('should get messages for a context', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-4',
        method: 'history.get',
        params: { contextId: 'ctx_1' },
      });
      expect(response.success).toBe(true);
      const data = response.data as HistoryGetResponse;
      expect(data.totalCount).toBe(5);
      expect(data.messages).toHaveLength(5);
    });

    it('should get last N messages', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-5',
        method: 'history.get',
        params: { contextId: 'ctx_1', lastN: 2 },
      });
      expect(response.success).toBe(true);
      const data = response.data as HistoryGetResponse;
      expect(data.messages).toHaveLength(2);
      expect(data.messages[0].content).toBe('What is 2+2?');
      expect(data.messages[1].content).toBe('2+2 = 4');
    });

    it('should use conversationId from request', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-6',
        method: 'history.get',
        conversationId: 'ctx_2',
      });
      expect(response.success).toBe(true);
      const data = response.data as HistoryGetResponse;
      expect(data.messages).toHaveLength(3);
    });
  });

  describe('history.count', () => {
    it('should count messages', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-7',
        method: 'history.count',
        params: { contextId: 'ctx_1' },
      });
      expect(response.success).toBe(true);
      const data = response.data as { count: number };
      expect(data.count).toBe(5);
    });
  });

  describe('macro.resolve', () => {
    it('should resolve macros', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-8',
        method: 'macro.resolve',
        params: { text: '{{system:test}}' },
      });
      expect(response.success).toBe(true);
      const data = response.data as MacroResolveResponse;
      expect(data.resolved).toBe('resolved-content');
      expect(data.macroCount).toBe(1);
      expect(data.allResolved).toBe(true);
    });

    it('should reject missing text', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-9',
        method: 'macro.resolve',
        params: {},
      });
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('MISSING_PARAM');
    });
  });

  describe('macro.preview', () => {
    it('should preview macros', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-10',
        method: 'macro.preview',
        params: { text: 'Hello {{system:test}} world' },
      });
      expect(response.success).toBe(true);
      const data = response.data as MacroPreviewResponse;
      expect(data.macros).toHaveLength(1);
      expect(data.macros[0].type).toBe('system');
    });
  });

  describe('config.get', () => {
    it('should get a config value', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-11',
        method: 'config.get',
        params: { key: 'app.name' },
      });
      expect(response.success).toBe(true);
      const data = response.data as { key: string; value: unknown };
      expect(data.value).toBe('Organic Interface');
    });

    it('should reject missing key', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-12',
        method: 'config.get',
        params: {},
      });
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('MISSING_PARAM');
    });
  });

  describe('config.list', () => {
    it('should list all config', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-13',
        method: 'config.list',
        params: {},
      });
      expect(response.success).toBe(true);
      const data = response.data as ConfigListResponse;
      expect(data.items).toHaveLength(2);
      expect(data.items[0].key).toBe('app.name');
    });
  });

  describe('unknown method', () => {
    it('should reject unknown methods', async () => {
      const response = await sendRequest(socketPath, {
        id: 'test-14',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        method: 'unknown.method' as any,
      });
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('UNKNOWN_METHOD');
    });
  });
});

// ── IpcServer Without Context ────────────────────────────────────

describe('IpcServer without context', () => {
  let server: IpcServer;
  let socketPath: string;

  beforeEach(async () => {
    socketPath = testSocketPath();
    server = new IpcServer(socketPath);
    // No context set
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    try {
      fs.unlinkSync(socketPath);
    } catch {
      /* ignore */
    }
  });

  it('should return error for history.list without context', async () => {
    const response = await sendRequest(socketPath, {
      id: 'test-20',
      method: 'history.list',
    });
    expect(response.success).toBe(false);
    expect(response.errorCode).toBe('NO_CONTEXT_PROVIDER');
  });

  it('should return error for history.get without context', async () => {
    const response = await sendRequest(socketPath, {
      id: 'test-21',
      method: 'history.get',
      params: { contextId: 'test' },
    });
    expect(response.success).toBe(false);
    expect(response.errorCode).toBe('NO_MESSAGE_PROVIDER');
  });
});

// ── IpcServer Custom Handler ─────────────────────────────────────

describe('IpcServer custom handler', () => {
  let server: IpcServer;
  let socketPath: string;

  beforeEach(async () => {
    socketPath = testSocketPath();
    server = new IpcServer(socketPath);
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    try {
      fs.unlinkSync(socketPath);
    } catch {
      /* ignore */
    }
  });

  it('should register and use custom handler', async () => {
    server.registerHandler('history.list', async () => ({
      success: true,
      data: { custom: 'handler-called' },
    }));

    const response = await sendRequest(socketPath, {
      id: 'test-30',
      method: 'history.list',
    });
    expect(response.success).toBe(true);
    const data = response.data as { custom: string };
    expect(data.custom).toBe('handler-called');
  });
});
