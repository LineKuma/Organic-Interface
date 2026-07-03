# 功能文档：Memory 记忆与上下文管理系统

## 基本信息

**文档编号**: DOC-018
**所属模块**: 核心架构
**优先级**: P1
**创建日期**: 2026-07-03
**对应需求章节**: 3.2 智能协作需求 / 3.4 数据持久化需求

---

## 功能概述

Memory 记忆与上下文管理系统是 Organic-Interface 的认知核心，为 Agent 提供类人脑的多层次记忆能力。系统将记忆分为三个层次：**工作记忆（Working Memory）**负责当前对话的即时上下文、**情节记忆（Episodic Memory）**负责跨会话的会话持久化、**语义记忆（Semantic Memory）**负责长期结构化数据的存储与检索。三层记忆协同工作，确保 Agent 在单次对话、跨会话恢复、以及长期知识积累等场景下都能获取所需的上下文信息。

记忆系统不是简单的消息存储，而是对 Agent 认知状态的完整建模——包括对话历史、状态变量、执行帧栈、工具调用记录、附件数据等，并通过上下文窗口、Token 计数、压缩策略等机制，在 LLM 的有限上下文窗口内高效组织信息。

---

## 设计理念

### 记忆系统定位

记忆系统承担以下核心职责：

**即时上下文维护**：管理当前对话的消息历史、状态变量和执行帧栈，为 Agent 的每一步决策提供完整的上下文。

**跨会话记忆**：通过 SessionPersistenceStorage 将会话状态持久化到存储后端，支持应用重启后恢复会话，保持对话连续性。

**长期知识积累**：通过 StorageService 将结构化数据（用户偏好、项目配置、知识条目）持久化存储，支持跨会话、跨 Agent 的知识共享。

**Token 预算管理**：通过 ContextWindowManager 精确控制发送给 LLM 的上下文大小，在有限的 Token 预算内最大化信息密度。

**多 Agent 上下文传播**：通过 ContextService 的传播机制，在父子 Agent 嵌套调用时高效传递上下文信息。

### 记忆层次架构

```
┌─────────────────────────────────────────────────────┐
│                   Semantic Memory                    │
│              (StorageService - 长期存储)              │
│   结构化数据 | 用户偏好 | 项目配置 | 知识图谱         │
│   跨会话、跨 Agent 共享 | 持久化 | 可查询            │
├─────────────────────────────────────────────────────┤
│                   Episodic Memory                    │
│         (SessionPersistenceStorage - 会话持久化)       │
│   会话快照 | 保存/恢复 | 会话列表 | 状态管理          │
│   跨重启持久化 | 按会话隔离 | 自动过期               │
├─────────────────────────────────────────────────────┤
│                   Working Memory                     │
│     (ContextManager + ContextWindowManager - 工作记忆) │
│   消息历史 | 状态变量 | 上下文窗口 | 执行帧栈         │
│   实时读写 | 窗口滑动 | Token 控制 | 自动清理        │
└─────────────────────────────────────────────────────┘
```

### 架构优势

- **认知分层**：三层记忆对应人脑的工作记忆、情节记忆和语义记忆，概念清晰，职责明确
- **Token 优化**：上下文窗口管理确保 LLM 调用始终在 Token 预算内，避免浪费和截断
- **持久化可靠**：会话持久化支持应用重启无缝恢复，用户无感知
- **传播高效**：四种传播模式（DIRECT / REFERENCE / INCREMENTAL / HYBRID）适应不同协作场景
- **可观测性**：基于 EventEmitter 的事件系统，所有关键操作均可被外部监听

---

## 1. 上下文管理器（ContextManager）

### 对话上下文模型

`ContextManager` 是工作记忆的核心，管理单个或多个对话上下文的完整生命周期：

```typescript
import {
  ContextManager,
  ContextStatus,
  StateType,
  DEFAULT_CONTEXT_CONFIG,
} from '@organic/agent/context';

// 创建上下文管理器
const ctxManager = new ContextManager({
  maxWindowSize: 100,        // 最大消息数
  ttl: 3600000,              // 1小时过期
  compressMessages: false,   // 不压缩消息
  persistStates: false,      // 不持久化状态
  defaultNamespace: 'default',
});

// 创建对话上下文
const context = ctxManager.create('session_abc123', [
  { id: 'user_1', type: 'user', name: 'Alice', joinedAt: Date.now() },
  { id: 'agent_1', type: 'agent', name: 'Assistant', joinedAt: Date.now() },
]);

// 添加用户消息
ctxManager.addUserMessage(
  context.id,          // 上下文ID
  'user_1',            // 用户ID
  'Alice',             // 用户名
  '帮我分析这段代码'     // 消息内容
);

// 添加助手回复
ctxManager.addAssistantMessage(
  context.id,
  'agent_1',
  'Assistant',
  '好的，让我分析一下这段代码...'
);

// 获取最近消息
const recent = ctxManager.getRecentMessages(context.id, 10);
```

### 核心数据类型

```typescript
// 对话上下文
interface ConversationContext {
  id: string;                    // 上下文唯一ID
  sessionId: string;             // 会话ID，用于分组
  participants: Participant[];   // 参与者列表
  messages: Message[];           // 消息历史
  metadata: ContextMetadata;     // 元数据
  createdAt: number;             // 创建时间
  updatedAt: number;             // 最后更新时间
  expiresAt?: number;            // 过期时间
  status: ContextStatus;         // 当前状态
}

// 参与者
interface Participant {
  id: string;
  type: 'user' | 'agent' | 'plugin';
  name: string;
  role?: string;
  joinedAt: number;
}

// 上下文状态枚举
enum ContextStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  IDLE = 'idle',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}
```

### 状态管理

ContextManager 内建了命名空间隔离的状态管理系统：

```typescript
// 设置会话状态
ctxManager.setState(context.id, 'language', 'typescript', {
  type: StateType.SESSION,
  namespace: 'preferences',
});

// 设置持久化状态
ctxManager.setState(context.id, 'user_theme', 'dark', {
  type: StateType.PERSISTENT,
  namespace: 'settings',
});

// 设置临时状态（任务完成后自动清除）
ctxManager.setState(context.id, 'temp_result', { score: 0.95 }, {
  type: StateType.TEMPORARY,
  namespace: 'task',
  expiresAt: Date.now() + 300000, // 5分钟后过期
});

// 读取状态
const language = ctxManager.getState<string>(context.id, 'language', 'preferences');
// → 'typescript'

// 获取命名空间下所有状态
const allSettings = ctxManager.getStates(context.id, 'settings');
// → Map { 'user_theme' → 'dark', ... }

// 订阅状态变更
const unsubscribe = ctxManager.subscribe(
  'language',
  (change: StateChange) => {
    console.log(`状态变更: ${change.key} ${change.changeType}`);
    console.log(`旧值: ${change.oldValue}, 新值: ${change.newValue}`);
  },
  'preferences'
);

// 取消订阅
unsubscribe();
```

### 上下文统计

```typescript
const stats = ctxManager.getStats(context.id);
// → {
//     messageCount: 42,
//     participantCount: 2,
//     tokenEstimate: 3500,
//     lastActivityAt: 1751529600000,
//     createdAt: 1751526000000
//   }

// 获取活跃上下文数量
const activeCount = ctxManager.getActiveCount();
```

### 生命周期管理

```typescript
// 归档上下文（保留数据，标记为不可用）
ctxManager.archive(context.id);

// 恢复已归档的上下文
const restored = ctxManager.restore(context.id);

// 删除上下文（永久删除）
ctxManager.delete(context.id);

// 批量清理过期上下文
const cleanupResult = ctxManager.cleanup();
// → { deleted: 3, archived: 12 }
```

---

## 2. 上下文条目（ContextItem）

### 条目类型

`ContextItem` 是统一的上下文数据容器，支持六种条目类型：

```typescript
import {
  ContextItemType,
  ContextItemPriority,
  createContextItem,
  createMessageContextItem,
  createStateContextItem,
  createToolCallContextItem,
  createResultContextItem,
  updateContextItem,
  isContextItemExpired,
  touchContextItem,
  isValidContextItem,
  calculateContextItemSize,
  compareContextItems,
} from '@organic/agent/context';

// 创建消息条目
const messageItem = createMessageContextItem(
  context.id,
  { text: 'Hello', sender: 'user' },
  { tags: ['greeting'], priority: ContextItemPriority.NORMAL }
);

// 创建状态条目
const stateItem = createStateContextItem(
  context.id,
  'current_step',
  { step: 3, name: 'analyze' },
  { tags: ['workflow'] }
);

// 创建工具调用条目
const toolCallItem = createToolCallContextItem(
  context.id,
  { tool: 'read_file', params: { path: '/src/main.ts' } },
  { tags: ['io', 'tool'] }
);

// 创建结果条目
const resultItem = createResultContextItem(
  context.id,
  { success: true, data: { lines: 120 } },
  { tags: ['result'] }
);
```

### 条目操作

```typescript
// 更新条目
const updated = updateContextItem(messageItem, {
  content: { text: 'Hello, updated!' },
  metadata: { priority: ContextItemPriority.HIGH },
});

// 检查过期
if (isContextItemExpired(messageItem)) {
  console.log('条目已过期');
}

// 刷新访问时间
const touched = touchContextItem(messageItem);

// 验证条目结构
if (isValidContextItem(someObject)) {
  // someObject 是合法的 ContextItem
}

// 计算条目大小
const size = calculateContextItemSize(messageItem);
// → 约 350 字节

// 排序比较
const sorted = items.sort((a, b) =>
  compareContextItems(a, b, 'accessed') // 按访问时间降序
);
```

### 过滤器

```typescript
const filter: ContextItemFilter = {
  types: [ContextItemType.MESSAGE, ContextItemType.TOOL_CALL],
  tags: ['important'],
  priority: ContextItemPriority.HIGH,
  includeExpired: false,
  timeRange: {
    start: Date.now() - 3600000,  // 最近1小时
    end: Date.now(),
  },
};
```

---

## 3. 消息系统（Message）

### 消息类型

```typescript
import {
  MessageType,
  MessageStatus,
  MessageFlag,
  ContentFormat,
  AttachmentType,
  createMessage,
  createUserMessage,
  createAssistantMessage,
  createToolCallMessage,
  createToolResponseMessage,
  createSystemMessage,
  createErrorMessage,
  isValidMessage,
} from '@organic/agent/context';

// 创建用户消息
const userMsg = createUserMessage('user_1', 'Alice', '分析这段代码', context.id);

// 创建助手消息
const assistantMsg = createAssistantMessage(
  'agent_1', 'Assistant', '分析结果如下...', context.id
);

// 创建工具调用消息
const toolCallMsg = createToolCallMessage(
  'agent_1', 'Assistant',
  'read_file',
  { path: '/src/main.ts' },
  context.id
);

// 创建工具响应消息
const toolResponseMsg = createToolResponseMessage(
  'system', 'ToolSystem',
  {
    name: 'read_file',
    success: true,
    data: 'file content...',
    execution_time: 45,
  },
  { name: 'read_file', params: { path: '/src/main.ts' } },
  context.id
);

// 创建系统消息
const sysMsg = createSystemMessage('会话已迁移到新上下文', context.id);

// 创建错误消息
const errMsg = createErrorMessage('agent_1', 'Assistant', '无法读取文件', context.id);
```

### 消息结构

```typescript
interface Message {
  id: string;                      // 消息唯一ID
  sender: MessageSender;           // 发送者
  content: MessageContent;         // 消息内容
  type: MessageType;               // 消息类型
  tool_call?: ToolCall;            // 工具调用
  tool_response?: ToolResponse;    // 工具响应
  timestamp: number;               // 时间戳
  status: MessageStatus;           // 消息状态
  flags: MessageFlag[];            // 消息标记
  reply_to?: string;               // 回复目标消息ID
  context_id?: string;             // 所属上下文
  metadata?: Record<string, unknown>;
}

// 消息类型枚举
enum MessageType {
  USER_MESSAGE = 'user_message',
  ASSISTANT_MESSAGE = 'assistant_message',
  SYSTEM_MESSAGE = 'system_message',
  TOOL_CALL = 'tool_call',
  TOOL_RESPONSE = 'tool_response',
  ERROR_MESSAGE = 'error_message',
  STATUS_UPDATE = 'status_update',
}

// 消息标记
enum MessageFlag {
  FLAGGED = 'flagged',
  STARRED = 'starred',
  DELETED = 'deleted',
  ARCHIVED = 'archived',
  PRIVATE = 'private',
}
```

### 内容格式与附件

```typescript
// 内容格式
enum ContentFormat {
  PLAIN_TEXT = 'plain_text',
  MARKDOWN = 'markdown',
  HTML = 'html',
  JSON = 'json',
  CODE = 'code',
}

// 附件
interface Attachment {
  type: AttachmentType;  // IMAGE | VIDEO | AUDIO | DOCUMENT | CODE_FILE | OTHER
  url: string;
  name: string;
  size?: number;
  mime_type: string;
  thumbnail?: string;
  metadata?: Record<string, unknown>;
}

// 创建带附件的消息
const messageWithAttachment = createMessage({
  sender: { id: 'user_1', type: 'user', name: 'Alice' },
  content: {
    text: '请分析这张截图',
    format: ContentFormat.PLAIN_TEXT,
    attachments: [{
      type: AttachmentType.IMAGE,
      url: '/files/screenshot.png',
      name: 'screenshot.png',
      size: 204800,
      mime_type: 'image/png',
    }],
    structured_data: { page: 'dashboard', version: '2.0' },
  },
  type: MessageType.USER_MESSAGE,
  context_id: context.id,
});
```

---

## 4. 上下文窗口管理（ContextWindowManager）

### 窗口类型

上下文窗口控制 Agent 一次处理的消息范围，解决长对话场景下的 Token 限制：

```typescript
import {
  ContextWindowManager,
  ContextWindowType,
  DEFAULT_CONTEXT_WINDOW_CONFIG,
} from '@organic/agent/context';

// 创建窗口管理器
const windowManager = new ContextWindowManager({
  autoOptimize: true,
  maxWindowsPerContext: 10,
  charsPerToken: 4,
});

// 四种窗口类型
enum ContextWindowType {
  RECENT_MESSAGES = 'recent_messages',  // 最近N条消息
  RECENT_MINUTES = 'recent_minutes',    // 最近N分钟内
  TOKEN_BASED = 'token_based',          // 基于Token数量
  SEMANTIC_BASED = 'semantic_based',    // 基于语义相关性
}
```

### 创建与滑动窗口

```typescript
const allMessages = ctxManager.getMessages(context.id);

// 创建窗口：最近50条消息
const window = windowManager.createWindow(context.id, allMessages, {
  windowSize: 50,
  windowType: ContextWindowType.RECENT_MESSAGES,
  includeSystemMessages: true,
  includeToolCalls: true,
  maxTokens: 4096,
  overlapSize: 5,  // 滑动时保留5条重叠
});

console.log(window.tokenCount);   // Token 估算值
console.log(window.hasPrevious);  // 是否有更早的消息
console.log(window.hasNext);      // 是否有更新的消息

// 向前滑动（获取更早的消息）
const prevWindow = windowManager.slideBackward(window.id, allMessages);

// 向后滑动（获取更新的消息）
const nextWindow = windowManager.slideForward(window.id, allMessages);
```

### 基于 Token 的窗口

```typescript
// 创建基于 Token 预算的窗口
const tokenWindow = windowManager.createWindow(context.id, allMessages, {
  windowSize: 100,
  windowType: ContextWindowType.TOKEN_BASED,
  maxTokens: 4096,
  includeSystemMessages: true,
  includeToolCalls: false,  // 排除工具调用节省 Token
});

// 自动优化：如果超出 Token 限制，保留最近的消息
const optimized = windowManager.optimizeWindow(tokenWindow.id);

// 获取 Token 限制下的推荐窗口大小
const optimalSize = windowManager.getOptimalWindowSize(8192);
// → 约 2048 条消息（基于 charsPerToken=4 估算）
```

### 基于时间的窗口

```typescript
// 最近30分钟的消息
const timeWindow = windowManager.createWindow(context.id, allMessages, {
  windowSize: 100,
  windowType: ContextWindowType.RECENT_MINUTES,
  timeWindowMinutes: 30,
  includeSystemMessages: true,
  includeToolCalls: true,
});
```

---

## 5. 上下文传播（ContextService）

### 传播模式

`ContextService` 在 ContextManager 的基础上提供了更高层的上下文管理能力，特别是多 Agent 间的上下文传播：

```typescript
import {
  ContextService,
  PropagationMode,
  DEFAULT_CONTEXT_SERVICE_CONFIG,
} from '@organic/agent/context';

// 创建上下文服务
const ctxService = new ContextService({
  maxWindowSize: 100,
  ttl: 3600000,
  enablePropagation: true,
  maxNestingDepth: 5,
  autoCleanup: true,
  cleanupInterval: 60000,
});

// 创建上下文
const context = ctxService.createContext(
  'session_abc',
  [
    { id: 'user_1', type: 'user', name: 'Alice', joinedAt: Date.now() },
    { id: 'agent_1', type: 'agent', name: 'MainAgent', joinedAt: Date.now() },
  ],
  { tags: ['code-review'], createdBy: 'system' }
);
```

### 四种传播模式

```typescript
// 1. DIRECT 模式：传递完整上下文
const directResult = ctxService.propagateContext(
  context.id,
  'sub_agent_1',
  PropagationMode.DIRECT,
  {
    includeMessages: true,
    includeStates: true,
    includeToolCalls: true,
    includeAttachments: true,
  }
);
// → { contextId: 'ctx_xxx' }
// 子 Agent 直接共享父 Agent 的上下文

// 2. REFERENCE 模式：仅传递引用
const refResult = ctxService.propagateContext(
  context.id,
  'sub_agent_2',
  PropagationMode.REFERENCE,
  { includeMessages: true, includeStates: false, includeToolCalls: false, includeAttachments: false }
);
// → { referenceId: 'ctx_xxx' }
// 子 Agent 按需加载上下文

// 3. INCREMENTAL 模式：仅传递增量
const incResult = ctxService.propagateContext(
  context.id,
  'sub_agent_3',
  PropagationMode.INCREMENTAL,
  {
    includeMessages: true,
    includeStates: true,
    includeToolCalls: true,
    includeAttachments: false,
    messageLimit: 10,
    messageTimeRange: { start: Date.now() - 600000 },
  }
);
// → { incremental: { messages: [...], states: [...], items: [...] } }

// 4. HYBRID 模式：自动选择最优方式
const hybridResult = ctxService.propagateContext(
  context.id,
  'sub_agent_4',
  PropagationMode.HYBRID,
  { includeMessages: true, includeStates: true, includeToolCalls: true, includeAttachments: true }
);
// 少量消息时使用 DIRECT，大量消息时使用 INCREMENTAL
```

### 执行帧栈

嵌套 Agent 调用时，执行帧栈维护父子关系：

```typescript
// 进入子 Agent 执行
const frame = ctxService.pushExecutionFrame(context.id, 'sub_agent_1');
// → {
//     id: 'frame_xxx',
//     contextId: 'ctx_xxx',
//     agentId: 'sub_agent_1',
//     parentFrameId: undefined,  // 根帧
//     childFrameIds: [],
//     enterTime: 1751529600000,
//     status: 'running',
//   }

// 再次嵌套
const childFrame = ctxService.pushExecutionFrame(context.id, 'sub_agent_2');
// childFrame.parentFrameId === frame.id

// 退出子 Agent
const completedFrame = ctxService.popExecutionFrame(
  context.id,
  { result: 'analysis complete' },  // 结果
);

// 带错误的退出
const failedFrame = ctxService.popExecutionFrame(
  context.id,
  undefined,
  { code: 'ANALYSIS_FAILED', message: '无法完成分析' }
);

// 获取当前执行帧
const currentFrame = ctxService.getCurrentFrame(context.id);

// 获取完整执行栈
const stack = ctxService.getExecutionStack(context.id);
// → {
//     rootContextId: 'ctx_xxx',
//     stack: [frame1, frame2],
//     maxDepth: 5,
//   }
```

### 上下文条目管理

```typescript
// 添加条目
ctxService.addContextItem(messageItem);

// 获取条目
const item = ctxService.getContextItem(context.id, messageItem.id);

// 获取过滤后的条目列表
const toolItems = ctxService.getContextItems(context.id, {
  types: [ContextItemType.TOOL_CALL],
  tags: ['io'],
  timeRange: { start: Date.now() - 3600000 },
});

// 更新条目
ctxService.updateContextItem(context.id, messageItem.id, {
  metadata: { priority: ContextItemPriority.HIGH },
});

// 删除条目
ctxService.deleteContextItem(context.id, messageItem.id);
```

### 清理与释放

```typescript
// 手动清理
const cleanupResult = ctxService.cleanup();
// → { deletedContexts: 2, archivedContexts: 5, deletedItems: 18 }

// 停止自动清理定时器
ctxService.stopCleanupTimer();

// 释放所有资源
ctxService.dispose();
```

---

## 6. 会话持久化（SessionPersistenceStorage）

### 会话模型

`SessionPersistenceStorage` 实现情节记忆层，将会话状态持久化到存储后端：

```typescript
import {
  SessionPersistenceStorage,
  SessionPersistenceStatus,
  SessionAdapter,
  createSessionPersistenceStorage,
} from '@organic/storage';

// 创建会话持久化存储
const sessionStorage = await createSessionPersistenceStorage(
  '/data/sessions.db',
  {
    autoSave: true,
    entityTtl: 24 * 60 * 60 * 1000, // 24小时
  }
);

// 会话数据结构
interface SessionPersistence {
  id: string;                                    // 会话ID
  title: string;                                 // 会话标题
  status: SessionPersistenceStatus;               // 状态
  tags: string[];                                // 标签
  metadata: Record<string, unknown>;              // 元数据
  contextWindow: SessionPersistenceContextWindow; // 窗口配置
  createdAt: number;                             // 创建时间
  lastActiveAt: number;                          // 最后活跃时间
  expiresAt?: number;                            // 过期时间
  messageCount: number;                          // 消息数量
  projectId?: string;                            // 关联项目
}

// 会话状态
enum SessionPersistenceStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}
```

### 保存与恢复会话

```typescript
// 保存会话
await sessionStorage.save({
  id: 'session_abc123',
  title: '代码审查会话',
  status: SessionPersistenceStatus.ACTIVE,
  tags: ['code-review', 'typescript'],
  metadata: { language: 'typescript', files: ['main.ts', 'utils.ts'] },
  contextWindow: {
    windowSize: 50,
    windowType: 'recent_messages',
    includeSystemMessages: true,
    includeToolCalls: true,
    maxTokens: 4096,
  },
  createdAt: Date.now(),
  lastActiveAt: Date.now(),
  messageCount: 42,
  projectId: 'project_xyz',
});

// 恢复会话
const session = await sessionStorage.load('session_abc123');
if (session) {
  console.log(`恢复会话: ${session.title}`);
  console.log(`消息数: ${session.messageCount}`);
  console.log(`状态: ${session.status}`);
}

// 列出所有会话
const allSessions = await sessionStorage.list();
for (const s of allSessions) {
  console.log(`- ${s.id}: ${s.title} [${s.status}]`);
}

// 删除会话
await sessionStorage.delete('session_abc123');

// 获取会话数量
const count = await sessionStorage.count();

// 清空所有会话
await sessionStorage.clear();

// 关闭存储
await sessionStorage.close();
```

### 适配器模式

`SessionAdapter` 在 Plugin 层会话和持久化层会话之间进行转换：

```typescript
// Plugin 会话 → 持久化会话
const persistenceSession = SessionAdapter.toPersistence(pluginSession);

// 持久化会话 → Plugin 会话
const pluginSession = SessionAdapter.toPlugin(persistenceSession);
```

### 缓存策略

SessionPersistenceStorage 内部维护了一个内存缓存（`Map<string, SessionPersistence>`），在 `initialize()` 时从存储后端加载所有有效会话到缓存，后续的 `load()` 操作优先从缓存读取，避免频繁的磁盘 I/O。

---

## 7. 长期存储（StorageService）

### 核心 CRUD 操作

`StorageService` 实现语义记忆层，提供通用的结构化数据持久化：

```typescript
import { StorageService } from '@organic/storage';

const storage = new StorageService(backend, logger);
await storage.initialize();

// 创建实体
const result = await storage.create('user_preference', {
  theme: 'dark',
  fontSize: 14,
  language: 'zh-CN',
}, {
  id: 'pref_user_1',
  metadata: {
    tags: ['user', 'preference'],
    createdBy: 'system',
  },
});

if (result.success) {
  console.log(`实体已创建: ${result.entity.id}`);
}

// 读取实体
const entity = await storage.read('pref_user_1');
if (entity) {
  console.log(entity.data.theme); // → 'dark'
}

// 更新实体
const updateResult = await storage.update('pref_user_1', {
  theme: 'light',
  fontSize: 16,
}, 'user_1');

// 删除实体
await storage.delete('pref_user_1');
```

### 查询操作

```typescript
// 基本查询
const queryResult = await storage.query({
  where: { type: 'user_preference' },
  orderBy: [{ field: 'updated_at', direction: 'desc' }],
  limit: 10,
  offset: 0,
  include: ['data.theme', 'data.fontSize'],
  updatedAfter: Date.now() - 86400000, // 24小时内更新过的
});

console.log(`找到 ${queryResult.total} 条记录`);

// 按类型查询
const sessions = await storage.findByType('session');

// 按标签查询
const items = await storage.findByTags(['important', 'pinned']);
```

### 批量操作

```typescript
// 批量创建
const batchResult = await storage.batchCreate([
  { type: 'note', data: { title: 'Note 1', content: '...' } },
  { type: 'note', data: { title: 'Note 2', content: '...' } },
  { type: 'note', data: { title: 'Note 3', content: '...' } },
]);
console.log(`成功: ${batchResult.created.length}, 失败: ${batchResult.failed.length}`);

// 批量更新
const updateResult = await storage.batchUpdate([
  { id: 'note_1', data: { content: 'Updated content' } },
  { id: 'note_2', data: { content: 'Updated content 2' } },
]);

// 批量删除
const deleteResult = await storage.batchDelete(['note_1', 'note_2', 'note_3']);
console.log(`已删除: ${deleteResult.deleted}`);
```

### 事务支持

```typescript
try {
  // 开始事务
  const tx = await storage.beginTransaction({
    isolation: IsolationLevel.READ_COMMITTED,
    timeout: 30000,           // 30秒超时
    retryOnConflict: true,
  });

  // 在事务中执行操作
  await storage.create('order', { item: 'A', qty: 1 }, { id: 'order_1' });
  await storage.create('order', { item: 'B', qty: 2 }, { id: 'order_2' });
  await storage.update('inventory', { stock: 98 });

  // 提交事务
  await storage.commitTransaction();
  console.log('事务已提交');
} catch (error) {
  // 回滚事务
  await storage.rollbackTransaction();
  console.log('事务已回滚');
}
```

### 过期清理

```typescript
// 清理过期实体
const clearResult = await storage.clearExpired();
console.log(`清理了 ${clearResult.cleared} 个过期实体`);

// 获取存储信息
const info = await storage.getStorageInfo();
console.log(`活跃事务: ${info.transactionActive}`);
console.log(`索引数: ${info.indexes.length}`);
```

---

## 8. 记忆生命周期

### 完整生命周期图

```
┌──────────────────────────────────────────────────────────────────┐
│                        记忆生命周期                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CREATION (创建)                                               │
│     ctxManager.create() / ctxService.createContext()             │
│     ↓                                                            │
│  2. POPULATION (填充)                                             │
│     addMessage() / setState() / addContextItem()                 │
│     ↓                                                            │
│  3. WINDOW MANAGEMENT (窗口管理)                                  │
│     createWindow() → slideForward() → optimizeWindow()           │
│     ↓                                                            │
│  4. PERSISTENCE (持久化)                                          │
│     sessionStorage.save() → 磁盘/数据库                          │
│     ↓                                                            │
│  5. ARCHIVAL (归档)                                               │
│     archive() → 标记为非活跃，保留数据                            │
│     ↓                                                            │
│  6. DELETION (删除)                                               │
│     delete() → 永久删除，释放资源                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 创建阶段

```typescript
// 1. 创建会话持久化存储
const sessionStore = await createSessionPersistenceStorage('/data/sessions.db');

// 2. 创建上下文服务
const ctxService = new ContextService({
  maxWindowSize: 100,
  ttl: 3600000,
  enablePropagation: true,
  autoCleanup: true,
});

// 3. 创建对话上下文
const context = ctxService.createContext('session_abc', [
  { id: 'user_1', type: 'user', name: 'Alice', joinedAt: Date.now() },
  { id: 'agent_1', type: 'agent', name: 'Assistant', joinedAt: Date.now() },
]);
```

### 填充阶段

```typescript
// 添加消息
ctxService.addMessage(context.id, userMsg);
ctxService.addMessage(context.id, assistantMsg);

// 设置状态
ctxService.setState(context.id, 'topic', '代码审查', {
  namespace: 'conversation',
});

// 添加上下文条目
ctxService.addContextItem(
  createResultContextItem(context.id, { review: 'passed' }, { tags: ['result'] })
);
```

### 窗口管理阶段

```typescript
const windowManager = new ContextWindowManager({
  autoOptimize: true,
  maxWindowsPerContext: 10,
});

const allMessages = ctxService.getMessages(context.id);
const window = windowManager.createWindow(context.id, allMessages, {
  windowSize: 50,
  windowType: ContextWindowType.TOKEN_BASED,
  maxTokens: 4096,
  overlapSize: 5,
});

// 如果 Token 超出限制，自动优化
if (window.tokenCount > (window.config.maxTokens ?? 4096)) {
  windowManager.optimizeWindow(window.id);
}
```

### 持久化阶段

```typescript
// 保存会话到持久化存储
await sessionStore.save({
  id: context.sessionId,
  title: '代码审查会话',
  status: SessionPersistenceStatus.ACTIVE,
  tags: ['code-review'],
  metadata: context.metadata as Record<string, unknown>,
  contextWindow: {
    windowSize: window.config.windowSize,
    windowType: window.config.windowType,
    includeSystemMessages: window.config.includeSystemMessages,
    includeToolCalls: window.config.includeToolCalls,
    maxTokens: window.config.maxTokens,
  },
  createdAt: context.createdAt,
  lastActiveAt: context.updatedAt,
  messageCount: context.messages.length,
});
```

### 归档与删除阶段

```typescript
// 归档（数据保留，状态标记为 ARCHIVED）
ctxService.archiveContext(context.id);

// 恢复
const restored = ctxService.restoreContext(context.id);

// 永久删除
ctxService.deleteContext(context.id);
await sessionStore.delete(context.sessionId);
```

---

## 9. 记忆优化策略

### Token 计数与估算

系统使用字符数 / 4 的粗略估算方式计算 Token 数：

```typescript
// ContextManager 中的 Token 估算
const messageTexts = context.messages.map(m => m.content.text ?? '').join('');
const tokenEstimate = Math.ceil(messageTexts.length / 4);

// ContextWindowManager 中的 Token 估算
// 每条消息 = 内容字符数 / 4 + 5 字节开销
const textTokens = Math.ceil(text.length / charsPerToken);
const overheadTokens = 5;
return textTokens + overheadTokens;
```

### 压缩策略

Plugin 层的 ContextManager 支持三种压缩策略：

```typescript
// 策略 1: TRIM_MIDDLE - 保留首尾，裁剪中间
// 保留前 20% 和后 60% 的消息，系统消息始终保留
// → 适用于：长对话，保留开头上下文和最近对话

// 策略 2: SUMMARY - 对中间消息进行摘要
// 实际实现中调用 AI 服务生成摘要
// → 适用于：需要保留对话脉络但 Token 受限

// 策略 3: SELECTIVE - 选择性保留
// 保留前 5 条和后 20 条消息
// → 适用于：最近对话最重要，早期对话仅保留开头

// 使用示例
await pluginContextManager.compressContext(
  sessionId,
  CompressionStrategy.TRIM_MIDDLE
);
```

### 窗口滑动优化

```typescript
// 重叠窗口：滑动时保留部分重叠，避免上下文断裂
const window = windowManager.createWindow(context.id, allMessages, {
  windowSize: 50,
  overlapSize: 10,  // 滑动时保留 10 条重叠消息
  maxTokens: 4096,
});

// 滑动后，前 10 条消息与上一个窗口的末尾 10 条相同
// 确保 LLM 能感知到上下文连续性
```

### 自动清理策略

```typescript
// 两层清理机制：

// 1. ContextService 定时清理（默认每60秒）
//    - 清理过期上下文（ARCHIVED → DELETED）
//    - 清理过期 ContextItem
//    - 归档过期但未归档的上下文（ACTIVE → ARCHIVED）

// 2. SessionPersistenceStorage 过期检查
//    - 加载时检查 expiresAt
//    - 检查 CLOSED / ARCHIVED 状态
//    - 从缓存中移除无效会话

// 手动触发清理
const result = ctxService.cleanup();
// → { deletedContexts: 3, archivedContexts: 7, deletedItems: 42 }
```

---

## 10. 完整示例：构建多轮对话 Agent

以下示例展示如何构建一个具有完整记忆能力的多轮对话 Agent：

```typescript
import { ContextService, PropagationMode, ContextItemType } from '@organic/agent/context';
import { ContextWindowManager, ContextWindowType } from '@organic/agent/context';
import { SessionPersistenceStorage, SessionPersistenceStatus } from '@organic/storage';
import { createSessionPersistenceStorage } from '@organic/storage';
import { StorageService } from '@organic/storage';

// ============================================================
// 第一步：初始化存储层
// ============================================================
const sessionStore = await createSessionPersistenceStorage('/data/sessions.db', {
  autoSave: true,
  entityTtl: 7 * 24 * 60 * 60 * 1000, // 7天过期
});

const storageService = new StorageService(databaseBackend, logger);
await storageService.initialize();

// ============================================================
// 第二步：创建上下文服务
// ============================================================
const ctxService = new ContextService({
  maxWindowSize: 100,
  ttl: 3600000,
  enablePropagation: true,
  maxNestingDepth: 5,
  autoCleanup: true,
  cleanupInterval: 60000,
});

const windowManager = new ContextWindowManager({
  autoOptimize: true,
  maxWindowsPerContext: 10,
  charsPerToken: 4,
});

// ============================================================
// 第三步：创建多轮对话 Agent
// ============================================================
class ConversationAgent {
  private contextId: string;
  private sessionId: string;

  constructor(
    private ctxService: ContextService,
    private windowManager: ContextWindowManager,
    private sessionStore: SessionPersistenceStorage,
    private storage: StorageService,
    private agentId: string,
    private agentName: string,
  ) {}

  // 开始新会话
  async startSession(sessionId: string, userId: string, userName: string): Promise<void> {
    this.sessionId = sessionId;

    const context = this.ctxService.createContext(sessionId, [
      { id: userId, type: 'user', name: userName, joinedAt: Date.now() },
      { id: this.agentId, type: 'agent', name: this.agentName, joinedAt: Date.now() },
    ]);

    this.contextId = context.id;

    // 添加系统消息
    this.ctxService.addMessage(context.id, createSystemMessage(
      '你是一个代码审查助手，帮助用户分析和改进代码。',
      context.id
    ));

    // 初始化会话状态
    this.ctxService.setState(context.id, 'turn', 0, { namespace: 'conversation' });
    this.ctxService.setState(context.id, 'topic', 'general', { namespace: 'conversation' });

    console.log(`会话已启动: ${context.id}`);
  }

  // 恢复已有会话
  async resumeSession(sessionId: string): Promise<boolean> {
    const session = await this.sessionStore.load(sessionId);
    if (!session) {
      console.log(`会话 ${sessionId} 不存在`);
      return false;
    }

    this.sessionId = sessionId;

    // 从持久化存储恢复会话元数据
    // 实际实现中需要额外恢复消息历史
    const context = this.ctxService.createContext(sessionId, [
      { id: 'user_1', type: 'user', name: 'User', joinedAt: Date.now() },
      { id: this.agentId, type: 'agent', name: this.agentName, joinedAt: Date.now() },
    ]);

    this.contextId = context.id;

    console.log(`会话已恢复: ${session.title} (${session.messageCount} 条消息)`);
    return true;
  }

  // 处理用户输入
  async processUserInput(userId: string, userName: string, text: string): Promise<string> {
    // 1. 添加用户消息
    const userMsg = createUserMessage(userId, userName, text, this.contextId);
    this.ctxService.addMessage(this.contextId, userMsg);

    // 2. 更新会话状态
    const turn = this.ctxService.getState<number>(this.contextId, 'turn', 'conversation') ?? 0;
    this.ctxService.setState(this.contextId, 'turn', turn + 1, { namespace: 'conversation' });

    // 3. 获取上下文窗口
    const allMessages = this.ctxService.getMessages(this.contextId);
    const window = this.windowManager.createWindow(this.contextId, allMessages, {
      windowSize: 50,
      windowType: ContextWindowType.TOKEN_BASED,
      maxTokens: 4096,
      includeSystemMessages: true,
      includeToolCalls: true,
      overlapSize: 5,
    });

    // 4. 检查 Token 预算
    if (window.tokenCount > 4096) {
      this.windowManager.optimizeWindow(window.id);
      console.log(`窗口已优化: Token 从 ${window.tokenCount} 减少到预算内`);
    }

    // 5. 模拟 LLM 调用（实际实现中调用 LLM API）
    const response = await this.callLLM(window.messages);

    // 6. 添加助手回复
    const assistantMsg = createAssistantMessage(
      this.agentId, this.agentName, response, this.contextId
    );
    this.ctxService.addMessage(this.contextId, assistantMsg);

    // 7. 持久化会话
    await this.sessionStore.save({
      id: this.sessionId,
      title: `对话-${new Date().toLocaleDateString()}`,
      status: SessionPersistenceStatus.ACTIVE,
      tags: ['conversation'],
      metadata: {
        turn: turn + 1,
        topic: this.ctxService.getState(this.contextId, 'topic', 'conversation'),
      },
      contextWindow: {
        windowSize: 50,
        windowType: 'token_based',
        includeSystemMessages: true,
        includeToolCalls: true,
        maxTokens: 4096,
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      messageCount: allMessages.length + 2,
    });

    // 8. 存储长期记忆（用户偏好等）
    await this.storage.create('conversation_summary', {
      sessionId: this.sessionId,
      turn: turn + 1,
      userInput: text,
      assistantResponse: response.substring(0, 200),
    }, {
      metadata: {
        tags: ['conversation', 'summary'],
        createdBy: this.agentId,
      },
    });

    return response;
  }

  // 调用子 Agent（使用上下文传播）
  async delegateToSubAgent(subAgentId: string, task: string): Promise<unknown> {
    // 推送执行帧
    const frame = this.ctxService.pushExecutionFrame(this.contextId, subAgentId);

    try {
      // 传播上下文给子 Agent
      const propagated = this.ctxService.propagateContext(
        this.contextId,
        subAgentId,
        PropagationMode.INCREMENTAL,
        {
          includeMessages: true,
          includeStates: true,
          includeToolCalls: true,
          includeAttachments: false,
          messageLimit: 20,
        }
      );

      // 模拟子 Agent 执行
      const result = { success: true, output: `子Agent ${subAgentId} 完成: ${task}` };

      // 弹出执行帧
      this.ctxService.popExecutionFrame(this.contextId, result);

      return result;
    } catch (error) {
      this.ctxService.popExecutionFrame(this.contextId, undefined, {
        code: 'SUB_AGENT_FAILED',
        message: (error as Error).message,
      });
      throw error;
    }
  }

  // 获取会话统计
  getStats() {
    return this.ctxService.getStats(this.contextId);
  }

  // 结束会话
  async endSession(): Promise<void> {
    // 归档上下文
    this.ctxService.archiveContext(this.contextId);

    // 更新持久化状态
    await this.sessionStore.save({
      id: this.sessionId,
      title: `对话-${new Date().toLocaleDateString()}`,
      status: SessionPersistenceStatus.CLOSED,
      tags: ['conversation'],
      metadata: {},
      contextWindow: {
        windowSize: 50,
        windowType: 'recent_messages',
        includeSystemMessages: true,
        includeToolCalls: true,
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      messageCount: this.ctxService.getMessages(this.contextId).length,
    });

    console.log(`会话已结束: ${this.sessionId}`);
  }

  private async callLLM(messages: Message[]): Promise<string> {
    // 实际实现中调用 LLM API
    return `已收到 ${messages.length} 条消息，正在分析...`;
  }
}

// ============================================================
// 第四步：使用 Agent
// ============================================================
const agent = new ConversationAgent(
  ctxService,
  windowManager,
  sessionStore,
  storageService,
  'agent_main',
  'CodeReviewer',
);

// 开始会话
await agent.startSession('session_20260703', 'user_1', 'Alice');

// 多轮对话
const response1 = await agent.processUserInput(
  'user_1', 'Alice', '请帮我审查 src/main.ts 的代码'
);
console.log(response1);

const response2 = await agent.processUserInput(
  'user_1', 'Alice', '类型定义有什么问题吗？'
);
console.log(response2);

// 调用子 Agent
const subResult = await agent.delegateToSubAgent('agent_linter', '检查代码风格');

// 查看统计
const stats = agent.getStats();
console.log(`消息数: ${stats?.messageCount}, Token: ${stats?.tokenEstimate}`);

// 结束会话
await agent.endSession();
```

---

## 11. 配置参考

### ContextManager 配置

```typescript
interface ContextManagerConfig {
  maxWindowSize?: number;      // 最大上下文窗口大小（消息数），默认 100
  ttl?: number;                // 上下文 TTL（毫秒），默认 3600000（1小时）
  compressMessages?: boolean;  // 启用消息压缩，默认 false
  persistStates?: boolean;     // 启用状态持久化，默认 false
  defaultNamespace?: string;   // 默认命名空间，默认 'default'
}

const DEFAULT_CONTEXT_CONFIG: Required<ContextManagerConfig> = {
  maxWindowSize: 100,
  ttl: 3600000,
  compressMessages: false,
  persistStates: false,
  defaultNamespace: 'default',
};
```

### ContextWindowManager 配置

```typescript
interface ContextWindowManagerConfig {
  defaultConfig?: Partial<ContextWindowConfig>;  // 默认窗口配置
  autoOptimize?: boolean;                        // 启用自动优化，默认 true
  maxWindowsPerContext?: number;                 // 每个上下文最大窗口数，默认 10
  charsPerToken?: number;                        // 每 Token 字符数估算，默认 4
}

interface ContextWindowConfig {
  windowSize: number;              // 窗口大小（消息数），默认 50
  windowType: ContextWindowType;   // 窗口类型，默认 RECENT_MESSAGES
  includeSystemMessages: boolean;  // 包含系统消息，默认 true
  includeToolCalls: boolean;       // 包含工具调用，默认 true
  maxTokens?: number;              // 最大 Token 限制，默认 4096
  timeWindowMinutes?: number;      // 时间窗口（分钟），默认 30
  overlapSize?: number;            // 滑动重叠大小，默认 5
}
```

### ContextService 配置

```typescript
interface ContextServiceConfig extends ContextManagerConfig {
  enablePropagation?: boolean;   // 启用上下文传播，默认 true
  maxNestingDepth?: number;      // 最大嵌套深度，默认 5
  autoCleanup?: boolean;         // 启用自动清理，默认 true
  cleanupInterval?: number;      // 清理间隔（毫秒），默认 60000
  enableCompression?: boolean;   // 启用上下文压缩，默认 false
}
```

### SessionPersistenceStorage 配置

```typescript
interface SessionPersistenceStorageConfig {
  storage: StorageService;    // 存储服务实例
  autoSave?: boolean;         // 变更时自动保存，默认 true
  entityTtl?: number;         // 实体 TTL（毫秒），默认 86400000（24小时）
}
```

### StorageService 操作配置

```typescript
interface TransactionOptions {
  isolation?: IsolationLevel;      // 隔离级别
  timeout?: number;                // 超时（毫秒）
  retryOnConflict?: boolean;       // 冲突时重试
}

interface QueryFilter {
  where?: Record<string, unknown>;     // AND 条件
  orWhere?: Record<string, unknown>;   // OR 条件
  orderBy?: OrderSpec[];               // 排序
  limit?: number;                      // 限制数量
  offset?: number;                     // 偏移量
  include?: string[];                  // 包含字段
  exclude?: string[];                  // 排除字段
  createdAfter?: number;              // 创建时间下限
  createdBefore?: number;             // 创建时间上限
  updatedAfter?: number;              // 更新时间下限
  updatedBefore?: number;             // 更新时间上限
}
```

---

## 12. 最佳实践

### 窗口大小配置

| 场景 | 推荐 windowType | 推荐 windowSize | 推荐 maxTokens |
|------|----------------|-----------------|----------------|
| 简单问答 | RECENT_MESSAGES | 20 | 2048 |
| 代码审查 | TOKEN_BASED | 50 | 8192 |
| 长文档分析 | TOKEN_BASED | 100 | 16384 |
| 多 Agent 协作 | TOKEN_BASED | 50 | 4096 |
| 实时对话 | RECENT_MINUTES | 100 | 4096 |

**原则**：
- 始终设置 `maxTokens` 限制，防止超出 LLM 上下文窗口
- 使用 `overlapSize` 保持窗口连续性，推荐 5-10 条
- 对于工具调用密集的场景，设置 `includeToolCalls: false` 可节省 Token

### 持久化策略

```
┌──────────────────────────────────────────────────────────┐
│                    持久化策略建议                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  高频更新（每次对话）:                                     │
│    → sessionStore.save() 更新会话元数据                   │
│    → 轻量级，仅更新 messageCount、lastActiveAt            │
│                                                          │
│  中频更新（每 N 轮对话）:                                  │
│    → storage.create() 保存对话摘要                        │
│    → 用于长期记忆和知识积累                                │
│                                                          │
│  低频更新（会话结束时）:                                    │
│    → sessionStore.save() 标记会话为 CLOSED                │
│    → 完整消息历史归档到长期存储                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**原则**：
- 不要在每轮对话后持久化完整消息历史（性能开销大）
- 使用 `autoSave: true` 让 SessionPersistenceStorage 自动管理保存
- 设置合理的 `entityTtl` 避免存储无限增长

### 记忆清理策略

```typescript
// 1. 定期清理过期上下文
setInterval(() => {
  ctxService.cleanup();
}, 5 * 60 * 1000); // 每5分钟

// 2. 定期清理过期存储实体
setInterval(async () => {
  await storageService.clearExpired();
}, 60 * 60 * 1000); // 每小时

// 3. 会话关闭时清理
async function gracefulShutdown() {
  // 停止自动清理
  ctxService.stopCleanupTimer();

  // 关闭所有活跃会话
  const contextIds = ctxService.getAllContextIds();
  for (const id of contextIds) {
    ctxService.archiveContext(id);
  }

  // 关闭持久化存储
  await sessionStore.close();

  // 关闭存储服务
  await storageService.close();

  // 释放上下文服务
  ctxService.dispose();
}
```

### 传播模式选择

| 场景 | 推荐模式 | 原因 |
|------|---------|------|
| 子 Agent 需要完整上下文 | DIRECT | 传递完整上下文，子 Agent 无需额外请求 |
| 大量子 Agent 并行调用 | REFERENCE | 仅传递 ID，减少内存和传输开销 |
| 高频短交互 | INCREMENTAL | 只传递增量变化，效率最高 |
| 不确定场景 | HYBRID | 自动根据上下文大小选择最优模式 |

### 常见陷阱

1. **未设置 maxTokens**：导致传递给 LLM 的上下文超出限制，响应被截断或报错
2. **忘记 cleanup**：长时间运行导致内存泄漏，上下文和条目不断累积
3. **状态未命名空间隔离**：不同模块的状态键冲突，导致数据覆盖
4. **持久化过于频繁**：每次消息都完整持久化，导致 I/O 瓶颈
5. **未处理过期**：过期上下文未清理，`get()` 返回 null 但资源未释放
6. **嵌套深度超限**：未检查 `maxNestingDepth`，导致无限递归调用

---

## 验收条件

| 序号 | 验收项 | 验收标准 |
|------|--------|----------|
| 1 | 记忆层次架构 | 实现 Working Memory → Episodic Memory → Semantic Memory 三层记忆 |
| 2 | 上下文管理 | ContextManager 支持创建、获取、归档、恢复、删除上下文 |
| 3 | 消息系统 | 支持 7 种消息类型、5 种内容格式、6 种附件类型 |
| 4 | 状态管理 | 支持 SESSION / PERSISTENT / TEMPORARY 三种状态类型，带命名空间隔离 |
| 5 | 上下文窗口 | 支持 4 种窗口类型，滑动窗口带重叠，Token 自动优化 |
| 6 | 上下文传播 | 支持 DIRECT / REFERENCE / INCREMENTAL / HYBRID 四种传播模式 |
| 7 | 执行帧栈 | 维护嵌套调用的父子关系，支持最大深度限制 |
| 8 | 会话持久化 | SessionPersistenceStorage 支持 save / load / list / delete / clear |
| 9 | 长期存储 | StorageService 支持 CRUD、批量操作、事务、查询、过期清理 |
| 10 | 完整示例 | 提供从初始化到多轮对话的完整可运行示例 |

---

## 与现有功能的关系

### 与 Agent 架构的协同

- Agent 通过 ContextManager 获取当前对话上下文
- Agent 执行结果通过消息系统写入上下文
- 子 Agent 调用通过 ContextService 传播上下文

### 与 Plugin 系统的集成

- Plugin 通过 ContextManager 访问会话上下文
- Plugin 可通过 ContextItem 在上下文中存储自定义数据
- Plugin 的生命周期与上下文生命周期关联

### 与 Storage 系统的协作

- SessionPersistenceStorage 底层依赖 StorageService 进行持久化
- 长期记忆使用 StorageService 存储结构化知识
- 上下文归档最终通过 StorageService 写入长期存储

### 与 Hooks 系统的集成

- ContextManager 的 EventEmitter 事件可被 Hooks 系统监听
- 状态变更（state:changed）触发对应的钩子回调
- 上下文生命周期事件（创建、归档、删除）可作为钩子点

---

## 术语定义

| 术语 | 定义 |
|------|------|
| Working Memory | 工作记忆，当前对话的即时上下文，对应 ContextManager |
| Episodic Memory | 情节记忆，跨会话的会话持久化，对应 SessionPersistenceStorage |
| Semantic Memory | 语义记忆，长期结构化数据存储，对应 StorageService |
| ContextWindow | 上下文窗口，控制 Agent 一次处理的消息范围 |
| Token Budget | Token 预算，LLM 调用的上下文大小限制 |
| ContextItem | 上下文条目，统一的上下文数据容器 |
| PropagationMode | 传播模式，上下文在 Agent 间传递的方式 |
| ExecutionFrame | 执行帧，嵌套调用的单次调用上下文信息 |
| SessionPersistence | 会话持久化，将会话状态保存到存储后端 |
| SessionAdapter | 会话适配器，在 Plugin 层和持久化层之间转换会话格式 |

---

## 相关文档

- feature-008-context-management.md — 上下文管理服务系统
- feature-012-storage-system.md — Storage 存储系统架构
- feature-015-agent-sdk.md — Agent SDK
- feature-016-sub-agents.md — 子 Agent 系统
- feature-017-hooks-system.md — Hooks & Middleware 钩子系统
- architecture.md — 系统架构设计