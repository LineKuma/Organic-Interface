# 功能文档：上下文管理服务系统

## 基本信息

**文档编号**: DOC-008
**所属模块**: 核心架构
**优先级**: P1
**创建日期**: 2026-04-15
**对应需求章节**: 3.2 智能协作需求

---

## 功能概述

上下文管理服务是Organic-Interface的核心能力模块，负责管理和维护Agent执行任务所需的完整上下文信息。系统通过统一的上下文管理机制，实现对话历史的持久化、状态信息的跟踪、以及上下文在多Agent间的传播共享。上下文管理是Agent架构的重要支撑，为智能协作提供记忆和连续性保障。

---

## 设计理念

### 上下文管理定位

上下文管理服务承担以下核心职责：

**历史记忆管理**：维护Agent与用户对话的完整历史，支持消息的增删改查操作，确保对话上下文的完整性和可追溯性。

**状态追踪维护**：管理Agent执行过程中的各种状态信息，包括会话状态、任务状态、临时变量等，为Agent决策提供状态依据。

**上下文传播共享**：支持上下文在多个Agent之间的传递和共享，确保协作场景下各Agent能够访问必要的上下文信息。

**生命周期管理**：管理上下文的创建、更新、过期和销毁全过程，优化内存使用并确保数据一致性。

### 架构优势

- **统一抽象**：提供标准化的上下文访问接口，简化Agent开发
- **高效检索**：支持快速定位和检索历史消息，提升响应效率
- **灵活传播**：支持多种上下文传播策略，适应不同协作场景
- **资源优化**：自动管理上下文生命周期，避免内存泄漏
- **可扩展性**：支持自定义上下文类型，满足特定业务需求

---

## 对话上下文管理

### 对话上下文模型

对话上下文是Agent与用户交互过程的信息载体，包含完整的交互历史和相关信息：

```typescript
/**
 * 对话上下文
 * 存储一次完整对话的所有相关信息
 */
interface ConversationContext {
  /** 上下文唯一标识 */
  id: string;

  /** 会话标识，关联多个相关上下文 */
  session_id: string;

  /** 对话参与者列表 */
  participants: Participant[];

  /** 消息历史，按时间顺序排列 */
  messages: Message[];

  /** 上下文元数据 */
  metadata: ContextMetadata;

  /** 创建时间戳 */
  created_at: number;

  /** 最后更新时间戳 */
  updated_at: number;

  /** 上下文过期时间 */
  expires_at?: number;
}

/**
 * 参与者信息
 */
interface Participant {
  /** 参与者标识 */
  id: string;

  /** 参与者类型 */
  type: 'user' | 'agent' | 'plugin';

  /** 参与者名称 */
  name: string;

  /** 参与者角色 */
  role: ParticipantRole;
}

/**
 * 参与者角色枚举
 */
enum ParticipantRole {
  /** 系统管理员 */
  ADMIN = 'admin',
  /** 普通用户 */
  USER = 'user',
  /** 助手角色 */
  ASSISTANT = 'assistant',
  /** 工具角色 */
  TOOL = 'tool',
  /** 系统角色 */
  SYSTEM = 'system',
}
```

### 消息结构定义

消息是对话上下文的基本组成单元，每个消息包含发送者、内容和元数据：

```typescript
/**
 * 消息结构
 * 对话中的基本通信单元
 */
interface Message {
  /** 消息唯一标识 */
  id: string;

  /** 消息发送者 */
  sender: MessageSender;

  /** 消息内容 */
  content: MessageContent;

  /** 消息类型 */
  type: MessageType;

  /** 关联的工具调用 */
  tool_call?: ToolCall;

  /** 关联的工具响应 */
  tool_response?: ToolResponse;

  /** 消息时间戳 */
  timestamp: number;

  /** 消息状态 */
  status: MessageStatus;

  /** 消息标记 */
  flags: MessageFlag[];

  /** 回复目标消息ID */
  reply_to?: string;
}

/**
 * 消息发送者
 */
interface MessageSender {
  /** 发送者标识 */
  id: string;

  /** 发送者类型 */
  type: 'user' | 'agent' | 'system' | 'plugin';

  /** 发送者名称 */
  name: string;
}

/**
 * 消息内容
 */
interface MessageContent {
  /** 文本内容 */
  text?: string;

  /** 多模态内容 */
  attachments?: Attachment[];

  /** 结构化数据 */
  structured_data?: Record<string, any>;

  /** 内容格式 */
  format: ContentFormat;
}

/**
 * 内容格式枚举
 */
enum ContentFormat {
  PLAIN_TEXT = 'plain_text',
  MARKDOWN = 'markdown',
  HTML = 'html',
  JSON = 'json',
  CODE = 'code',
}

/**
 * 附件结构
 */
interface Attachment {
  /** 附件类型 */
  type: AttachmentType;

  /** 附件URL或路径 */
  url: string;

  /** 附件名称 */
  name: string;

  /** 附件大小 */
  size?: number;

  /** MIME类型 */
  mime_type: string;

  /** 缩略图URL */
  thumbnail?: string;
}

/**
 * 附件类型枚举
 */
enum AttachmentType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  CODE_FILE = 'code_file',
  OTHER = 'other',
}

/**
 * 消息类型枚举
 */
enum MessageType {
  /** 用户消息 */
  USER_MESSAGE = 'user_message',
  /** 助手回复 */
  ASSISTANT_MESSAGE = 'assistant_message',
  /** 系统消息 */
  SYSTEM_MESSAGE = 'system_message',
  /** 工具调用 */
  TOOL_CALL = 'tool_call',
  /** 工具响应 */
  TOOL_RESPONSE = 'tool_response',
  /** 错误消息 */
  ERROR_MESSAGE = 'error_message',
  /** 状态更新 */
  STATUS_UPDATE = 'status_update',
}

/**
 * 消息状态枚举
 */
enum MessageStatus {
  /** 发送中 */
  SENDING = 'sending',
  /** 已发送 */
  SENT = 'sent',
  /** 已读 */
  READ = 'read',
  /** 已处理 */
  PROCESSED = 'processed',
  /** 失败 */
  FAILED = 'failed',
}

/**
 * 消息标记枚举
 */
enum MessageFlag {
  /** 已标记 */
  FLAGGED = 'flagged',
  /** 已收藏 */
  STARRED = 'starred',
  /** 已删除 */
  DELETED = 'deleted',
  /** 已归档 */
  ARCHIVED = 'archived',
  /** 私密消息 */
  PRIVATE = 'private',
}
```

### 上下文窗口管理

上下文窗口用于控制Agent一次处理的消息范围，解决长对话场景下的token限制问题：

```typescript
/**
 * 上下文窗口配置
 */
interface ContextWindowConfig {
  /** 窗口大小（消息数） */
  window_size: number;

  /** 窗口类型 */
  window_type: ContextWindowType;

  /** 是否包含系统消息 */
  include_system_messages: boolean;

  /** 是否包含工具调用 */
  include_tool_calls: boolean;

  /** 最大token数限制 */
  max_tokens?: number;
}

/**
 * 上下文窗口类型
 */
enum ContextWindowType {
  /** 最近N条消息 */
  RECENT_MESSAGES = 'recent_messages',
  /** 最近N分钟内 */
  RECENT_MINUTES = 'recent_minutes',
  /** 基于Token数量 */
  TOKEN_BASED = 'token_based',
  /** 基于语义相关性 */
  SEMANTIC_BASED = 'semantic_based',
}

/**
 * 上下文窗口
 * 表示一次Agent调用可访问的消息范围
 */
interface ContextWindow {
  /** 窗口标识 */
  id: string;

  /** 所属上下文ID */
  context_id: string;

  /** 包含的消息列表 */
  messages: Message[];

  /** 窗口配置 */
  config: ContextWindowConfig;

  /** 窗口token数 */
  token_count: number;

  /** 创建时间 */
  created_at: number;
}
```

---

## 状态管理机制

### 状态分类体系

系统中的状态信息分为三大类别：

**会话状态**：与当前对话会话相关的状态信息，包括会话配置、用户偏好、对话阶段等。会话状态在会话结束后可以选择保留或清除。

**持久化状态**：需要在多个会话之间保持的状态信息，包括用户信息、项目配置、长期记忆等。持久化状态存储在外部存储系统中。

**临时状态**：仅在单个任务执行过程中有效的状态信息，包括任务变量、中间结果、计算缓存等。任务完成后临时状态自动清除。

```typescript
/**
 * 状态条目
 * 通用状态存储单元
 */
interface StateItem<T = any> {
  /** 状态键 */
  key: string;

  /** 状态值 */
  value: T;

  /** 状态类型 */
  type: StateType;

  /** 命名空间，用于状态隔离 */
  namespace: string;

  /** 创建时间 */
  created_at: number;

  /** 更新时间 */
  updated_at: number;

  /** 过期时间 */
  expires_at?: number;

  /** 是否只读 */
  readonly?: boolean;
}

/**
 * 状态类型枚举
 */
enum StateType {
  /** 会话状态 */
  SESSION = 'session',
  /** 持久化状态 */
  PERSISTENT = 'persistent',
  /** 临时状态 */
  TEMPORARY = 'temporary',
}

/**
 * 状态变更记录
 */
interface StateChange {
  /** 变更标识 */
  id: string;

  /** 状态键 */
  key: string;

  /** 命名空间 */
  namespace: string;

  /** 变更前的值 */
  old_value?: any;

  /** 变更后的值 */
  new_value: any;

  /** 变更类型 */
  change_type: StateChangeType;

  /** 变更原因 */
  reason?: string;

  /** 变更时间 */
  timestamp: number;
}

/**
 * 状态变更类型枚举
 */
enum StateChangeType {
  SET = 'set',
  UPDATE = 'update',
  DELETE = 'delete',
  CLEAR = 'clear',
}
```

### 状态存储接口

```typescript
/**
 * 状态存储服务接口
 */
interface StateStorageService {
  // ==================== 基本操作 ====================
  /**
   * 获取状态值
   */
  get<T>(key: string, namespace?: string): T | undefined;

  /**
   * 设置状态值
   */
  set<T>(key: string, value: T, options?: StateOptions): void;

  /**
   * 删除状态值
   */
  delete(key: string, namespace?: string): boolean;

  /**
   * 检查状态是否存在
   */
  has(key: string, namespace?: string): boolean;

  /**
   * 清空命名空间
   */
  clear(namespace: string): void;

  // ==================== 批量操作 ====================
  /**
   * 批量获取状态
   */
  getMany<T>(keys: string[], namespace?: string): Map<string, T>;

  /**
   * 批量设置状态
   */
  setMany<T>(items: Record<string, T>, namespace?: string): void;

  // ==================== 查询操作 ====================
  /**
   * 获取命名空间下所有键
   */
  keys(namespace?: string): string[];

  /**
   * 获取命名空间下所有状态
   */
  entries<T>(namespace?: string): Map<string, T>;

  /**
   * 获取状态数量
   */
  size(namespace?: string): number;

  // ==================== 观察者模式 ====================
  /**
   * 订阅状态变更
   */
  subscribe(
    keys: string | string[],
    callback: StateChangeCallback,
    namespace?: string
  ): UnsubscribeFn;

  /**
   * 监听命名空间变更
   */
  watch(namespace: string, callback: (change: StateChange) => void): UnsubscribeFn;
}

/**
 * 状态选项
 */
interface StateOptions {
  expires_at?: number;
  readonly?: boolean;
  merge?: boolean;
}

/**
 * 状态变更回调函数
 */
type StateChangeCallback = (change: StateChange) => void;

/**
 * 取消订阅函数
 */
type UnsubscribeFn = () => void;
```

---

## 上下文传播机制

### 传播机制概述

上下文传播是实现多Agent协作的关键机制。系统支持多种上下文传播方式，适应不同的协作场景：

**直接传播**：在调用子Agent时直接传递当前上下文，确保子Agent能够访问完整的历史信息。

**引用传播**：仅传递上下文的引用（ID），子Agent按需加载完整上下文，减少数据传输量。

**增量传播**：只传递上下文的变化部分（增量），适用于频繁通信的高效传输场景。

**混合传播**：结合多种传播策略，根据场景自动选择最优方式。

```typescript
/**
 * 上下文传播请求
 */
interface ContextPropagationRequest {
  /** 源上下文标识 */
  source_context_id: string;

  /** 目标Agent标识 */
  target_agent_id: string;

  /** 传播模式 */
  mode: PropagationMode;

  /** 传播范围配置 */
  scope: PropagationScope;

  /** 过滤条件 */
  filters?: ContextFilter[];

  /** 传播选项 */
  options?: PropagationOptions;
}

/**
 * 传播模式枚举
 */
enum PropagationMode {
  /** 直接传播，传递完整上下文 */
  DIRECT = 'direct',
  /** 引用传播，仅传递上下文引用 */
  REFERENCE = 'reference',
  /** 增量传播，传递变化部分 */
  INCREMENTAL = 'incremental',
  /** 混合传播，自动选择 */
  HYBRID = 'hybrid',
}

/**
 * 传播范围配置
 */
interface PropagationScope {
  /** 是否包含消息历史 */
  include_messages: boolean;

  /** 是否包含状态信息 */
  include_states: boolean;

  /** 是否包含工具调用历史 */
  include_tool_calls: boolean;

  /** 是否包含附件 */
  include_attachments: boolean;

  /** 消息时间范围 */
  message_time_range?: TimeRange;

  /** 消息数量限制 */
  message_limit?: number;
}

/**
 * 上下文过滤条件
 */
interface ContextFilter {
  /** 过滤类型 */
  type: ContextFilterType;

  /** 过滤条件值 */
  value: any;

  /** 过滤条件参数 */
  params?: Record<string, any>;
}

/**
 * 上下文过滤类型枚举
 */
enum ContextFilterType {
  /** 消息类型过滤 */
  MESSAGE_TYPE = 'message_type',
  /** 发送者过滤 */
  SENDER = 'sender',
  /** 时间范围过滤 */
  TIME_RANGE = 'time_range',
  /** 内容关键词过滤 */
  CONTENT_KEYWORD = 'content_keyword',
  /** 标记过滤 */
  FLAG = 'flag',
}

/**
 * 传播选项
 */
interface PropagationOptions {
  /** 是否复制上下文 */
  copy?: boolean;

  /** 是否保留敏感信息 */
  preserve_sensitive?: boolean;

  /** 传播优先级 */
  priority?: Priority;

  /** 超时时间 */
  timeout?: number;
}

/**
 * 优先级枚举
 */
enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}
```

### 嵌套调用上下文管理

在Agent嵌套调用场景下，上下文需要正确维护父子关系和执行栈：

```typescript
/**
 * 执行上下文栈
 * 维护嵌套调用的上下文层次
 */
interface ExecutionContextStack {
  /** 根上下文ID */
  root_context_id: string;

  /** 当前上下文栈 */
  stack: ExecutionFrame[];

  /** 上下文深度 */
  depth: number;

  /** 最大嵌套深度 */
  max_depth: number;
}

/**
 * 执行帧
 * 单次Agent调用的上下文信息
 */
interface ExecutionFrame {
  /** 帧标识 */
  id: string;

  /** 关联的上下文 */
  context_id: string;

  /** Agent标识 */
  agent_id: string;

  /** 父帧标识 */
  parent_frame_id?: string;

  /** 子帧列表 */
  child_frame_ids: string[];

  /** 进入时间 */
  enter_time: number;

  /** 退出时间 */
  exit_time?: number;

  /** 执行状态 */
  status: ExecutionStatus;

  /** 执行结果 */
  result?: any;

  /** 错误信息 */
  error?: ContextError;
}

/**
 * 执行状态枚举
 */
enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING = 'waiting',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * 上下文错误
 */
interface ContextError {
  code: ContextErrorCode;
  message: string;
  details?: any;
}

/**
 * 上下文错误代码枚举
 */
enum ContextErrorCode {
  CONTEXT_NOT_FOUND = 'context_not_found',
  CONTEXT_EXPIRED = 'context_expired',
  CONTEXT_OVERFLOW = 'context_overflow',
  CONTEXT_CORRUPTED = 'context_corrupted',
  PROPAGATION_FAILED = 'propagation_failed',
  STATE_CONFLICT = 'state_conflict',
  MAX_DEPTH_EXCEEDED = 'max_depth_exceeded',
}
```

---

## 上下文生命周期管理

### 生命周期阶段

上下文从创建到销毁经历以下阶段：

**创建阶段**：初始化上下文对象，分配唯一标识，设置初始状态。

**活跃阶段**：上下文处于正常使用状态，可以进行读写操作。

**闲置阶段**：上下文长时间未访问，可以被压缩或转移。

**过期阶段**：上下文达到过期时间，需要被清理或归档。

**销毁阶段**：上下文被永久删除，相关资源被释放。

```typescript
/**
 * 上下文生命周期管理器
 */
interface ContextLifecycleManager {
  /**
   * 创建新上下文
   */
  create(request: CreateContextRequest): Promise<ConversationContext>;

  /**
   * 获取上下文
   */
  get(contextId: string): Promise<ConversationContext | null>;

  /**
   * 更新上下文
   */
  update(contextId: string, updates: ContextUpdates): Promise<ConversationContext>;

  /**
   * 删除上下文
   */
  delete(contextId: string): Promise<void>;

  /**
   * 归档上下文
   */
  archive(contextId: string): Promise<void>;

  /**
   * 恢复上下文
   */
  restore(contextId: string): Promise<ConversationContext>;

  /**
   * 清理过期上下文
   */
  cleanup(): Promise<CleanupResult>;
}

/**
 * 创建上下文请求
 */
interface CreateContextRequest {
  session_id: string;
  participants: Participant[];
  initial_message?: Message;
  metadata?: Record<string, any>;
  ttl?: number;
}

/**
 * 上下文更新
 */
interface ContextUpdates {
  messages?: Message[];
  participants?: Participant[];
  metadata?: Record<string, any>;
  expires_at?: number;
}

/**
 * 清理结果
 */
interface CleanupResult {
  deleted_count: number;
  archived_count: number;
  freed_memory: number;
}
```

### 内存管理策略

**LRU缓存**：最近使用的上下文保留在内存中，长时间未访问的上下文被移出内存。

**自动压缩**：对于过大的上下文，自动进行摘要压缩，减少内存占用。

**延迟加载**：非活跃上下文的详细内容延迟加载，只在需要时从存储加载。

**批量清理**：定期执行批量清理操作，删除过期上下文释放资源。

---

## 数据模型定义

### ContextItem条目结构

```typescript
/**
 * 上下文条目
 * 上下文中可存储的通用条目
 */
interface ContextItem {
  /** 唯一标识 */
  id: string;

  /** 条目类型 */
  type: ContextItemType;

  /** 条目内容 */
  content: any;

  /** 关联的上下文ID */
  context_id: string;

  /** 创建时间 */
  created_at: number;

  /** 访问时间 */
  accessed_at: number;

  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * 上下文条目类型
 */
enum ContextItemType {
  MESSAGE = 'message',
  STATE = 'state',
  TOOL_CALL = 'tool_call',
  RESULT = 'result',
  ATTACHMENT = 'attachment',
  CUSTOM = 'custom',
}
```

### ContextState状态结构

```typescript
/**
 * 上下文状态
 * 完整的上下文运行时状态
 */
interface ContextState {
  /** 上下文ID */
  context_id: string;

  /** 当前状态 */
  status: ContextStatus;

  /** 活跃的Agent列表 */
  active_agents: string[];

  /** 锁定的状态键 */
  locked_keys: string[];

  /** 观察者列表 */
  observers: ContextObserver[];

  /** 统计信息 */
  stats: ContextStats;

  /** 最后活跃时间 */
  last_active_at: number;

  /** 引用计数 */
  ref_count: number;
}

/**
 * 上下文状态枚举
 */
enum ContextStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  IDLE = 'idle',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

/**
 * 上下文统计
 */
interface ContextStats {
  message_count: number;
  token_count: number;
  tool_call_count: number;
  participant_count: number;
  created_at: number;
  last_message_at: number;
}

/**
 * 上下文观察者
 */
interface ContextObserver {
  observer_id: string;
  observer_type: 'agent' | 'plugin' | 'system';
  events: ContextEvent[];
  registered_at: number;
}

/**
 * 上下文事件枚举
 */
enum ContextEvent {
  MESSAGE_ADDED = 'message_added',
  STATE_CHANGED = 'state_changed',
  AGENT_ENTERED = 'agent_entered',
  AGENT_EXITED = 'agent_exited',
  CONTEXT_EXPIRED = 'context_expired',
  CONTEXT_CLOSED = 'context_closed',
}
```

---

## ContextService接口定义

```typescript
/**
 * 上下文服务接口
 */
interface ContextService {
  // ==================== 上下文管理 ====================
  /**
   * 创建新上下文
   */
  create_context(request: CreateContextRequest): Promise<ConversationContext>;

  /**
   * 获取上下文
   */
  get_context(context_id: string): Promise<ConversationContext | null>;

  /**
   * 删除上下文
   */
  delete_context(context_id: string): Promise<void>;

  // ==================== 消息操作 ====================
  /**
   * 添加消息
   */
  add_message(context_id: string, message: Message): Promise<void>;

  /**
   * 获取消息列表
   */
  get_messages(context_id: string, options?: GetMessagesOptions): Promise<Message[]>;

  /**
   * 更新消息
   */
  update_message(context_id: string, message_id: string, updates: Partial<Message>): Promise<void>;

  /**
   * 删除消息
   */
  delete_message(context_id: string, message_id: string): Promise<void>;

  // ==================== 上下文窗口 ====================
  /**
   * 获取上下文窗口
   */
  get_context_window(context_id: string, config: ContextWindowConfig): Promise<ContextWindow>;

  // ==================== 状态管理 ====================
  /**
   * 获取状态
   */
  get_state<T>(context_id: string, key: string): T | undefined;

  /**
   * 设置状态
   */
  set_state<T>(context_id: string, key: string, value: T, options?: StateOptions): void;

  /**
   * 删除状态
   */
  delete_state(context_id: string, key: string): boolean;

  /**
   * 监听状态变更
   */
  watch_state(context_id: string, callback: StateChangeCallback): UnsubscribeFn;

  // ==================== 上下文传播 ====================
  /**
   * 传播上下文
   */
  propagate(request: ContextPropagationRequest): Promise<PropagationResult>;

  /**
   * 合并上下文
   */
  merge(source_id: string, target_id: string): Promise<ConversationContext>;
}

/**
 * 获取消息选项
 */
interface GetMessagesOptions {
  limit?: number;
  offset?: number;
  types?: MessageType[];
  senders?: string[];
  since?: number;
  until?: number;
  include_deleted?: boolean;
}

/**
 * 传播结果
 */
interface PropagationResult {
  success: boolean;
  propagated_context_id?: string;
  error?: ContextError;
}
```

---

## 验收条件

| 序号 | 验收项               | 验收标准                                                                |
| ---- | -------------------- | ----------------------------------------------------------------------- |
| 1    | 对话上下文模型       | ConversationContext包含id、session_id、messages、participants等完整字段 |
| 2    | 消息结构定义         | Message包含id、sender、content、type、timestamp等完整字段               |
| 3    | 上下文窗口管理       | 支持RECENT_MESSAGES、TOKEN_BASED等窗口类型配置                          |
| 4    | 状态类型分类         | 区分SESSION、PERSISTENT、TEMPORARY三种状态类型                          |
| 5    | 状态存储接口         | StateStorageService提供get、set、delete、subscribe等核心方法            |
| 6    | 传播机制实现         | 支持DIRECT、REFERENCE、INCREMENTAL、HYBRID四种传播模式                  |
| 7    | 嵌套调用管理         | ExecutionContextStack维护父子关系和执行栈                               |
| 8    | 生命周期管理         | 包含创建、活跃、闲置、过期、销毁五个阶段                                |
| 9    | ContextItem数据模型  | 包含id、type、content、context_id等完整字段                             |
| 10   | ContextState数据模型 | 包含status、active_agents、stats等完整字段                              |
| 11   | 文档编号             | 文档编号为DOC-008，与feature-007保持一致的结构风格                      |

---

## 与现有功能的关系

### 与Agent架构的协同

上下文管理是Agent执行的基础支撑：

- Agent通过ContextService获取任务相关上下文
- Agent执行结果存储到上下文供后续使用
- 多Agent协作通过上下文传播实现信息共享

### 与任务调度的协作

任务调度依赖上下文管理：

- 任务状态保存在上下文状态中
- 任务中断后通过上下文恢复执行
- 任务完成后上下文可以归档或清理

### 与Plugin系统的集成

Plugin可以通过ContextService访问和操作上下文：

- Plugin可以注册为上下文观察者
- Plugin可以向上下文添加消息
- Plugin可以读写上下文状态

---

## 术语定义

| 术语                | 定义                                    |
| ------------------- | --------------------------------------- |
| ConversationContext | 对话上下文，存储一次完整对话的所有信息  |
| ContextWindow       | 上下文窗口，控制Agent一次处理的消息范围 |
| StateItem           | 状态条目，上下文中的可存储状态单元      |
| PropagationMode     | 传播模式，上下文在Agent间传递的方式     |
| ExecutionFrame      | 执行帧，嵌套调用的单次调用上下文信息    |

---

## 相关文档

- feature-001-agent-architecture.md - Agent架构设计
- feature-006-plugin-spec.md - Plugin插件系统架构
- feature-007-tool-system.md - 工具调用服务系统
- feature-009-workflow-engine.md - 工作流引擎设计
