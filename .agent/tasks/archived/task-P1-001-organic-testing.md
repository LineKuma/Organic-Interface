# task-P1-001-organic-testing.md

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P1-001 |
| **优先级** | P1 |
| **标题** | organic-testing |
| **描述** | 为 organic-interface 项目配置完整测试框架并编写核心模块测试 |
| **依赖任务** | 无 |
| **可并行** | 是 |
| **创建时间** | 2026-03-05 |
| **执行分支** | agent-develop |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |

## 归档信息

| 字段 | 内容 |
|------|------|
| **归档时间** | 2026-04-30 |
| **归档原因** | 任务已被 task-P1-001-organic-enhanced-testing 替代（该任务也已停用） |
| **当前状态** | 已完成且被替代，不再需要 |

---

## 任务背景

Organic-Interface 是一个基于插件的代理框架（Plugin-based Agent Framework），采用 monorepo 结构（pnpm workspace + turbo）。项目使用 TypeScript 开发，现有部分 vitest 测试文件但存在以下问题：
1. vitest 依赖未安装
2. 测试脚本未配置
3. 缺少 vitest 配置文件
4. 测试覆盖不完整，仅 core-conversation 插件有测试

本任务旨在建立完整的测试体系，覆盖所有核心模块。

---

## 任务内容

### 1. 环境准备

**1.1 安装测试依赖**

在根目录 `package.json` 的 devDependencies 中添加：
```json
"vitest": "^1.4.0",
"@vitest/coverage-v8": "^1.4.0"
```

在 `packages/utils/package.json` 中添加测试依赖：
```json
"devDependencies": {
  "vitest": "^1.4.0",
  "@types/node": "^20.0.0"
}
```

在 `packages/kernel/package.json` 中添加测试依赖：
```json
"devDependencies": {
  "vitest": "^1.4.0",
  "@types/node": "^20.0.0"
}
```

在 `packages/plugins/package.json` 中添加测试依赖：
```json
"devDependencies": {
  "vitest": "^1.4.0",
  "@types/node": "^20.0.0"
}
```

**1.2 创建 vitest 配置文件**

创建 `/workspaces/agent-workspace/projects/Organic-Interface/vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.turbo/**'],
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
  },
});
```

**1.3 更新根目录 package.json 测试脚本**

将根目录 `package.json` 的 test 脚本修改为：
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### 2. 测试模块识别

根据代码分析，以下模块需要测试：

| 模块 | 路径 | 核心类/函数 | 测试优先级 |
|------|------|------------|-----------|
| utils | packages/utils/src | Logger, Errors | P1 |
| kernel | packages/kernel/src | Kernel, EventBus, PluginManager, LifecycleManager | P1 |
| plugins/base | packages/plugins/src/base | BasePlugin | P1 |
| plugins/loaders | packages/plugins/src/loaders | PluginLoader, RemotePluginLoader | P2 |
| plugins/registry | packages/plugins/src/registry | PluginRegistry | P2 |
| storage | packages/storage/src | 存储接口实现 | P2 |
| core-conversation | packages/plugins/src/core-conversation | SessionManager, ContextManager, InputParser, OutputFormatter | P1 (已有) |

### 3. 编写测试文件

**3.1 utils 模块测试**

创建 `/workspaces/agent-workspace/projects/Organic-Interface/packages/utils/src/__tests__/Logger.test.ts`：

测试内容：
- [ ] createLogger 创建日志实例
- [ ] 日志级别输出（debug, info, warn, error）
- [ ] 日志前缀功能
- [ ] 日志格式化输出

**3.2 kernel 模块测试**

创建 `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/__tests__/EventBus.test.ts`：

测试内容：
- [ ] on() 订阅事件
- [ ] once() 单次订阅
- [ ] off() 取消订阅
- [ ] emit() 触发事件
- [ ] removeAllListeners() 移除所有监听器
- [ ] listenerCount() 获取监听器数量
- [ ] eventTypes() 获取事件类型列表

创建 `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/__tests__/LifecycleManager.test.ts`：

测试内容：
- [ ] 生命周期状态转换
- [ ] 状态查询方法
- [ ] 错误状态处理
- [ ] 事件发布

创建 `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/__tests__/PluginManager.test.ts`：

测试内容：
- [ ] 插件注册
- [ ] 插件注销
- [ ] 插件获取
- [ ] 插件列表
- [ ] 插件启用/禁用
- [ ] 插件初始化
- [ ] 插件执行
- [ ] 批量关闭

创建 `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/__tests__/Kernel.test.ts`：

测试内容：
- [ ] Kernel 实例创建
- [ ] initialize() 初始化
- [ ] start() 启动
- [ ] stop() 停止
- [ ] registerPlugin() 注册插件
- [ ] unregisterPlugin() 注销插件
- [ ] getPlugin() 获取插件
- [ ] listPlugins() 列出插件
- [ ] executeTool() 执行工具
- [ ] getStatus() 获取状态
- [ ] updateConfig() 更新配置

**3.3 plugins/base 模块测试**

创建 `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/base/__tests__/BasePlugin.test.ts`：

测试内容：
- [ ] BasePlugin 实例创建
- [ ] getMetadata() 元数据获取
- [ ] initialize() 初始化
- [ ] execute() 执行
- [ ] shutdown() 关闭
- [ ] validateConfig() 配置验证
- [ ] 配置更新

**3.4 plugins/interfaces 模块测试**

创建 `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/interfaces/__tests__/PluginInterface.test.ts`：

测试内容：
- [ ] PluginInterface 类型定义
- [ ] PluginMetadata 类型定义
- [ ] PluginHooks 类型定义

### 4. 运行测试并修复问题

**4.1 运行测试**

```bash
cd /workspaces/agent-workspace/projects/Organic-Interface
pnpm install
pnpm test
```

**4.2 修复发现的问题**

记录所有测试失败并进行修复：
- [ ] 记录测试失败详情
- [ ] 修复类型错误
- [ ] 修复逻辑错误
- [ ] 修复配置问题
- [ ] 验证所有测试通过

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| /workspaces/agent-workspace/projects/Organic-Interface/package.json | 根目录 package.json，需要添加 vitest 依赖和测试脚本 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/utils/package.json | utils 包配置 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/package.json | kernel 包配置 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/package.json | plugins 包配置 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/kernel/Kernel.ts | Kernel 核心类 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/kernel/EventBus.ts | 事件总线 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/kernel/PluginManager.ts | 插件管理器 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/kernel/LifecycleManager.ts | 生命周期管理 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/base/BasePlugin.ts | 插件基类 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/interfaces/PluginInterface.ts | 插件接口定义 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/utils/src/index.ts | utils 导出 |

---

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| /workspaces/agent-workspace/projects/Organic-Interface/vitest.config.ts | vitest 配置文件 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/__tests__/EventBus.test.ts | EventBus 单元测试 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/__tests__/LifecycleManager.test.ts | LifecycleManager 单元测试 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/__tests__/PluginManager.test.ts | PluginManager 单元测试 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/__tests__/Kernel.test.ts | Kernel 单元测试 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/base/__tests__/BasePlugin.test.ts | BasePlugin 单元测试 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/interfaces/__tests__/PluginInterface.test.ts | PluginInterface 类型测试 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/utils/src/__tests__/Logger.test.ts | Logger 单元测试 |

---

## 验收标准

- [ ] 安装 vitest 和相关测试依赖
- [ ] 创建 vitest.config.ts 配置文件
- [ ] 更新根目录 package.json 测试脚本
- [ ] 为 kernel 模块创建 4 个测试文件（EventBus, LifecycleManager, PluginManager, Kernel）
- [ ] 为 plugins/base 模块创建 1 个测试文件（BasePlugin）
- [ ] 为 plugins/interfaces 模块创建 1 个测试文件（PluginInterface）
- [ ] 为 utils 模块创建 1 个测试文件（Logger）
- [ ] 运行 `pnpm test` 命令成功
- [ ] 所有测试通过（无失败）
- [ ] 测试覆盖率报告生成

---

## 失败处理

1. **依赖安装失败**：检查 pnpm 配置和 package.json 语法
2. **TypeScript 编译错误**：修复类型定义，确保 tsconfig 配置正确
3. **测试运行失败**：分析失败原因，修复代码或测试
4. **模块导入错误**：检查路径别名配置和导出设置

---

## 执行计划

### 阶段 1: 环境准备
1. 更新根目录 package.json 添加测试依赖
2. 更新各子包 package.json 添加测试依赖
3. 创建 vitest.config.ts 配置文件
4. 运行 pnpm install 安装依赖

### 阶段 2: 编写测试
1. 编写 EventBus 测试
2. 编写 LifecycleManager 测试
3. 编写 PluginManager 测试
4. 编写 Kernel 测试
5. 编写 BasePlugin 测试
6. 编写 PluginInterface 测试
7. 编写 Logger 测试

### 阶段 3: 运行验证
1. 运行 `pnpm test`
2. 分析测试结果
3. 修复发现的问题
4. 验证所有测试通过

### 阶段 4: 文档更新
1. 更新 README.md 测试说明（如需要）
2. 提交代码变更

---

## 技术规范

- 测试框架：vitest
- 断言库：vitest 内置 expect
- Mock：vitest 的 vi.fn()
- 覆盖率：@vitest/coverage-v8
- 测试文件命名：`{ModuleName}.test.ts`
- 测试目录：`src/__tests__/`
