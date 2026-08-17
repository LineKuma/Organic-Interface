# Sub-agents 委托与编排

## 基本信息

**文档编号**: DOC-016
**所属模块**: 核心 SDK（@organic/agent）
**优先级**: P1
**创建日期**: 2026-07-03
**对应需求**: Sub-agents 委托与编排功能

---

## 1. 概述

Sub-agents（子代理）是 `@organic/agent` 的核心编排能力，允许一个 **父 Agent** 将复杂任务分解为多个子任务，委托给多个 **子 Agent** 并行或串行执行，并最终聚合结果。整套机制由四个核心组件协作完成：

| 组件                     | 职责                                                 |
| ------------------------ | ---------------------------------------------------- |
| **Agent**                | 创建和管理子 Agent，建立父子关系，提供嵌套执行上下文 |
| **OrchestrationLayer**   | 任务分解、Agent 选择、编排计划创建与执行             |
| **ExecutionCoordinator** | 执行计划管理、重试与超时控制、并发限流、进度追踪     |
| **AgentRegistry**        | Agent 注册与发现、健康检查、心跳维持、负载均衡       |

### 典型使用场景

- **数据分析管道**：编排 Agent 获取数据 → 清洗 → 转换 → 生成报告 → 发布
- **多步骤工作流**：将复杂业务流程分解为可独立执行的步骤
- **并行处理**：同时调用多个 Agent 处理独立子任务，聚合结果
- **容错重试**：在子任务失败时自动重试，带指数退避

---

## 2. 架构

```
┌─────────────────────────────────────────────────────────────┐
│                       Parent Agent                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              OrchestrationLayer                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │ Task Decomp  │  │Agent Select  │  │Plan Manager│  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │   │
│  └─────────┼─────────────────┼───────────────┼─────────┘   │
│            │                 │               │              │
│  ┌─────────▼─────────────────▼───────────────▼─────────┐   │
│  │              ExecutionCoordinator                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │  Retry   │  │ Timeout  │  │Concurrency Ctrl  │   │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │   │
│  └─────────────────────┬───────────────────────────────┘   │
│                        │                                    │
│            ┌───────────┼───────────┐                        │
│            │           │           │                        │
│       ┌────▼────┐ ┌────▼────┐ ┌────▼────┐                   │
│       │ Child A │ │ Child B │ │ Child C │                   │
│       └─────────┘ └─────────┘ └─────────┘                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                AgentRegistry                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │Register  │  │Discovery │  │Health & Heartbeat│   │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**数据流**：Parent Agent → OrchestrationLayer（分解任务、选择 Agent）→ ExecutionCoordinator（创建执行计划、控制并发、重试）→ Child Agents（执行具体任务）→ 结果聚合返回。

---

## 3. 创建 Sub-agents

### 3.1 通过 Agent 注册子 Agent

每个 Agent 实例都可以创建和管理子 Agent。父 Agent 维护一个 `childAgents` Map，子 Agent 在构造时通过 `parentId` 建立关联。

```typescript
import { Agent, AgentConfig, AgentType, AgentPriority } from '@organic/agent';

// 创建父 Agent
const parentAgent = new Agent({
  kernel: kernelApi,
  config: {
    id: 'orchestrator-001',
    name: 'Orchestrator',
    type: AgentType.ORCHESTRATOR,
    priority: AgentPriority.HIGH,
    maxDepth: 3, // 最大嵌套深度
    maxParallelTasks: 10, // 最大并行任务数
    capabilities: ['orchestration', 'planning'],
  },
});

// 创建子 Agent
const childAgent = new Agent({
  kernel: kernelApi,
  config: {
    id: 'worker-001',
    name: 'DataProcessor',
    type: AgentType.EXECUTOR,
    parentId: 'orchestrator-001', // 指定父 Agent
    capabilities: ['csv', 'json', 'data-validation'],
    maxParallelTasks: 5,
  },
});

// 注册到父 Agent
parentAgent.registerChildAgent(childAgent);

// 查询子 Agent
const children = parentAgent.getChildAgents();
const specific = parentAgent.getChildAgent('worker-001');

// 注销子 Agent
parentAgent.unregisterChildAgent('worker-001');
```

### 3.2 AgentConfig 关键配置项

```typescript
// 父 Agent 完整配置示例
const config: Partial<AgentConfig> = {
  id: 'orchestrator-001',
  name: 'Orchestrator',
  version: '1.0.0',
  type: AgentType.ORCHESTRATOR,
  priority: AgentPriority.HIGH,
  maxDepth: 3, // 子 Agent 最大嵌套深度（默认 3）
  maxParallelTasks: 10, // 最大并行任务数（默认 10）
  communicationTimeout: 5000, // 通信超时 ms（默认 5000）
  heartbeatInterval: 30, // 心跳间隔 秒（默认 30）
  capabilities: ['orchestration', 'planning', 'decomposition'],
  parentId: undefined, // 顶级 Agent 不设置
};
```

### 3.3 Agent 生命周期

```
INITIALIZING → IDLE ⇄ BUSY → SHUTTING_DOWN → OFFLINE
                  ↓
                ERROR
```

```typescript
// 初始化所有 Agent
await parentAgent.initialize();
await childAgent.initialize();

// 优雅关闭（会自动关闭所有子 Agent）
await parentAgent.shutdown();
// shutdown() 内部:
//   1. 停止心跳
//   2. 并行关闭所有子 Agent
//   3. 清理任务处理器
//   4. 状态设为 OFFLINE
```

---

## 4. 任务分解

### 4.1 DecomposedTask 接口

`OrchestrationLayer` 负责将复杂任务分解为多个子任务，每个子任务由 `DecomposedTask` 定义：

```typescript
interface DecomposedTask {
  /** 子任务唯一 ID */
  subTaskId: string;
  /** 任务名称 */
  taskName: string;
  /** 子任务载荷 */
  payload: Record<string, unknown>;
  /** 依赖的子任务 ID 列表 */
  dependsOn: string[];
  /** 所需能力 */
  requiredCapability?: string;
}
```

### 4.2 自动分解

当 `autoDecompose` 启用且请求的 `payload.subTasks` 包含 `DecomposedTask[]` 时，编排层会自动分解：

```typescript
import {
  OrchestrationLayer,
  OrchestrationStrategy,
  OrchestrationLayerConfig,
} from '@organic/agent';

const orchestration = new OrchestrationLayer(
  registry,
  undefined, // 使用默认 ExecutionCoordinator
  {
    autoDecompose: true, // 启用自动分解
    defaultStrategy: OrchestrationStrategy.AUTO,
    defaultTimeout: 60000,
    maxConcurrentOrchestrations: 10,
  }
);

// 定义子任务
const result = await orchestration.orchestrate({
  requestId: 'pipeline-001',
  taskName: 'data-pipeline',
  payload: {
    subTasks: [
      {
        subTaskId: 'fetch',
        taskName: 'Fetch Data',
        payload: { source: 'https://api.example.com/sales-q1' },
        dependsOn: [],
        requiredCapability: 'http',
      },
      {
        subTaskId: 'clean',
        taskName: 'Clean Data',
        payload: {},
        dependsOn: ['fetch'],
        requiredCapability: 'data-cleaning',
      },
      {
        subTaskId: 'report-csv',
        taskName: 'Generate CSV Report',
        payload: { format: 'csv' },
        dependsOn: ['clean'],
        requiredCapability: 'csv',
      },
      {
        subTaskId: 'report-json',
        taskName: 'Generate JSON Report',
        payload: { format: 'json' },
        dependsOn: ['clean'],
        requiredCapability: 'json',
      },
      {
        subTaskId: 'publish',
        taskName: 'Publish Reports',
        payload: { targets: ['dashboard', 'email'] },
        dependsOn: ['report-csv', 'report-json'],
        requiredCapability: 'publishing',
      },
    ] as DecomposedTask[],
  },
  strategy: OrchestrationStrategy.AUTO,
});

console.log(result.success); // true
console.log(result.duration); // 执行耗时 ms
console.log(result.stepResults); // 每个子步骤的执行结果
```

### 4.3 手动分解

当 `autoDecompose` 为 false（默认）时，需要手动创建多个 `OrchestrationRequest` 并通过 `createPlan` 创建计划：

```typescript
// 手动创建多个请求
const requests = [
  {
    requestId: 'step-1',
    taskName: 'Fetch Data',
    payload: { source: 'https://api.example.com/data' },
    requiredCapability: 'http',
  },
  {
    requestId: 'step-2',
    taskName: 'Process Data',
    payload: { dependsOn: ['step-1'] },
    requiredCapability: 'data-processing',
    dependencies: ['step-1'],
  },
];

// 创建编排计划
const plan = orchestration.createPlan(requests);

// 暂停 / 恢复
orchestration.pause(plan.planId);
const resumeResult = await orchestration.resume(plan.planId);
```

---

## 5. Agent 选择

### 5.1 AgentSelectionStrategy

编排层根据 `AgentSelectionStrategy` 从注册中心中选择最合适的 Agent 执行子任务：

```typescript
interface AgentSelectionStrategy {
  /** 优先选择空闲 Agent */
  preferIdle?: boolean;
  /** 优先选择特定类型 */
  preferType?: string;
  /** 考虑负载均衡 */
  loadBalancing?: boolean;
}
```

### 5.2 能力匹配选择

```typescript
// 选择单个 Agent
const selected = orchestration.selectAgent('csv', {
  preferIdle: true,
  loadBalancing: true,
});

// 获取所有可用 Agent
const available = orchestration.getAvailableAgents('data-cleaning');

// 选择多个 Agent（用于并行执行）
const agents = registry.selectAgents('report-generation', 3);
```

### 5.3 选择逻辑

`AgentRegistry.selectAgent()` 的完整选择流程：

1. 通过 `getAvailableAgents(capability)` 获取候选列表（在线 + 可接受任务）
2. 如果指定了 `maxLoad`，过滤高负载 Agent
3. 如果 `preferIdle` 为 true，按 `activeTaskCount` 升序排列
4. 否则按 `load` 升序排列（负载均衡）
5. 返回排序后的第一个 Agent

```typescript
// 注册中心内部选择逻辑
selectAgent(capability?: string, options?: {
  preferIdle?: boolean;
  maxLoad?: number;
}): AgentMetadata | null {
  const candidates = this.getAvailableAgents(capability);
  // ... 过滤 & 排序 ...
  return candidates[0];
}
```

---

## 6. 执行计划

### 6.1 OrchestrationPlan

编排层创建的顶层计划，包含原始请求和执行计划：

```typescript
interface OrchestrationLayerPlan {
  planId: string;
  request: OrchestrationRequest;
  executionPlan: ExecutionPlan;
  createdAt: number;
  status: OrchestrationPlanStatus;
}

enum OrchestrationPlanStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
```

### 6.2 ExecutionPlan

执行协调器管理的执行计划，包含步骤和并行组：

```typescript
interface ExecutionPlan {
  requestId: string;
  steps: ExecutionStep[];
  parallelGroups: string[][]; // 可并行执行的步骤组
  estimatedDuration?: number;
}

interface ExecutionStep {
  stepId: string;
  request: ExecutionRequest;
  dependsOn: string[]; // 依赖的步骤 ID
  agentId?: string; // 分配的 Agent
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: ExecutionResult;
}
```

### 6.3 计划状态流转

```
PENDING → RUNNING → COMPLETED
              ↓          ↑
           PAUSED ───────┘
              ↓
           CANCELLED
              ↓
            FAILED
```

### 6.4 创建与管理计划

```typescript
// 创建计划
const executionRequests = requests.map(r => ({
  requestId: r.requestId,
  taskName: r.taskName,
  payload: r.payload,
  requiredCapability: r.requiredCapability,
  timeout: 30000,
  retryConfig: {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 5000,
    backoffFactor: 2,
  },
}));

const coordinator = orchestration.getCoordinator();
const plan = coordinator.createPlan(executionRequests);

// 计划会自动识别可并行执行的步骤组
console.log(plan.parallelGroups);
// [['step_2', 'step_3'], ['step_4']]

// 通过编排层管理计划
orchestration.createPlan(requests);
const allPlans = orchestration.listPlans();
const specificPlan = orchestration.getOrchestrationPlan('orchestration_plan_xxx');
```

---

## 7. 执行策略

### 7.1 OrchestrationStrategy 枚举

```typescript
enum OrchestrationStrategy {
  /** 并行执行 — 所有独立步骤同时执行 */
  PARALLEL = 'parallel',
  /** 串行执行 — 步骤按顺序执行，前一步结果注入下一步 */
  SEQUENTIAL = 'sequential',
  /** 自动 — 根据依赖关系自动决定并行/串行 */
  AUTO = 'auto',
}
```

### 7.2 PARALLEL 模式

所有步骤同时执行，适用于彼此独立的子任务：

```typescript
const result = await orchestration.orchestrate({
  requestId: 'parallel-001',
  taskName: 'multi-format-report',
  payload: {
    subTasks: [
      {
        subTaskId: 'pdf',
        taskName: 'PDF Report',
        payload: {},
        dependsOn: [],
        requiredCapability: 'pdf',
      },
      {
        subTaskId: 'html',
        taskName: 'HTML Report',
        payload: {},
        dependsOn: [],
        requiredCapability: 'html',
      },
      {
        subTaskId: 'csv',
        taskName: 'CSV Report',
        payload: {},
        dependsOn: [],
        requiredCapability: 'csv',
      },
    ],
  },
  strategy: OrchestrationStrategy.PARALLEL,
});

// 内部实现
// coordinator.executeParallel(requests) → Promise.all(requests.map(req => execute(req)))
```

### 7.3 SEQUENTIAL 模式

步骤按顺序执行，前一步的结果自动注入到后一步的 payload 中：

```typescript
const result = await orchestration.orchestrate({
  requestId: 'sequential-001',
  taskName: 'etl-pipeline',
  payload: {
    subTasks: [
      { subTaskId: 'extract', taskName: 'Extract', payload: {}, dependsOn: [] },
      { subTaskId: 'transform', taskName: 'Transform', payload: {}, dependsOn: ['extract'] },
      { subTaskId: 'load', taskName: 'Load', payload: {}, dependsOn: ['transform'] },
    ],
  },
  strategy: OrchestrationStrategy.SEQUENTIAL,
});

// 内部实现中，后续步骤的 payload 会被注入:
// {
//   ...originalPayload,
//   previousResult: previousStep.data,
//   previousSuccess: previousStep.success,
// }
```

### 7.4 AUTO 模式

系统根据 `ExecutionPlan` 中的依赖关系自动决定执行顺序。同依赖组的步骤可并行执行，步骤失败时立即停止。

```typescript
// AUTO 模式（默认）
const result = await orchestration.orchestrate({
  requestId: 'auto-001',
  taskName: 'smart-pipeline',
  payload: { subTasks: [...] },
  strategy: OrchestrationStrategy.AUTO,
});

// 内部流程:
// 1. createPlan(requests) → 识别 parallelGroups
// 2. executeWithPlan(plan) → 按依赖拓扑顺序执行
// 3. 依赖满足 → 执行；依赖失败 → 跳过
```

---

## 8. Execution Coordinator

### 8.1 RetryConfig — 重试配置

```typescript
interface RetryConfig {
  /** 最大重试次数（默认 3） */
  maxAttempts?: number;
  /** 基础延迟 ms（默认 100） */
  baseDelay?: number;
  /** 最大延迟 ms（默认 5000） */
  maxDelay?: number;
  /** 指数退避因子（默认 2） */
  backoffFactor?: number;
}

// 默认值
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelay: 100,
  maxDelay: 5000,
  backoffFactor: 2,
};
```

**指数退避计算**：`delay = min(baseDelay × backoffFactor^(attempt-1), maxDelay)`

| 尝试次数      | 延迟                               |
| ------------- | ---------------------------------- |
| 第 1 次失败后 | 100ms                              |
| 第 2 次失败后 | 200ms                              |
| 第 3 次失败后 | 400ms（然后达到 maxAttempts 停止） |

### 8.2 超时控制

```typescript
// 编排层级别 — 默认 60000ms
const orchestration = new OrchestrationLayer(registry, undefined, {
  defaultTimeout: 60000,
});

// 请求级别 — 覆盖编排层默认值
const result = await orchestration.orchestrate({
  requestId: 'timeout-demo',
  taskName: 'long-task',
  payload: {},
  timeout: 120000, // 120 秒超时
  retryConfig: {
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  },
});

// 协调器级别 — 默认 30000ms
coordinator.setDefaultTimeout(60000);
```

### 8.3 并发控制

```typescript
// 编排层最大并发编排数
const orchestration = new OrchestrationLayer(registry, undefined, {
  maxConcurrentOrchestrations: 10, // 同时最多 10 个编排
});

// 达到上限时返回错误
// { success: false, error: 'Max concurrent orchestrations reached', errorCode: 'MAX_CONCURRENT' }
```

### 8.4 进度追踪

通过事件监听追踪执行进度：

```typescript
// 编排层事件
orchestration.on('orchestration:start', ({ requestId }) => {
  console.log(`[Orchestration] Started: ${requestId}`);
});

orchestration.on('orchestration:step-start', ({ requestId, stepId }) => {
  console.log(`[Step] Started: ${stepId} (request: ${requestId})`);
});

orchestration.on('orchestration:step-complete', ({ requestId, stepId, result }) => {
  console.log(`[Step] Completed: ${stepId}`, result.success ? '✓' : '✗');
});

orchestration.on('orchestration:step-failed', ({ requestId, stepId, error }) => {
  console.error(`[Step] Failed: ${stepId} — ${error}`);
});

orchestration.on('orchestration:complete', ({ requestId, result }) => {
  console.log(`[Orchestration] Completed: ${requestId} in ${result.duration}ms`);
  console.log(`  Steps: ${result.stepResults?.length}, Success: ${result.success}`);
});

orchestration.on('orchestration:failed', ({ requestId, error }) => {
  console.error(`[Orchestration] Failed: ${requestId} — ${error}`);
});
```

### 8.5 ExecutionResult 结构

```typescript
interface ExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  duration: number; // 执行耗时 ms
  agentId?: string; // 执行的 Agent
  attempts: number; // 实际尝试次数
  metadata?: Record<string, unknown>;
}
```

---

## 9. 父子通信

### 9.1 AgentExecutionContext

每个任务执行时都会获得一个 `AgentExecutionContext`，包含父子关系信息：

```typescript
interface AgentExecutionContext {
  /** 当前 Agent 实例 */
  agent: Agent;
  /** 任务 ID */
  taskId: string;
  /** 父上下文（嵌套调用时） */
  parentContext?: AgentExecutionContext;
  /** 执行深度（从 0 开始） */
  depth: number;
  /** 开始时间戳 */
  startTime: number;
  /** 是否已取消 */
  cancelled: boolean;
  /** 取消信号 */
  signal?: AbortSignal;
  /** 自定义元数据 */
  metadata: Record<string, unknown>;
}
```

### 9.2 AgentTaskInput — 父任务关联

```typescript
interface AgentTaskInput {
  taskId: string;
  payload: Record<string, unknown>;
  priority?: number;
  /** 父任务 ID — 用于追踪任务树 */
  parentTaskId?: string;
  /** 依赖的任务 ID 列表 */
  dependencies?: string[];
  timeout?: number;
  metadata?: Record<string, unknown>;
}
```

### 9.3 深度追踪

Agent 在创建执行上下文时设置 `depth: 0`。在嵌套调用中，父 Agent 可以将自身的 depth 传递给子任务：

```typescript
// 在父 Agent 的 handler 中调用子 Agent
parentAgent.registerTaskHandler('complex-task', async (input, context) => {
  console.log(`Current depth: ${context.depth}`); // 0

  // 子任务执行
  const result = await childAgent.execute({
    taskId: 'sub-task-001',
    payload: { data: input.someData },
    parentTaskId: context.taskId, // 建立父子关联
    timeout: 10000,
  });

  // 检查取消状态
  if (context.cancelled) {
    throw new Error('Parent task cancelled');
  }

  return result;
});
```

### 9.4 Agent 间消息传递

```typescript
// 通过父 Agent 向其他 Agent 发送消息
await parentAgent.sendMessage('worker-002', 'status:query', {
  taskId: 'task-001',
});

// 事件监听
parentAgent.on('child:register', ({ childId, timestamp }) => {
  console.log(`Child registered: ${childId}`);
});

parentAgent.on('child:unregister', ({ childId, timestamp }) => {
  console.log(`Child unregistered: ${childId}`);
});
```

---

## 10. Agent Registry

### 10.1 注册 Agent

```typescript
import { AgentRegistry, AgentType, AgentRegistryStatus } from '@organic/agent';

// 创建注册中心
const registry = new AgentRegistry({
  name: 'production',
  heartbeatTimeout: 30000, // 心跳超时（默认 30000ms）
  leaseDuration: 60000, // 租约时长（默认 60000ms）
  enableAutoCleanup: true, // 自动清理过期条目
  cleanupInterval: 60000, // 清理间隔（默认 60000ms）
  enableHealthCheck: true, // 启用健康检查
  healthCheckInterval: 10000, // 健康检查间隔（默认 10000ms）
});

// 启动注册中心
registry.start();

// 方式 1：注册已有 Agent 元数据
registry.register({
  id: 'worker-001',
  name: 'DataProcessor',
  type: AgentType.EXECUTOR,
  version: '1.0.0',
  capabilities: [
    { id: 'csv', description: 'CSV processing' },
    { id: 'json', description: 'JSON processing' },
  ],
  status: AgentRegistryStatus.ONLINE,
  load: 0,
  childIds: [],
  maxConcurrentTasks: 5,
  activeTaskCount: 0,
  tags: ['production', 'data'],
  registeredAt: Date.now(),
  lastHeartbeatAt: Date.now(),
});

// 方式 2：通过便捷方法注册
registry.registerAgent('worker-002', 'ReportGenerator', AgentType.EXECUTOR, {
  version: '1.0.0',
  capabilities: [
    { id: 'pdf', description: 'PDF generation' },
    { id: 'html', description: 'HTML generation' },
  ],
  maxConcurrentTasks: 3,
  tags: ['production', 'reporting'],
});
```

### 10.2 发现 Agent

```typescript
// 按 ID 查询
const agent = registry.get('worker-001');

// 按能力发现
const csvAgents = registry.discover('csv', {
  maxLoad: 0.8,
  status: AgentRegistryStatus.ONLINE,
});

// 按选择器查询
const selected = registry.find({
  type: AgentType.EXECUTOR,
  capability: 'json',
  status: AgentRegistryStatus.ONLINE,
  maxLoad: 0.7,
  tags: ['production'],
});

// 获取可用 Agent
const available = registry.getAvailableAgents('csv');
// 过滤条件：ONLINE + healthy + load < 1 + activeTaskCount < maxConcurrentTasks

// 列出所有
const all = registry.list();
```

### 10.3 心跳与健康检查

```typescript
// 记录心跳
registry.heartbeat('worker-001', {
  load: 0.3,
  activeTaskCount: 2,
  completedTasks: 150,
});

// 更新状态
registry.updateStatus('worker-001', AgentRegistryStatus.BUSY);

// 更新健康检查结果
registry.updateHealthCheck('worker-001', {
  healthy: true,
  checkedAt: Date.now(),
  responseTime: 12,
});

// 检查健康状况
const healthy = registry.isHealthy('worker-001');
// 检查条件：ONLINE + 心跳未超时 + healthCheck.healthy !== false

const canAccept = registry.canAcceptTasks('worker-001');
// 检查条件：healthy + load < 1 + activeTaskCount < maxConcurrentTasks
```

### 10.4 负载均衡

```typescript
// 选择最佳 Agent（按活跃任务数升序或负载升序）
const best = registry.selectAgent('csv', {
  preferIdle: true,
  maxLoad: 0.5,
});

// 选择多个 Agent（用于并行执行）
const agents = registry.selectAgents('report-generation', 3);
```

### 10.5 生命周期事件

```typescript
registry.on('agent:registered', ({ agentId, metadata }) => {
  console.log(`Agent registered: ${agentId} (${metadata.name})`);
});

registry.on('agent:unregistered', ({ agentId }) => {
  console.log(`Agent unregistered: ${agentId}`);
});

registry.on('agent:updated', ({ agentId, metadata }) => {
  console.log(`Agent updated: ${agentId}`);
});

registry.on('agent:heartbeat', ({ agentId, timestamp }) => {
  // 心跳事件
});

registry.on('agent:health-check', ({ agentId, result }) => {
  if (!result.healthy) {
    console.warn(`Agent unhealthy: ${agentId} — ${result.error}`);
  }
});

registry.on('cleanup:completed', ({ removed }) => {
  console.log(`Cleaned up ${removed} stale entries`);
});

// 停止注册中心
registry.stop();
// 或完全销毁
registry.dispose();
```

### 10.6 AgentMetadata 完整结构

```typescript
interface AgentMetadata {
  id: string; // 唯一标识
  name: string; // 可读名称
  type: AgentType; // ORCHESTRATOR | EXECUTOR | PLANNER | MONITOR | CUSTOM
  version: string; // 版本号
  capabilities: AgentCapability[]; // 能力列表
  status: AgentRegistryStatus; // ONLINE | BUSY | UNAVAILABLE | OFFLINE
  load: number; // 当前负载 0-1
  endpoint?: string; // 端点 URL
  parentId?: string; // 父 Agent ID
  childIds: string[]; // 子 Agent ID 列表
  maxConcurrentTasks: number; // 最大并发任务数
  activeTaskCount: number; // 活跃任务数
  tags: string[]; // 标签
  metadata?: Record<string, unknown>; // 自定义元数据
  registeredAt: number; // 注册时间戳
  lastHeartbeatAt: number; // 最后心跳时间戳
  healthCheck?: HealthCheckResult; // 健康检查结果
}
```

---

## 11. 取消与错误处理

### 11.1 AbortSignal 取消

`ExecutionCoordinator` 在执行计划时创建 `AbortController`，支持通过 `AbortSignal` 取消正在进行的任务：

```typescript
// 取消单个编排
orchestration.cancel('request-001');

// 取消所有编排
orchestration.cancelAll();

// 内部实现 — 通过 AbortController 传播取消信号
// 1. orchestration.cancel() → coordinator.cancel(requestId)
// 2. coordinator.cancel() → execution.abortController.abort()
// 3. 执行中的步骤检测 signal.aborted → 返回 CANCELLED 错误

// 在 execute() 方法中检测取消
// - 执行前检查 signal?.aborted
// - 每次重试前检查 signal?.aborted
// - 使用 Promise.race 与 signal 竞速
```

### 11.2 取消传播

```
OrchestrationLayer.cancel(requestId)
  → ExecutionCoordinator.cancel(requestId)
    → AbortController.abort()
      → 所有 execute() 调用检测 signal.aborted
        → 返回 { success: false, error: 'Execution was cancelled', errorCode: 'CANCELLED' }
```

### 11.3 错误码

| 错误码                | 说明         | 触发场景                   |
| --------------------- | ------------ | -------------------------- |
| `CANCELLED`           | 任务被取消   | AbortSignal 触发           |
| `NO_AGENT`            | 无可用 Agent | 注册中心无匹配 Agent       |
| `EXECUTION_FAILED`    | 执行失败     | 所有重试耗尽               |
| `MAX_CONCURRENT`      | 达到最大并发 | 活跃编排数 ≥ maxConcurrent |
| `ORCHESTRATION_ERROR` | 编排异常     | 编排过程中抛出异常         |
| `PLAN_NOT_FOUND`      | 计划未找到   | resume 不存在的计划        |
| `NOT_PAUSED`          | 计划未暂停   | resume 非暂停状态的计划    |
| `RESUME_FAILED`       | 恢复执行失败 | 恢复执行过程中异常         |

### 11.4 错误处理最佳实践

```typescript
// 模式 1：检查结果
const result = await orchestration.orchestrate({
  requestId: 'safe-001',
  taskName: 'risky-task',
  payload: {},
  retryConfig: {
    maxAttempts: 3,
    baseDelay: 1000,
    backoffFactor: 2,
  },
});

if (!result.success) {
  console.error(`Orchestration failed: ${result.error}`);
  console.error(`Error code: ${result.errorCode}`);

  // 检查部分步骤结果
  for (const step of result.stepResults ?? []) {
    if (!step.success) {
      console.error(`  Step ${step.agentId}: ${step.error} (${step.attempts} attempts)`);
    }
  }
}

// 模式 2：事件监听
orchestration.on('orchestration:step-failed', ({ requestId, stepId, error }) => {
  // 记录失败步骤
  logger.warn(`Step ${stepId} failed in ${requestId}: ${error}`);
});

// 模式 3：带降级的编排
async function orchestrateWithFallback(
  request: OrchestrationRequest
): Promise<OrchestrationResult> {
  const result = await orchestration.orchestrate(request);

  if (!result.success && result.errorCode === 'NO_AGENT') {
    // 降级：使用通用 Agent
    console.warn('No specialized agent found, using fallback...');
    return orchestration.orchestrate({
      ...request,
      requiredCapability: undefined,
      targetAgentId: 'fallback-agent',
    });
  }

  return result;
}
```

---

## 12. 完整示例：多 Agent 数据分析管道

以下示例展示一个完整的 Sub-agents 编排场景：分析销售数据，生成多格式报告，并发布到仪表盘。

```typescript
import {
  Agent,
  AgentType,
  AgentPriority,
  OrchestrationLayer,
  OrchestrationStrategy,
  ExecutionCoordinator,
  AgentRegistry,
  AgentRegistryStatus,
  type AgentConfig,
  type DecomposedTask,
  type OrchestrationResult,
  type AgentTaskInput,
  type AgentResult,
  type AgentMetadata,
} from '@organic/agent';

// ============================================================
// 1. 创建注册中心
// ============================================================
const registry = new AgentRegistry({
  name: 'data-pipeline',
  heartbeatTimeout: 30000,
  enableAutoCleanup: true,
  enableHealthCheck: true,
});
registry.start();

// ============================================================
// 2. 创建编排层
// ============================================================
const orchestration = new OrchestrationLayer(
  registry,
  undefined, // 自动创建 ExecutionCoordinator
  {
    autoDecompose: true,
    defaultStrategy: OrchestrationStrategy.AUTO,
    defaultTimeout: 120000,
    maxConcurrentOrchestrations: 5,
  }
);

// ============================================================
// 3. 创建并注册 Worker Agents
// ============================================================
function createWorkerAgent(id: string, name: string, capabilities: string[], kernel: any): Agent {
  const agent = new Agent({
    kernel,
    config: {
      id,
      name,
      type: AgentType.EXECUTOR,
      priority: AgentPriority.NORMAL,
      maxParallelTasks: 5,
      communicationTimeout: 10000,
      capabilities,
    },
  });
  return agent;
}

// 创建 4 个 Worker Agent
const fetcher = createWorkerAgent(
  'fetcher-01',
  'DataFetcher',
  ['http', 'file', 'database'],
  kernelApi
);
const cleaner = createWorkerAgent(
  'cleaner-01',
  'DataCleaner',
  ['data-cleaning', 'validation'],
  kernelApi
);
const reporter = createWorkerAgent(
  'reporter-01',
  'ReportGenerator',
  ['csv', 'json', 'pdf', 'html'],
  kernelApi
);
const publisher = createWorkerAgent(
  'publisher-01',
  'Publisher',
  ['dashboard', 'email', 'slack'],
  kernelApi
);

// 注册到注册中心
const agentMetas: AgentMetadata[] = [
  {
    id: 'fetcher-01',
    name: 'DataFetcher',
    type: AgentType.EXECUTOR,
    version: '1.0.0',
    status: AgentRegistryStatus.ONLINE,
    load: 0,
    capabilities: [{ id: 'http' }, { id: 'file' }, { id: 'database' }],
    childIds: [],
    maxConcurrentTasks: 5,
    activeTaskCount: 0,
    tags: ['production', 'data-ingestion'],
    registeredAt: Date.now(),
    lastHeartbeatAt: Date.now(),
  },
  {
    id: 'cleaner-01',
    name: 'DataCleaner',
    type: AgentType.EXECUTOR,
    version: '1.0.0',
    status: AgentRegistryStatus.ONLINE,
    load: 0,
    capabilities: [{ id: 'data-cleaning' }, { id: 'validation' }],
    childIds: [],
    maxConcurrentTasks: 5,
    activeTaskCount: 0,
    tags: ['production', 'data-processing'],
    registeredAt: Date.now(),
    lastHeartbeatAt: Date.now(),
  },
  {
    id: 'reporter-01',
    name: 'ReportGenerator',
    type: AgentType.EXECUTOR,
    version: '1.0.0',
    status: AgentRegistryStatus.ONLINE,
    load: 0,
    capabilities: [{ id: 'csv' }, { id: 'json' }, { id: 'pdf' }, { id: 'html' }],
    childIds: [],
    maxConcurrentTasks: 5,
    activeTaskCount: 0,
    tags: ['production', 'reporting'],
    registeredAt: Date.now(),
    lastHeartbeatAt: Date.now(),
  },
  {
    id: 'publisher-01',
    name: 'Publisher',
    type: AgentType.EXECUTOR,
    version: '1.0.0',
    status: AgentRegistryStatus.ONLINE,
    load: 0,
    capabilities: [{ id: 'dashboard' }, { id: 'email' }, { id: 'slack' }],
    childIds: [],
    maxConcurrentTasks: 3,
    activeTaskCount: 0,
    tags: ['production', 'publishing'],
    registeredAt: Date.now(),
    lastHeartbeatAt: Date.now(),
  },
];

for (const meta of agentMetas) {
  registry.register(meta);
}

// ============================================================
// 4. 注册任务处理器
// ============================================================
fetcher.registerTaskHandler('fetch', async (input, ctx) => {
  const { source } = input as { source: string };
  // 模拟数据获取
  const data = [
    { product: 'Widget A', sales: 15000, region: 'East' },
    { product: 'Widget B', sales: 22000, region: 'West' },
    { product: 'Widget C', sales: 18000, region: 'East' },
  ];
  return { data, rowCount: data.length, source };
});

cleaner.registerTaskHandler('clean', async (input, ctx) => {
  const { data } = input as { data: Record<string, unknown>[] };
  const cleaned = data.filter(row => Object.values(row).every(v => v != null));
  return { cleaned, removedRows: data.length - cleaned.length };
});

cleaner.registerTaskHandler('validate', async (input, ctx) => {
  const { data } = input as { data: unknown[] };
  return {
    valid: Array.isArray(data) && data.length > 0,
    rowCount: Array.isArray(data) ? data.length : 0,
  };
});

reporter.registerTaskHandler('generate-report', async (input, ctx) => {
  const { data, format } = input as { data: unknown; format: string };
  return {
    format,
    url: `https://reports.example.com/${ctx.taskId}.${format}`,
    generatedAt: new Date().toISOString(),
    rowCount: Array.isArray(data) ? (data as unknown[]).length : 0,
  };
});

publisher.registerTaskHandler('publish', async (input, ctx) => {
  const { reportUrl, targets } = input as { reportUrl: string; targets: string[] };
  const results = targets.map(target => ({
    target,
    status: 'published' as const,
    url: `${target}://${reportUrl}`,
  }));
  return { results, publishedAt: new Date().toISOString() };
});

// ============================================================
// 5. 定义编排任务
// ============================================================
const decomposedTasks: DecomposedTask[] = [
  {
    subTaskId: 'fetch',
    taskName: 'Fetch Sales Data',
    payload: { source: 'https://api.example.com/sales-q1' },
    dependsOn: [],
    requiredCapability: 'http',
  },
  {
    subTaskId: 'clean',
    taskName: 'Clean Data',
    payload: { data: '${fetch.output.data}' },
    dependsOn: ['fetch'],
    requiredCapability: 'data-cleaning',
  },
  {
    subTaskId: 'validate',
    taskName: 'Validate Data',
    payload: { data: '${clean.output.cleaned}' },
    dependsOn: ['clean'],
    requiredCapability: 'validation',
  },
  // 并行生成多格式报告
  {
    subTaskId: 'report-csv',
    taskName: 'CSV Report',
    payload: { data: '${validate.output}', format: 'csv' },
    dependsOn: ['validate'],
    requiredCapability: 'csv',
  },
  {
    subTaskId: 'report-json',
    taskName: 'JSON Report',
    payload: { data: '${validate.output}', format: 'json' },
    dependsOn: ['validate'],
    requiredCapability: 'json',
  },
  {
    subTaskId: 'report-pdf',
    taskName: 'PDF Report',
    payload: { data: '${validate.output}', format: 'pdf' },
    dependsOn: ['validate'],
    requiredCapability: 'pdf',
  },
  // 发布（依赖所有报告完成）
  {
    subTaskId: 'publish',
    taskName: 'Publish to Dashboard',
    payload: {
      reportUrl: '${report-csv.output.url}',
      targets: ['dashboard', 'email'],
    },
    dependsOn: ['report-csv', 'report-json', 'report-pdf'],
    requiredCapability: 'dashboard',
  },
];

// ============================================================
// 6. 设置事件监听
// ============================================================
orchestration.on('orchestration:start', ({ requestId }) => {
  console.log(`\n🚀 Orchestration started: ${requestId}`);
});

orchestration.on('orchestration:step-start', ({ stepId }) => {
  console.log(`  ▶ Step started: ${stepId}`);
});

orchestration.on('orchestration:step-complete', ({ stepId, result }) => {
  const icon = result.success ? '✓' : '✗';
  console.log(
    `  ${icon} Step completed: ${stepId} (${result.duration}ms, agent: ${result.agentId})`
  );
});

orchestration.on('orchestration:step-failed', ({ stepId, error }) => {
  console.error(`  ✗ Step failed: ${stepId} — ${error}`);
});

orchestration.on('orchestration:complete', ({ result }) => {
  console.log(`\n✅ Orchestration completed in ${result.duration}ms`);
  console.log(`   Steps: ${result.stepResults?.length}, Success: ${result.success}`);
});

// ============================================================
// 7. 执行编排
// ============================================================
async function runPipeline(): Promise<OrchestrationResult> {
  const result = await orchestration.orchestrate({
    requestId: `pipeline-${Date.now()}`,
    taskName: 'sales-analysis-pipeline',
    payload: { subTasks: decomposedTasks },
    strategy: OrchestrationStrategy.AUTO,
    timeout: 120000,
    retryConfig: {
      maxAttempts: 3,
      baseDelay: 500,
      maxDelay: 10000,
      backoffFactor: 2,
    },
  });

  if (result.success) {
    console.log('\n📊 Pipeline Results:');
    const aggregated = result.data as Record<string, unknown>;
    console.log(`   Total steps: ${aggregated.totalCount}`);
    console.log(`   Successful: ${aggregated.successCount}`);
    console.log(`   Failed: ${aggregated.failedCount}`);

    console.log('\n📋 Step Details:');
    for (const step of result.stepResults ?? []) {
      console.log(
        `   [${step.agentId}] ${step.success ? '✓' : '✗'} (${step.attempts} attempts, ${step.duration}ms)`
      );
    }
  } else {
    console.error(`\n❌ Pipeline failed: ${result.error}`);
  }

  return result;
}

// 执行
runPipeline().then(() => {
  // 清理
  orchestration.dispose();
  registry.dispose();
});
```

### 执行流程可视化

```
🚀 Orchestration started: pipeline-xxx

  ▶ Step started: step_0 (fetch)
  ✓ Step completed: step_0 (45ms, agent: fetcher-01)

  ▶ Step started: step_1 (clean)
  ✓ Step completed: step_1 (32ms, agent: cleaner-01)

  ▶ Step started: step_2 (validate)
  ✓ Step completed: step_2 (18ms, agent: cleaner-01)

  ▶ Step started: step_3 (report-csv)    ┐
  ▶ Step started: step_4 (report-json)   │ 并行执行
  ▶ Step started: step_5 (report-pdf)    ┘
  ✓ Step completed: step_3 (55ms, agent: reporter-01)
  ✓ Step completed: step_4 (48ms, agent: reporter-01)
  ✓ Step completed: step_5 (72ms, agent: reporter-01)

  ▶ Step started: step_6 (publish)
  ✓ Step completed: step_6 (35ms, agent: publisher-01)

✅ Orchestration completed in 305ms
   Steps: 7, Success: true
```

---

## 13. 配置参考

### 13.1 AgentConfig

| 配置项                 | 类型            | 默认值              | 说明                  |
| ---------------------- | --------------- | ------------------- | --------------------- |
| `id`                   | `string`        | `agent_<timestamp>` | Agent 唯一标识        |
| `name`                 | `string`        | `'Agent'`           | Agent 名称            |
| `version`              | `string`        | `'0.1.0'`           | 版本号                |
| `type`                 | `AgentType`     | `EXECUTOR`          | Agent 类型            |
| `priority`             | `AgentPriority` | `NORMAL`            | 优先级                |
| `maxDepth`             | `number`        | `3`                 | 子 Agent 最大嵌套深度 |
| `maxParallelTasks`     | `number`        | `10`                | 最大并行任务数        |
| `communicationTimeout` | `number`        | `5000`              | 通信超时（ms）        |
| `heartbeatInterval`    | `number`        | `30`                | 心跳间隔（秒）        |
| `capabilities`         | `string[]`      | `[]`                | 能力列表              |
| `parentId`             | `string`        | `undefined`         | 父 Agent ID           |

### 13.2 OrchestrationLayerConfig

| 配置项                        | 类型                    | 默认值  | 说明               |
| ----------------------------- | ----------------------- | ------- | ------------------ |
| `defaultTimeout`              | `number`                | `60000` | 默认编排超时（ms） |
| `maxConcurrentOrchestrations` | `number`                | `10`    | 最大并发编排数     |
| `autoDecompose`               | `boolean`               | `false` | 启用自动任务分解   |
| `defaultStrategy`             | `OrchestrationStrategy` | `AUTO`  | 默认执行策略       |

### 13.3 RetryConfig

| 配置项          | 类型     | 默认值 | 说明           |
| --------------- | -------- | ------ | -------------- |
| `maxAttempts`   | `number` | `3`    | 最大重试次数   |
| `baseDelay`     | `number` | `100`  | 基础延迟（ms） |
| `maxDelay`      | `number` | `5000` | 最大延迟（ms） |
| `backoffFactor` | `number` | `2`    | 指数退避因子   |

### 13.4 AgentRegistryConfig

| 配置项                | 类型      | 默认值      | 说明               |
| --------------------- | --------- | ----------- | ------------------ |
| `name`                | `string`  | `'default'` | 注册中心名称       |
| `heartbeatTimeout`    | `number`  | `30000`     | 心跳超时（ms）     |
| `leaseDuration`       | `number`  | `60000`     | 租约时长（ms）     |
| `enableAutoCleanup`   | `boolean` | `true`      | 启用自动清理       |
| `cleanupInterval`     | `number`  | `60000`     | 清理间隔（ms）     |
| `enableHealthCheck`   | `boolean` | `true`      | 启用健康检查       |
| `healthCheckInterval` | `number`  | `10000`     | 健康检查间隔（ms） |

### 13.5 OrchestrationStrategy 枚举

| 值           | 说明                                          |
| ------------ | --------------------------------------------- |
| `PARALLEL`   | 所有步骤并行执行，适用于无依赖的独立任务      |
| `SEQUENTIAL` | 按顺序执行，前一步结果自动注入下一步          |
| `AUTO`       | 根据依赖关系自动决定并行/串行，依赖满足则执行 |

### 13.6 OrchestrationPlanStatus 枚举

| 值          | 说明                 |
| ----------- | -------------------- |
| `PENDING`   | 计划已创建，等待执行 |
| `RUNNING`   | 计划正在执行中       |
| `PAUSED`    | 计划已暂停           |
| `COMPLETED` | 计划执行完毕         |
| `FAILED`    | 计划执行失败         |
| `CANCELLED` | 计划已取消           |

### 13.7 AgentType 枚举

| 值             | 说明                           |
| -------------- | ------------------------------ |
| `ORCHESTRATOR` | 编排 Agent，负责任务分解和调度 |
| `EXECUTOR`     | 执行 Agent，执行具体任务       |
| `PLANNER`      | 规划 Agent，创建执行计划       |
| `MONITOR`      | 监控 Agent，观察系统状态       |
| `CUSTOM`       | 自定义类型                     |

### 13.8 AgentRegistryStatus 枚举

| 值            | 说明       |
| ------------- | ---------- |
| `ONLINE`      | 在线且就绪 |
| `BUSY`        | 忙碌中     |
| `UNAVAILABLE` | 暂时不可用 |
| `OFFLINE`     | 离线       |

---

## 14. 最佳实践

### 14.1 何时使用 Sub-agents

```
✅ 适用场景：
  - 任务可分解为独立的子任务，子任务之间有明确的依赖关系
  - 需要并行处理以提高吞吐量
  - 需要不同能力的 Agent 协作完成复杂任务
  - 需要容错和重试机制
  - 需要追踪任务执行树和深度

❌ 不适用场景：
  - 简单的单步任务（直接用 Agent.execute() 即可）
  - 子任务之间有强数据耦合，无法独立执行
  - 对延迟极度敏感，编排开销不可接受
```

### 14.2 深度限制

```typescript
// ✅ 控制嵌套深度
const parentAgent = new Agent({
  kernel,
  config: {
    maxDepth: 3, // 最多 3 层嵌套：Parent → Child → Grandchild
    // 超过 maxDepth 时应拒绝创建更深层的子 Agent
  },
});

// ✅ 在 handler 中检查深度
agent.registerTaskHandler('deep-task', async (input, context) => {
  if (context.depth >= agent.getConfig().maxDepth) {
    throw new Error(`Maximum depth reached: ${context.depth}`);
  }
  // 执行任务...
});
```

### 14.3 并发调优

```typescript
// ✅ 根据任务类型设置并发限制
// CPU 密集型：限制并发
const cpuAgent = new Agent({
  kernel,
  config: {
    maxParallelTasks: 2,
    capabilities: ['image-processing', 'video-encoding'],
  },
});

// IO 密集型：高并发
const ioAgent = new Agent({
  kernel,
  config: {
    maxParallelTasks: 20,
    capabilities: ['http', 'file', 'database'],
  },
});

// ✅ 编排层全局并发限制
const orchestration = new OrchestrationLayer(registry, undefined, {
  maxConcurrentOrchestrations: 5, // 防止编排风暴
});
```

### 14.4 重试策略

```typescript
// ✅ 为不同任务设置不同的重试策略
// 快速失败的任务 — 少重试
const fastFailConfig: RetryConfig = {
  maxAttempts: 1,
};

// 网络不稳定 — 多重重试 + 长退避
const networkConfig: RetryConfig = {
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
};

// ✅ 幂等任务才适合重试
// 非幂等任务应设置 maxAttempts: 1 或使用补偿机制
```

### 14.5 注册中心维护

```typescript
// ✅ 定期心跳
setInterval(() => {
  registry.heartbeat('worker-001', {
    load: agent.getState().load,
    activeTaskCount: agent.getState().activeTaskCount,
  });
}, 10000);

// ✅ 监听 Agent 离线
registry.on('agent:heartbeat-timeout', ({ agentId }) => {
  // 触发告警或故障转移
  alerting.send(`Agent ${agentId} heartbeat timeout!`);
});

// ✅ 优雅注销
async function shutdown() {
  registry.unregister('worker-001');
  // 等待正在执行的任务完成...
  await agent.shutdown();
  registry.dispose();
}
```

### 14.6 事件驱动监控

```typescript
// ✅ 全面的编排监控
orchestration.on('orchestration:start', ({ requestId }) => {
  metrics.increment('orchestration.started');
  logger.info('Orchestration started', { requestId });
});

orchestration.on('orchestration:complete', ({ requestId, result }) => {
  metrics.timing('orchestration.duration', result.duration);
  metrics.increment(result.success ? 'orchestration.completed' : 'orchestration.failed');
  logger.info('Orchestration completed', {
    requestId,
    success: result.success,
    duration: result.duration,
    stepCount: result.stepResults?.length,
  });
});

orchestration.on('orchestration:step-failed', ({ requestId, stepId, error }) => {
  metrics.increment('orchestration.step_failed');
  logger.error('Step failed', { requestId, stepId, error });
});
```

### 14.7 资源清理

```typescript
// ✅ 始终在进程退出时清理资源
async function gracefulShutdown() {
  console.log('Shutting down...');

  // 1. 取消所有活跃编排
  orchestration.cancelAll();

  // 2. 停止注册中心
  registry.stop();

  // 3. 关闭所有 Agent（会自动关闭子 Agent）
  const allAgents = [fetcher, cleaner, reporter, publisher];
  await Promise.all(allAgents.map(a => a.shutdown()));

  // 4. 销毁编排层和注册中心
  orchestration.dispose();
  registry.dispose();

  console.log('Shutdown complete');
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

---

## 附录 A：事件总线速查

| 事件名                        | 来源                               | 参数                                    |
| ----------------------------- | ---------------------------------- | --------------------------------------- |
| `orchestration:start`         | OrchestrationLayer                 | `{ requestId }`                         |
| `orchestration:step-start`    | OrchestrationLayer                 | `{ requestId, stepId }`                 |
| `orchestration:step-complete` | OrchestrationLayer                 | `{ requestId, stepId, result }`         |
| `orchestration:step-failed`   | OrchestrationLayer                 | `{ requestId, stepId, error }`          |
| `orchestration:complete`      | OrchestrationLayer                 | `{ requestId, result }`                 |
| `orchestration:failed`        | OrchestrationLayer                 | `{ requestId, error }`                  |
| `orchestration:paused`        | OrchestrationLayer                 | `{ planId }`                            |
| `orchestration:resumed`       | OrchestrationLayer                 | `{ planId }`                            |
| `agent:registered`            | OrchestrationLayer / AgentRegistry | `{ agentId }` / `{ agentId, metadata }` |
| `agent:unregistered`          | OrchestrationLayer / AgentRegistry | `{ agentId }`                           |
| `agent:updated`               | AgentRegistry                      | `{ agentId, metadata }`                 |
| `agent:heartbeat`             | AgentRegistry                      | `{ agentId, timestamp }`                |
| `agent:health-check`          | AgentRegistry                      | `{ agentId, result }`                   |
| `cleanup:completed`           | AgentRegistry                      | `{ removed }`                           |
| `task:start`                  | Agent                              | `{ taskId, timestamp }`                 |
| `task:complete`               | Agent                              | `{ taskId, result, timestamp }`         |
| `task:error`                  | Agent                              | `{ taskId, error, timestamp }`          |
| `child:register`              | Agent                              | `{ childId, timestamp }`                |
| `child:unregister`            | Agent                              | `{ childId, timestamp }`                |
| `status:change`               | Agent                              | `{ oldStatus, newStatus, timestamp }`   |
| `heartbeat`                   | Agent                              | `{ timestamp, load }`                   |

---

## 附录 B：类型速查

```typescript
// 核心 Agent
(Agent,
  AgentResult<T>,
  AgentTaskInput,
  AgentTaskHandler<T, R>,
  AgentExecutionContext,
  AgentEvents,
  AgentConfig,
  AgentConfigOptions,
  AgentType,
  AgentPriority,
  AgentState,
  AgentStateOptions,
  AgentStats,
  AgentStatus,
  createAgentConfig,
  createAgentState,
  getAgentStats);

// 编排层
(OrchestrationLayer,
  OrchestrationLayerConfig,
  OrchestrationRequest,
  OrchestrationResult<T>,
  OrchestrationLayerPlan,
  OrchestrationStrategy,
  OrchestrationPlanStatus,
  DecomposedTask,
  AgentSelectionStrategy,
  OrchestrationLayerEvents,
  createOrchestrationLayer);

// 执行协调器
(ExecutionCoordinator,
  ExecutionRequest,
  ExecutionResult<T>,
  ExecutionPlan,
  ExecutionStep,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  CoordinatorEvents);

// 注册中心
(AgentRegistry,
  AgentRegistryConfig,
  AgentRegistryStatus,
  AgentMetadata,
  AgentType,
  AgentCapability,
  AgentSelector,
  RegistryEntry,
  RegistryStats,
  HealthCheckResult,
  RegistryEvents,
  createRegistry,
  createAgentMetadata,
  isAgentHealthy,
  canAgentAcceptTasks,
  compareByLoad);

// 默认配置
(DEFAULT_AGENT_CONFIG, DEFAULT_ORCHESTRATION_CONFIG, DEFAULT_RETRY_CONFIG, DEFAULT_REGISTRY_CONFIG);
```
