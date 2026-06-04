# 功能文档：核心对话Plugin规范

## 基本信息

**文档编号**: DOC-014
**所属模块**: 核心架构 (core-conversation-plugin)
**优先级**: P0
**创建日期**: 2026-04-25
**对应需求章节**: 3.2 智能协作需求

---

## 功能概述

核心对话Plugin是Organic-Interface项目与用户交互的主要入口，采用Linux风格的Plugin设计理念。Plugin作为系统程序与Kernel协同工作，提供基于文字交互（CLI）的对话能力，同时支持可选的GUI扩展。核心对话Plugin负责处理用户的自然语言输入、管理对话上下文、调用Kernel提供的服务和工具，并返回结构化的响应结果。

### 在系统中的定位

核心对话Plugin在整个系统架构中承担以下核心定位：

**用户交互入口**：作为用户与系统交互的主要界面，处理各类用户输入并返回响应结果。

**对话管理中枢**：负责创建、维护和关闭对话会话，管理对话上下文生命周期。

**服务编排器**：协调Kernel提供的各种服务，包括工具调用、信息查询等能力的统一调度。

**协议转换层**：将CLI文字级别的输入转换为内部可处理的结构化数据，将处理结果转换为用户可读的输出格式。

### 主要职责描述

核心对话Plugin的核心职责包括：

1. **会话生命周期管理**：创建新会话、恢复历史会话、关闭会话，支持多会话并发管理。

2. **上下文信息处理**：接收用户输入、更新对话上下文、管理上下文窗口、控制上下文大小。

3. **服务调用编排**：通过Kernel API调用工具服务、信息服务，实现用户请求的完整处理。

4. **输入输出标准化**：解析用户输入为标准格式，格式化输出为可读结果，支持流式输出。

5. **错误处理与恢复**：检测和处理各类错误，提供友好的错误提示，支持降级策略。

---

## 接口规范

### PluginInterface核心接口

核心对话Plugin必须实现标准的PluginInterface接口，同时扩展对话相关功能：

```typescript
/**
 * 核心对话Plugin接口
 * 继承PluginInterface基础接口，扩展对话专用功能
 */
interface CoreConversationPluginInterface extends PluginInterface {
  // ==================== 对话生命周期 ====================
  /**
   * 创建新对话会话
   * @param request 会话创建请求
   * @returns 会话创建结果
   */
  createSession(request: CreateSessionRequest): Promise<SessionResult>;

  /**
   * 获取现有会话
   * @param sessionId 会话标识
   * @returns 会话信息
   */
  getSession(sessionId: string): Promise<SessionInfo | null>;

  /**
   * 恢复历史会话
   * @param sessionId 会话标识
   * @returns 会话恢复结果
   */
  resumeSession(sessionId: string): Promise<SessionResumeResult>;

  /**
   * 关闭会话
   * @param sessionId 会话标识
   * @returns 关闭结果
   */
  closeSession(sessionId: string): Promise<CloseSessionResult>;

  /**
   * 列出所有会话
   * @param filter 会话过滤条件
   * @returns 会话列表
   */
  listSessions(filter?: SessionFilter): Promise<SessionInfo[]>;

  // ==================== 消息处理 ====================
  /**
   * 处理用户消息
   * @param input 用户输入
   * @returns 处理结果
   */
  processMessage(input: ConversationInput): Promise<ConversationOutput>;

  /**
   * 处理流式消息（支持流式输出）
   * @param input 用户输入
   * @param onChunk 流式输出回调
   * @returns 处理完成结果
   */
  processMessageStream(
    input: ConversationInput,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<ConversationOutput>;

  // ==================== 上下文管理 ====================
  /**
   * 获取会话上下文
   * @param sessionId 会话标识
   * @returns 对话上下文
   */
  getContext(sessionId: string): Promise<ConversationContext>;

  /**
   * 更新会话上下文
   * @param sessionId 会话标识
   * @param updates 上下文更新
   * @returns 更新后的上下文
   */
  updateContext(sessionId: string, updates: ContextUpdates): Promise<ConversationContext>;

  /**
   * 清除会话上下文
   * @param sessionId 会话标识
   * @returns 清除结果
   */
  clearContext(sessionId: string): Promise<void>;

  // ==================== 状态查询 ====================
  /**
   * 获取Plugin状态
   * @returns Plugin运行时状态
   */
  getStatus(): PluginStatus;
}
```

### PluginContext上下文对象

Plugin初始化时接收的上下文对象包含所有必需的Kernel服务接口：

```typescript
/**
 * 核心对话Plugin上下文
 * Plugin初始化时由Kernel注入，包含所有必需的运行时服务
 */
interface CoreConversationPluginContext extends PluginContext {
  // ==================== Kernel服务接口 ====================
  /** Kernel API接口，提供核心服务调用能力 */
  kernel_api: KernelApi;

  /** 工具服务接口，封装所有工具调用操作 */
  tool_service: KernelToolService;

  /** 信息服务接口，提供配置和运行时信息 */
  info_service: KernelInfoService;

  /** 事件服务接口，支持事件订阅和发布 */
  event_service: KernelEventService;

  // ==================== Plugin配置 ====================
  /** Plugin专用配置 */
  config: CoreConversationPluginConfig;

  // ==================== 上下文存储 ====================
  /** 会话存储服务 */
  session_storage: SessionStorageService;

  /** 上下文存储服务 */
  context_storage: ContextStorageService;

  // ==================== 日志记录 ====================
  /** 结构化日志记录器 */
  logger: ConversationLogger;
}

/**
 * Kernel API核心接口
 * 聚合所有Kernel提供的核心能力
 */
interface KernelApi {
  tool: KernelToolService;
  info: KernelInfoService;
  event: KernelEventService;
  config: KernelConfigService;
}
```

### PluginInput输入对象

```typescript
/**
 * 核心对话Plugin输入
 * 所有execute方法的输入参数结构
 */
interface CoreConversationPluginInput extends PluginInput {
  /** 操作类型 */
  action: ConversationAction;

  /** 对话相关参数 */
  parameters: ConversationParameters;

  /** 请求元数据 */
  metadata: ConversationMetadata;
}

/**
 * 对话操作类型枚举
 */
enum ConversationAction {
  /** 创建会话 */
  CREATE_SESSION = 'create_session',
  /** 发送消息 */
  SEND_MESSAGE = 'send_message',
  /** 获取会话 */
  GET_SESSION = 'get_session',
  /** 关闭会话 */
  CLOSE_SESSION = 'close_session',
  /** 列表会话 */
  LIST_SESSIONS = 'list_sessions',
  /** 获取上下文 */
  GET_CONTEXT = 'get_context',
  /** 更新上下文 */
  UPDATE_CONTEXT = 'update_context',
  /** 清除上下文 */
  CLEAR_CONTEXT = 'clear_context',
}

/**
 * 对话参数结构
 */
interface ConversationParameters {
  /** 会话标识（用于会话相关操作） */
  session_id?: string;

  /** 用户输入消息 */
  message?: string;

  /** 消息格式 */
  format?: InputFormat;

  /** 会话配置 */
  session_config?: SessionConfig;

  /** 上下文窗口配置 */
  window_config?: ContextWindowConfig;

  /** 过滤条件 */
  filter?: Record<string, any>;
}

/**
 * 输入格式枚举
 */
enum InputFormat {
  PLAIN_TEXT = 'plain_text',
  MARKDOWN = 'markdown',
  JSON = 'json',
  COMMAND = 'command',
}

/**
 * 对话元数据
 */
interface ConversationMetadata extends PluginInputMetadata {
  /** 请求标识 */
  request_id: string;

  /** 用户标识 */
  user_id?: string;

  /** 请求时间戳 */
  timestamp: number;

  /** 请求来源 */
  source: RequestSource;

  /** 会话历史消息数 */
  message_count?: number;

  /** 是否需要流式响应 */
  stream?: boolean;
}

/**
 * 请求来源枚举
 */
enum RequestSource {
  CLI = 'cli',
  API = 'api',
  GUI = 'gui',
  WEBHOOK = 'webhook',
}
```

### PluginOutput输出对象

```typescript
/**
 * 核心对话Plugin输出
 * 所有execute方法的返回结果结构
 */
interface CoreConversationPluginOutput extends PluginOutput {
  /** 操作结果 */
  result: ConversationResult;

  /** 输出元数据 */
  metadata: ConversationOutputMetadata;
}

/**
 * 对话结果联合类型
 */
type ConversationResult = SessionResult | MessageResult | ContextResult | ListResult | ErrorResult;

/**
 * 会话创建结果
 */
interface SessionResult {
  success: true;
  session: SessionInfo;
}

/**
 * 消息处理结果
 */
interface MessageResult {
  success: true;
  session_id: string;
  message: ProcessedMessage;
  context: ConversationContext;
}

/**
 * 上下文结果
 */
interface ContextResult {
  success: true;
  session_id: string;
  context: ConversationContext;
}

/**
 * 列表结果
 */
interface ListResult {
  success: true;
  items: SessionInfo[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * 错误结果
 */
interface ErrorResult {
  success: false;
  error: ConversationError;
}

/**
 * 对话输出元数据
 */
interface ConversationOutputMetadata {
  /** 处理耗时（毫秒） */
  processing_time: number;

  /** Plugin版本 */
  plugin_version: string;

  /** 请求标识 */
  request_id: string;

  /** 会话标识 */
  session_id?: string;

  /** 上下文状态 */
  context_status?: ContextStatus;
}
```

---

## 对话管理机制

### 会话管理接口

```typescript
/**
 * 会话管理器接口
 * 负责对话会话的完整生命周期管理
 */
interface SessionManager {
  // ==================== 会话创建 ====================
  /**
   * 创建新会话
   * @param request 会话创建请求
   * @returns 创建结果
   */
  createSession(request: CreateSessionRequest): Promise<SessionResult>;

  /**
   * 批量创建会话
   * @param requests 会话创建请求列表
   * @returns 创建结果列表
   */
  createSessions(requests: CreateSessionRequest[]): Promise<SessionResult[]>;

  // ==================== 会话获取 ====================
  /**
   * 获取会话信息
   * @param sessionId 会话标识
   * @returns 会话信息，不存在返回null
   */
  getSession(sessionId: string): Promise<SessionInfo | null>;

  /**
   * 获取当前活跃会话
   * @returns 活跃会话列表
   */
  getActiveSessions(): Promise<SessionInfo[]>;

  // ==================== 会话恢复 ====================
  /**
   * 恢复历史会话
   * @param sessionId 会话标识
   * @returns 恢复结果
   */
  resumeSession(sessionId: string): Promise<SessionResumeResult>;

  /**
   * 根据条件搜索会话
   * @param criteria 搜索条件
   * @returns 匹配的会话列表
   */
  searchSessions(criteria: SessionSearchCriteria): Promise<SessionInfo[]>;

  // ==================== 会话关闭 ====================
  /**
   * 关闭会话
   * @param sessionId 会话标识
   * @returns 关闭结果
   */
  closeSession(sessionId: string): Promise<CloseSessionResult>;

  /**
   * 批量关闭会话
   * @param sessionIds 会话标识列表
   * @returns 关闭结果
   */
  closeSessions(sessionIds: string[]): Promise<CloseSessionResult[]>;

  // ==================== 会话列表 ====================
  /**
   * 列出所有会话
   * @param filter 过滤条件
   * @returns 会话列表
   */
  listSessions(filter?: SessionFilter): Promise<ListResult>;

  // ==================== 会话状态 ====================
  /**
   * 更新会话状态
   * @param sessionId 会话标识
   * @param status 新状态
   */
  updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void>;

  /**
   * 获取会话统计信息
   * @param sessionId 会话标识
   * @returns 统计信息
   */
  getSessionStats(sessionId: string): Promise<SessionStats>;
}
```

### 会话数据结构

```typescript
/**
 * 会话信息
 * 对话会话的完整元数据
 */
interface SessionInfo {
  /** 会话唯一标识 */
  session_id: string;

  /** 会话名称 */
  name: string;

  /** 会话描述 */
  description?: string;

  /** 会话状态 */
  status: SessionStatus;

  /** 创建时间 */
  created_at: number;

  /** 最后活动时间 */
  last_active_at: number;

  /** 用户标识 */
  user_id?: string;

  /** 会话配置 */
  config: SessionConfig;

  /** 消息数量 */
  message_count: number;

  /** 上下文大小（token数） */
  context_size: number;

  /** 标签列表 */
  tags: string[];

  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * 会话状态枚举
 */
enum SessionStatus {
  /** 创建中 */
  CREATING = 'creating',
  /** 活跃状态 */
  ACTIVE = 'active',
  /** 空闲状态 */
  IDLE = 'idle',
  /** 暂停状态 */
  PAUSED = 'paused',
  /** 关闭中 */
  CLOSING = 'closing',
  /** 已关闭 */
  CLOSED = 'closed',
  /** 归档状态 */
  ARCHIVED = 'archived',
}

/**
 * 会话创建请求
 */
interface CreateSessionRequest {
  /** 会话名称 */
  name: string;

  /** 会话描述 */
  description?: string;

  /** 用户标识 */
  user_id?: string;

  /** 会话配置 */
  config?: Partial<SessionConfig>;

  /** 初始标签 */
  tags?: string[];

  /** 初始元数据 */
  metadata?: Record<string, any>;
}

/**
 * 会话配置
 */
interface SessionConfig {
  /** 上下文窗口类型 */
  window_type: ContextWindowType;

  /** 上下文窗口大小 */
  window_size: number;

  /** 最大token数 */
  max_tokens: number;

  /** 会话超时时间（毫秒） */
  session_timeout: number;

  /** 空闲超时时间（毫秒） */
  idle_timeout: number;

  /** 是否自动保存 */
  auto_save: boolean;

  /** 自动保存间隔（毫秒） */
  auto_save_interval: number;

  /** 系统提示模板 */
  system_prompt_template?: string;

  /** 是否启用历史摘要 */
  enable_history_summary: boolean;

  /** 历史摘要触发阈值 */
  summary_threshold: number;
}

/**
 * 会话搜索条件
 */
interface SessionSearchCriteria {
  /** 用户标识 */
  user_id?: string;

  /** 状态过滤 */
  status?: SessionStatus[];

  /** 时间范围 */
  time_range?: {
    start: number;
    end: number;
  };

  /** 标签过滤 */
  tags?: string[];

  /** 关键词搜索 */
  keyword?: string;

  /** 分页参数 */
  pagination?: PaginationParams;
}

/**
 * 会话过滤条件
 */
interface SessionFilter {
  /** 状态列表 */
  statuses?: SessionStatus[];

  /** 用户列表 */
  user_ids?: string[];

  /** 标签列表 */
  tags?: string[];

  /** 创建时间下限 */
  created_after?: number;

  /** 创建时间上限 */
  created_before?: number;

  /** 排序字段 */
  sort_by?: SessionSortField;

  /** 排序方向 */
  sort_order?: SortOrder;

  /** 分页 */
  pagination: PaginationParams;
}

/**
 * 会话排序字段枚举
 */
enum SessionSortField {
  CREATED_AT = 'created_at',
  LAST_ACTIVE_AT = 'last_active_at',
  MESSAGE_COUNT = 'message_count',
  NAME = 'name',
}

/**
 * 排序方向枚举
 */
enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * 分页参数
 */
interface PaginationParams {
  offset: number;
  limit: number;
}

/**
 * 会话统计信息
 */
interface SessionStats {
  session_id: string;
  total_messages: number;
  total_tokens: number;
  user_messages: number;
  assistant_messages: number;
  tool_calls: number;
  average_response_time: number;
  created_at: number;
  last_active_at: number;
}
```

### 上下文管理接口

```typescript
/**
 * 上下文管理器接口
 * 负责对话上下文的完整生命周期管理
 */
interface ContextManager {
  // ==================== 上下文获取 ====================
  /**
   * 获取对话上下文
   * @param sessionId 会话标识
   * @returns 对话上下文
   */
  getContext(sessionId: string): Promise<ConversationContext>;

  /**
   * 获取上下文窗口
   * @param sessionId 会话标识
   * @param config 窗口配置
   * @returns 上下文窗口
   */
  getContextWindow(sessionId: string, config: ContextWindowConfig): Promise<ContextWindow>;

  // ==================== 上下文更新 ====================
  /**
   * 添加消息到上下文
   * @param sessionId 会话标识
   * @param message 消息对象
   * @returns 更新后的上下文
   */
  addMessage(sessionId: string, message: Message): Promise<ConversationContext>;

  /**
   * 添加多条消息
   * @param sessionId 会话标识
   * @param messages 消息列表
   * @returns 更新后的上下文
   */
  addMessages(sessionId: string, messages: Message[]): Promise<ConversationContext>;

  /**
   * 更新消息
   * @param sessionId 会话标识
   * @param messageId 消息标识
   * @param updates 消息更新
   * @returns 更新后的上下文
   */
  updateMessage(
    sessionId: string,
    messageId: string,
    updates: Partial<Message>
  ): Promise<ConversationContext>;

  /**
   * 删除消息
   * @param sessionId 会话标识
   * @param messageId 消息标识
   * @returns 删除后的上下文
   */
  deleteMessage(sessionId: string, messageId: string): Promise<ConversationContext>;

  /**
   * 更新上下文元数据
   * @param sessionId 会话标识
   * @param metadata 元数据更新
   * @returns 更新后的上下文
   */
  updateMetadata(sessionId: string, metadata: Record<string, any>): Promise<ConversationContext>;

  // ==================== 上下文操作 ====================
  /**
   * 清除上下文
   * @param sessionId 会话标识
   * @param options 清除选项
   */
  clearContext(sessionId: string, options?: ClearContextOptions): Promise<void>;

  /**
   * 压缩上下文
   * @param sessionId 会话标识
   * @param strategy 压缩策略
   * @returns 压缩后的上下文
   */
  compressContext(sessionId: string, strategy?: CompressionStrategy): Promise<ConversationContext>;

  /**
   * 生成上下文摘要
   * @param sessionId 会话标识
   * @returns 摘要信息
   */
  summarizeContext(sessionId: string): Promise<ContextSummary>;

  // ==================== 上下文查询 ====================
  /**
   * 搜索上下文内容
   * @param sessionId 会话标识
   * @param query 搜索查询
   * @returns 匹配的片段
   */
  searchContext(sessionId: string, query: ContextSearchQuery): Promise<ContextSearchResult[]>;

  /**
   * 获取上下文统计
   * @param sessionId 会话标识
   * @returns 统计信息
   */
  getContextStats(sessionId: string): Promise<ContextStats>;
}

/**
 * 上下文窗口配置
 */
interface ContextWindowConfig {
  /** 窗口大小（消息数） */
  window_size: number;

  /** 窗口类型 */
  window_type: ContextWindowType;

  /** 最大token数 */
  max_tokens: number;

  /** 是否包含系统消息 */
  include_system_messages: boolean;

  /** 是否包含工具调用 */
  include_tool_calls: boolean;
}

/**
 * 上下文窗口类型枚举
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
 * 清除上下文选项
 */
interface ClearContextOptions {
  /** 清除模式 */
  mode: ClearMode;
  /** 保留最近N条消息 */
  keep_recent?: number;
  /** 保留的消息ID列表 */
  keep_messages?: string[];
}

/**
 * 清除模式枚举
 */
enum ClearMode {
  /** 全部清除 */
  ALL = 'all',
  /** 保留系统消息 */
  KEEP_SYSTEM = 'keep_system',
  /** 保留最近消息 */
  KEEP_RECENT = 'keep_recent',
  /** 自定义清除 */
  CUSTOM = 'custom',
}

/**
 * 压缩策略枚举
 */
enum CompressionStrategy {
  /** 摘要压缩 */
  SUMMARY = 'summary',
  /** 移除旧消息 */
  REMOVE_OLD = 'remove_old',
  /** 合并相似消息 */
  MERGE = 'merge',
  /** 混合策略 */
  HYBRID = 'hybrid',
}

/**
 * 上下文摘要
 */
interface ContextSummary {
  session_id: string;
  summary: string;
  key_topics: string[];
  important_decisions: string[];
  unresolved_issues: string[];
  generated_at: number;
}

/**
 * 上下文搜索查询
 */
interface ContextSearchQuery {
  /** 搜索类型 */
  type: SearchType;
  /** 搜索关键词 */
  keyword?: string;
  /** 时间范围 */
  time_range?: TimeRange;
  /** 发送者过滤 */
  sender_type?: SenderType[];
  /** 消息类型过滤 */
  message_types?: MessageType[];
}

/**
 * 搜索类型枚举
 */
enum SearchType {
  KEYWORD = 'keyword',
  SEMANTIC = 'semantic',
  REGEX = 'regex',
}

/**
 * 时间范围
 */
interface TimeRange {
  start: number;
  end: number;
}

/**
 * 发送者类型枚举
 */
enum SenderType {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool',
}

/**
 * 上下文搜索结果
 */
interface ContextSearchResult {
  message_id: string;
  snippet: string;
  relevance_score: number;
  timestamp: number;
}

/**
 * 上下文统计信息
 */
interface ContextStats {
  session_id: string;
  message_count: number;
  token_count: number;
  user_message_count: number;
  assistant_message_count: number;
  tool_call_count: number;
  average_message_length: number;
  created_at: number;
  last_updated_at: number;
}
```

### 状态机定义

```typescript
/**
 * 对话Plugin状态机
 * 定义Plugin的完整生命周期状态转换
 */
interface ConversationPluginStateMachine {
  /**
   * 获取当前状态
   */
  getCurrentState(): ConversationPluginState;

  /**
   * 获取状态历史
   */
  getStateHistory(): StateTransition[];

  /**
   * 执行状态转换
   * @param event 触发事件
   * @returns 转换结果
   */
  transition(event: StateEvent): StateTransitionResult;

  /**
   * 检查是否可以转换到指定状态
   * @param targetState 目标状态
   */
  canTransition(targetState: ConversationPluginState): boolean;

  /**
   * 添加状态监听器
   * @param listener 监听器函数
   */
  addStateListener(listener: StateListener): void;

  /**
   * 移除状态监听器
   * @param listener 监听器函数
   */
  removeStateListener(listener: StateListener): void;
}

/**
 * 对话Plugin状态枚举
 */
enum ConversationPluginState {
  /** 初始状态 */
  INITIAL = 'initial',
  /** 初始化中 */
  INITIALIZING = 'initializing',
  /** 就绪状态 */
  READY = 'ready',
  /** 处理消息中 */
  PROCESSING = 'processing',
  /** 等待响应 */
  WAITING = 'waiting',
  /** 响应完成 */
  RESPONDING = 'responding',
  /** 错误状态 */
  ERROR = 'error',
  /** 恢复中 */
  RECOVERING = 'recovering',
  /** 关闭中 */
  SHUTTING_DOWN = 'shutting_down',
  /** 已关闭 */
  SHUTDOWN = 'shutdown',
}

/**
 * 状态事件枚举
 */
enum StateEvent {
  INITIALIZE = 'initialize',
  INITIALIZE_COMPLETE = 'initialize_complete',
  INITIALIZE_FAILED = 'initialize_failed',
  RECEIVE_MESSAGE = 'receive_message',
  PROCESS_START = 'process_start',
  PROCESS_COMPLETE = 'process_complete',
  PROCESS_FAILED = 'process_failed',
  TOOL_CALL_START = 'tool_call_start',
  TOOL_CALL_COMPLETE = 'tool_call_complete',
  TOOL_CALL_FAILED = 'tool_call_failed',
  SEND_RESPONSE = 'send_response',
  RESPONSE_COMPLETE = 'response_complete',
  ERROR_OCCURRED = 'error_occurred',
  RECOVERY_START = 'recovery_start',
  RECOVERY_COMPLETE = 'recovery_complete',
  SHUTDOWN_REQUEST = 'shutdown_request',
  SHUTDOWN_COMPLETE = 'shutdown_complete',
}

/**
 * 状态转换记录
 */
interface StateTransition {
  /** 源状态 */
  from_state: ConversationPluginState;
  /** 目标状态 */
  to_state: ConversationPluginState;
  /** 触发事件 */
  event: StateEvent;
  /** 转换时间 */
  timestamp: number;
  /** 附加数据 */
  data?: Record<string, any>;
}

/**
 * 状态转换结果
 */
interface StateTransitionResult {
  /** 是否成功 */
  success: boolean;
  /** 之前的状态 */
  previous_state: ConversationPluginState;
  /** 当前状态 */
  current_state: ConversationPluginState;
  /** 错误信息 */
  error?: string;
}

/**
 * 状态监听器函数类型
 */
type StateListener = (transition: StateTransition) => void;

/**
 * 状态转换规则定义
 */
const STATE_TRANSITIONS: Record<
  ConversationPluginState,
  Map<StateEvent, ConversationPluginState>
> = {
  [ConversationPluginState.INITIAL]: new Map([
    [StateEvent.INITIALIZE, ConversationPluginState.INITIALIZING],
  ]),
  [ConversationPluginState.INITIALIZING]: new Map([
    [StateEvent.INITIALIZE_COMPLETE, ConversationPluginState.READY],
    [StateEvent.INITIALIZE_FAILED, ConversationPluginState.ERROR],
  ]),
  [ConversationPluginState.READY]: new Map([
    [StateEvent.RECEIVE_MESSAGE, ConversationPluginState.PROCESSING],
    [StateEvent.SHUTDOWN_REQUEST, ConversationPluginState.SHUTTING_DOWN],
  ]),
  [ConversationPluginState.PROCESSING]: new Map([
    [StateEvent.PROCESS_COMPLETE, ConversationPluginState.RESPONDING],
    [StateEvent.PROCESS_FAILED, ConversationPluginState.ERROR],
    [StateEvent.TOOL_CALL_START, ConversationPluginState.WAITING],
  ]),
  [ConversationPluginState.WAITING]: new Map([
    [StateEvent.TOOL_CALL_COMPLETE, ConversationPluginState.PROCESSING],
    [StateEvent.TOOL_CALL_FAILED, ConversationPluginState.PROCESSING],
  ]),
  [ConversationPluginState.RESPONDING]: new Map([
    [StateEvent.RESPONSE_COMPLETE, ConversationPluginState.READY],
    [StateEvent.RECEIVE_MESSAGE, ConversationPluginState.PROCESSING],
  ]),
  [ConversationPluginState.ERROR]: new Map([
    [StateEvent.RECOVERY_START, ConversationPluginState.RECOVERING],
    [StateEvent.SHUTDOWN_REQUEST, ConversationPluginState.SHUTTING_DOWN],
  ]),
  [ConversationPluginState.RECOVERING]: new Map([
    [StateEvent.RECOVERY_COMPLETE, ConversationPluginState.READY],
    [StateEvent.ERROR_OCCURRED, ConversationPluginState.ERROR],
    [StateEvent.SHUTDOWN_REQUEST, ConversationPluginState.SHUTTING_DOWN],
  ]),
  [ConversationPluginState.SHUTTING_DOWN]: new Map([
    [StateEvent.SHUTDOWN_COMPLETE, ConversationPluginState.SHUTDOWN],
  ]),
  [ConversationPluginState.SHUTDOWN]: new Map(),
};
```

---

## Kernel交互规范

### 工具调用封装

```typescript
/**
 * 工具调用封装接口
 * 封装Kernel工具服务，提供对话场景专用的工具调用能力
 */
interface ToolCallService {
  // ==================== 基础调用 ====================
  /**
   * 调用指定工具
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns 调用结果
   */
  call(toolName: string, args: ToolArgs): ToolResult;

  /**
   * 异步调用工具
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns 调用结果Promise
   */
  callAsync(toolName: string, args: ToolArgs): Promise<ToolResult>;

  // ==================== 批量调用 ====================
  /**
   * 批量调用多个工具
   * @param calls 调用请求列表
   * @returns 调用结果列表
   */
  callBatch(calls: ToolCallRequest[]): Promise<ToolResult[]>;

  /**
   * 并行调用多个工具
   * @param calls 调用请求列表
   * @returns 调用结果列表
   */
  callParallel(calls: ToolCallRequest[]): Promise<ToolResult[]>;

  // ==================== 工具发现 ====================
  /**
   * 获取可用工具列表
   * @param filter 过滤条件
   * @returns 工具定义列表
   */
  getAvailableTools(filter?: ToolFilter): ToolDefinition[];

  /**
   * 获取工具定义
   * @param toolName 工具名称
   * @returns 工具定义
   */
  getToolDefinition(toolName: string): ToolDefinition | null;

  // ==================== 权限检查 ====================
  /**
   * 检查是否有权限调用工具
   * @param toolName 工具名称
   * @returns 是否有权限
   */
  hasPermission(toolName: string): boolean;

  /**
   * 请求工具权限
   * @param toolName 工具名称
   * @returns 请求结果
   */
  requestPermission(toolName: string): Promise<PermissionResult>;
}

/**
 * 工具调用请求
 */
interface ToolCallRequest {
  /** 调用标识 */
  id?: string;
  /** 工具名称 */
  tool_name: string;
  /** 工具参数 */
  args: ToolArgs;
  /** 超时时间 */
  timeout?: number;
  /** 优先级 */
  priority?: Priority;
}

/**
 * 工具过滤条件
 */
interface ToolFilter {
  /** 工具类型 */
  type?: ToolType[];
  /** 调用级别 */
  call_level?: ToolCallLevel[];
  /** 是否需要权限 */
  requires_permission?: boolean;
  /** 关键词 */
  keyword?: string;
}

/**
 * 权限结果
 */
interface PermissionResult {
  /** 是否授予 */
  granted: boolean;
  /** 过期时间 */
  expires_at?: number;
  /** 拒绝原因 */
  reason?: string;
}
```

### 信息服务调用规范

```typescript
/**
 * 信息服务调用接口
 * 提供配置和运行时信息查询能力
 */
interface InfoService {
  // ==================== 配置信息 ====================
  /**
   * 获取配置值
   * @param key 配置键
   * @returns 配置值
   */
  getConfig(key: string): ConfigValue;

  /**
   * 获取所有配置
   * @returns 完整配置对象
   */
  getAllConfigs(): Record<string, ConfigValue>;

  /**
   * 获取对话专用配置
   * @returns 对话配置
   */
  getConversationConfig(): ConversationConfig;

  // ==================== 运行时信息 ====================
  /**
   * 获取运行时信息
   * @returns 运行时信息
   */
  getRuntimeInfo(): RuntimeInfo;

  /**
   * 获取项目上下文
   * @returns 项目上下文
   */
  getProjectContext(): ProjectContext;

  /**
   * 获取系统状态
   * @returns 系统状态
   */
  getSystemStatus(): SystemStatus;

  // ==================== 文件系统 ====================
  /**
   * 读取文件
   * @param path 文件路径
   * @returns 文件内容
   */
  readFile(path: string): FileContent;

  /**
   * 写入文件
   * @param path 文件路径
   * @param content 文件内容
   * @returns 写入结果
   */
  writeFile(path: string, content: string): WriteResult;
}

/**
 * 对话配置
 */
interface ConversationConfig {
  /** 最大会话数 */
  max_sessions: number;
  /** 默认会话超时 */
  default_session_timeout: number;
  /** 默认上下文窗口大小 */
  default_window_size: number;
  /** 最大token数 */
  max_tokens: number;
  /** 启用功能 */
  enabled_features: FeatureFlag[];
}

/**
 * 功能标志枚举
 */
enum FeatureFlag {
  STREAMING = 'streaming',
  TOOL_CALLS = 'tool_calls',
  CONTEXT_COMPRESSION = 'context_compression',
  HISTORY_SUMMARY = 'history_summary',
  MULTIMODAL = 'multimodal',
}

/**
 * 系统状态
 */
interface SystemStatus {
  status: SystemStatusType;
  uptime: number;
  memory_usage: MemoryUsage;
  active_sessions: number;
  total_requests: number;
  errors_today: number;
}

/**
 * 系统状态类型枚举
 */
enum SystemStatusType {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * 内存使用情况
 */
interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
}
```

### 事件订阅机制

```typescript
/**
 * 事件订阅服务接口
 * 支持Plugin订阅和发布事件
 */
interface EventService {
  // ==================== 订阅管理 ====================
  /**
   * 订阅事件
   * @param topic 事件主题
   * @param handler 事件处理器
   * @param options 订阅选项
   * @returns 订阅取消函数
   */
  subscribe<T = any>(
    topic: EventTopic,
    handler: EventHandler<T>,
    options?: SubscribeOptions
  ): UnsubscribeFn;

  /**
   * 批量订阅
   * @param subscriptions 订阅列表
   * @returns 取消订阅函数列表
   */
  subscribeBatch(subscriptions: Subscription[]): UnsubscribeFn[];

  /**
   * 取消订阅
   * @param topic 事件主题
   * @param handler 事件处理器
   */
  unsubscribe<T = any>(topic: EventTopic, handler: EventHandler<T>): void;

  // ==================== 事件发布 ====================
  /**
   * 发布事件
   * @param topic 事件主题
   * @param payload 事件数据
   * @param options 发布选项
   */
  publish<T = any>(topic: EventTopic, payload: T, options?: PublishOptions): EventId;

  /**
   * 发布请求-响应事件
   * @param topic 事件主题
   * @param payload 事件数据
   * @param timeout 超时时间
   * @returns 响应数据
   */
  request<TRequest, TResponse>(
    topic: EventTopic,
    payload: TRequest,
    timeout?: number
  ): Promise<TResponse>;

  // ==================== 查询 ====================
  /**
   * 获取订阅列表
   * @param topic 事件主题（可选）
   * @returns 订阅列表
   */
  getSubscriptions(topic?: EventTopic): SubscriptionInfo[];

  /**
   * 获取事件历史
   * @param topic 事件主题
   * @param options 查询选项
   * @returns 事件列表
   */
  getEventHistory(topic: EventTopic, options?: HistoryQueryOptions): EventRecord[];
}

/**
 * 事件主题枚举
 */
enum EventTopic {
  // 会话事件
  SESSION_CREATED = 'session.created',
  SESSION_CLOSED = 'session.closed',
  SESSION_ACTIVATED = 'session.activated',
  SESSION_IDLE = 'session.idle',

  // 消息事件
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_PROCESSING = 'message.processing',
  MESSAGE_PROCESSED = 'message.processed',
  MESSAGE_FAILED = 'message.failed',

  // 工具事件
  TOOL_CALLED = 'tool.called',
  TOOL_COMPLETED = 'tool.completed',
  TOOL_FAILED = 'tool.failed',

  // 上下文事件
  CONTEXT_UPDATED = 'context.updated',
  CONTEXT_CLEARED = 'context.cleared',
  CONTEXT_COMPRESSED = 'context.compressed',

  // 系统事件
  SYSTEM_ERROR = 'system.error',
  SYSTEM_STATUS_CHANGED = 'system.status_changed',
}

/**
 * 事件处理器类型
 */
type EventHandler<T = any> = (event: Event<T>) => void;

/**
 * 事件对象
 */
interface Event<T = any> {
  id: EventId;
  topic: EventTopic;
  payload: T;
  timestamp: number;
  source: EventSource;
}

/**
 * 事件来源
 */
interface EventSource {
  type: 'plugin' | 'kernel' | 'system';
  id: string;
}

/**
 * 订阅选项
 */
interface SubscribeOptions {
  /** 是否只接收一次 */
  once?: boolean;
  /** 优先级 */
  priority?: number;
  /** 过滤器 */
  filter?: EventFilter;
  /** 订阅ID */
  subscription_id?: string;
}

/**
 * 事件过滤器
 */
interface EventFilter {
  source?: string;
  timestamp_after?: number;
  timestamp_before?: number;
}

/**
 * 发布选项
 */
interface PublishOptions {
  /** 优先级 */
  priority?: Priority;
  /** 是否持久化 */
  persistent?: boolean;
  /** 过期时间 */
  expires_at?: number;
}

/**
 * 订阅信息
 */
interface Subscription {
  topic: EventTopic;
  handler: EventHandler;
  options?: SubscribeOptions;
}

/**
 * 订阅信息
 */
interface SubscriptionInfo {
  topic: EventTopic;
  handler_id: string;
  plugin_id: string;
  created_at: number;
  options: SubscribeOptions;
}

/**
 * 历史查询选项
 */
interface HistoryQueryOptions {
  start_time?: number;
  end_time?: number;
  limit?: number;
  offset?: number;
}

/**
 * 事件记录
 */
interface EventRecord {
  id: EventId;
  topic: EventTopic;
  payload: any;
  timestamp: number;
  source: EventSource;
}
```

---

## 输入输出规范

### 输入解析器规范

````typescript
/**
 * 输入解析器接口
 * 将CLI文字输入转换为标准化的内部格式
 */
interface InputParser {
  /**
   * 解析用户输入
   * @param rawInput 原始输入字符串
   * @returns 解析结果
   */
  parse(rawInput: string): ParseResult;

  /**
   * 检测输入格式
   * @param input 输入字符串
   * @returns 格式类型
   */
  detectFormat(input: string): InputFormat;

  /**
   * 验证输入合法性
   * @param input 输入对象
   * @returns 验证结果
   */
  validate(input: ConversationInput): ValidationResult;

  /**
   * 标准化输入
   * @param input 输入对象
   * @returns 标准化后的输入
   */
  normalize(input: ConversationInput): NormalizedInput;
}

/**
 * 解析结果
 */
interface ParseResult {
  /** 是否成功 */
  success: boolean;
  /** 解析后的输入对象 */
  input?: ConversationInput;
  /** 错误信息 */
  error?: ParseError;
}

/**
 * 解析错误
 */
interface ParseError {
  code: ParseErrorCode;
  message: string;
  position?: number;
  details?: any;
}

/**
 * 解析错误代码枚举
 */
enum ParseErrorCode {
  EMPTY_INPUT = 'empty_input',
  INVALID_FORMAT = 'invalid_format',
  INVALID_ENCODING = 'invalid_encoding',
  TOO_LONG = 'too_long',
  INVALID_CHARACTER = 'invalid_character',
}

/**
 * 验证结果
 */
interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: ValidationError[];
}

/**
 * 验证错误
 */
interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * 标准化输入
 */
interface NormalizedInput {
  text: string;
  format: InputFormat;
  metadata: NormalizedMetadata;
}

/**
 * 标准化元数据
 */
interface NormalizedMetadata {
  original_text: string;
  normalized_text: string;
  detected_language?: string;
  intent?: string;
  entities?: Entity[];
}

/**
 * 实体信息
 */
interface Entity {
  text: string;
  type: EntityType;
  start: number;
  end: number;
  confidence: number;
}

/**
 * 实体类型枚举
 */
enum EntityType {
  FILE_PATH = 'file_path',
  CODE = 'code',
  URL = 'url',
  COMMAND = 'command',
  KEYWORD = 'keyword',
}

/**
 * 默认输入解析器实现
 */
class DefaultInputParser implements InputParser {
  private maxInputLength: number;
  private supportedFormats: InputFormat[];

  constructor(config: ParserConfig) {
    this.maxInputLength = config.max_input_length || 10000;
    this.supportedFormats = config.supported_formats || [
      InputFormat.PLAIN_TEXT,
      InputFormat.MARKDOWN,
      InputFormat.COMMAND,
    ];
  }

  parse(rawInput: string): ParseResult {
    // 1. 空输入检查
    if (!rawInput || rawInput.trim().length === 0) {
      return {
        success: false,
        error: {
          code: ParseErrorCode.EMPTY_INPUT,
          message: '输入不能为空',
        },
      };
    }

    // 2. 长度检查
    if (rawInput.length > this.maxInputLength) {
      return {
        success: false,
        error: {
          code: ParseErrorCode.TOO_LONG,
          message: `输入长度超过限制（最大${this.maxInputLength}字符）`,
        },
      };
    }

    // 3. 检测格式
    const format = this.detectFormat(rawInput);

    // 4. 创建输入对象
    const input: ConversationInput = {
      text: rawInput.trim(),
      format,
      metadata: {
        original_length: rawInput.length,
        trimmed_length: rawInput.trim().length,
        timestamp: Date.now(),
      },
    };

    return { success: true, input };
  }

  detectFormat(input: string): InputFormat {
    // JSON格式检测
    if (input.trim().startsWith('{') && input.trim().endsWith('}')) {
      try {
        JSON.parse(input);
        return InputFormat.JSON;
      } catch {
        // 不是有效JSON，继续检测
      }
    }

    // Markdown格式检测
    if (/^#{1,6}\s|```/.test(input)) {
      return InputFormat.MARKDOWN;
    }

    // 命令格式检测
    if (/^(plugin:|tool:|kernel:|exec:)/i.test(input)) {
      return InputFormat.COMMAND;
    }

    // 默认纯文本
    return InputFormat.PLAIN_TEXT;
  }

  validate(input: ConversationInput): ValidationResult {
    const errors: ValidationError[] = [];

    if (!input.text || input.text.trim().length === 0) {
      errors.push({
        field: 'text',
        message: '文本内容不能为空',
        code: 'EMPTY_TEXT',
      });
    }

    if (!this.supportedFormats.includes(input.format)) {
      errors.push({
        field: 'format',
        message: `不支持的格式：${input.format}`,
        code: 'UNSUPPORTED_FORMAT',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  normalize(input: ConversationInput): NormalizedInput {
    return {
      text: input.text.trim(),
      format: input.format,
      metadata: {
        original_text: input.text,
        normalized_text: input.text.trim(),
        detected_language: this.detectLanguage(input.text),
      },
    };
  }

  private detectLanguage(text: string): string {
    // 简化实现，实际应使用语言检测库
    const chineseRegex = /[\u4e00-\u9fa5]/;
    if (chineseRegex.test(text)) {
      return 'zh';
    }
    return 'en';
  }
}
````

### 输出格式化器规范

```typescript
/**
 * 输出格式化器接口
 * 将处理结果转换为用户可读的输出格式
 */
interface OutputFormatter {
  /**
   * 格式化输出
   * @param result 处理结果
   * @param options 格式化选项
   * @returns 格式化后的输出
   */
  format(result: ConversationOutput, options?: FormatOptions): FormattedOutput;

  /**
   * 格式化错误
   * @param error 错误信息
   * @param options 格式化选项
   * @returns 格式化的错误输出
   */
  formatError(error: ConversationError, options?: FormatOptions): FormattedOutput;

  /**
   * 格式化流式输出片段
   * @param chunk 流式片段
   * @param options 格式化选项
   * @returns 格式化的片段输出
   */
  formatStreamChunk(chunk: StreamChunk, options?: FormatOptions): string;

  /**
   * 获取支持的输出格式
   */
  getSupportedFormats(): OutputFormat[];
}

/**
 * 格式化选项
 */
interface FormatOptions {
  /** 输出格式 */
  format: OutputFormat;
  /** 是否包含元数据 */
  includeMetadata?: boolean;
  /** 颜色方案 */
  colorScheme?: ColorScheme;
  /** 最大宽度 */
  maxWidth?: number;
  /** 缩进级别 */
  indentLevel?: number;
}

/**
 * 输出格式枚举
 */
enum OutputFormat {
  /** 纯文本格式 */
  PLAIN_TEXT = 'plain_text',
  /** Markdown格式 */
  MARKDOWN = 'markdown',
  /** JSON格式 */
  JSON = 'json',
  /** CLI格式化输出 */
  CLI = 'cli',
}

/**
 * 颜色方案枚举
 */
enum ColorScheme {
  NONE = 'none',
  BASIC = 'basic',
  ANSI = 'ansi',
}

/**
 * 格式化输出
 */
interface FormattedOutput {
  /** 输出文本 */
  text: string;
  /** 输出格式 */
  format: OutputFormat;
  /** 元数据 */
  metadata: OutputMetadata;
}

/**
 * 输出元数据
 */
interface OutputMetadata {
  timestamp: number;
  processingTime: number;
  sessionId?: string;
  messageId?: string;
}

/**
 * 默认输出格式化器实现
 */
class DefaultOutputFormatter implements OutputFormatter {
  private defaultFormat: OutputFormat;

  constructor(defaultFormat: OutputFormat = OutputFormat.CLI) {
    this.defaultFormat = defaultFormat;
  }

  format(result: ConversationOutput, options?: FormatOptions): FormattedOutput {
    const format = options?.format || this.defaultFormat;

    switch (format) {
      case OutputFormat.JSON:
        return this.formatAsJson(result, options);
      case OutputFormat.MARKDOWN:
        return this.formatAsMarkdown(result, options);
      case OutputFormat.PLAIN_TEXT:
        return this.formatAsPlainText(result, options);
      case OutputFormat.CLI:
      default:
        return this.formatAsCli(result, options);
    }
  }

  formatError(error: ConversationError, options?: FormatOptions): FormattedOutput {
    const format = options?.format || this.defaultFormat;

    const errorResult: ConversationOutput = {
      success: false,
      error,
      message: this.getErrorMessage(error),
      metadata: {
        timestamp: Date.now(),
        type: 'error',
      },
    };

    return this.format(errorResult, options);
  }

  formatStreamChunk(chunk: StreamChunk, options?: FormatOptions): string {
    const colorScheme = options?.colorScheme || ColorScheme.ANSI;

    switch (chunk.type) {
      case StreamChunkType.TEXT:
        return this.formatTextChunk(chunk, colorScheme);
      case StreamChunkType.TOOL_CALL:
        return this.formatToolCallChunk(chunk, colorScheme);
      case StreamChunkType.STATUS:
        return this.formatStatusChunk(chunk, colorScheme);
      default:
        return chunk.content;
    }
  }

  getSupportedFormats(): OutputFormat[] {
    return Object.values(OutputFormat);
  }

  private formatAsJson(result: ConversationOutput, options?: FormatOptions): FormattedOutput {
    return {
      text: JSON.stringify(result, null, 2),
      format: OutputFormat.JSON,
      metadata: {
        timestamp: Date.now(),
        processingTime: result.metadata?.processingTime || 0,
      },
    };
  }

  private formatAsMarkdown(result: ConversationOutput, options?: FormatOptions): FormattedOutput {
    let text = '';

    if (result.message) {
      text += `${result.message}\n\n`;
    }

    if (result.metadata?.toolCalls?.length) {
      text += '### 工具调用\n\n';
      for (const tool of result.metadata.toolCalls) {
        text += `- **${tool.name}**: ${JSON.stringify(tool.args)}\n`;
      }
      text += '\n';
    }

    if (!result.success && result.error) {
      text += `**错误**: ${result.error.message}\n`;
    }

    return {
      text: text.trim(),
      format: OutputFormat.MARKDOWN,
      metadata: {
        timestamp: Date.now(),
        processingTime: result.metadata?.processingTime || 0,
      },
    };
  }

  private formatAsPlainText(result: ConversationOutput, options?: FormatOptions): FormattedOutput {
    let text = result.message || '';

    if (result.metadata?.toolCalls?.length) {
      text += '\n\n[工具调用]\n';
      for (const tool of result.metadata.toolCalls) {
        text += `${tool.name}: ${JSON.stringify(tool.args)}\n`;
      }
    }

    if (!result.success && result.error) {
      text += `\n[错误] ${result.error.message}`;
    }

    return {
      text,
      format: OutputFormat.PLAIN_TEXT,
      metadata: {
        timestamp: Date.now(),
        processingTime: result.metadata?.processingTime || 0,
      },
    };
  }

  private formatAsCli(result: ConversationOutput, options?: FormatOptions): FormattedOutput {
    const colorScheme = options?.colorScheme || ColorScheme.ANSI;
    let text = '';

    // 输出消息
    if (result.message) {
      if (colorScheme === ColorScheme.ANSI) {
        text += `\x1b[36m${result.message}\x1b[0m\n`;
      } else {
        text += `${result.message}\n`;
      }
    }

    // 输出工具调用
    if (result.metadata?.toolCalls?.length) {
      text += '\n[工具调用]\n';
      for (const tool of result.metadata.toolCalls) {
        text += `  - ${tool.name}: ${JSON.stringify(tool.args)}\n`;
      }
    }

    // 输出错误
    if (!result.success && result.error) {
      const errorText = `[错误] ${result.error.code}: ${result.error.message}`;
      if (colorScheme === ColorScheme.ANSI) {
        text += `\x1b[31m${errorText}\x1b[0m\n`;
      } else {
        text += `${errorText}\n`;
      }
    }

    // 输出元数据
    if (options?.includeMetadata && result.metadata) {
      text += `\n[处理时间: ${result.metadata.processingTime}ms]`;
    }

    return {
      text: text.trim(),
      format: OutputFormat.CLI,
      metadata: {
        timestamp: Date.now(),
        processingTime: result.metadata?.processingTime || 0,
      },
    };
  }

  private formatTextChunk(chunk: StreamChunk, colorScheme: ColorScheme): string {
    if (colorScheme === ColorScheme.ANSI) {
      return `\x1b[32m${chunk.content}\x1b[0m`;
    }
    return chunk.content;
  }

  private formatToolCallChunk(chunk: StreamChunk, colorScheme: ColorScheme): string {
    const toolInfo = chunk.content;
    const text = `[调用工具: ${toolInfo.name}]`;
    if (colorScheme === ColorScheme.ANSI) {
      return `\n\x1b[33m${text}\x1b[0m\n`;
    }
    return `\n${text}\n`;
  }

  private formatStatusChunk(chunk: StreamChunk, colorScheme: ColorScheme): string {
    if (colorScheme === ColorScheme.ANSI) {
      return `\x1b[90m[${chunk.content}]\x1b[0m`;
    }
    return `[${chunk.content}]`;
  }

  private getErrorMessage(error: ConversationError): string {
    return error.message || `错误代码: ${error.code}`;
  }
}
```

### 流式输出支持

```typescript
/**
 * 流式输出配置
 */
interface StreamingConfig {
  /** 是否启用流式输出 */
  enabled: boolean;
  /** 流式类型 */
  type: StreamingType;
  /** 缓冲区大小 */
  bufferSize: number;
  /** 刷新间隔（毫秒） */
  flushInterval: number;
  /** 最大重试次数 */
  maxRetries: number;
}

/**
 * 流式类型枚举
 */
enum StreamingType {
  /** SSE服务端推送 */
  SSE = 'sse',
  /** WebSocket */
  WEBSOCKET = 'websocket',
  /** 轮询 */
  POLLING = 'polling',
}

/**
 * 流式输出片段
 */
interface StreamChunk {
  /** 片段类型 */
  type: StreamChunkType;
  /** 片段内容 */
  content: string;
  /** 片段索引 */
  index: number;
  /** 是否为最后一个片段 */
  isFinal: boolean;
  /** 附加数据 */
  metadata?: Record<string, any>;
}

/**
 * 流式片段类型枚举
 */
enum StreamChunkType {
  /** 文本内容 */
  TEXT = 'text',
  /** 工具调用开始 */
  TOOL_CALL_START = 'tool_call_start',
  /** 工具调用完成 */
  TOOL_CALL_COMPLETE = 'tool_call_complete',
  /** 状态更新 */
  STATUS = 'status',
  /** 错误信息 */
  ERROR = 'error',
  /** 元数据 */
  METADATA = 'metadata',
}

/**
 * 流式处理接口
 */
interface StreamingHandler {
  /**
   * 开始流式处理
   * @param input 输入对象
   * @param onChunk 片段回调
   * @param options 流式选项
   */
  startStreaming(
    input: ConversationInput,
    onChunk: (chunk: StreamChunk) => void,
    options?: StreamingOptions
  ): Promise<StreamingResult>;

  /**
   * 停止流式处理
   * @param streamId 流标识
   */
  stopStreaming(streamId: string): Promise<void>;

  /**
   * 暂停流式处理
   * @param streamId 流标识
   */
  pauseStreaming(streamId: string): Promise<void>;

  /**
   * 恢复流式处理
   * @param streamId 流标识
   */
  resumeStreaming(streamId: string): Promise<void>;
}

/**
 * 流式选项
 */
interface StreamingOptions {
  /** 流标识 */
  streamId?: string;
  /** 优先级 */
  priority?: Priority;
  /** 超时时间 */
  timeout?: number;
}

/**
 * 流式结果
 */
interface StreamingResult {
  /** 是否成功 */
  success: boolean;
  /** 流标识 */
  streamId: string;
  /** 总片段数 */
  totalChunks: number;
  /** 错误信息 */
  error?: ConversationError;
}
```

---

## 错误处理规范

### 错误码定义

```typescript
/**
 * 对话错误代码枚举
 * 定义所有核心对话Plugin可能遇到的错误类型
 */
enum ConversationErrorCode {
  // ==================== 会话错误 (SESSION_*) ====================
  /** 会话不存在 */
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  /** 会话已存在 */
  SESSION_ALREADY_EXISTS = 'SESSION_ALREADY_EXISTS',
  /** 会话已关闭 */
  SESSION_CLOSED = 'SESSION_CLOSED',
  /** 会话已满 */
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',
  /** 会话超时 */
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  /** 会话创建失败 */
  SESSION_CREATE_FAILED = 'SESSION_CREATE_FAILED',
  /** 会话恢复失败 */
  SESSION_RESUME_FAILED = 'SESSION_RESUME_FAILED',

  // ==================== 上下文错误 (CONTEXT_*) ====================
  /** 上下文不存在 */
  CONTEXT_NOT_FOUND = 'CONTEXT_NOT_FOUND',
  /** 上下文已满 */
  CONTEXT_OVERFLOW = 'CONTEXT_OVERFLOW',
  /** 上下文过期 */
  CONTEXT_EXPIRED = 'CONTEXT_EXPIRED',
  /** 上下文锁定 */
  CONTEXT_LOCKED = 'CONTEXT_LOCKED',
  /** 上下文压缩失败 */
  CONTEXT_COMPRESSION_FAILED = 'CONTEXT_COMPRESSION_FAILED',
  /** 上下文保存失败 */
  CONTEXT_SAVE_FAILED = 'CONTEXT_SAVE_FAILED',

  // ==================== 消息错误 (MESSAGE_*) ====================
  /** 消息为空 */
  MESSAGE_EMPTY = 'MESSAGE_EMPTY',
  /** 消息格式错误 */
  MESSAGE_FORMAT_INVALID = 'MESSAGE_FORMAT_INVALID',
  /** 消息太长 */
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  /** 消息处理失败 */
  MESSAGE_PROCESS_FAILED = 'MESSAGE_PROCESS_FAILED',
  /** 消息发送失败 */
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',

  // ==================== 工具错误 (TOOL_*) ====================
  /** 工具不存在 */
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  /** 工具调用失败 */
  TOOL_CALL_FAILED = 'TOOL_CALL_FAILED',
  /** 工具权限不足 */
  TOOL_PERMISSION_DENIED = 'TOOL_PERMISSION_DENIED',
  /** 工具调用超时 */
  TOOL_CALL_TIMEOUT = 'TOOL_CALL_TIMEOUT',
  /** 工具参数错误 */
  TOOL_INVALID_ARGS = 'TOOL_INVALID_ARGS',

  // ==================== 状态错误 (STATE_*) ====================
  /** Plugin未初始化 */
  PLUGIN_NOT_INITIALIZED = 'PLUGIN_NOT_INITIALIZED',
  /** Plugin已关闭 */
  PLUGIN_SHUTDOWN = 'PLUGIN_SHUTDOWN',
  /** Plugin忙 */
  PLUGIN_BUSY = 'PLUGIN_BUSY',
  /** 状态转换无效 */
  STATE_TRANSITION_INVALID = 'STATE_TRANSITION_INVALID',

  // ==================== 配置错误 (CONFIG_*) ====================
  /** 配置不存在 */
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  /** 配置无效 */
  CONFIG_INVALID = 'CONFIG_INVALID',
  /** 配置更新失败 */
  CONFIG_UPDATE_FAILED = 'CONFIG_UPDATE_FAILED',

  // ==================== 通用错误 (GENERAL_*) ====================
  /** 未知错误 */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  /** 操作失败 */
  OPERATION_FAILED = 'OPERATION_FAILED',
  /** 操作取消 */
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
  /** 操作超时 */
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  /** 内部错误 */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  /** 服务不可用 */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * 对话错误
 */
interface ConversationError {
  /** 错误代码 */
  code: ConversationErrorCode;
  /** 错误消息 */
  message: string;
  /** 详细描述 */
  details?: ErrorDetails;
  /** 原始错误 */
  originalError?: Error;
  /** 错误上下文 */
  context?: ErrorContext;
  /** 恢复建议 */
  recoverySuggestion?: string;
  /** 是否可重试 */
  retryable: boolean;
}

/**
 * 错误详情
 */
interface ErrorDetails {
  /** 错误字段 */
  field?: string;
  /** 错误值 */
  value?: any;
  /** 约束条件 */
  constraints?: Record<string, any>;
  /** 堆栈信息 */
  stack?: string;
}

/**
 * 错误上下文
 */
interface ErrorContext {
  sessionId?: string;
  requestId?: string;
  operation?: string;
  timestamp: number;
  pluginVersion?: string;
}
```

### 错误分类与处理策略

```typescript
/**
 * 错误分类
 */
enum ErrorCategory {
  /** 会话相关错误 */
  SESSION = 'session',
  /** 上下文相关错误 */
  CONTEXT = 'context',
  /** 消息处理错误 */
  MESSAGE = 'message',
  /** 工具调用错误 */
  TOOL = 'tool',
  /** 状态管理错误 */
  STATE = 'state',
  /** 配置错误 */
  CONFIG = 'config',
  /** 系统错误 */
  SYSTEM = 'system',
}

/**
 * 错误处理策略
 */
interface ErrorHandlingStrategy {
  /** 错误代码 */
  errorCode: ConversationErrorCode;
  /** 错误分类 */
  category: ErrorCategory;
  /** 是否可重试 */
  retryable: boolean;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelay: number;
  /** 是否降级处理 */
  fallbackEnabled: boolean;
  /** 降级处理策略 */
  fallbackStrategy?: FallbackStrategy;
}

/**
 * 降级策略
 */
interface FallbackStrategy {
  /** 策略类型 */
  type: FallbackType;
  /** 策略参数 */
  params?: Record<string, any>;
  /** 降级后的响应 */
  fallbackResponse?: string;
}

/**
 * 降级类型枚举
 */
enum FallbackType {
  /** 返回错误信息 */
  ERROR_MESSAGE = 'error_message',
  /** 返回缓存结果 */
  CACHED_RESULT = 'cached_result',
  /** 返回默认响应 */
  DEFAULT_RESPONSE = 'default_response',
  /** 降级到简化处理 */
  SIMPLIFIED = 'simplified',
}

/**
 * 预定义错误处理策略
 */
const ERROR_HANDLING_STRATEGIES: Record<ConversationErrorCode, ErrorHandlingStrategy> = {
  // 会话错误
  [ConversationErrorCode.SESSION_NOT_FOUND]: {
    errorCode: ConversationErrorCode.SESSION_NOT_FOUND,
    category: ErrorCategory.SESSION,
    retryable: false,
    maxRetries: 0,
    retryDelay: 0,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.ERROR_MESSAGE,
      fallbackResponse: '会话不存在或已过期，请创建新会话',
    },
  },
  [ConversationErrorCode.SESSION_LIMIT_EXCEEDED]: {
    errorCode: ConversationErrorCode.SESSION_LIMIT_EXCEEDED,
    category: ErrorCategory.SESSION,
    retryable: false,
    maxRetries: 0,
    retryDelay: 0,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.ERROR_MESSAGE,
      fallbackResponse: '会话数量已达上限，请关闭一些会话后再试',
    },
  },
  [ConversationErrorCode.SESSION_TIMEOUT]: {
    errorCode: ConversationErrorCode.SESSION_TIMEOUT,
    category: ErrorCategory.SESSION,
    retryable: true,
    maxRetries: 3,
    retryDelay: 1000,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.DEFAULT_RESPONSE,
      fallbackResponse: '会话已超时，正在重新连接...',
    },
  },

  // 上下文错误
  [ConversationErrorCode.CONTEXT_OVERFLOW]: {
    errorCode: ConversationErrorCode.CONTEXT_OVERFLOW,
    category: ErrorCategory.CONTEXT,
    retryable: false,
    maxRetries: 0,
    retryDelay: 0,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.SIMPLIFIED,
      params: { compression: true },
    },
  },
  [ConversationErrorCode.CONTEXT_COMPRESSION_FAILED]: {
    errorCode: ConversationErrorCode.CONTEXT_COMPRESSION_FAILED,
    category: ErrorCategory.CONTEXT,
    retryable: true,
    maxRetries: 2,
    retryDelay: 500,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.SIMPLIFIED,
      params: { clearOldMessages: true },
    },
  },

  // 消息错误
  [ConversationErrorCode.MESSAGE_EMPTY]: {
    errorCode: ConversationErrorCode.MESSAGE_EMPTY,
    category: ErrorCategory.MESSAGE,
    retryable: false,
    maxRetries: 0,
    retryDelay: 0,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.ERROR_MESSAGE,
      fallbackResponse: '请输入消息内容',
    },
  },
  [ConversationErrorCode.MESSAGE_TOO_LONG]: {
    errorCode: ConversationErrorCode.MESSAGE_TOO_LONG,
    category: ErrorCategory.MESSAGE,
    retryable: false,
    maxRetries: 0,
    retryEnabled: true,
    fallbackStrategy: {
      type: FallbackType.ERROR_MESSAGE,
      fallbackResponse: '消息过长，请缩短后重试',
    },
  },

  // 工具错误
  [ConversationErrorCode.TOOL_NOT_FOUND]: {
    errorCode: ConversationErrorCode.TOOL_NOT_FOUND,
    category: ErrorCategory.TOOL,
    retryable: false,
    maxRetries: 0,
    retryDelay: 0,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.ERROR_MESSAGE,
      fallbackResponse: '请求的工具不存在',
    },
  },
  [ConversationErrorCode.TOOL_CALL_TIMEOUT]: {
    errorCode: ConversationErrorCode.TOOL_CALL_TIMEOUT,
    category: ErrorCategory.TOOL,
    retryable: true,
    maxRetries: 2,
    retryDelay: 1000,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.ERROR_MESSAGE,
      fallbackResponse: '工具执行超时，请稍后重试',
    },
  },
  [ConversationErrorCode.TOOL_PERMISSION_DENIED]: {
    errorCode: ConversationErrorCode.TOOL_PERMISSION_DENIED,
    category: ErrorCategory.TOOL,
    retryable: false,
    maxRetries: 0,
    retryDelay: 0,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.ERROR_MESSAGE,
      fallbackResponse: '权限不足，无法调用此工具',
    },
  },

  // 状态错误
  [ConversationErrorCode.PLUGIN_NOT_INITIALIZED]: {
    errorCode: ConversationErrorCode.PLUGIN_NOT_INITIALIZED,
    category: ErrorCategory.STATE,
    retryable: false,
    maxRetries: 0,
    retryDelay: 0,
    fallbackEnabled: false,
  },
  [ConversationErrorCode.PLUGIN_BUSY]: {
    errorCode: ConversationErrorCode.PLUGIN_BUSY,
    category: ErrorCategory.STATE,
    retryable: true,
    maxRetries: 5,
    retryDelay: 500,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.DEFAULT_RESPONSE,
      fallbackResponse: '系统繁忙，请稍后重试',
    },
  },

  // 通用错误
  [ConversationErrorCode.UNKNOWN_ERROR]: {
    errorCode: ConversationErrorCode.UNKNOWN_ERROR,
    category: ErrorCategory.SYSTEM,
    retryable: true,
    maxRetries: 3,
    retryDelay: 1000,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.ERROR_MESSAGE,
      fallbackResponse: '发生未知错误，请稍后重试',
    },
  },
  [ConversationErrorCode.INTERNAL_ERROR]: {
    errorCode: ConversationErrorCode.INTERNAL_ERROR,
    category: ErrorCategory.SYSTEM,
    retryable: true,
    maxRetries: 2,
    retryDelay: 1000,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.ERROR_MESSAGE,
      fallbackResponse: '系统内部错误，请联系管理员',
    },
  },
  [ConversationErrorCode.SERVICE_UNAVAILABLE]: {
    errorCode: ConversationErrorCode.SERVICE_UNAVAILABLE,
    category: ErrorCategory.SYSTEM,
    retryable: true,
    maxRetries: 10,
    retryDelay: 5000,
    fallbackEnabled: true,
    fallbackStrategy: {
      type: FallbackType.DEFAULT_RESPONSE,
      fallbackResponse: '服务暂不可用，请稍后重试',
    },
  },
};

/**
 * 错误处理管理器
 */
class ConversationErrorHandler {
  private strategies: Map<ConversationErrorCode, ErrorHandlingStrategy>;

  constructor() {
    this.strategies = new Map(Object.entries(ERROR_HANDLING_STRATEGIES));
  }

  /**
   * 获取错误处理策略
   */
  getStrategy(errorCode: ConversationErrorCode): ErrorHandlingStrategy {
    return this.strategies.get(errorCode) || this.getDefaultStrategy(errorCode);
  }

  /**
   * 创建对话错误
   */
  createError(
    code: ConversationErrorCode,
    message: string,
    options?: CreateErrorOptions
  ): ConversationError {
    const strategy = this.getStrategy(code);

    return {
      code,
      message,
      details: options?.details,
      originalError: options?.originalError,
      context: {
        sessionId: options?.sessionId,
        requestId: options?.requestId,
        operation: options?.operation,
        timestamp: Date.now(),
      },
      recoverySuggestion: this.getRecoverySuggestion(code),
      retryable: strategy.retryable,
    };
  }

  /**
   * 处理错误
   */
  async handleError(error: ConversationError): Promise<ErrorHandlingResult> {
    const strategy = this.getStrategy(error.code);

    // 记录错误日志
    this.logError(error);

    // 如果可重试，尝试重试
    if (strategy.retryable && strategy.maxRetries > 0) {
      const retryResult = await this.tryRetry(error, strategy);
      if (retryResult.success) {
        return retryResult;
      }
    }

    // 应用降级策略
    if (strategy.fallbackEnabled && strategy.fallbackStrategy) {
      return this.applyFallback(error, strategy.fallbackStrategy);
    }

    // 返回错误结果
    return {
      success: false,
      error,
      handled: true,
    };
  }

  private getDefaultStrategy(code: ConversationErrorCode): ErrorHandlingStrategy {
    return {
      errorCode: code,
      category: ErrorCategory.SYSTEM,
      retryable: false,
      maxRetries: 0,
      retryDelay: 0,
      fallbackEnabled: true,
      fallbackStrategy: {
        type: FallbackType.ERROR_MESSAGE,
        fallbackResponse: '发生错误，请稍后重试',
      },
    };
  }

  private getRecoverySuggestion(code: ConversationErrorCode): string {
    const suggestions: Record<ConversationErrorCode, string> = {
      [ConversationErrorCode.SESSION_NOT_FOUND]: '请创建新会话或检查会话ID是否正确',
      [ConversationErrorCode.SESSION_LIMIT_EXCEEDED]: '请关闭一些会话后再试',
      [ConversationErrorCode.CONTEXT_OVERFLOW]: '请清除部分对话历史或等待系统自动压缩',
      [ConversationErrorCode.TOOL_PERMISSION_DENIED]: '请检查权限配置或联系管理员',
      [ConversationErrorCode.SERVICE_UNAVAILABLE]: '请稍后重试或联系管理员',
    };
    return suggestions[code] || '请稍后重试';
  }

  private logError(error: ConversationError): void {
    console.error(`[ConversationError] ${error.code}: ${error.message}`, {
      context: error.context,
      retryable: error.retryable,
    });
  }

  private async tryRetry(
    error: ConversationError,
    strategy: ErrorHandlingStrategy
  ): Promise<ErrorHandlingResult> {
    for (let i = 0; i < strategy.maxRetries; i++) {
      await this.delay(strategy.retryDelay);
      // 重试逻辑（实际应执行原操作）
    }
    return { success: false, error, handled: false };
  }

  private async applyFallback(
    error: ConversationError,
    strategy: FallbackStrategy
  ): Promise<ErrorHandlingResult> {
    return {
      success: true,
      error,
      handled: true,
      fallbackApplied: true,
      fallbackResponse: strategy.fallbackResponse,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建错误选项
 */
interface CreateErrorOptions {
  details?: ErrorDetails;
  originalError?: Error;
  sessionId?: string;
  requestId?: string;
  operation?: string;
}

/**
 * 错误处理结果
 */
interface ErrorHandlingResult {
  success: boolean;
  error?: ConversationError;
  handled: boolean;
  fallbackApplied?: boolean;
  fallbackResponse?: string;
}
```

---

## 配置规范

### 配置项定义

```typescript
/**
 * 核心对话Plugin配置
 */
interface CoreConversationPluginConfig extends PluginConfig {
  // ==================== 会话配置 ====================
  /** 最大会话数量 */
  max_sessions: number;

  /** 默认会话超时时间（毫秒） */
  default_session_timeout: number;

  /** 默认空闲超时时间（毫秒） */
  default_idle_timeout: number;

  // ==================== 上下文配置 ====================
  /** 默认上下文窗口大小 */
  default_window_size: number;

  /** 最大上下文token数 */
  max_context_tokens: number;

  /** 是否启用上下文自动压缩 */
  enable_auto_compression: boolean;

  /** 自动压缩阈值（百分比） */
  auto_compression_threshold: number;

  // ==================== 输入输出配置 ====================
  /** 最大输入长度 */
  max_input_length: number;

  /** 最大输出长度 */
  max_output_length: number;

  /** 默认输出格式 */
  default_output_format: OutputFormat;

  /** 是否启用流式输出 */
  enable_streaming: boolean;

  /** 流式输出类型 */
  streaming_type: StreamingType;

  // ==================== 错误处理配置 ====================
  /** 最大重试次数 */
  max_retry_attempts: number;

  /** 默认重试延迟（毫秒） */
  default_retry_delay: number;

  /** 是否记录详细错误日志 */
  verbose_error_logging: boolean;

  // ==================== 存储配置 ====================
  /** 会话存储类型 */
  session_storage_type: StorageType;

  /** 上下文存储类型 */
  context_storage_type: StorageType;

  /** 是否启用持久化 */
  enable_persistence: boolean;

  /** 持久化间隔（毫秒） */
  persistence_interval: number;

  // ==================== 功能开关 ====================
  /** 启用的功能列表 */
  enabled_features: ConversationFeature[];

  /** 禁用的功能列表 */
  disabled_features: ConversationFeature[];
}

/**
 * 对话功能枚举
 */
enum ConversationFeature {
  /** 会话管理 */
  SESSION_MANAGEMENT = 'session_management',
  /** 上下文压缩 */
  CONTEXT_COMPRESSION = 'context_compression',
  /** 历史摘要 */
  HISTORY_SUMMARY = 'history_summary',
  /** 流式输出 */
  STREAMING = 'streaming',
  /** 工具调用 */
  TOOL_CALLS = 'tool_calls',
  /** 多模态支持 */
  MULTIMODAL = 'multimodal',
  /** 会话搜索 */
  SESSION_SEARCH = 'session_search',
}

/**
 * 存储类型枚举
 */
enum StorageType {
  MEMORY = 'memory',
  FILE = 'file',
  DATABASE = 'database',
}
```

### 配置Schema定义

```typescript
/**
 * 配置Schema定义
 */
const CORE_CONVERSATION_PLUGIN_CONFIG_SCHEMA: ConfigSchema = {
  type: 'object',
  properties: {
    // 会话配置
    max_sessions: {
      type: 'number',
      default: 100,
      minimum: 1,
      maximum: 1000,
      description: '最大并发会话数量',
    },
    default_session_timeout: {
      type: 'number',
      default: 3600000, // 1小时
      minimum: 60000, // 最小1分钟
      description: '默认会话超时时间（毫秒）',
    },
    default_idle_timeout: {
      type: 'number',
      default: 1800000, // 30分钟
      minimum: 60000,
      description: '默认空闲超时时间（毫秒）',
    },

    // 上下文配置
    default_window_size: {
      type: 'number',
      default: 50,
      minimum: 10,
      maximum: 200,
      description: '默认上下文窗口大小（消息数）',
    },
    max_context_tokens: {
      type: 'number',
      default: 128000,
      minimum: 1000,
      maximum: 1000000,
      description: '最大上下文token数',
    },
    enable_auto_compression: {
      type: 'boolean',
      default: true,
      description: '是否启用自动上下文压缩',
    },
    auto_compression_threshold: {
      type: 'number',
      default: 0.8,
      minimum: 0.5,
      maximum: 0.95,
      description: '自动压缩触发阈值（0-1）',
    },

    // 输入输出配置
    max_input_length: {
      type: 'number',
      default: 10000,
      minimum: 1,
      maximum: 100000,
      description: '最大输入长度（字符数）',
    },
    max_output_length: {
      type: 'number',
      default: 50000,
      minimum: 1,
      maximum: 500000,
      description: '最大输出长度（字符数）',
    },
    default_output_format: {
      type: 'string',
      default: 'cli',
      enum: ['plain_text', 'markdown', 'json', 'cli'],
      description: '默认输出格式',
    },
    enable_streaming: {
      type: 'boolean',
      default: true,
      description: '是否启用流式输出',
    },
    streaming_type: {
      type: 'string',
      default: 'sse',
      enum: ['sse', 'websocket', 'polling'],
      description: '流式输出传输类型',
    },

    // 错误处理配置
    max_retry_attempts: {
      type: 'number',
      default: 3,
      minimum: 0,
      maximum: 10,
      description: '最大重试次数',
    },
    default_retry_delay: {
      type: 'number',
      default: 1000,
      minimum: 100,
      maximum: 60000,
      description: '默认重试延迟（毫秒）',
    },
    verbose_error_logging: {
      type: 'boolean',
      default: false,
      description: '是否记录详细错误日志',
    },

    // 存储配置
    session_storage_type: {
      type: 'string',
      default: 'memory',
      enum: ['memory', 'file', 'database'],
      description: '会话存储类型',
    },
    context_storage_type: {
      type: 'string',
      default: 'memory',
      enum: ['memory', 'file', 'database'],
      description: '上下文存储类型',
    },
    enable_persistence: {
      type: 'boolean',
      default: true,
      description: '是否启用数据持久化',
    },
    persistence_interval: {
      type: 'number',
      default: 30000,
      minimum: 5000,
      maximum: 300000,
      description: '持久化间隔（毫秒）',
    },
  },
};

/**
 * 默认配置值
 */
const DEFAULT_CORE_CONVERSATION_PLUGIN_CONFIG: CoreConversationPluginConfig = {
  // 会话配置
  max_sessions: 100,
  default_session_timeout: 3600000,
  default_idle_timeout: 1800000,

  // 上下文配置
  default_window_size: 50,
  max_context_tokens: 128000,
  enable_auto_compression: true,
  auto_compression_threshold: 0.8,

  // 输入输出配置
  max_input_length: 10000,
  max_output_length: 50000,
  default_output_format: OutputFormat.CLI,
  enable_streaming: true,
  streaming_type: StreamingType.SSE,

  // 错误处理配置
  max_retry_attempts: 3,
  default_retry_delay: 1000,
  verbose_error_logging: false,

  // 存储配置
  session_storage_type: StorageType.MEMORY,
  context_storage_type: StorageType.MEMORY,
  enable_persistence: true,
  persistence_interval: 30000,

  // 功能开关
  enabled_features: [
    ConversationFeature.SESSION_MANAGEMENT,
    ConversationFeature.CONTEXT_COMPRESSION,
    ConversationFeature.STREAMING,
    ConversationFeature.TOOL_CALLS,
  ],
  disabled_features: [],
};
```

### 配置加载优先级

配置按以下优先级加载（从低到高）：

1. **Plugin默认配置** - 代码中定义的DEFAULT_CORE_CONVERSATION_PLUGIN_CONFIG
2. **系统级配置** - Kernel配置文件中的plugin.conversation.\*配置项
3. **项目级配置** - 项目根目录下的.organic/conversation.config.json
4. **用户级配置** - 用户目录下的.organic/conversation.config.json
5. **环境变量** - OC*PLUGIN*\*前缀的环境变量
6. **运行时配置** - Plugin初始化时传入的config参数

```typescript
/**
 * 配置加载器
 */
class ConfigLoader {
  private configSources: ConfigSource[];

  constructor() {
    this.configSources = [
      { name: 'default', priority: 1, load: () => DEFAULT_CORE_CONVERSATION_PLUGIN_CONFIG },
      { name: 'system', priority: 2, load: () => this.loadSystemConfig() },
      { name: 'project', priority: 3, load: () => this.loadProjectConfig() },
      { name: 'user', priority: 4, load: () => this.loadUserConfig() },
      { name: 'env', priority: 5, load: () => this.loadEnvConfig() },
      { name: 'runtime', priority: 6, load: () => null }, // 运行时配置单独处理
    ];
  }

  /**
   * 加载配置
   * @param runtimeConfig 运行时配置
   * @returns 合并后的配置
   */
  load(runtimeConfig?: Partial<CoreConversationPluginConfig>): CoreConversationPluginConfig {
    let config = {} as CoreConversationPluginConfig;

    // 按优先级加载所有配置源
    for (const source of this.configSources) {
      const sourceConfig = source.load();
      if (sourceConfig) {
        config = this.mergeConfig(config, sourceConfig);
      }
    }

    // 最后应用运行时配置
    if (runtimeConfig) {
      config = this.mergeConfig(config, runtimeConfig);
    }

    // 验证配置
    return this.validateConfig(config);
  }

  /**
   * 合并配置
   */
  private mergeConfig(
    base: Partial<CoreConversationPluginConfig>,
    override: Partial<CoreConversationPluginConfig>
  ): CoreConversationPluginConfig {
    return {
      ...base,
      ...override,
      enabled_features: override.enabled_features || base.enabled_features,
      disabled_features: override.disabled_features || base.disabled_features,
    };
  }

  /**
   * 验证配置
   */
  private validateConfig(config: CoreConversationPluginConfig): CoreConversationPluginConfig {
    const errors: string[] = [];

    // 验证数值范围
    if (config.max_sessions < 1 || config.max_sessions > 1000) {
      errors.push('max_sessions必须在1-1000之间');
    }

    if (config.default_window_size < 10 || config.default_window_size > 200) {
      errors.push('default_window_size必须在10-200之间');
    }

    // 验证逻辑一致性
    if (config.auto_compression_threshold > 1) {
      config.auto_compression_threshold = 1;
    }

    if (errors.length > 0) {
      throw new Error(`配置验证失败: ${errors.join(', ')}`);
    }

    return config;
  }
}
```

---

## 验收条件

| 序号 | 验收项              | 验收标准                                                                              | 检查方法 |
| ---- | ------------------- | ------------------------------------------------------------------------------------- | -------- |
| 1    | PluginInterface接口 | 定义完整的CoreConversationPluginInterface，包含会话管理、消息处理、上下文管理核心方法 | 代码审查 |
| 2    | PluginContext上下文 | 定义PluginContext包含Kernel API、工具服务、信息服务等必需接口                         | 代码审查 |
| 3    | 会话管理接口        | 定义createSession/getSession/resumeSession/closeSession/listSessions接口              | 代码审查 |
| 4    | 上下文管理接口      | 定义getContext/updateContext/clearContext/compressContext接口                         | 代码审查 |
| 5    | Kernel工具调用      | 定义ToolCallService封装Kernel工具服务，支持同步/异步/批量调用                         | 代码审查 |
| 6    | 输入解析器          | 定义InputParser接口和DefaultInputParser默认实现                                       | 代码审查 |
| 7    | 输出格式化器        | 定义OutputFormatter接口和DefaultOutputFormatter，支持CLI/Markdown/JSON格式            | 代码审查 |
| 8    | 流式输出支持        | 定义StreamingConfig和StreamChunk结构，支持SSE/WebSocket流式输出                       | 代码审查 |
| 9    | 错误码体系          | 定义至少15个错误代码，覆盖会话、上下文、消息、工具、状态、配置类型                    | 代码审查 |
| 10   | 错误处理策略        | 定义错误分类、处理策略和降级机制，支持重试和降级处理                                  | 代码审查 |
| 11   | 配置项清单          | 定义CoreConversationPluginConfig包含至少20个配置项                                    | 代码审查 |
| 12   | 配置Schema          | 定义ConfigSchema，包含类型、默认值、范围限制和描述                                    | 代码审查 |
| 13   | 配置加载优先级      | 定义6级配置加载优先级：默认/系统/项目/用户/环境/运行时                                | 代码审查 |
| 14   | 状态机定义          | 定义ConversationPluginStateMachine和状态转换规则                                      | 代码审查 |
| 15   | 事件订阅机制        | 定义EventService支持会话/消息/工具/系统事件订阅                                       | 代码审查 |
| 16   | 文档格式规范        | 文档格式符合feature文档模板，包含所有必需章节                                         | 格式检查 |

---

## 术语定义

| 术语                   | 定义                                                 |
| ---------------------- | ---------------------------------------------------- |
| CoreConversationPlugin | 核心对话Plugin，系统与用户交互的主要入口             |
| Session                | 会话，用户与系统之间的一次完整对话交互过程           |
| Context                | 对话上下文，存储会话中的消息历史和相关信息           |
| ContextWindow          | 上下文窗口，控制Agent一次处理的消息范围              |
| PluginContext          | Plugin上下文，Plugin初始化时由Kernel注入的运行时环境 |
| PluginInput            | Plugin输入，所有execute方法的输入参数结构            |
| PluginOutput           | Plugin输出，所有execute方法的返回结果结构            |
| ToolCall               | 工具调用，通过Kernel API执行的具体工具操作           |
| StreamChunk            | 流式片段，流式输出中的单个数据片段                   |
| ErrorHandlingStrategy  | 错误处理策略，定义错误发生时的处理方式和降级方案     |
| InputParser            | 输入解析器，将CLI文字输入转换为标准化内部格式        |
| OutputFormatter        | 输出格式化器，将处理结果转换为可读输出格式           |

---

## 相关文档

| 文档编号     | 文档名称                          | 关联说明                                           |
| ------------ | --------------------------------- | -------------------------------------------------- |
| feature-001  | feature-001-agent-architecture.md | Agent架构设计，核心对话Plugin的调用方              |
| feature-006  | feature-006-plugin-spec.md        | Plugin系统架构，CoreConversationPlugin的基础规范   |
| feature-007  | feature-007-tool-system.md        | 工具系统规范，核心对话Plugin调用工具服务的接口定义 |
| feature-008  | feature-008-context-management.md | 上下文管理服务，核心对话Plugin管理上下文的基础     |
| requirements | requirements.md                   | 需求规格说明，核心对话Plugin的需求来源             |
| kernel-api   | Kernel API规范                    | Kernel提供的核心服务接口定义                       |

---

## 版本兼容性

| Kernel API版本 | Plugin版本 | 兼容性说明                 |
| -------------- | ---------- | -------------------------- |
| 1.0.0          | 1.0.0      | 初始版本，完全兼容         |
| 1.1.0          | 1.0.0+     | 向后兼容，新增可选接口     |
| 2.0.0          | 2.0.0      | 可能不兼容旧版本，需要迁移 |

---

## 后续关联任务

- **task-P0-002**：实现核心对话Plugin代码
- **task-P0-003**：强化Kernel文字交互能力
- **task-P0-005**：开发CLI交互界面

---

_文档版本: 1.0.0_
_最后更新: 2026-04-25_
