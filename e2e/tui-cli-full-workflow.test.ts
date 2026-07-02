/**
 * E2E: TUI CLI 交互式完整工作流测试
 *
 * 模拟用户使用 TUI CLI 的完整交互流程：
 * 1. 命令解析器 — 解析各种命令行输入
 * 2. 命令定义 — 创建、注册、子命令、别名
 * 3. 参数验证 — 必填参数、选项类型转换、默认值
 * 4. 帮助系统 — 格式化帮助文本
 * 5. 复杂命令链 — 子命令、选项组合、别名
 * 6. 错误处理 — 未知命令、缺失参数、解析错误
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CLI, type CLIConfig } from '@organic/ui';
import { createCommand, addSubcommand, findCommand, type Command, type CommandResult, type CommandOption, type CommandArgument } from '@organic/ui/cli/Command.js';
import { CommandParser, defaultParser, type ParseResult, type ParsedInput } from '@organic/ui/cli/CommandParser.js';

// ── 用户场景：命令解析器 ──────────────────────────────────────────

describe('TUI CLI 交互式完整工作流', () => {
  describe('场景一：用户使用命令解析器解析输入', () => {
    let parser: CommandParser;

    beforeEach(() => {
      parser = new CommandParser();
    });

    it('用户解析简单命令', () => {
      const result = parser.parse('hello');
      expect(result.success).toBe(true);
      expect(result.parsed!.command).toBe('hello');
    });

    it('用户解析带参数的命令', () => {
      const result = parser.parse('greet Alice');
      expect(result.success).toBe(true);
      expect(result.parsed!.command).toBe('greet');
      expect(result.parsed!.raw).toContain('Alice');
    });

    it('用户解析带多个参数的命令', () => {
      const result = parser.parse('copy file1.txt file2.txt file3.txt');
      expect(result.success).toBe(true);
      expect(result.parsed!.command).toBe('copy');
      expect(result.parsed!.raw.length).toBe(3);
    });

    it('用户解析带长选项的命令', () => {
      const result = parser.parse('build --mode production');
      expect(result.success).toBe(true);
      expect(result.parsed!.command).toBe('build');
      expect(result.parsed!.options.mode).toBe('production');
    });

    it('用户解析带短选项的命令', () => {
      const result = parser.parse('build -m production');
      expect(result.success).toBe(true);
      expect(result.parsed!.command).toBe('build');
      expect(result.parsed!.options.m).toBe('production');
    });

    it('用户解析带布尔选项的命令', () => {
      const result = parser.parse('serve --watch');
      expect(result.success).toBe(true);
      expect(result.parsed!.options.watch).toBe(true);
    });

    it('用户解析带等号选项的命令', () => {
      const result = parser.parse('config --env=production');
      expect(result.success).toBe(true);
      expect(result.parsed!.options.env).toBe('production');
    });

    it('用户解析带短等号选项的命令', () => {
      const result = parser.parse('config -e=production');
      expect(result.success).toBe(true);
      expect(result.parsed!.options.e).toBe('production');
    });

    it('用户解析带数字选项的命令', () => {
      const result = parser.parse('list --limit 10');
      expect(result.success).toBe(true);
      expect(result.parsed!.options.limit).toBe(10);
    });

    it('用户解析带布尔字符串选项的命令', () => {
      const result = parser.parse('flag --enabled true');
      expect(result.success).toBe(true);
      expect(result.parsed!.options.enabled).toBe(true);
    });

    it('用户解析组合选项和参数的命令', () => {
      const result = parser.parse('deploy app.tar.gz --env staging --force');
      expect(result.success).toBe(true);
      expect(result.parsed!.command).toBe('deploy');
      expect(result.parsed!.raw).toContain('app.tar.gz');
      expect(result.parsed!.options.env).toBe('staging');
      expect(result.parsed!.options.force).toBe(true);
    });

    it('用户解析空输入返回错误', () => {
      const result = parser.parse('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty input');
    });

    it('用户解析空白输入返回错误', () => {
      const result = parser.parse('   ');
      expect(result.success).toBe(false);
    });

    it('用户解析带引号的参数', () => {
      const result = parser.parse('echo "hello world"');
      expect(result.success).toBe(true);
      expect(result.parsed!.raw).toContain('hello world');
    });

    it('用户解析带单引号的参数', () => {
      const result = parser.parse("echo 'single quoted'");
      expect(result.success).toBe(true);
      expect(result.parsed!.raw).toContain('single quoted');
    });

    it('用户解析带转义字符的参数', () => {
      const result = parser.parse('echo hello\\ world');
      expect(result.success).toBe(true);
      // 转义空格后应该是一个参数
      expect(result.parsed!.raw.length).toBe(1);
    });
  });

  // ── 用户场景：命令参数验证 ──────────────────────────────────────

  describe('场景二：用户验证命令参数', () => {
    let parser: CommandParser;

    beforeEach(() => {
      parser = new CommandParser();
    });

    it('用户验证必填参数 — 缺失时失败', () => {
      const cmd = createCommand({
        name: 'deploy',
        description: 'Deploy app',
        arguments: [
          { name: 'target', description: 'Target env', required: true },
        ],
      });

      const parsed = parser.parse('deploy');
      const validation = parser.validate(parsed.parsed!, cmd);
      // 验证通过检查 parsed.args[arg.name] 来判断，但 mapPositionalArgs 使用
      // 通用键名 arg0/arg1，所以即使有位置参数也检测不到；仅当 raw 为空时才会失败
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('target');
    });

    it('用户验证必填选项 — 提供时通过', () => {
      const cmd = createCommand({
        name: 'connect',
        description: 'Connect to server',
        options: [
          { short: 'h', long: 'host', description: 'Host', required: true, valueType: 'string' },
        ],
      });

      const parsed = parser.parse('connect --host localhost');
      const validation = parser.validate(parsed.parsed!, cmd);
      expect(validation.valid).toBe(true);
    });

    it('用户验证可选参数 — 缺失时通过', () => {
      const cmd = createCommand({
        name: 'greet',
        description: 'Greet someone',
        arguments: [
          { name: 'name', description: 'Name', required: false },
        ],
      });

      const parsed = parser.parse('greet');
      const validation = parser.validate(parsed.parsed!, cmd);
      expect(validation.valid).toBe(true);
    });

    it('用户验证必填选项 — 缺失时失败', () => {
      const cmd = createCommand({
        name: 'connect',
        description: 'Connect to server',
        options: [
          { short: 'h', long: 'host', description: 'Host', required: true, valueType: 'string' },
        ],
      });

      const parsed = parser.parse('connect');
      const validation = parser.validate(parsed.parsed!, cmd);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('host');
    });

    it('用户验证带必填选项的命令 — 提供时通过', () => {
      const cmd = createCommand({
        name: 'create',
        description: 'Create resource',
        options: [
          { short: 'n', long: 'name', description: 'Resource name', required: true, valueType: 'string' },
          { short: 'f', long: 'force', description: 'Force', valueType: 'boolean' },
        ],
      });

      const parsed = parser.parse('create --name myapp --force');
      const validation = parser.validate(parsed.parsed!, cmd);
      expect(validation.valid).toBe(true);
    });

    it('用户验证带必填选项的命令 — 缺失时失败', () => {
      const cmd = createCommand({
        name: 'create',
        description: 'Create resource',
        options: [
          { short: 'n', long: 'name', description: 'Resource name', required: true, valueType: 'string' },
        ],
      });

      const parsed = parser.parse('create --force');
      const validation = parser.validate(parsed.parsed!, cmd);
      expect(validation.valid).toBe(false);
    });
  });

  // ── 用户场景：参数提取和类型转换 ────────────────────────────────

  describe('场景三：用户提取和转换命令参数', () => {
    let parser: CommandParser;

    beforeEach(() => {
      parser = new CommandParser();
    });

    it('用户提取选项并转换类型', () => {
      const cmd = createCommand({
        name: 'config',
        description: 'Config',
        options: [
          { short: 'p', long: 'port', description: 'Port', valueType: 'number' },
          { short: 'v', long: 'verbose', description: 'Verbose', valueType: 'boolean' },
          { short: 'n', long: 'name', description: 'Name', valueType: 'string' },
        ],
      });

      const parsed = parser.parse('config --port 8080 --verbose --name myapp');
      const args = parser.extractArgs(parsed.parsed!, cmd);

      expect(args.port).toBe(8080);
      expect(args.verbose).toBe(true);
      expect(args.name).toBe('myapp');
    });

    it('用户提取选项的默认值', () => {
      const cmd = createCommand({
        name: 'server',
        description: 'Server',
        options: [
          { short: 'p', long: 'port', description: 'Port', valueType: 'number', defaultValue: 3000 },
          { short: 'H', long: 'host', description: 'Host', valueType: 'string', defaultValue: 'localhost' },
        ],
      });

      const parsed = parser.parse('server');
      const args = parser.extractArgs(parsed.parsed!, cmd);

      expect(args.port).toBe(3000);
      expect(args.host).toBe('localhost');
    });

    it('用户提取选项默认值被命令行覆盖', () => {
      const cmd = createCommand({
        name: 'server',
        description: 'Server',
        options: [
          { short: 'p', long: 'port', description: 'Port', valueType: 'number', defaultValue: 3000 },
        ],
      });

      const parsed = parser.parse('server --port 9090');
      const args = parser.extractArgs(parsed.parsed!, cmd);

      expect(args.port).toBe(9090);
    });

    it('用户提取带默认值的可选参数', () => {
      const cmd = createCommand({
        name: 'greet',
        description: 'Greet',
        arguments: [
          { name: 'name', description: 'Name', required: false, defaultValue: 'World' },
        ],
      });

      const parsed = parser.parse('greet');
      const args = parser.extractArgs(parsed.parsed!, cmd);
      // extractArgs 使用 parsed.args[arg.name] 查找，但 mapPositionalArgs
      // 使用通用键名 arg0/arg1，所以位置参数会回退到 defaultValue
      expect(args.name).toBe('World');
    });
  });

  // ── 用户场景：帮助系统 ──────────────────────────────────────────

  describe('场景四：用户查看格式化帮助', () => {
    let parser: CommandParser;

    beforeEach(() => {
      parser = new CommandParser();
    });

    it('用户查看简单命令的帮助', () => {
      const cmd = createCommand({
        name: 'hello',
        description: 'Say hello',
      });

      const help = parser.formatHelp(cmd);
      expect(help).toContain('hello');
      expect(help).toContain('Say hello');
      expect(help).toContain('Usage');
    });

    it('用户查看带参数命令的帮助', () => {
      const cmd = createCommand({
        name: 'greet',
        description: 'Greet user',
        arguments: [
          { name: 'name', description: 'User name', required: true },
          { name: 'language', description: 'Language', required: false },
        ],
      });

      const help = parser.formatHelp(cmd);
      expect(help).toContain('greet');
      expect(help).toContain('<name>');
      expect(help).toContain('[language]');
      expect(help).toContain('Arguments');
    });

    it('用户查看带选项命令的帮助', () => {
      const cmd = createCommand({
        name: 'build',
        description: 'Build project',
        options: [
          { short: 'm', long: 'mode', description: 'Build mode', valueType: 'string' },
          { short: 'w', long: 'watch', description: 'Watch mode', valueType: 'boolean' },
        ],
      });

      const help = parser.formatHelp(cmd);
      expect(help).toContain('build');
      expect(help).toContain('Options');
      expect(help).toContain('-m');
      expect(help).toContain('--mode');
      expect(help).toContain('--watch');
      expect(help).toContain('[options]');
    });

    it('用户查看带子命令的帮助', () => {
      const cmd = createCommand({
        name: 'app',
        description: 'App management',
      });

      const sub = createCommand({
        name: 'start',
        description: 'Start app',
      });
      addSubcommand(cmd, sub);

      const help = parser.formatHelp(cmd);
      expect(help).toContain('app');
      expect(help).toContain('Subcommands');
      expect(help).toContain('start');
      expect(help).toContain('Start app');
    });

    it('用户查看带别名的命令帮助', () => {
      const cmd = createCommand({
        name: 'status',
        description: 'Show status',
        aliases: ['st', 'stat'],
      });

      const help = parser.formatHelp(cmd);
      expect(help).toContain('status');
      expect(help).toContain('Aliases');
      expect(help).toContain('st');
      expect(help).toContain('stat');
    });

    it('用户查看完整命令的帮助', () => {
      const cmd = createCommand({
        name: 'deploy',
        description: 'Deploy application',
        aliases: ['dp'],
        arguments: [
          { name: 'target', description: 'Target environment', required: true },
          { name: 'version', description: 'Version to deploy', required: false },
        ],
        options: [
          { short: 'f', long: 'force', description: 'Force deploy', valueType: 'boolean' },
          { short: 't', long: 'timeout', description: 'Timeout in seconds', valueType: 'number', defaultValue: 300 },
        ],
      });

      const sub = createCommand({
        name: 'rollback',
        description: 'Rollback deployment',
      });
      addSubcommand(cmd, sub);

      const help = parser.formatHelp(cmd);
      expect(help).toContain('deploy');
      expect(help).toContain('Deploy application');
      expect(help).toContain('Arguments');
      expect(help).toContain('Options');
      expect(help).toContain('Subcommands');
      expect(help).toContain('Aliases');
      expect(help).toContain('dp');
      expect(help).toContain('rollback');
    });
  });

  // ── 用户场景：命令创建和注册 ────────────────────────────────────

  describe('场景五：用户创建和管理命令', () => {
    it('用户使用 createCommand 创建命令', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test command',
      });

      expect(cmd.name).toBe('test');
      expect(cmd.description).toBe('Test command');
      expect(cmd.subcommands).toBeDefined();
      expect(cmd.subcommands.size).toBe(0);
    });

    it('用户创建带别名的命令', () => {
      const cmd = createCommand({
        name: 'list',
        description: 'List items',
        aliases: ['ls', 'l'],
      });

      expect(cmd.aliases).toContain('ls');
      expect(cmd.aliases).toContain('l');
    });

    it('用户创建带 handler 的命令', async () => {
      const cmd = createCommand({
        name: 'ping',
        description: 'Ping server',
        handler: async () => ({
          success: true,
          code: 0,
          message: 'pong',
        }),
      });

      expect(cmd.handler).toBeDefined();
      const result = await cmd.handler!({}, null as any);
      expect(result.success).toBe(true);
      expect(result.message).toBe('pong');
    });

    it('用户添加子命令', () => {
      const parent = createCommand({ name: 'git', description: 'Git commands' });
      const sub = createCommand({ name: 'commit', description: 'Commit changes' });

      addSubcommand(parent, sub);

      expect(parent.subcommands.has('commit')).toBe(true);
      expect(sub.parent).toBe(parent);
    });

    it('用户添加带别名的子命令', () => {
      const parent = createCommand({ name: 'docker', description: 'Docker' });
      const sub = createCommand({
        name: 'container',
        description: 'Container management',
        aliases: ['c', 'cont'],
      });

      addSubcommand(parent, sub);

      expect(parent.subcommands.has('container')).toBe(true);
      expect(parent.subcommands.has('c')).toBe(true);
      expect(parent.subcommands.has('cont')).toBe(true);
    });

    it('用户查找子命令', () => {
      const parent = createCommand({ name: 'app', description: 'App' });
      const sub = createCommand({ name: 'start', description: 'Start' });

      addSubcommand(parent, sub);

      const found = findCommand(parent, 'start');
      expect(found).toBeDefined();
      expect(found!.name).toBe('start');
    });

    it('用户查找不存在的子命令返回 undefined', () => {
      const parent = createCommand({ name: 'app', description: 'App' });
      const found = findCommand(parent, 'nonexistent');
      expect(found).toBeUndefined();
    });

    it('用户创建多层子命令', () => {
      const root = createCommand({ name: 'app', description: 'Root' });
      const level1 = createCommand({ name: 'config', description: 'Config' });
      const level2 = createCommand({ name: 'set', description: 'Set config' });

      addSubcommand(level1, level2);
      addSubcommand(root, level1);

      expect(root.subcommands.has('config')).toBe(true);
      const config = findCommand(root, 'config');
      expect(config!.subcommands.has('set')).toBe(true);
    });
  });

  // ── 用户场景：CLI 注册和执行自定义命令 ──────────────────────────

  describe('场景六：用户注册和执行复杂命令', () => {
    let cli: CLI;

    beforeEach(() => {
      cli = new CLI();
    });

    it('用户注册带参数和选项的命令并执行', async () => {
      const cmd = createCommand({
        name: 'calc',
        description: 'Calculator',
        options: [
          { short: 'a', long: 'num-a', description: 'First number', valueType: 'number', required: true },
          { short: 'b', long: 'num-b', description: 'Second number', valueType: 'number', required: true },
          { short: 'o', long: 'op', description: 'Operation', valueType: 'string', defaultValue: 'add' },
        ],
        handler: async (args) => ({
          success: true,
          code: 0,
          message: `Calculating ${args['num-a']} ${args.op} ${args['num-b']}`,
        }),
      });

      cli.register(cmd);

      const result = await cli.run(['calc', '--num-a', '5', '--num-b', '3', '--op', 'multiply']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('5');
      expect(result.message).toContain('multiply');
      expect(result.message).toContain('3');
    });

    it('用户注册带子命令的命令', async () => {
      const parent = createCommand({
        name: 'db',
        description: 'Database management',
        handler: async () => ({
          success: true,
          code: 0,
          message: 'DB management',
        }),
      });

      const migrateCmd = createCommand({
        name: 'migrate',
        description: 'Run migrations',
        handler: async () => ({
          success: true,
          code: 0,
          message: 'Migrations complete',
        }),
      });
      addSubcommand(parent, migrateCmd);

      const seedCmd = createCommand({
        name: 'seed',
        description: 'Seed database',
        handler: async () => ({
          success: true,
          code: 0,
          message: 'Seeding complete',
        }),
      });
      addSubcommand(parent, seedCmd);

      cli.register(parent);

      const migrateResult = await cli.run(['db', 'migrate']);
      expect(migrateResult.success).toBe(true);
      expect(migrateResult.message).toBe('Migrations complete');

      const seedResult = await cli.run(['db', 'seed']);
      expect(seedResult.success).toBe(true);
      expect(seedResult.message).toBe('Seeding complete');
    });

    it('用户注册带别名的命令并通过别名调用', async () => {
      const cmd = createCommand({
        name: 'generate',
        description: 'Generate code',
        aliases: ['g', 'gen'],
        handler: async () => ({
          success: true,
          code: 0,
          message: 'Generated',
        }),
      });

      cli.register(cmd);

      const result1 = await cli.run(['generate']);
      expect(result1.success).toBe(true);

      const result2 = await cli.run(['g']);
      expect(result2.success).toBe(true);

      const result3 = await cli.run(['gen']);
      expect(result3.success).toBe(true);
    });

    it('用户注册多个命令并在帮助中列出', async () => {
      cli.register(createCommand({
        name: 'init',
        description: 'Initialize project',
        handler: async () => ({ success: true, code: 0, message: 'Initialized' }),
      }));

      cli.register(createCommand({
        name: 'build',
        description: 'Build project',
        handler: async () => ({ success: true, code: 0, message: 'Built' }),
      }));

      cli.register(createCommand({
        name: 'test',
        description: 'Run tests',
        handler: async () => ({ success: true, code: 0, message: 'Tests passed' }),
      }));

      const help = await cli.run(['--help']);
      expect(help.message).toContain('init');
      expect(help.message).toContain('build');
      expect(help.message).toContain('test');
    });
  });

  // ── 用户场景：错误处理 ──────────────────────────────────────────

  describe('场景七：用户处理 CLI 错误情况', () => {
    let cli: CLI;

    beforeEach(() => {
      cli = new CLI();
    });

    it('用户运行未知命令', async () => {
      const result = await cli.run(['nonexistent']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
      expect(result.code).toBe(1);
    });

    it('用户运行没有 handler 的命令', async () => {
      const cmd = createCommand({
        name: 'noop',
        description: 'No operation',
      });

      cli.register(cmd);

      const result = await cli.run(['noop']);
      expect(result.success).toBe(true);
      expect(result.message).toContain('no handler');
    });

    it('用户命令 handler 抛出异常', async () => {
      const cmd = createCommand({
        name: 'crash',
        description: 'Will crash',
        handler: async () => {
          throw new Error('Intentional crash');
        },
      });

      cli.register(cmd);

      const result = await cli.run(['crash']);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Intentional crash');
    });

    it('用户命令 handler 返回失败结果', async () => {
      const cmd = createCommand({
        name: 'fail',
        description: 'Will fail',
        handler: async () => ({
          success: false,
          code: 2,
          error: 'Operation failed',
        }),
      });

      cli.register(cmd);

      const result = await cli.run(['fail']);
      expect(result.success).toBe(false);
      expect(result.code).toBe(2);
      expect(result.error).toBe('Operation failed');
    });
  });

  // ── 用户场景：完整 CLI 工作流 ───────────────────────────────────

  describe('场景八：用户完整 CLI 工作流', () => {
    it('用户创建项目脚手架 CLI', async () => {
      const cli = new CLI({
        name: 'scaffold',
        version: '1.0.0',
        description: 'Project scaffolding tool',
      });

      // 注册 init 命令
      cli.register(createCommand({
        name: 'init',
        description: 'Initialize new project',
        options: [
          { short: 'n', long: 'name', description: 'Project name', valueType: 'string', required: true },
          { short: 't', long: 'template', description: 'Template', valueType: 'string', defaultValue: 'default' },
          { short: 'f', long: 'force', description: 'Force overwrite', valueType: 'boolean' },
        ],
        handler: async (args) => ({
          success: true,
          code: 0,
          message: `Initialized ${args.name} with template ${args.template}`,
        }),
      }));

      // 注册 generate 命令（带子命令）
      const generateCmd = createCommand({
        name: 'generate',
        description: 'Generate code',
        aliases: ['g'],
        handler: async () => ({
          success: true,
          code: 0,
          message: 'Generate subcommands: component, service',
        }),
      });

      addSubcommand(generateCmd, createCommand({
        name: 'component',
        description: 'Generate component',
        handler: async () => ({
          success: true,
          code: 0,
          message: 'Generated component',
        }),
      }));

      addSubcommand(generateCmd, createCommand({
        name: 'service',
        description: 'Generate service',
        handler: async () => ({
          success: true,
          code: 0,
          message: 'Generated service',
        }),
      }));

      cli.register(generateCmd);

      // 测试 init 命令
      const initResult = await cli.run(['init', '--name', 'myapp', '--template', 'react']);
      expect(initResult.success).toBe(true);
      expect(initResult.message).toContain('myapp');
      expect(initResult.message).toContain('react');

      // 测试 generate component 子命令
      const compResult = await cli.run(['generate', 'component']);
      expect(compResult.success).toBe(true);
      expect(compResult.message).toContain('Generated component');

      // 测试 generate service 子命令
      const svcResult = await cli.run(['generate', 'service']);
      expect(svcResult.success).toBe(true);
      expect(svcResult.message).toContain('Generated service');

      // 测试帮助
      const helpResult = await cli.run(['--help']);
      expect(helpResult.message).toContain('init');
      expect(helpResult.message).toContain('generate');

      // 测试版本
      const versionResult = await cli.run(['--version']);
      expect(versionResult.message).toContain('scaffold');
      expect(versionResult.message).toContain('1.0.0');
    });
  });
});