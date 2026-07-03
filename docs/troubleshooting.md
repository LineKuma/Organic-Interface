# 故障排除

## 基本信息

**文档类型**: 故障排除指南
**版本**: 0.1.0
**状态**: 已发布

---

## 概述

本文档收录 Organic-Interface 使用过程中可能遇到的常见问题及解决方案。按问题类别组织，每个问题包含症状描述、原因分析和解决步骤。

---

## 安装问题

### 安装脚本 404 错误

**症状**:
```
curl: (22) The requested URL returned error: 404
```

**原因**: 指定的版本或分支不存在。

**解决方案**:
```bash
# 1. 确认使用正确的分支
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash

# 2. 检查 GitHub Release 是否存在
curl -s https://api.github.com/repos/LineKuma/Organic-Interface/releases/latest

# 3. 尝试从源码安装
git clone https://github.com/LineKuma/Organic-Interface.git
cd Organic-Interface
pnpm install
pnpm build
```

### 权限被拒绝

**症状**:
```
EACCES: permission denied, mkdir '/usr/local/lib/organic'
```

**原因**: 安装目录需要管理员权限。

**解决方案**:
```bash
# 安装到用户目录
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- --dir ~/organic
```

### pnpm 未安装

**症状**:
```
pnpm: command not found
```

**解决方案**:
```bash
# 安装 pnpm
npm install -g pnpm

# 或使用 corepack
corepack enable
corepack prepare pnpm@latest --activate
```

---

## 运行问题

### 命令未找到

**症状**:
```
organic: command not found
```

**原因**: 安装后未刷新环境变量，或 PATH 未包含安装目录。

**解决方案**:
```bash
# 刷新环境变量
source ~/.bashrc  # 或 source ~/.zshrc

# 检查 PATH
echo $PATH | grep organic

# 手动添加 PATH
export PATH="$HOME/.organic/bin:$PATH"
```

### 模块未找到

**症状**:
```
Cannot find module '@organic/kernel'
```

**原因**: 依赖未正确安装或构建产物缺失。

**解决方案**:
```bash
# 重新安装依赖
pnpm install --no-frozen-lockfile

# 重新构建
pnpm build

# 清理后重试
pnpm clean
pnpm install
pnpm build
```

### 类型错误

**症状**:
```
Type 'string' is not assignable to type 'UIPermissionLevel'
```

**原因**: 使用了不正确的类型值。

**解决方案**:
```typescript
// 正确的权限级别值
type UIPermissionLevel = 'L1' | 'L2' | 'L3' | 'L4';

// 使用正确的值
const level: UIPermissionLevel = 'L2';  // ✓
// const level: UIPermissionLevel = 'L5';  // ✗ 不存在
```

---

## 沙箱问题

### 权限被拒绝

**症状**:
```
Operation denied: Insufficient permission level
```

**原因**: 当前权限级别不足，无法执行该操作。

**解决方案**:
```typescript
// 1. 检查当前权限级别
const session = sandbox.getSession(sessionId);
console.log(session.permissionLevel); // 当前级别

// 2. 提升权限级别
const elevatedSession = sandbox.createSession('agent-001', 'L3');

// 3. 或降低操作要求（修改允许的操作列表）
sandbox.updateConfig({
  allowedOperations: ['scroll', 'hover', 'wait', 'getText'],
});
```

### 操作被拒绝

**症状**:
```
Operation denied: Operation not allowed
```

**原因**: 该操作类型不在允许列表中。

**解决方案**:
```typescript
// 检查当前允许的操作
const config = sandbox.getConfig();
console.log(config.allowedOperations);

// 添加允许的操作
sandbox.updateConfig({
  allowedOperations: [...config.allowedOperations, 'click'],
});
```

### 达到最大操作数限制

**症状**:
```
Maximum operations per session reached
```

**原因**: 单会话操作数超过 `maxOperationsPerSession` 限制。

**解决方案**:
```typescript
// 1. 提高限制
sandbox.updateConfig({ maxOperationsPerSession: 5000 });

// 2. 或创建新会话
const newSession = sandbox.createSession('agent-001');
```

### 会话已终止

**症状**:
```
Session is not active
```

**原因**: 会话已被终止，无法继续操作。

**解决方案**:
```typescript
// 创建新会话
const newSession = sandbox.createSession('agent-001');
```

---

## UIAgent 问题

### 无活跃会话

**症状**:
```
No active session
```

**原因**: 在调用 `execute()` 前未创建会话。

**解决方案**:
```typescript
// 确保先启动 Agent 再创建会话
await agent.start();
const session = agent.startSession();

// 然后执行操作
await agent.execute({ type: 'click', input: { selector: '#btn' } });
```

### 操作被取消

**症状**:
```
Operation cancelled
```

**原因**: 敏感操作（如 input）需要用户确认，但未确认。

**解决方案**:
```typescript
// 方案一：启用自动确认
const agent = new UIAgent({
  autoConfirmSensitive: true,
});

// 方案二：使用 force 选项跳过确认
await agent.execute({
  type: 'input',
  input: { selector: '#username', value: 'admin' },
  options: { force: true },
});
```

### Agent 未启动

**症状**:
```
Cannot create session: Agent is not running
```

**原因**: 在调用 `startSession()` 前未调用 `start()`。

**解决方案**:
```typescript
// 正确顺序
await agent.start();
const session = agent.startSession(); // 必须在 start() 之后
```

---

## CLI 问题

### 未知命令

**症状**:
```
Unknown command: 'xxx'
```

**原因**: 命令未注册或拼写错误。

**解决方案**:
```typescript
// 1. 查看可用命令
await cli.run(['--help']);

// 2. 确认命令已注册
cli.register(myCommand);

// 3. 使用别名
cli.register(createCommand({
  name: 'generate',
  aliases: ['g', 'gen'],
  // ...
}));
await cli.run(['g']); // 通过别名调用
```

### 命令参数缺失

**症状**:
```
Missing required argument: 'name'
```

**原因**: 未提供必填参数。

**解决方案**:
```typescript
// 查看命令参数要求
await cli.run(['help', 'command-name']);

// 提供必填参数
await cli.run(['greet', 'Alice']); // 提供 name 参数
```

### 解析错误

**症状**:
```
Empty input
```

**原因**: 传递给 `parser.parse()` 的字符串为空。

**解决方案**:
```typescript
const input = ''; // 空输入
// 添加非空检查
if (input.trim().length === 0) {
  console.log('Please enter a command');
  return;
}
const result = parser.parse(input);
```

---

## 终端问题

### 鼠标功能不可用

**症状**: 鼠标事件未触发。

**原因**: 终端不支持鼠标功能，或未启用。

**解决方案**:
```typescript
// 检查终端支持
const terminal = Terminal.init();
if (!terminal.isAvailable('mouse')) {
  console.log('当前终端不支持鼠标');
}

// 强制启用
const terminal = Terminal.init({ mouse: 'on' });
```

### 颜色显示异常

**症状**: 终端输出颜色不正确或显示乱码。

**原因**: 终端颜色深度不足。

**解决方案**:
```typescript
// 强制指定颜色深度
Terminal.init({ colorDepth: '256' });

// 使用低色彩主题
import { lowColorTheme } from '@organic/ui';
// 使用 lowColorTheme 进行渲染

// 或使用无色主题
import { noneTheme } from '@organic/ui';
// 使用 noneTheme 进行渲染
```

### Unicode 字符显示异常

**症状**: 边框字符显示为乱码。

**原因**: 终端不支持 Unicode 或字体不支持。

**解决方案**:
```typescript
// 强制禁用 Unicode
Terminal.init({ unicode: 'off' });

// 使用低色彩主题（自动禁用 Unicode 前缀）
// lowColorTheme.useUnicodePrefixes === false
```

---

## 测试问题

### 测试超时

**症状**:
```
Test timed out in 5000ms
```

**解决方案**:
```typescript
// 增加超时时间
it('长时间操作', async () => {
  // ...
}, 30000); // 30 秒超时
```

### 模拟模块未找到

**症状**:
```
Cannot find module '@organic/utils'
```

**解决方案**:
```typescript
// 在测试文件中添加 mock
vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));
```

---

## 构建问题

### TypeScript 编译错误

**症状**:
```
error TS2307: Cannot find module '@organic/kernel'
```

**解决方案**:
```bash
# 确保先构建依赖包
pnpm turbo build

# 或按依赖顺序构建
pnpm --filter @organic/utils build
pnpm --filter @organic/kernel build
pnpm --filter @organic/plugins build
pnpm --filter @organic/tools build
pnpm --filter @organic/agent build
pnpm --filter @organic/ui build
```

### 锁文件冲突

**症状**:
```
ERR_PNPM_OUTDATED_LOCKFILE
```

**解决方案**:
```bash
# 使用非冻结模式安装
pnpm install --no-frozen-lockfile

# 或更新锁文件
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: update lockfile"
```

---

## 相关文档

- [CLI 参考](./cli-reference.md) — 命令详解
- [配置参考](./configuration.md) — 配置选项
- [开发指南](./development-guide.md) — 开发工作流
- [安全模型](./security-model.md) — 权限和安全