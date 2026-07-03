# Organic Interface — 状态机规范文档

> 本文档基于实际代码库，完整记录 Organic Interface 系统中所有状态机的定义、转换、守卫条件和副作用。

---

## 目录

1. [LifecycleManager 状态机（内核生命周期）](#1-lifecyclemanager-状态机)
2. [Plugin 状态机（插件生命周期）](#2-plugin-状态机)
3. [Agent 状态机（智能体状态）](#3-agent-状态机)
4. [Task 状态机（任务调度器）](#4-task-状态机)
5. [Workflow 状态机（工作流）](#5-workflow-状态机)
6. [Session 状态机（会话）](#6-session-状态机)
7. [Storage Transaction 状态机（存储事务）](#7-storage-transaction-状态机)
8. [Sandbox Session 状态机（沙箱会话）](#8-sandbox-session-状态机)
9. [UIAgent 状态机（UI 智能体）](#9-uiagent-状态机)
10. [Orchestration Plan 状态机（编排计划）](#10-orchestration-plan-状态机)
11. [主状态协调图](#11-主状态协调图)

---

## 1. LifecycleManager 状态机

**代码位置**: `packages/kernel/src/kernel/LifecycleManager.ts`

### 1.1 枚举定义

```typescript
export enum LifecycleState {
  CREATED       = 'created',       // 内核已创建，尚未初始化
  INITIALIZING  = 'initializing',  // 内核正在初始化
  INITIALIZED   = 'initialized',   // 内核已初始化，准备启动
  STARTING      = 'starting',      // 内核正在启动
  RUNNING       = 'running',       // 内核正在运行
  STOPPING      = 'stopping',      // 内核正在停止
  STOPPED       = 'stopped',       // 内核已停止
  ERROR         = 'error',         // 内核处于错误状态
}
```

### 1.2 ASCII 状态图

```
                             ┌──────────────┐
                             │   CREATED    │ (初始状态)
                             └──────┬───────┘
                                    │ transition('initializing')
                                    ▼
                             ┌──────────────┐
                             │ INITIALIZING │
                             └──────┬───────┘
                                    │ transition('initialized')
                                    ▼
                             ┌──────────────┐
                             │  INITIALIZED │
                             └──────┬───────┘
                                    │ transition('starting')
                                    ▼
                             ┌──────────────┐
                    ┌───────▶│   STARTING   │
                    │        └──────┬───────┘
                    │               │ transition('running')
                    │               ▼
                    │        ┌──────────────┐
                    │        │   RUNNING    │◀──────────┐
                    │        └──────┬───────┘           │
                    │               │ transition('stopping')
                    │               ▼                   │
                    │        ┌──────────────┐           │
                    │        │   STOPPING   │           │
                    │        └──────┬───────┘           │
                    │               │ transition('stopped')
                    │               ▼                   │
                    │        ┌──────────────┐           │
                    │        │   STOPPED    │ (终态)    │
                    │        └──────────────┘           │
                    │                                   │
                    │        ┌──────────────┐           │
                    └────────│    ERROR     │◀──────────┘
                             └──────────────┘
                            (任意状态均可转换到 ERROR)
```

### 1.3 状态描述

| 状态 | 描述 | isActive | isRunning |
|------|------|----------|-----------|
| `CREATED` | 内核实例已创建，尚未开始初始化。所有资源处于未分配状态。 | ❌ | ❌ |
| `INITIALIZING` | 内核正在加载配置、初始化插件系统和各子系统。 | ❌ | ❌ |
| `INITIALIZED` | 内核已完成初始化，各子系统就绪，等待启动。 | ✅ | ❌ |
| `STARTING` | 内核正在启动各子系统，激活插件，建立连接。 | ✅ | ❌ |
| `RUNNING` | 内核完全运行中，所有系统正常运作。 | ✅ | ✅ |
| `STOPPING` | 内核正在优雅关闭，断开连接，停止插件。 | ❌ | ❌ |
| `STOPPED` | 内核已安全停止，资源已释放。 | ❌ | ❌ |
| `ERROR` | 内核遇到严重错误，可能处于不稳定状态。 | ❌ | ❌ |

### 1.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| `CREATED` | `INITIALIZING` | `transition('initializing')` | 无 | 执行 before hooks → 状态变更 → 执行 after hooks |
| `INITIALIZING` | `INITIALIZED` | `transition('initialized')` | 无 | 执行 before/after hooks |
| `INITIALIZED` | `STARTING` | `transition('starting')` | 无 | 执行 before/after hooks |
| `STARTING` | `RUNNING` | `transition('running')` | 无 | 执行 before/after hooks |
| `RUNNING` | `STOPPING` | `transition('stopping')` | 无 | 执行 before/after hooks |
| `STOPPING` | `STOPPED` | `transition('stopped')` | 无 | 执行 before/after hooks |
| `*` | `ERROR` | `transition('error')` | 无（任意状态） | 执行 before/after hooks，记录错误元数据 |
| `*` | `CREATED` | `reset()` | 无 | 设置 previousState = 当前, state = CREATED |

### 1.5 Entry/Exit 动作

**Entry 动作**（通过 `onAfterTransition` hooks 注册）:
- 由调用方通过 `onAfterTransition` 注册具体钩子
- 典型动作：日志记录、事件发布、资源分配

**Exit 动作**（通过 `onBeforeTransition` hooks 注册）:
- 由调用方通过 `onBeforeTransition` 注册具体钩子
- 典型动作：前置检查、清理操作、状态快照

### 1.6 关键 API

```typescript
class LifecycleManager {
  getState(): LifecycleState;
  getPreviousState(): LifecycleState | null;
  isState(state: LifecycleState): boolean;
  isAnyState(...states: LifecycleState[]): boolean;
  isRunning(): boolean;  // state === RUNNING
  isActive(): boolean;   // state in [INITIALIZED, RUNNING, STARTING]
  transition(newState: LifecycleState, metadata?: Record<string, unknown>): Promise<void>;
  reset(): void;
  onBeforeTransition(hook: LifecycleHook): void;
  onAfterTransition(hook: LifecycleHook): void;
}
```

---

## 2. Plugin 状态机

**代码位置**: `packages/plugins/src/interfaces/PluginInterface.ts`

### 2.1 枚举定义

```typescript
export enum PluginLifecycleState {
  DISCOVERED     = 'discovered',      // 插件已被发现
  RESOLVED       = 'resolved',        // 插件依赖已解析
  LOADING        = 'loading',         // 插件正在加载
  INITIALIZED    = 'initialized',     // 插件已初始化
  ACTIVE         = 'active',          // 插件已激活
  RUNNING        = 'running',         // 插件正在运行
  SHUTTING_DOWN  = 'shutting_down',   // 插件正在关闭
  SHUTDOWN       = 'shutdown',        // 插件已关闭
  ERROR          = 'error',           // 插件处于错误状态
  UNLOADED       = 'unloaded',        // 插件已卸载
}
```

### 2.2 ASCII 状态图

```
    ┌──────────────┐
    │  DISCOVERED  │ (初始状态)
    └──────┬───────┘
           │ 依赖解析
           ▼
    ┌──────────────┐
    │   RESOLVED   │
    └──────┬───────┘
           │ 加载模块
           ▼
    ┌──────────────┐
    │   LOADING    │
    └──────┬───────┘
           │ 初始化完成
           ▼
    ┌──────────────┐
    │ INITIALIZED  │
    └──────┬───────┘
           │ 激活
           ▼
    ┌──────────────┐
    │    ACTIVE    │
    └──────┬───────┘
           │ 开始运行
           ▼
    ┌──────────────┐
    │   RUNNING    │◀──────────┐
    └──────┬───────┘           │
           │ 关闭信号              │ 恢复
           ▼                   │
    ┌──────────────┐           │
    │ SHUTTING_DOWN│           │
    └──────┬───────┘           │
           │ 关闭完成             │
           ▼                   │
    ┌──────────────┐           │
    │   SHUTDOWN   │           │
    └──────┬───────┘           │
           │ 卸载                 │
           ▼                   │
    ┌──────────────┐           │
    │   UNLOADED   │ (终态)    │
    └──────────────┘           │
                               │
    ┌──────────────┐           │
    │    ERROR     │◀──────────┘
    └──────┬───────┘
           │ 错误恢复（重试）
           ▼
    ┌──────────────┐
    │   RESOLVED   │ (重新解析)
    └──────────────┘
```

### 2.3 状态描述

| 状态 | 描述 |
|------|------|
| `DISCOVERED` | 插件已在文件系统或注册表中被发现，但尚未解析依赖。 |
| `RESOLVED` | 插件依赖已解析，版本兼容性已检查通过。 |
| `LOADING` | 插件模块正在加载到内存中，执行 `onLoad` 钩子。 |
| `INITIALIZED` | 插件已完成初始化，配置已加载，但尚未激活。 |
| `ACTIVE` | 插件已激活，服务已注册，等待被调用。 |
| `RUNNING` | 插件正在执行任务，处理请求。 |
| `SHUTTING_DOWN` | 插件正在优雅关闭，释放资源，执行 `onUnload`。 |
| `SHUTDOWN` | 插件已关闭，但模块仍在内存中，可被重新激活。 |
| `ERROR` | 插件加载/初始化/运行过程中发生错误。 |
| `UNLOADED` | 插件已完全从内存中卸载，资源已释放。 |

### 2.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| `DISCOVERED` | `RESOLVED` | 依赖解析完成 | 版本兼容性检查通过 | 注册插件元数据 |
| `RESOLVED` | `LOADING` | 开始加载 | 无 | 调用 `onLoad` 钩子 |
| `LOADING` | `INITIALIZED` | 加载完成 | 无 | 配置插件、注册服务 |
| `INITIALIZED` | `ACTIVE` | 激活 | 无 | 启动插件服务 |
| `ACTIVE` | `RUNNING` | 开始执行 | 无 | 执行计数增加 |
| `RUNNING` | `ACTIVE` | 执行完成 | 无 | 更新执行统计 |
| `RUNNING` | `SHUTTING_DOWN` | 关闭信号 | 无 | 停止接收新任务 |
| `ACTIVE` | `SHUTTING_DOWN` | 关闭信号 | 无 | 停止接收新任务 |
| `SHUTTING_DOWN` | `SHUTDOWN` | 关闭完成 | 无 | 调用 `onUnload`，释放资源 |
| `SHUTDOWN` | `UNLOADED` | 卸载 | 无 | 从内存中移除 |
| `SHUTDOWN` | `RESOLVED` | 重新激活 | 无 | 重新解析依赖 |
| `*` | `ERROR` | 错误发生 | 无（任意状态） | 调用 `onError` 钩子，设置错误信息 |
| `ERROR` | `RESOLVED` | 错误恢复 | 依赖可重新解析 | 清理错误状态，重新解析 |
| `ERROR` | `UNLOADED` | 强制卸载 | 无 | 清理所有资源 |

### 2.5 Entry/Exit 动作

**Entry 动作**:
- `LOADING`: 调用 `PluginHooks.onLoad()`
- `ACTIVE`: 注册插件服务到内核
- `ERROR`: 调用 `PluginHooks.onError(error)`

**Exit 动作**:
- `SHUTTING_DOWN`: 调用 `PluginHooks.onUnload()`
- `UNLOADED`: 释放所有资源，从注册表移除

### 2.6 相关接口

```typescript
interface PluginHooks {
  onLoad?: () => void | Promise<void>;
  onUnload?: () => void | Promise<void>;
  onError?: (error: Error) => void;
  onConfigChange?: (config: Record<string, unknown>) => void;
}

interface PluginStatus {
  pluginId: string;
  state: PluginLifecycleState;
  enabled: boolean;
  error?: string;
  lastStateChange?: number;
  stats?: PluginStats;
}
```

---

## 3. Agent 状态机

**代码位置**: `packages/agent/src/core/AgentState.ts`

### 3.1 枚举定义

```typescript
export enum AgentStatus {
  IDLE           = 'idle',            // 空闲，等待任务
  BUSY           = 'busy',            // 忙碌，正在处理任务
  ERROR          = 'error',           // 发生错误
  OFFLINE        = 'offline',         // 离线
  INITIALIZING   = 'initializing',    // 正在初始化
  SHUTTING_DOWN  = 'shutting_down',   // 正在关闭
}
```

### 3.2 ASCII 状态图

```
    ┌──────────────┐
    │   OFFLINE    │ (初始状态)
    └──────┬───────┘
           │ 启动
           ▼
    ┌──────────────┐
    │ INITIALIZING │
    └──────┬───────┘
           │ 初始化完成
           ▼
    ┌──────────────┐
    │     IDLE     │◀──────────────────┐
    └──────┬───────┘                   │
           │ 接收任务                       │ 任务完成
           ▼                           │
    ┌──────────────┐                   │
    │     BUSY     │───────────────────┘
    └──────┬───────┘
           │ 错误发生
           ▼
    ┌──────────────┐
    │    ERROR     │───▶ 恢复 ──▶ IDLE
    └──────┬───────┘
           │ 关闭
           ▼
    ┌──────────────┐
    │ SHUTTING_DOWN│
    └──────┬───────┘
           │ 关闭完成
           ▼
    ┌──────────────┐
    │   OFFLINE    │ (终态循环)
    └──────────────┘
```

### 3.3 状态描述

| 状态 | 描述 |
|------|------|
| `OFFLINE` | Agent 未启动，不可用。初始状态和关闭后状态。 |
| `INITIALIZING` | Agent 正在初始化能力、加载配置、注册到注册中心。 |
| `IDLE` | Agent 已就绪，等待任务分配。心跳正常。 |
| `BUSY` | Agent 正在处理任务，`activeTaskCount > 0`。 |
| `ERROR` | Agent 遇到错误，`errorMessage` 已设置，可能需要人工干预。 |
| `SHUTTING_DOWN` | Agent 正在优雅关闭，完成当前任务，释放资源。 |

### 3.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| `OFFLINE` | `INITIALIZING` | Agent 启动 | 无 | 设置 `startTime`，初始化心跳 |
| `INITIALIZING` | `IDLE` | 初始化完成 | 能力加载成功 | 注册到 AgentRegistry |
| `IDLE` | `BUSY` | 接收任务 | `activeTaskCount` 增加 | 更新 `lastHeartbeat` |
| `BUSY` | `IDLE` | 任务完成 | `activeTaskCount` 归零 | 更新 `completedTaskCount` / `failedTaskCount`、`totalExecutionTime`、`avgResponseTime` |
| `IDLE` | `SHUTTING_DOWN` | 关闭信号 | 无 | 停止接收新任务 |
| `BUSY` | `SHUTTING_DOWN` | 关闭信号 | 无 | 等待当前任务完成 |
| `*` | `ERROR` | 运行错误 | 无 | 设置 `errorMessage` |
| `ERROR` | `IDLE` | 错误恢复 | 错误已清除 | 清除 `errorMessage` |
| `SHUTTING_DOWN` | `OFFLINE` | 关闭完成 | 所有任务已完成 | 从注册中心注销 |

### 3.5 Entry/Exit 动作

**Entry 动作**:
- `INITIALIZING`: 设置 `startTime = Date.now()`，`lastHeartbeat = Date.now()`
- `BUSY`: 增加 `activeTaskCount`
- `ERROR`: 设置 `errorMessage`

**Exit 动作**:
- `BUSY`: 更新 `completedTaskCount` / `failedTaskCount`，更新 `totalExecutionTime`，重算 `avgResponseTime`
- `SHUTTING_DOWN`: 完成所有进行中任务

### 3.6 AgentState 接口

```typescript
interface AgentState {
  agentId: string;
  name: string;
  status: AgentStatus;
  capabilities: string[];
  load: number;              // 0-1
  activeTaskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  totalExecutionTime: number;
  avgResponseTime: number;
  lastHeartbeat: number;
  startTime: number;
  parentId?: string;
  childIds: string[];
  errorMessage?: string;
  metadata: Record<string, unknown>;
}
```

---

## 4. Task 状态机

### 4.1 调度器任务状态机

**代码位置**: `packages/agent/src/scheduler/TaskQueue.ts`

#### 4.1.1 枚举定义

```typescript
export enum TaskStatus {
  PENDING    = 'pending',     // 等待执行
  RUNNING    = 'running',     // 正在执行
  COMPLETED  = 'completed',   // 执行完成
  FAILED     = 'failed',      // 执行失败
  CANCELLED  = 'cancelled',   // 已取消
}
```

#### 4.1.2 ASCII 状态图

```
    ┌──────────────┐
    │   PENDING    │ (初始状态)
    └──────┬───────┘
           │ dequeue() — 依赖满足且优先级最高
           ▼
    ┌──────────────┐
    │   RUNNING    │
    └──┬───┬───┬───┘
       │   │   │
       │   │   └──▶ cancel() ──▶ CANCELLED (终态)
       │   │
       │   └──▶ fail() & retryCount < maxRetries ──▶ PENDING (重试)
       │
       └──▶ fail() & retryCount >= maxRetries ──▶ FAILED (终态)
       │
       └──▶ complete() ──▶ COMPLETED (终态)
```

#### 4.1.3 状态描述

| 状态 | 描述 |
|------|------|
| `PENDING` | 任务在队列中等待，依赖未满足或等待执行槽位。 |
| `RUNNING` | 任务正在执行，占用一个并发槽位，`startedAt` 已设置。 |
| `COMPLETED` | 任务执行成功，`result` 包含结果数据。 |
| `FAILED` | 任务执行失败且重试次数已耗尽，`error` 包含错误信息。 |
| `CANCELLED` | 任务被手动取消，`completedAt` 已设置。 |

#### 4.1.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| `PENDING` | `RUNNING` | `dequeue()` | 状态为 PENDING，所有依赖处于 COMPLETED | 设置 `startedAt`，加入 runningTasks |
| `RUNNING` | `COMPLETED` | `complete()` | 无 | 设置 `completedAt`，保存 `result`，移入 completedTasks |
| `RUNNING` | `PENDING` | `fail()` | `retryCount < maxRetries` | 增加 `retryCount`，设置 `error`，重新入队 |
| `RUNNING` | `FAILED` | `fail()` | `retryCount >= maxRetries` | 设置 `completedAt`，保存 `error`，移入 completedTasks |
| `PENDING` | `CANCELLED` | `cancel()` | 状态不为 RUNNING | 设置 `completedAt`，从队列中移除 |

#### 4.1.5 Entry/Exit 动作

**Entry 动作**:
- `RUNNING`: 设置 `startedAt = Date.now()`
- `COMPLETED`: 设置 `completedAt = Date.now()`
- `FAILED`: 设置 `completedAt = Date.now()`

**Exit 动作**:
- `RUNNING`: 从 runningTasks 中移除

---

### 4.2 工作流任务状态机

**代码位置**: `packages/agent/src/workflow/models/Task.ts`

#### 4.2.1 枚举定义

```typescript
export enum TaskStatus {
  PENDING    = 'pending',     // 等待执行
  WAITING    = 'waiting',     // 等待依赖
  RUNNING    = 'running',     // 正在执行
  COMPLETED  = 'completed',   // 执行完成
  FAILED     = 'failed',      // 执行失败
  SKIPPED    = 'skipped',     // 已跳过
  CANCELLED  = 'cancelled',   // 已取消
  TIMEOUT    = 'timeout',     // 执行超时
  PAUSED     = 'paused',      // 已暂停
  RETRYING   = 'retrying',    // 正在重试
}
```

#### 4.2.2 ASCII 状态图

```
    ┌──────────────┐
    │   PENDING    │ (初始状态)
    └──────┬───────┘
           │ 依赖检查
           ├──────────────────▶ WAITING (依赖未满足)
           │
           │ 依赖满足
           ▼
    ┌──────────────┐
    │   RUNNING    │
    └──┬──┬──┬──┬──┘
       │  │  │  │
       │  │  │  └──▶ 超时 ──▶ TIMEOUT (终态)
       │  │  │
       │  │  └──▶ 取消 ──▶ CANCELLED (终态)
       │  │
       │  └──▶ 暂停 ──▶ PAUSED ──▶ 恢复 ──▶ RUNNING
       │
       ├──▶ 失败 & 可重试 ──▶ RETRYING ──▶ RUNNING
       │
       ├──▶ 失败 & 不可重试 ──▶ FAILED (终态)
       │
       └──▶ 成功 ──▶ COMPLETED (终态)

    条件分支:
       RUNNING ──▶ SKIPPED (终态) (条件不满足时跳过)
```

#### 4.2.3 状态描述

| 状态 | 描述 |
|------|------|
| `PENDING` | 任务已创建，排队等待执行。 |
| `WAITING` | 任务依赖的前置任务尚未完成，等待依赖满足。 |
| `RUNNING` | 任务正在执行，占用执行资源。 |
| `COMPLETED` | 任务执行成功，输出结果已保存。 |
| `FAILED` | 任务执行失败，且重试次数已耗尽。 |
| `SKIPPED` | 条件任务的分支未触发，跳过执行。 |
| `CANCELLED` | 任务被手动取消。 |
| `TIMEOUT` | 任务执行超过超时限制。 |
| `PAUSED` | 任务被暂停，可恢复执行。 |
| `RETRYING` | 任务失败后正在重试，等待重试间隔。 |

#### 4.2.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| `PENDING` | `WAITING` | 依赖检查 | 存在未完成的依赖 | 无 |
| `WAITING` | `PENDING` | 依赖完成 | 所有依赖满足 | 重新入队 |
| `PENDING` | `RUNNING` | 开始执行 | 依赖满足 | 设置 `startedAt` |
| `RUNNING` | `COMPLETED` | 执行成功 | 无 | 设置 `finishedAt`，保存 `output` |
| `RUNNING` | `FAILED` | 执行失败 | `retryCount >= maxRetries` | 设置 `finishedAt`，保存 `error` |
| `RUNNING` | `RETRYING` | 执行失败 | `retryCount < maxRetries` | 增加 `retryCount`，计算重试间隔 |
| `RETRYING` | `RUNNING` | 重试时间到 | 无 | 重新执行 |
| `RUNNING` | `TIMEOUT` | 超时 | 超过 `timeout.duration` | 根据 `timeout.action` 处理 |
| `RUNNING` | `PAUSED` | 暂停信号 | 无 | 保存执行上下文 |
| `PAUSED` | `RUNNING` | 恢复信号 | 无 | 恢复执行上下文 |
| `RUNNING` | `CANCELLED` | 取消信号 | 无 | 设置 `finishedAt` |
| `RUNNING` | `SKIPPED` | 条件不满足 | 条件表达式的分支不触发 | 设置 `finishedAt` |

#### 4.2.5 辅助函数

```typescript
// 判断是否为终态
function isTaskExecutionFinal(status: TaskStatus): boolean {
  return [COMPLETED, FAILED, SKIPPED, CANCELLED, TIMEOUT].includes(status);
}

// 判断是否可重试
function canTaskRetry(execution: TaskExecution, task: Task): boolean {
  if (isTaskExecutionFinal(execution.status)) return false;
  return execution.retryCount < (task.retryPolicy?.maxRetries ?? 3);
}

// 计算重试间隔（指数退避）
function calculateRetryInterval(execution: TaskExecution, task: Task): number {
  // interval = baseInterval * backoffMultiplier^retryCount (cap at maxRetryInterval)
}
```

---

## 5. Workflow 状态机

**代码位置**: `packages/agent/src/workflow/models/Workflow.ts`

### 5.1 工作流定义状态

#### 5.1.1 枚举定义

```typescript
export enum WorkflowStatus {
  DRAFT     = 'draft',       // 草稿
  PUBLISHED = 'published',   // 已发布
  ARCHIVED  = 'archived',    // 已归档
}
```

#### 5.1.2 ASCII 状态图

```
    ┌──────────────┐
    │    DRAFT     │ (初始状态，createWorkflow() 默认)
    └──────┬───────┘
           │ 发布
           ▼
    ┌──────────────┐
    │  PUBLISHED   │
    └──────┬───────┘
           │ 归档
           ▼
    ┌──────────────┐
    │  ARCHIVED    │ (终态)
    └──────────────┘
```

#### 5.1.3 状态描述

| 状态 | 描述 |
|------|------|
| `DRAFT` | 工作流正在编辑中，未发布，不可执行。 |
| `PUBLISHED` | 工作流已发布，可被调度执行。 |
| `ARCHIVED` | 工作流已归档，不再可用，但保留历史记录。 |

#### 5.1.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| `DRAFT` | `PUBLISHED` | 发布 | DAG 验证通过（无环、无孤立节点） | 创建版本快照 |
| `PUBLISHED` | `ARCHIVED` | 归档 | 无运行中的执行 | 停止接收新执行 |
| `PUBLISHED` | `DRAFT` | 创建新版本 | 无 | 创建新版本记录 |

---

### 5.2 工作流执行状态

#### 5.2.1 枚举定义

```typescript
export enum WorkflowExecutionStatus {
  PENDING    = 'pending',      // 等待执行
  RUNNING    = 'running',      // 正在执行
  PAUSED     = 'paused',       // 已暂停
  COMPLETED  = 'completed',    // 执行完成
  FAILED     = 'failed',       // 执行失败
  CANCELLED  = 'cancelled',    // 已取消
}
```

#### 5.2.2 ASCII 状态图

```
    ┌──────────────┐
    │   PENDING    │ (初始状态)
    └──────┬───────┘
           │ 开始执行
           ▼
    ┌──────────────┐
    │   RUNNING    │◀──────────┐
    └──┬──┬───┬────┘           │
       │  │   │                │
       │  │   └──▶ 取消 ──▶ CANCELLED (终态)
       │  │
       │  └──▶ 暂停 ──▶ PAUSED ──▶ 恢复 ──┘
       │
       ├──▶ 所有节点完成 ──▶ COMPLETED (终态)
       │
       └──▶ 节点失败 ──▶ FAILED (终态)
```

#### 5.2.3 状态描述

| 状态 | 描述 |
|------|------|
| `PENDING` | 执行已创建，等待调度。 |
| `RUNNING` | 执行正在进行中，`currentNodeIds` 包含正在执行的节点。 |
| `PAUSED` | 执行被暂停，可通过快照恢复。 |
| `COMPLETED` | 所有节点执行完成，`result` 包含最终结果。 |
| `FAILED` | 执行失败，`error` 包含失败信息，`failedNodeIds` 记录失败节点。 |
| `CANCELLED` | 执行被手动取消。 |

#### 5.2.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| `PENDING` | `RUNNING` | 开始执行 | 工作流状态为 PUBLISHED | 设置 `startedAt`，开始拓扑排序执行 |
| `RUNNING` | `COMPLETED` | 所有节点完成 | `currentNodeIds` 为空 | 设置 `finishedAt`，保存 `result` |
| `RUNNING` | `FAILED` | 节点失败 | `errorStrategy === 'fail-fast'` | 设置 `finishedAt`，保存 `error` |
| `RUNNING` | `PAUSED` | 暂停信号 | 无 | 创建执行快照 |
| `PAUSED` | `RUNNING` | 恢复信号 | 从快照恢复 | 重新激活节点执行 |
| `RUNNING` | `CANCELLED` | 取消信号 | 无 | 设置 `finishedAt`，取消所有进行中节点 |

#### 5.2.5 Entry/Exit 动作

**Entry 动作**:
- `RUNNING`: 解析拓扑顺序，启动入口节点，设置 `startedAt`
- `PAUSED`: 创建 `WorkflowExecutionSnapshot`，保存 `currentNodeIds`、`completedNodeIds`、`context`
- `COMPLETED`: 设置 `finishedAt`，计算 `duration`

**Exit 动作**:
- `RUNNING`: 取消所有进行中的节点执行

---

### 5.3 工作流验证

```typescript
// DAG 环检测
function isValidDAG(workflow: Workflow): { valid: boolean; error?: string }

// 孤立节点检测
// 如果节点既无入边也无出边且工作流节点数 > 1，则报错

// 拓扑排序算法 (Kahn's algorithm)
function getTopologicalOrder(workflow: Workflow): string[]
```

---

## 6. Session 状态机

**代码位置**: `packages/plugins/src/core-conversation/src/types/session.ts`

### 6.1 枚举定义

```typescript
export enum SessionStatus {
  ACTIVE   = 'active',     // 活跃会话
  IDLE     = 'idle',       // 空闲会话（无近期活动）
  CLOSED   = 'closed',     // 已关闭会话
  ARCHIVED = 'archived',   // 已归档会话
}
```

### 6.2 ASCII 状态图

```
    ┌──────────────┐
    │    ACTIVE    │ (初始状态，createSession() 默认)
    └──────┬───────┘
           │ 无活动超时（TTL）
           ▼
    ┌──────────────┐
    │     IDLE     │
    └──┬───────┬───┘
       │       │
       │       └──▶ 关闭 ──▶ CLOSED
       │                        │
       │ 恢复活动                │ 归档
       ▼                        ▼
    ┌──────────────┐    ┌──────────────┐
    │    ACTIVE    │    │  ARCHIVED    │ (终态)
    └──────────────┘    └──────────────┘
       │
       │ 直接关闭
       ▼
    ┌──────────────┐
    │    CLOSED    │
    └──────────────┘
```

### 6.3 状态描述

| 状态 | 描述 |
|------|------|
| `ACTIVE` | 会话正在进行中，用户正在交互。`lastActiveAt` 最近更新。 |
| `IDLE` | 会话在 TTL 内无活动，但尚未过期，可被恢复。 |
| `CLOSED` | 会话已关闭，不再接受新消息。 |
| `ARCHIVED` | 会话已归档，从活跃会话中移除，仅保留历史记录。 |

### 6.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| `ACTIVE` | `IDLE` | 无活动 | `lastActiveAt + ttl < Date.now()` | 无 |
| `IDLE` | `ACTIVE` | `resumeSession()` | 会话未过期 | 更新 `lastActiveAt`，延长 `expiresAt` |
| `ACTIVE` | `CLOSED` | `closeSession()` | 无 | 设置 `lastActiveAt`，持久化，从内存移除 |
| `IDLE` | `CLOSED` | `closeSession()` / 过期 | 过期或手动关闭 | 同上 |
| `CLOSED` | `ARCHIVED` | 归档 | 无 | 从存储中移除活跃标记 |

### 6.5 Entry/Exit 动作

**Entry 动作**:
- `ACTIVE`: 设置 `lastActiveAt = Date.now()`，重置 `expiresAt`
- `CLOSED`: 设置 `status = CLOSED`，持久化到存储

**Exit 动作**:
- `ACTIVE` → `IDLE`: 由 `cleanupExpiredSessions()` 定期触发
- `CLOSED`: 从 `sessions` Map 中移除

### 6.6 Session 接口

```typescript
interface Session {
  id: string;
  title: string;
  status: SessionStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  contextWindow: ContextWindowConfig;
  createdAt: number;
  lastActiveAt: number;
  expiresAt?: number;
  messageCount: number;
  projectId?: string;
}
```

---

## 7. Storage Transaction 状态机

**代码位置**: `packages/storage/src/services/StorageService.ts`

### 7.1 枚举定义

```typescript
export enum TransactionStatus {
  ACTIVE      = 'active',         // 事务活跃中
  COMMITTED   = 'committed',      // 已提交
  ROLLED_BACK = 'rolled_back',    // 已回滚
  EXPIRED     = 'expired',        // 已过期（超时自动回滚）
}

export enum IsolationLevel {
  READ_UNCOMMITTED = 'read_uncommitted',
  READ_COMMITTED   = 'read_committed',
  REPEATABLE_READ  = 'repeatable_read',
  SERIALIZABLE     = 'serializable',
}
```

### 7.2 ASCII 状态图

```
    ┌──────────────┐
    │    ACTIVE    │ (初始状态，beginTransaction())
    └──┬───┬───┬───┘
       │   │   │
       │   │   └──▶ 超时 ──▶ ROLLED_BACK ──▶ EXPIRED (终态)
       │   │
       │   └──▶ rollbackTransaction() ──▶ ROLLED_BACK (终态)
       │
       └──▶ commitTransaction() ──▶ COMMITTED (终态)
```

### 7.3 状态描述

| 状态 | 描述 |
|------|------|
| `ACTIVE` | 事务已开启，可以进行读写操作。同一时间只能有一个活跃事务。 |
| `COMMITTED` | 事务已成功提交，所有变更持久化。 |
| `ROLLED_BACK` | 事务已回滚，所有变更撤销。 |
| `EXPIRED` | 事务超时自动回滚。 |

### 7.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| (无) | `ACTIVE` | `beginTransaction()` | 无活跃事务 | 设置 `currentTransaction`，可选启动超时定时器 |
| `ACTIVE` | `COMMITTED` | `commitTransaction()` | 有活跃事务 | 清除超时定时器，`currentTransaction = null` |
| `ACTIVE` | `ROLLED_BACK` | `rollbackTransaction()` | 有活跃事务 | 清除超时定时器，`currentTransaction = null` |
| `ACTIVE` | `ROLLED_BACK` → `EXPIRED` | 超时 | `timeout` 已设置 | 自动调用 `rollbackTransaction()` |

### 7.5 Entry/Exit 动作

**Entry 动作**:
- `ACTIVE`: 设置 `startTime`，`isolation` 级别，可选启动超时回调

**Exit 动作**:
- `COMMITTED` / `ROLLED_BACK`: 清除超时定时器，释放 `currentTransaction`

### 7.6 隔离级别描述

| 级别 | 描述 |
|------|------|
| `READ_UNCOMMITTED` | 最低隔离级别，允许脏读。 |
| `READ_COMMITTED` | 默认级别，禁止脏读，允许不可重复读。 |
| `REPEATABLE_READ` | 禁止脏读和不可重复读，允许幻读。 |
| `SERIALIZABLE` | 最高隔离级别，禁止所有并发异常。 |

---

## 8. Sandbox Session 状态机

**代码位置**: `packages/ui/src/core/Sandbox.ts`

### 8.1 类型定义

```typescript
export type SandboxSessionStatus = 'active' | 'paused' | 'terminated' | 'completed';
```

### 8.2 ASCII 状态图

```
    ┌──────────────┐
    │    ACTIVE    │ (初始状态，createSession())
    └──┬───┬───┬───┘
       │   │   │
       │   │   └──▶ 操作完成 ──▶ COMPLETED (终态)
       │   │
       │   └──▶ 暂停 ──▶ PAUSED ──▶ 恢复 ──▶ ACTIVE
       │
       └──▶ terminateSession() ──▶ TERMINATED (终态)
```

### 8.3 状态描述

| 状态 | 描述 |
|------|------|
| `active` | 沙箱会话活跃，Agent 可以执行 UI 操作。 |
| `paused` | 沙箱会话暂停，操作被阻止，可恢复。 |
| `terminated` | 沙箱会话被终止，不可恢复。`endTime` 已设置。 |
| `completed` | 沙箱会话正常完成，操作计数达到上限或 Agent 主动结束。 |

### 8.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| (无) | `active` | `createSession()` | 无 | 设置 `startTime`，`operationCount = 0`，发射 `session:created` |
| `active` | `paused` | 暂停 | 无 | 阻止新操作 |
| `paused` | `active` | 恢复 | 无 | 允许新操作 |
| `active` | `terminated` | `terminateSession()` | 无 | 设置 `endTime`，发射 `session:terminated` |
| `active` | `completed` | 操作完成 | 操作计数超限或 Agent 主动结束 | 设置 `endTime` |

### 8.5 Entry/Exit 动作

**Entry 动作**:
- `active`: 初始化 `operationCount = 0`，`startTime = Date.now()`
- `terminated`: 设置 `endTime`，发射 `session:terminated` 事件

**Exit 动作**:
- 所有非 `active` 状态: 阻止新操作，`checkPermission` 返回 `allowed: false`

### 8.6 权限检查守卫

操作执行前必须通过 `checkPermission()` 检查：
1. 会话存在且状态为 `active`
2. 操作计数 < `maxOperationsPerSession`
3. 操作类型在 `allowedOperations` 中且不在 `deniedOperations` 中
4. 当前权限级别 >= 所需权限级别

---

## 9. UIAgent 状态机

**代码位置**: `packages/ui/src/core/UIAgent.ts`

### 9.1 类型定义

```typescript
export type UIAgentStatus = 'idle' | 'busy' | 'paused' | 'error' | 'offline';
```

### 9.2 ASCII 状态图

```
    ┌──────────────┐
    │   OFFLINE    │ (初始状态)
    └──────┬───────┘
           │ start()
           ▼
    ┌──────────────┐
    │     IDLE     │◀──────────────────────────┐
    └──┬───┬───┬───┘                          │
       │   │   │                              │
       │   │   └──▶ pause() ──▶ PAUSED ──▶ resume() ──┘
       │   │
       │   └──▶ 操作错误 ──▶ ERROR ──▶ 恢复 ──▶ IDLE
       │
       │ 执行操作
       ▼
    ┌──────────────┐
    │     BUSY     │──▶ 操作完成 ──▶ IDLE
    └──────┬───────┘
           │ pause()
           ▼
    ┌──────────────┐
    │    PAUSED    │──▶ resume() ──▶ IDLE
    └──────────────┘
       │
       │ stop()
       ▼
    ┌──────────────┐
    │   OFFLINE    │ (终态)
    └──────────────┘
```

### 9.3 状态描述

| 状态 | 描述 |
|------|------|
| `offline` | Agent 未启动，不可用。初始状态。 |
| `idle` | Agent 已启动，等待操作指令。可以创建新会话。 |
| `busy` | Agent 正在执行 UI 操作。 |
| `paused` | Agent 被暂停，会话保持但操作被阻止。 |
| `error` | Agent 遇到错误，可能需要恢复。 |

### 9.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| `offline` | `idle` | `start()` | 当前状态为 `offline` | 发射 `agent:start` |
| `idle` | `busy` | `execute()` | 有活跃会话 | 设置 `status = 'busy'` |
| `busy` | `idle` | 操作完成 | 无 | 更新 `totalOperations`、`successfulOperations`/`failedOperations` |
| `idle` | `paused` | `pause()` | 状态为 `idle` 或 `busy` | 发射 `agent:pause` |
| `busy` | `paused` | `pause()` | 状态为 `idle` 或 `busy` | 发射 `agent:pause` |
| `paused` | `idle` | `resume()` | 状态为 `paused` | 发射 `agent:resume` |
| `*` | `error` | 操作异常 | 无 | 设置错误状态 |
| `error` | `idle` | 错误恢复 | 无 | 清除错误 |
| `idle` | `offline` | `stop()` | 无 | 结束所有会话，发射 `agent:stop` |
| `paused` | `offline` | `stop()` | 无 | 结束所有会话，发射 `agent:stop` |

### 9.5 Entry/Exit 动作

**Entry 动作**:
- `idle` (from `offline`): 发射 `agent:start` 事件
- `busy`: 发射 `operation:request` 事件
- `paused`: 发射 `agent:pause` 事件

**Exit 动作**:
- `busy`: 更新操作统计，发射 `operation:execute` 事件
- `offline`: 结束所有 Sandbox 会话

### 9.6 UIAgentState 接口

```typescript
interface UIAgentState {
  status: UIAgentStatus;
  currentSession?: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  lastOperationTime?: number;
  permissionLevel: UIPermissionLevel;
}
```

---

## 10. Orchestration Plan 状态机

**代码位置**: `packages/agent/src/orchestration/OrchestrationLayer.ts`

### 10.1 枚举定义

```typescript
export enum OrchestrationPlanStatus {
  PENDING   = 'pending',     // 等待执行
  RUNNING   = 'running',     // 正在执行
  PAUSED    = 'paused',      // 已暂停
  COMPLETED = 'completed',   // 执行完成
  FAILED    = 'failed',      // 执行失败
  CANCELLED = 'cancelled',   // 已取消
}
```

### 10.2 ASCII 状态图

```
    ┌──────────────┐
    │   PENDING    │ (初始状态，createPlan())
    └──────┬───────┘
           │ 开始执行
           ▼
    ┌──────────────┐
    │   RUNNING    │◀──────────┐
    └──┬──┬───┬────┘           │
       │  │   │                │
       │  │   └──▶ cancel() ──▶ CANCELLED (终态)
       │  │
       │  └──▶ pause() ──▶ PAUSED ──▶ resume() ──┘
       │
       ├──▶ 所有步骤完成 ──▶ COMPLETED (终态)
       │
       └──▶ 步骤失败 ──▶ FAILED (终态)
```

### 10.3 状态描述

| 状态 | 描述 |
|------|------|
| `PENDING` | 编排计划已创建，等待执行。计划包含执行步骤和并行组。 |
| `RUNNING` | 编排计划正在执行，步骤按依赖顺序执行。 |
| `PAUSED` | 编排计划被暂停，可通过 `resume()` 恢复。 |
| `COMPLETED` | 所有步骤执行成功，结果已聚合。 |
| `FAILED` | 执行失败，某个步骤返回错误，`error` 包含失败信息。 |
| `CANCELLED` | 编排计划被手动取消。 |

### 10.4 转换表

| 从 | 到 | 触发事件 | 守卫条件 | 副作用 |
|----|----|---------|---------|--------|
| (无) | `PENDING` | `createPlan()` | 无 | 创建 `ExecutionPlan`，注册到 `plans` Map |
| `PENDING` | `RUNNING` | `orchestrate()` / `resume()` | 并发编排数 < `maxConcurrentOrchestrations` | 发射 `orchestration:start`，执行步骤 |
| `RUNNING` | `COMPLETED` | 所有步骤完成 | 所有 `ExecutionResult.success === true` | 聚合结果，发射 `orchestration:complete` |
| `RUNNING` | `FAILED` | 步骤失败 | 某步骤 `success === false` | 发射 `orchestration:failed` |
| `RUNNING` | `PAUSED` | `pause()` | 计划存在 | 发射 `orchestration:paused` |
| `PAUSED` | `RUNNING` | `resume()` | 计划处于暂停状态 | 发射 `orchestration:resumed`，继续执行 |
| `RUNNING` | `CANCELLED` | `cancel()` | 执行存在 | 调用 `coordinator.cancel()`，移除活跃编排 |

### 10.5 Entry/Exit 动作

**Entry 动作**:
- `PENDING`: 创建 `ExecutionPlan`，分配 `OrchestrationStrategy`
- `RUNNING`: 根据策略选择执行方式（`SEQUENTIAL` / `PARALLEL` / `AUTO`）
- `COMPLETED`: 聚合结果，计算 `duration`

**Exit 动作**:
- `RUNNING` → `PAUSED`: 保存执行上下文到 `pausedPlans`
- `CANCELLED`: 调用 `coordinator.cancel()` 中止所有执行

### 10.6 执行步骤状态

```typescript
interface ExecutionStep {
  stepId: string;
  request: ExecutionRequest;
  dependsOn: string[];
  agentId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: ExecutionResult;
}
```

步骤状态转换:
```
pending → running → completed  (成功路径)
pending → running → failed     (失败路径)
pending → skipped              (依赖失败，跳过)
```

---

## 11. 主状态协调图

以下展示了系统中所有状态机之间的层级关系和协调方式：

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                          Organic Interface 主状态协调图                         │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      LifecycleManager (内核)                             │ │
│  │   CREATED → INITIALIZING → INITIALIZED → STARTING → RUNNING             │ │
│  │                                                  ↓                      │ │
│  │                                           STOPPING → STOPPED            │ │
│  └────────────────────────────┬────────────────────────────────────────────┘ │
│                               │ 管理                                           │
│              ┌────────────────┼────────────────────┐                          │
│              ▼                ▼                    ▼                          │
│  ┌───────────────────┐ ┌──────────────┐ ┌──────────────────────┐            │
│  │  Plugin 状态机     │ │ Agent 状态机  │ │ Workflow 状态机       │            │
│  │  DISCOVERED → ... │ │ IDLE ↔ BUSY  │ │ DRAFT → PUBLISHED    │            │
│  │  → RUNNING →      │ │ OFFLINE ↔    │ │    ↓                 │            │
│  │  SHUTDOWN →       │ │ INITIALIZING │ │ 执行: PENDING →      │            │
│  │  UNLOADED         │ │ ERROR        │ │ RUNNING → COMPLETED  │            │
│  └────────┬──────────┘ └──────┬───────┘ └──────────┬───────────┘            │
│           │                   │                    │                         │
│           │    ┌──────────────┼────────────────────┤                         │
│           │    │              │                    │                         │
│           ▼    ▼              ▼                    ▼                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Orchestration Plan (编排层)                        │   │
│  │              PENDING → RUNNING → COMPLETED / FAILED                  │   │
│  │                         ↕ PAUSED                                     │   │
│  └────────────────────────────────┬─────────────────────────────────────┘   │
│                                   │ 协调                                     │
│              ┌────────────────────┼────────────────────┐                    │
│              ▼                    ▼                    ▼                    │
│  ┌───────────────────┐ ┌──────────────────┐ ┌──────────────────────┐       │
│  │ Task 状态机        │ │ UIAgent 状态机   │ │ Sandbox Session      │       │
│  │ PENDING → RUNNING │ │ idle ↔ busy      │ │ active → terminated  │       │
│  │ → COMPLETED/FAILED│ │ paused ↔ offline │ │         → completed   │       │
│  │ → RETRYING        │ │ error            │ │         → paused      │       │
│  └────────┬──────────┘ └────────┬─────────┘ └──────────┬───────────┘       │
│           │                     │                      │                    │
│           └─────────────────────┼──────────────────────┘                    │
│                                 │                                           │
│                                 ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       Session 状态机                                  │   │
│  │              ACTIVE → IDLE → CLOSED → ARCHIVED                       │   │
│  └────────────────────────────────┬─────────────────────────────────────┘   │
│                                   │ 持久化                                   │
│                                   ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Storage Transaction 状态机                         │   │
│  │              ACTIVE → COMMITTED / ROLLED_BACK / EXPIRED              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 11.1 状态机协调关系

| 上级状态机 | 下级状态机 | 协调方式 |
|-----------|-----------|---------|
| `LifecycleManager` | `Plugin` | 内核状态转换驱动插件生命周期（初始化→加载插件，停止→关闭插件） |
| `LifecycleManager` | `Agent` | 内核 RUNNING 时 Agent 可启动，内核 STOPPING 时 Agent 关闭 |
| `LifecycleManager` | `Workflow` | 内核 RUNNING 时工作流可执行，STOPPING 时取消所有执行 |
| `WorkflowExecution` | `Task（工作流）` | 工作流执行驱动任务节点状态转换，拓扑排序控制执行顺序 |
| `OrchestrationPlan` | `Agent` | 编排层选择 Agent 执行任务，Agent 状态影响选择策略 |
| `OrchestrationPlan` | `Task（调度器）` | 编排请求转换为调度任务，通过 TaskScheduler 管理并发 |
| `UIAgent` | `SandboxSession` | UIAgent 创建/终止 Sandbox 会话，会话状态影响操作权限 |
| `Session` | `StorageTransaction` | 会话持久化通过存储事务保证原子性 |

### 11.2 全局状态依赖规则

1. **内核启动顺序**: `LifecycleManager.CREATED → INITIALIZING → INITIALIZED → STARTING → RUNNING`
   - 在 `INITIALIZED` 后可注册 Plugin 和 Agent
   - 在 `RUNNING` 后可执行 Workflow 和 Orchestration

2. **内核关闭顺序**: `RUNNING → STOPPING → STOPPED`
   - 先取消所有 OrchestrationPlan
   - 再停止所有 WorkflowExecution
   - 关闭所有 Agent
   - 关闭所有 Plugin
   - 关闭所有 Session
   - 提交或回滚所有 StorageTransaction

3. **错误传播**: 下级状态机的 ERROR 状态会向上传播
   - `Task.FAILED` → `WorkflowExecution.FAILED`
   - `OrchestrationPlan.FAILED` → 不影响 `LifecycleManager`（仅记录日志）
   - `Plugin.ERROR` → 不影响其他 Plugin（隔离故障）

4. **并发控制**: 
   - `TaskScheduler` 限制 `maxParallelTasks`（默认 10）
   - `OrchestrationLayer` 限制 `maxConcurrentOrchestrations`（默认 10）
   - `SessionManager` 限制 `maxSessions`（默认 100）

---

## 附录 A：状态机代码引用汇总

| 状态机 | 文件路径 | 关键类/枚举 |
|--------|---------|-----------|
| LifecycleManager | `packages/kernel/src/kernel/LifecycleManager.ts` | `LifecycleState`, `LifecycleManager` |
| Plugin | `packages/plugins/src/interfaces/PluginInterface.ts` | `PluginLifecycleState`, `PluginStatus` |
| Agent | `packages/agent/src/core/AgentState.ts` | `AgentStatus`, `AgentState` |
| Task (调度器) | `packages/agent/src/scheduler/TaskQueue.ts` | `TaskStatus`, `Task`, `TaskQueue` |
| Task (工作流) | `packages/agent/src/workflow/models/Task.ts` | `TaskStatus`, `TaskExecution` |
| Workflow | `packages/agent/src/workflow/models/Workflow.ts` | `WorkflowStatus`, `WorkflowExecutionStatus`, `WorkflowExecution` |
| Session | `packages/plugins/src/core-conversation/src/types/session.ts` | `SessionStatus`, `Session` |
| Storage Transaction | `packages/storage/src/services/StorageService.ts` | `TransactionStatus`, `IsolationLevel`, `Transaction` |
| Sandbox | `packages/ui/src/core/Sandbox.ts` | `SandboxSessionStatus`, `SandboxSession` |
| UIAgent | `packages/ui/src/core/UIAgent.ts` | `UIAgentStatus`, `UIAgentState` |
| Orchestration | `packages/agent/src/orchestration/OrchestrationLayer.ts` | `OrchestrationPlanStatus`, `OrchestrationLayerPlan` |

## 附录 B：通用状态模式

在整个系统中，多个状态机共享以下模式：

1. **三阶段生命周期**: `初始态 → 活跃态 → 终止态`
2. **暂停/恢复**: `RUNNING ↔ PAUSED`（WorkflowExecution, OrchestrationPlan, UIAgent, SandboxSession）
3. **错误恢复**: `* → ERROR → 恢复态`（LifecycleManager, Plugin, Agent, UIAgent）
4. **重试机制**: `RUNNING → RETRYING → RUNNING`（Task 工作流）
5. **取消模式**: `* → CANCELLED`（Task, WorkflowExecution, OrchestrationPlan）