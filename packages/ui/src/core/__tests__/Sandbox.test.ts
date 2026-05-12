import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sandbox, createSandbox, DEFAULT_SANDBOX_CONFIG } from '../Sandbox.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('Sandbox', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = new Sandbox();
  });

  describe('constructor', () => {
    it('should create sandbox with default config', () => {
      expect(sandbox).toBeDefined();
    });

    it('should accept custom config', () => {
      const customSandbox = new Sandbox({
        permissionLevel: 'L3',
        maxOperationsPerSession: 500,
      });
      expect(customSandbox).toBeDefined();
    });
  });

  describe('DEFAULT_SANDBOX_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_SANDBOX_CONFIG.enabled).toBe(true);
      expect(DEFAULT_SANDBOX_CONFIG.permissionLevel).toBe('L2');
      expect(DEFAULT_SANDBOX_CONFIG.maxOperationsPerSession).toBe(1000);
    });
  });

  describe('getConfig', () => {
    it('should return sandbox config', () => {
      const config = sandbox.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.permissionLevel).toBe('L2');
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      sandbox.updateConfig({ permissionLevel: 'L3' });
      expect(sandbox.getConfig().permissionLevel).toBe('L3');
    });
  });

  describe('setEnabled', () => {
    it('should enable/disable sandbox', () => {
      sandbox.setEnabled(false);
      expect(sandbox.isEnabled()).toBe(false);
      sandbox.setEnabled(true);
      expect(sandbox.isEnabled()).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('should return enabled status', () => {
      expect(sandbox.isEnabled()).toBe(true);
    });
  });

  describe('createSession', () => {
    it('should create session', () => {
      const session = sandbox.createSession('agent-1');
      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^session_/);
      expect(session.agentId).toBe('agent-1');
      expect(session.status).toBe('active');
    });

    it('should emit session:created event', () => {
      const handler = vi.fn();
      sandbox.on('session:created', handler);
      sandbox.createSession('agent-1');
      expect(handler).toHaveBeenCalled();
    });

    it('should transition session status to terminated', () => {
      const session = sandbox.createSession('agent-1');
      expect(session.status).toBe('active');
      sandbox.terminateSession(session.sessionId);
      expect(sandbox.getSession(session.sessionId)?.status).toBe('terminated');
    });
  });

  describe('getSession', () => {
    it('should get session by ID', () => {
      const session = sandbox.createSession('agent-1');
      const retrieved = sandbox.getSession(session.sessionId);
      expect(retrieved?.sessionId).toBe(session.sessionId);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = sandbox.getSession('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('terminateSession', () => {
    it('should terminate session', () => {
      const session = sandbox.createSession('agent-1');
      const result = sandbox.terminateSession(session.sessionId);
      expect(result).toBe(true);
      expect(sandbox.getSession(session.sessionId)?.status).toBe('terminated');
    });

    it('should return false for non-existent session', () => {
      const result = sandbox.terminateSession('non-existent');
      expect(result).toBe(false);
    });

    it('should emit session:terminated event', () => {
      const handler = vi.fn();
      sandbox.on('session:terminated', handler);
      const session = sandbox.createSession('agent-1');
      sandbox.terminateSession(session.sessionId);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions', () => {
      sandbox.createSession('agent-1');
      sandbox.createSession('agent-2');
      const sessions = sandbox.getActiveSessions();
      expect(sessions).toHaveLength(2);
    });
  });

  describe('checkPermission', () => {
    it('should allow valid operation', () => {
      const session = sandbox.createSession('agent-1');
      const result = sandbox.checkPermission(session.sessionId, 'click', '#button');
      expect(result.allowed).toBe(true);
    });

    it('should deny invalid session', () => {
      const result = sandbox.checkPermission('non-existent', 'click', '#button');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Invalid session');
    });

    it('should deny when max operations reached', () => {
      const limitedSandbox = new Sandbox({ maxOperationsPerSession: 0 });
      const session = limitedSandbox.createSession('agent-1');
      const result = limitedSandbox.checkPermission(session.sessionId, 'click', '#button');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Maximum operations');
    });

    it('should check operation allowed list', () => {
      const restrictedSandbox = new Sandbox({
        allowedOperations: ['click'],
      });
      const session = restrictedSandbox.createSession('agent-1');
      expect(restrictedSandbox.checkPermission(session.sessionId, 'click', '#button').allowed).toBe(true);
      expect(restrictedSandbox.checkPermission(session.sessionId, 'input', '#input').allowed).toBe(false);
    });

    it('should check permission level', () => {
      const session = sandbox.createSession('agent-1', 'L1');
      expect(sandbox.checkPermission(session.sessionId, 'click', '#button').allowed).toBe(false);
    });

    it('should deny when operation is in deniedOperations', () => {
      const restrictedSandbox = new Sandbox({
        deniedOperations: ['click'],
      });
      const session = restrictedSandbox.createSession('agent-1');
      const result = restrictedSandbox.checkPermission(session.sessionId, 'click', '#button');
      expect(result.allowed).toBe(false);
    });
  });

  describe('recordOperation', () => {
    it('should record operation', () => {
      const session = sandbox.createSession('agent-1');
      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#button',
        timestamp: Date.now(),
      });
      const history = sandbox.getOperationHistory(session.sessionId);
      expect(history).toHaveLength(1);
    });

    it('should increment session operationCount', () => {
      const session = sandbox.createSession('agent-1');
      expect(session.operationCount).toBe(0);
      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#button',
        timestamp: Date.now(),
      });
      expect(sandbox.getSession(session.sessionId)?.operationCount).toBe(1);
    });

    it('should emit operation:recorded event', () => {
      const handler = vi.fn();
      sandbox.on('operation:recorded', handler);
      const session = sandbox.createSession('agent-1');
      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#button',
        timestamp: Date.now(),
      });
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getOperationHistory', () => {
    it('should get session operation history', () => {
      const session = sandbox.createSession('agent-1');
      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#button',
        timestamp: Date.now(),
      });
      const history = sandbox.getOperationHistory(session.sessionId);
      expect(history).toHaveLength(1);
    });
  });

  describe('getAllOperationHistory', () => {
    it('should get all operation history', () => {
      const session1 = sandbox.createSession('agent-1');
      const session2 = sandbox.createSession('agent-2');
      sandbox.recordOperation({
        session: session1,
        operation: 'click',
        selector: '#button1',
        timestamp: Date.now(),
      });
      sandbox.recordOperation({
        session: session2,
        operation: 'click',
        selector: '#button2',
        timestamp: Date.now(),
      });
      const history = sandbox.getAllOperationHistory();
      expect(history).toHaveLength(2);
    });

    it('should return empty array when no operations', () => {
      const history = sandbox.getAllOperationHistory();
      expect(history).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history without sessionId', () => {
      const session = sandbox.createSession('agent-1');
      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#button',
        timestamp: Date.now(),
      });
      sandbox.clearHistory(undefined);
      expect(sandbox.getAllOperationHistory()).toHaveLength(0);
    });

    it('should clear all history', () => {
      const session = sandbox.createSession('agent-1');
      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#button',
        timestamp: Date.now(),
      });
      sandbox.clearHistory();
      expect(sandbox.getAllOperationHistory()).toHaveLength(0);
    });

    it('should clear session-specific history', () => {
      const session1 = sandbox.createSession('agent-1');
      const session2 = sandbox.createSession('agent-2');
      sandbox.recordOperation({
        session: session1,
        operation: 'click',
        selector: '#button1',
        timestamp: Date.now(),
      });
      sandbox.recordOperation({
        session: session2,
        operation: 'click',
        selector: '#button2',
        timestamp: Date.now(),
      });
      sandbox.clearHistory(session1.sessionId);
      expect(sandbox.getOperationHistory(session1.sessionId)).toHaveLength(0);
      expect(sandbox.getOperationHistory(session2.sessionId)).toHaveLength(1);
    });
  });

  describe('getSessionStats', () => {
    it('should return session stats', () => {
      const session = sandbox.createSession('agent-1');
      const stats = sandbox.getSessionStats(session.sessionId);
      expect(stats).toBeDefined();
      expect(stats?.session).toBeDefined();
    });

    it('should return null for non-existent session', () => {
      const stats = sandbox.getSessionStats('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('validateSelector', () => {
    it('should validate safe selector', () => {
      const result = sandbox.validateSelector('#button');
      expect(result.valid).toBe(true);
    });

    it('should reject javascript: selector', () => {
      const result = sandbox.validateSelector('javascript:alert(1)');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Dangerous pattern');
    });

    it('should reject data: selector', () => {
      const result = sandbox.validateSelector('data:text/html,<script>alert(1)</script>');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Dangerous pattern');
    });

    it('should reject vbscript: selector', () => {
      const result = sandbox.validateSelector('vbscript:msgbox("hello")');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Dangerous pattern');
    });
  });

  describe('createSandbox', () => {
    it('should create sandbox instance', () => {
      const instance = createSandbox();
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(Sandbox);
    });
  });
});
