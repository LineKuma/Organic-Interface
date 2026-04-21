# 任务文档：实现 @organic/kernel 核心模块

## 基本信息

- **任务编号**: task-P0-102
- **任务名称**: 实现 @organic/kernel 核心模块
- **所属模块**: 核心架构 (kernel)
- **优先级**: P0
- **状态**: completed
- **执行分支**: agent-develop
- **创建日期**: 2026-04-20
- **完成日期**: 2026-04-20
- **对应文档**: feature-006-plugin-spec.md, feature-013-monorepo-architecture.md

---

## 任务目标

根据 feature-006-plugin-spec.md 和 feature-013-monorepo-architecture.md 文档定义，实现 @organic/kernel 模块的核心功能，包括 Kernel 主类、插件管理器、生命周期管理器和事件总线。

---

## 交付物清单

### 目录结构

```
packages/kernel/src/
├── kernel/              # 内核组件
│   ├── Kernel.ts       # Kernel 主类
│   ├── PluginManager.ts # 插件管理器
│   ├── LifecycleManager.ts # 生命周期管理
│   └── EventBus.ts     # 事件总线
└── index.ts            # 模块主入口
```

---

## 实现详情

### 1. Kernel 主类 (Kernel.ts)

**核心功能**
- `initialize(config: KernelConfig)`: 初始化内核
- `start()`: 启动内核
- `stop()`: 停止内核
- `registerPlugin(plugin: PluginInterface)`: 注册插件
- `unregisterPlugin(name: string)`: 注销插件
- `getPlugin(name: string)`: 获取插件
- `getConfig()`: 获取配置
- `updateConfig(config: Partial<KernelConfig>)`: 更新配置
- `executeTool(name: string, params: Record<string, unknown>)`: 执行工具

**实现细节**
- 实现 KernelApi 接口
- 整合 EventBus、LifecycleManager、PluginManager
- 状态验证和生命周期管理
- 请求 ID 生成和追踪

### 2. EventBus 事件总线 (EventBus.ts)

**核心功能**
- `on<T>(type, listener)`: 订阅事件
- `once<T>(type, listener)`: 一次性订阅
- `off<T>(type, listener)`: 取消订阅
- `emit<T>(type, data, source?)`: 触发事件
- `removeAllListeners(type?)`: 移除监听器
- `listenerCount(type)`: 获取监听器数量

**预定义事件类型 (KernelEvents)**
- `kernel:init`: 内核初始化
- `kernel:start`: 内核启动
- `kernel:stop`: 内核停止
- `plugin:register`: 插件注册
- `plugin:unregister`: 插件注销
- `plugin:error`: 插件错误
- `config:update`: 配置更新

### 3. LifecycleManager 生命周期管理器 (LifecycleManager.ts)

**状态枚举 (LifecycleState)**
- `CREATED`: 内核已创建但未初始化
- `INITIALIZING`: 正在初始化
- `INITIALIZED`: 已初始化
- `STARTING`: 正在启动
- `RUNNING`: 运行中
- `STOPPING`: 正在停止
- `STOPPED`: 已停止
- `ERROR`: 错误状态

**核心方法**
- `getState()`: 获取当前状态
- `transition(newState, metadata?)`: 状态转换
- `isState(state)`: 检查状态
- `isRunning()`: 检查是否运行中
- `isActive()`: 检查是否活跃
- `onBeforeTransition/onAfterTransition`: 生命周期钩子

### 4. PluginManager 插件管理器 (PluginManager.ts)

**核心功能**
- `register(plugin, options?)`: 注册插件
- `unregister(name)`: 注销插件
- `get(name)`: 获取插件
- `initialize(name)`: 初始化插件
- `execute(name, input)`: 执行插件
- `shutdown(name)`: 关闭插件
- `shutdownAll()`: 关闭所有插件
- `enable(name)/disable(name)`: 启用/禁用插件

**元数据管理**
- PluginMetadata: 包含插件实例、配置、注册时间、执行统计等

---

## 执行步骤

1. [x] 创建目录结构 (kernel/)
2. [x] 实现 EventBus.ts 事件总线
3. [x] 实现 LifecycleManager.ts 生命周期管理器
4. [x] 实现 PluginManager.ts 插件管理器
5. [x] 实现 Kernel.ts 主类
6. [x] 更新 src/index.ts 主入口
7. [x] 创建任务完成文档

---

## 验证方式

```bash
# 类型检查
cd packages/kernel && pnpm typecheck

# 构建模块
cd packages/kernel && pnpm build
```

---

## 相关文档

- DOC-006: feature-006-plugin-spec.md
- DOC-013: feature-013-monorepo-architecture.md
- 前置任务: task-P0-101-utils-module.md (@organic/utils)

---

## 依赖关系

- 被依赖: plugins, tools, agent
- 依赖: @organic/utils

---

## 验收条件

| 验收项 | 验收标准 | 状态 |
|--------|----------|------|
| Kernel 主类 | 实现 initialize/start/stop/registerPlugin/unregisterPlugin/getPlugin/getConfig/updateConfig | 通过 |
| PluginManager | 实现插件注册、初始化、执行、启用/禁用管理 | 通过 |
| LifecycleManager | 实现状态转换、生命周期钩子、状态查询 | 通过 |
| EventBus | 实现事件订阅、发布、取消订阅机制 | 通过 |
| 模块导出 | src/index.ts 正确导出所有公开接口 | 通过 |
| TypeScript 类型安全 | 所有代码使用 @organic/utils 类型定义 | 通过 |
| 实现 KernelApi 接口 | Kernel 类正确实现所有 KernelApi 方法 | 通过 |
