# 功能文档：Hooks & Middleware 钩子系统

## 基本信息

**文档编号**: DOC-017
**所属模块**: 核心架构
**优先级**: P1
**创建日期**: 2026-07-03
**对应需求章节**: 3.3 可扩展性需求

---

## 功能概述

Hooks & Middleware 钩子系统是 Organic-Interface 的事件驱动扩展机制，贯穿系统的所有核心模块。系统通过多个层次的钩子点和拦截点，允许 Plugin、Agent 和外部系统在关键生命周期节点插入自定义逻辑、监控系统行为、拦截和修改操作流程。钩子系统基于 EventEmitter 模式和事件总线（EventBus）双轨架构，覆盖从 Kernel 启动到工具执行的全链路。

---

## 设计理念

### 钩子系统定位

钩子系统承担以下核心职责：

**生命周期感知**：在所有核心组件（Plugin、Agent、Kernel、Workflow）的生命周期关键节点提供钩子，允许外部代码感知状态变化并作出响应。

**行为拦截**：在工具执行、安全授权、UI 操作等关键路径上提供拦截点，允许在操作执行前后注入自定义逻辑、修改参数或中止操作。

**事件传播**：通过 EventBus 和 EventEmitter 模式，实现跨模块、跨 Agent 的事件传播和订阅，支持松耦合的系统集成。

**可观测性**：为监控、日志、审计、性能分析等横切关注点提供统一的接入点，无需修改核心业务代码。

### 设计原则

**双轨架构**：系统级事件通过 EventBus 传播（支持通配符匹配、异步分发），组件级事件通过 EventEmitter 传播（类 Node.js 模式），两者互补。

**非侵入式**：钩子注册不改变原有业务逻辑，所有钩子执行失败不影响主流程（错误隔离）。

**链式处理**：Middleware 模式支持责任链（Chain of Responsibility），多个中间件可以按顺序对同一操作进行前处理和后处理。

**显式注册**：所有钩子需要显式注册和取消注册，避免隐式行为导致的调试困难。

**类型安全**：所有钩子点使用 TypeScript 类型定义，确保编译期类型检查。

---

## 1. Plugin 生命周期钩子

### 钩子接口定义

Plugin 的生命周期钩子定义在 `PluginHooks` 接口中，每个 Plugin 可以在其元数据中声明这些钩子：

```typescript
// packages/plugins/src/interfaces/PluginInterface.ts

export interface PluginHooks {
  /** Plugin 加载时调用 */
  onLoad?: () => void | Promise<void>;

  /** Plugin 卸载时调用 */
  onUnload?: () => void | Promise<void>;

  /** Plugin 发生错误时调用 */
  onError?: (error: Error) => void;

  /** Plugin 配置变更时调用 */
  onConfigChange?: (config: Record<string, unknown>) => void;
}
```

### PluginLifecycleState 状态转换

Plugin 在其生命周期中经历以下状态转换，每个状态转换都是一个钩子触发点：

```
DISCOVERED → RESOLVED → LOADING → INITIALIZED → ACTIVE → RUNNING
                                                          ↓
                                                    SHUTTING_DOWN → SHUTDOWN
                                                          ↓
                                                        ERROR → UNLOADED
```

```typescript
export enum PluginLifecycleState {
  DISCOVERED    = 'discovered',      // Plugin 被发现
  RESOLVED      = 'resolved',        // 依赖已解析
  LOADING       = 'loading',         // 正在加载
  INITIALIZED   = 'initialized',     // 已初始化
  ACTIVE        = 'active',          // 已激活
  RUNNING       = 'running',         // 正在运行
  SHUTTING_DOWN = 'shutting_down',   // 正在关闭
  SHUTDOWN      = 'shutdown',        // 已关闭
  ERROR         = 'error',           // 错误状态
  UNLOADED      = 'unloaded',        // 已卸载
}
```

### 使用示例：Plugin 生命周期钩子

```typescript
import type { PluginInterface, PluginMetadata, PluginHooks } from '@organic/plugins';

class MyPlugin implements PluginInterface {
  getMetadata(): PluginMetadata {
    return {
      id: 'my-plugin',
      name: 'MyPlugin',
      version: '1.0.0',
      apiVersion: '1.0',
      hooks: {
        onLoad: async () => {
          console.log('[MyPlugin] 正在加载...');
          // 初始化数据库连接
          await this.initializeDatabase();
        },
        onUnload: async () => {
          console.log('[MyPlugin] 正在卸载...');
          // 清理资源
          await this.closeDatabase();
        },
        onError: (error: Error) => {
          console.error('[MyPlugin] 发生错误:', error.message);
          // 发送告警通知
          this.sendAlert(error);
        },
        onConfigChange: (config: Record<string, unknown>) => {
          console.log('[MyPlugin] 配置变更:', config);
          // 重新加载配置
          this.reloadConfiguration(config);
        },
      },
    };
  }

  async initialize(): Promise<void> { /* ... */ }
  async shutdown(): Promise<void> { /* ... */ }
}
```

### Plugin 状态监控

通过 `PluginStatus` 接口可以获取 Plugin 的当前状态、执行统计等信息：

```typescript
export interface PluginStatus {
  pluginId: string;
  state: PluginLifecycleState;
  enabled: boolean;
  error?: string;
  lastStateChange?: number;
  stats?: PluginStats;  // 执行统计：totalExecutions, successfulExecutions 等
}
```

---

## 2. 系统事件钩子（EventBus）

### EventBus 架构

EventBus 是系统级事件总线，用于 Kernel 和 Plugin 之间的通信。它支持精确匹配和通配符匹配两种订阅模式，并默认使用异步分发。

```typescript
// packages/kernel/src/kernel/EventBus.ts

export class EventBus {
  // 精确匹配订阅
  on<T>(type: string, listener: EventListener<T>): EventSubscription;

  // 通配符匹配订阅
  onWildcard<T>(pattern: string, listener: EventListener<T>): EventSubscription;

  // 一次性订阅
  once<T>(type: string, listener: EventListener<T>): EventSubscription;

  // 发布事件
  emit<T>(type: string, data: T, source?: string): void;

  // 取消订阅
  off<T>(type: string, listener: EventListener<T>): void;
  offWildcard<T>(pattern: string, listener: EventListener<T>): void;
}
```

### 事件数据结构

```typescript
export interface KernelEvent<T = unknown> {
  type: string;       // 事件类型/名称
  data: T;            // 事件载荷数据
  timestamp: number;  // 事件发出的时间戳
  source?: string;    // 事件来源
}
```

### 通配符匹配规则

EventBus 支持三种通配符模式：

| 模式 | 说明 | 示例 |
|------|------|------|
| `prefix:*` | 匹配以 `prefix:` 或 `prefix/` 开头的所有事件 | `plugin:*` 匹配 `plugin:register`, `plugin:error` |
| `*:suffix` | 匹配以 `:suffix` 或 `/suffix` 结尾的所有事件 | `*:error` 匹配 `plugin:error`, `tool:error` |
| 包含 `*` 的模式 | 正则匹配，`*` 不匹配 `:` | `task:*:complete` 匹配 `task:node:complete` |

### 内核事件常量

```typescript
export const KernelEvents = {
  KERNEL_INIT:       'kernel:init',        // Kernel 初始化
  KERNEL_START:      'kernel:start',       // Kernel 启动
  KERNEL_STOP:       'kernel:stop',        // Kernel 停止
  PLUGIN_REGISTER:   'plugin:register',    // Plugin 注册
  PLUGIN_UNREGISTER: 'plugin:unregister',  // Plugin 注销
  PLUGIN_ERROR:      'plugin:error',       // Plugin 错误
  CONFIG_UPDATE:     'config:update',      // 配置更新
} as const;
```

### 使用示例：EventBus 订阅

```typescript
import { EventBus, KernelEvents } from '@organic/kernel';

const eventBus = new EventBus({ async: true });

// 精确订阅：监听 Kernel 启动
const sub1 = eventBus.on(KernelEvents.KERNEL_START, (event) => {
  console.log(`Kernel 已启动，时间: ${new Date(event.timestamp).toISOString()}`);
});

// 通配符订阅：监听所有 Plugin 相关事件
const sub2 = eventBus.onWildcard('plugin:*', (event) => {
  console.log(`Plugin 事件: ${event.type}`, event.data);
});

// 一次性订阅：监听下一次配置更新
eventBus.once(KernelEvents.CONFIG_UPDATE, (event) => {
  console.log('配置已更新:', event.data);
});

// 取消订阅
sub1.unsubscribe();
sub2.unsubscribe();
```

### 使用示例：EventBus 发布

```typescript
// Kernel 启动时发布事件
eventBus.emit(KernelEvents.KERNEL_START, {
  version: '1.0.0',
  startTime: Date.now(),
}, 'kernel');

// Plugin 注册时发布事件
eventBus.emit(KernelEvents.PLUGIN_REGISTER, {
  pluginId: 'my-plugin',
  name: 'MyPlugin',
}, 'plugin-manager');

// 配置更新时发布事件
eventBus.emit(KernelEvents.CONFIG_UPDATE, {
  key: 'maxConcurrency',
  oldValue: 5,
  newValue: 10,
}, 'config-service');
```

---

## 3. Agent 事件钩子

### Agent Events 接口

Agent 通过 `EventEmitter` 发出任务生命周期事件，所有 Agent 事件定义在 `AgentEvents` 接口中：

```typescript
// packages/agent/src/core/Agent.ts

export interface AgentEvents {
  'task:start':      { taskId: string; timestamp: number };
  'task:complete':   { taskId: string; result: AgentResult; timestamp: number };
  'task:error':      { taskId: string; error: Error; timestamp: number };
  'status:change':   { oldStatus: AgentStatus; newStatus: AgentStatus; timestamp: number };
  'child:register':  { childId: string; timestamp: number };
  'child:unregister': { childId: string; timestamp: number };
  heartbeat:         { timestamp: number; load: number };
}
```

### 任务执行生命周期

```
handleStart → task:start → 执行 handler → task:complete / task:error → handleEnd
                                                      ↓
                                              status:change (IDLE)
```

### 状态变更事件

Agent 状态变更时触发 `status:change`，携带新旧状态对比：

```typescript
export enum AgentStatus {
  IDLE           = 'idle',
  INITIALIZING   = 'initializing',
  BUSY           = 'busy',
  SHUTTING_DOWN  = 'shutting_down',
  OFFLINE        = 'offline',
  ERROR          = 'error',
}
```

### 心跳事件

Agent 默认按配置的间隔（`heartbeatInterval` 秒）发出 `heartbeat` 事件，携带当前负载：

```typescript
agent.on('heartbeat', ({ timestamp, load }) => {
  console.log(`Agent 心跳: 负载=${(load * 100).toFixed(1)}%`);
});
```

### 使用示例：Agent 事件监听

```typescript
import { Agent } from '@organic/agent';

const agent = new Agent({
  config: { id: 'agent-1', name: 'TaskAgent', version: '1.0.0' },
  kernel: kernelApi,
});

// 监听任务开始
agent.on('task:start', ({ taskId, timestamp }) => {
  console.log(`[${new Date(timestamp).toISOString()}] 任务开始: ${taskId}`);
});

// 监听任务完成
agent.on('task:complete', ({ taskId, result }) => {
  console.log(`任务完成: ${taskId}, 耗时: ${result.executionTime}ms`);
  if (result.metadata) {
    console.log('元数据:', result.metadata);
  }
});

// 监听任务失败
agent.on('task:error', ({ taskId, error }) => {
  console.error(`任务失败: ${taskId}, 错误: ${error.message}`);
});

// 监听状态变更
agent.on('status:change', ({ oldStatus, newStatus }) => {
  console.log(`Agent 状态变更: ${oldStatus} → ${newStatus}`);
});

// 监听子 Agent 注册
agent.on('child:register', ({ childId }) => {
  console.log(`子 Agent 已注册: ${childId}`);
});

// 监听心跳
agent.on('heartbeat', ({ timestamp, load }) => {
  console.log(`心跳: 时间=${new Date(timestamp).toISOString()}, 负载=${load}`);
});
```

---

## 4. 生命周期钩子（LifecycleManager）

### LifecycleManager 状态机

LifecycleManager 管理 Kernel 的生命周期状态，提供 `before` 和 `after` 两类钩子，在每次状态转换前后执行：

```typescript
// packages/kernel/src/kernel/LifecycleManager.ts

export enum LifecycleState {
  CREATED       = 'created',        // 已创建，未初始化
  INITIALIZING  = 'initializing',   // 正在初始化
  INITIALIZED   = 'initialized',    // 已初始化，待启动
  STARTING      = 'starting',       // 正在启动
  RUNNING       = 'running',        // 正在运行
  STOPPING      = 'stopping',       // 正在停止
  STOPPED       = 'stopped',        // 已停止
  ERROR         = 'error',          // 错误状态
}
```

### LifecycleTransition 接口

```typescript
export interface LifecycleTransition {
  from: LifecycleState;             // 前一状态
  to: LifecycleState;               // 新状态
  timestamp: number;                // 转换时间戳
  metadata?: Record<string, unknown>; // 可选元数据
}
```

### 钩子回调类型

```typescript
export type LifecycleHook = (
  state: LifecycleState,
  transition?: LifecycleTransition
) => void | Promise<void>;
```

### 使用示例：Kernel 生命周期钩子

```typescript
import { LifecycleManager, LifecycleState } from '@organic/kernel';

const lifecycleManager = new LifecycleManager({
  logger: myLogger,
});

// 注册 before 钩子：在状态转换前执行
lifecycleManager.onBeforeTransition(async (state, transition) => {
  if (transition) {
    console.log(`即将转换: ${transition.from} → ${transition.to}`);
    if (transition.to === LifecycleState.ERROR) {
      // 进入错误状态前保存快照
      await saveSystemSnapshot();
    }
  }
});

// 注册 after 钩子：在状态转换后执行
lifecycleManager.onAfterTransition(async (state, transition) => {
  if (transition) {
    console.log(`已转换: ${transition.from} → ${transition.to}`);
    if (state === LifecycleState.RUNNING) {
      // 系统启动后初始化监控
      await initializeMonitoring();
    }
  }
});

// 执行状态转换
await lifecycleManager.transition(LifecycleState.INITIALIZING);
await lifecycleManager.transition(LifecycleState.INITIALIZED);
await lifecycleManager.transition(LifecycleState.STARTING);
await lifecycleManager.transition(LifecycleState.RUNNING, { version: '1.0.0' });

// 查询状态
console.log(lifecycleManager.getStatus());
// { state: 'running', previousState: 'starting', isRunning: true, isActive: true }
```

### 状态查询辅助方法

```typescript
lifecycleManager.isState(LifecycleState.RUNNING);       // 判断是否为指定状态
lifecycleManager.isAnyState(LifecycleState.INITIALIZED, LifecycleState.RUNNING);
lifecycleManager.isRunning();                           // 是否在运行中
lifecycleManager.isActive();                            // 是否处于活跃状态
lifecycleManager.getPreviousState();                    // 获取前一状态
lifecycleManager.clearHooks();                          // 清除所有钩子
lifecycleManager.reset();                               // 重置到 CREATED 状态
```

---

## 5. 安全钩子（SecurityGuard）

### SecurityGuard 事件

SecurityGuard 在权限检查和预设变更时发出事件，支持安全审计和操作拦截：

```typescript
// packages/tools/src/security/SecurityGuard.ts

export interface SecurityGuardEvents {
  /** 安全预设变更时触发 */
  'preset:changed': [SecurityPreset, SecurityPreset];
  // newPreset, oldPreset

  /** 操作被安全策略阻止时触发 */
  'operation:blocked': [{
    toolId: string;
    operation: ToolPermissionType;
    preset: SecurityPreset;
    reason: string;
  }];

  /** 操作被允许时触发 */
  'operation:allowed': [{
    toolId: string;
    operation: ToolPermissionType;
    preset: SecurityPreset;
  }];
}
```

### 安全预设体系

SecurityGuard 支持四级安全预设，级别递增权限越大：

```
plan (L1)  →  create (L2)  →  work (L3)  →  yolo (L4)
```

### 使用示例：安全事件监听

```typescript
import { SecurityGuard } from '@organic/tools';

const securityGuard = new SecurityGuard({ preset: 'plan' });

// 监听预设变更
securityGuard.on('preset:changed', (newPreset, oldPreset) => {
  console.log(`安全预设变更: ${oldPreset} → ${newPreset}`);
  // 记录审计日志
  auditLog.record({
    action: 'preset_change',
    from: oldPreset,
    to: newPreset,
    timestamp: Date.now(),
  });
});

// 监听操作被阻止
securityGuard.on('operation:blocked', ({ toolId, operation, preset, reason }) => {
  console.warn(`操作被阻止: ${toolId}.${operation}`);
  console.warn(`  当前预设: ${preset}, 原因: ${reason}`);
  // 发送安全告警
  alertService.sendSecurityAlert({
    level: 'warning',
    toolId,
    operation,
    reason,
    timestamp: Date.now(),
  });
});

// 监听操作被允许
securityGuard.on('operation:allowed', ({ toolId, operation, preset }) => {
  console.log(`操作允许: ${toolId}.${operation} (预设: ${preset})`);
});

// 切换预设
securityGuard.switchPreset('create'); // 触发 'preset:changed'

// 检查操作权限
const result = securityGuard.checkOperation('file_writer', 'file_write');
if (!result.allowed) {
  console.log(`原因: ${result.reason}`);
}
```

### 授权流程中的拦截点

`authorize()` 方法是安全系统的核心拦截点，它将操作分为三个步骤进行：

```typescript
// 1. 权限检查 → 触发 operation:blocked / operation:allowed
// 2. 审批判断（非 YOLO 模式）→ 通过 ApprovalService 请求人工审批
// 3. 返回授权结果

const approval = await securityGuard.authorize(
  toolId,    // 工具 ID
  input,     // 工具输入
  operation, // 操作类型
  metadata   // 元数据
);
```

---

## 6. 工具执行钩子

### ToolService 事件

ToolService 管理工具注册和执行，提供以下事件钩子：

```typescript
// packages/tools/src/services/ToolService.ts

export interface ToolServiceEvents {
  'tool:registered':   { toolId: string; timestamp: number };
  'tool:unregistered': { toolId: string; timestamp: number };
  'tool:enabled':      { toolId: string; timestamp: number };
  'tool:disabled':     { toolId: string; timestamp: number };
  'execution:start':   { toolId: string; executionId: string; timestamp: number };
  'execution:complete': {
    toolId: string;
    executionId: string;
    result: ToolResult;
    timestamp: number;
  };
  'execution:error':   {
    toolId: string;
    executionId: string;
    error: Error;
    timestamp: number;
  };
}
```

### ToolExecutor 事件

ToolExecutor 管理工具的实际执行，提供队列和执行生命周期事件：

```typescript
// packages/tools/src/executor/ToolExecutor.ts

export interface ToolExecutorEvents {
  'execution:queued':    { toolId: string; queueLength: number; timestamp: number };
  'execution:started':   { toolId: string; executionId: string; timestamp: number };
  'execution:completed': {
    toolId: string;
    executionId: string;
    duration: number;
    timestamp: number;
  };
  'execution:failed':    {
    toolId: string;
    executionId: string;
    error: string;
    duration: number;
    timestamp: number;
  };
  'execution:cancelled': { toolId: string; executionId: string; timestamp: number };
  'queue:empty':         { timestamp: number };
  'queue:full':          { timestamp: number };
}
```

### 使用示例：工具执行监控中间件

```typescript
import { ToolService, ToolExecutor } from '@organic/tools';

const toolService = new ToolService();
const toolExecutor = new ToolExecutor({ maxConcurrent: 5 });

// == 工具注册级别钩子 ==

// 工具注册时自动初始化
toolService.on('tool:registered', ({ toolId }) => {
  console.log(`工具注册: ${toolId}`);
  metricsCollector.incrementGauge('tools.registered', 1);
});

// 工具注销时清理资源
toolService.on('tool:unregistered', ({ toolId }) => {
  console.log(`工具注销: ${toolId}`);
  metricsCollector.decrementGauge('tools.registered', 1);
});

// == 工具执行级别钩子 ==

// 执行开始：记录开始时间
toolService.on('execution:start', ({ toolId, executionId }) => {
  executionTimers.set(executionId, Date.now());
});

// 执行完成：计算耗时
toolService.on('execution:complete', ({ toolId, executionId, result }) => {
  const startTime = executionTimers.get(executionId);
  if (startTime) {
    const duration = Date.now() - startTime;
    metricsCollector.recordHistogram('tool.execution.duration', duration, { toolId });
    executionTimers.delete(executionId);
  }
});

// 执行错误：记录错误
toolService.on('execution:error', ({ toolId, executionId, error }) => {
  metricsCollector.incrementCounter('tool.execution.errors', { toolId });
  console.error(`工具执行错误 [${toolId}]: ${error.message}`);
});

// == 队列级别钩子（ToolExecutor）==

toolExecutor.on('execution:queued', ({ toolId, queueLength }) => {
  console.log(`工具 ${toolId} 已加入队列，当前队列长度: ${queueLength}`);
});

toolExecutor.on('queue:full', () => {
  console.warn('执行队列已满！');
  alertService.sendAlert('tool_execution_queue_full');
});

toolExecutor.on('queue:empty', () => {
  console.log('执行队列已清空');
});

toolExecutor.on('execution:cancelled', ({ toolId, executionId }) => {
  console.log(`工具执行已取消: ${toolId} (${executionId})`);
});
```

---

## 7. 工作流钩子（WorkflowExecutor）

### 工作流执行事件

WorkflowExecutor 通过 `NodeExecutor` 函数类型和执行生命周期事件提供钩子能力：

```typescript
// packages/agent/src/workflow/engine/WorkflowExecutor.ts

// 节点执行器函数类型 —— 核心钩子点
export type NodeExecutor = (
  task: Task,
  input: Record<string, unknown>,
  context: Record<string, unknown>
) => Promise<TaskExecutionResult>;
```

### 工作流执行生命周期

```
task:start → NodeExecutor 执行 → task:complete / task:error / task:timeout
                                              ↓
                                        task:cancelled（可中断）
```

### 任务执行结果

```typescript
export interface TaskExecutionResult {
  success: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  duration: number;
}
```

### 使用示例：工作流节点钩子

```typescript
import { WorkflowExecutor, type NodeExecutor } from '@organic/agent';

// 创建自定义 NodeExecutor（核心钩子点）
const loggingExecutor: NodeExecutor = async (task, input, context) => {
  console.log(`[Node] 执行节点: ${task.id} (${task.type})`);
  console.log(`[Node] 输入:`, input);

  const startTime = Date.now();

  try {
    // 调用实际的执行器
    const result = await actualExecutor(task, input, context);

    const duration = Date.now() - startTime;
    console.log(`[Node] 完成: ${task.id}, 耗时: ${duration}ms, 成功: ${result.success}`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Node] 失败: ${task.id}, 耗时: ${duration}ms`, error);
    throw error;
  }
};

// 创建 WorkflowExecutor 并注册自定义 executor
const executor = new WorkflowExecutor(loggingExecutor, {
  maxConcurrency: 10,
  defaultTimeout: 3600000,
  autoRetry: true,
  enableTracking: true,
});

// == 监听工作流执行事件 ==

// 任务开始
executor.on('task:start', ({ task, execution }) => {
  console.log(`[Workflow] 任务开始: ${task.id} (${execution.id})`);
});

// 任务完成
executor.on('task:complete', ({ task, execution, result }) => {
  console.log(`[Workflow] 任务完成: ${task.id}, 状态: ${execution.status}`);
  if (result.success) {
    console.log(`[Workflow] 输出:`, result.output);
  }
});

// 任务失败
executor.on('task:error', ({ task, execution, error }) => {
  console.error(`[Workflow] 任务失败: ${task.id}, 错误: ${error.message}`);
});

// 任务超时
executor.on('task:timeout', ({ task, execution }) => {
  console.warn(`[Workflow] 任务超时: ${task.id}`);
});

// 任务取消
executor.on('task:cancelled', ({ task, execution }) => {
  console.log(`[Workflow] 任务取消: ${task.id}`);
});

// 执行任务
const result = await executor.executeTask(task, execution, input, context);

// 检查是否需要重试
if (executor.shouldRetry(task, execution)) {
  const retryResult = await executor.scheduleRetry(task, execution, input, context);
}
```

---

## 8. UI/TUI 钩子

### Sandbox 事件

Sandbox 提供 UI 操作的安全隔离环境，其事件钩子覆盖会话和操作生命周期：

```typescript
// packages/ui/src/core/Sandbox.ts

export interface SandboxEvents {
  'session:created':    { session: SandboxSession; timestamp: number };
  'session:terminated': { session: SandboxSession; timestamp: number };
  'operation:recorded': { context: SandboxOperationContext; timestamp: number };
  'permission:denied':  {
    sessionId: string;
    operation: UIOperationType;
    reason: string;
    timestamp: number;
  };
}
```

### PermissionCheckResult 拦截点

`checkPermission()` 是 UI 操作前的核心拦截点，返回 `PermissionCheckResult` 决定操作是否允许：

```typescript
export interface PermissionCheckResult {
  allowed: boolean;              // 操作是否允许
  reason?: string;               // 拒绝原因
  requiresConfirmation: boolean; // 是否需要用户确认
  warnings: string[];            // 警告信息
}
```

### UIAgent 事件

UIAgent 提供 AI 驱动的 UI 操作能力，其事件钩子覆盖 Agent 和操作生命周期：

```typescript
// packages/ui/src/core/UIAgent.ts

export interface UIAgentEvents {
  'agent:start':      { agentId: string; timestamp: number };
  'agent:stop':       { agentId: string; timestamp: number };
  'agent:pause':      { agentId: string; timestamp: number };
  'agent:resume':     { agentId: string; timestamp: number };
  'session:start':    { agentId: string; sessionId: string; timestamp: number };
  'session:end':      { agentId: string; sessionId: string; timestamp: number };
  'operation:request': {
    agentId: string;
    sessionId: string;
    operation: UIOperationType;
    timestamp: number;
  };
  'operation:execute': {
    agentId: string;
    sessionId: string;
    result: UIOperationResult;
    timestamp: number;
  };
  'operation:confirm': { agentId: string; operation: UIOperationType; timestamp: number };
  'operation:cancel':  {
    agentId: string;
    operation: UIOperationType;
    reason: string;
    timestamp: number;
  };
  'permission:denied': {
    agentId: string;
    operation: UIOperationType;
    reason: string;
    timestamp: number;
  };
}
```

### UIOperationRequest 拦截点

`UIOperationRequest` 是 UI 操作请求的拦截点，在 `execute()` 方法中经过权限检查后再执行：

```typescript
export interface UIOperationRequest {
  type: UIOperationType;
  input: UIOperationInput;
  options?: {
    timeout?: number;
    retry?: number;
    force?: boolean;  // 强制执行（跳过确认）
  };
}
```

### 使用示例：UI 操作监控

```typescript
import { Sandbox, UIAgent } from '@organic/ui';

const sandbox = new Sandbox({ permissionLevel: 'L2', requireConfirmation: true });
const uiAgent = new UIAgent({
  agentId: 'ui-agent-1',
  name: 'BrowserAgent',
  autoConfirmSensitive: false,
});

// == Sandbox 级别钩子 ==

// 会话创建
sandbox.on('session:created', ({ session }) => {
  console.log(`沙箱会话创建: ${session.sessionId} (Agent: ${session.agentId})`);
});

// 会话终止
sandbox.on('session:terminated', ({ session }) => {
  console.log(`沙箱会话终止: ${session.sessionId}`);
});

// 操作记录
sandbox.on('operation:recorded', ({ context }) => {
  console.log(`操作记录: ${context.operation} on ${context.selector}`);
});

// 权限拒绝
sandbox.on('permission:denied', ({ sessionId, operation, reason }) => {
  console.warn(`权限拒绝: ${operation} in ${sessionId}, 原因: ${reason}`);
});

// == UIAgent 级别钩子 ==

uiAgent.on('agent:start', ({ agentId }) => {
  console.log(`UIAgent 已启动: ${agentId}`);
});

uiAgent.on('agent:stop', ({ agentId }) => {
  console.log(`UIAgent 已停止: ${agentId}`);
});

uiAgent.on('session:start', ({ sessionId }) => {
  console.log(`UI 会话已开始: ${sessionId}`);
});

uiAgent.on('session:end', ({ sessionId }) => {
  console.log(`UI 会话已结束: ${sessionId}`);
});

// 操作请求（拦截点）
uiAgent.on('operation:request', ({ agentId, sessionId, operation }) => {
  console.log(`UI 操作请求: ${operation} (Agent: ${agentId})`);
  // 可在此处做额外的参数校验或日志记录
});

// 操作执行结果
uiAgent.on('operation:execute', ({ agentId, result }) => {
  if (result.success) {
    console.log(`UI 操作成功: ${result.type}, 耗时: ${result.executionTime}ms`);
  } else {
    console.error(`UI 操作失败: ${result.type}, 错误: ${result.error}`);
  }
});

// 敏感操作确认
uiAgent.on('operation:confirm', ({ operation }) => {
  console.log(`等待用户确认敏感操作: ${operation}`);
});

// 操作取消
uiAgent.on('operation:cancel', ({ operation, reason }) => {
  console.log(`操作已取消: ${operation}, 原因: ${reason}`);
});

// 权限拒绝
uiAgent.on('permission:denied', ({ operation, reason }) => {
  console.warn(`UI 权限拒绝: ${operation}, 原因: ${reason}`);
});
```

---

## 9. 上下文钩子（ContextService / ContextManager）

### ContextService 事件

ContextService 是上下文管理的核心服务，其事件覆盖上下文生命周期和内容变更：

```typescript
// packages/agent/src/context/services/ContextService.ts

// ContextService 发出的事件（通过 EventEmitter）：
// 'context:created'  - 上下文创建
// 'context:deleted'  - 上下文删除
// 'message:added'    - 消息添加（转发自 ContextManager）
// 'state:changed'    - 状态变更（转发自 ContextManager）
// 'item:added'       - 上下文项添加
// 'item:updated'     - 上下文项更新
// 'item:deleted'     - 上下文项删除
// 'frame:pushed'     - 执行帧入栈
// 'frame:popped'     - 执行帧出栈
```

### ContextManager 状态订阅

ContextManager 提供 `subscribe()` 方法，允许订阅特定状态键的变化：

```typescript
export type ContextChangeCallback = (change: StateChange) => void;

// 订阅单个状态键
const unsubscribe = contextManager.subscribe('workflow_status', (change) => {
  console.log(`状态变更: ${change.key}, ${change.oldValue} → ${change.newValue}`);
  console.log(`变更类型: ${change.changeType}`); // 'set' | 'update' | 'delete'
});

// 订阅多个状态键
const unsubscribe2 = contextManager.subscribe(['key1', 'key2', 'key3'], (change) => {
  console.log(`状态 ${change.key} 已变更`);
});

// 取消订阅
unsubscribe();
unsubscribe2();
```

### ContextWindowManager 事件

ContextWindowManager 管理 Agent 的上下文窗口，提供窗口生命周期事件：

```typescript
// packages/agent/src/context/services/ContextWindowManager.ts

// ContextWindowManager 发出的事件：
// 'window:created'   - 窗口创建
// 'window:slid'      - 窗口滑动（forward/backward）
// 'window:optimized' - 窗口优化（Token 限制）
// 'window:deleted'   - 窗口删除
// 'windows:cleared'  - 所有窗口清除
```

### 使用示例：上下文变更监控

```typescript
import { ContextService, ContextManager, ContextWindowManager } from '@organic/agent';

const contextService = new ContextService({ maxWindowSize: 100, ttl: 3600000 });
const windowManager = new ContextWindowManager();

// == ContextService 钩子 ==

// 上下文创建
contextService.on('context:created', (context) => {
  console.log(`上下文创建: ${context.id}, 会话: ${context.sessionId}`);
});

// 消息添加
contextService.on('message:added', ({ contextId, message }) => {
  console.log(`消息添加: ${contextId}, 发送者: ${message.sender.name}`);
});

// 状态变更
contextService.on('state:changed', ({ contextId, change }) => {
  console.log(`状态变更: ${contextId}, ${change.key}: ${change.oldValue} → ${change.newValue}`);
});

// 上下文项管理
contextService.on('item:added', ({ contextId, item }) => {
  console.log(`上下文项添加: ${contextId}, 类型: ${item.type}`);
});

contextService.on('item:updated', ({ contextId, itemId }) => {
  console.log(`上下文项更新: ${contextId}/${itemId}`);
});

contextService.on('item:deleted', ({ contextId, itemId }) => {
  console.log(`上下文项删除: ${contextId}/${itemId}`);
});

// 执行帧管理
contextService.on('frame:pushed', ({ contextId, frame }) => {
  console.log(`执行帧入栈: ${contextId}, 深度: ${frame.status}`);
});

contextService.on('frame:popped', ({ contextId, frame }) => {
  console.log(`执行帧出栈: ${contextId}, 状态: ${frame.status}`);
});

// == ContextWindowManager 钩子 ==

windowManager.on('window:created', (window) => {
  console.log(`窗口创建: ${window.id}, 消息数: ${window.messages.length}, Token: ${window.tokenCount}`);
});

windowManager.on('window:slid', ({ window, direction }) => {
  console.log(`窗口滑动: ${direction}, 范围: [${window.startIndex}, ${window.endIndex}]`);
});

windowManager.on('window:optimized', (window) => {
  console.log(`窗口优化: ${window.id}, 新 Token 数: ${window.tokenCount}`);
});

windowManager.on('window:deleted', (windowId) => {
  console.log(`窗口删除: ${windowId}`);
});

windowManager.on('windows:cleared', (count) => {
  console.log(`所有窗口已清除: ${count} 个`);
});

// == ContextManager 状态订阅（精准订阅）==

const contextManager = new ContextManager();

// 订阅特定状态键
const unsubscribe = contextManager.subscribe('task:progress', (change) => {
  console.log(`任务进度变更: ${change.oldValue}% → ${change.newValue}%`);
});

// 订阅多个状态键
const unsubscribe2 = contextManager.subscribe(
  ['agent:status', 'workflow:state'],
  (change) => {
    console.log(`状态变更: ${change.key} = ${change.newValue}`);
  }
);
```

---

## 10. 存储钩子（StorageService）

### 存储事务钩子

StorageService 提供事务生命周期管理，事务本身可作为钩子注入点：

```typescript
// packages/storage/src/services/StorageService.ts

export enum TransactionStatus {
  ACTIVE     = 'active',
  COMMITTED  = 'committed',
  ROLLED_BACK = 'rolled_back',
  EXPIRED    = 'expired',
}

export interface Transaction {
  id: string;
  startTime: number;
  isolation: IsolationLevel;
  status: TransactionStatus;
}
```

### 事务生命周期

```
beginTransaction → ACTIVE → commitTransaction → COMMITTED
                          → rollbackTransaction → ROLLED_BACK
                          → 超时 → EXPIRED (auto-rollback)
```

### 使用示例：存储事务钩子包装器

```typescript
import { StorageService, IsolationLevel, TransactionStatus } from '@organic/storage';

const storageService = new StorageService(backend);

// 包装事务操作，在事务前后添加钩子
async function transactionalWithHooks<T>(
  fn: (transaction: Transaction) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  // 前钩子：开始事务
  const transaction = await storageService.beginTransaction(options);
  console.log(`[Storage] 事务开始: ${transaction.id}, 隔离级别: ${transaction.isolation}`);

  try {
    // 执行业务逻辑
    const result = await fn(transaction);

    // 后钩子：提交事务
    await storageService.commitTransaction();
    console.log(`[Storage] 事务提交: ${transaction.id}`);

    return result;
  } catch (error) {
    // 错误钩子：回滚事务
    console.error(`[Storage] 事务回滚: ${transaction.id}`, error);
    await storageService.rollbackTransaction();

    throw error;
  }
}

// 使用示例
await transactionalWithHooks(async (tx) => {
  await storageService.create({ type: 'user', data: { name: 'Alice' } });
  await storageService.create({ type: 'user', data: { name: 'Bob' } });
  return { created: 2 };
}, {
  isolation: IsolationLevel.SERIALIZABLE,
  timeout: 30000,
  retryOnConflict: true,
});

// 检查事务状态
const info = await storageService.getStorageInfo();
console.log(`事务活跃: ${info.transactionActive}`);
```

### 实体生命周期钩子

虽然 StorageService 没有内置的实体生命周期钩子，但可以通过包装器模式实现：

```typescript
// 实体生命周期钩子包装器
class StorageServiceWithHooks extends StorageService {
  private hooks: {
    beforeCreate: Array<(entity: Partial<StorageEntity>) => Promise<void>>;
    afterCreate: Array<(entity: StorageEntity) => Promise<void>>;
    beforeUpdate: Array<(id: string, data: Record<string, unknown>) => Promise<void>>;
    afterUpdate: Array<(entity: StorageEntity) => Promise<void>>;
    beforeDelete: Array<(id: string) => Promise<void>>;
    afterDelete: Array<(id: string) => Promise<void>>;
  } = {
    beforeCreate: [],
    afterCreate: [],
    beforeUpdate: [],
    afterUpdate: [],
    beforeDelete: [],
    afterDelete: [],
  };

  // 注册钩子
  onBeforeCreate(hook: (entity: Partial<StorageEntity>) => Promise<void>) {
    this.hooks.beforeCreate.push(hook);
  }
  onAfterCreate(hook: (entity: StorageEntity) => Promise<void>) {
    this.hooks.afterCreate.push(hook);
  }
  onBeforeUpdate(hook: (id: string, data: Record<string, unknown>) => Promise<void>) {
    this.hooks.beforeUpdate.push(hook);
  }
  onAfterUpdate(hook: (entity: StorageEntity) => Promise<void>) {
    this.hooks.afterUpdate.push(hook);
  }
  onBeforeDelete(hook: (id: string) => Promise<void>) {
    this.hooks.beforeDelete.push(hook);
  }
  onAfterDelete(hook: (id: string) => Promise<void>) {
    this.hooks.afterDelete.push(hook);
  }

  async createWithHooks(entity: Partial<StorageEntity>): Promise<StorageEntity> {
    for (const hook of this.hooks.beforeCreate) await hook(entity);
    const result = await super.create(entity);
    for (const hook of this.hooks.afterCreate) await hook(result);
    return result;
  }

  async updateWithHooks(id: string, data: Record<string, unknown>): Promise<StorageEntity> {
    for (const hook of this.hooks.beforeUpdate) await hook(id, data);
    const result = await super.update(id, data);
    for (const hook of this.hooks.afterUpdate) await hook(result);
    return result;
  }

  async deleteWithHooks(id: string): Promise<boolean> {
    for (const hook of this.hooks.beforeDelete) await hook(id);
    const result = await super.delete(id);
    for (const hook of this.hooks.afterDelete) await hook(id);
    return result;
  }
}
```

---

## 11. 自定义钩子注册

### 在 Plugin 中注册自定义钩子

Plugin 可以通过 EventBus 或 EventEmitter 模式注册自定义钩子：

```typescript
// 方式一：使用 EventBus 注册系统级钩子
class MyPlugin {
  private subscriptions: EventSubscription[] = [];

  async onLoad(kernel: KernelApi): Promise<void> {
    const eventBus = kernel.getEventBus();

    // 注册多个钩子
    this.subscriptions.push(
      eventBus.on(KernelEvents.KERNEL_START, this.onKernelStart.bind(this)),
      eventBus.onWildcard('plugin:*', this.onPluginEvent.bind(this)),
      eventBus.on(KernelEvents.CONFIG_UPDATE, this.onConfigUpdate.bind(this)),
    );
  }

  async onUnload(): Promise<void> {
    // 清理所有订阅
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  private onKernelStart(event: KernelEvent): void {
    console.log('Kernel 已启动，初始化 Plugin 资源');
  }

  private onPluginEvent(event: KernelEvent): void {
    console.log(`Plugin 事件: ${event.type}`);
  }

  private onConfigUpdate(event: KernelEvent): void {
    console.log('配置已更新，重新加载');
  }
}
```

### 在 Agent 中注册自定义钩子

```typescript
// 方式二：使用 EventEmitter 注册组件级钩子
class CustomAgent extends Agent {
  private setupCustomHooks(): void {
    // 任务执行前钩子
    this.prependListener('task:start', ({ taskId }) => {
      this.validateTaskResources(taskId);
    });

    // 任务完成后钩子
    this.on('task:complete', ({ taskId, result }) => {
      this.cacheTaskResult(taskId, result);
    });

    // 任务失败后钩子
    this.on('task:error', ({ taskId, error }) => {
      this.logTaskFailure(taskId, error);
      this.maybeRetryTask(taskId);
    });
  }

  private validateTaskResources(taskId: string): void { /* ... */ }
  private cacheTaskResult(taskId: string, result: AgentResult): void { /* ... */ }
  private logTaskFailure(taskId: string, error: Error): void { /* ... */ }
  private maybeRetryTask(taskId: string): void { /* ... */ }
}
```

### 在外部系统中注册全局钩子

```typescript
// 方式三：全局钩子注册器
class GlobalHookRegistry {
  private hooks: Map<string, Set<Function>> = new Map();

  register<T extends (...args: any[]) => any>(eventName: string, hook: T): () => void {
    if (!this.hooks.has(eventName)) {
      this.hooks.set(eventName, new Set());
    }
    this.hooks.get(eventName)!.add(hook);

    // 返回取消注册函数
    return () => {
      this.hooks.get(eventName)?.delete(hook);
    };
  }

  async execute(eventName: string, ...args: unknown[]): Promise<void> {
    const hooks = this.hooks.get(eventName);
    if (!hooks) return;

    for (const hook of hooks) {
      try {
        await hook(...args);
      } catch (error) {
        console.error(`钩子执行失败 [${eventName}]:`, error);
      }
    }
  }
}

// 使用
const globalHooks = new GlobalHookRegistry();

// 注册全局钩子
globalHooks.register('system:startup', async () => {
  console.log('系统启动全局钩子');
  await initializeServices();
});

globalHooks.register('system:shutdown', async () => {
  console.log('系统关闭全局钩子');
  await cleanupResources();
});

// 执行全局钩子
await globalHooks.execute('system:startup');
```

---

## 12. Middleware 模式

### 责任链模式

Middleware 模式基于责任链（Chain of Responsibility），允许在操作执行前后插入多个中间件：

```typescript
// 中间件接口
interface Middleware<TContext = unknown> {
  name: string;
  priority?: number;
  process(context: TContext, next: () => Promise<void>): Promise<void>;
}

// 中间件链管理器
class MiddlewareChain<TContext> {
  private middlewares: Middleware<TContext>[] = [];

  use(middleware: Middleware<TContext>): void {
    this.middlewares.push(middleware);
    // 按优先级排序
    this.middlewares.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  remove(name: string): boolean {
    const index = this.middlewares.findIndex(m => m.name === name);
    if (index !== -1) {
      this.middlewares.splice(index, 1);
      return true;
    }
    return false;
  }

  async execute(context: TContext): Promise<void> {
    const executeMiddleware = async (index: number): Promise<void> => {
      if (index >= this.middlewares.length) {
        return; // 链结束
      }

      const middleware = this.middlewares[index];
      await middleware.process(context, () => executeMiddleware(index + 1));
    };

    await executeMiddleware(0);
  }
}
```

### 工具执行中间件

```typescript
// 工具执行上下文
interface ToolExecutionContext {
  toolId: string;
  input: unknown;
  options: ToolExecutionOptions;
  result?: ToolResult;
  startTime: number;
}

// 使用中间件链包装工具执行
class ToolExecutionMiddlewareChain {
  private chain = new MiddlewareChain<ToolExecutionContext>();

  async execute(
    toolId: string,
    input: unknown,
    options: ToolExecutionOptions,
    executor: () => Promise<ToolResult>
  ): Promise<ToolResult> {
    const context: ToolExecutionContext = {
      toolId,
      input,
      options,
      startTime: Date.now(),
    };

    await this.chain.execute(context);

    return context.result!;
  }
}
```

---

## 13. 完整示例

### 示例一：日志记录中间件

```typescript
// 日志记录中间件 —— 记录所有工具执行
const loggingMiddleware: Middleware<ToolExecutionContext> = {
  name: 'logging',
  priority: 100,
  async process(context, next) {
    console.log(`[LOG] 工具执行开始: ${context.toolId}`);
    console.log(`[LOG] 输入:`, JSON.stringify(context.input));

    await next();

    if (context.result) {
      console.log(`[LOG] 工具执行完成: ${context.toolId}`);
      console.log(`[LOG] 耗时: ${Date.now() - context.startTime}ms`);
      console.log(`[LOG] 成功: ${context.result.success}`);
    }
  },
};

// 注册到工具执行链
const toolChain = new ToolExecutionMiddlewareChain();
toolChain.chain.use(loggingMiddleware);
```

### 示例二：性能监控中间件

```typescript
// 性能监控中间件 —— 收集执行指标
const performanceMiddleware: Middleware<ToolExecutionContext> = {
  name: 'performance-monitor',
  priority: 90,
  async process(context, next) {
    const startTime = process.hrtime.bigint();

    await next();

    const endTime = process.hrtime.bigint();
    const durationNs = Number(endTime - startTime);
    const durationMs = durationNs / 1_000_000;

    // 记录指标
    metricsCollector.recordHistogram('tool.execution.duration_ms', durationMs, {
      toolId: context.toolId,
    });

    // 慢查询告警
    if (durationMs > 5000) {
      console.warn(`[PERF] 慢查询告警: ${context.toolId} 耗时 ${durationMs.toFixed(0)}ms`);
      alertService.sendSlowQueryAlert(context.toolId, durationMs);
    }
  },
};
```

### 示例三：安全审计中间件

```typescript
// 安全审计中间件 —— 记录所有安全相关操作
const securityAuditMiddleware: Middleware<ToolExecutionContext> = {
  name: 'security-audit',
  priority: 80,
  async process(context, next) {
    const auditEntry = {
      action: 'tool_execution',
      toolId: context.toolId,
      timestamp: new Date().toISOString(),
      input: sanitizeSensitiveData(context.input),
      status: 'pending',
    };

    await next();

    auditEntry.status = context.result?.success ? 'success' : 'failure';
    auditEntry.duration = Date.now() - context.startTime;

    // 写入审计日志
    await auditService.record(auditEntry);
  },
};

// 敏感数据脱敏辅助函数
function sanitizeSensitiveData(input: unknown): unknown {
  if (typeof input === 'object' && input !== null) {
    const sanitized = { ...(input as Record<string, unknown>) };
    for (const key of ['password', 'token', 'secret', 'apiKey']) {
      if (key in sanitized) {
        sanitized[key] = '***REDACTED***';
      }
    }
    return sanitized;
  }
  return input;
}
```

### 示例四：工作流性能监控

```typescript
// 工作流性能监控 —— 记录每个节点的执行时间
function createWorkflowPerformanceMonitor(
  nodeExecutor: NodeExecutor
): NodeExecutor {
  return async (task, input, context) => {
    const nodeStartTime = Date.now();

    console.log(`[WorkflowMonitor] 节点开始: ${task.id} (${task.type})`);

    try {
      const result = await nodeExecutor(task, input, context);
      const duration = Date.now() - nodeStartTime;

      console.log(`[WorkflowMonitor] 节点完成: ${task.id}, 耗时: ${duration}ms`);

      // 发送指标
      metricsCollector.recordHistogram('workflow.node.duration_ms', duration, {
        nodeId: task.id,
        nodeType: task.type,
        status: result.success ? 'success' : 'failure',
      });

      return result;
    } catch (error) {
      const duration = Date.now() - nodeStartTime;
      console.error(`[WorkflowMonitor] 节点失败: ${task.id}, 耗时: ${duration}ms`, error);

      metricsCollector.incrementCounter('workflow.node.errors', {
        nodeId: task.id,
        nodeType: task.type,
      });

      throw error;
    }
  };
}

// 使用
const executor = new WorkflowExecutor(
  createWorkflowPerformanceMonitor(actualNodeExecutor)
);
```

### 示例五：完整插件集成示例

```typescript
// 完整的监控插件，集成了所有钩子类型
class MonitoringPlugin implements PluginInterface {
  private subscriptions: EventSubscription[] = [];
  private eventBus!: EventBus;

  getMetadata(): PluginMetadata {
    return {
      id: 'monitoring-plugin',
      name: 'MonitoringPlugin',
      version: '1.0.0',
      apiVersion: '1.0',
      hooks: {
        onLoad: () => this.initialize(),
        onUnload: () => this.cleanup(),
        onError: (error) => this.handleError(error),
        onConfigChange: (config) => this.reloadConfig(config),
      },
    };
  }

  async initialize(): Promise<void> {
    // 1. 注册 EventBus 系统事件
    this.subscriptions.push(
      this.eventBus.on(KernelEvents.KERNEL_START, this.onKernelStart.bind(this)),
      this.eventBus.on(KernelEvents.KERNEL_STOP, this.onKernelStop.bind(this)),
      this.eventBus.onWildcard('plugin:*', this.onPluginEvent.bind(this)),
    );

    // 2. 注册 Agent 事件（通过 Agent 实例）
    const agent = this.getAgent();
    agent.on('task:start', this.onTaskStart.bind(this));
    agent.on('task:complete', this.onTaskComplete.bind(this));
    agent.on('task:error', this.onTaskError.bind(this));

    // 3. 注册 SecurityGuard 事件
    const securityGuard = this.getSecurityGuard();
    securityGuard.on('operation:blocked', this.onOperationBlocked.bind(this));
    securityGuard.on('operation:allowed', this.onOperationAllowed.bind(this));

    // 4. 注册 ToolService 事件
    const toolService = this.getToolService();
    toolService.on('execution:complete', this.onToolExecutionComplete.bind(this));
    toolService.on('execution:error', this.onToolExecutionError.bind(this));

    console.log('[MonitoringPlugin] 所有钩子已注册');
  }

  async cleanup(): Promise<void> {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    console.log('[MonitoringPlugin] 所有钩子已清理');
  }

  // 事件处理器
  private onKernelStart(event: KernelEvent): void {
    this.recordMetric('kernel.start', event.timestamp);
  }

  private onKernelStop(event: KernelEvent): void {
    this.recordMetric('kernel.stop', event.timestamp);
  }

  private onTaskStart(data: { taskId: string; timestamp: number }): void {
    this.recordMetric('task.start', data.timestamp, { taskId: data.taskId });
  }

  private onTaskComplete(data: { taskId: string; result: AgentResult }): void {
    this.recordMetric('task.complete', data.result.executionTime, {
      taskId: data.taskId,
      success: data.result.success,
    });
  }

  private onTaskError(data: { taskId: string; error: Error }): void {
    this.recordMetric('task.error', Date.now(), {
      taskId: data.taskId,
      error: data.error.message,
    });
  }

  private onOperationBlocked(data: { toolId: string; operation: string; reason: string }): void {
    this.recordMetric('security.blocked', Date.now(), data);
  }

  private onOperationAllowed(data: { toolId: string; operation: string }): void {
    this.recordMetric('security.allowed', Date.now(), data);
  }

  private onToolExecutionComplete(data: { toolId: string; result: ToolResult }): void {
    this.recordMetric('tool.execution.complete', data.result.executionTime, {
      toolId: data.toolId,
    });
  }

  private onToolExecutionError(data: { toolId: string; error: Error }): void {
    this.recordMetric('tool.execution.error', Date.now(), {
      toolId: data.toolId,
      error: data.error.message,
    });
  }

  // 辅助方法
  private recordMetric(name: string, value: number, tags?: Record<string, unknown>): void {
    // 发送到监控系统
    this.metricsBackend.send({ name, value, tags, timestamp: Date.now() });
  }
}
```

---

## 14. 钩子参考表

### 完整钩子点汇总

| 模块 | 钩子点 | 类型 | 触发时机 | 方向 |
|------|--------|------|----------|------|
| **PluginHooks** | `onLoad` | 回调 | Plugin 加载时 | 同步/异步 |
| **PluginHooks** | `onUnload` | 回调 | Plugin 卸载时 | 同步/异步 |
| **PluginHooks** | `onError` | 回调 | Plugin 发生错误时 | 同步 |
| **PluginHooks** | `onConfigChange` | 回调 | Plugin 配置变更时 | 同步 |
| **PluginLifecycleState** | `DISCOVERED → RESOLVED` | 状态转换 | 依赖解析完成 | — |
| **PluginLifecycleState** | `RESOLVED → LOADING` | 状态转换 | 开始加载 | — |
| **PluginLifecycleState** | `LOADING → INITIALIZED` | 状态转换 | 初始化完成 | — |
| **PluginLifecycleState** | `INITIALIZED → ACTIVE` | 状态转换 | 激活 | — |
| **PluginLifecycleState** | `ACTIVE → RUNNING` | 状态转换 | 开始运行 | — |
| **PluginLifecycleState** | `RUNNING → SHUTTING_DOWN` | 状态转换 | 开始关闭 | — |
| **PluginLifecycleState** | `SHUTTING_DOWN → SHUTDOWN` | 状态转换 | 关闭完成 | — |
| **PluginLifecycleState** | `* → ERROR` | 状态转换 | 任何状态到错误 | — |
| **EventBus** | `kernel:init` | 事件 | Kernel 初始化 | 异步 |
| **EventBus** | `kernel:start` | 事件 | Kernel 启动 | 异步 |
| **EventBus** | `kernel:stop` | 事件 | Kernel 停止 | 异步 |
| **EventBus** | `plugin:register` | 事件 | Plugin 注册 | 异步 |
| **EventBus** | `plugin:unregister` | 事件 | Plugin 注销 | 异步 |
| **EventBus** | `plugin:error` | 事件 | Plugin 错误 | 异步 |
| **EventBus** | `config:update` | 事件 | 配置更新 | 异步 |
| **EventBus** | `onWildcard('prefix:*')` | 通配符订阅 | 匹配到事件 | 异步 |
| **Agent** | `task:start` | 事件 | 任务开始执行 | 同步 |
| **Agent** | `task:complete` | 事件 | 任务执行完成 | 同步 |
| **Agent** | `task:error` | 事件 | 任务执行失败 | 同步 |
| **Agent** | `status:change` | 事件 | Agent 状态变更 | 同步 |
| **Agent** | `child:register` | 事件 | 子 Agent 注册 | 同步 |
| **Agent** | `child:unregister` | 事件 | 子 Agent 注销 | 同步 |
| **Agent** | `heartbeat` | 事件 | 心跳定时触发 | 同步 |
| **LifecycleManager** | `onBeforeTransition` | 钩子回调 | 状态转换前 | 异步 |
| **LifecycleManager** | `onAfterTransition` | 钩子回调 | 状态转换后 | 异步 |
| **LifecycleState** | `CREATED → INITIALIZING` | 状态转换 | Kernel 开始初始化 | — |
| **LifecycleState** | `INITIALIZING → INITIALIZED` | 状态转换 | Kernel 初始化完成 | — |
| **LifecycleState** | `INITIALIZED → STARTING` | 状态转换 | Kernel 开始启动 | — |
| **LifecycleState** | `STARTING → RUNNING` | 状态转换 | Kernel 运行中 | — |
| **LifecycleState** | `RUNNING → STOPPING` | 状态转换 | Kernel 开始停止 | — |
| **LifecycleState** | `STOPPING → STOPPED` | 状态转换 | Kernel 已停止 | — |
| **LifecycleState** | `* → ERROR` | 状态转换 | 任何状态到错误 | — |
| **SecurityGuard** | `preset:changed` | 事件 | 安全预设变更 | 同步 |
| **SecurityGuard** | `operation:blocked` | 事件 | 操作被阻止 | 同步 |
| **SecurityGuard** | `operation:allowed` | 事件 | 操作被允许 | 同步 |
| **SecurityGuard** | `authorize()` | 拦截点 | 工具授权请求 | 异步 |
| **SecurityGuard** | `checkOperation()` | 拦截点 | 操作权限检查 | 同步 |
| **ToolService** | `tool:registered` | 事件 | 工具注册 | 同步 |
| **ToolService** | `tool:unregistered` | 事件 | 工具注销 | 同步 |
| **ToolService** | `tool:enabled` | 事件 | 工具启用 | 同步 |
| **ToolService** | `tool:disabled` | 事件 | 工具禁用 | 同步 |
| **ToolService** | `execution:start` | 事件 | 工具开始执行 | 同步 |
| **ToolService** | `execution:complete` | 事件 | 工具执行完成 | 同步 |
| **ToolService** | `execution:error` | 事件 | 工具执行错误 | 同步 |
| **ToolExecutor** | `execution:queued` | 事件 | 加入执行队列 | 同步 |
| **ToolExecutor** | `execution:started` | 事件 | 开始执行 | 同步 |
| **ToolExecutor** | `execution:completed` | 事件 | 执行完成 | 同步 |
| **ToolExecutor** | `execution:failed` | 事件 | 执行失败 | 同步 |
| **ToolExecutor** | `execution:cancelled` | 事件 | 执行取消 | 同步 |
| **ToolExecutor** | `queue:empty` | 事件 | 队列为空 | 同步 |
| **ToolExecutor** | `queue:full` | 事件 | 队列已满 | 同步 |
| **WorkflowExecutor** | `NodeExecutor` | 钩子函数 | 每个节点执行 | 异步 |
| **WorkflowExecutor** | `task:start` | 事件 | 工作流任务开始 | 同步 |
| **WorkflowExecutor** | `task:complete` | 事件 | 工作流任务完成 | 同步 |
| **WorkflowExecutor** | `task:error` | 事件 | 工作流任务失败 | 同步 |
| **WorkflowExecutor** | `task:timeout` | 事件 | 工作流任务超时 | 同步 |
| **WorkflowExecutor** | `task:cancelled` | 事件 | 工作流任务取消 | 同步 |
| **Sandbox** | `session:created` | 事件 | 沙箱会话创建 | 同步 |
| **Sandbox** | `session:terminated` | 事件 | 沙箱会话终止 | 同步 |
| **Sandbox** | `operation:recorded` | 事件 | 操作记录 | 同步 |
| **Sandbox** | `permission:denied` | 事件 | 权限拒绝 | 同步 |
| **Sandbox** | `checkPermission()` | 拦截点 | 权限检查 | 同步 |
| **UIAgent** | `agent:start` | 事件 | UIAgent 启动 | 同步 |
| **UIAgent** | `agent:stop` | 事件 | UIAgent 停止 | 同步 |
| **UIAgent** | `agent:pause` | 事件 | UIAgent 暂停 | 同步 |
| **UIAgent** | `agent:resume` | 事件 | UIAgent 恢复 | 同步 |
| **UIAgent** | `session:start` | 事件 | UI 会话开始 | 同步 |
| **UIAgent** | `session:end` | 事件 | UI 会话结束 | 同步 |
| **UIAgent** | `operation:request` | 事件 | UI 操作请求 | 同步 |
| **UIAgent** | `operation:execute` | 事件 | UI 操作执行结果 | 同步 |
| **UIAgent** | `operation:confirm` | 事件 | 等待用户确认 | 同步 |
| **UIAgent** | `operation:cancel` | 事件 | 操作取消 | 同步 |
| **UIAgent** | `permission:denied` | 事件 | 权限拒绝 | 同步 |
| **UIAgent** | `UIOperationRequest` | 拦截点 | 操作请求参数 | — |
| **ContextService** | `context:created` | 事件 | 上下文创建 | 同步 |
| **ContextService** | `context:deleted` | 事件 | 上下文删除 | 同步 |
| **ContextService** | `message:added` | 事件 | 消息添加 | 同步 |
| **ContextService** | `state:changed` | 事件 | 状态变更 | 同步 |
| **ContextService** | `item:added` | 事件 | 上下文项添加 | 同步 |
| **ContextService** | `item:updated` | 事件 | 上下文项更新 | 同步 |
| **ContextService** | `item:deleted` | 事件 | 上下文项删除 | 同步 |
| **ContextService** | `frame:pushed` | 事件 | 执行帧入栈 | 同步 |
| **ContextService** | `frame:popped` | 事件 | 执行帧出栈 | 同步 |
| **ContextManager** | `subscribe()` | 订阅回调 | 状态键值变更 | 同步 |
| **ContextWindowManager** | `window:created` | 事件 | 窗口创建 | 同步 |
| **ContextWindowManager** | `window:slid` | 事件 | 窗口滑动 | 同步 |
| **ContextWindowManager** | `window:optimized` | 事件 | 窗口优化 | 同步 |
| **ContextWindowManager** | `window:deleted` | 事件 | 窗口删除 | 同步 |
| **ContextWindowManager** | `windows:cleared` | 事件 | 所有窗口清除 | 同步 |
| **StorageService** | `beginTransaction` | 事务钩子 | 事务开始 | 异步 |
| **StorageService** | `commitTransaction` | 事务钩子 | 事务提交 | 异步 |
| **StorageService** | `rollbackTransaction` | 事务钩子 | 事务回滚 | 异步 |
| **StorageService** | 事务超时自动回滚 | 事务钩子 | 事务超时 | 异步 |

---

## 15. 最佳实践

### 钩子注册顺序

钩子的执行顺序遵循以下规则：

1. **EventBus 钩子**：按注册顺序执行，先注册的 listener 先执行
2. **LifecycleManager 钩子**：`before` 钩子先于状态转换，`after` 钩子后于状态转换；同一类型的钩子按注册顺序执行
3. **Middleware 链**：按 `priority` 降序执行（高优先级先执行），同优先级按注册顺序
4. **EventEmitter 钩子**：按 `on()` 注册顺序执行，`prependListener()` 可插入到前面

### 钩子中的错误处理

```typescript
// ✅ 推荐：钩子内部捕获错误，不传播到主流程
agent.on('task:start', async ({ taskId }) => {
  try {
    await doSomethingThatMightFail(taskId);
  } catch (error) {
    console.error(`钩子执行失败 [task:start]:`, error);
    // 错误被隔离，不影响任务执行
  }
});

// ❌ 避免：钩子中抛出未捕获的错误
agent.on('task:start', async ({ taskId }) => {
  await doSomethingThatMightFail(taskId); // 如果失败，可能影响后续监听器
});
```

> **注意**：EventBus 和 LifecycleManager 已经内置了错误隔离机制 — 单个监听器的错误不会影响其他监听器或主流程。但在 EventEmitter 钩子中（如 Agent、Sandbox 等），错误可能会中断后续监听器的执行，因此需要自行处理。

### 性能考虑

```typescript
// ✅ 推荐：异步钩子使用非阻塞操作
agent.on('task:complete', async ({ taskId, result }) => {
  // 使用 setImmediate 避免阻塞主流程
  setImmediate(async () => {
    await metricsCollector.record(result);
    await auditService.log(taskId, result);
  });
});

// ✅ 推荐：避免在钩子中执行耗时操作
// 如果需要耗时操作，应使用消息队列异步处理
agent.on('task:complete', ({ taskId, result }) => {
  messageQueue.enqueue({ type: 'task_complete', taskId, result });
  // 快速返回，不阻塞
});

// ❌ 避免：在钩子中执行同步耗时操作
agent.on('task:start', ({ taskId }) => {
  // 不要在事件处理器中执行同步的 CPU 密集型操作
  heavyComputation(); // 会阻塞事件循环
});
```

### 钩子生命周期管理

```typescript
// ✅ 推荐：使用统一的生命周期管理钩子订阅
class HookManager {
  private disposables: Array<{ unsubscribe: () => void } | (() => void)> = [];

  register(disposable: { unsubscribe: () => void } | (() => void)): void {
    this.disposables.push(disposable);
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      if (typeof disposable === 'function') {
        disposable();
      } else {
        disposable.unsubscribe();
      }
    }
    this.disposables = [];
  }
}

// 使用
const hookManager = new HookManager();

// EventBus 订阅
hookManager.register(
  eventBus.on(KernelEvents.KERNEL_START, onKernelStart)
);

// EventEmitter 订阅
agent.on('task:complete', onTaskComplete);
hookManager.register(() => agent.off('task:complete', onTaskComplete));

// ContextManager 订阅
hookManager.register(
  contextManager.subscribe('key', onChange)
);

// Plugin 卸载时清理
async function onUnload() {
  hookManager.dispose();
}
```

### 调试钩子

```typescript
// 调试辅助：追踪所有钩子调用
function createDebugHook<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  return ((...args: any[]) => {
    const startTime = performance.now();
    console.log(`[Hook] ${name} 开始`, { args: args.length });

    try {
      const result = fn(...args);
      const duration = performance.now() - startTime;
      console.log(`[Hook] ${name} 完成 (${duration.toFixed(2)}ms)`);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`[Hook] ${name} 失败 (${duration.toFixed(2)}ms)`, error);
      throw error;
    }
  }) as T;
}

// 使用
agent.on('task:start', createDebugHook('task:start', ({ taskId }) => {
  console.log(`处理任务: ${taskId}`);
}));
```

### 避免循环依赖

```typescript
// ❌ 避免：钩子中触发同一事件导致循环
agent.on('task:complete', ({ taskId }) => {
  agent.execute({ taskId: `${taskId}_sub`, payload: {} }); // 可能触发无限循环
});

// ✅ 推荐：使用标志位或计数器防止循环
let processingDepth = 0;
const MAX_DEPTH = 5;

agent.on('task:complete', ({ taskId }) => {
  if (processingDepth < MAX_DEPTH) {
    processingDepth++;
    agent.execute({ taskId: `${taskId}_sub`, payload: {} });
    processingDepth--;
  }
});
```

---

## 相关文档

- [DOC-006: Plugin插件系统架构](./feature-006-plugin-spec.md)
- [DOC-007: Kernel工具调用服务系统](./feature-007-tool-system.md)
- [DOC-008: 上下文管理服务系统](./feature-008-context-management.md)
- [DOC-009: 工作流引擎](./feature-009-workflow-engine.md)
- [DOC-011: 安全管理系统](./feature-011-security-system.md)
- [DOC-012: Storage存储系统架构](./feature-012-storage-system.md)
- [DOC-013: Monorepo架构](./feature-013-monorepo-architecture.md)
- [架构设计](./architecture.md)
- [开发指南](./development-guide.md)