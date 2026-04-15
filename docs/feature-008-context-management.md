# 功能文档：对话上下文管理与状态控制系统

## 基本信息

**文档编号**: DOC-008
**所属模块**: 核心架构
**优先级**: P1
**创建日期**: 2026-04-15
**对应需求章节**: 2.2

---

## 功能概述

对话上下文管理与状态控制系统是Organic-Interface的核心支撑模块，负责维护Agent运行过程中的所有上下文信息和状态数据。系统通过标准化的上下文模型实现对话历史的完整记录、状态数据的持久化、以及上下文在多Agent间的可靠传播，确保复杂任务执行过程中信息的一致性和可追溯性。

---

## 设计理念

### 上下文管理定位

上下文管理模块是Agent架构的核心支撑，承担以下关键职责：

**信息持久化**：将对话过程中的所有交互信息持久化存储，支持跨会话恢复和历史追溯。

**状态维护**：管理Agent运行时的各种状态数据，包括会话状态、任务状态、系统状态等。

**信息传递**：实现上下文在多Agent、多层级间的可靠传递，确保信息完整流转。

**资源优化**：通过上下文窗口管理和信息压缩技术，控制资源消耗同时保持核心信息完整性。

### 架构设计原则

- **标准化接口**：所有上下文操作通过统一接口进行，降低模块间耦合度
- **分层管理**：区分对话上下文、状态上下文、系统上下文，分类管理
- **事务性保障**：关键操作支持事务回滚，确保数据一致性
- **可扩展架构**：支持自定义上下文类型和存储后端

---

## 对话上下文管理

### 对话上下文模型

对话上下文是Agent与用户交互过程中产生的所有信息的集合，包含以下核心要素：

**消息历史记录**：按时间顺序记录所有对话消息，每条消息包含发送者、接收者、内容、时间戳等元数据。消息历史支持全文检索和语义检索，便于Agent快速定位相关信息。

**角色定义体系**：系统支持多角色定义，包括用户(User)、助手(Assistant)、系统(System)、工具(Tool)等角色。每种角色有明确的权限边界和行为规范，确保对话交互的规范性。

**上下文窗口机制**：采用滑动窗口策略管理消息历史，窗口大小可根据配置和实际需求动态调整。超出窗口范围的历史消息自动归档存储，但仍可通过检索访问。

### 上下文窗口配置

```typescript
/**
 * 上下文窗口配置
 * 控制消息历史的保留范围和淘汰策略
 */
interface ContextWindowConfig {
  /** 窗口最大消息数量 */
  max_messages: number;

  /** 窗口最大Token数量 */
  max_tokens: number;

  /** 超出窗口时的淘汰策略 */
  eviction_strategy: EvictionStrategy;

  /** 是否保留系统消息 */
  preserve_system_messages: boolean;

  /** 是否保留工具调用记录 */
  preserve_tool_calls: boolean;

  /** 上下文压缩阈值 */
  compression_threshold: number;
}

/**
 * 淘汰策略枚举
 */
enum EvictionStrategy {
  /** 先进先出，按时间顺序淘汰最旧消息 */
  FIFO = "fifo",
  /** 按相关性淘汰，保留高相关性消息 */
  RELEVANCE = "relevance",
  /** 按重要性淘汰，保留重要消息 */
  IMPORTANCE = "importance",
  /** 混合策略，综合考虑多个维度 */
  HYBRID = "hybrid"
}
```

### 消息结构定义

```typescript
/**
 * 对话消息
 * 对话上下文的基本组成单元
 */
interface ConversationMessage {
  /** 消息唯一标识 */
  message_id: string;

  /** 消息所属会话标识 */
  session_id: string;

  /** 发送者角色 */
  role: MessageRole;

  /** 发送者标识 */
  sender: string;

  /** 消息内容 */
  content: MessageContent;

  /** 消息时间戳 */
  timestamp: number;

  /** 消息元数据 */
  metadata: MessageMetadata;

  /** 关联的工具调用（如有） */
  tool_calls?: ToolCall[];

  /** 父消息ID（用于消息树结构） */
  parent_id?: string;
}

/**
 * 消息角色枚举
 */
enum MessageRole {
  /** 系统消息 */
  SYSTEM = "system",
  /** 用户消息 */
  USER = "user",
  /** 助手/Agent消息 */
  ASSISTANT = "assistant",
  /** 工具执行结果 */
  TOOL = "tool",
  /** 观察者消息 */
  OBSERVER = "observer"
}

/**
 * 消息内容结构
 */
interface MessageContent {
  /** 文本内容 */
  text: string;

  /** 多模态内容 */
  attachments?: Attachment[];

  /** 引用内容 */
  references?: ContentReference[];
}
```

---

## 状态管理机制

### 状态类型分类

系统中的状态数据分为三类，分别采用不同的管理策略：

**会话状态(Session State)**：与当前会话生命周期绑定的状态数据，随会话创建而创建，随会话结束而销毁。会话状态存储在内存中，具有最高的访问效率，适用于频繁读写的数据。

**持久化状态(Persistent State)**：需要长期保存的状态数据，跨会话存在。持久化状态存储在数据库或文件系统中，支持事务操作和数据恢复，适用于用户配置、历史记录等数据。

**临时状态(Temporary State)**：仅在特定操作周期内有效的状态数据，操作完成后自动清理。临时状态用于缓存、中间计算结果等场景，避免持久化存储的I/O开销。

### 状态管理接口

```typescript
/**
 * 状态管理服务接口
 * 提供统一的状态存取和管理能力
 */
interface StateManagementService {
  // ==================== 会话状态 ====================
  /**
   * 获取会话状态
   * @param session_id 会话标识
   * @param key 状态键
   * @returns 状态值，不存在则返回undefined
   */
  get_session_state(session_id: string, key: string): any;

  /**
   * 设置会话状态
   * @param session_id 会话标识
   * @param key 状态键
   * @param value 状态值
   */
  set_session_state(session_id: string, key: string, value: any): void;

  /**
   * 删除会话状态
   * @param session_id 会话标识
   * @param key 状态键
   */
  delete_session_state(session_id: string, key: string): void;

  /**
   * 获取会话所有状态
   * @param session_id 会话标识
   * @returns 会话状态对象
   */
  get_all_session_states(session_id: string): Record<string, any>;

  // ==================== 持久化状态 ====================
  /**
   * 获取持久化状态
   * @param category 状态分类
   * @param key 状态键
   * @returns 状态值
   */
  get_persistent_state(category: string, key: string): Promise<any>;

  /**
   * 设置持久化状态
   * @param category 状态分类
   * @param key 状态键
   * @param value 状态值
   */
  set_persistent_state(category: string, key: string, value: any): Promise<void>;

  /**
   * 删除持久化状态
   * @param category 状态分类
   * @param key 状态键
   */
  delete_persistent_state(category: string, key: string): Promise<void>;

  // ==================== 临时状态 ====================
  /**
   * 设置临时状态
   * @param key 状态键
   * @param value 状态值
   * @param ttl 存活时间（秒）
   */
  set_temporary_state(key: string, value: any, ttl: number): void;

  /**
   * 获取临时状态
   * @param key 状态键
   * @returns 状态值，不存在或已过期返回undefined
   */
  get_temporary_state(key: string): any;

  /**
   * 批量清理过期临时状态
   */
  cleanup_expired_states(): void;
}
```

### 状态生命周期

```
创建 -> 活跃 -> 更新 -> 持久化（如需要） -> 清理/归档
```

状态类型分类如下：

- **会话状态**：创建时机为会话建立，销毁时机为会话结束，存储位置为内存
- **持久化状态**：创建时机为首次设置，销毁时机为显式删除，存储位置为数据库/文件系统
- **临时状态**：创建时机为设置时指定TTL，销毁时机为TTL过期或显式删除，存储位置为内存/缓存

---

## 上下文传播机制

### Agent间上下文传递

多Agent协作场景中，上下文传播是确保信息一致传递的关键机制：

**上下文继承**：下级Agent自动继承上级Agent的上下文视图，包括对话历史和相关状态。继承是深拷贝还是引用取决于配置和安全策略。

**上下文隔离**：同级的并行Agent默认使用独立的上下文空间，避免相互干扰。特殊场景下可配置上下文共享。

**上下文同步**：Agent执行过程中对上下文的修改需要同步回父级Agent。同步采用异步机制，不阻塞Agent执行。

### 嵌套调用上下文处理

嵌套调用场景中，上下文管理需要处理多层级的调用链：

```typescript
/**
 * 嵌套调用上下文
 * 描述Agent嵌套调用时的上下文结构
 */
interface NestedCallContext {
  /** 调用链标识 */
  call_chain_id: string;

  /** 当前调用层级 */
  current_depth: number;

  /** 最大允许层级 */
  max_depth: number;

  /** 调用栈 */
  call_stack: CallStackEntry[];

  /** 当前上下文快照 */
  context_snapshot: ContextSnapshot;

  /** 上下文差异（相对于父级） */
  context_diff: ContextDiff;
}

/**
 * 调用栈条目
 */
interface CallStackEntry {
  /** Agent标识 */
  agent_id: string;

  /** Agent名称 */
  agent_name: string;

  /** 调用时间 */
  timestamp: number;

  /** 调用参数 */
  parameters: any;

  /** 返回结果 */
  result?: any;
}

/**
 * 上下文快照
 */
interface ContextSnapshot {
  /** 快照时间戳 */
  timestamp: number;

  /** 对话历史摘要 */
  history_summary: HistorySummary;

  /** 当前状态 */
  current_state: Record<string, any>;

  /** 关键变量 */
  key_variables: Record<string, any>;
}
```

### 上下文传播策略

上下文传播策略分类如下：

- **完全复制**：适用于安全隔离场景，子Agent获得完整上下文副本
- **增量传递**：适用于资源敏感场景，只传递上下文差异部分
- **引用共享**：适用于高频访问场景，共享只读上下文，修改时复制
- **层级过滤**：适用于隐私保护场景，根据层级过滤敏感信息

---

## 上下文数据结构

### 核心数据模型

```typescript
/**
 * 上下文项
 * 上下文中存储的基本数据单元
 */
interface ContextItem {
  /** 上下文项唯一标识 */
  item_id: string;

  /** 上下文项类型 */
  item_type: ContextItemType;

  /** 上下文项键名 */
  key: string;

  /** 上下文项值 */
  value: any;

  /** 上下文项元数据 */
  metadata: ContextItemMetadata;

  /** 创建时间戳 */
  created_at: number;

  /** 最后访问时间戳 */
  accessed_at: number;

  /** 最后修改时间戳 */
  modified_at: number;

  /** 访问计数 */
  access_count: number;

  /** 优先级（用于淘汰策略） */
  priority: number;

  /** 过期时间戳（可选） */
  expires_at?: number;
}

/**
 * 上下文项类型
 */
enum ContextItemType {
  /** 消息类型 */
  MESSAGE = "message",
  /** 状态类型 */
  STATE = "state",
  /** 配置类型 */
  CONFIG = "config",
  /** 元数据类型 */
  METADATA = "metadata",
  /** 工具调用类型 */
  TOOL_CALL = "tool_call",
  /** 结果类型 */
  RESULT = "result"
}

/**
 * 上下文项元数据
 */
interface ContextItemMetadata {
  /** 所属会话标识 */
  session_id: string;

  /** 所属Agent标识 */
  agent_id?: string;

  /** 来源标识 */
  source: string;

  /** 标签列表 */
  tags: string[];

  /** 大小（字节） */
  size_bytes: number;

  /** Token数量 */
  token_count: number;

  /** 是否只读 */
  readonly: boolean;
}

/**
 * 对话上下文
 * 包含一个会话的所有上下文信息
 */
interface ConversationContext {
  /** 上下文唯一标识 */
  context_id: string;

  /** 所属会话标识 */
  session_id: string;

  /** 上下文类型 */
  context_type: ContextType;

  /** 对话历史 */
  messages: ConversationMessage[];

  /** 当前状态 */
  state: ContextState;

  /** 上下文配置 */
  config: ContextConfig;

  /** 创建时间 */
  created_at: number;

  /** 最后更新时间 */
  updated_at: number;

  /** 上下文元数据 */
  metadata: ContextMetadata;
}

/**
 * 上下文状态
 */
interface ContextState {
  /** 会话状态数据 */
  session_data: Record<string, any>;

  /** 持久化状态引用 */
  persistent_refs: PersistentStateRef[];

  /** 临时状态数据 */
  temporary_data: Record<string, any>;

  /** 任务执行状态 */
  task_state: TaskExecutionState;

  /** Agent运行状态 */
  agent_states: Record<string, AgentRuntimeState>;
}

/**
 * 上下文配置
 */
interface ContextConfig {
  /** 上下文窗口配置 */
  window: ContextWindowConfig;

  /** 存储策略 */
  storage_strategy: StorageStrategy;

  /** 压缩配置 */
  compression: CompressionConfig;

  /** 同步策略 */
  sync_strategy: SyncStrategy;
}

/**
 * 上下文元数据
 */
interface ContextMetadata {
  /** 创建者 */
  creator: string;

  /** 上下文标签 */
  tags: string[];

  /** 关联项目 */
  project_id?: string;

  /** 上下文大小（字节） */
  size_bytes: number;

  /** Token数量 */
  token_count: number;
}
```

### 状态类型枚举

```typescript
/**
 * 上下文类型
 */
enum ContextType {
  /** 用户会话上下文 */
  USER_SESSION = "user_session",
  /** Agent执行上下文 */
  AGENT_EXECUTION = "agent_execution",
  /** 任务执行上下文 */
  TASK_EXECUTION = "task_execution",
  /** 系统上下文 */
  SYSTEM = "system"
}

/**
 * 存储策略
 */
enum StorageStrategy {
  /** 仅内存存储 */
  MEMORY_ONLY = "memory_only",
  /** 优先内存，溢出磁盘 */
  MEMORY_PRIMARY = "memory_primary",
  /** 优先持久化 */
  PERSISTENT_PRIMARY = "persistent_primary"
}

/**
 * 同步策略
 */
enum SyncStrategy {
  /** 实时同步 */
  REALTIME = "realtime",
  /** 批量同步 */
  BATCH = "batch",
  /** 延迟同步 */
  LAZY = "lazy"
}
```

---

## 上下文生命周期管理

### 生命周期阶段

```
初始化 -> 活跃 -> 归档 -> 恢复/删除
```

生命周期阶段说明如下：

- **初始化**：创建上下文结构，分配资源，触发条件为新会话开始
- **活跃**：上下文持续更新和访问，触发条件为会话进行中
- **归档**：上下文转为只读状态，触发条件为会话结束或超时
- **恢复**：从归档状态恢复为活跃，触发条件为用户恢复历史会话
- **删除**：永久删除上下文数据，触发条件为用户删除或系统清理

### 生命周期管理接口

```typescript
/**
 * 上下文生命周期管理
 */
interface ContextLifecycleManager {
  /**
   * 创建新上下文
   * @param config 上下文配置
   * @returns 新创建的上下文
   */
  create_context(config: ContextConfig): ConversationContext;

  /**
   * 获取上下文
   * @param context_id 上下文标识
   * @returns 上下文对象
   */
  get_context(context_id: string): ConversationContext | null;

  /**
   * 更新上下文
   * @param context_id 上下文标识
   * @param updates 更新内容
   */
  update_context(context_id: string, updates: ContextUpdates): void;

  /**
   * 归档上下文
   * @param context_id 上下文标识
   */
  archive_context(context_id: string): Promise<void>;

  /**
   * 恢复上下文
   * @param context_id 上下文标识
   * @returns 恢复的上下文
   */
  restore_context(context_id: string): Promise<ConversationContext>;

  /**
   * 删除上下文
   * @param context_id 上下文标识
   * @param permanent 是否永久删除
   */
  delete_context(context_id: string, permanent?: boolean): Promise<void>;

  /**
   * 清理过期上下文
   * @returns 清理的上下文数量
   */
  cleanup_expired(): Promise<number>;
}
```

### 自动清理机制

系统自动执行以下清理任务：

**会话超时清理**：长时间无活动的会话自动转为归档状态，超出保留期限后永久删除。

**存储容量清理**：当存储使用量超过阈值时，自动清理最早归档的上下文。

**Token配额清理**：定期检查Token使用情况，压缩或清理超出配额的上下文。

---

## 上下文压缩与优化

### 压缩策略

当上下文大小超过阈值时，系统采用以下压缩策略：

**历史摘要压缩**：将早期的对话历史压缩为摘要，保留关键信息和结论。

**重复信息合并**：合并重复的上下文片段，减少冗余存储。

**低价值内容丢弃**：识别并丢弃对当前任务低价值的上下文内容。

### 压缩配置

```typescript
/**
 * 压缩配置
 */
interface CompressionConfig {
  /** 是否启用压缩 */
  enabled: boolean;

  /** 触发压缩的阈值（Token数） */
  threshold_tokens: number;

  /** 压缩算法 */
  algorithm: CompressionAlgorithm;

  /** 压缩后保留的信息类型 */
  preserve_info_types: InfoType[];

  /** 最小保留历史条数 */
  min_history_count: number;
}

/**
 * 压缩算法
 */
enum CompressionAlgorithm {
  /** 无压缩 */
  NONE = "none",
  /** 简单摘要 */
  SIMPLE_SUMMARY = "simple_summary",
  /** 语义压缩 */
  SEMANTIC = "semantic",
  /** 分层摘要 */
  HIERARCHICAL = "hierarchical"
}

/**
 * 信息类型
 */
enum InfoType {
  /** 用户意图 */
  USER_INTENT = "user_intent",
  /** 关键决策 */
  KEY_DECISIONS = "key_decisions",
  /** 执行结果 */
  EXECUTION_RESULTS = "execution_results",
  /** 错误信息 */
  ERRORS = "errors",
  /** 工具调用 */
  TOOL_CALLS = "tool_calls"
}
```

---

## 验收条件

验收条件如下：

**1. 对话上下文模型**：实现完整的ConversationContext模型，包含messages、state、config等核心字段。

**2. 状态类型分类**：区分会话状态、持久化状态、临时状态三种类型，采用不同存储策略。

**3. StateManagementService接口**：提供get/set会话状态、持久化状态、临时状态的完整接口。

**4. 上下文窗口机制**：实现滑动窗口策略，支持FIFO、相关性、重要性等多种淘汰策略。

**5. 上下文传播机制**：支持Agent间上下文传递，提供完全复制、增量传递、引用共享等策略。

**6. 嵌套调用上下文**：实现NestedCallContext结构，处理多层级的调用链和上下文快照。

**7. ContextLifecycleManager**：提供create、get、update、archive、restore、delete等生命周期管理接口。

**8. 上下文压缩**：支持历史摘要压缩、重复合并、低价值内容丢弃等优化策略。

**9. 上下文元数据**：记录context_id、session_id、created_at、size_bytes、token_count等信息。

**10. 文档编号**：文档编号为DOC-008，与feature系列文档保持一致的结构风格。

---

## 与现有功能的关系

### 与Agent架构的协同

上下文管理是Agent架构的核心支撑模块。每个Agent执行时通过Context获取必要的历史信息和状态数据，执行结果也写入Context。上下文的传播直接影响Agent间的协作效率。

### 与任务调度的协同

任务执行状态存储在上下文的状态数据中。任务调度器通过读取和更新上下文中的任务状态，协调多任务的执行顺序和依赖关系。

### 与存储系统的协同

持久化状态最终依赖存储系统进行数据持久化。上下文管理模块与存储系统协同，确保状态数据的安全存储和高效访问。

---

## 术语定义

术语定义说明如下：

- **ConversationContext**：对话上下文，包含会话的所有相关信息
- **ContextWindow**：上下文窗口，控制历史消息的保留范围
- **StateManagementService**：状态管理服务，统一管理各类状态数据
- **ContextLifecycleManager**：上下文生命周期管理器，控制上下文的创建到销毁
- **ContextPropagation**：上下文传播，描述上下文在多Agent间的传递机制
- **ContextCompression**：上下文压缩，优化超出限制的上下文大小

---

## 相关文档

- feature-001-agent-architecture.md - Agent架构设计
- feature-007-tool-system.md - 工具调用系统
- feature-009-workflow-engine.md - 工作流引擎
- requirements.md - 需求规格说明
