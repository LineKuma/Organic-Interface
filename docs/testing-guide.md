# 测试指南

## 基本信息

**文档类型**: 测试指南
**版本**: 0.1.0
**状态**: 已发布

---

## 概述

本文档描述 Organic-Interface 项目的测试策略、测试类型、测试规范和最佳实践。

---

## 测试策略

### 测试金字塔

```
         ┌──────┐
         │ E2E  │  端到端测试：测试用户完整操作流程
         ├──────┤
         │  UI  │  UI 测试：测试 TUI 组件渲染和交互
         ├──────┤
         │ Unit │  单元测试：测试单个模块/函数
         └──────┘
```

### 测试原则

1. **纯 UI 测试**: E2E 测试必须从用户视角出发，测试用户可见的 UI 行为
2. **用户操作逻辑**: 测试步骤按用户实际操作顺序编写
3. **无跳过逻辑**: 不允许使用 `if` 条件跳过断言
4. **确定性断言**: 每个测试用例的断言结果必须确定

---

## 测试框架

### 技术栈

| 工具 | 用途 | 版本 |
|------|------|------|
| Vitest | 测试框架 | 1.4+ |
| @vitest/coverage-v8 | 覆盖率 | 4.1+ |

### 配置文件

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/__tests__/**/*.test.ts', 'e2e/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

---

## 测试类型

### 单元测试

**位置**: `packages/<pkg>/src/__tests__/`

**目的**: 测试单个模块、类或函数的功能正确性。

**示例**:

```typescript
// packages/ui/src/core/__tests__/Sandbox.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Sandbox } from '../Sandbox.js';

describe('Sandbox', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = new Sandbox();
  });

  it('should create a session', () => {
    const session = sandbox.createSession('agent-001');
    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe('active');
  });
});
```

### E2E 测试

**位置**: `e2e/`

**目的**: 测试用户从开始到结束的完整操作流程。

**分类**:

| 分类 | 文件 | 测试场景 |
|------|------|----------|
| UI 沙箱 | `ui-sandbox-user-flow.test.ts` | 沙箱配置、会话管理、权限检查、操作记录 |
| UI Agent | `ui-agent-user-workflow.test.ts` | Agent 生命周期、UI 操作执行、统计、暂停恢复 |
| UI 组件 | `ui-components-user-interaction.test.ts` | Progress、Table、Prompt 组件交互 |
| UI CLI | `ui-cli-user-workflow.test.ts` | CLI 配置、命令、操作日志、自定义命令 |
| TUI 终端 | `tui-terminal-screen.test.ts` | 终端能力检测、屏幕管理、主题、ANSI |
| TUI 渲染 | `tui-rendering.test.ts` | Spinner、Banner、Box、Output 渲染 |
| TUI 鼠标 | `tui-mouse-interaction.test.ts` | 鼠标事件、SGR 序列、双击、拖拽 |
| TUI CLI | `tui-cli-full-workflow.test.ts` | 命令解析、参数验证、帮助系统、子命令 |

---

## 运行测试

### 命令

```bash
# 运行所有测试
pnpm test

# 运行 E2E 测试
pnpm --filter . vitest run e2e/

# 运行特定测试文件
pnpm --filter . vitest run e2e/tui-rendering.test.ts

# 监视模式
pnpm test:watch

# 覆盖率
pnpm test:coverage
```

### 按包运行

```bash
# 运行 UI 包的测试
pnpm --filter @organic/ui test

# 运行 Tools 包的测试
pnpm --filter @organic/tools test

# 运行 Kernel 包的测试
pnpm --filter @organic/kernel test
```

---

## 测试规范

### 命名规范

测试文件和测试用例使用中文描述，贴近用户操作场景：

```typescript
// 文件命名
e2e/ui-sandbox-user-flow.test.ts
e2e/tui-cli-full-workflow.test.ts

// 测试用例命名
describe('用户沙箱会话完整流程', () => {
  describe('场景一：用户打开沙箱并查看默认配置', () => {
    it('用户打开沙箱，默认已启用', () => { ... });
    it('用户查看沙箱默认安全配置', () => { ... });
  });
});
```

### 结构规范

```typescript
describe('场景X：用户操作描述', () => {
  let instance: ClassType;

  beforeEach(() => {
    // 统一的初始化
    instance = new ClassType();
  });

  it('用户执行某个操作 — 期望的结果', () => {
    // 1. 执行操作
    const result = instance.doSomething();

    // 2. 断言结果
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});
```

### 断言规范

```typescript
// ✓ 正确的断言
const mousedown = events.find(e => e.type === 'mousedown');
expect(mousedown).toBeDefined();
expect(mousedown!.button).toBe('left');

// ✗ 错误的断言（跳过逻辑）
const mousedown = events.find(e => e.type === 'mousedown');
if (mousedown) {
  expect(mousedown.button).toBe('left');
}
```

### Mock 规范

```typescript
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

## 测试覆盖率

### 目标

| 指标 | 目标 |
|------|------|
| 语句覆盖率 | > 80% |
| 分支覆盖率 | > 75% |
| 函数覆盖率 | > 80% |
| 行覆盖率 | > 80% |

### 查看覆盖率

```bash
pnpm test:coverage
# 报告在 coverage/ 目录
```

---

## 最佳实践

### 1. 一个测试只验证一种行为

```typescript
// ✓ 每个测试验证一个行为
it('用户点击鼠标左键', () => { ... });
it('用户点击鼠标中键', () => { ... });
it('用户点击鼠标右键', () => { ... });

// ✗ 一个测试验证多个行为
it('用户点击所有鼠标按钮', () => { ... }); // 太长且不专注
```

### 2. 测试边界条件

```typescript
it('用户查找不存在的会话返回 undefined', () => {
  const found = sandbox.getSession('nonexistent');
  expect(found).toBeUndefined();
});

it('用户达到最大操作数限制后无法继续操作', () => {
  sandbox.updateConfig({ maxOperationsPerSession: 3 });
  // ... 执行 3 次操作
  const result = sandbox.checkPermission(sessionId, 'click', '#btn');
  expect(result.allowed).toBe(false);
});
```

### 3. 测试错误路径

```typescript
it('用户使用无效会话操作 — 权限被拒绝', () => {
  const result = sandbox.checkPermission('invalid-session', 'click', '#btn');
  expect(result.allowed).toBe(false);
  expect(result.reason).toBe('Invalid session');
});
```

### 4. 使用 beforeEach 减少重复

```typescript
describe('场景X', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = new Sandbox();
  });

  // 多个测试共享同一个 sandbox 实例
});
```

### 5. 测试名称描述用户行为

```typescript
// ✓ 描述用户操作
it('用户创建沙箱会话后获得会话 ID', () => { ... });
it('用户提升权限到 L3 后可以执行 input 操作', () => { ... });

// ✗ 技术描述
it('createSession returns session with id', () => { ... });
it('L3 allows input', () => { ... });
```

---

## 相关文档

- [开发指南](./development-guide.md) — 开发流程
- [常见工作流](./common-workflows.md) — 使用示例
- [故障排除](./troubleshooting.md) — 测试相关问题