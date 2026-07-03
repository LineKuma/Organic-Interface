# 常见工作流

## 基本信息

**文档类型**: 用户指南
**版本**: 0.1.0
**状态**: 已发布

---

## 概述

本文档提供 Organic-Interface 的常见工作流指南，涵盖从安装部署到日常使用的完整操作流程。每个工作流按照用户实际操作步骤编写，可直接跟随执行。

---

## 工作流一：安装与首次使用

### 步骤 1：安装

```bash
# 网络安装（推荐）
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash

# 使环境变量生效
source ~/.bashrc
```

### 步骤 2：验证安装

```bash
organic --version
# 输出: organic-cli v0.1.0

organic --help
# 输出: 可用命令列表
```

### 步骤 3：进入交互模式

```bash
organic
# 进入 REPL 交互模式
```

---

## 工作流二：创建沙箱会话并执行 UI 操作

### 场景描述

用户需要安全地执行 UI 自动化操作，通过沙箱会话管理权限和操作记录。

### 步骤 1：创建沙箱实例

```typescript
import { Sandbox } from '@organic/ui';

// 使用默认配置创建沙箱
const sandbox = new Sandbox();

// 或使用自定义配置
const customSandbox = createSandbox({
  permissionLevel: 'L3',
  maxOperationsPerSession: 500,
  requireConfirmation: true,
});
```

### 步骤 2：创建会话

```typescript
// 创建 Agent 会话
const session = sandbox.createSession('agent-001', 'L2');

console.log(session.sessionId);    // session_xxx
console.log(session.status);       // 'active'
console.log(session.permissionLevel); // 'L2'
```

### 步骤 3：执行操作前检查权限

```typescript
// 检查点击操作的权限
const result = sandbox.checkPermission(session.sessionId, 'click', '#submit-btn');

if (result.allowed) {
  if (result.requiresConfirmation) {
    // 敏感操作需要确认
    console.log('需要确认:', result.warnings);
  }
  // 执行操作...
} else {
  console.log('权限被拒绝:', result.reason);
}
```

### 步骤 4：记录操作

```typescript
sandbox.recordOperation({
  session,
  operation: 'click',
  selector: '#submit-btn',
  timestamp: Date.now(),
});
```

### 步骤 5：查看操作历史

```typescript
const history = sandbox.getOperationHistory(session.sessionId);
console.log(`已执行 ${history.length} 个操作`);
```

### 步骤 6：结束会话

```typescript
sandbox.terminateSession(session.sessionId);
```

---

## 工作流三：使用 UIAgent 端到端自动化

### 场景描述

用户使用 UIAgent 执行完整的 UI 自动化流程，从启动 Agent 到执行操作再到结束会话。

### 步骤 1：创建并启动 Agent

```typescript
import { UIAgent } from '@organic/ui';

const agent = new UIAgent({
  agentId: 'my-agent',
  name: 'MyAgent',
  defaultTimeout: 30000,
});

await agent.start();
```

### 步骤 2：创建会话

```typescript
const session = agent.startSession();
```

### 步骤 3：执行单个操作

```typescript
// 点击按钮
await agent.execute({
  type: 'click',
  input: { selector: '#login-button' },
});

// 输入文本
await agent.execute({
  type: 'input',
  input: { selector: '#username', value: 'admin' },
});

// 等待元素出现
await agent.execute({
  type: 'wait',
  input: { selector: '#dashboard', condition: 'visible' },
});

// 读取文本
await agent.execute({
  type: 'getText',
  input: { selector: '.welcome-message' },
});
```

### 步骤 4：执行操作序列

```typescript
const results = await agent.executeSequence([
  { type: 'click', input: { selector: '#menu-btn' } },
  { type: 'wait', input: { selector: '#menu', condition: 'visible' } },
  { type: 'click', input: { selector: '#item-1' } },
  { type: 'getText', input: { selector: '.result' } },
]);
```

### 步骤 5：查看统计

```typescript
const stats = agent.getStats();
console.log(`总操作数: ${stats.totalOperations}`);
console.log(`成功率: ${stats.successRate}`);
```

### 步骤 6：暂停与恢复

```typescript
// 暂停 Agent
agent.pause();

// 恢复 Agent
agent.resume();
```

### 步骤 7：结束会话并停止 Agent

```typescript
await agent.endSession(session.sessionId);
await agent.stop();
```

---

## 工作流四：TUI 仪表盘展示

### 场景描述

用户使用 TUI 组件创建一个终端仪表盘，展示系统状态和运行信息。

### 步骤 1：显示应用 Banner

```typescript
import { Banner, Box, Progress, Output } from '@organic/ui';

const banner = new Banner();
const bannerOutput = banner.render({
  title: 'System Dashboard',
  version: '1.0.0',
  subtitle: 'Real-time monitoring',
  style: 'double',
  width: 70,
});
console.log(bannerOutput);
```

### 步骤 2：展示系统信息

```typescript
const box = new Box();
const sysInfo = box.renderKeyValue([
  ['CPU', '45%'],
  ['Memory', '8.2 GB / 16 GB'],
  ['Disk', '120 GB / 256 GB'],
  ['Uptime', '2h 30m'],
], { title: 'System Info', style: 'rounded' });
console.log(sysInfo);
```

### 步骤 3：展示服务状态

```typescript
const statusBox = box.render({
  title: 'Services',
  content: [
    'Web Server    ✓ Running',
    'Database      ✓ Running',
    'Cache         ✓ Running',
    'Queue         ✗ Stopped',
  ],
  style: 'single',
});
console.log(statusBox);
```

### 步骤 4：显示进度条

```typescript
const progress = new Progress({ total: 100, label: 'Syncing', style: 'bar' });

// 更新进度
progress.update(30);
progress.update(60);
progress.update(100);
```

---

## 工作流五：自定义 CLI 命令

### 场景描述

用户创建项目脚手架 CLI，包含 init 和 generate 命令。

### 步骤 1：创建 CLI 实例

```typescript
import { CLI } from '@organic/ui';
import { createCommand, addSubcommand } from '@organic/ui/cli/Command.js';

const cli = new CLI({
  name: 'scaffold',
  version: '1.0.0',
  description: 'Project scaffolding tool',
});
```

### 步骤 2：注册 init 命令

```typescript
cli.register(createCommand({
  name: 'init',
  description: 'Initialize new project',
  options: [
    { short: 'n', long: 'name', description: 'Project name', valueType: 'string', required: true },
    { short: 't', long: 'template', description: 'Template', valueType: 'string', defaultValue: 'default' },
  ],
  handler: async (args) => ({
    success: true,
    code: 0,
    message: `Initialized ${args.name} with template ${args.template}`,
  }),
}));
```

### 步骤 3：注册 generate 命令（含子命令）

```typescript
const generateCmd = createCommand({
  name: 'generate',
  description: 'Generate code',
  aliases: ['g'],
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
```

### 步骤 4：运行命令

```typescript
// 初始化项目
await cli.run(['init', '--name', 'myapp', '--template', 'react']);

// 生成组件
await cli.run(['generate', 'component']);

// 生成服务
await cli.run(['g', 'service']);
```

---

## 工作流六：终端能力检测与适配

### 场景描述

用户检测终端能力，根据终端特性适配 TUI 输出。

### 步骤 1：检测终端能力

```typescript
import { Terminal } from '@organic/ui';

const terminal = Terminal.init();
const features = terminal.features;

console.log('终端类型:', features.termType);
console.log('颜色深度:', terminal.colorDepth);
console.log('支持鼠标:', features.mouse);
console.log('支持 Unicode:', features.unicode);
console.log('支持 Emoji:', features.emoji);
console.log('终端尺寸:', terminal.dimensions);
```

### 步骤 2：根据终端能力适配

```typescript
if (terminal.isAvailable('trueColor')) {
  // 使用真彩色主题
  console.log('使用全彩主题');
} else if (terminal.isAvailable('256')) {
  // 使用 256 色主题
  console.log('使用 256 色主题');
} else {
  // 使用低色彩主题
  console.log('使用低色彩主题');
}
```

### 步骤 3：选择合适主题

```typescript
import { createAutoTheme } from '@organic/ui';

const theme = createAutoTheme();
// 自动根据终端能力选择最佳主题
```

---

## 工作流七：输出格式化日志

### 场景描述

用户使用 Output 组件输出结构化的部署日志。

### 步骤

```typescript
import { Output } from '@organic/ui';

const output = new Output();

// 标题
output.heading('Deployment Report');

// 信息
output.info('Starting deployment...');
output.keyValue('Environment', 'production');
output.keyValue('Version', '1.0.0');

// 分隔线
output.divider();

// 成功消息
output.success('Build completed');
output.success('Tests passed');

// 警告消息
output.warn('Coverage below threshold (78%)');

// 分隔线
output.divider();

// 编号列表
output.numbered(1, 'Upload artifacts');
output.numbered(2, 'Update database');
output.numbered(3, 'Restart services');

// 空行
output.newline();

// 完成
output.success('Deployment successful!');
```

---

## 相关文档

- [CLI 参考](./cli-reference.md) — 命令详解
- [TUI 组件参考](./tui-components.md) — 组件 API
- [配置参考](./configuration.md) — 配置选项
- [安全模型](./security-model.md) — 权限和安全