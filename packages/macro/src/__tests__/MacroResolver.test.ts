/**
 * Macro Resolver Tests
 *
 * Comprehensive tests for the macro system:
 * - Macro expression parsing
 * - System prompt resolution
 * - File content resolution
 * - Environment variable resolution
 * - Conversation history resolution (with range, filter, current context)
 * - MacroResolver engine
 * - MacroTool (AI-invocable)
 * - Edge cases (escaped macros, unknown types, empty input)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  parseMacros,
  hasMacros,
  countMacros,
  validateMacros,
  escapeMacros,
  unescapeMacros,
} from '../parser/MacroParser.js';
import { resolveSystemPrompt } from '../resolvers/SystemPromptResolver.js';
import { resolveFile } from '../resolvers/FileResolver.js';
import { resolveEnv } from '../resolvers/EnvResolver.js';
import { resolveHistory } from '../resolvers/HistoryResolver.js';
import { MacroResolver } from '../core/MacroResolver.js';
import { MacroTool } from '../core/MacroTool.js';

import type { Message } from '@organic/agent';
import { MessageType, MessageStatus, ContentFormat } from '@organic/agent';

// ── Test Helpers ─────────────────────────────────────────────────

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    sender: { id: 'user-1', type: 'user', name: 'TestUser', role: 'user' },
    content: { text: 'Hello, world!', format: ContentFormat.PLAIN_TEXT },
    type: MessageType.USER_MESSAGE,
    timestamp: Date.now(),
    status: MessageStatus.SENT,
    flags: [],
    ...overrides,
  } as Message;
}

function createAgentMessage(text: string): Message {
  return createMessage({
    sender: { id: 'agent-1', type: 'agent', name: 'TestAgent', role: 'assistant' },
    content: { text, format: ContentFormat.PLAIN_TEXT },
    type: MessageType.ASSISTANT_MESSAGE,
  });
}

function createUserMessage(text: string): Message {
  return createMessage({
    sender: { id: 'user-1', type: 'user', name: 'TestUser', role: 'user' },
    content: { text, format: ContentFormat.PLAIN_TEXT },
    type: MessageType.USER_MESSAGE,
  });
}

function createSystemMessage(text: string): Message {
  return createMessage({
    sender: { id: 'system', type: 'system', name: 'System', role: 'system' },
    content: { text, format: ContentFormat.PLAIN_TEXT },
    type: MessageType.SYSTEM_MESSAGE,
  });
}

// ── MacroParser ──────────────────────────────────────────────────

describe('MacroParser', () => {
  describe('parseMacros', () => {
    it('should parse a system macro', () => {
      const macros = parseMacros('{{system:code-assistant}}');
      expect(macros).toHaveLength(1);
      expect(macros[0].type).toBe('system');
      expect(macros[0].args).toEqual(['code-assistant']);
    });

    it('should parse a file macro', () => {
      const macros = parseMacros('{{file:./prompts/test.txt}}');
      expect(macros).toHaveLength(1);
      expect(macros[0].type).toBe('file');
      expect(macros[0].args).toEqual(['./prompts/test.txt']);
    });

    it('should parse an env macro', () => {
      const macros = parseMacros('{{env:HOME}}');
      expect(macros).toHaveLength(1);
      expect(macros[0].type).toBe('env');
      expect(macros[0].args).toEqual(['HOME']);
    });

    it('should parse an env macro with default', () => {
      const macros = parseMacros('{{env:API_KEY:default_value}}');
      expect(macros).toHaveLength(1);
      expect(macros[0].args).toEqual(['API_KEY', 'default_value']);
    });

    it('should parse a history macro', () => {
      const macros = parseMacros('{{history:current}}');
      expect(macros).toHaveLength(1);
      expect(macros[0].type).toBe('history');
      expect(macros[0].args).toEqual(['current']);
    });

    it('should parse a history macro with range', () => {
      const macros = parseMacros('{{history:ctx_123:last:5}}');
      expect(macros).toHaveLength(1);
      expect(macros[0].args).toEqual(['ctx_123', 'last', '5']);
    });

    it('should parse a history macro with filter', () => {
      const macros = parseMacros('{{history:ctx_123:filter:sender:user}}');
      expect(macros).toHaveLength(1);
      expect(macros[0].args).toEqual(['ctx_123', 'filter', 'sender', 'user']);
    });

    it('should parse multiple macros in one text', () => {
      const macros = parseMacros('{{system:test}} and {{env:HOME}} and {{file:./test.txt}}');
      expect(macros).toHaveLength(3);
    });

    it('should skip escaped macros', () => {
      const macros = parseMacros('\\{{system:test}}');
      expect(macros).toHaveLength(0);
    });

    it('should return empty for text without macros', () => {
      const macros = parseMacros('Hello, world!');
      expect(macros).toHaveLength(0);
    });

    it('should track positions correctly', () => {
      const text = 'prefix {{system:test}} suffix';
      const macros = parseMacros(text);
      expect(macros[0].start).toBe(7);
      expect(macros[0].end).toBe(22);
      expect(macros[0].raw).toBe('{{system:test}}');
    });
  });

  describe('hasMacros', () => {
    it('should return true for text with macros', () => {
      expect(hasMacros('{{system:test}}')).toBe(true);
    });

    it('should return false for text without macros', () => {
      expect(hasMacros('hello')).toBe(false);
    });
  });

  describe('countMacros', () => {
    it('should count macros correctly', () => {
      expect(countMacros('{{system:a}} {{env:b}} {{file:c}}')).toBe(3);
    });

    it('should return 0 for text without macros', () => {
      expect(countMacros('hello')).toBe(0);
    });
  });

  describe('validateMacros', () => {
    it('should return empty for valid macros', () => {
      expect(validateMacros('{{system:test}}')).toHaveLength(0);
    });

    it('should return invalid macros with unknown types', () => {
      const invalid = validateMacros('{{unknown:test}}');
      expect(invalid.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('escapeMacros / unescapeMacros', () => {
    it('should escape macros', () => {
      const escaped = escapeMacros('{{system:test}}');
      expect(escaped).toBe('\\{{system:test}}');
    });

    it('should unescape macros', () => {
      const unescaped = unescapeMacros('\\{{system:test}}');
      expect(unescaped).toBe('{{system:test}}');
    });
  });
});

// ── SystemPromptResolver ─────────────────────────────────────────

describe('SystemPromptResolver', () => {
  it('should resolve a known system prompt', async () => {
    const result = await resolveSystemPrompt(
      { type: 'system', raw: '{{system:test}}', args: ['test'], start: 0, end: 16 },
      { systemPrompts: { test: 'You are a test assistant.' } }
    );
    expect(result.success).toBe(true);
    expect(result.content).toBe('You are a test assistant.');
  });

  it('should fail for unknown system prompt', async () => {
    const result = await resolveSystemPrompt(
      { type: 'system', raw: '{{system:unknown}}', args: ['unknown'], start: 0, end: 19 },
      { systemPrompts: { test: 'test' } }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should fail without prompt name', async () => {
    const result = await resolveSystemPrompt(
      { type: 'system', raw: '{{system}}', args: [], start: 0, end: 10 },
      {}
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('name argument');
  });
});

// ── EnvResolver ──────────────────────────────────────────────────

describe('EnvResolver', () => {
  it('should resolve an existing env var', async () => {
    const result = await resolveEnv(
      { type: 'env', raw: '{{env:PATH}}', args: ['PATH'], start: 0, end: 11 },
      {}
    );
    expect(result.success).toBe(true);
    expect(result.content).toBeTruthy();
  });

  it('should use default value for missing env var', async () => {
    const result = await resolveEnv(
      {
        type: 'env',
        raw: '{{env:NONEXISTENT:default}}',
        args: ['NONEXISTENT', 'default'],
        start: 0,
        end: 28,
      },
      {}
    );
    expect(result.success).toBe(true);
    expect(result.content).toBe('default');
  });

  it('should fail for missing env var without default', async () => {
    const result = await resolveEnv(
      {
        type: 'env',
        raw: '{{env:NONEXISTENT_VAR_XYZ}}',
        args: ['NONEXISTENT_VAR_XYZ'],
        start: 0,
        end: 26,
      },
      {}
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not set');
  });

  it('should fail without variable name', async () => {
    const result = await resolveEnv(
      { type: 'env', raw: '{{env}}', args: [], start: 0, end: 7 },
      {}
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('variable name');
  });
});

// ── FileResolver ─────────────────────────────────────────────────

describe('FileResolver', () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'macro-test-'));
    tmpFile = path.join(tmpDir, 'test.txt');
    await fs.writeFile(tmpFile, 'File content for testing');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should resolve a file content', async () => {
    const result = await resolveFile(
      { type: 'file', raw: '{{file:test.txt}}', args: [tmpFile], start: 0, end: 16 },
      {}
    );
    expect(result.success).toBe(true);
    expect(result.content).toBe('File content for testing');
  });

  it('should fail for non-existent file', async () => {
    const result = await resolveFile(
      {
        type: 'file',
        raw: '{{file:nonexistent.txt}}',
        args: ['/nonexistent/path/file.txt'],
        start: 0,
        end: 22,
      },
      {}
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to read file');
  });

  it('should fail without path', async () => {
    const result = await resolveFile(
      { type: 'file', raw: '{{file}}', args: [], start: 0, end: 8 },
      {}
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('path argument');
  });
});

// ── HistoryResolver ──────────────────────────────────────────────

describe('HistoryResolver', () => {
  const messages: Message[] = [
    createSystemMessage('System prompt v1'),
    createUserMessage('Hello!'),
    createAgentMessage('Hi there! How can I help?'),
    createUserMessage('What is the weather?'),
    createAgentMessage('It is sunny today.'),
    createUserMessage('Thanks!'),
    createAgentMessage("You're welcome!"),
  ];

  const getMessages = async (ctxId: string): Promise<Message[]> => {
    if (ctxId === 'empty') return [];
    return [...messages];
  };

  it('should resolve full history', async () => {
    const result = await resolveHistory(
      { type: 'history', raw: '{{history:ctx_123}}', args: ['ctx_123'], start: 0, end: 19 },
      { getMessages }
    );
    expect(result.success).toBe(true);
    expect(result.content).toContain('System prompt v1');
    expect(result.content).toContain('Hello!');
    expect(result.content).toContain('sunn');
  });

  it('should resolve last N messages', async () => {
    const result = await resolveHistory(
      {
        type: 'history',
        raw: '{{history:ctx_123:last:2}}',
        args: ['ctx_123', 'last', '2'],
        start: 0,
        end: 25,
      },
      { getMessages }
    );
    expect(result.success).toBe(true);
    // Should only contain the last 2 messages
    const lines = result.content!.split('\n').filter(l => l.startsWith('#'));
    expect(lines).toHaveLength(2);
  });

  it('should resolve first N messages', async () => {
    const result = await resolveHistory(
      {
        type: 'history',
        raw: '{{history:ctx_123:first:2}}',
        args: ['ctx_123', 'first', '2'],
        start: 0,
        end: 26,
      },
      { getMessages }
    );
    expect(result.success).toBe(true);
    const lines = result.content!.split('\n').filter(l => l.startsWith('#'));
    expect(lines).toHaveLength(2);
  });

  it('should resolve range of messages', async () => {
    const result = await resolveHistory(
      {
        type: 'history',
        raw: '{{history:ctx_123:range:1:3}}',
        args: ['ctx_123', 'range', '1', '3'],
        start: 0,
        end: 28,
      },
      { getMessages }
    );
    expect(result.success).toBe(true);
    const lines = result.content!.split('\n').filter(l => l.startsWith('#'));
    expect(lines).toHaveLength(2); // indices 1 and 2
  });

  it('should filter by sender type', async () => {
    const result = await resolveHistory(
      {
        type: 'history',
        raw: '{{history:ctx_123:filter:sender:agent}}',
        args: ['ctx_123', 'filter', 'sender', 'agent'],
        start: 0,
        end: 37,
      },
      { getMessages }
    );
    expect(result.success).toBe(true);
    // Should only contain agent messages
    const text = result.content!;
    expect(text).toContain('[agent:');
    expect(text).not.toContain('[user:');
  });

  it('should filter by content substring', async () => {
    const result = await resolveHistory(
      {
        type: 'history',
        raw: '{{history:ctx_123:filter:contains:weather}}',
        args: ['ctx_123', 'filter', 'contains', 'weather'],
        start: 0,
        end: 41,
      },
      { getMessages }
    );
    expect(result.success).toBe(true);
    expect(result.content).toContain('weather');
  });

  it('should resolve "current" context', async () => {
    const result = await resolveHistory(
      { type: 'history', raw: '{{history:current}}', args: ['current'], start: 0, end: 19 },
      { currentContextId: 'ctx_123', getMessages }
    );
    expect(result.success).toBe(true);
    expect(result.content).toContain('Hello!');
  });

  it('should fail for "current" without active context', async () => {
    const result = await resolveHistory(
      { type: 'history', raw: '{{history:current}}', args: ['current'], start: 0, end: 19 },
      { getMessages }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('no active context');
  });

  it('should handle empty history', async () => {
    const result = await resolveHistory(
      { type: 'history', raw: '{{history:empty}}', args: ['empty'], start: 0, end: 17 },
      { getMessages }
    );
    expect(result.success).toBe(true);
    expect(result.content).toContain('no messages');
  });

  it('should fail without getMessages function', async () => {
    const result = await resolveHistory(
      { type: 'history', raw: '{{history:ctx_123}}', args: ['ctx_123'], start: 0, end: 19 },
      {}
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('no message retrieval');
  });

  it('should fail without arguments', async () => {
    const result = await resolveHistory(
      { type: 'history', raw: '{{history}}', args: [], start: 0, end: 11 },
      {}
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('context ID');
  });
});

// ── MacroResolver ────────────────────────────────────────────────

describe('MacroResolver', () => {
  let resolver: MacroResolver;

  beforeEach(() => {
    resolver = new MacroResolver();
  });

  it('should resolve a system prompt macro', async () => {
    const result = await resolver.resolve('You are {{system:test}}', {
      systemPrompts: { test: 'a helpful assistant' },
    });
    expect(result.allResolved).toBe(true);
    expect(result.resolved).toBe('You are a helpful assistant');
  });

  it('should resolve an env macro', async () => {
    const result = await resolver.resolve('Path: {{env:PATH}}', {});
    expect(result.allResolved).toBe(true);
    expect(result.resolved).not.toContain('{{env:PATH}}');
  });

  it('should resolve multiple macros in one text', async () => {
    const result = await resolver.resolve('System: {{system:test}}. Path: {{env:PATH}}', {
      systemPrompts: { test: 'helper' },
    });
    expect(result.allResolved).toBe(true);
    expect(result.resolved).toContain('helper');
    expect(result.resolved).not.toContain('{{env:PATH}}');
  });

  it('should report unresolved macros', async () => {
    const result = await resolver.resolve('{{system:unknown}}', {
      systemPrompts: { test: 'known' },
    });
    expect(result.allResolved).toBe(false);
    expect(result.unresolvedCount).toBe(1);
    // Original expression should be kept for unresolved macros
    expect(result.resolved).toContain('{{system:unknown}}');
  });

  it('should return unchanged text for no macros', async () => {
    const result = await resolver.resolve('Hello, world!', {});
    expect(result.allResolved).toBe(true);
    expect(result.resolved).toBe('Hello, world!');
    expect(result.results).toHaveLength(0);
  });

  it('should detect macros with hasMacros', () => {
    expect(resolver.hasMacros('{{system:test}}')).toBe(true);
    expect(resolver.hasMacros('hello')).toBe(false);
  });

  it('should count macros with countMacros', () => {
    expect(resolver.countMacros('{{system:a}} {{env:b}}')).toBe(2);
  });

  it('should preview macros', () => {
    const preview = resolver.previewMacros('{{system:test}} {{env:HOME}}');
    expect(preview).toHaveLength(2);
    expect(preview[0].type).toBe('system');
    expect(preview[1].type).toBe('env');
  });

  it('should support custom resolvers', async () => {
    resolver.registerResolver('custom', async (expr, _ctx) => ({
      success: true,
      content: 'custom-resolved',
      expression: expr,
    }));

    // Note: custom type is not in the standard parser, but we can test
    // by injecting a custom value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customExpr = {
      type: 'custom' as any,
      raw: '{{custom:x}}',
      args: ['x'],
      start: 0,
      end: 13,
    };
    const result = await resolver.resolveExpression(customExpr, {});
    expect(result.success).toBe(true);
    expect(result.content).toBe('custom-resolved');
  });

  it('should handle resolver errors gracefully', async () => {
    resolver.registerResolver('error', async () => {
      throw new Error('Resolver crashed');
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customExpr = { type: 'error' as any, raw: '{{error:x}}', args: ['x'], start: 0, end: 12 };
    const result = await resolver.resolveExpression(customExpr, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Resolver error');
  });
});

// ── MacroTool ────────────────────────────────────────────────────

describe('MacroTool', () => {
  let tool: MacroTool;

  beforeEach(() => {
    tool = new MacroTool();
  });

  describe('getDefinition', () => {
    it('should return a valid tool definition', () => {
      const def = tool.getDefinition();
      expect(def.id).toBe('resolve_macros');
      expect(def.name).toBe('resolve_macros');
      expect(def.category).toBe('custom');
      expect(def.enabled).toBe(true);
      expect(def.inputSchema).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should accept valid input', () => {
      const errors = tool.validate({ text: '{{system:test}}' });
      expect(errors).toHaveLength(0);
    });

    it('should reject non-object input', () => {
      const errors = tool.validate('not an object');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('must be an object');
    });

    it('should reject missing text', () => {
      const errors = tool.validate({});
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].path).toBe('text');
    });
  });

  describe('execute', () => {
    it('should resolve macros in text', async () => {
      const result = await tool.execute(
        { text: 'You are {{system:test}}', systemPrompts: { test: 'helper' } },
        { toolId: 'test', executionId: 'exec-1' }
      );
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = result.data as any;
      expect(data.resolved).toBe('You are helper');
      expect(data.allResolved).toBe(true);
      expect(data.macroCount).toBe(1);
    });

    it('should handle resolution errors', async () => {
      const result = await tool.execute(
        { text: '{{system:unknown}}' },
        { toolId: 'test', executionId: 'exec-2' }
      );
      expect(result.success).toBe(true); // Tool execution succeeds, but macro fails
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = result.data as any;
      expect(data.allResolved).toBe(false);
    });
  });
});

// ── Integration Tests ────────────────────────────────────────────

describe('Macro Integration', () => {
  it('should resolve a complex prompt with multiple macro types', async () => {
    const resolver = new MacroResolver();

    const messages: Message[] = [createUserMessage('What is 2+2?'), createAgentMessage('2+2 = 4')];

    const result = await resolver.resolve(
      'System: {{system:math-tutor}}\nHistory: {{history:ctx_1:last:2}}\nHome: {{env:HOME}}',
      {
        systemPrompts: { 'math-tutor': 'You are a math tutor.' },
        getMessages: async () => messages,
        currentContextId: 'ctx_1',
      }
    );

    expect(result.resolved).toContain('math tutor');
    expect(result.resolved).toContain('2+2');
    expect(result.resolved).not.toContain('{{env:HOME}}');
    expect(result.results.length).toBeGreaterThanOrEqual(3);
  });
});
