# CLI 参考手册

## 基本信息

**文档类型**: CLI 参考
**版本**: 0.1.0
**状态**: 已发布

---

## 概述

Organic-Interface 提供完整的命令行界面（CLI），支持交互式 REPL 模式和命令行参数模式。CLI 基于 `@organic/ui` 包构建，提供命令注册、参数解析、帮助系统、操作日志等完整功能。

---

## 安装与启动

### 安装

```bash
# 网络安装（推荐）
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash

# 确认安装
organic --version
```

### 启动

```bash
# 交互式 REPL 模式
organic

# 命令行模式
organic <command> [options] [arguments]
```

---

## 全局选项

| 选项        | 简写 | 说明         |
| ----------- | ---- | ------------ |
| `--help`    | `-h` | 显示帮助信息 |
| `--version` | `-v` | 显示版本号   |

---

## 内置命令

### help — 显示帮助

```bash
# 显示所有可用命令
organic help
organic --help

# 显示特定命令的帮助
organic help <command>
```

**输出示例**:

```
organic-cli v0.1.0

Available commands:
  help      Display help information
  history   View operation history
  log       View operation logs

Usage: organic <command> [options]
```

### history — 操作历史

```bash
# 查看所有操作历史
organic history

# 查看指定数量的历史
organic history --limit 10
```

**输出示例**:

```
Operation History (2 entries):
1. click  #submit-btn  [success]  agent-001
2. input  #username    [success]  agent-001
```

### log — 操作日志

```bash
# 查看所有日志
organic log

# 按 Agent ID 筛选
organic log --agent agent-001

# 按操作类型筛选
organic log --type click

# 按状态筛选
organic log --status failed

# 限制条目数
organic log --limit 20

# 组合筛选
organic log --agent agent-001 --type click --status success
```

**输出示例**:

```
Operation Logs (3 entries):
1. click  #login  success  agent-001  2024-01-15T10:30:00Z
2. input  #user   success  agent-001  2024-01-15T10:30:01Z
3. click  #submit failed  agent-001  2024-01-15T10:30:02Z
```

---

## 命令系统

### 命令定义

使用 `createCommand` 定义命令：

```typescript
import { createCommand } from '@organic/ui/cli/Command.js';

const cmd = createCommand({
  name: 'greet', // 命令名称（必填）
  description: '打招呼', // 命令描述
  aliases: ['hello'], // 命令别名
  arguments: [
    // 位置参数
    { name: 'name', description: '名字', required: true },
    { name: 'language', description: '语言', required: false, defaultValue: 'zh' },
  ],
  options: [
    // 命名选项
    { short: 'u', long: 'uppercase', description: '大写输出', valueType: 'boolean' },
    { short: 't', long: 'times', description: '重复次数', valueType: 'number', defaultValue: 1 },
  ],
  handler: async args => ({
    // 命令处理器
    success: true,
    code: 0,
    message: `Hello, ${args.name}!`,
  }),
});
```

### 命令注册

```typescript
import { CLI } from '@organic/ui';

const cli = new CLI();
cli.register(cmd);
```

### 子命令

```typescript
import { addSubcommand } from '@organic/ui/cli/Command.js';

const parent = createCommand({ name: 'db', description: '数据库管理' });
const migrate = createCommand({ name: 'migrate', description: '运行迁移' });
const seed = createCommand({ name: 'seed', description: '填充数据' });

addSubcommand(parent, migrate);
addSubcommand(parent, seed);

cli.register(parent);

// 使用
organic db migrate
organic db seed
```

### 通过别名调用

```typescript
const cmd = createCommand({
  name: 'generate',
  aliases: ['g', 'gen'],
  description: '生成代码',
});

// 以下三种调用等价
organic generate
organic g
organic gen
```

---

## 参数解析

### 参数类型

| 类型     | 说明                | 示例                        |
| -------- | ------------------- | --------------------------- |
| 位置参数 | 按位置顺序传递      | `organic deploy app.tar.gz` |
| 长选项   | `--name value` 格式 | `organic --env production`  |
| 短选项   | `-n value` 格式     | `organic -e production`     |
| 布尔选项 | 无值，出现即为 true | `organic --force`           |
| 等号选项 | `--name=value` 格式 | `organic --env=production`  |
| 数字选项 | 自动转换为 number   | `organic --limit 10`        |

### 选项值类型

| 类型      | 说明             | 示例           |
| --------- | ---------------- | -------------- |
| `string`  | 字符串值（默认） | `--name myapp` |
| `number`  | 数字值，自动转换 | `--port 8080`  |
| `boolean` | 布尔值，无值参数 | `--verbose`    |

### 引号处理

```bash
# 带空格的参数
organic echo "hello world"

# 单引号
organic echo 'hello world'

# 转义空格
organic echo hello\ world
```

### 解析错误

| 错误                        | 说明         |
| --------------------------- | ------------ |
| `Empty input`               | 输入为空     |
| `Unknown command`           | 命令未注册   |
| `Missing required argument` | 缺少必填参数 |
| `Missing required option`   | 缺少必填选项 |

---

## 操作日志系统

### 添加操作日志

```typescript
cli.addOperationLog({
  agent_id: 'agent-001',
  operation_type: 'click',
  target_selector: '#submit-btn',
  parameters: { x: 100, y: 200 },
  status: 'success',
  before_state: {},
  after_state: {},
  error_message: undefined,
});
```

### 查看操作历史

```typescript
const history = cli.getOperationHistory();
// 返回 OperationLogEntry[]
```

### 清除操作历史

```typescript
cli.clearHistory();
```

---

## 交互式模式

### 启动交互式模式

```typescript
const cli = new CLI({
  name: 'my-cli',
  version: '1.0.0',
  description: 'My CLI tool',
  interactive: true,
  historyPath: '/tmp/cli-history',
});

// 启动 REPL
await cli.startInteractive();
```

### 交互式模式功能

- **命令历史**: 上下箭头浏览历史命令
- **Tab 补全**: 命令和参数自动补全
- **实时反馈**: 命令执行结果即时显示
- **Ctrl+C 退出**: 安全退出交互模式

---

## 终端集成

### 获取终端实例

```typescript
const terminal = cli.getTerminal();
console.log(terminal.features.termType); // 终端类型
console.log(terminal.features.colorDepth); // 颜色深度
console.log(terminal.features.mouse); // 鼠标支持
```

### 获取主题

```typescript
const theme = cli.getTheme();
console.log(theme.colors.primary); // 主色调
console.log(theme.colors.success); // 成功色
```

### 获取屏幕

```typescript
const screen = cli.getScreen(); // 交互模式启动后可用
```

---

## 相关文档

- [配置参考](./configuration.md) — 完整配置选项
- [TUI 组件参考](./tui-components.md) — 终端 UI 组件
- [常见工作流](./common-workflows.md) — 实际操作示例
