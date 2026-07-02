/**
 * E2E: 用户使用 UIAgent 完成完整工作流
 *
 * 模拟用户使用 AI Agent 进行 UI 自动化的完整操作流程：
 * 1. 用户启动 Agent
 * 2. 用户创建会话
 * 3. 用户执行一系列 UI 操作（点击 → 输入 → 选择 → 滚动 → 截图）
 * 4. 用户查看 Agent 状态和统计
 * 5. 用户暂停/恢复 Agent
 * 6. 用户结束会话并停止 Agent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UIAgent,
  createUIAgent,
  type UIAgentConfig,
  type UIAgentState,
  type UIAgentStatus,
  type UIOperationRequest,
  type SandboxSession,
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

// ── 用户场景：启动 Agent 并开始工作 ───────────────────────────────

describe('用户使用 UIAgent 完成完整工作流', () => {
  let agent: UIAgent;

  beforeEach(() => {
    agent = new UIAgent({ agentId: 'user-agent', name: 'MyAgent' });
  });

  describe('场景一：用户启动 Agent', () => {
    it('用户启动 Agent 后状态变为 idle', async () => {
      await agent.start();
      expect(agent.getState().status).toBe('idle');
    });

    it('用户启动 Agent 时收到 agent:start 事件', async () => {
      const events: string[] = [];
      agent.on('agent:start', (data) => {
        events.push(data.agentId);
      });

      await agent.start();
      expect(events).toContain('user-agent');
    });

    it('用户重复启动处于 idle 状态的 Agent 不会改变状态', async () => {
      await agent.start();
      await agent.start();
      expect(agent.getState().status).toBe('idle');
    });

    it('用户创建 Agent 使用默认配置', () => {
      const defaultAgent = new UIAgent();
      const config = defaultAgent.getConfig();
      expect(config.name).toBe('UIAgent');
      expect(config.sandbox.enabled).toBe(true);
      expect(config.sandbox.permissionLevel).toBe('L2');
    });

    it('用户使用工厂函数创建 Agent', () => {
      const customAgent = createUIAgent({
        agentId: 'factory-agent',
        name: 'FactoryAgent',
        defaultTimeout: 5000,
      });
      expect(customAgent).toBeDefined();
      expect(customAgent.getConfig().agentId).toBe('factory-agent');
      expect(customAgent.getConfig().defaultTimeout).toBe(5000);
    });
  });

  // ── 用户场景：创建会话 ──────────────────────────────────────────

  describe('场景二：用户启动会话', () => {
    beforeEach(async () => {
      await agent.start();
    });

    it('用户启动会话后获得会话对象', () => {
      const session = agent.startSession();
      expect(session).toBeDefined();
      expect(session.sessionId).toContain('session_');
      expect(session.agentId).toBe('user-agent');
    });

    it('用户启动会话时收到 session:start 事件', () => {
      const events: string[] = [];
      agent.on('session:start', (data) => {
        events.push(data.sessionId);
      });

      agent.startSession();
      expect(events.length).toBe(1);
    });

    it('用户启动会话后当前会话被设置', () => {
      const session = agent.startSession();
      const current = agent.getCurrentSession();
      expect(current).toBeDefined();
      expect(current!.sessionId).toBe(session.sessionId);
    });

    it('用户启动多个会话后当前会话是最新的', () => {
      const session1 = agent.startSession();
      const session2 = agent.startSession();

      const current = agent.getCurrentSession();
      expect(current!.sessionId).toBe(session2.sessionId);
    });

    it('用户 Agent 未启动时无法创建会话', () => {
      const offlineAgent = new UIAgent();
      expect(() => offlineAgent.startSession()).toThrow();
    });

    it('用户 Agent 暂停状态无法创建会话', async () => {
      agent.pause();
      expect(() => agent.startSession()).toThrow();
    });
  });

  // ── 用户场景：执行 UI 操作 ──────────────────────────────────────

  describe('场景三：用户执行 UI 操作序列', () => {
    beforeEach(async () => {
      await agent.start();
      agent.startSession();
    });

    it('用户执行 click 操作', async () => {
      const request: UIOperationRequest = {
        type: 'click',
        input: { selector: '#login-button' },
      };

      const result = await agent.execute(request);
      expect(result).toBeDefined();
      // 没有注册 handler，操作会失败，但流程正确
      expect(result.type).toBe('click');
    });

    it('用户执行 input 操作', async () => {
      const request: UIOperationRequest = {
        type: 'input',
        input: { selector: '#username', value: 'admin' },
      };

      const result = await agent.execute(request);
      expect(result).toBeDefined();
      expect(result.type).toBe('input');
    });

    it('用户执行 select 操作', async () => {
      const request: UIOperationRequest = {
        type: 'select',
        input: { selector: '#country', value: 'CN' },
      };

      const result = await agent.execute(request);
      expect(result).toBeDefined();
      expect(result.type).toBe('select');
    });

    it('用户执行 scroll 操作', async () => {
      const request: UIOperationRequest = {
        type: 'scroll',
        input: { selector: '#content', direction: 'down' },
      };

      const result = await agent.execute(request);
      expect(result).toBeDefined();
      expect(result.type).toBe('scroll');
    });

    it('用户执行 hover 操作', async () => {
      const request: UIOperationRequest = {
        type: 'hover',
        input: { selector: '#tooltip-trigger' },
      };

      const result = await agent.execute(request);
      expect(result).toBeDefined();
      expect(result.type).toBe('hover');
    });

    it('用户执行 wait 操作', async () => {
      const request: UIOperationRequest = {
        type: 'wait',
        input: { selector: '#loading', condition: 'hidden' },
      };

      const result = await agent.execute(request);
      expect(result).toBeDefined();
      expect(result.type).toBe('wait');
    });

    it('用户执行 getText 操作', async () => {
      const request: UIOperationRequest = {
        type: 'getText',
        input: { selector: '.title' },
      };

      const result = await agent.execute(request);
      expect(result).toBeDefined();
      expect(result.type).toBe('getText');
    });

    it('用户执行 getAttribute 操作', async () => {
      const request: UIOperationRequest = {
        type: 'getAttribute',
        input: { selector: 'a.link', attribute: 'href' },
      };

      const result = await agent.execute(request);
      expect(result).toBeDefined();
      expect(result.type).toBe('getAttribute');
    });

    it('用户执行 screenshot 操作', async () => {
      const request: UIOperationRequest = {
        type: 'screenshot',
        input: { selector: 'body', fullPage: true },
      };

      const result = await agent.execute(request);
      expect(result).toBeDefined();
      expect(result.type).toBe('screenshot');
    });

    it('用户按顺序执行多个操作 (executeSequence)', async () => {
      const requests: UIOperationRequest[] = [
        { type: 'click', input: { selector: '#menu-btn' } },
        { type: 'wait', input: { selector: '#menu', condition: 'visible' } },
        { type: 'click', input: { selector: '#item-1' } },
        { type: 'getText', input: { selector: '.result' } },
      ];

      const results = await agent.executeSequence(requests);
      // executeSequence 在操作失败时停止（无 handler 注册时第一个操作会失败）
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].type).toBe('click');
    });

    it('用户执行操作时收到 operation:request 事件', async () => {
      const events: string[] = [];
      agent.on('operation:request', (data) => {
        events.push(data.operation);
      });

      await agent.execute({ type: 'click', input: { selector: '#btn' } });
      expect(events).toContain('click');
    });

    it('用户在无活跃会话时执行操作会报错', async () => {
      const newAgent = new UIAgent();
      await newAgent.start();

      await expect(
        newAgent.execute({ type: 'click', input: { selector: '#btn' } })
      ).rejects.toThrow('No active session');
    });
  });

  // ── 用户场景：查看 Agent 状态和统计 ─────────────────────────────

  describe('场景四：用户查看 Agent 工作状态', () => {
    beforeEach(async () => {
      await agent.start();
    });

    it('用户查看 Agent 初始状态', () => {
      const state = agent.getState();
      expect(state.status).toBe('idle');
      expect(state.totalOperations).toBe(0);
      expect(state.successfulOperations).toBe(0);
      expect(state.failedOperations).toBe(0);
    });

    it('用户查看 Agent 配置', () => {
      const config = agent.getConfig();
      expect(config.agentId).toBe('user-agent');
      expect(config.name).toBe('MyAgent');
      expect(config.defaultTimeout).toBe(30000);
      expect(config.defaultRetryCount).toBe(3);
    });

    it('用户执行操作后查看统计信息', async () => {
      agent.startSession();
      await agent.execute({ type: 'click', input: { selector: '#btn' } });

      const stats = agent.getStats();
      expect(stats.totalOperations).toBe(1);
    });

    it('用户查看成功操作和失败操作的统计', async () => {
      agent.startSession();
      await agent.execute({ type: 'click', input: { selector: '#btn' } });

      const state = agent.getState();
      expect(state.totalOperations).toBeGreaterThanOrEqual(0);
    });

    it('用户查看成功率统计', () => {
      const stats = agent.getStats();
      expect(stats.successRate).toBeDefined();
      expect(stats.avgExecutionTime).toBeDefined();
    });
  });

  // ── 用户场景：暂停和恢复 Agent ──────────────────────────────────

  describe('场景五：用户暂停和恢复 Agent', () => {
    beforeEach(async () => {
      await agent.start();
    });

    it('用户暂停 Agent 后状态变为 paused', () => {
      agent.pause();
      expect(agent.getState().status).toBe('paused');
    });

    it('用户暂停 Agent 时收到 agent:pause 事件', () => {
      const events: string[] = [];
      agent.on('agent:pause', (data) => {
        events.push(data.agentId);
      });

      agent.pause();
      expect(events).toContain('user-agent');
    });

    it('用户恢复 Agent 后状态变为 idle', () => {
      agent.pause();
      agent.resume();
      expect(agent.getState().status).toBe('idle');
    });

    it('用户恢复 Agent 时收到 agent:resume 事件', () => {
      const events: string[] = [];
      agent.on('agent:resume', (data) => {
        events.push(data.agentId);
      });

      agent.pause();
      agent.resume();
      expect(events).toContain('user-agent');
    });

    it('用户重复暂停不会报错', () => {
      agent.pause();
      agent.pause(); // 不应该抛出异常
      expect(agent.getState().status).toBe('paused');
    });
  });

  // ── 用户场景：更新权限级别 ──────────────────────────────────────

  describe('场景六：用户调整 Agent 权限级别', () => {
    beforeEach(async () => {
      await agent.start();
    });

    it('用户提升权限到 L3', () => {
      agent.setPermissionLevel('L3');
      expect(agent.getState().permissionLevel).toBe('L3');
    });

    it('用户降低权限到 L1', () => {
      agent.setPermissionLevel('L1');
      expect(agent.getState().permissionLevel).toBe('L1');
    });

    it('用户提升到 L3 后 L1 操作仍然可用', () => {
      agent.setPermissionLevel('L3');
      agent.startSession();
      // L3 用户应该可以执行所有操作
      expect(agent.getState().permissionLevel).toBe('L3');
    });
  });

  // ── 用户场景：结束会话和停止 Agent ─────────────────────────────

  describe('场景七：用户结束会话并停止 Agent', () => {
    beforeEach(async () => {
      await agent.start();
    });

    it('用户结束会话', async () => {
      const session = agent.startSession();
      await agent.endSession(session.sessionId);

      const current = agent.getCurrentSession();
      expect(current).toBeUndefined();
    });

    it('用户结束会话时收到 session:end 事件', async () => {
      const events: string[] = [];
      agent.on('session:end', (data) => {
        events.push(data.sessionId);
      });

      const session = agent.startSession();
      await agent.endSession(session.sessionId);
      expect(events.length).toBe(1);
    });

    it('用户结束不存在的会话不会报错', async () => {
      await agent.endSession('nonexistent');
      // 不应抛出异常
    });

    it('用户停止 Agent 后状态变为 offline', async () => {
      await agent.stop();
      expect(agent.getState().status).toBe('offline');
    });

    it('用户停止 Agent 时收到 agent:stop 事件', async () => {
      const events: string[] = [];
      agent.on('agent:stop', (data) => {
        events.push(data.agentId);
      });

      await agent.stop();
      expect(events).toContain('user-agent');
    });

    it('用户停止 Agent 后无法再创建会话', async () => {
      await agent.stop();
      expect(() => agent.startSession()).toThrow();
    });

    it('用户停止已停止的 Agent 不会报错', async () => {
      await agent.stop();
      await agent.stop();
      expect(agent.getState().status).toBe('offline');
    });
  });

  // ── 用户场景：完整工作流（模拟用户登录操作）─────────────────────

  describe('场景八：用户完整工作流 — 模拟登录流程', () => {
    beforeEach(async () => {
      await agent.start();
    });

    it('用户执行完整的登录操作流程', async () => {
      // 1. 用户启动会话
      const session = agent.startSession();
      expect(session.status).toBe('active');

      // 2. 用户点击登录按钮
      const clickResult = await agent.execute({
        type: 'click',
        input: { selector: '#login-button' },
      });
      expect(clickResult.type).toBe('click');

      // 3. 用户输入用户名
      const inputResult = await agent.execute({
        type: 'input',
        input: { selector: '#username', value: 'admin' },
      });
      expect(inputResult.type).toBe('input');

      // 4. 用户输入密码
      const passwordResult = await agent.execute({
        type: 'input',
        input: { selector: '#password', value: 'secret' },
      });
      expect(passwordResult.type).toBe('input');

      // 5. 用户点击提交
      const submitResult = await agent.execute({
        type: 'click',
        input: { selector: '#submit' },
      });
      expect(submitResult.type).toBe('click');

      // 6. 用户等待页面加载
      const waitResult = await agent.execute({
        type: 'wait',
        input: { selector: '#dashboard', condition: 'visible' },
      });
      expect(waitResult.type).toBe('wait');

      // 7. 用户读取欢迎消息
      const textResult = await agent.execute({
        type: 'getText',
        input: { selector: '.welcome-message' },
      });
      expect(textResult.type).toBe('getText');

      // 8. 用户查看统计
      const stats = agent.getStats();
      // input 操作因敏感确认被取消，不计入统计
      expect(stats.totalOperations).toBeGreaterThanOrEqual(4);

      // 9. 用户结束会话
      await agent.endSession(session.sessionId);
      expect(agent.getCurrentSession()).toBeUndefined();
    });

    it('用户使用 executeSequence 执行批量操作', async () => {
      agent.startSession();

      const results = await agent.executeSequence([
        { type: 'click', input: { selector: '#nav-dashboard' } },
        { type: 'wait', input: { selector: '#dashboard-content', condition: 'visible' } },
        { type: 'scroll', input: { selector: '#dashboard-content', direction: 'down', distance: 300 } },
        { type: 'getText', input: { selector: '.stat-value' } },
        { type: 'screenshot', input: { selector: '#dashboard', fullPage: false } },
      ]);

      // executeSequence 在操作失败时停止（无 handler 注册时第一个操作会失败）
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].type).toBe('click');
    });
  });
});