/**
 * E2E: 用户使用 CLI 完成日常命令操作
 *
 * 模拟用户使用 Organic Interface CLI 的完整交互流程：
 * 1. 用户启动 CLI 并查看基本信息
 * 2. 用户注册自定义命令
 * 3. 用户运行命令（带参数和选项）
 * 4. 用户查看帮助和版本信息
 * 5. 用户管理操作历史和日志
 * 6. 用户查询终端能力和主题信息
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CLI, type CLIConfig } from '@organic/ui';
import { createCLI } from '@organic/ui/cli/index.js';
import { createCommand } from '@organic/ui/cli/Command.js';

// ── 用户场景：启动 CLI 并查看基本信息 ─────────────────────────────

describe('用户使用 CLI 完成日常命令操作', () => {
  let cli: CLI;

  beforeEach(() => {
    cli = new CLI();
  });

  describe('场景一：用户启动 CLI 并查看基本信息', () => {
    it('用户创建 CLI 使用默认配置', () => {
      const config = cli.getConfig();
      expect(config.name).toBe('organic-cli');
      expect(config.version).toBe('0.1.0');
      expect(config.description).toBe('Organic Interface CLI');
    });

    it('用户创建自定义配置的 CLI', () => {
      const customCli = new CLI({
        name: 'my-tool',
        version: '2.0.0',
        description: 'My custom tool',
        interactive: true,
        historyPath: '/tmp/my-history',
      });

      const config = customCli.getConfig();
      expect(config.name).toBe('my-tool');
      expect(config.version).toBe('2.0.0');
      expect(config.description).toBe('My custom tool');
      expect(config.interactive).toBe(true);
      expect(config.historyPath).toBe('/tmp/my-history');
    });

    it('用户使用 createCLI 工厂函数', () => {
      const createdCli = createCLI({ name: 'created-cli', version: '3.0.0' });
      expect(createdCli).toBeInstanceOf(CLI);

      const config = createdCli.getConfig();
      expect(config.name).toBe('created-cli');
      expect(config.version).toBe('3.0.0');
    });

    it('用户查看 CLI 版本信息', async () => {
      const result = await cli.run(['--version']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('organic-cli');
      expect(result.message).toContain('0.1.0');
    });

    it('用户使用 -v 简写查看版本', async () => {
      const result = await cli.run(['-v']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('organic-cli');
    });
  });

  // ── 用户场景：查看帮助信息 ──────────────────────────────────────

  describe('场景二：用户查看帮助信息', () => {
    it('用户查看帮助信息', async () => {
      const result = await cli.run(['--help']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('organic-cli');
      expect(result.message).toContain('Available commands');
    });

    it('用户使用 -h 简写查看帮助', async () => {
      const result = await cli.run(['-h']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Available commands');
    });

    it('用户查看特定命令的帮助', async () => {
      const result = await cli.run(['help', 'history']);
      expect(result.success).toBe(true);
    });

    it('用户查看帮助中列出内置命令', async () => {
      const result = await cli.run(['--help']);
      expect(result.message).toContain('help');
      expect(result.message).toContain('history');
      expect(result.message).toContain('log');
    });
  });

  // ── 用户场景：运行内置命令 ──────────────────────────────────────

  describe('场景三：用户运行内置命令', () => {
    it('用户运行 help 命令', async () => {
      const result = await cli.run(['help']);
      expect(result.success).toBe(true);
    });

    it('用户运行 help 命令查看特定命令', async () => {
      const result = await cli.run(['help', 'history']);
      expect(result.success).toBe(true);
    });

    it('用户运行 history 命令（初始为空）', async () => {
      const result = await cli.run(['history']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('No history entries');
    });

    it('用户运行 log 命令（初始为空）', async () => {
      const result = await cli.run(['log']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('No matching log entries');
    });

    it('用户运行未知命令返回错误', async () => {
      const result = await cli.run(['unknown-command']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
    });
  });

  // ── 用户场景：管理操作历史 ──────────────────────────────────────

  describe('场景四：用户管理操作历史和日志', () => {
    it('用户添加操作日志后可以查看', () => {
      cli.addOperationLog({
        agent_id: 'agent-001',
        operation_type: 'click',
        target_selector: '#submit-btn',
        parameters: { x: 100, y: 200 },
        status: 'success',
        before_state: {},
        after_state: {},
      });

      const history = cli.getOperationHistory();
      expect(history.length).toBe(1);
    });

    it('用户添加多条操作日志', () => {
      cli.addOperationLog({
        agent_id: 'agent-001',
        operation_type: 'click',
        target_selector: '#login',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });

      cli.addOperationLog({
        agent_id: 'agent-001',
        operation_type: 'input',
        target_selector: '#username',
        parameters: { value: 'admin' },
        status: 'success',
        before_state: {},
        after_state: {},
      });

      cli.addOperationLog({
        agent_id: 'agent-001',
        operation_type: 'click',
        target_selector: '#submit',
        parameters: {},
        status: 'failed',
        before_state: {},
        after_state: {},
        error_message: 'Timeout',
      });

      const history = cli.getOperationHistory();
      expect(history.length).toBe(3);
    });

    it('用户查看操作历史（只读）', () => {
      cli.addOperationLog({
        agent_id: 'agent-001',
        operation_type: 'click',
        target_selector: '#btn',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });

      const history = cli.getOperationHistory();
      expect(history[0].agent_id).toBe('agent-001');
      expect(history[0].operation_type).toBe('click');
      expect(history[0].status).toBe('success');
    });

    it('用户清除操作历史', () => {
      cli.addOperationLog({
        agent_id: 'agent-001',
        operation_type: 'click',
        target_selector: '#btn',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });

      cli.clearHistory();
      const history = cli.getOperationHistory();
      expect(history.length).toBe(0);
    });

    it('用户清除历史后 history 命令显示为空', async () => {
      cli.addOperationLog({
        agent_id: 'agent-001',
        operation_type: 'click',
        target_selector: '#btn',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });

      cli.clearHistory();
      const result = await cli.run(['history']);
      expect(result.message).toContain('No history entries');
    });
  });

  // ── 用户场景：操作日志筛选 ──────────────────────────────────────

  describe('场景五：用户筛选操作日志', () => {
    beforeEach(() => {
      cli.addOperationLog({
        agent_id: 'agent-a',
        operation_type: 'click',
        target_selector: '#btn1',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });
      cli.addOperationLog({
        agent_id: 'agent-a',
        operation_type: 'input',
        target_selector: '#field',
        parameters: { value: 'text' },
        status: 'failed',
        before_state: {},
        after_state: {},
        error_message: 'Validation error',
      });
      cli.addOperationLog({
        agent_id: 'agent-b',
        operation_type: 'click',
        target_selector: '#btn2',
        parameters: {},
        status: 'success',
        before_state: {},
        after_state: {},
      });
    });

    it('用户按 agent ID 筛选日志', async () => {
      const result = await cli.run(['log', '--agent', 'agent-a']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('agent-a');
    });

    it('用户按操作类型筛选日志', async () => {
      const result = await cli.run(['log', '--type', 'input']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('input');
    });

    it('用户按状态筛选日志', async () => {
      const result = await cli.run(['log', '--status', 'failed']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('failed');
    });

    it('用户限制日志条目数量', async () => {
      const result = await cli.run(['log', '--limit', '1']);
      expect(result.success).toBe(true);
    });

    it('用户组合筛选日志', async () => {
      const result = await cli.run([
        'log',
        '--agent', 'agent-a',
        '--type', 'click',
        '--status', 'success',
      ]);
      expect(result.success).toBe(true);
      expect(result.message).toContain('agent-a');
    });
  });

  // ── 用户场景：注册和使用自定义命令 ──────────────────────────────

  describe('场景六：用户注册和使用自定义命令', () => {
    it('用户注册自定义命令并运行', async () => {
      cli.register(
        createCommand({
          name: 'greet',
          description: '打招呼',
          arguments: [
            { name: 'name', description: '名字', required: true },
          ],
          handler: async (args) => ({
            success: true,
            code: 0,
            message: `Hello, ${args.name}!`,
          }),
        })
      );

      const result = await cli.run(['greet']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Hello');
    });

    it('用户注册带选项的命令', async () => {
      cli.register(
        createCommand({
          name: 'build',
          description: '构建项目',
          options: [
            { short: 'm', long: 'mode', description: '构建模式', valueType: 'string' },
            { short: 'w', long: 'watch', description: '监听模式', valueType: 'boolean' },
          ],
          handler: async (args) => ({
            success: true,
            code: 0,
            message: `Building in ${args.mode ?? 'production'} mode`,
          }),
        })
      );

      const result = await cli.run(['build']);
      expect(result.success).toBe(true);
    });

    it('用户注册带别名的命令', async () => {
      cli.register(
        createCommand({
          name: 'status',
          description: '显示状态',
          aliases: ['st', 'stat'],
          handler: async () => ({
            success: true,
            code: 0,
            message: 'System is running',
          }),
        })
      );

      const result = await cli.run(['status']);
      expect(result.success).toBe(true);
      expect(result.message).toBe('System is running');
    });

    it('用户注册的命令出现在帮助中', async () => {
      cli.register(
        createCommand({
          name: 'deploy',
          description: '部署应用',
          handler: async () => ({
            success: true,
            code: 0,
            message: 'Deployed',
          }),
        })
      );

      const result = await cli.run(['--help']);
      expect(result.message).toContain('deploy');
      expect(result.message).toContain('部署应用');
    });
  });

  // ── 用户场景：终端和主题信息 ────────────────────────────────────

  describe('场景七：用户查看终端和主题信息', () => {
    it('用户获取终端实例', () => {
      const terminal = cli.getTerminal();
      expect(terminal).toBeDefined();
      expect(terminal.features).toBeDefined();
    });

    it('用户获取当前主题', () => {
      const theme = cli.getTheme();
      expect(theme).toBeDefined();
      expect(theme.colors).toBeDefined();
    });

    it('用户查看终端能力', () => {
      const terminal = cli.getTerminal();
      expect(terminal.features.termType).toBeDefined();
      expect(terminal.features.colorDepth).toBeDefined();
      expect(typeof terminal.features.mouse).toBe('boolean');
      expect(typeof terminal.features.unicode).toBe('boolean');
    });

    it('用户查看 CLI 配置', () => {
      const config = cli.getConfig();
      expect(config.name).toBeDefined();
      expect(config.version).toBeDefined();
      expect(config.description).toBeDefined();
    });

    it('未启动交互模式时 Screen 为 null', () => {
      const screen = cli.getScreen();
      expect(screen).toBeNull();
    });
  });

  // ── 用户场景：完整 CLI 工作流 ───────────────────────────────────

  describe('场景八：用户完整 CLI 工作流', () => {
    it('用户执行典型日常工作流程', async () => {
      // 1. 用户注册自定义命令
      cli.register(
        createCommand({
          name: 'analyze',
          description: '分析项目',
          options: [
            { short: 'p', long: 'path', description: '项目路径', valueType: 'string' },
          ],
          handler: async (args) => ({
            success: true,
            code: 0,
            message: `Analyzing ${args.path ?? '.'}...`,
          }),
        })
      );

      // 2. 用户查看版本
      const versionResult = await cli.run(['--version']);
      expect(versionResult.success).toBe(true);

      // 3. 用户查看帮助
      const helpResult = await cli.run(['--help']);
      expect(helpResult.success).toBe(true);
      expect(helpResult.message).toContain('analyze');

      // 4. 用户运行自定义命令
      const analyzeResult = await cli.run(['analyze']);
      expect(analyzeResult.success).toBe(true);
      expect(analyzeResult.message).toContain('Analyzing');

      // 5. 用户记录操作日志
      cli.addOperationLog({
        agent_id: 'cli-user',
        operation_type: 'analyze',
        target_selector: '.',
        parameters: { path: '.' },
        status: 'success',
        before_state: {},
        after_state: { result: 'done' },
      });

      // 6. 用户查看操作历史
      const history = cli.getOperationHistory();
      expect(history.length).toBe(1);
      expect(history[0].operation_type).toBe('analyze');

      // 7. 用户查看日志
      const logResult = await cli.run(['log']);
      expect(logResult.success).toBe(true);
      expect(logResult.message).toContain('analyze');
    });
  });
});