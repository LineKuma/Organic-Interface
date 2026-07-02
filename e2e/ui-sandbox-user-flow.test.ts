/**
 * E2E: 用户沙箱会话完整流程测试
 *
 * 模拟用户在使用 Organic Interface 时的完整沙箱操作流程：
 * 1. 用户打开沙箱并配置安全策略
 * 2. 用户创建沙箱会话
 * 3. 用户执行各种 UI 操作（click、input、select、scroll、hover、wait、getText、getAttribute、screenshot）
 * 4. 用户检查每个操作的权限
 * 5. 用户查看操作历史记录
 * 6. 用户查看会话统计
 * 7. 用户终止会话
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Sandbox,
  createSandbox,
  DEFAULT_SANDBOX_CONFIG,
  type SandboxSession,
  type PermissionCheckResult,
  type UIOperationType,
  type UIPermissionLevel,
} from '@organic/ui';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ── 用户场景：打开沙箱、配置安全策略 ──────────────────────────────

describe('用户沙箱会话完整流程', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = new Sandbox();
  });

  describe('场景一：用户打开沙箱并查看默认配置', () => {
    it('用户打开沙箱，默认已启用', () => {
      expect(sandbox.isEnabled()).toBe(true);
    });

    it('用户查看沙箱默认安全配置', () => {
      const config = sandbox.getConfig();

      // 用户看到的安全级别
      expect(config.permissionLevel).toBe('L2');
      // 用户看到的最大操作数限制
      expect(config.maxOperationsPerSession).toBe(1000);
      // 用户看到的最大操作时长
      expect(config.maxOperationDuration).toBe(30000);
      // 用户看到敏感操作需要确认
      expect(config.requireConfirmation).toBe(true);
      // 用户看到操作记录已启用
      expect(config.enableRecording).toBe(true);
    });

    it('用户可以看到允许的操作列表', () => {
      const config = sandbox.getConfig();
      const allowedOps = config.allowedOperations;

      // 用户可以看到所有支持的 UI 操作类型
      expect(allowedOps).toContain('click');
      expect(allowedOps).toContain('input');
      expect(allowedOps).toContain('select');
      expect(allowedOps).toContain('scroll');
      expect(allowedOps).toContain('hover');
      expect(allowedOps).toContain('wait');
      expect(allowedOps).toContain('getText');
      expect(allowedOps).toContain('getAttribute');
      expect(allowedOps).toContain('screenshot');
    });

    it('用户可以看到被禁止的路径', () => {
      const config = sandbox.getConfig();

      expect(config.deniedPaths).toContain('/etc');
      expect(config.deniedPaths).toContain('/root');
      expect(config.deniedPaths).toContain('/sys');
      expect(config.deniedPaths).toContain('/proc');
      expect(config.deniedPaths).toContain('/var');
    });
  });

  describe('场景二：用户自定义沙箱配置', () => {
    it('用户调整安全级别到 L3', () => {
      sandbox.updateConfig({ permissionLevel: 'L3' });
      expect(sandbox.getConfig().permissionLevel).toBe('L3');
    });

    it('用户限制最大操作数为 500', () => {
      sandbox.updateConfig({ maxOperationsPerSession: 500 });
      expect(sandbox.getConfig().maxOperationsPerSession).toBe(500);
    });

    it('用户关闭敏感操作确认（自动确认）', () => {
      sandbox.updateConfig({ requireConfirmation: false });
      expect(sandbox.getConfig().requireConfirmation).toBe(false);
    });

    it('用户创建自定义沙箱实例', () => {
      const customSandbox = createSandbox({
        permissionLevel: 'L3',
        maxOperationsPerSession: 200,
        enableRecording: false,
        requireConfirmation: false,
      });

      const config = customSandbox.getConfig();
      expect(config.permissionLevel).toBe('L3');
      expect(config.maxOperationsPerSession).toBe(200);
      expect(config.enableRecording).toBe(false);
      expect(config.requireConfirmation).toBe(false);
    });

    it('用户可以禁用沙箱', () => {
      sandbox.setEnabled(false);
      expect(sandbox.isEnabled()).toBe(false);
    });

    it('用户可以重新启用沙箱', () => {
      sandbox.setEnabled(false);
      sandbox.setEnabled(true);
      expect(sandbox.isEnabled()).toBe(true);
    });
  });

  // ── 用户场景：创建和管理会话 ──────────────────────────────────

  describe('场景三：用户创建沙箱会话', () => {
    let session: SandboxSession;

    beforeEach(() => {
      session = sandbox.createSession('agent-001');
    });

    it('用户创建会话后获得会话 ID', () => {
      expect(session.sessionId).toBeDefined();
      expect(session.sessionId).toContain('session_');
    });

    it('用户创建的会话绑定到指定 agent', () => {
      expect(session.agentId).toBe('agent-001');
    });

    it('用户创建的会话默认为活跃状态', () => {
      expect(session.status).toBe('active');
    });

    it('用户创建的会话继承沙箱默认权限级别', () => {
      expect(session.permissionLevel).toBe('L2');
    });

    it('用户创建的会话操作计数从 0 开始', () => {
      expect(session.operationCount).toBe(0);
    });

    it('用户创建会话时记录开始时间', () => {
      expect(session.startTime).toBeDefined();
      expect(session.startTime).toBeLessThanOrEqual(Date.now());
    });

    it('用户可以指定会话权限级别', () => {
      const elevatedSession = sandbox.createSession('agent-admin', 'L4');
      expect(elevatedSession.permissionLevel).toBe('L4');
    });

    it('用户可以通过 ID 查找会话', () => {
      const found = sandbox.getSession(session.sessionId);
      expect(found).toBeDefined();
      expect(found!.sessionId).toBe(session.sessionId);
    });

    it('用户查找不存在的会话返回 undefined', () => {
      const found = sandbox.getSession('nonexistent');
      expect(found).toBeUndefined();
    });

    it('用户可以看到所有活跃会话', () => {
      const session2 = sandbox.createSession('agent-002');
      const activeSessions = sandbox.getActiveSessions();

      expect(activeSessions.length).toBe(2);
      expect(activeSessions.map(s => s.sessionId)).toContain(session.sessionId);
      expect(activeSessions.map(s => s.sessionId)).toContain(session2.sessionId);
    });
  });

  describe('场景四：用户终止会话', () => {
    it('用户终止会话后状态变为 terminated', () => {
      const session = sandbox.createSession('agent-001');
      const result = sandbox.terminateSession(session.sessionId);

      expect(result).toBe(true);
      const terminated = sandbox.getSession(session.sessionId);
      expect(terminated!.status).toBe('terminated');
    });

    it('用户终止会话后记录结束时间', () => {
      const session = sandbox.createSession('agent-001');
      sandbox.terminateSession(session.sessionId);

      const terminated = sandbox.getSession(session.sessionId);
      expect(terminated!.endTime).toBeDefined();
    });

    it('用户终止不存在的会话返回 false', () => {
      const result = sandbox.terminateSession('nonexistent');
      expect(result).toBe(false);
    });

    it('用户终止会话后活跃会话列表不再包含该会话', () => {
      const session = sandbox.createSession('agent-001');
      sandbox.terminateSession(session.sessionId);

      const activeSessions = sandbox.getActiveSessions();
      expect(activeSessions.map(s => s.sessionId)).not.toContain(session.sessionId);
    });
  });

  // ── 用户场景：执行 UI 操作并检查权限 ────────────────────────────

  describe('场景五：用户执行 UI 操作前的权限检查', () => {
    let session: SandboxSession;

    beforeEach(() => {
      session = sandbox.createSession('agent-001', 'L2');
    });

    it('用户点击按钮 — 权限检查通过', () => {
      const result = sandbox.checkPermission(session.sessionId, 'click', '#submit-btn');
      expect(result.allowed).toBe(true);
    });

    it('用户输入文本 — 权限检查通过但需要确认（敏感操作）', () => {
      const result = sandbox.checkPermission(session.sessionId, 'input', '#username');
      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.warnings).toContain('This operation may involve sensitive data');
    });

    it('用户选择下拉选项 — 权限检查通过', () => {
      const result = sandbox.checkPermission(session.sessionId, 'select', '#country');
      expect(result.allowed).toBe(true);
    });

    it('用户滚动页面 — L1 级别操作无需确认', () => {
      const result = sandbox.checkPermission(session.sessionId, 'scroll', '#content');
      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('用户悬停元素 — L1 级别操作无需确认', () => {
      const result = sandbox.checkPermission(session.sessionId, 'hover', '#tooltip');
      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('用户等待元素 — L1 级别操作无需确认', () => {
      const result = sandbox.checkPermission(session.sessionId, 'wait', '#loading');
      expect(result.allowed).toBe(true);
    });

    it('用户获取文本内容 — L1 级别操作无需确认', () => {
      const result = sandbox.checkPermission(session.sessionId, 'getText', '.title');
      expect(result.allowed).toBe(true);
    });

    it('用户获取元素属性 — L1 级别操作无需确认', () => {
      const result = sandbox.checkPermission(session.sessionId, 'getAttribute', 'img.logo');
      expect(result.allowed).toBe(true);
    });

    it('用户截取屏幕 — L1 级别操作无需确认', () => {
      const result = sandbox.checkPermission(session.sessionId, 'screenshot', 'body');
      expect(result.allowed).toBe(true);
    });

    it('用户使用无效会话操作 — 权限被拒绝', () => {
      const result = sandbox.checkPermission('invalid-session', 'click', '#btn');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Invalid session');
    });

    it('用户使用已终止会话操作 — 权限被拒绝', () => {
      sandbox.terminateSession(session.sessionId);
      const result = sandbox.checkPermission(session.sessionId, 'click', '#btn');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Session is not active');
    });
  });

  describe('场景六：用户的权限级别限制', () => {
    it('L1 用户尝试 click 操作（需要 L2）— 权限不足', () => {
      const session = sandbox.createSession('agent-l1', 'L1');
      const result = sandbox.checkPermission(session.sessionId, 'click', '#btn');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient permission level');
    });

    it('L1 用户尝试 input 操作（需要 L2）— 权限不足', () => {
      const session = sandbox.createSession('agent-l1', 'L1');
      const result = sandbox.checkPermission(session.sessionId, 'input', '#field');

      expect(result.allowed).toBe(false);
    });

    it('L1 用户仍然可以执行 scroll 操作（只需要 L1）', () => {
      const session = sandbox.createSession('agent-l1', 'L1');
      const result = sandbox.checkPermission(session.sessionId, 'scroll', '#content');

      expect(result.allowed).toBe(true);
    });

    it('L4 用户可以执行所有操作', () => {
      const session = sandbox.createSession('agent-admin', 'L4');
      const allOps: UIOperationType[] = [
        'click', 'input', 'select', 'scroll', 'hover',
        'wait', 'getText', 'getAttribute', 'screenshot',
      ];

      for (const op of allOps) {
        const result = sandbox.checkPermission(session.sessionId, op, '#target');
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('场景七：用户操作被拒绝列表限制', () => {
    it('用户配置拒绝 click 操作后无法执行 click', () => {
      sandbox.updateConfig({ deniedOperations: ['click'] });
      const session = sandbox.createSession('agent-001', 'L4');
      const result = sandbox.checkPermission(session.sessionId, 'click', '#btn');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Operation denied');
    });

    it('用户将操作从允许列表移除后无法执行', () => {
      sandbox.updateConfig({ allowedOperations: ['scroll', 'hover', 'wait'] });
      const session = sandbox.createSession('agent-001');
      const result = sandbox.checkPermission(session.sessionId, 'click', '#btn');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Operation not allowed');
    });
  });

  describe('场景八：用户超过操作数限制', () => {
    it('用户达到最大操作数限制后无法继续操作', () => {
      sandbox.updateConfig({ maxOperationsPerSession: 3 });
      const session = sandbox.createSession('agent-001');

      // 手动模拟操作计数达到上限
      const sessionObj = sandbox.getSession(session.sessionId)!;
      // 通过 recordOperation 来增加计数
      const ctx = {
        session: sessionObj,
        operation: 'click' as UIOperationType,
        selector: '#btn',
        timestamp: Date.now(),
      };
      sandbox.recordOperation(ctx);
      sandbox.recordOperation(ctx);
      sandbox.recordOperation(ctx);

      const result = sandbox.checkPermission(session.sessionId, 'click', '#btn');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Maximum operations per session reached');
    });
  });

  // ── 用户场景：查看操作记录 ──────────────────────────────────────

  describe('场景九：用户查看操作历史', () => {
    let session: SandboxSession;

    beforeEach(() => {
      session = sandbox.createSession('agent-001');
    });

    it('用户可以记录 UI 操作', () => {
      const ctx = {
        session,
        operation: 'click' as UIOperationType,
        selector: '#submit-btn',
        timestamp: Date.now(),
      };
      sandbox.recordOperation(ctx);

      const history = sandbox.getOperationHistory(session.sessionId);
      expect(history.length).toBe(1);
      expect(history[0].operation).toBe('click');
      expect(history[0].selector).toBe('#submit-btn');
    });

    it('用户可以记录多种操作类型', () => {
      const ops: Array<{ operation: UIOperationType; selector: string }> = [
        { operation: 'click', selector: '#login-btn' },
        { operation: 'input', selector: '#username' },
        { operation: 'input', selector: '#password' },
        { operation: 'click', selector: '#submit' },
        { operation: 'wait', selector: '#dashboard' },
        { operation: 'getText', selector: '.welcome-msg' },
      ];

      for (const op of ops) {
        sandbox.recordOperation({
          session,
          operation: op.operation,
          selector: op.selector,
          timestamp: Date.now(),
        });
      }

      const history = sandbox.getOperationHistory(session.sessionId);
      expect(history.length).toBe(6);
      expect(history.map(h => h.operation)).toEqual([
        'click', 'input', 'input', 'click', 'wait', 'getText',
      ]);
    });

    it('用户查看操作历史时操作计数增加', () => {
      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#btn',
        timestamp: Date.now(),
      });

      const updated = sandbox.getSession(session.sessionId);
      expect(updated!.operationCount).toBe(1);
    });

    it('用户关闭记录后不会记录操作', () => {
      sandbox.updateConfig({ enableRecording: false });

      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#btn',
        timestamp: Date.now(),
      });

      const history = sandbox.getOperationHistory(session.sessionId);
      expect(history.length).toBe(0);
    });

    it('用户可以查看所有会话的操作历史', () => {
      const session2 = sandbox.createSession('agent-002');

      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#btn1',
        timestamp: Date.now(),
      });
      sandbox.recordOperation({
        session: session2,
        operation: 'input',
        selector: '#field2',
        timestamp: Date.now(),
      });

      const allHistory = sandbox.getAllOperationHistory();
      expect(allHistory.length).toBe(2);
    });

    it('用户可以清除指定会话的操作历史', () => {
      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#btn',
        timestamp: Date.now(),
      });

      sandbox.clearHistory(session.sessionId);
      const history = sandbox.getOperationHistory(session.sessionId);
      expect(history.length).toBe(0);
    });

    it('用户可以清除所有操作历史', () => {
      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#btn',
        timestamp: Date.now(),
      });
      sandbox.clearHistory();

      const allHistory = sandbox.getAllOperationHistory();
      expect(allHistory.length).toBe(0);
    });
  });

  // ── 用户场景：查看会话统计 ──────────────────────────────────────

  describe('场景十：用户查看会话统计信息', () => {
    it('用户可以查看会话统计', () => {
      const session = sandbox.createSession('agent-001');
      const stats = sandbox.getSessionStats(session.sessionId);

      expect(stats).toBeDefined();
      expect(stats!.session.sessionId).toBe(session.sessionId);
      expect(stats!.operationsToday).toBeGreaterThanOrEqual(0);
    });

    it('用户查看不存在的会话统计返回 null', () => {
      const stats = sandbox.getSessionStats('nonexistent');
      expect(stats).toBeNull();
    });

    it('用户查看有操作记录的会话统计', () => {
      const session = sandbox.createSession('agent-001');

      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#btn',
        timestamp: Date.now(),
      });

      const stats = sandbox.getSessionStats(session.sessionId);
      expect(stats!.operationsToday).toBe(1);
    });
  });

  // ── 用户场景：选择器安全验证 ────────────────────────────────────

  describe('场景十一：用户验证选择器安全性', () => {
    it('普通 CSS 选择器通过验证', () => {
      const result = sandbox.validateSelector('#my-button');
      expect(result.valid).toBe(true);
    });

    it('XPath 选择器通过验证', () => {
      const result = sandbox.validateSelector('//div[@class="container"]');
      expect(result.valid).toBe(true);
    });

    it('javascript: 协议被拒绝', () => {
      const result = sandbox.validateSelector('javascript:alert(1)');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Dangerous pattern');
    });

    it('data: 协议被拒绝', () => {
      const result = sandbox.validateSelector('data:text/html,<script>alert(1)</script>');
      expect(result.valid).toBe(false);
    });
  });

  // ── 用户场景：事件监听 ──────────────────────────────────────────

  describe('场景十二：用户监听沙箱事件', () => {
    it('用户创建会话时收到 session:created 事件', () => {
      const events: Array<{ sessionId: string }> = [];
      sandbox.on('session:created', (data) => {
        events.push({ sessionId: data.session.sessionId });
      });

      sandbox.createSession('agent-001');
      expect(events.length).toBe(1);
    });

    it('用户终止会话时收到 session:terminated 事件', () => {
      const events: string[] = [];
      sandbox.on('session:terminated', (data) => {
        events.push(data.session.sessionId);
      });

      const session = sandbox.createSession('agent-001');
      sandbox.terminateSession(session.sessionId);
      expect(events.length).toBe(1);
    });

    it('用户记录操作时收到 operation:recorded 事件', () => {
      const events: string[] = [];
      sandbox.on('operation:recorded', (data) => {
        events.push(data.context.operation);
      });

      const session = sandbox.createSession('agent-001');
      sandbox.recordOperation({
        session,
        operation: 'click',
        selector: '#btn',
        timestamp: Date.now(),
      });
      expect(events).toContain('click');
    });
  });
});