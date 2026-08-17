# Agent SDK 使用指南

## 基本信息

**文档编号**: DOC-015
**所属模块**: 核心 SDK（@organic/agent）
**优先级**: P1
**创建日期**: 2026-07-03
**对应需求**: Agent SDK 开发与集成

---

## 1. 概述与定位

`@organic/agent` 是 Organic-Interface 平台的 Agent SDK 核心包，提供从单 Agent 创建到多 Agent 协同编排的完整能力。该 SDK 封装了以下核心领域：

| 领域           | 说明                                        |
| -------------- | ------------------------------------------- |
| **核心 Agent** | Agent 生命周期管理、任务执行、事件系统      |
| **任务调度**   | 优先级队列、并发控制、跨 Agent 调度         |
| **上下文管理** | 对话上下文、上下文窗口、执行帧传播          |
| **工作流引擎** | DAG 工作流定义与执行（串行/并行/条件/循环） |
| **编排层**     | 任务分解、Agent 选择、执行计划              |
| **Agent 通信** | 双向通道、结构化消息、发布订阅              |
| **Agent 注册** | 注册中心、服务发现、元数据管理              |

```
npm install @organic/agent
```

---

## 2. 快速开始

### 2.1 创建并运行最简 Agent

```typescript
import { Agent, createAgentConfig } from '@organic/agent';

// 创建 Agent 配置
const config = createAgentConfig({
  name: 'greeting-agent',
  type: 'assistant',
  description: 'A simple greeting agent',
});

// 实例化 Agent
const agent = new Agent(config);

// 注册任务处理器
agent.registerHandler('greet', async (input, context) => {
  const { name } = input.payload;
  return { greeting: `Hello, ${name}!`, at: new Date().toISOString() };
});

// 执行任务
const result = await agent.execute({
  taskId: 'task-001',
  payload: { name: 'World' },
});

console.log(result.data);
// { greeting: 'Hello, World!', at: '2026-07-03T...' }
```

### 2.2 监听 Agent 事件

```typescript
agent.on('task:started', task => {
  console.log(`[$] Task started: ${task.taskId}`);
});

agent.on('task:completed', (task, result) => {
  console.log(`[OK] Task completed: ${task.taskId} in ${result.executionTime}ms`);
});

agent.on('task:failed', (task, error) => {
  console.error(`[!!] Task failed: ${task.taskId}`, error);
});

agent.on('state:changed', (prevState, nextState) => {
  console.log(`State: ${prevState.status} -> ${nextState.status}`);
});

agent.on('error', error => {
  console.error('Agent error:', error);
});
```

---

## 3. Agent 配置

### 3.1 AgentConfig 完整配置

```typescript
import { AgentConfig, AgentType, AgentPriority, createAgentConfig } from '@organic/agent';

const config: AgentConfig = createAgentConfig({
  // 基本身份
  name: 'data-processor',
  type: 'worker' as AgentType,
  description: 'Processes and transforms data pipelines',

  // 优先级（影响调度顺序）
  priority: 'high' as AgentPriority,

  // 并发限制
  maxConcurrency: 5,
  maxQueueSize: 100,

  // 超时控制
  defaultTimeout: 30_000, // 默认任务超时 30s
  taskTimeout: 60_000, // 全局任务超时 60s

  // 重试策略
  maxRetries: 3,
  retryDelay: 1_000, // 重试间隔 1s
  retryBackoff: 'exponential', // 指数退避

  // 上下文配置
  contextWindowSize: 50, // 上下文窗口大小
  contextRetention: 'sliding', // 滑动窗口策略

  // 资源限制
  maxMemoryMB: 512,
  cpuLimit: 2,

  // 自定义元数据
  metadata: {
    version: '1.0.0',
    team: 'data-engineering',
    capabilities: ['csv', 'json', 'xml', 'parquet'],
  },
});
```

### 3.2 AgentType 枚举

```typescript
type AgentType =
  | 'assistant' // 对话助手，处理自然语言交互
  | 'worker' // 工作节点，执行具体任务
  | 'orchestrator' // 编排器，负责任务分解与调度
  | 'router' // 路由器，根据条件分发任务
  | 'observer' // 观察者，监控和报告
  | 'custom'; // 自定义类型
```

### 3.3 AgentPriority 枚举

```typescript
type AgentPriority =
  | 'critical' // 最高优先级，立即执行
  | 'high' // 高优先级，优先调度
  | 'normal' // 默认优先级
  | 'low' // 低优先级，空闲时执行
  | 'background'; // 后台优先级，资源充裕时执行
```

### 3.4 DEFAULT_AGENT_CONFIG

```typescript
import { DEFAULT_AGENT_CONFIG } from '@organic/agent';

// 默认配置值
const defaults = {
  type: 'worker',
  priority: 'normal',
  maxConcurrency: 1,
  maxQueueSize: 1000,
  defaultTimeout: 30_000,
  maxRetries: 0,
  retryDelay: 1_000,
  retryBackoff: 'linear',
  contextWindowSize: 100,
  contextRetention: 'sliding',
};
```

### 3.5 Agent 状态管理

```typescript
import { createAgentState, getAgentStats, AgentState, AgentStatus } from '@organic/agent';

// 创建初始状态
const state: AgentState = createAgentState({
  status: 'idle' as AgentStatus,
});

// AgentStatus 枚举
// 'idle'       - 空闲，等待任务
// 'busy'       - 忙碌，正在执行任务
// 'paused'     - 暂停，不接受新任务
// 'draining'   - 排空中，完成当前任务后关闭
// 'stopped'    - 已停止
// 'error'      - 错误状态

// 获取统计信息
const stats = getAgentStats(agent);
console.log(stats);
// {
//   totalTasks: 150,
//   completedTasks: 142,
//   failedTasks: 3,
//   runningTasks: 2,
//   queuedTasks: 3,
//   avgExecutionTime: 245.6,
//   uptime: 3600000,
//   lastActiveAt: '2026-07-03T10:30:00Z',
// }
```

---

## 4. 任务执行

### 4.1 AgentTaskInput — 任务输入

```typescript
import { AgentTaskInput } from '@organic/agent';

const task: AgentTaskInput = {
  // 必填
  taskId: 'task-001', // 唯一任务标识
  payload: {
    // 任务载荷（任意类型）
    action: 'transform',
    source: 'data.csv',
    target: 'data.json',
  },

  // 可选
  priority: 'high', // 任务优先级（覆盖 Agent 默认值）
  parentTaskId: 'parent-001', // 父任务 ID（用于任务树追踪）
  dependencies: [
    // 依赖任务列表（需先完成）
    'task-preq-001',
    'task-preq-002',
  ],
  timeout: 15_000, // 任务级超时（覆盖 Agent 默认值）
  metadata: {
    // 自定义元数据
    source: 'api',
    userId: 'user-42',
    traceId: 'trace-abc-123',
  },
};
```

### 4.2 AgentTaskHandler — 任务处理器

```typescript
import { AgentTaskHandler, AgentExecutionContext } from '@organic/agent';

// 带类型约束的处理器
interface TransformInput {
  action: string;
  source: string;
  target: string;
}

interface TransformOutput {
  rows: number;
  duration: number;
  errors: string[];
}

const handler: AgentTaskHandler<AgentTaskInput, TransformOutput> = async (input, context) => {
  // 使用上下文
  console.log(`Agent: ${context.agent.name}`);
  console.log(`Task ID: ${context.taskId}`);
  console.log(`Depth: ${context.depth}`);

  // 检查取消信号
  if (context.cancelled) {
    throw new Error('Task cancelled');
  }

  // 访问 AbortSignal
  context.signal?.addEventListener('abort', () => {
    console.log('Abort signal received');
  });

  // 访问父上下文
  if (context.parentContext) {
    console.log(`Parent task: ${context.parentContext.taskId}`);
  }

  // 执行业务逻辑
  const startTime = Date.now();
  const rows = await processData(input.payload.source);
  const duration = Date.now() - startTime;

  return { rows, duration, errors: [] };
};

agent.registerHandler('transform', handler);
```

### 4.3 AgentExecutionContext 详解

```typescript
interface AgentExecutionContext {
  agent: Agent; // 当前 Agent 实例
  taskId: string; // 当前任务 ID
  parentContext?: AgentExecutionContext; // 父任务上下文
  depth: number; // 任务嵌套深度
  startTime: number; // 任务开始时间戳
  cancelled: boolean; // 是否已取消
  signal?: AbortSignal; // 取消信号
  metadata: Record<string, unknown>; // 上下文元数据
}
```

### 4.4 AgentResult — 执行结果

```typescript
import { AgentResult } from '@organic/agent';

// 成功结果
const successResult: AgentResult<TransformOutput> = {
  success: true,
  data: {
    rows: 1500,
    duration: 234,
    errors: [],
  },
  executionTime: 234,
  metadata: {
    agentId: 'agent-001',
    nodeVersion: 'v20.11.0',
  },
};

// 失败结果
const failureResult: AgentResult<never> = {
  success: false,
  error: 'File not found: data.csv',
  executionTime: 12,
  metadata: {
    retryCount: 3,
    lastError: 'ENOENT',
  },
};
```

### 4.5 带重试的任务执行

```typescript
const result = await agent.execute({
  taskId: 'resilient-task',
  payload: { url: 'https://api.example.com/data' },
  timeout: 10_000,
});

if (!result.success) {
  console.error(`Task failed after ${result.executionTime}ms: ${result.error}`);
  // 根据 metadata 中的 retryCount 判断是否需要人工介入
  const retryCount = result.metadata?.retryCount as number;
  if (retryCount >= 3) {
    await notifyOpsTeam(result.error);
  }
}
```

---

## 5. 任务调度

### 5.1 TaskQueue — 优先级队列

```typescript
import { TaskQueue, TaskPriority, TaskStatus, Task } from '@organic/agent';

// 创建优先级队列
const queue = new TaskQueue({
  concurrency: 3, // 最大并发数
  maxSize: 500, // 队列最大容量
  defaultPriority: 'normal',
  strategy: 'priority-first', // 优先级优先
});

// 提交任务
const task: Task = {
  id: 'task-001',
  priority: 'high' as TaskPriority,
  status: 'pending' as TaskStatus,
  payload: { action: 'process' },
  createdAt: Date.now(),
};

await queue.enqueue(task);

// 队列状态
console.log(queue.size); // 当前队列长度
console.log(queue.running); // 正在执行的任务数
console.log(queue.isFull); // 是否已满

// 批量入队
await queue.enqueueBatch([task1, task2, task3]);

// 取消任务
await queue.cancel('task-001');

// 清空队列
await queue.clear();

// 事件监听
queue.on('task:dequeued', task => console.log(`Dequeued: ${task.id}`));
queue.on('queue:full', () => console.warn('Queue is full!'));
queue.on('queue:drained', () => console.log('All tasks completed'));
```

### 5.2 TaskScheduler — 跨 Agent 调度器

```typescript
import { TaskScheduler } from '@organic/agent';

const scheduler = new TaskScheduler({
  maxConcurrency: 10,
  schedulingStrategy: 'priority', // 'priority' | 'round-robin' | 'least-loaded'
  defaultTimeout: 30_000,
});

// 注册 Agent
scheduler.registerAgent(agent1);
scheduler.registerAgent(agent2);
scheduler.registerAgent(agent3);

// 调度任务
const result = await scheduler.schedule({
  taskId: 'scheduled-task',
  payload: { action: 'analyze', dataset: 'sales-q1' },
  priority: 'high',
  // 可选：指定目标 Agent
  targetAgent: 'agent1',
  // 或让调度器自动选择
  // targetAgent: undefined,
});

// 获取调度状态
console.log(scheduler.queueLength);
console.log(scheduler.activeTasks);
console.log(scheduler.agentLoads);
// { agent1: 3, agent2: 1, agent3: 0 }

// 暂停 / 恢复调度
scheduler.pause();
scheduler.resume();

// 关闭调度器
await scheduler.shutdown();
```

### 5.3 TaskPriority 与调度策略

```typescript
type TaskPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

// 调度器按优先级排序，同优先级按 FIFO 顺序
// critical > high > normal > low > background

// 饥饿防护：低优先级任务最大等待时间
const scheduler = new TaskScheduler({
  maxStarvationTime: 60_000, // 60s 后强制提升低优先级任务
  maxConcurrency: 5,
});
```

### 5.4 并发控制模式

```typescript
// 场景 1：限制全局并发
const globalQueue = new TaskQueue({ concurrency: 5 });

// 场景 2：按 Agent 类型限制并发
const workerQueue = new TaskQueue({ concurrency: 3 });
const ioQueue = new TaskQueue({ concurrency: 10 });

// 场景 3：信号量模式
const semaphore = new TaskQueue({ concurrency: 1 });

// 场景 4：批量处理
const batchQueue = new TaskQueue({
  concurrency: 2,
  batchSize: 10,
  batchTimeout: 5_000,
});
```

---

## 6. 上下文管理

### 6.1 Message — 消息模型

```typescript
import {
  Message,
  MessageSender,
  MessageContent,
  MessageType,
  MessageStatus,
  MessageFlag,
  ContentFormat,
  AttachmentType,
  Attachment,
  ToolCall,
  ToolResponse,
} from '@organic/agent';

// 创建消息
const message: Message = {
  id: 'msg-001',
  conversationId: 'conv-001',

  // 发送者
  sender: {
    type: 'user' as MessageSender,
    id: 'user-42',
    name: 'Alice',
  },

  // 消息内容
  content: {
    format: 'markdown' as ContentFormat,
    text: '请帮我分析 `sales-q1.csv` 并生成报告。',
  },

  // 附件
  attachments: [
    {
      type: 'file' as AttachmentType,
      name: 'sales-q1.csv',
      mimeType: 'text/csv',
      url: 'file://data/sales-q1.csv',
      size: 204800,
    },
  ],

  // 消息类型
  type: 'user_message' as MessageType,

  // 状态
  status: 'sent' as MessageStatus,

  // 标记
  flags: ['pinned' as MessageFlag],

  // 时间戳
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// 工具调用消息
const toolCallMessage: Message = {
  id: 'msg-002',
  conversationId: 'conv-001',
  sender: { type: 'agent', id: 'agent-001', name: 'DataAgent' },
  content: { format: 'json', text: '' },
  type: 'tool_call' as MessageType,
  toolCalls: [
    {
      id: 'tc-001',
      name: 'read_csv',
      arguments: { file: 'sales-q1.csv' },
    },
  ],
  status: 'pending' as MessageStatus,
  createdAt: Date.now(),
};

// 工具响应消息
const toolResponseMessage: Message = {
  id: 'msg-003',
  conversationId: 'conv-001',
  sender: { type: 'system', id: 'system', name: 'System' },
  content: { format: 'json', text: '{"rows": 1500, "columns": 12}' },
  type: 'tool_response' as MessageType,
  toolResponses: [
    {
      toolCallId: 'tc-001',
      result: { rows: 1500, columns: 12 },
      success: true,
    },
  ],
  status: 'completed' as MessageStatus,
  createdAt: Date.now(),
};
```

### 6.2 ContextManager — 对话上下文管理

```typescript
import { ContextManager } from '@organic/agent';

const contextManager = new ContextManager({
  maxConversations: 100,
  defaultTTL: 3_600_000, // 1 小时
});

// 创建会话
const conversation = await contextManager.createConversation({
  id: 'conv-001',
  title: 'Q1 Sales Analysis',
  participants: [
    { type: 'user', id: 'user-42', name: 'Alice' },
    { type: 'agent', id: 'agent-001', name: 'DataAgent' },
  ],
  metadata: {
    project: 'sales-analytics',
    priority: 'high',
  },
});

// 添加消息
await contextManager.addMessage('conv-001', message);

// 获取消息历史
const history = await contextManager.getMessages('conv-001', {
  limit: 50,
  before: 'msg-100',
  types: ['user_message', 'agent_message'],
});

// 搜索消息
const results = await contextManager.searchMessages('conv-001', {
  query: 'sales report',
  sender: 'user',
  timeRange: { start: Date.now() - 86400000, end: Date.now() },
});

// 管理参与者
await contextManager.addParticipant('conv-001', {
  type: 'agent',
  id: 'agent-002',
  name: 'ReportAgent',
});
await contextManager.removeParticipant('conv-001', 'agent-002');

// 获取参与者列表
const participants = await contextManager.getParticipants('conv-001');

// 关闭会话
await contextManager.closeConversation('conv-001');
```

### 6.3 ContextItem — 上下文项

```typescript
import {
  ContextItem,
  ContextItemType,
  ContextItemPriority,
  ContextItemFilter,
} from '@organic/agent';

// 创建上下文项
const item: ContextItem = {
  id: 'ctx-001',
  type: 'file_content' as ContextItemType,
  priority: 'high' as ContextItemPriority,
  content: '--- CSV 文件内容 ---',
  metadata: {
    fileName: 'sales-q1.csv',
    size: 204800,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
  },
};

// 添加到上下文
await contextManager.addContextItem('conv-001', item);

// 获取上下文项
const items = await contextManager.getContextItems('conv-001', {
  types: ['file_content', 'tool_result'],
  priority: 'high',
  limit: 20,
} as ContextItemFilter);

// 更新上下文项
await contextManager.updateContextItem('conv-001', 'ctx-001', {
  priority: 'normal',
  metadata: { accessedAt: Date.now() },
});

// 删除上下文项
await contextManager.removeContextItem('conv-001', 'ctx-001');
```

### 6.4 ContextWindowManager — 上下文窗口

```typescript
import { ContextWindowManager } from '@organic/agent';

const windowManager = new ContextWindowManager({
  maxTokens: 8_000, // 最大 token 数
  maxMessages: 50, // 最大消息数
  retentionPolicy: 'sliding', // 'sliding' | 'fifo' | 'priority'
  preserveSystemMessages: true,
  preservePinnedMessages: true,
  summarizationThreshold: 0.8, // 达 80% 时触发摘要
});

// 关联到会话
windowManager.attachToConversation('conv-001');

// 检查窗口状态
const windowState = windowManager.getWindowState('conv-001');
console.log(windowState);
// {
//   currentTokens: 3200,
//   maxTokens: 8000,
//   currentMessages: 15,
//   maxMessages: 50,
//   utilization: 0.4,
// }

// 设置保留策略
windowManager.setRetentionPolicy('conv-001', {
  preserveLastN: 10, // 保留最后 N 条消息
  preserveByPriority: true, // 按优先级保留
  summarizationPrompt: 'Summarize the key points of the conversation above.',
});

// 手动触发窗口裁剪
await windowManager.trim('conv-001');

// 事件监听
windowManager.on('window:trimmed', (convId, removedCount) => {
  console.log(`Window trimmed for ${convId}: ${removedCount} messages removed`);
});

windowManager.on('window:overflow', (convId, state) => {
  console.warn(`Window overflow for ${convId}: ${state.utilization}`);
});
```

### 6.5 ContextService — 上下文传播与执行帧

```typescript
import { ContextService } from '@organic/agent';

const contextService = new ContextService();

// 创建执行帧
const frame = contextService.createExecutionFrame({
  agentId: 'agent-001',
  taskId: 'task-001',
  parentFrameId: null,
});

// 进入执行帧
contextService.enterFrame(frame);

// 在当前帧中存储数据
contextService.set('currentFile', 'sales-q1.csv');
contextService.set('processedRows', 1500);

// 读取数据（沿帧链向上查找）
const file = contextService.get('currentFile'); // 'sales-q1.csv'

// 传播上下文到子任务
const childFrame = contextService.createExecutionFrame({
  agentId: 'agent-002',
  taskId: 'task-002',
  parentFrameId: frame.id,
  inheritContext: true, // 继承父帧上下文
  inheritKeys: ['currentFile'], // 仅继承指定键
});

// 退出执行帧
contextService.exitFrame();

// 获取当前帧栈深度
console.log(contextService.depth); // 1

// 获取完整帧链
const frameChain = contextService.getFrameChain();
```

---

## 7. 工作流引擎

### 7.1 工作流定义（DAG 模型）

```typescript
import {
  Workflow,
  WorkflowTask,
  WorkflowEdge,
  WorkflowConfig,
  WorkflowVariable,
  TaskConfig,
  RetryPolicy,
  TaskTimeout,
  ConditionExpression,
  LoopConfig,
  ParallelConfig,
} from '@organic/agent';

// 定义工作流任务节点
const tasks: WorkflowTask[] = [
  {
    id: 'fetch-data',
    name: 'Fetch Data',
    config: {
      agentType: 'worker',
      handler: 'fetchData',
      input: { url: '${variables.dataUrl}' },
    },
    retry: {
      maxRetries: 3,
      delay: 1_000,
      backoff: 'exponential',
      retryOn: ['NetworkError', 'TimeoutError'],
    },
    timeout: { duration: 30_000, action: 'fail' },
  },
  {
    id: 'validate',
    name: 'Validate Data',
    config: {
      agentType: 'worker',
      handler: 'validateData',
      input: { data: '${tasks.fetch-data.output}' },
    },
  },
  {
    id: 'parallel-process',
    name: 'Parallel Processing',
    config: {
      agentType: 'orchestrator',
      handler: 'parallelProcess',
    },
    parallel: {
      branches: ['transform-csv', 'transform-json', 'generate-report'],
      maxConcurrency: 3,
      failFast: false,
      aggregation: 'merge',
    },
  },
  {
    id: 'transform-csv',
    name: 'Transform to CSV',
    config: {
      agentType: 'worker',
      handler: 'transformCSV',
      input: { data: '${tasks.validate.output}' },
    },
  },
  {
    id: 'transform-json',
    name: 'Transform to JSON',
    config: {
      agentType: 'worker',
      handler: 'transformJSON',
      input: { data: '${tasks.validate.output}' },
    },
  },
  {
    id: 'generate-report',
    name: 'Generate Report',
    config: {
      agentType: 'worker',
      handler: 'generateReport',
      input: { data: '${tasks.validate.output}' },
    },
  },
  {
    id: 'check-quality',
    name: 'Quality Check',
    config: {
      agentType: 'worker',
      handler: 'checkQuality',
      input: {
        csv: '${tasks.transform-csv.output}',
        json: '${tasks.transform-json.output}',
      },
    },
  },
  {
    id: 'retry-loop',
    name: 'Retry on Low Quality',
    config: {
      agentType: 'worker',
      handler: 'improveQuality',
    },
    loop: {
      condition: '${tasks.check-quality.output.score < 0.9}',
      maxIterations: 5,
      delayBetweenIterations: 2_000,
    },
  },
  {
    id: 'conditional-route',
    name: 'Conditional Routing',
    config: {
      agentType: 'router',
      handler: 'routeResult',
    },
    condition: {
      expression: '${tasks.check-quality.output.score >= 0.9}',
      trueBranch: 'publish',
      falseBranch: 'manual-review',
    },
  },
  {
    id: 'publish',
    name: 'Publish Results',
    config: {
      agentType: 'worker',
      handler: 'publishResults',
    },
  },
  {
    id: 'manual-review',
    name: 'Manual Review',
    config: {
      agentType: 'worker',
      handler: 'manualReview',
    },
  },
];

// 定义边（依赖关系）
const edges: WorkflowEdge[] = [
  { from: 'fetch-data', to: 'validate' },
  { from: 'validate', to: 'parallel-process' },
  { from: 'parallel-process', to: 'check-quality' },
  { from: 'check-quality', to: 'retry-loop' },
  { from: 'retry-loop', to: 'check-quality' },
  { from: 'check-quality', to: 'conditional-route' },
  { from: 'conditional-route', to: 'publish' },
  { from: 'conditional-route', to: 'manual-review' },
];

// 定义工作流变量
const variables: WorkflowVariable[] = [
  { name: 'dataUrl', value: 'https://api.example.com/data/sales-q1', type: 'string' },
  { name: 'outputFormat', value: 'all', type: 'string' },
];

// 创建完整工作流
const workflow: Workflow = {
  id: 'wf-data-pipeline',
  name: 'Data Pipeline Workflow',
  version: '1.0.0',
  tasks,
  edges,
  variables,
  config: {
    maxConcurrency: 5,
    defaultRetry: { maxRetries: 1, delay: 500 },
    defaultTimeout: 60_000,
    onFailure: 'pause',
    notifyOnComplete: ['user-42'],
  },
};
```

### 7.2 工作流可视化（DAG 结构）

```
┌──────────────┐
│  fetch-data  │
└──────┬───────┘
       │
┌──────▼───────┐
│   validate   │
└──────┬───────┘
       │
┌──────▼──────────────────────────────────┐
│          parallel-process (并行)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │tr-csv    │ │tr-json   │ │gen-report│ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ │
└───────┼────────────┼────────────┼───────┘
        └────────────┼────────────┘
                     │
              ┌──────▼───────┐
              │ check-quality│◄──────────┐
              └──────┬───────┘           │
                     │            ┌──────┴───────┐
                     │            │  retry-loop  │
                     │            │ (score<0.9)  │
                     │            └──────────────┘
              ┌──────▼───────┐
              │cond-route    │
              └──┬───────┬───┘
          (>=0.9)│       │(<0.9)
        ┌────────▼──┐  ┌─▼─────────────┐
        │  publish  │  │ manual-review │
        └───────────┘  └───────────────┘
```

### 7.3 WorkflowExecutor — 执行工作流

```typescript
import { WorkflowExecutor, WorkflowStatus, WorkflowExecutionStatus } from '@organic/agent';

const executor = new WorkflowExecutor({
  maxConcurrency: 5,
  defaultTimeout: 60_000,
});

// 注册节点执行器
executor.registerNodeExecutor('fetchData', async (input, context) => {
  const response = await fetch(input.url);
  return response.json();
});

executor.registerNodeExecutor('validateData', async (input, context) => {
  const { data } = input;
  if (!data || data.length === 0) throw new Error('Empty dataset');
  return { valid: true, rowCount: data.length };
});

executor.registerNodeExecutor('transformCSV', async (input, context) => {
  const csv = convertToCSV(input.data);
  return { format: 'csv', content: csv, size: csv.length };
});

executor.registerNodeExecutor('transformJSON', async (input, context) => {
  return { format: 'json', content: JSON.stringify(input.data) };
});

executor.registerNodeExecutor('generateReport', async (input, context) => {
  return { format: 'pdf', url: 'https://reports.example.com/q1-sales.pdf' };
});

executor.registerNodeExecutor('checkQuality', async (input, context) => {
  const score = calculateQualityScore(input.csv, input.json);
  return { score, passed: score >= 0.9 };
});

// 执行工作流
const execution = await executor.execute(workflow, {
  executionId: 'exec-001',
  variables: {
    dataUrl: 'https://api.example.com/data/sales-q1',
    outputFormat: 'all',
  },
});

// 监控执行状态
console.log(execution.status); // WorkflowExecutionStatus

executor.on('node:started', (nodeId, execution) => {
  console.log(`[>] Node started: ${nodeId}`);
});

executor.on('node:completed', (nodeId, result, execution) => {
  console.log(`[OK] Node completed: ${nodeId}`, result);
});

executor.on('node:failed', (nodeId, error, execution) => {
  console.error(`[!!] Node failed: ${nodeId}`, error);
});

executor.on('workflow:completed', execution => {
  console.log(`[DONE] Workflow completed: ${execution.executionId}`);
});

// 暂停 / 恢复 / 取消
await executor.pause('exec-001');
await executor.resume('exec-001');
await executor.cancel('exec-001');
```

### 7.4 WorkflowEngine — 工作流生命周期管理

```typescript
import { WorkflowEngine } from '@organic/agent';

const engine = new WorkflowEngine({
  registry: {
    persistWorkflows: true,
    storageBackend: 'database',
  },
  executor: {
    maxConcurrency: 10,
    defaultTimeout: 120_000,
  },
});

// 注册工作流
engine.register(workflow);

// 创建执行实例
const executionId = await engine.createExecution('wf-data-pipeline', {
  variables: { dataUrl: 'https://api.example.com/data/sales-q1' },
  trigger: 'manual',
  triggeredBy: 'user-42',
});

// 启动执行
await engine.startExecution(executionId);

// 查询执行状态
const status = await engine.getExecutionStatus(executionId);
console.log(status);
// {
//   executionId: 'exec-001',
//   workflowId: 'wf-data-pipeline',
//   status: 'running',
//   currentNode: 'check-quality',
//   progress: { completed: 5, total: 8, percentage: 62.5 },
//   startedAt: '2026-07-03T10:00:00Z',
//   estimatedCompletion: '2026-07-03T10:02:30Z',
// }

// 获取执行历史
const history = await engine.getExecutionHistory('wf-data-pipeline', {
  limit: 20,
  status: ['completed', 'failed'],
});

// 获取工作流定义
const definition = await engine.getWorkflow('wf-data-pipeline');

// 更新工作流（创建新版本）
await engine.updateWorkflow('wf-data-pipeline', {
  ...workflow,
  version: '1.1.0',
  tasks: updatedTasks,
});

// 注销工作流
await engine.unregister('wf-data-pipeline');
```

---

## 8. 编排层

### 8.1 OrchestrationLayer — 任务分解与 Agent 选择

```typescript
import {
  OrchestrationLayer,
  DecomposedTask,
  AgentSelectionStrategy,
  OrchestrationStrategy,
} from '@organic/agent';

const orchestration = new OrchestrationLayer({
  decompositionStrategy: 'semantic', // 'semantic' | 'rule-based' | 'llm-driven'
  agentSelectionStrategy: 'capability-match' as AgentSelectionStrategy,
  maxDepth: 5,
  timeout: 300_000,
});

// 定义编排策略
const strategy: OrchestrationStrategy = {
  name: 'data-pipeline-strategy',
  decomposition: {
    method: 'semantic',
    maxSubTasks: 10,
    mergeResults: true,
  },
  agentSelection: {
    method: 'capability-match',
    preferLocal: true,
    fallbackToGeneral: true,
    loadBalance: true,
  },
  execution: {
    parallel: true,
    maxConcurrency: 5,
    failFast: false,
    retryFailed: true,
  },
};

// 分解复杂任务
const complexTask = {
  taskId: 'orchestrate-001',
  payload: {
    description:
      'Analyze Q1 sales data, generate reports in multiple formats, and publish to dashboard',
    context: {
      dataSource: 'sales-q1.csv',
      formats: ['csv', 'json', 'pdf'],
      dashboard: 'https://dash.example.com',
    },
  },
};

const decomposed: DecomposedTask[] = await orchestration.decompose(complexTask, strategy);

console.log(decomposed);
// [
//   { taskId: 'sub-001', action: 'fetchData', agentType: 'worker', dependencies: [] },
//   { taskId: 'sub-002', action: 'validateData', agentType: 'worker', dependencies: ['sub-001'] },
//   { taskId: 'sub-003', action: 'transformCSV', agentType: 'worker', dependencies: ['sub-002'] },
//   { taskId: 'sub-004', action: 'transformJSON', agentType: 'worker', dependencies: ['sub-002'] },
//   { taskId: 'sub-005', action: 'generatePDF', agentType: 'worker', dependencies: ['sub-002'] },
//   { taskId: 'sub-006', action: 'publishToDashboard', agentType: 'worker', dependencies: ['sub-003', 'sub-004', 'sub-005'] },
// ]

// 为每个子任务选择 Agent
for (const subTask of decomposed) {
  const selectedAgent = await orchestration.selectAgent(subTask, strategy);
  console.log(`${subTask.taskId} -> ${selectedAgent.name}`);
}

// 执行编排计划
const plan = await orchestration.createPlan(decomposed, strategy);
const result = await orchestration.executePlan(plan);
```

### 8.2 ExecutionCoordinator — 执行协调

```typescript
import { ExecutionCoordinator, OrchestrationPlanStatus } from '@organic/agent';

const coordinator = new ExecutionCoordinator({
  maxConcurrency: 5,
  defaultTimeout: 60_000,
  retryConfig: {
    maxRetries: 3,
    delay: 1_000,
    backoff: 'exponential',
  },
});

// 创建执行计划
const plan = coordinator.createPlan({
  id: 'plan-001',
  tasks: decomposed,
  strategy: 'parallel-when-possible',
  dependencies: {
    'sub-003': ['sub-002'],
    'sub-004': ['sub-002'],
    'sub-005': ['sub-002'],
    'sub-006': ['sub-003', 'sub-004', 'sub-005'],
  },
});

// 执行计划
const execution = await coordinator.execute(plan, {
  onProgress: (completed, total, currentTask) => {
    console.log(`Progress: ${completed}/${total} - ${currentTask}`);
  },
  onTaskComplete: (taskId, result) => {
    console.log(`Task ${taskId} completed:`, result.success);
  },
  onTaskError: (taskId, error, attempt) => {
    console.warn(`Task ${taskId} failed (attempt ${attempt}):`, error);
  },
});

// 检查计划状态
console.log(execution.status);
// OrchestrationPlanStatus: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

// 暂停 / 恢复
await coordinator.pause('plan-001');
await coordinator.resume('plan-001');

// 带超时的执行
const result = await coordinator.executeWithTimeout(plan, 300_000);
```

---

## 9. Agent 通信

### 9.1 AgentChannel — 双向通信通道

```typescript
import { AgentChannel, AgentMessage } from '@organic/agent';

// 创建通道
const channel = new AgentChannel({
  channelId: 'ch-001',
  mode: 'duplex', // 'simplex' | 'duplex' | 'multicast'
  encryption: true,
  compression: true,
});

// 连接 Agent
channel.connect(agentA, agentB);

// 发送消息
const message: AgentMessage = {
  id: 'agent-msg-001',
  from: 'agentA',
  to: 'agentB',
  type: 'request',
  subject: 'data.query',
  body: {
    query: 'SELECT * FROM sales WHERE quarter = "Q1"',
    timeout: 10_000,
  },
  correlationId: 'corr-001',
  timestamp: Date.now(),
  expiresAt: Date.now() + 30_000,
};

await channel.send(message);

// 接收消息
channel.onMessage(async message => {
  console.log(`[${message.from} -> ${message.to}]: ${message.subject}`);

  if (message.type === 'request') {
    const result = await processQuery(message.body.query);
    await channel.send({
      id: `agent-msg-${Date.now()}`,
      from: 'agentB',
      to: message.from,
      type: 'response',
      subject: 'data.query.result',
      body: result,
      correlationId: message.correlationId,
      timestamp: Date.now(),
    });
  }
});

// 请求-响应模式
const response = await channel.request('agentB', {
  subject: 'data.query',
  body: { query: 'SELECT COUNT(*) FROM sales' },
  timeout: 10_000,
});

// 广播
await channel.broadcast({
  subject: 'system.status',
  body: { status: 'healthy', uptime: 3600 },
});

// 关闭通道
await channel.close();
```

### 9.2 MessageQueue — 发布订阅

```typescript
import { MessageQueue } from '@organic/agent';

const mq = new MessageQueue({
  maxQueueSize: 10_000,
  persistence: true,
  storagePath: '/var/organic/mq',
});

// 订阅主题
const subscription = mq.subscribe('tasks.completed', async message => {
  console.log(`Task completed: ${message.taskId}`);
});

// 订阅多个主题
mq.subscribe(['tasks.*', 'agents.status'], async (message, topic) => {
  console.log(`[${topic}]:`, message);
});

// 带过滤的订阅
mq.subscribe(
  'tasks.#',
  async message => {
    // 处理所有 tasks 子主题
  },
  {
    filter: msg => msg.priority === 'high',
    concurrency: 3,
  }
);

// 发布消息
await mq.publish('tasks.completed', {
  taskId: 'task-001',
  result: { success: true },
  timestamp: Date.now(),
});

// 取消订阅
subscription.unsubscribe();

// 获取队列状态
console.log(mq.stats);
// {
//   totalMessages: 1500,
//   activeSubscriptions: 12,
//   queues: { 'tasks.completed': 45, 'agents.status': 3 },
//   throughput: { in: 120, out: 118 },
// }

// 清空队列
await mq.clear('tasks.completed');

// 关闭
await mq.shutdown();
```

---

## 10. Agent 注册中心

### 10.1 AgentRegistry — 注册与发现

```typescript
import { AgentRegistry, AgentMetadata } from '@organic/agent';

const registry = new AgentRegistry({
  heartbeatInterval: 10_000,
  heartbeatTimeout: 30_000,
  cleanupInterval: 60_000,
});

// 定义 Agent 元数据
const metadata: AgentMetadata = {
  id: 'agent-001',
  name: 'DataProcessor',
  type: 'worker',
  version: '2.1.0',
  status: 'active',
  capabilities: ['csv', 'json', 'xml', 'parquet', 'data-validation'],
  endpoints: {
    rpc: 'localhost:50051',
    http: 'http://localhost:8080',
  },
  resources: {
    cpu: 2,
    memoryMB: 512,
    diskGB: 10,
  },
  tags: ['production', 'data-pipeline', 'us-east'],
  registeredAt: Date.now(),
  lastHeartbeat: Date.now(),
};

// 注册 Agent
await registry.register(metadata);

// 心跳维持
setInterval(async () => {
  await registry.heartbeat('agent-001');
}, 10_000);

// 发现 Agent
const agents = await registry.discover({
  type: 'worker',
  capabilities: ['csv', 'json'],
  status: 'active',
  tags: ['production'],
});

// 按 ID 查询
const agent = await registry.getAgent('agent-001');

// 按能力查询
const capableAgents = await registry.findByCapability('data-validation');

// 获取所有 Agent
const allAgents = await registry.listAgents();

// 获取统计
const stats = await registry.getStats();
console.log(stats);
// {
//   total: 15,
//   active: 12,
//   idle: 3,
//   byType: { worker: 8, orchestrator: 3, assistant: 2, router: 1, observer: 1 },
//   byStatus: { active: 12, idle: 3 },
// }

// 监听注册事件
registry.on('agent:registered', agent => {
  console.log(`Agent registered: ${agent.name}`);
});

registry.on('agent:offline', agentId => {
  console.warn(`Agent went offline: ${agentId}`);
});

registry.on('agent:updated', agent => {
  console.log(`Agent updated: ${agent.name} -> ${agent.status}`);
});

// 注销
await registry.deregister('agent-001');
```

---

## 11. 完整示例：多 Agent 协同工作流

### 11.1 场景说明

构建一个 **数据分析报告生成系统**，包含以下 Agent：

- **OrchestratorAgent**：分解任务、调度子 Agent
- **DataFetcherAgent**：获取数据源
- **DataProcessorAgent**：数据清洗与转换
- **ReportGeneratorAgent**：生成多格式报告
- **PublisherAgent**：发布到仪表盘

### 11.2 完整实现

```typescript
import {
  Agent,
  AgentConfig,
  AgentType,
  AgentPriority,
  createAgentConfig,
  AgentTaskInput,
  AgentResult,
  AgentExecutionContext,
  TaskScheduler,
  OrchestrationLayer,
  OrchestrationStrategy,
  ExecutionCoordinator,
  WorkflowEngine,
  Workflow,
  WorkflowExecutor,
  AgentRegistry,
  AgentMetadata,
  AgentChannel,
  AgentMessage,
  MessageQueue,
  ContextManager,
  ContextService,
} from '@organic/agent';

// ============================================================
// 1. 创建 Agent 注册中心
// ============================================================
const registry = new AgentRegistry({
  heartbeatInterval: 10_000,
  heartbeatTimeout: 30_000,
});

// ============================================================
// 2. 定义各 Agent 配置
// ============================================================
const dataFetcherConfig = createAgentConfig({
  name: 'DataFetcher',
  type: 'worker' as AgentType,
  priority: 'high' as AgentPriority,
  maxConcurrency: 3,
  defaultTimeout: 30_000,
  maxRetries: 2,
});

const dataProcessorConfig = createAgentConfig({
  name: 'DataProcessor',
  type: 'worker' as AgentType,
  priority: 'high' as AgentPriority,
  maxConcurrency: 5,
  defaultTimeout: 60_000,
  maxRetries: 2,
  retryBackoff: 'exponential',
});

const reportGeneratorConfig = createAgentConfig({
  name: 'ReportGenerator',
  type: 'worker' as AgentType,
  priority: 'normal' as AgentPriority,
  maxConcurrency: 3,
  defaultTimeout: 120_000,
});

const publisherConfig = createAgentConfig({
  name: 'Publisher',
  type: 'worker' as AgentType,
  priority: 'normal' as AgentPriority,
  maxConcurrency: 2,
  defaultTimeout: 30_000,
});

const orchestratorConfig = createAgentConfig({
  name: 'Orchestrator',
  type: 'orchestrator' as AgentType,
  priority: 'high' as AgentPriority,
  maxConcurrency: 1,
  defaultTimeout: 300_000,
});

// ============================================================
// 3. 创建 Agent 实例
// ============================================================
const dataFetcher = new Agent(dataFetcherConfig);
const dataProcessor = new Agent(dataProcessorConfig);
const reportGenerator = new Agent(reportGeneratorConfig);
const publisher = new Agent(publisherConfig);
const orchestrator = new Agent(orchestratorConfig);

// ============================================================
// 4. 注册 Agent 到注册中心
// ============================================================
const allAgents = [
  { agent: dataFetcher, meta: { capabilities: ['http', 'file', 'database'] } },
  {
    agent: dataProcessor,
    meta: { capabilities: ['csv', 'json', 'xml', 'validation', 'cleaning'] },
  },
  { agent: reportGenerator, meta: { capabilities: ['pdf', 'html', 'markdown', 'chart'] } },
  { agent: publisher, meta: { capabilities: ['dashboard', 'email', 'slack', 's3'] } },
  { agent: orchestrator, meta: { capabilities: ['orchestration', 'planning', 'decomposition'] } },
];

for (const { agent, meta } of allAgents) {
  await registry.register({
    id: agent.id,
    name: agent.name,
    type: agent.type as AgentMetadata['type'],
    version: '1.0.0',
    status: 'active',
    capabilities: meta.capabilities,
    tags: ['production', 'data-pipeline'],
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
  });
}

// ============================================================
// 5. 注册任务处理器
// ============================================================

// DataFetcher 处理器
dataFetcher.registerHandler('fetchData', async (input, ctx) => {
  const { source, format } = input.payload;

  if (ctx.cancelled) throw new Error('Cancelled');

  let data: unknown;
  if (source.startsWith('http')) {
    const response = await fetch(source, { signal: ctx.signal });
    data = await response.json();
  } else if (source.startsWith('file://')) {
    const content = await readFile(source.replace('file://', ''));
    data = format === 'csv' ? parseCSV(content) : JSON.parse(content);
  } else {
    throw new Error(`Unsupported source: ${source}`);
  }

  return { data, rowCount: Array.isArray(data) ? data.length : 1, source };
});

// DataProcessor 处理器
dataProcessor.registerHandler('cleanData', async (input, ctx) => {
  const { data } = input.payload;
  const cleaned = data
    .filter((row: Record<string, unknown>) => Object.values(row).every(v => v != null))
    .map((row: Record<string, unknown>) => {
      const cleaned = { ...row };
      for (const [key, value] of Object.entries(cleaned)) {
        if (typeof value === 'string') cleaned[key] = value.trim();
      }
      return cleaned;
    });
  return { cleaned, removedRows: data.length - cleaned.length };
});

dataProcessor.registerHandler('validateData', async (input, ctx) => {
  const { data } = input.payload;
  const errors: string[] = [];
  if (!Array.isArray(data)) errors.push('Data must be an array');
  if (data.length === 0) errors.push('Data is empty');
  return { valid: errors.length === 0, errors, rowCount: data.length };
});

dataProcessor.registerHandler('transformData', async (input, ctx) => {
  const { data, targetFormat } = input.payload;
  let result: string;
  switch (targetFormat) {
    case 'csv':
      result = convertToCSV(data);
      break;
    case 'json':
      result = JSON.stringify(data, null, 2);
      break;
    case 'xml':
      result = convertToXML(data);
      break;
    default:
      throw new Error(`Unsupported format: ${targetFormat}`);
  }
  return { format: targetFormat, content: result, size: result.length };
});

// ReportGenerator 处理器
reportGenerator.registerHandler('generateReport', async (input, ctx) => {
  const { data, format, template } = input.payload;
  const report =
    format === 'pdf'
      ? await generatePDF(data, template)
      : format === 'html'
        ? await generateHTML(data, template)
        : await generateMarkdown(data);

  return {
    format,
    url: `https://reports.example.com/${ctx.taskId}.${format}`,
    generatedAt: new Date().toISOString(),
    size: report.length,
  };
});

// Publisher 处理器
publisher.registerHandler('publish', async (input, ctx) => {
  const { reportUrl, targets } = input.payload;
  const results = [];

  for (const target of targets) {
    switch (target) {
      case 'dashboard':
        await pushToDashboard(reportUrl);
        results.push({ target: 'dashboard', status: 'published' });
        break;
      case 'email':
        await sendEmail({ attachment: reportUrl });
        results.push({ target: 'email', status: 'sent' });
        break;
      case 'slack':
        await postToSlack({ file: reportUrl });
        results.push({ target: 'slack', status: 'posted' });
        break;
      default:
        results.push({ target, status: 'skipped', reason: 'Unsupported target' });
    }
  }

  return { results, publishedAt: new Date().toISOString() };
});

// Orchestrator 处理器
orchestrator.registerHandler('orchestrate', async (input, ctx) => {
  const { request } = input.payload;

  // 步骤 1：获取数据
  const fetchResult = await dataFetcher.execute({
    taskId: `${ctx.taskId}-fetch`,
    payload: { source: request.dataSource, format: 'csv' },
    parentTaskId: ctx.taskId,
  });
  if (!fetchResult.success) throw new Error(`Fetch failed: ${fetchResult.error}`);

  // 步骤 2：清洗与验证
  const cleanResult = await dataProcessor.execute({
    taskId: `${ctx.taskId}-clean`,
    payload: { data: fetchResult.data!.data },
    parentTaskId: ctx.taskId,
  });
  if (!cleanResult.success) throw new Error(`Clean failed: ${cleanResult.error}`);

  const validateResult = await dataProcessor.execute({
    taskId: `${ctx.taskId}-validate`,
    payload: { data: cleanResult.data!.cleaned },
    parentTaskId: ctx.taskId,
  });
  if (!validateResult.success) throw new Error(`Validation failed: ${validateResult.error}`);

  if (!validateResult.data!.valid) {
    throw new Error(`Data validation errors: ${validateResult.data!.errors.join(', ')}`);
  }

  // 步骤 3：并行生成多格式报告
  const reportFormats = request.formats || ['pdf', 'html', 'markdown'];
  const reportTasks = reportFormats.map(format =>
    reportGenerator.execute({
      taskId: `${ctx.taskId}-report-${format}`,
      payload: {
        data: cleanResult.data!.cleaned,
        format,
        template: request.template || 'default',
      },
      parentTaskId: ctx.taskId,
    })
  );

  const reportResults = await Promise.allSettled(reportTasks);
  const reports = reportResults
    .filter(
      (r): r is PromiseFulfilledResult<AgentResult<unknown>> =>
        r.status === 'fulfilled' && r.value.success
    )
    .map(r => r.value.data);

  // 步骤 4：发布
  const publishResult = await publisher.execute({
    taskId: `${ctx.taskId}-publish`,
    payload: {
      reportUrl: reports[0]?.url,
      targets: request.targets || ['dashboard'],
    },
    parentTaskId: ctx.taskId,
  });

  return {
    status: 'completed',
    fetched: fetchResult.data!.rowCount,
    cleaned: cleanResult.data!.cleaned.length,
    reports: reports.map((r: any) => ({ format: r.format, url: r.url })),
    published: publishResult.success ? publishResult.data : null,
    executionTime: Date.now() - ctx.startTime,
  };
});

// ============================================================
// 6. 创建任务调度器
// ============================================================
const scheduler = new TaskScheduler({
  maxConcurrency: 10,
  schedulingStrategy: 'priority',
  defaultTimeout: 300_000,
});

scheduler.registerAgent(dataFetcher);
scheduler.registerAgent(dataProcessor);
scheduler.registerAgent(reportGenerator);
scheduler.registerAgent(publisher);
scheduler.registerAgent(orchestrator);

// ============================================================
// 7. 创建编排层
// ============================================================
const orchestrationLayer = new OrchestrationLayer({
  decompositionStrategy: 'semantic',
  agentSelectionStrategy: 'capability-match',
  maxDepth: 3,
  timeout: 300_000,
});

// ============================================================
// 8. 创建消息队列（用于事件通知）
// ============================================================
const mq = new MessageQueue({ maxQueueSize: 10_000 });

mq.subscribe('tasks.#', async (message, topic) => {
  console.log(`[MQ ${topic}]:`, message.taskId);
});

// ============================================================
// 9. 创建 Agent 通信通道
// ============================================================
const channel = new AgentChannel({ channelId: 'main-channel', mode: 'multicast' });
channel.connect(orchestrator, dataFetcher);
channel.connect(orchestrator, dataProcessor);
channel.connect(orchestrator, reportGenerator);
channel.connect(orchestrator, publisher);

// ============================================================
// 10. 执行完整流程
// ============================================================
async function runAnalysisPipeline(request: {
  dataSource: string;
  formats: string[];
  targets: string[];
  template?: string;
}) {
  console.log('=== Starting Analysis Pipeline ===');

  const result = await orchestrator.execute({
    taskId: `pipeline-${Date.now()}`,
    payload: { request },
    priority: 'high',
    timeout: 300_000,
  });

  if (result.success) {
    console.log('=== Pipeline Completed ===');
    console.log('Fetched rows:', result.data.fetched);
    console.log('Cleaned rows:', result.data.cleaned);
    console.log('Reports:', result.data.reports);
    console.log('Published:', result.data.published);
    console.log('Total execution time:', result.data.executionTime, 'ms');
  } else {
    console.error('=== Pipeline Failed ===');
    console.error('Error:', result.error);
  }

  return result;
}

// 运行
const result = await runAnalysisPipeline({
  dataSource: 'https://api.example.com/data/sales-q1',
  formats: ['pdf', 'html', 'markdown'],
  targets: ['dashboard', 'email', 'slack'],
  template: 'executive-summary',
});

// ============================================================
// 11. 优雅关闭
// ============================================================
async function shutdown() {
  console.log('Shutting down...');
  await scheduler.shutdown();
  await channel.close();
  await mq.shutdown();
  await dataFetcher.shutdown();
  await dataProcessor.shutdown();
  await reportGenerator.shutdown();
  await publisher.shutdown();
  await orchestrator.shutdown();
  console.log('All agents shut down.');
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

---

## 12. 配置参考

### 12.1 AgentConfig 完整选项

| 选项                | 类型                                | 默认值      | 说明               |
| ------------------- | ----------------------------------- | ----------- | ------------------ |
| `name`              | `string`                            | —           | Agent 名称（必填） |
| `type`              | `AgentType`                         | `'worker'`  | Agent 类型         |
| `priority`          | `AgentPriority`                     | `'normal'`  | 调度优先级         |
| `maxConcurrency`    | `number`                            | `1`         | 最大并发任务数     |
| `maxQueueSize`      | `number`                            | `1000`      | 队列最大容量       |
| `defaultTimeout`    | `number`                            | `30000`     | 默认任务超时（ms） |
| `taskTimeout`       | `number`                            | —           | 全局任务超时（ms） |
| `maxRetries`        | `number`                            | `0`         | 最大重试次数       |
| `retryDelay`        | `number`                            | `1000`      | 重试间隔（ms）     |
| `retryBackoff`      | `'linear' \| 'exponential'`         | `'linear'`  | 退避策略           |
| `contextWindowSize` | `number`                            | `100`       | 上下文窗口大小     |
| `contextRetention`  | `'sliding' \| 'fifo' \| 'priority'` | `'sliding'` | 上下文保留策略     |
| `maxMemoryMB`       | `number`                            | —           | 最大内存限制（MB） |
| `cpuLimit`          | `number`                            | —           | CPU 核心限制       |
| `metadata`          | `Record<string, unknown>`           | `{}`        | 自定义元数据       |

### 12.2 TaskQueue 配置

| 选项              | 类型           | 默认值             | 说明           |
| ----------------- | -------------- | ------------------ | -------------- |
| `concurrency`     | `number`       | `1`                | 最大并发数     |
| `maxSize`         | `number`       | `1000`             | 队列最大容量   |
| `defaultPriority` | `TaskPriority` | `'normal'`         | 默认优先级     |
| `strategy`        | `string`       | `'priority-first'` | 调度策略       |
| `batchSize`       | `number`       | —                  | 批量处理大小   |
| `batchTimeout`    | `number`       | —                  | 批量超时（ms） |

### 12.3 TaskScheduler 配置

| 选项                 | 类型                                            | 默认值       | 说明               |
| -------------------- | ----------------------------------------------- | ------------ | ------------------ |
| `maxConcurrency`     | `number`                                        | `10`         | 全局最大并发数     |
| `schedulingStrategy` | `'priority' \| 'round-robin' \| 'least-loaded'` | `'priority'` | 调度策略           |
| `defaultTimeout`     | `number`                                        | `30000`      | 默认超时（ms）     |
| `maxStarvationTime`  | `number`                                        | —            | 饥饿防护时间（ms） |

### 12.4 ContextWindowManager 配置

| 选项                     | 类型                                | 默认值      | 说明          |
| ------------------------ | ----------------------------------- | ----------- | ------------- |
| `maxTokens`              | `number`                            | `8000`      | 最大 token 数 |
| `maxMessages`            | `number`                            | `50`        | 最大消息数    |
| `retentionPolicy`        | `'sliding' \| 'fifo' \| 'priority'` | `'sliding'` | 保留策略      |
| `preserveSystemMessages` | `boolean`                           | `true`      | 保留系统消息  |
| `preservePinnedMessages` | `boolean`                           | `true`      | 保留置顶消息  |
| `summarizationThreshold` | `number`                            | `0.8`       | 摘要触发阈值  |

### 12.5 WorkflowEngine 配置

| 选项                        | 类型      | 默认值     | 说明             |
| --------------------------- | --------- | ---------- | ---------------- |
| `registry.persistWorkflows` | `boolean` | `false`    | 持久化工作流定义 |
| `registry.storageBackend`   | `string`  | `'memory'` | 存储后端         |
| `executor.maxConcurrency`   | `number`  | `10`       | 执行器最大并发   |
| `executor.defaultTimeout`   | `number`  | `120000`   | 默认超时（ms）   |

### 12.6 OrchestrationLayer 配置

| 选项                     | 类型                                         | 默认值               | 说明           |
| ------------------------ | -------------------------------------------- | -------------------- | -------------- |
| `decompositionStrategy`  | `'semantic' \| 'rule-based' \| 'llm-driven'` | `'semantic'`         | 分解策略       |
| `agentSelectionStrategy` | `AgentSelectionStrategy`                     | `'capability-match'` | Agent 选择策略 |
| `maxDepth`               | `number`                                     | `5`                  | 最大分解深度   |
| `timeout`                | `number`                                     | `300000`             | 编排超时（ms） |

### 12.7 AgentRegistry 配置

| 选项                | 类型     | 默认值  | 说明           |
| ------------------- | -------- | ------- | -------------- |
| `heartbeatInterval` | `number` | `10000` | 心跳间隔（ms） |
| `heartbeatTimeout`  | `number` | `30000` | 心跳超时（ms） |
| `cleanupInterval`   | `number` | `60000` | 清理间隔（ms） |

---

## 13. 错误处理

### 13.1 错误分类

```typescript
// Agent 执行错误类型
type AgentErrorType =
  | 'TIMEOUT' // 任务超时
  | 'CANCELLED' // 任务被取消
  | 'QUEUE_FULL' // 队列已满
  | 'AGENT_BUSY' // Agent 忙碌
  | 'AGENT_STOPPED' // Agent 已停止
  | 'DEPENDENCY_FAILED' // 依赖任务失败
  | 'RETRY_EXHAUSTED' // 重试耗尽
  | 'INVALID_INPUT' // 无效输入
  | 'INTERNAL_ERROR'; // 内部错误
```

### 13.2 错误处理模式

```typescript
// 模式 1：try-catch 包裹
try {
  const result = await agent.execute({
    taskId: 'risky-task',
    payload: { url: 'https://unstable.example.com' },
    timeout: 5_000,
  });

  if (!result.success) {
    console.error(`Task failed: ${result.error}`);
    console.error(`Execution time: ${result.executionTime}ms`);
    console.error(`Retry count: ${result.metadata?.retryCount}`);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}

// 模式 2：事件监听
agent.on('error', error => {
  console.error('Agent error:', error);
  // 记录到监控系统
  metrics.increment('agent.errors', { agent: agent.name, type: error.type });
});

agent.on('task:failed', (task, error) => {
  // 失败任务处理
  if (error.type === 'TIMEOUT') {
    // 超时：增加超时时间重试
    await agent.execute({ ...task, timeout: (task.timeout || 30000) * 2 });
  } else if (error.type === 'RETRY_EXHAUSTED') {
    // 重试耗尽：发送告警
    await alerting.send(`Task ${task.taskId} failed after all retries`);
  }
});

// 模式 3：带降级的执行
async function executeWithFallback(task: AgentTaskInput): Promise<AgentResult> {
  const result = await agent.execute(task);

  if (!result.success) {
    console.warn(`Primary execution failed: ${result.error}, trying fallback...`);
    return await fallbackAgent.execute({
      ...task,
      taskId: `${task.taskId}-fallback`,
      payload: { ...task.payload, useFallback: true },
    });
  }

  return result;
}

// 模式 4：断路器模式
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 30_000
  ) {}

  async execute(fn: () => Promise<AgentResult>): Promise<AgentResult> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        return { success: false, error: 'Circuit breaker is open', executionTime: 0 };
      }
    }

    const result = await fn();

    if (result.success) {
      this.failures = 0;
      this.state = 'closed';
    } else {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) {
        this.state = 'open';
      }
    }

    return result;
  }
}

const breaker = new CircuitBreaker(5, 30_000);
const result = await breaker.execute(() => agent.execute(task));
```

### 13.3 工作流错误处理

```typescript
// 工作流级别的错误处理
const workflow: Workflow = {
  // ... 其他配置
  config: {
    onFailure: 'pause', // 'pause' | 'continue' | 'rollback' | 'abort'
    onNodeFailure: 'retry', // 'retry' | 'skip' | 'fail' | 'fallback'
    globalRetry: {
      maxRetries: 3,
      delay: 5_000,
      backoff: 'exponential',
    },
    errorHandlers: {
      'fetch-data': async (error, context) => {
        // 使用缓存数据
        return { data: await getCachedData(), fromCache: true };
      },
      publish: async (error, context) => {
        // 发布失败时重试队列
        await retryQueue.enqueue(context.task);
        return { queued: true };
      },
    },
    notifications: {
      onFailure: ['slack#alerts', 'email#ops@example.com'],
      onCriticalFailure: ['pagerduty#oncall'],
    },
  },
};
```

---

## 14. 最佳实践

### 14.1 Agent 设计原则

```
✅ 单一职责：每个 Agent 只负责一类任务
✅ 无状态设计：Agent 不应依赖本地状态，通过上下文传递数据
✅ 幂等处理：相同的输入应产生相同的结果
✅ 超时控制：始终为任务设置合理的超时
✅ 优雅降级：提供 fallback 机制处理失败场景
```

### 14.2 任务设计

```typescript
// ✅ 好的任务设计：明确的输入输出
const goodTask: AgentTaskInput = {
  taskId: 'transform-sales-q1',
  payload: {
    action: 'transform',
    source: 'sales-q1.csv',
    targetFormat: 'json',
  },
  timeout: 30_000,
};

// ❌ 不好的任务设计：职责不清、载荷过大
const badTask: AgentTaskInput = {
  taskId: 'do-everything',
  payload: {
    rawData: hugeDataObject, // 应通过引用传递
    doEverything: true, // 职责不明确
  },
  // 缺少 timeout
};
```

### 14.3 并发控制

```typescript
// ✅ 根据任务类型设置合理的并发数
const cpuAgent = new Agent(
  createAgentConfig({
    name: 'cpu-intensive',
    type: 'worker',
    maxConcurrency: 2, // CPU 密集型：限制并发
  })
);

const ioAgent = new Agent(
  createAgentConfig({
    name: 'io-intensive',
    type: 'worker',
    maxConcurrency: 20, // IO 密集型：高并发
  })
);

// ✅ 使用调度器管理全局并发
const scheduler = new TaskScheduler({
  maxConcurrency: 10, // 全局上限
  schedulingStrategy: 'least-loaded',
});
```

### 14.4 上下文管理

```typescript
// ✅ 控制上下文窗口大小
const windowManager = new ContextWindowManager({
  maxTokens: 4_000, // 根据模型限制设置
  maxMessages: 30,
  sumarizationThreshold: 0.7, // 70% 时触发摘要
});

// ✅ 为长对话设置摘要策略
windowManager.setRetentionPolicy('conv-001', {
  preserveLastN: 10,
  preserveByPriority: true,
  summarizationPrompt: '将以上对话总结为关键要点，保留所有重要决策和待办事项。',
});

// ✅ 使用上下文传播避免重复传递
const contextService = new ContextService();
contextService.set('sharedConfig', { apiKey: '...', endpoint: '...' });
// 子任务自动继承
```

### 14.5 工作流设计

```typescript
// ✅ 模块化工作流设计
// 1. 每个节点职责单一
// 2. 合理设置依赖关系
// 3. 为每个节点设置重试策略
// 4. 使用并行节点处理独立任务
// 5. 设置全局超时和失败策略

const bestPracticeWorkflow: Workflow = {
  id: 'well-designed-workflow',
  name: 'Well-Designed Workflow',
  version: '1.0.0',
  tasks: [
    // 每个节点都有明确的：
    // - id：唯一标识
    // - handler：对应的处理器名
    // - retry：重试策略
    // - timeout：超时设置
  ],
  edges: [
    // 清晰的无环依赖关系
  ],
  config: {
    maxConcurrency: 5,
    defaultRetry: { maxRetries: 2, delay: 1_000 },
    defaultTimeout: 60_000,
    onFailure: 'pause', // 失败时暂停，保留现场
  },
};
```

### 14.6 监控与可观测性

```typescript
// ✅ 监听关键事件
agent.on('task:started', task => {
  metrics.increment('tasks.started');
  logger.info('Task started', { taskId: task.taskId, agent: agent.name });
});

agent.on('task:completed', (task, result) => {
  metrics.timing('tasks.duration', result.executionTime);
  metrics.increment('tasks.completed');
  logger.info('Task completed', {
    taskId: task.taskId,
    duration: result.executionTime,
    success: result.success,
  });
});

agent.on('task:failed', (task, error) => {
  metrics.increment('tasks.failed');
  logger.error('Task failed', { taskId: task.taskId, error });
});

// ✅ 定期检查 Agent 统计
setInterval(() => {
  const stats = getAgentStats(agent);
  metrics.gauge('agent.queue_depth', stats.queuedTasks);
  metrics.gauge('agent.active_tasks', stats.runningTasks);
  metrics.gauge('agent.uptime', stats.uptime);
}, 10_000);

// ✅ 使用心跳检测 Agent 健康状态
registry.on('agent:offline', agentId => {
  alerting.send(`Agent ${agentId} is offline!`);
  // 触发故障转移
});
```

### 14.7 资源清理

```typescript
// ✅ 始终在应用退出时清理资源
async function gracefulShutdown() {
  const shutdownTimeout = setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30_000);

  try {
    // 1. 停止接受新任务
    scheduler.pause();

    // 2. 等待正在执行的任务完成
    if (scheduler.activeTasks > 0) {
      console.log(`Waiting for ${scheduler.activeTasks} active tasks...`);
      await scheduler.drain();
    }

    // 3. 关闭通信通道
    await channel.close();
    await mq.shutdown();

    // 4. 关闭各 Agent
    const agents = [dataFetcher, dataProcessor, reportGenerator, publisher, orchestrator];
    await Promise.all(agents.map(a => a.shutdown()));

    // 5. 注销
    await registry.deregister(agent.id);

    console.log('Graceful shutdown complete');
  } finally {
    clearTimeout(shutdownTimeout);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

---

## 附录 A：类型速查

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
  DEFAULT_AGENT_CONFIG,
  createAgentConfig,
  AgentState,
  AgentStateOptions,
  AgentStats,
  AgentStatus,
  createAgentState,
  getAgentStats);

// 调度器
(TaskQueue, TaskScheduler, TaskPriority, TaskStatus, Task, TaskOptions, TaskQueueConfig);

// 上下文管理
(Message,
  MessageSender,
  MessageContent,
  MessageOptions,
  Attachment,
  ToolCall,
  ToolResponse,
  MessageType,
  MessageStatus,
  MessageFlag,
  ContentFormat,
  AttachmentType,
  ContextManager,
  ContextItem,
  ContextItemOptions,
  ContextItemFilter,
  ContextItemUpdate,
  ContextItemMetadata,
  ContextItemType,
  ContextItemPriority,
  ContextWindowManager,
  ContextService);

// 工作流
(WorkflowTask,
  Workflow,
  WorkflowExecutor,
  WorkflowEngine,
  WorkflowEdge,
  WorkflowConfig,
  WorkflowVariable,
  WorkflowExecution,
  EdgeCondition,
  WorkflowStatus,
  WorkflowExecutionStatus,
  TaskExecution,
  TaskConfig,
  TaskInput,
  TaskOutput,
  TaskDependency,
  RetryPolicy,
  TaskTimeout,
  ConditionExpression,
  LoopConfig,
  ParallelConfig);

// 编排
(OrchestrationLayer,
  ExecutionCoordinator,
  OrchestrationStrategy,
  OrchestrationPlanStatus,
  DecomposedTask,
  AgentSelectionStrategy);

// 通信
(AgentChannel, AgentMessage, MessageQueue);

// 注册
(AgentRegistry, AgentMetadata);
```

---

## 附录 B：事件总线速查

| 事件名               | 来源                 | 参数                                                              |
| -------------------- | -------------------- | ----------------------------------------------------------------- |
| `task:started`       | Agent                | `(task: AgentTaskInput)`                                          |
| `task:completed`     | Agent                | `(task: AgentTaskInput, result: AgentResult)`                     |
| `task:failed`        | Agent                | `(task: AgentTaskInput, error: Error)`                            |
| `state:changed`      | Agent                | `(prevState: AgentState, nextState: AgentState)`                  |
| `error`              | Agent                | `(error: Error)`                                                  |
| `task:dequeued`      | TaskQueue            | `(task: Task)`                                                    |
| `queue:full`         | TaskQueue            | `()`                                                              |
| `queue:drained`      | TaskQueue            | `()`                                                              |
| `window:trimmed`     | ContextWindowManager | `(convId: string, removedCount: number)`                          |
| `window:overflow`    | ContextWindowManager | `(convId: string, state: WindowState)`                            |
| `node:started`       | WorkflowExecutor     | `(nodeId: string, execution: WorkflowExecution)`                  |
| `node:completed`     | WorkflowExecutor     | `(nodeId: string, result: unknown, execution: WorkflowExecution)` |
| `node:failed`        | WorkflowExecutor     | `(nodeId: string, error: Error, execution: WorkflowExecution)`    |
| `workflow:completed` | WorkflowExecutor     | `(execution: WorkflowExecution)`                                  |
| `agent:registered`   | AgentRegistry        | `(agent: AgentMetadata)`                                          |
| `agent:offline`      | AgentRegistry        | `(agentId: string)`                                               |
| `agent:updated`      | AgentRegistry        | `(agent: AgentMetadata)`                                          |
