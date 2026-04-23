# Vitest Monorepo 测试框架配置经验

## 文档信息

| 字段 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 创建日期 | 2026-04-21 |
| 作者 | Learner |
| 描述 | TypeScript Monorepo 项目中 Vitest 测试框架的配置与实践经验 |

## 概述

本文档记录 Organic-Interface 项目（pnpm workspace + Turbo monorepo）中 Vitest 测试框架的搭建过程与配置经验。

---

## 1. 测试框架选型

### 1.1 框架选择：Vitest

| 维度 | 说明 |
|------|------|
| 优势 | 原生 TypeScript 支持、Vite 快速 HMR、与 Jest API 兼容 |
| 适用场景 | TypeScript monorepo、快速迭代项目、需要良好类型检查的项目 |
| 替代方案 | Jest（配置更复杂）、Mocha + Chai（更轻量但配置工作量大） |

### 1.2 依赖配置

```json
// 根目录 package.json
{
  "devDependencies": {
    "vitest": "^1.4.0",
    "@vitest/coverage-v8": "^1.4.0"
  }
}
```

---

## 2. Vitest 配置方案

### 2.1 根目录配置文件

在项目根目录创建 `vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,                    // 全局测试函数（describe, it, expect 等）
    environment: 'node',             // Node.js 环境
    include: [
      'packages/kernel/src/__tests__/*.test.ts',
      'packages/plugins/src/base/__tests__/*.test.ts',
      'packages/plugins/src/interfaces/__tests__/*.test.ts',
      'packages/utils/src/__tests__/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      'packages/plugins/src/core-conversation/**',  // 排除特定目录
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.config.ts'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@organic/utils': path.resolve(__dirname, './packages/utils/src'),
      '@organic/kernel': path.resolve(__dirname, './packages/kernel/src'),
      '@organic/plugins': path.resolve(__dirname, './packages/plugins/src'),
      '@organic/agent': path.resolve(__dirname, './packages/agent/src'),
      '@organic/storage': path.resolve(__dirname, './packages/storage/src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs'],
  },
});
```

### 2.2 关键配置说明

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `globals: true` | 启用全局函数 | 允许直接使用 `describe`、`it`、`expect` 等，无需 import |
| `environment: 'node'` | Node 环境 | 不使用 jsdom/happy-dom，适用于服务端项目 |
| `include` | 路径数组 | 指定测试文件位置，支持 glob 模式 |
| `exclude` | 排除列表 | 排除 node_modules、dist、.turbo 和特定目录 |
| `testTimeout` | 10000ms | 单个测试的超时时间 |
| `resolve.alias` | 路径别名 | 将 npm 包名映射到本地源码路径 |

---

## 3. Monorepo 路径别名配置

### 3.1 配置原理

在 monorepo 中，测试运行时需要将 workspace 包名解析到本地源码目录，而非 node_modules 中的编译产物。

### 3.2 常见问题与解决

**问题**: `Cannot find module '@organic/utils'`

**原因**: TypeScript 编译后产物在 `dist/` 目录，但运行时无法正确解析

**解决方案**: 在 `resolve.alias` 中配置绝对路径映射

```typescript
resolve: {
  alias: {
    '@organic/utils': path.resolve(__dirname, './packages/utils/src'),
  },
}
```

### 3.3 注意事项

- 使用 `__dirname` 获取项目根目录的绝对路径
- 确保测试文件使用 `.test.ts` 后缀
- 所有被测试的包都应配置别名映射

---

## 4. 测试脚本配置

### 4.1 根目录 package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 4.2 测试命令说明

| 命令 | 用途 |
|------|------|
| `pnpm test` | 运行所有测试（单次执行） |
| `pnpm test:watch` | 监听模式，文件变化时自动重跑 |
| `pnpm test:coverage` | 生成覆盖率报告 |

---

## 5. 测试文件组织

### 5.1 目录结构

```
packages/
├── kernel/src/
│   ├── __tests__/
│   │   ├── EventBus.test.ts        # 20 tests
│   │   ├── LifecycleManager.test.ts # 19 tests
│   │   ├── PluginManager.test.ts   # 33 tests
│   │   └── Kernel.test.ts          # 40 tests
├── plugins/src/
│   ├── base/__tests__/
│   │   └── BasePlugin.test.ts      # 25 tests
│   ├── interfaces/__tests__/
│   │   └── PluginInterface.test.ts # 18 tests
├── utils/src/__tests__/
│   └── Logger.test.ts              # 30 tests
```

### 5.2 命名规范

- 测试文件：`{ModuleName}.test.ts`
- 目录：`__tests__`（ Vitest 约定）

---

## 6. 测试模式与实践

### 6.1 Mock 插件工厂函数

```typescript
// 创建可复用的 Mock 插件
const createMockPlugin = (
  name: string,
  version: string,
  description?: string
): PluginInterface => ({
  name,
  version,
  description,
  initialize: vi.fn(async () => ({ success: true })),
  execute: vi.fn(async (input: PluginInput): Promise<PluginOutput> => ({
    success: true,
    data: { action: input.action, result: 'executed' },
  })),
  shutdown: vi.fn(async () => {}),
});
```

### 6.2 异步测试处理

```typescript
// 等待异步事件分发
await new Promise(resolve => setImmediate(resolve));

// 或使用 setTimeout（需谨慎，避免固定等待）
await new Promise(resolve => setTimeout(resolve, 0));
```

### 6.3 生命周期钩子

```typescript
describe('Module', () => {
  let instance: Module;

  beforeEach(() => {
    instance = new Module();
  });

  afterEach(() => {
    instance.cleanup();  // 清理资源
  });
});
```

### 6.4 私有属性访问

使用类型断言访问私有属性（仅限测试代码）：

```typescript
// 访问私有属性
const config = (plugin as any).config;

// 调用私有方法
(await plugin as any).privateMethod();
```

---

## 7. 发现的问题与修复

### 7.1 可选方法调用问题

**问题描述**: 测试运行时出现 `TypeError: this.getConfigSchema is not a function`

**根因**: `getConfigSchema` 被定义为可选方法（使用 `?` 修饰符），但在代码中直接调用

**错误代码**:
```typescript
// BasePlugin.ts
const schema = this.getConfigSchema();  // 错误：可能为 undefined
```

**修复方案**:
```typescript
// BasePlugin.ts
const schema = this.getConfigSchema?.();  // 使用可选链操作符
```

### 7.2 测试超时配置

**问题**: 异步测试因超时失败

**解决方案**: 在 `vitest.config.ts` 中设置合理的超时时间

```typescript
testTimeout: 10000,   // 10秒
hookTimeout: 10000,  // 10秒
```

---

## 8. 测试覆盖率配置

### 8.1 V8 Provider 配置

```typescript
coverage: {
  provider: 'v8',                    // 使用 V8 引擎进行覆盖率统计
  reporter: ['text', 'json', 'html'], // 输出格式
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/*.test.ts',                   // 排除测试文件本身
    '**/*.config.ts',
  ],
}
```

### 8.2 覆盖率命令

```bash
# 生成覆盖率报告
pnpm test:coverage

# 查看覆盖率输出
# - text: 终端输出摘要
# - json: coverage/coverage-final.json
# - html: coverage/index.html（可浏览器查看）
```

---

## 9. 测试执行结果

| 指标 | 数值 |
|------|------|
| 测试文件数 | 7 个 |
| 测试用例数 | 185 个 |
| 通过率 | 100% (185/185) |

### 9.1 测试分布

| 包 | 测试文件 | 测试数 |
|----|---------|--------|
| kernel | EventBus.test.ts | 20 |
| kernel | LifecycleManager.test.ts | 19 |
| kernel | PluginManager.test.ts | 33 |
| kernel | Kernel.test.ts | 40 |
| plugins/base | BasePlugin.test.ts | 25 |
| plugins/interfaces | PluginInterface.test.ts | 18 |
| utils | Logger.test.ts | 30 |

---

## 10. 最佳实践总结

### 10.1 配置要点

| 实践 | 说明 |
|------|------|
| 统一配置位置 | 根目录 `vitest.config.ts` 集中管理 |
| 路径别名 | 解决 monorepo 依赖解析问题 |
| 合理的超时 | 避免异步测试不稳定 |
| 排除目录 | 排除 dist、node_modules 等 |

### 10.2 测试编写要点

| 实践 | 说明 |
|------|------|
| Mock 工厂函数 | 创建可复用的 mock 对象 |
| 生命周期清理 | `afterEach` 确保测试隔离 |
| 异步等待 | 使用 `setImmediate` 而非固定 sleep |
| 私有属性访问 | 使用 `as any` 类型断言 |

### 10.3 持续集成

建议在 CI 中配置：
```yaml
- name: Run tests
  run: pnpm test
- name: Run coverage
  run: pnpm test:coverage
```

---

## 更新历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-04-21 | 1.0.0 | 初始版本，记录 vitest monorepo 配置经验 |
