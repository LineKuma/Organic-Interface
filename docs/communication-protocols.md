# Organic-Interface 通信协议规范

> 本文档基于实际代码实现，全面记录 Organic-Interface 系统中所有通信协议。涵盖 Kernel 层、Agent 层、Plugin 层、Tool 层、Storage 层、UI 层以及跨包通信的完整协议规范。

---

## 1. 概述

Organic-Interface 系统采用分层通信架构，各层通过标准化的协议进行交互。通信架构分为以下几个层次：

```
┌──────────────────────────────────────────────────────┐
│                     UI 层 (@organic/ui)               │
│   CLI 命令解析 → Sandbox 沙箱 → UIAgent 智能代理      │
├──────────────────────────────────────────────────────┤
│                   Agent 层 (@organic/agent)            │
│   AgentChannel 通道 → AgentMessage 消息 → MessageQueue│
├──────────────────────────────────────────────────────┤
│                  Plugin 层 (@organic/plugins)          │
│   PluginInterface ←→ KernelApi ←→ PluginManager       │
├──────────────────────────────────────────────────────┤
│                   Tool 层 (@organic/tools)             │
│   ToolService → ToolExecutor → SecurityGuard          │
├──────────────────────────────────────────────────────┤
│                  Kernel 层 (@organic/kernel)           │
│   EventBus 事件总线 ←→ LifecycleManager 生命周期       │
├──────────────────────────────────────────────────────┤
│                 Storage 层 (@organic/storage)          │
│   StorageService → StorageManager → IStorageBackend   │
└──────────────────────────────────────────────────────┘
```

**核心通信路径：**

```
User Input → CLI → UIAgent → AgentChannel → Plugin → Kernel → Tool → Kernel → Plugin → AgentChannel → CLI → User Output
```

**包依赖方向（自上而下）：**

```
@organic/ui
  ├── @organic/agent
  │     ├── @organic/kernel
  │     │     └── @organic/utils
  │     ├── @organic/plugins
  │     │     ├── @organic/utils
  │     │     └── @organic/kernel
  │     └── @organic/tools
  │           ├── @organic/utils
  │           └── @organic/kernel
  └── @organic/storage
        ├── @organic/utils
        └── @organic/kernel
```

---

## 2. EventBus 协议（Kernel 层）

EventBus 是 Kernel 层的核心事件通信机制，位于 `packages/kernel/src/kernel/EventBus.ts`。

### 2.1 发布/订阅模式

EventBus 实现经典的发布/订阅（Pub/Sub）模式，支持精确事件匹配和通配符模式匹配。

```
┌──────────┐  emit('kernel:init', data)  ┌──────────────┐
│ Publisher │ ──────────────────────────▶ │   EventBus   │
└──────────┘                              │              │
                                          │ listeners:   │
                                          │  'kernel:*'  │──▶ Subscriber A
                                          │  'kernel:init'│─▶ Subscriber B
                                          │  'plugin:*'  │──▶ Subscriber C
                                          └──────────────┘
```

### 2.2 事件命名约定

事件类型使用 `namespace:action` 命名规范，采用冒号分隔的层级结构：

| 命名空间      | 说明             | 示例                                                       |
| ------------- | ---------------- | ---------------------------------------------------------- |
| `kernel:*`    | 内核生命周期事件 | `kernel:init`, `kernel:start`, `kernel:stop`               |
| `plugin:*`    | 插件管理事件     | `plugin:register`, `plugin:unregister`, `plugin:error`     |
| `config:*`    | 配置变更事件     | `config:update`                                            |
| `tool:*`      | 工具管理事件     | `tool:registered`, `tool:unregistered`                     |
| `execution:*` | 工具执行事件     | `execution:start`, `execution:complete`, `execution:error` |
| `queue:*`     | 消息队列事件     | `queue:full`, `queue:empty`, `queue:cleared`               |
| `message:*`   | 消息生命周期事件 | `message:enqueued`, `message:dequeued`                     |
| `session:*`   | 沙箱会话事件     | `session:created`, `session:terminated`                    |

### 2.3 通配符匹配

EventBus 支持三种通配符模式：

| 模式       | 说明                            | 示例                                                 |
| ---------- | ------------------------------- | ---------------------------------------------------- |
| `prefix:*` | 匹配所有以 `prefix:` 开头的类型 | `kernel:*` 匹配 `kernel:init`, `kernel:start`        |
| `*:suffix` | 匹配所有以 `:suffix` 结尾的类型 | `*:error` 匹配 `plugin:error`, `execution:error`     |
| `prefix*`  | 正则匹配含 `*` 的模式           | `exec*` 匹配 `execution:start`, `execution:complete` |

**核心实现逻辑（`matchesPattern` 方法）：**

```typescript
private matchesPattern(type: string, pattern: string): boolean {
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -2);
    return type.startsWith(prefix + ':') || type.startsWith(prefix + '/');
  }
  if (pattern.startsWith('*:')) {
    const suffix = pattern.slice(2);
    return type.endsWith(':' + suffix) || type.endsWith('/' + suffix);
  }
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '[^:]*') + '$');
    return regex.test(type);
  }
  return false;
}
```

### 2.4 异步分发

EventBus 默认使用 `setImmediate()` 进行异步事件分发，确保事件触发不会阻塞当前执行上下文。可通过 `EventBusConfig.async = false` 切换为同步分发。

```
emit(type, data)
  │
  ├─ async === true (默认)
  │   └─ setImmediate(() => {
  │       遍历精确匹配监听器 → 执行回调
  │       遍历通配符匹配监听器 → 执行回调
  │     })
  │
  └─ async === false
      └─ 同步遍历并执行所有匹配的监听器
```

### 2.5 预定义事件类型

系统预定义了以下核心事件常量（`KernelEvents`）：

```typescript
export const KernelEvents = {
  KERNEL_INIT: 'kernel:init',
  KERNEL_START: 'kernel:start',
  KERNEL_STOP: 'kernel:stop',
  PLUGIN_REGISTER: 'plugin:register',
  PLUGIN_UNREGISTER: 'plugin:unregister',
  PLUGIN_ERROR: 'plugin:error',
  CONFIG_UPDATE: 'config:update',
} as const;
```

ToolService 定义的工具事件：

```typescript
export interface ToolServiceEvents {
  'tool:registered': { toolId: string; timestamp: number };
  'tool:unregistered': { toolId: string; timestamp: number };
  'tool:enabled': { toolId: string; timestamp: number };
  'tool:disabled': { toolId: string; timestamp: number };
  'execution:start': { toolId: string; executionId: string; timestamp: number };
  'execution:complete': {
    toolId: string;
    executionId: string;
    result: ToolResult;
    timestamp: number;
  };
  'execution:error': { toolId: string; executionId: string; error: Error; timestamp: number };
}
```

Sandbox 定义的会话事件：

```typescript
export interface SandboxEvents {
  'session:created': { session: SandboxSession; timestamp: number };
  'session:terminated': { session: SandboxSession; timestamp: number };
  'operation:recorded': { context: SandboxOperationContext; timestamp: number };
  'permission:denied': {
    sessionId: string;
    operation: UIOperationType;
    reason: string;
    timestamp: number;
  };
}
```

### 2.6 事件载荷格式

所有事件遵循统一的 `KernelEvent<T>` 结构：

```typescript
interface KernelEvent<T = unknown> {
  type: string; // 事件类型名称
  data: T; // 事件载荷数据
  timestamp: number; // 事件触发时间戳（毫秒）
  source?: string; // 事件来源标识
}
```

**JSON 示例：**

```json
{
  "type": "plugin:register",
  "data": {
    "name": "core-conversation",
    "version": "1.0.0",
    "description": "Core conversation plugin for text-based interaction"
  },
  "timestamp": 1719876543210,
  "source": "kernel"
}
```

### 2.7 订阅管理

EventBus 提供完整的订阅生命周期管理：

```typescript
// 精确订阅
const sub = eventBus.on('kernel:start', event => {
  console.log(`Kernel started: ${event.data.name}`);
});

// 通配符订阅
const wildcardSub = eventBus.onWildcard('plugin:*', event => {
  console.log(`Plugin event: ${event.type}`);
});

// 一次性订阅
eventBus.once('kernel:init', event => {
  console.log('Kernel initialized once');
});

// 取消订阅
sub.unsubscribe(); // 内部调用 off()
wildcardSub.unsubscribe(); // 内部调用 offWildcard()

// 移除所有监听器
eventBus.removeAllListeners(); // 移除全部
eventBus.removeAllListeners('kernel:start'); // 移除特定事件

// 查询
eventBus.listenerCount('kernel:init'); // 监听器数量
eventBus.eventTypes(); // 所有已注册事件类型
```

### 2.8 错误处理

每个监听器回调都被 `try/catch` 包裹，单个监听器的异常不会影响其他监听器的执行：

```typescript
// 异步模式下的错误隔离
for (const listener of listeners!) {
  try {
    listener(event);
  } catch (error) {
    this.logger.error(`Error in event listener for ${type}:`, error);
  }
}
```

---

## 3. AgentChannel 协议（Agent 通信）

AgentChannel 位于 `packages/agent/src/communication/AgentChannel.ts`，提供 Agent 之间的双向通信通道。

### 3.1 双向通道设计

```
┌──────────────────────────────────────────────────┐
│                  AgentChannel                     │
│                                                   │
│  ┌─────────────┐    ┌──────────────┐             │
│  │  handlers   │    │ subscriptions│             │
│  │ (action→fn) │    │  (filter→fn) │             │
│  └──────┬──────┘    └──────┬───────┘             │
│         │                  │                      │
│  ┌──────▼──────────────────▼───────┐             │
│  │       handleMessage()            │             │
│  │  ┌──────────────────────────┐   │             │
│  │  │ 1. 检查过期              │   │             │
│  │  │ 2. 检查 pendingRequest   │   │             │
│  │  │ 3. 查找 handler          │   │             │
│  │  │ 4. 执行 handler          │   │             │
│  │  │ 5. 发送 response/error   │   │             │
│  │  └──────────────────────────┘   │             │
│  └─────────────────────────────────┘             │
│                                                   │
│  ┌─────────────┐    ┌──────────────┐             │
│  │send/sendWith│    │sendAndWait() │             │
│  │Retry()      │    │  (req-res)   │             │
│  └─────────────┘    └──────────────┘             │
│  ┌─────────────┐    ┌──────────────┐             │
│  │ publish()   │    │ subscribe()  │             │
│  │  (pub/sub)  │    │              │             │
│  └─────────────┘    └──────────────┘             │
└──────────────────────────────────────────────────┘
```

### 3.2 通道建立与释放

```typescript
// 通道配置
interface AgentChannelConfig {
  channelId?: string; // 通道标识符
  agentId: string; // 所属 Agent 标识
  defaultTimeout?: number; // 默认超时（默认 5000ms）
  maxRetries?: number; // 最大重试次数（默认 3）
  retryDelayBase?: number; // 重试延迟基数（默认 100ms）
  persistMessages?: boolean; // 是否持久化消息（默认 false）
}

// 默认配置
const DEFAULT_CHANNEL_CONFIG = {
  channelId: `channel_${Date.now()}`,
  agentId: 'unknown',
  defaultTimeout: 5000,
  maxRetries: 3,
  retryDelayBase: 100,
  persistMessages: false,
};
```

**创建通道：**

```typescript
// 基础创建
const channel = new AgentChannel({ agentId: 'agent-001' });

// 带预设 handler 创建
const channel = createAgentChannel('agent-001', {
  [MessageAction.EXECUTE]: async msg => {
    /* ... */
  },
  [MessageAction.QUERY]: async msg => {
    /* ... */
  },
});
```

**释放通道：**

```typescript
channel.dispose();
// 执行：清除所有 pending 请求 → 清除订阅 → 清除 handler → 清空历史 → 移除所有监听器
```

### 3.3 消息序列化格式

AgentChannel 使用 `AgentMessage` 作为标准消息格式（详见第 4 节）。

### 3.4 Request-Response 模式

```
Agent A (Channel)              Agent B (Channel)
      │                              │
      │  sendAndWait(msg)            │
      │  ┌──────────────────────┐    │
      │  │ 1. 保存 correlationId│    │
      │  │ 2. 设置超时定时器    │    │
      │  │ 3. 存入 pendingReqs  │    │
      │  └──────────────────────┘    │
      │                              │
      │─────── send(msg) ──────────▶│
      │                              │ handleMessage(msg)
      │                              │ ├─ 检查 deliveryMode
      │                              │ ├─ 执行 handler
      │                              │ └─ 创建 response
      │                              │
      │◀────── response ────────────│
      │                              │
      │ handleMessage(response)      │
      │ ├─ 匹配 correlationId       │
      │ ├─ 清除超时定时器            │
      │ ├─ resolve(response.payload) │
      │ └─ 删除 pendingRequest      │
      │                              │
```

**代码实现：**

```typescript
async sendAndWait<R = unknown>(
  message: AgentMessage,
  options?: { timeout?: number; maxRetries?: number }
): Promise<R> {
  const timeout = options?.timeout ?? this.config.defaultTimeout;
  const correlationId = message.metadata?.correlationId ?? message.id;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      this.pendingRequests.delete(correlationId);
      reject(new Error(`Request timed out after ${timeout}ms`));
    }, timeout);

    this.pendingRequests.set(correlationId, {
      resolve, reject, timeout: timer,
      retries: options?.maxRetries ?? this.config.maxRetries,
    });

    this.send(message).catch(error => {
      clearTimeout(timer);
      this.pendingRequests.delete(correlationId);
      reject(error);
    });
  });
}
```

### 3.5 超时处理

- 默认超时：`5000ms`（可通过 `AgentChannelConfig.defaultTimeout` 配置）
- 每次 `sendAndWait` 调用可单独设置超时
- 超时后自动清除 `pendingRequest` 并 reject Promise

### 3.6 通道生命周期事件

| 事件           | 触发时机   | 数据           |
| -------------- | ---------- | -------------- |
| `message:sent` | 消息发送后 | `AgentMessage` |

---

## 4. AgentMessage 协议（消息格式）

AgentMessage 位于 `packages/agent/src/communication/AgentMessage.ts`，定义了 Agent 间通信的标准消息格式。

### 4.1 消息结构

```typescript
interface AgentMessage<T = unknown> {
  id: string; // 唯一消息标识符
  source: string; // 源 Agent 标识符
  target: string; // 目标 Agent 标识符（或 '*' 表示广播）
  action: MessageAction; // 消息动作类型
  payload: T; // 消息载荷
  priority: MessagePriority; // 消息优先级
  deliveryMode: DeliveryMode; // 投递模式
  timestamp: number; // 创建时间戳
  expiresAt?: number; // 过期时间（可选）
  metadata?: MessageMetadata; // 元数据
  error?: MessageError; // 错误信息（仅 error 消息）
}
```

**完整 JSON 示例：**

```json
{
  "id": "msg_1719876543210_a1b2c3d4e5",
  "source": "agent-001",
  "target": "agent-002",
  "action": "execute",
  "payload": {
    "task": "analyze_repository",
    "parameters": {
      "path": "/workspace/my-project",
      "depth": 3
    }
  },
  "priority": 1,
  "deliveryMode": "request_response",
  "timestamp": 1719876543210,
  "expiresAt": 1719876548210,
  "metadata": {
    "correlationId": "msg_1719876543210_a1b2c3d4e5",
    "replyTo": "agent-001",
    "ttl": 5000,
    "flags": ["persistent"],
    "headers": {
      "x-request-id": "req-12345",
      "x-trace-id": "trace-abcde"
    }
  }
}
```

### 4.2 消息动作类型

```typescript
enum MessageAction {
  EXECUTE = 'execute', // 执行任务
  QUERY = 'query', // 查询信息
  RESPONSE = 'response', // 响应消息
  SUBSCRIBE = 'subscribe', // 订阅事件
  NOTIFY = 'notify', // 通知事件
  HEARTBEAT = 'heartbeat', // 心跳检测
  ERROR = 'error', // 错误响应
}
```

### 4.3 优先级

```typescript
enum MessagePriority {
  HIGH = 0, // 最高优先级，优先处理
  NORMAL = 1, // 默认优先级
  LOW = 2, // 最低优先级
}
```

### 4.4 投递模式

```typescript
enum DeliveryMode {
  ONE_WAY = 'one_way', // 发后即忘（Fire and Forget）
  REQUEST_RESPONSE = 'request_response', // 请求-响应模式
  BROADCAST = 'broadcast', // 广播模式（发布到多个订阅者）
}
```

### 4.5 元数据结构

```typescript
interface MessageMetadata {
  correlationId?: string; // 关联 ID，用于请求-响应匹配
  replyTo?: string; // 回复地址
  ttl?: number; // 生存时间（毫秒）
  flags?: MessageFlag[]; // 消息标志
  headers?: Record<string, string>; // 自定义头部
}

enum MessageFlag {
  PERSISTENT = 'persistent', // 持久化消息
  REDELIVER = 'redeliver', // 重新投递标记
  PRIORITY = 'priority', // 优先级标记
  BATCH = 'batch', // 批量消息标记
}
```

### 4.6 错误结构

```typescript
interface MessageError {
  code: string; // 错误代码
  message: string; // 错误描述
  details?: unknown; // 错误详情
}
```

**Error 消息示例：**

```json
{
  "id": "msg_1719876543210_err1",
  "source": "agent-002",
  "target": "agent-001",
  "action": "error",
  "payload": null,
  "priority": 0,
  "deliveryMode": "one_way",
  "timestamp": 1719876543500,
  "metadata": {
    "correlationId": "msg_1719876543210_a1b2c3d4e5",
    "headers": {
      "x-error-details": "{\"reason\":\"permission_denied\",\"resource\":\"/etc/passwd\"}"
    }
  },
  "error": {
    "code": "CHANNEL_ERROR",
    "message": "Permission denied: cannot access /etc/passwd"
  }
}
```

### 4.7 消息工厂函数

| 函数                                                                | 用途         | 默认 deliveryMode  |
| ------------------------------------------------------------------- | ------------ | ------------------ |
| `createAgentMessage(options)`                                       | 创建通用消息 | `REQUEST_RESPONSE` |
| `createExecuteMessage(source, target, payload)`                     | 创建执行消息 | `REQUEST_RESPONSE` |
| `createQueryMessage(source, target, payload)`                       | 创建查询消息 | `REQUEST_RESPONSE` |
| `createResponseMessage(source, target, payload, correlationId)`     | 创建响应消息 | `REQUEST_RESPONSE` |
| `createHeartbeatMessage(source, target, stats?)`                    | 创建心跳消息 | `ONE_WAY`          |
| `createNotifyMessage(source, target, event, data?)`                 | 创建通知消息 | `BROADCAST`        |
| `createErrorMessage(source, target, code, message, correlationId?)` | 创建错误消息 | `REQUEST_RESPONSE` |

### 4.8 消息验证

```typescript
function isValidMessage(message: unknown): message is AgentMessage {
  if (!message || typeof message !== 'object') return false;
  const msg = message as AgentMessage;
  return (
    typeof msg.id === 'string' &&
    typeof msg.source === 'string' &&
    typeof msg.target === 'string' &&
    Object.values(MessageAction).includes(msg.action) &&
    msg.payload !== undefined &&
    Object.values(MessagePriority).includes(msg.priority) &&
    Object.values(DeliveryMode).includes(msg.deliveryMode) &&
    typeof msg.timestamp === 'number'
  );
}
```

### 4.9 消息过期检查

```typescript
function isMessageExpired(message: AgentMessage): boolean {
  if (!message.expiresAt) return false;
  return Date.now() > message.expiresAt;
}
```

---

## 5. MessageQueue 协议（消息队列）

MessageQueue 位于 `packages/agent/src/communication/MessageQueue.ts`，提供基于优先级的消息队列管理。

### 5.1 队列结构

```
┌─────────────────────────────────────────────────────┐
│                    MessageQueue                      │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  Priority Queue (sorted by priority)          │   │
│  │  ┌──────┬──────┬──────┬──────┬──────┐        │   │
│  │  │HIGH 0│HIGH 0│NORM 1│NORM 1│LOW 2 │  ...   │   │
│  │  └──────┴──────┴──────┴──────┴──────┘        │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  Dead Letter Queue (max 100)                  │   │
│  │  ┌──────────┬──────────┐                      │   │
│  │  │ expired  │ rejected │  ...                 │   │
│  │  └──────────┴──────────┘                      │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  QueueEntry: {                                       │
│    message: AgentMessage,                            │
│    enqueuedAt: number,                               │
│    attemptCount: number,                             │
│    priority: MessagePriority                         │
│  }                                                   │
└─────────────────────────────────────────────────────┘
```

### 5.2 队列配置

```typescript
interface MessageQueueConfig {
  maxSize?: number; // 最大队列大小（默认 1000）
  defaultTTL?: number; // 默认消息 TTL（默认 30000ms）
  enableDeadLetter?: boolean; // 启用死信队列（默认 true）
  deadLetterMaxSize?: number; // 死信队列最大大小（默认 100）
  persistMessages?: boolean; // 启用消息持久化（默认 false）
}

const DEFAULT_QUEUE_CONFIG = {
  maxSize: 1000,
  defaultTTL: 30000,
  enableDeadLetter: true,
  deadLetterMaxSize: 100,
  persistMessages: false,
};
```

### 5.3 入队操作

入队时按优先级插入（数字越小优先级越高）：

```
enqueue(msg)
  │
  ├─ 检查队列是否已满（≥ maxSize）
  │   ├─ 是 → emit('queue:full') → 返回 false
  │   └─ 否 → 继续
  │
  ├─ 创建 QueueEntry { message, enqueuedAt, attemptCount: 0, priority }
  │
  ├─ 按优先级查找插入位置
  │   └─ findIndex(e => e.priority > entry.priority)
  │
  ├─ 插入队列
  ├─ stats.size++, stats.enqueuedCount++
  └─ emit('message:enqueued')
```

### 5.4 出队操作

出队时自动跳过过期消息，将其移入死信队列：

```
dequeue()
  │
  ├─ while 队列非空:
  │   ├─ shift 第一个元素
  │   ├─ 检查是否过期
  │   │   ├─ 是 → stats.expiredCount++ → handleDeadLetter('EXPIRED') → continue
  │   │   └─ 否 → stats.dequeuedCount++ → 返回 message
  │   └─
  └─ emit('queue:empty') → 返回 null
```

### 5.5 死信队列

死信队列自动处理无法正常投递的消息：

```typescript
// 死信消息进入死信队列时，自动添加元数据
const deadLetter = {
  ...message,
  metadata: {
    ...message.metadata,
    headers: {
      ...message.metadata?.headers,
      'x-dead-letter-reason': reason, // 进入死信的原因
      'x-dead-letter-at': String(Date.now()), // 进入死信的时间
    },
  },
};
```

**死信重试：**

```typescript
retryDeadLetter(messageId: string): boolean {
  const index = this.deadLetterQueue.findIndex(m => m.id === messageId);
  if (index === -1) return false;
  const message = this.deadLetterQueue.splice(index, 1)[0];
  return this.enqueue(message); // 重新入队
}
```

### 5.6 消息过滤

```typescript
interface QueueFilter {
  source?: string; // 按源过滤
  target?: string; // 按目标过滤
  action?: string; // 按动作类型过滤
  minPriority?: MessagePriority; // 最小优先级
  maxPriority?: MessagePriority; // 最大优先级
}

// 示例：过滤来自 agent-001 的 HIGH 优先级 EXECUTE 消息
queue.filter({
  source: 'agent-001',
  action: 'execute',
  minPriority: MessagePriority.HIGH,
  maxPriority: MessagePriority.HIGH,
});
```

### 5.7 自动处理

```typescript
// 启动自动过期清理（每秒检查一次）
queue.startProcessing(1000);

// 停止自动处理
queue.stopProcessing();
```

### 5.8 队列统计

```typescript
interface QueueStats {
  size: number; // 当前队列大小
  enqueuedCount: number; // 累计入队数
  dequeuedCount: number; // 累计出队数
  expiredCount: number; // 累计过期数
  deadLetterCount: number; // 累计死信数
}
```

### 5.9 投递保证

| 保证级别          | 说明                                                            |
| ----------------- | --------------------------------------------------------------- |
| **At-Most-Once**  | 默认模式，消息可能因过期或队列满而丢失                          |
| **At-Least-Once** | 通过死信重试机制实现，过期消息可重试                            |
| **Persistent**    | 通过 `MessageFlag.PERSISTENT` 标志和 `persistMessages` 配置实现 |

### 5.10 重试策略

消息重试通过 AgentChannel 的 `sendWithRetry` 实现，采用指数退避：

```typescript
async sendWithRetry(message, options?) {
  const maxRetries = options?.maxRetries ?? this.config.maxRetries; // 默认 3
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      await this.send(message);
      return;
    } catch (error) {
      attempt++;
      if (attempt > maxRetries) throw error;
      const delay = this.config.retryDelayBase * Math.pow(2, attempt - 1);
      // 延迟: 100ms, 200ms, 400ms
      await this.sleep(delay);
    }
  }
}
```

---

## 6. Plugin 通信协议

### 6.1 Plugin ↔ Kernel 通信

Plugin 通过 `PluginContext.kernel` 获取 `KernelApi` 接口，实现与 Kernel 的通信：

```
┌──────────┐  PluginContext.kernel (KernelApi)  ┌──────────┐
│  Plugin  │ ◀─────────────────────────────────▶ │  Kernel  │
└──────────┘                                     └──────────┘
```

**KernelApi 接口：**

```typescript
interface KernelApi {
  getConfig(): KernelConfig; // 获取 Kernel 配置
  getVersion(): string; // 获取 Kernel 版本
  text: TextServiceInterface; // 文本输出服务
  info: InfoServiceInterface; // 系统信息服务
  registerPlugin(plugin: PluginInterface): Promise<void>; // 注册插件
  unregisterPlugin(name: string): Promise<void>; // 注销插件
  getPlugin(name: string): PluginInterface | undefined; // 获取插件
  listPlugins(): PluginInterface[]; // 列出所有插件
  executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult>; // 执行工具
}
```

**TextService 接口（文本输出）：**

```typescript
interface TextServiceInterface {
  print(text: string): void;
  println(text?: string): void;
  formatTable(data: unknown): string;
  formatList(items: string[]): string;
  formatSection(title: string, content: string): string;
  styled(text: string, style: unknown): string;
  success(text: string): string;
  error(text: string): string;
  warning(text: string): string;
  info(text: string): string;
  createStream(): unknown;
  progress(current: number, total: number, message?: string): string;
  spinner(type?: string): unknown;
}
```

**InfoService 接口（系统信息）：**

```typescript
interface InfoServiceInterface {
  getConfig(key: string): unknown;
  getAllConfigs(): Record<string, unknown>;
  getRuntimeInfo(): unknown;
  getProjectContext(): unknown;
  getProjectRoot(): string;
  getProjectName(): string;
  getProjectVersion(): string;
  getSystemInfo(): unknown;
  getPlatformInfo(): unknown;
  getEnv(key: string): string | undefined;
  getAllEnvs(): Record<string, string>;
}
```

### 6.2 Plugin ↔ Plugin 通信

Plugin 之间通过 `KernelApi.getPlugin(name)` 获取其他 Plugin 实例，然后直接调用其 `execute()` 方法：

```
┌──────────┐  kernel.getPlugin('plugin-b').execute(input)  ┌──────────┐
│ Plugin A │ ────────────────────────────────────────────▶ │ Plugin B │
└──────────┘                                               └──────────┘
```

Plugin 间通信也支持通过 EventBus 进行发布/订阅模式：

```
┌──────────┐  eventBus.emit('plugin:custom-event', data)  ┌──────────┐
│ Plugin A │ ────────────────────────────────────────────▶ │ Plugin B │
└──────────┘    (通过 kernel.getEventBus() 获取)           └──────────┘
```

### 6.3 PluginContext 接口

```typescript
interface PluginContext {
  kernel: KernelApi; // Kernel API 接口
  config: PluginConfig; // Plugin 配置
}

interface PluginConfig {
  name: string; // Plugin 名称
  enabled: boolean; // 是否启用
  options?: Record<string, unknown>; // 自定义配置项
}
```

### 6.4 PluginInterface 接口

```typescript
interface PluginInterface {
  readonly name: string;
  readonly version: string;
  readonly description?: string;

  initialize(context: PluginContext): Promise<InitializeResult>;
  execute(input: PluginInput): Promise<PluginOutput>;
  shutdown(): Promise<void>;
}
```

**扩展接口（带元数据）：**

```typescript
interface PluginInterface extends BasePluginInterface {
  getMetadata(): PluginMetadata;
  validateConfig?(config: Record<string, unknown>): Promise<ValidateResult>;
}
```

### 6.5 PluginInput/PluginOutput 格式

**PluginInput：**

```typescript
interface PluginInput {
  action: string; // 执行的动作名称
  params?: Record<string, unknown>; // 动作参数
}
```

**PluginOutput：**

```typescript
interface PluginOutput {
  success: boolean; // 是否成功
  data?: unknown; // 成功时的返回数据
  error?: string; // 失败时的错误信息
}
```

**JSON 示例：**

```json
// PluginInput
{
  "action": "executeTool",
  "params": {
    "name": "file_search",
    "params": { "pattern": "*.ts", "path": "/workspace" },
    "requestId": "req_1719876543210_1"
  }
}

// PluginOutput (成功)
{
  "success": true,
  "data": {
    "files": ["src/index.ts", "src/utils.ts"],
    "count": 2
  }
}

// PluginOutput (失败)
{
  "success": false,
  "error": "Tool file_search not found"
}
```

### 6.6 InitializeResult

```typescript
interface InitializeResult {
  success: boolean; // 初始化是否成功
  error?: string; // 失败时的错误信息
}
```

### 6.7 Plugin 生命周期状态

```typescript
enum PluginLifecycleState {
  DISCOVERED = 'discovered', // 已发现
  RESOLVED = 'resolved', // 已解析依赖
  LOADING = 'loading', // 加载中
  INITIALIZED = 'initialized', // 已初始化
  ACTIVE = 'active', // 已激活
  RUNNING = 'running', // 运行中
  SHUTTING_DOWN = 'shutting_down', // 关闭中
  SHUTDOWN = 'shutdown', // 已关闭
  ERROR = 'error', // 错误状态
  UNLOADED = 'unloaded', // 已卸载
}
```

### 6.8 Plugin 元数据

```typescript
interface PluginMetadata {
  readonly id: string; // 唯一标识符
  readonly name: string; // 名称
  readonly version: string; // 版本（semver）
  readonly description?: string; // 描述
  readonly apiVersion: string; // 兼容的 API 版本
  readonly minKernelVersion?: string; // 最低 Kernel 版本
  readonly dependencies?: PluginDependency[]; // 插件依赖
  readonly defaultConfig?: Record<string, unknown>; // 默认配置
  readonly hooks?: PluginHooks; // 生命周期钩子
  readonly author?: string; // 作者
}
```

---

## 7. Tool 通信协议

### 7.1 工具执行请求格式

工具通过 Plugin 的 `execute` 方法调用，使用特定的 action 名称：

```json
{
  "action": "executeTool",
  "params": {
    "name": "file_search",
    "params": {
      "pattern": "*.ts",
      "path": "/workspace"
    },
    "requestId": "req_1719876543210_1"
  }
}
```

### 7.2 ToolResult 格式

```typescript
interface ToolResult {
  success: boolean; // 执行是否成功
  data?: unknown; // 执行结果数据
  error?: ToolError; // 错误信息
  metadata: {
    tool_name: string; // 工具名称
    start_time: number; // 开始时间戳
    end_time: number; // 结束时间戳
    execution_time: number; // 执行耗时（毫秒）
    request_id: string; // 请求标识
  };
}
```

**JSON 示例（成功）：**

```json
{
  "success": true,
  "data": {
    "files": ["src/index.ts", "src/utils.ts", "src/types.ts"],
    "count": 3
  },
  "metadata": {
    "tool_name": "file_search",
    "start_time": 1719876543210,
    "end_time": 1719876543250,
    "execution_time": 40,
    "request_id": "req_1719876543210_1"
  }
}
```

### 7.3 ToolError 格式

```typescript
interface ToolError {
  code: ToolErrorCode; // 错误代码
  message: string; // 错误描述
  details?: unknown; // 错误详情
}

enum ToolErrorCode {
  INVALID_ARGUMENTS = 'invalid_arguments', // 参数无效
  PERMISSION_DENIED = 'permission_denied', // 权限不足
  TOOL_NOT_FOUND = 'tool_not_found', // 工具未找到
  TIMEOUT = 'timeout', // 执行超时
  EXECUTION_ERROR = 'execution_error', // 执行错误
  RESOURCE_EXHAUSTED = 'resource_exhausted', // 资源耗尽
  TOOL_DISABLED = 'tool_disabled', // 工具已禁用
}
```

**JSON 示例（错误）：**

```json
{
  "success": false,
  "error": {
    "code": "permission_denied",
    "message": "Access denied to /etc/passwd",
    "details": {
      "resource": "/etc/passwd",
      "required_permission": "filesystem:read"
    }
  },
  "metadata": {
    "tool_name": "file_read",
    "start_time": 1719876543210,
    "end_time": 1719876543211,
    "execution_time": 1,
    "request_id": "req_1719876543210_2"
  }
}
```

### 7.4 工具定义格式

```typescript
interface ToolDefinition {
  name: string; // 工具名称
  version: string; // 工具版本
  description: string; // 功能描述
  type: ToolType; // 工具类别
  call_level: ToolCallLevel; // 调用级别
  parameters: ToolParameterDefinition; // 参数定义
  permissions?: string[]; // 所需权限
  max_execution_time?: number; // 最大执行时间
  max_memory?: number; // 最大内存使用
}

interface ToolParameterDefinition {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required: string[];
  additionalProperties: boolean;
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}
```

### 7.5 工具执行上下文

```typescript
interface ToolExecutionContext {
  request_id: string; // 请求标识
  caller_plugin_id: string; // 调用方 Plugin ID
  caller_plugin_name: string; // 调用方 Plugin 名称
  timestamp: number; // 执行时间戳
  logger: Logger; // 日志实例
}
```

### 7.6 安全审批流程

工具执行通过 `SecurityGuard` 进行权限检查：

```
Tool Execute Request
      │
      ▼
┌─────────────┐
│ SecurityGuard│── 检查权限预设
└──────┬──────┘
       │
   ┌───▼───┐
   │允许？  │
   └───┬───┘
       │
  ┌────┴────┐
  │         │
 是        否
  │         │
  ▼         ▼
执行    返回 PERMISSION_DENIED
```

ToolService 事件流：

```
execution:start  ──▶ 执行中  ──▶ execution:complete
                            ──▶ execution:error
```

---

## 8. Storage 通信协议

### 8.1 CRUD 操作格式

所有 CRUD 操作通过 `StorageService` 统一接口：

```typescript
// 创建实体
create(type: string, data: Record<string, unknown>, options?: {
  id?: string;
  metadata?: EntityMetadata;
}): Promise<CreateResult>;

// 读取实体
read(id: string): Promise<StorageEntity | null>;

// 更新实体
update(id: string, data: Partial<Record<string, unknown>>, updatedBy?: string): Promise<UpdateResult>;

// 删除实体
delete(id: string): Promise<DeleteResult>;
```

**操作结果格式：**

```typescript
interface CreateResult {
  success: boolean;
  entity?: StorageEntity;
  error?: string;
}
interface UpdateResult {
  success: boolean;
  error?: string;
}
interface DeleteResult {
  success: boolean;
  error?: string;
}
```

### 8.2 查询过滤器格式

```typescript
interface QueryFilter {
  where?: Record<string, unknown>; // AND 条件
  orWhere?: Record<string, unknown>; // OR 条件
  orderBy?: OrderSpec[]; // 排序规则
  limit?: number; // 限制数量
  offset?: number; // 偏移量
  include?: string[]; // 包含字段
  exclude?: string[]; // 排除字段
  createdAfter?: number; // 创建时间下限
  createdBefore?: number; // 创建时间上限
  updatedAfter?: number; // 更新时间下限
  updatedBefore?: number; // 更新时间上限
}

interface OrderSpec {
  field: string;
  direction: 'asc' | 'desc';
}
```

**JSON 示例：**

```json
{
  "where": { "type": "session", "status": "active" },
  "orderBy": [{ "field": "created_at", "direction": "desc" }],
  "limit": 10,
  "offset": 0,
  "createdAfter": 1719876543210
}
```

### 8.3 事务协议

```typescript
interface Transaction {
  id: string; // 事务 ID
  startTime: number; // 开始时间
  isolation: IsolationLevel; // 隔离级别
  status: TransactionStatus; // 事务状态
}

enum IsolationLevel {
  READ_UNCOMMITTED = 'read_uncommitted',
  READ_COMMITTED = 'read_committed',
  REPEATABLE_READ = 'repeatable_read',
  SERIALIZABLE = 'serializable',
}

enum TransactionStatus {
  ACTIVE = 'active',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled_back',
  EXPIRED = 'expired',
}

interface TransactionOptions {
  isolation?: IsolationLevel;
  timeout?: number;
  retryOnConflict?: boolean;
}
```

**事务操作流程：**

```
begin_transaction() → 操作1 → 操作2 → ... → commit_transaction()
                                             → rollback_transaction()
```

### 8.4 批量操作格式

```typescript
// 批量创建
batchCreate(entities: StorageEntity[]): Promise<BatchCreateResult>;
// 批量更新
batchUpdate(updates: UpdateOperation[]): Promise<BatchUpdateResult>;
// 批量删除
batchDelete(ids: string[]): Promise<BatchDeleteResult>;

interface UpdateOperation {
  id: string;
  data: Partial<StorageEntity>;
}

interface BatchCreateResult {
  success: boolean;
  created: StorageEntity[];
  failed: { entity: StorageEntity; error: string }[];
}

interface BatchUpdateResult {
  success: boolean;
  updated: number;
  failed: { id: string; error: string }[];
}

interface BatchDeleteResult {
  success: boolean;
  deleted: number;
  failed: { id: string; error: string }[];
}
```

### 8.5 存储实体格式

```typescript
interface StorageEntity {
  id: string; // 唯一标识符
  type: string; // 实体类型
  data: Record<string, unknown>; // 实体数据
  metadata: EntityMetadata; // 实体元数据
  created_at: number; // 创建时间戳
  updated_at: number; // 更新时间戳
  version: number; // 版本号（冲突检测）
}
```

### 8.6 存储后端接口

```typescript
interface IStorageBackend {
  initialize(): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;
  get(id: string): Promise<StorageEntity | null>;
  set(entity: StorageEntity): Promise<void>;
  delete(id: string): Promise<boolean>;
  has(id: string): Promise<boolean>;
  getAll(): Promise<StorageEntity[]>;
  getByType(type: string): Promise<StorageEntity[]>;
  query(filter: Record<string, unknown>): Promise<StorageEntity[]>;
  clear(): Promise<void>;
  count(): Promise<number>;
  getInfo(): StorageBackendInfo;
}
```

支持三种后端类型：`MemoryStorage`、`FileStorage`、`DatabaseStorage`。

---

## 9. UI 通信协议

### 9.1 CLI 命令解析

CLI 通过 `CommandParser` 解析用户输入：

```
用户输入: "plugin install my-plugin --verbose"
                │
                ▼
         CommandParser.parse()
                │
                ▼
┌─────────────────────────────────┐
│ {                               │
│   command: "plugin",            │
│   args: { "install": "my-plugin" },│
│   options: { "verbose": true }, │
│   raw: ["install", "my-plugin"] │
│ }                               │
└─────────────────────────────────┘
                │
                ▼
         CLI.executeCommand()
                │
                ▼
         Command.handler(args, logger)
```

**命令结果格式：**

```typescript
interface CommandResult {
  success: boolean;
  code: number;
  message?: string;
  error?: string;
}
```

### 9.2 UIOperation 格式

```typescript
type UIOperationType =
  | 'click'
  | 'input'
  | 'select'
  | 'scroll'
  | 'hover'
  | 'wait'
  | 'getText'
  | 'getAttribute'
  | 'screenshot';

interface UIOperationResult<T = unknown> {
  operationId: string;
  type: UIOperationType;
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
  status: UIOperationStatus; // 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface UIOperationInput {
  selector: string; // 目标选择器
  options?: UIOperationOptions;
}

interface UIOperationOptions {
  timeout?: number;
  retry?: number;
  waitForVisible?: boolean;
  waitForEnabled?: boolean;
  position?: { x: number; y: number };
  clickType?: 'left' | 'right' | 'double';
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  delay?: number;
}
```

**各操作的输入类型：**

```typescript
interface ClickInput extends UIOperationInput {
  clickType?: 'left' | 'right' | 'double';
  position?: { x: number; y: number };
}

interface InputInput extends UIOperationInput {
  value: string;
  append?: boolean;
  clear?: boolean;
}

interface SelectInput extends UIOperationInput {
  value: string | string[];
  by?: 'value' | 'label' | 'index';
}

interface ScrollInput extends UIOperationInput {
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
}
```

### 9.3 Sandbox ↔ Agent 通信

```
┌──────────┐  createSession(agentId)    ┌──────────┐
│  UIAgent │ ──────────────────────────▶│ Sandbox  │
│          │◀──── SandboxSession ───────│          │
│          │                             │          │
│          │  checkPermission(operation) │          │
│          │ ──────────────────────────▶│          │
│          │◀── PermissionCheckResult ───│          │
│          │                             │          │
│          │  recordOperation(context)   │          │
│          │ ──────────────────────────▶│          │
│          │                             │          │
│          │  terminateSession(id)       │          │
│          │ ──────────────────────────▶│          │
└──────────┘                             └──────────┘
```

**SandboxSession：**

```typescript
interface SandboxSession {
  sessionId: string;
  agentId: string;
  startTime: number;
  endTime?: number;
  operationCount: number;
  permissionLevel: UIPermissionLevel;
  status: SandboxSessionStatus; // 'active' | 'terminated' | 'expired'
}
```

**权限检查结果：**

```typescript
interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation: boolean;
  warnings: string[];
}
```

### 9.4 终端 I/O 协议

CLI 支持交互式 REPL 模式，使用 `readline` 接口：

```typescript
// 交互式模式启动
await cli.startInteractive();

// 读行循环
rl.on('line', async (line: string) => {
  const args = line.trim().split(/\s+/);
  const result = await cli.run(args);
  // 输出 formatted result
});
```

支持终端特性检测：颜色深度、鼠标支持、Unicode 支持、交替屏幕缓冲区、光标控制。

**操作审计日志：**

```typescript
interface OperationLog {
  log_id: string;
  agent_id: string;
  operation_type: string;
  target_selector: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed';
  before_state: object;
  after_state: object;
  error_message?: string;
  timestamp: Date;
}
```

---

## 10. 跨包通信

### 10.1 包依赖方向

```
@organic/utils        (无依赖，基础类型和工具)
       │
       ▼
@organic/kernel       (依赖 @organic/utils)
       │
       ├──────────────┬──────────────┬──────────────┐
       ▼              ▼              ▼              ▼
@organic/plugins  @organic/tools  @organic/storage  @organic/agent
(@organic/utils,  (@organic/utils, (@organic/utils,  (@organic/utils,
 @organic/kernel)  @organic/kernel)  @organic/kernel)  @organic/kernel,
                                                        @organic/plugins,
                                                        @organic/tools)
                                                              │
                                                              ▼
                                                       @organic/ui
                                                       (所有包)
```

### 10.2 API 契约

所有跨包通信通过 `@organic/utils` 导出的共享类型进行契约约束：

| 包                 | 对外暴露的契约接口                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@organic/utils`   | `KernelApi`, `PluginInterface`, `PluginContext`, `PluginInput`, `PluginOutput`, `ToolResult`, `ToolError`, `KernelConfig`, `PluginConfig`, `BaseError`, `Result`, `Logger` |
| `@organic/kernel`  | `Kernel`, `EventBus`, `KernelEvents`, `PluginManager`, `LifecycleManager`, `LifecycleState`                                                                                |
| `@organic/agent`   | `AgentMessage`, `AgentChannel`, `MessageQueue`, `MessageAction`, `MessagePriority`, `DeliveryMode`                                                                         |
| `@organic/plugins` | `PluginLoader`, `PluginRegistry`, `BasePlugin`, `CoreConversationPlugin`, `PluginMetadata`, `PluginLifecycleState`                                                         |
| `@organic/tools`   | `ToolService`, `ToolExecutor`, `ToolContext`, `ToolDefinition`, `ToolExecutionContext`, `SecurityGuard`                                                                    |
| `@organic/storage` | `StorageService`, `StorageManager`, `StorageEntity`, `QueryFilter`, `Transaction`, `IStorageBackend`                                                                       |
| `@organic/ui`      | `CLI`, `UIAgent`, `Sandbox`, `UIOperationManager`, `UIOperationType`, `UIOperationResult`                                                                                  |

### 10.3 版本兼容性

所有包使用 `workspace:*` 进行内部依赖管理，确保 monorepo 内版本一致性。

Plugin 通过 `PluginMetadata.apiVersion` 和 `PluginMetadata.minKernelVersion` 声明兼容性：

```typescript
// Plugin 兼容性检查
async validateCompatibility(metadata: PluginMetadata): Promise<CompatibilityResult> {
  const issues: CompatibilityIssue[] = [];

  // 检查 Kernel 版本
  if (metadata.minKernelVersion) {
    issues.push({
      severity: 'warning',
      code: 'KERNEL_VERSION',
      message: `Plugin requires minimum kernel version ${metadata.minKernelVersion}`,
    });
  }

  // 检查依赖
  if (metadata.dependencies) {
    for (const dep of metadata.dependencies) {
      if (!this.cache.has(dep.pluginName) && !dep.optional) {
        issues.push({
          severity: 'error',
          code: 'MISSING_DEPENDENCY',
          message: `Required dependency not found: ${dep.pluginName} (${dep.versionRange})`,
        });
      }
    }
  }

  return { compatible: !issues.some(i => i.severity === 'error'), issues };
}
```

### 10.4 破坏性变更策略

兼容性问题通过 `CompatibilityIssue` 分级：

```typescript
interface CompatibilityIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}
```

- `error`：阻止加载，Plugin 不兼容
- `warning`：允许加载，但提示风险
- `info`：信息性提示

---

## 11. 错误处理协议

### 11.1 错误传播模式

```
执行层错误 → Plugin.execute() catch → PluginOutput.error
                                    → eventBus.emit('plugin:error')
                                    → AgentChannel 发送 ErrorMessage
                                    → 调用方 handlePendingResponse() reject
```

### 11.2 错误序列化格式

**BaseError（基础错误类）：**

```typescript
class BaseError extends Error {
  public readonly code: string; // 错误代码
  public readonly details?: unknown; // 错误详情
  public readonly timestamp: number; // 时间戳

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  toString(): string {
    return `[${this.code}] ${this.name}: ${this.message}`;
  }
}
```

**AgentMessage 错误格式：**

错误消息有特殊的 `error` 字段和 `MessageAction.ERROR` 动作：

```json
{
  "action": "error",
  "payload": null,
  "priority": 0,
  "error": {
    "code": "CHANNEL_ERROR",
    "message": "No handler registered for action: execute"
  },
  "metadata": {
    "correlationId": "msg_xxx",
    "headers": {
      "x-error-details": "{\"context\":\"additional_info\"}"
    }
  }
}
```

### 11.3 错误恢复协议

**AgentChannel 中的错误处理：**

```typescript
// handleMessage 中的错误恢复
try {
  const result = await handler(message);
  // 自动发送响应
  if (message.deliveryMode === 'request_response') {
    const response = createResponseMessage(/* ... */);
    await this.send(response);
  }
} catch (error) {
  // 自动发送错误响应
  if (message.deliveryMode === 'request_response') {
    const errorMsg = createErrorMessage(/* ... */);
    await this.send(errorMsg);
  }
  throw error;
}
```

**PluginManager 中的错误处理：**

```typescript
try {
  const result = await metadata.plugin.initialize(context);
  if (!result.success) {
    throw new Error(result.error ?? 'Plugin initialization failed');
  }
} catch (error) {
  this.eventBus.emit('plugin:error', {
    name,
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
```

### 11.4 超时和重试协议

| 场景                     | 默认超时                  | 默认重试                     | 退避策略                      |
| ------------------------ | ------------------------- | ---------------------------- | ----------------------------- |
| AgentChannel sendAndWait | 5000ms                    | 3 次                         | 指数退避：100ms, 200ms, 400ms |
| MessageQueue TTL         | 30000ms                   | 死信重试                     | 手动 retryDeadLetter()        |
| Tool 执行                | 配置项 max_execution_time | 取决于 ToolRetryConfig       | 可配置 backoffMultiplier      |
| UI 操作                  | 30000ms                   | 3 次                         | —                             |
| Plugin 初始化            | —                         | 取决于 ErrorHandlingStrategy | —                             |

**ToolRetryConfig：**

```typescript
interface ToolRetryConfig {
  maxAttempts: number; // 最大重试次数
  initialDelay: number; // 初始延迟
  maxDelay: number; // 最大延迟
  backoffMultiplier: number; // 退避乘数
  retryableErrors?: string[]; // 可重试的错误代码
}
```

---

## 12. 安全协议

### 12.1 认证流程

系统通过多层安全机制实现认证和授权：

```
请求进入
    │
    ▼
┌──────────────┐
│ Sandbox 检查  │── 域名/IP 白名单/黑名单
│ (网络层)     │── 路径白名单/黑名单
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 权限检查      │── 操作类型白名单/黑名单
│ (操作层)     │── 权限级别 (L1-L4)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ SecurityGuard │── 预设权限策略
│ (工具层)     │── 工具级权限检查
└──────┬───────┘
       │
       ▼
   执行 / 拒绝
```

### 12.2 权限检查

**Sandbox 权限级别：**

```typescript
type UIPermissionLevel = 'L1' | 'L2' | 'L3' | 'L4';
```

| 级别 | 说明                             |
| ---- | -------------------------------- |
| L1   | 最低权限，仅允许只读操作         |
| L2   | 默认级别，允许基本交互操作       |
| L3   | 高级权限，允许敏感操作（需确认） |
| L4   | 最高权限，沙箱中限制为 L3        |

**权限检查结果：**

```typescript
interface PermissionCheckResult {
  allowed: boolean; // 是否允许
  reason?: string; // 拒绝原因
  requiresConfirmation: boolean; // 是否需要确认
  warnings: string[]; // 警告信息
}
```

**Sandbox 默认拒绝路径：**

```typescript
deniedPaths: ['/etc', '/root', '/sys', '/proc', '/var'];
```

**敏感操作列表：**

```typescript
const SENSITIVE_OPERATIONS: UIOperationType[] = [
  // 需要额外确认的操作类型
];
```

### 12.3 审计日志格式

```typescript
interface AuditLog {
  id: string;
  actor: AuditActor; // 操作者
  action: AuditAction; // 动作
  resource: AuditResource; // 资源
  result: AuditResult; // 结果
  request?: AuditRequest; // 请求信息
  response?: AuditResponse; // 响应信息
  timestamp: number; // 时间戳
  session_id?: string; // 会话 ID
  correlation_id?: string; // 关联 ID
  metadata?: Record<string, any>;
}

interface AuditActor {
  id: string;
  type: PrincipalType;
  name: string;
  ip_address?: string;
  user_agent?: string;
}

interface AuditAction {
  type: string;
  description: string;
  category: AuditCategory;
}

enum AuditCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  RESOURCE_ACCESS = 'resource_access',
  CONFIG_CHANGE = 'config_change',
  SECURITY_POLICY = 'security_policy',
  ADMINISTRATION = 'administration',
  DATA_OPERATION = 'data_operation',
}

enum AuditStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  PENDING = 'pending',
}
```

**CLI 操作日志（OperationLog）：**

```typescript
interface OperationLog {
  log_id: string;
  agent_id: string;
  operation_type: string;
  target_selector: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed';
  before_state: object;
  after_state: object;
  error_message?: string;
  timestamp: Date;
}
```

### 12.4 沙箱隔离边界

```
┌──────────────────────────────────────────────────┐
│                   Sandbox Boundary                │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  允许的操作 (allowedOperations)              │ │
│  │  click, input, select, scroll, hover,       │ │
│  │  wait, getText, getAttribute, screenshot    │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  网络限制 (networkRestrictions)              │ │
│  │  - allowedMethods: HTTP methods             │ │
│  │  - maxRequestSize / maxResponseSize         │ │
│  │  - allowedHeaders / blockedHeaders          │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  拒绝的路径 (deniedPaths)                    │ │
│  │  /etc, /root, /sys, /proc, /var             │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  会话限制                                     │ │
│  │  - maxOperationDuration: 30000ms            │ │
│  │  - maxOperationsPerSession: 1000            │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**SandboxConfig 完整配置：**

```typescript
interface SandboxConfig {
  enabled: boolean;
  permissionLevel: UIPermissionLevel;
  allowedDomains: string[];
  deniedDomains: string[];
  allowedPaths: string[];
  deniedPaths: string[];
  allowedOperations: UIOperationType[];
  deniedOperations: UIOperationType[];
  maxOperationDuration: number;
  maxOperationsPerSession: number;
  enableRecording: boolean;
  requireConfirmation: boolean;
  networkRestrictions?: SandboxNetworkRestrictions;
}
```

---

## 附录 A：消息生成规则

| 字段                | 格式                           | 示例                           |
| ------------------- | ------------------------------ | ------------------------------ |
| `message.id`        | `msg_{timestamp}_{random}`     | `msg_1719876543210_a1b2c3d4e5` |
| `channel.channelId` | `channel_{timestamp}`          | `channel_1719876543210`        |
| `subscription.id`   | `sub_{timestamp}_{random}`     | `sub_1719876543210_x7y8z9`     |
| `session.sessionId` | `session_{timestamp}_{random}` | `session_1719876543210_a1b2c`  |
| `request.id`        | `req_{timestamp}_{counter}`    | `req_1719876543210_1`          |
| `operation.log_id`  | `op_{timestamp}_{random}`      | `op_1719876543210_a1b2c3`      |

## 附录 B：核心时序图

### B.1 完整请求/响应流程

```
User         CLI        UIAgent     AgentChannel    Plugin      Kernel      Tool
 │            │            │            │             │           │          │
 │ 输入命令   │            │            │             │           │          │
 │──────────▶│            │            │             │           │          │
 │            │ parse()    │            │             │           │          │
 │            │───────────▶│            │             │           │          │
 │            │            │ sendAndWait(msg)         │           │          │
 │            │            │───────────▶│             │           │          │
 │            │            │            │ handleMessage()         │          │
 │            │            │            │────────────▶│           │          │
 │            │            │            │             │ execute() │          │
 │            │            │            │             │──────────▶│          │
 │            │            │            │             │           │executeTool()│
 │            │            │            │             │           │─────────▶│
 │            │            │            │             │           │          │
 │            │            │            │             │           │◀──result─│
 │            │            │            │             │◀──result──│          │
 │            │            │            │◀──response──│           │          │
 │            │            │◀──result──│             │           │          │
 │            │◀──result──│            │             │           │          │
 │◀──output──│            │            │             │           │          │
```

### B.2 EventBus 事件分发流程

```
PluginManager        EventBus          Plugin A          Plugin B
     │                   │                 │                 │
     │ register(plugin)  │                 │                 │
     │──────────────────▶│                 │                 │
     │                   │                 │                 │
     │                   │ emit('plugin:register')          │
     │                   │──┐              │                 │
     │                   │  │ (async)      │                 │
     │                   │◀─┘              │                 │
     │                   │                 │                 │
     │                   │ on('plugin:register')            │
     │                   │────────────────▶│                 │
     │                   │                 │                 │
     │                   │ onWildcard('plugin:*')           │
     │                   │─────────────────────────────────▶│
     │                   │                 │                 │
```

### B.3 消息队列处理流程

```
Producer          MessageQueue          Consumer
   │                   │                    │
   │ enqueue(msg)      │                    │
   │──────────────────▶│                    │
   │                   │ 按优先级插入        │
   │                   │ emit('message:enqueued')
   │                   │                    │
   │                   │    dequeue()       │
   │                   │◀───────────────────│
   │                   │                    │
   │                   │ 检查过期            │
   │                   │ ├─ 过期: → dead letter
   │                   │ └─ 有效: → 返回消息
   │                   │───────────────────▶│
   │                   │                    │ 处理消息
```

### B.4 沙箱会话生命周期

```
UIAgent          Sandbox            Security
   │                │                   │
   │ createSession()│                   │
   │───────────────▶│                   │
   │                │ initialize session│
   │◀──sessionId───│                   │
   │                │                   │
   │ 执行操作请求   │                   │
   │───────────────▶│                   │
   │                │ checkPermission() │
   │                │──────────────────▶│
   │                │◀──PermissionCheck─│
   │                │                   │
   │                │  ├─ allowed → record + execute
   │                │  └─ denied → emit('permission:denied')
   │                │                   │
   │◀──result──────│                   │
   │                │                   │
   │ terminateSession()                │
   │───────────────▶│                   │
   │                │ finalize session  │
   │◀──confirmed───│                   │
```

---

## 附录 C：参考源文件

| 协议                   | 源文件路径                                                 |
| ---------------------- | ---------------------------------------------------------- |
| EventBus               | `packages/kernel/src/kernel/EventBus.ts`                   |
| AgentChannel           | `packages/agent/src/communication/AgentChannel.ts`         |
| AgentMessage           | `packages/agent/src/communication/AgentMessage.ts`         |
| MessageQueue           | `packages/agent/src/communication/MessageQueue.ts`         |
| Kernel                 | `packages/kernel/src/kernel/Kernel.ts`                     |
| PluginManager          | `packages/kernel/src/kernel/PluginManager.ts`              |
| LifecycleManager       | `packages/kernel/src/kernel/LifecycleManager.ts`           |
| PluginInterface        | `packages/utils/src/types/Plugin.ts`                       |
| PluginInterface (扩展) | `packages/plugins/src/interfaces/PluginInterface.ts`       |
| PluginLoader           | `packages/plugins/src/loaders/PluginLoader.ts`             |
| PluginLoaderInterface  | `packages/plugins/src/interfaces/PluginLoaderInterface.ts` |
| Tool 类型              | `packages/utils/src/types/Tool.ts`                         |
| ToolService            | `packages/tools/src/services/ToolService.ts`               |
| ToolContext            | `packages/tools/src/executor/ToolContext.ts`               |
| Tool 类型 (扩展)       | `packages/tools/src/types/index.ts`                        |
| StorageService         | `packages/storage/src/services/StorageService.ts`          |
| StorageManager         | `packages/storage/src/services/StorageManager.ts`          |
| IStorageBackend        | `packages/storage/src/backends/IStorageBackend.ts`         |
| StorageEntity          | `packages/storage/src/models/StorageEntity.ts`             |
| CLI                    | `packages/ui/src/cli/CLI.ts`                               |
| UIOperation            | `packages/ui/src/core/UIOperation.ts`                      |
| UIAgent                | `packages/ui/src/core/UIAgent.ts`                          |
| Sandbox                | `packages/ui/src/core/Sandbox.ts`                          |
| BaseError              | `packages/utils/src/errors/BaseError.ts`                   |
| Result                 | `packages/utils/src/types/Result.ts`                       |
| Config                 | `packages/utils/src/types/Config.ts`                       |
