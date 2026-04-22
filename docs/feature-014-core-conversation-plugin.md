# 规范文档：核心对话Plugin

## 基本信息

**文档编号**: DOC-014
**所属模块**: 核心架构 (core-conversation-plugin)
**优先级**: P0
**创建日期**: 2026-04-25
**对应需求章节**: 3.3 可扩展性需求
**执行分支**: agent-develop
**版本**: 1.0.0

---

## 功能概述

### 定位与价值

核心对话Plugin是Organic-Interface的核心交互组件，遵循Linux风格的设计理念，将系统划分为Kernel（内核）和Plugin（外围程序）两层架构。核心对话Plugin作为系统的主要入口点，负责处理用户与系统的自然语言交互，是用户感知系统的核心窗口。

### 设计哲学

本项目采用Linux的设计理念：
- **Kernel（内核）**：提供基础服务、任务调度、资源管理和运行环境
- **Plugin（外围程序）**：实现具体业务功能，通过标准接口与Kernel交互
- **核心对话Plugin**：与项目高度绑定的核心组件，内容丰富度等同于Kernel，但严谨分离职责

### 核心职责

核心对话Plugin承担以下核心职责：

1. **用户交互入口**：接收用户的CLI文字输入，提供结构化响应输出
2. **对话会话管理**：创建、维护和关闭对话会话，跟踪多轮对话状态
3. **上下文协调**：调用Kernel提供的上下文管理服务，确保对话连贯性
4. **工具调用编排**：封装对Kernel工具服务的调用，处理工具执行结果
5. **响应格式化**：将执行结果格式化为标准化输出格式

### 架构约束

- **Plugin要求**：基本CLI文字级别输入输出，可选GUI支持
- **Kernel要求**：必须完整支持文字交互
- **Plugin特性**：足够开放、足够安全可信、高度可定制

---

## 接口规范

### PluginInterface核心接口

所有Plugin必须实现PluginInterface标准接口。核心对话Plugin在此基础上扩展对话相关功能：

```typescript
/**
 * 核心对话Plugin接口
 * 继承自PluginInterface，扩展对话相关功能
 */
interface CoreConversationPluginInterface extends PluginInterface {
  // ==================== 核心方法（继承） ====================
  initialize(context: ConversationPluginContext): Promise<InitializeResult>;
  execute(input: ConversationPluginInput): Promise<ConversationPluginOutput>;
  shutdown(): Promise<void>;

  // ==================== 对话管理方法 ====================
  /**
   * 创建新对话会话
   * @param config 会话配置
   * @returns 对话会话信息
   */
  createSession(config: SessionConfig): Promise<Session>;

  /**
   * 获取现有会话
   * @param sessionId 会话ID
   * @returns 会话信息，不存在则返回null
   */
  getSession(sessionId: string): Promise<Session | null>;

  /**
   * 恢复历史会话
   * @param sessionId 会话ID
   * @returns 恢复后的会话信息
   */
  resumeSession(sessionId: string): Promise<Session>;

  /**
   * 关闭会话
   * @param sessionId 会话ID
   */
  closeSession(sessionId: string): Promise<void>;

  /**
   * 列出所有活跃会话
   * @returns 会话列表
   */
  listSessions(): Promise<Session[]>;

  // ==================== 上下文管理方法 ====================
  /**
   * 获取对话上下文
   * @param sessionId 会话ID
   * @returns 上下文窗口
   */
  getContext(sessionId: string): Promise<ContextWindow>;

  /**
   * 更新对话上下文
   * @param sessionId 会话ID
   * @param updates 上下文更新
   */
  updateContext(sessionId: string, updates: ContextUpdates): Promise<void>;

  /**
   * 清除对话上下文
   * @param sessionId 会话ID
   */
  clearContext(sessionId: string): Promise<void>;
}
```

### ConversationPluginContext上下文对象

Plugin初始化时接收的上下文对象，包含对话所需的Kernel服务：

```typescript
/**
 * 核心对话Plugin上下文
 * 继承自PluginContext，扩展对话相关服务
 */
interface ConversationPluginContext extends PluginContext {
  // ==================== 基础信息（继承） ====================
  plugin_id: string;
  kernel_api: KernelApi;
  config: PluginConfig;
  logger: Logger;

  // ==================== 对话相关服务 ====================
  /** 对话服务 */
  conversation_service: ConversationService;

  /** 上下文管理服务 */
  context_service: ContextService;

  /** 状态存储服务 */
  state_service: StateStorageService;

  /** 工具调用服务 */
  tool_service: KernelToolService;

  /** 事件总线 */
  event_bus: EventBus;

  /** 安全服务 */
  security_service: SecurityService;
}
```

### ConversationPluginInput输入对象

```typescript
/**
 * 核心对话Plugin输入
 */
interface ConversationPluginInput extends PluginInput {
  // ==================== 操作类型 ====================
  action: ConversationAction;

  // ==================== 操作参数 ====================
  parameters: {
    /** 会话ID（恢复会话、关闭会话时使用） */
    session_id?: string;

    /** 用户输入文本 */
    text?: string;

    /** 会话配置（创建会话时使用） */
    session_config?: SessionConfig;

    /** 上下文更新（更新上下文时使用） */
    context_updates?: ContextUpdates;

    /** 元数据 */
    metadata?: ConversationMetadata;
  };
}

/**
 * 对话操作类型枚举
 */
enum ConversationAction {
  /** 创建新会话 */
  CREATE_SESSION = "create_session",
  /** 发送消息 */
  SEND_MESSAGE = "send_message",
  /** 恢复会话 */
  RESUME_SESSION = "resume_session",
  /** 关闭会话 */
  CLOSE_SESSION = "close_session",
  /** 列出会话 */
  LIST_SESSIONS = "list_sessions",
  /** 获取上下文 */
  GET_CONTEXT = "get_context",
  /** 更新上下文 */
  UPDATE_CONTEXT = "update_context",
  /** 清除上下文 */
  CLEAR_CONTEXT = "clear_context"
}

/**
 * 会话配置
 */
interface SessionConfig {
  /** 会话标题 */
  title?: string;

  /** 会话标签 */
  tags?: string[];

  /** 会话元数据 */
  metadata?: Record<string, any>;

  /** 上下文窗口配置 */
  context_window?: ContextWindowConfig;

  /** 自动保存间隔（毫秒） */
  auto_save_interval?: number;

  /** 会话过期时间（毫秒） */
  ttl?: number;
}

/**
 * 对话元数据
 */
interface ConversationMetadata {
  /** 请求ID */
  request_id: string;

  /** 用户ID */
  user_id?: string;

  /** 时间戳 */
  timestamp: number;

  /** 输入格式 */
  input_format: InputFormat;

  /** 输出格式 */
  output_format: OutputFormat;

  /** 是否流式输出 */
  stream?: boolean;
}
```

### ConversationPluginOutput输出对象

```typescript
/**
 * 核心对话Plugin输出
 */
interface ConversationPluginOutput extends PluginOutput {
  // ==================== 操作结果 ====================
  success: boolean;
  result?: ConversationResult;
  error?: ConversationError;

  // ==================== 执行元数据 ====================
  metadata: {
    execution_time: number;
    plugin_version: string;
    session_id?: string;
    message_id?: string;
  };
}

/**
 * 对话结果
 */
interface ConversationResult {
  /** 结果类型 */
  type: ResultType;

  /** 消息内容 */
  message?: ResponseMessage;

  /** 会话信息 */
  session?: Session;

  /** 上下文窗口 */
  context_window?: ContextWindow;

  /** 会话列表 */
  sessions?: Session[];

  /** 工具调用结果 */
  tool_results?: ToolCallResult[];
}

/**
 * 结果类型枚举
 */
enum ResultType {
  /** 消息响应 */
  MESSAGE = "message",
  /** 会话信息 */
  SESSION = "session",
  /** 会话列表 */
  SESSION_LIST = "session_list",
  /** 上下文窗口 */
  CONTEXT = "context",
  /** 确认响应 */
  CONFIRMATION = "confirmation",
  /** 错误响应 */
  ERROR = "error"
}

/**
 * 响应消息
 */
interface ResponseMessage {
  /** 消息ID */
  id: string;

  /** 消息内容 */
  content: ResponseContent;

  /** 消息类型 */
  type: ResponseType;

  /** 发送者 */
  sender: MessageSender;

  /** 时间戳 */
  timestamp: number;

  /** 关联的请求 */
  request_id?: string;

  /** 工具调用信息 */
  tool_calls?: ToolCall[];

  /** 流式数据标记 */
  stream?: StreamInfo;
}

/**
 * 响应内容
 */
interface ResponseContent {
  /** 文本内容 */
  text: string;

  /** 内容格式 */
  format: ContentFormat;

  /** 结构化数据 */
  structured_data?: Record<string, any>;
}

/**
 * 响应类型枚举
 */
enum ResponseType {
  /** 文本响应 */
  TEXT = "text",
  /** 错误响应 */
  ERROR = "error",
  /** 确认请求 */
  CONFIRMATION = "confirmation",
  /** 状态更新 */
  STATUS = "status",
  /** 流式响应 */
  STREAM = "stream"
}
```

---

## 对话管理机制

### 会话管理接口

```typescript
/**
 * 会话管理服务接口
 */
interface SessionManagementService {
  /**
   * 创建新会话
   */
  createSession(config: SessionConfig): Promise<Session>;

  /**
   * 获取会话
   */
  getSession(sessionId: string): Promise<Session | null>;

  /**
   * 恢复会话
   */
  resumeSession(sessionId: string): Promise<Session>;

  /**
   * 更新会话
   */
  updateSession(sessionId: string, updates: SessionUpdates): Promise<Session>;

  /**
   * 关闭会话
   */
  closeSession(sessionId: string): Promise<void>;

  /**
   * 列出所有会话
   */
  listSessions(filter?: SessionFilter): Promise<Session[]>;

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): Promise<void>;
}

/**
 * 会话结构
 */
interface Session {
  /** 会话唯一标识 */
  id: string;

  /** 会话标题 */
  title: string;

  /** 会话状态 */
  status: SessionStatus;

  /** 会话标签 */
  tags: string[];

  /** 会话元数据 */
  metadata: Record<string, any>;

  /** 上下文窗口配置 */
  context_window: ContextWindowConfig;

  /** 创建时间 */
  created_at: number;

  /** 最后活跃时间 */
  last_active_at: number;

  /** 过期时间 */
  expires_at?: number;

  /** 消息计数 */
  message_count: number;

  /** 关联的项目 */
  project_id?: string;
}

/**
 * 会话状态枚举
 */
enum SessionStatus {
  /** 活跃 */
  ACTIVE = "active",
  /** 空闲 */
  IDLE = "idle",
  /** 已关闭 */
  CLOSED = "closed",
  /** 已归档 */
  ARCHIVED = "archived"
}

/**
 * 会话更新
 */
interface SessionUpdates {
  title?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  status?: SessionStatus;
  context_window?: ContextWindowConfig;
}

/**
 * 会话过滤条件
 */
interface SessionFilter {
  status?: SessionStatus | SessionStatus[];
  tags?: string[];
  project_id?: string;
  created_after?: number;
  created_before?: number;
  keyword?: string;
}
```

### 上下文管理接口

```typescript
/**
 * 上下文管理服务接口
 */
interface ContextManagementService {
  /**
   * 获取上下文窗口
   */
  getContextWindow(sessionId: string): Promise<ContextWindow>;

  /**
   * 添加消息到上下文
   */
  addMessage(sessionId: string, message: Message): Promise<void>;

  /**
   * 更新消息
   */
  updateMessage(sessionId: string, messageId: string, content: string): Promise<void>;

  /**
   * 删除消息
   */
  deleteMessage(sessionId: string, messageId: string): Promise<void>;

  /**
   * 清除上下文
   */
  clearContext(sessionId: string): Promise<void>;

  /**
   * 获取上下文统计
   */
  getContextStats(sessionId: string): Promise<ContextStats>;

  /**
   * 压缩上下文
   */
  compressContext(sessionId: string, strategy: CompressionStrategy): Promise<void>;
}

/**
 * 上下文窗口
 */
interface ContextWindow {
  /** 窗口唯一标识 */
  id: string;

  /** 所属会话ID */
  session_id: string;

  /** 包含的消息列表 */
  messages: Message[];

  /** 窗口配置 */
  config: ContextWindowConfig;

  /** 窗口token数 */
  token_count: number;

  /** 消息数量 */
  message_count: number;

  /** 创建时间 */
  created_at: number;
}

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
  RECENT_MESSAGES = "recent_messages",
  /** 基于Token数量 */
  TOKEN_BASED = "token_based",
  /** 基于语义相关性 */
  SEMANTIC_BASED = "semantic_based"
}

/**
 * 上下文统计
 */
interface ContextStats {
  message_count: number;
  token_count: number;
  system_message_count: number;
  tool_call_count: number;
  first_message_at: number;
  last_message_at: number;
}

/**
 * 压缩策略
 */
enum CompressionStrategy {
  /** 摘要压缩 */
  SUMMARY = "summary",
  /** 删除中间消息 */
  TRIM_MIDDLE = "trim_middle",
  /** 选择性保留 */
  SELECTIVE = "selective"
}
```

### 状态机定义

```typescript
/**
 * 对话状态机
 */
interface ConversationStateMachine {
  /**
   * 获取当前状态
   */
  getState(): ConversationState;

  /**
   * 发送事件
   */
  sendEvent(event: ConversationEvent): StateTransition;

  /**
   * 检查状态
   */
  isInState(state: ConversationState): boolean;

  /**
   * 订阅状态变化
   */
  onStateChange(callback: StateChangeCallback): UnsubscribeFn;
}

/**
 * 对话状态枚举
 */
enum ConversationState {
  /** 空闲状态 */
  IDLE = "idle",
  /** 等待输入 */
  WAITING_INPUT = "waiting_input",
  /** 处理中 */
  PROCESSING = "processing",
  /** 等待确认 */
  WAITING_CONFIRMATION = "waiting_confirmation",
  /** 执行工具 */
  EXECUTING_TOOL = "executing_tool",
  /** 生成响应 */
  GENERATING_RESPONSE = "generating_response",
  /** 发送响应 */
  SENDING_RESPONSE = "sending_response",
  /** 错误状态 */
  ERROR = "error"
}

/**
 * 对话事件枚举
 */
enum ConversationEvent {
  /** 用户输入 */
  USER_INPUT = "user_input",
  /** 输入结束 */
  INPUT_COMPLETE = "input_complete",
  /** 开始处理 */
  PROCESS_START = "process_start",
  /** 处理完成 */
  PROCESS_COMPLETE = "process_complete",
  /** 工具调用 */
  TOOL_CALL = "tool_call",
  /** 工具完成 */
  TOOL_COMPLETE = "tool_complete",
  /** 确认请求 */
  CONFIRMATION_REQUEST = "confirmation_request",
  /** 确认响应 */
  CONFIRMATION_RESPONSE = "confirmation_response",
  /** 响应完成 */
  RESPONSE_COMPLETE = "response_complete",
  /** 错误发生 */
  ERROR_OCCURRED = "error_occurred",
  /** 重置 */
  RESET = "reset"
}

/**
 * 状态转换
 */
interface StateTransition {
  from: ConversationState;
  to: ConversationState;
  event: ConversationEvent;
  timestamp: number;
}
```

---

## Kernel交互规范

### 工具调用封装

```typescript
/**
 * 工具调用服务封装
 */
interface ToolCallHandler {
  /**
   * 调用工具
   * @param toolName 工具名称
   * @param args 工具参数
   * @param options 调用选项
   * @returns 工具执行结果
   */
  callTool(
    toolName: string,
    args: ToolArgs,
    options?: ToolCallOptions
  ): Promise<ToolCallResult>;

  /**
   * 批量调用工具
   * @param calls 工具调用列表
   * @returns 执行结果列表
   */
  callTools(calls: ToolCall[]): Promise<ToolCallResult[]>;

  /**
   * 取消工具调用
   * @param callId 调用ID
   */
  cancelToolCall(callId: string): Promise<void>;
}

/**
 * 工具调用选项
 */
interface ToolCallOptions {
  /** 调用超时（毫秒） */
  timeout?: number;

  /** 是否流式返回 */
  stream?: boolean;

  /** 重试次数 */
  retries?: number;

  /** 调用上下文 */
  context?: Record<string, any>;
}

/**
 * 工具调用结果
 */
interface ToolCallResult {
  /** 调用ID */
  call_id: string;

  /** 工具名称 */
  tool_name: string;

  /** 调用结果 */
  result: any;

  /** 是否成功 */
  success: boolean;

  /** 错误信息 */
  error?: ToolCallError;

  /** 执行时间 */
  execution_time: number;

  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 工具调用错误
 */
interface ToolCallError {
  code: string;
  message: string;
  details?: any;
}
```

### 事件订阅机制

```typescript
/**
 * 事件订阅服务
 */
interface EventSubscriptionService {
  /**
   * 订阅事件
   * @param event 事件类型
   * @param handler 事件处理器
   * @param options 订阅选项
   * @returns 订阅ID
   */
  subscribe<E extends ConversationEvent>(
    event: E | E[],
    handler: EventHandler<E>,
    options?: SubscriptionOptions
  ): Subscription;

  /**
   * 取消订阅
   * @param subscriptionId 订阅ID
   */
  unsubscribe(subscriptionId: string): void;

  /**
   * 取消所有订阅
   */
  unsubscribeAll(): void;

  /**
   * 发布事件
   * @param event 事件类型
   * @param payload 事件数据
   */
  publish<E extends ConversationEvent>(
    event: E,
    payload: EventPayload<E>
  ): void;
}

/**
 * 订阅选项
 */
interface SubscriptionOptions {
  /** 是否仅触发一次 */
  once?: boolean;

  /** 优先级 */
  priority?: number;

  /** 过滤器 */
  filter?: EventFilter;

  /** 订阅者ID */
  subscriber_id?: string;
}

/**
 * 事件过滤器
 */
interface EventFilter {
  /** 会话ID过滤 */
  session_id?: string;

  /** 用户ID过滤 */
  user_id?: string;

  /** 自定义条件 */
  custom?: (payload: any) => boolean;
}

/**
 * 事件处理器类型
 */
type EventHandler<E extends ConversationEvent> = (
  payload: EventPayload<E>
) => void | Promise<void>;
```

### 信息服务接口

```typescript
/**
 * 信息服务接口
 */
interface InfoService {
  /**
   * 获取系统配置
   */
  getConfig(key: string): ConfigValue;

  /**
   * 获取所有配置
   */
  getAllConfigs(): Record<string, ConfigValue>;

  /**
   * 获取运行时信息
   */
  getRuntimeInfo(): RuntimeInfo;

  /**
   * 获取项目上下文
   */
  getProjectContext(): ProjectContext;

  /**
   * 获取对话配置
   */
  getConversationConfig(): ConversationConfig;
}

/**
 * 对话配置
 */
interface ConversationConfig {
  /** 默认上下文窗口大小 */
  default_context_window_size: number;

  /** 最大上下文窗口大小 */
  max_context_window_size: number;

  /** 默认会话过期时间 */
  default_session_ttl: number;

  /** 启用流式输出 */
  enable_streaming: boolean;

  /** 启用自动保存 */
  enable_auto_save: boolean;

  /** 最大并发会话数 */
  max_concurrent_sessions: number;
}
```

---

## 输入输出规范

### 输入解析器接口

```typescript
/**
 * 输入解析器接口
 * CLI文字级别输入的标准化处理
 */
interface InputParser {
  /**
   * 解析用户输入
   * @param rawInput 原始输入文本
   * @returns 解析后的结构化输入
   */
  parse(rawInput: string): ParsedInput;

  /**
   * 验证输入合法性
   * @param input 解析后的输入
   * @returns 验证结果
   */
  validate(input: ParsedInput): ValidationResult;

  /**
   * 获取帮助信息
   */
  getHelp(): string;
}

/**
 * 解析后的输入
 */
interface ParsedInput {
  /** 输入类型 */
  type: InputType;

  /** 原始文本 */
  raw_text: string;

  /** 规范化文本 */
  normalized_text: string;

  /** 提取的命令 */
  command?: string;

  /** 提取的参数 */
  arguments?: Record<string, any>;

  /** 提取的选项 */
  options?: InputOptions;

  /** 元数据 */
  metadata: {
    timestamp: number;
    user_id?: string;
    session_id?: string;
  };
}

/**
 * 输入类型枚举
 */
enum InputType {
  /** 普通文本消息 */
  TEXT = "text",
  /** 命令输入 */
  COMMAND = "command",
  /** 系统命令 */
  SYSTEM = "system",
  /** 配置命令 */
  CONFIG = "config",
  /** 元命令 */
  META = "meta"
}

/**
 * 输入选项
 */
interface InputOptions {
  /** 流式输出标志 */
  stream?: boolean;

  /** 安静模式 */
  quiet?: boolean;

  /** 详细输出 */
  verbose?: boolean;

  /** 输出格式 */
  format?: OutputFormat;

  /** 超时设置 */
  timeout?: number;
}
```

### 输出格式化器接口

```typescript
/**
 * 输出格式化器接口
 * 结构化响应的标准化输出
 */
interface OutputFormatter {
  /**
   * 格式化响应
   * @param response 响应内容
   * @param format 输出格式
   * @returns 格式化后的输出
   */
  format(response: ResponseMessage, format: OutputFormat): FormattedOutput;

  /**
   * 格式化错误
   * @param error 错误信息
   * @returns 格式化后的错误输出
   */
  formatError(error: ConversationError): FormattedOutput;

  /**
   * 格式化状态
   * @param status 状态信息
   * @returns 格式化后的状态输出
   */
  formatStatus(status: StatusInfo): FormattedOutput;
}

/**
 * 格式化输出
 */
interface FormattedOutput {
  /** 输出内容 */
  content: string;

  /** 内容类型 */
  content_type: string;

  /** 是否为流式 */
  is_stream: boolean;

  /** 元数据 */
  metadata: OutputMetadata;
}

/**
 * 输出格式枚举
 */
enum OutputFormat {
  /** 纯文本 */
  TEXT = "text",
  /** Markdown */
  MARKDOWN = "markdown",
  /** JSON */
  JSON = "json",
  /** 带颜色的终端输出 */
  ANSI = "ansi",
  /** 流式输出 */
  STREAM = "stream"
}

/**
 * 输出元数据
 */
interface OutputMetadata {
  timestamp: number;
  format: OutputFormat;
  request_id?: string;
  session_id?: string;
}
```

### 流式输出支持

```typescript
/**
 * 流式输出接口
 */
interface StreamOutput {
  /**
   * 开始流式输出
   * @param sessionId 会话ID
   * @param requestId 请求ID
   * @returns 流处理器
   */
  startStream(sessionId: string, requestId: string): StreamHandler;

  /**
   * 写入流数据
   * @param data 数据块
   */
  write(data: StreamChunk): void;

  /**
   * 结束流
   */
  end(): void;

  /**
   * 错误处理
   * @param error 错误信息
   */
  error(error: Error): void;
}

/**
 * 流处理器
 */
interface StreamHandler {
  /** 流ID */
  id: string;

  /** 会话ID */
  session_id: string;

  /** 请求ID */
  request_id: string;

  /** 流状态 */
  status: StreamStatus;

  /** 开始时间 */
  start_time: number;

  /** 发送回调 */
  onSend: (chunk: string) => void;

  /** 完成回调 */
  onComplete: (result: StreamResult) => void;

  /** 错误回调 */
  onError: (error: Error) => void;
}

/**
 * 流数据块
 */
interface StreamChunk {
  /** 数据类型 */
  type: ChunkType;

  /** 数据内容 */
  content: string;

  /** 增量内容 */
  delta?: string;

  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 流数据类型枚举
 */
enum ChunkType {
  /** 文本块 */
  TEXT = "text",
  /** 工具调用块 */
  TOOL_CALL = "tool_call",
  /** 工具结果块 */
  TOOL_RESULT = "tool_result",
  /** 状态块 */
  STATUS = "status",
  /** 完成块 */
  DONE = "done",
  /** 错误块 */
  ERROR = "error"
}

/**
 * 流状态枚举
 */
enum StreamStatus {
  /** 准备中 */
  PREPARING = "preparing",
  /** 运行中 */
  RUNNING = "running",
  /** 暂停 */
  PAUSED = "paused",
  /** 已完成 */
  COMPLETED = "completed",
  /** 已取消 */
  CANCELLED = "cancelled",
  /** 错误 */
  ERROR = "error"
}
```

---

## 错误处理规范

### 错误码体系

核心对话Plugin定义了完整的错误码体系：

```typescript
/**
 * 错误码枚举
 */
enum ConversationErrorCode {
  // ==================== 会话错误 (1000-1999) ====================
  /** 会话不存在 */
  SESSION_NOT_FOUND = "CONV_1001",
  /** 会话已存在 */
  SESSION_ALREADY_EXISTS = "CONV_1002",
  /** 会话已关闭 */
  SESSION_CLOSED = "CONV_1003",
  /** 会话创建失败 */
  SESSION_CREATE_FAILED = "CONV_1004",
  /** 会话恢复失败 */
  SESSION_RESUME_FAILED = "CONV_1005",
  /** 最大会话数限制 */
  SESSION_LIMIT_EXCEEDED = "CONV_1006",

  // ==================== 上下文错误 (2000-2999) ====================
  /** 上下文不存在 */
  CONTEXT_NOT_FOUND = "CONV_2001",
  /** 上下文已过期 */
  CONTEXT_EXPIRED = "CONV_2002",
  /** 上下文溢出 */
  CONTEXT_OVERFLOW = "CONV_2003",
  /** 上下文压缩失败 */
  CONTEXT_COMPRESS_FAILED = "CONV_2004",
  /** 消息不存在 */
  MESSAGE_NOT_FOUND = "CONV_2005",

  // ==================== 输入错误 (3000-3999) ====================
  /** 输入解析失败 */
  INPUT_PARSE_FAILED = "CONV_3001",
  /** 输入验证失败 */
  INPUT_VALIDATION_FAILED = "CONV_3002",
  /** 输入为空 */
  INPUT_EMPTY = "CONV_3003",
  /** 输入过长 */
  INPUT_TOO_LONG = "CONV_3004",
  /** 无效命令 */
  INVALID_COMMAND = "CONV_3005",

  // ==================== 输出错误 (4000-4999) ====================
  /** 输出格式化失败 */
  OUTPUT_FORMAT_FAILED = "CONV_4001",
  /** 流式输出失败 */
  STREAM_OUTPUT_FAILED = "CONV_4002",
  /** 输出超时 */
  OUTPUT_TIMEOUT = "CONV_4003",

  // ==================== 工具调用错误 (5000-5999) ====================
  /** 工具不存在 */
  TOOL_NOT_FOUND = "CONV_5001",
  /** 工具调用失败 */
  TOOL_CALL_FAILED = "CONV_5002",
  /** 工具调用超时 */
  TOOL_CALL_TIMEOUT = "CONV_5003",
  /** 工具参数无效 */
  TOOL_ARGUMENT_INVALID = "CONV_5004",
  /** 工具调用被取消 */
  TOOL_CALL_CANCELLED = "CONV_5005",

  // ==================== 系统错误 (9000-9999) ====================
  /** 内部错误 */
  INTERNAL_ERROR = "CONV_9001",
  /** 服务不可用 */
  SERVICE_UNAVAILABLE = "CONV_9002",
  /** 配置错误 */
  CONFIG_ERROR = "CONV_9003",
  /** 权限不足 */
  PERMISSION_DENIED = "CONV_9004",
  /** 状态无效 */
  INVALID_STATE = "CONV_9005"
}
```

### 错误结构定义

```typescript
/**
 * 对话错误
 */
interface ConversationError {
  /** 错误码 */
  code: ConversationErrorCode;

  /** 错误消息 */
  message: string;

  /** 详细描述 */
  details?: string;

  /** 原始错误 */
  original_error?: Error;

  /** 上下文信息 */
  context?: ErrorContext;

  /** 恢复建议 */
  recovery_hint?: string;

  /** 错误时间 */
  timestamp: number;
}

/**
 * 错误上下文
 */
interface ErrorContext {
  /** 会话ID */
  session_id?: string;

  /** 请求ID */
  request_id?: string;

  /** 用户ID */
  user_id?: string;

  /** 操作类型 */
  action?: ConversationAction;

  /** 状态 */
  state?: ConversationState;
}

/**
 * 错误分类
 */
enum ErrorCategory {
  /** 会话错误 */
  SESSION = "session",
  /** 上下文错误 */
  CONTEXT = "context",
  /** 输入错误 */
  INPUT = "input",
  /** 输出错误 */
  OUTPUT = "output",
  /** 工具错误 */
  TOOL = "tool",
  /** 系统错误 */
  SYSTEM = "system"
}
```

### 异常处理流程

```typescript
/**
 * 错误处理器接口
 */
interface ErrorHandler {
  /**
   * 处理错误
   * @param error 错误信息
   * @param context 错误上下文
   * @returns 处理结果
   */
  handle(error: Error, context?: ErrorContext): ErrorResult;

  /**
   * 恢复错误
   * @param error 错误信息
   * @returns 是否恢复成功
   */
  recover(error: ConversationError): Promise<boolean>;

  /**
   * 记录错误日志
   * @param error 错误信息
   */
  log(error: ConversationError): void;
}

/**
 * 错误处理结果
 */
interface ErrorResult {
  /** 是否已处理 */
  handled: boolean;

  /** 用户可见消息 */
  user_message?: string;

  /** 是否需要回退 */
  needs_rollback: boolean;

  /** 建议的操作 */
  suggested_action?: ConversationAction;
}

/**
 * 回退策略
 */
enum FallbackStrategy {
  /** 返回错误消息 */
  RETURN_ERROR = "return_error",
  /** 使用缓存响应 */
  USE_CACHED = "use_cached",
  /** 简化请求重试 */
  RETRY_SIMPLIFIED = "retry_simplified",
  /** 降级处理 */
  GRACEFUL_DEGRADATION = "graceful_degradation"
}
```

---

## 配置规范

### 配置项清单

```typescript
/**
 * 核心对话Plugin配置
 */
interface CoreConversationPluginConfig {
  // ==================== 会话配置 ====================
  /** 默认会话过期时间（毫秒） */
  default_session_ttl: number;

  /** 最大并发会话数 */
  max_concurrent_sessions: number;

  /** 会话自动保存间隔（毫秒） */
  session_auto_save_interval: number;

  // ==================== 上下文配置 ====================
  /** 默认上下文窗口大小 */
  default_context_window_size: number;

  /** 最大上下文窗口大小 */
  max_context_window_size: number;

  /** 最大token数限制 */
  max_tokens: number;

  /** 上下文压缩策略 */
  context_compression_strategy: CompressionStrategy;

  // ==================== 输入输出配置 ====================
  /** 默认输入格式 */
  default_input_format: InputFormat;

  /** 默认输出格式 */
  default_output_format: OutputFormat;

  /** 启用流式输出 */
  enable_streaming: boolean;

  /** 最大输入长度 */
  max_input_length: number;

  // ==================== 工具配置 ====================
  /** 工具调用超时（毫秒） */
  tool_call_timeout: number;

  /** 最大工具调用重试次数 */
  max_tool_retries: number;

  /** 工具调用并行数限制 */
  max_parallel_tool_calls: number;

  // ==================== 安全配置 ====================
  /** 启用输入验证 */
  enable_input_validation: boolean;

  /** 启用敏感信息过滤 */
  enable_sensitive_filter: boolean;

  /** 审计级别 */
  audit_level: AuditLevel;
}

/**
 * 审计级别枚举
 */
enum AuditLevel {
  /** 不审计 */
  NONE = "none",
  /** 仅错误 */
  ERROR = "error",
  /** 关键操作 */
  CRITICAL = "critical",
  /** 全部 */
  ALL = "all"
}
```

### 配置Schema

```typescript
/**
 * 配置Schema定义
 */
const configSchema: ConfigSchema = {
  type: "object",
  properties: {
    default_session_ttl: {
      type: "number",
      default: 86400000, // 24小时
      description: "默认会话过期时间（毫秒）",
      minimum: 60000, // 最小1分钟
      maximum: 604800000 // 最大7天
    },
    max_concurrent_sessions: {
      type: "number",
      default: 10,
      description: "最大并发会话数",
      minimum: 1,
      maximum: 100
    },
    default_context_window_size: {
      type: "number",
      default: 50,
      description: "默认上下文窗口大小（消息数）",
      minimum: 5,
      maximum: 500
    },
    max_context_window_size: {
      type: "number",
      default: 200,
      description: "最大上下文窗口大小（消息数）",
      minimum: 10,
      maximum: 2000
    },
    enable_streaming: {
      type: "boolean",
      default: true,
      description: "启用流式输出"
    },
    max_input_length: {
      type: "number",
      default: 10000,
      description: "最大输入长度（字符数）",
      minimum: 100,
      maximum: 100000
    },
    tool_call_timeout: {
      type: "number",
      default: 30000,
      description: "工具调用超时（毫秒）",
      minimum: 5000,
      maximum: 300000
    }
  },
  required: [
    "default_session_ttl",
    "max_concurrent_sessions",
    "default_context_window_size",
    "max_context_window_size"
  ]
};
```

### 配置加载优先级

配置按以下优先级加载（从低到高）：

1. **Plugin默认配置** (`default_config`)
2. **系统级Plugin配置** (`kernel.config.plugins.core-conversation`)
3. **项目级Plugin配置** (`project.config.json`)
4. **环境变量配置** (`CONVERSATION_*`)
5. **用户级Plugin配置** (`~/.organic/conversation.json`)

---

## 验收条件

| 序号 | 验收项 | 验收标准 | 验证方法 |
|------|--------|----------|----------|
| 1 | Plugin接口实现 | 定义完整的PluginInterface接口，包含initialize/execute/shutdown方法 | 代码审查 |
| 2 | 上下文结构定义 | PluginContext包含对话所需的Kernel服务（会话、上下文、工具、事件等） | 代码审查 |
| 3 | 会话管理功能 | 支持创建、恢复、关闭、列表会话的基本操作 | 单元测试 |
| 4 | 上下文管理功能 | 支持获取、更新、清除对话上下文 | 单元测试 |
| 5 | 工具调用封装 | 通过Kernel工具服务封装工具调用，支持批量调用和取消 | 单元测试 |
| 6 | 输入解析器 | CLI文字输入标准化解析，支持TEXT/COMMAND/SYSTEM类型 | 单元测试 |
| 7 | 输出格式化器 | 支持TEXT/MARKDOWN/JSON/ANSI格式的结构化输出 | 单元测试 |
| 8 | 流式输出支持 | 支持流式输出接口，包含start/write/end/error方法 | 单元测试 |
| 9 | 错误码体系 | 定义至少15个错误码，覆盖会话/上下文/输入/输出/工具/系统类别 | 代码审查 |
| 10 | 状态机实现 | 定义对话状态机和状态转换逻辑 | 代码审查 |
| 11 | 配置管理 | 定义配置项清单和Schema，支持多级配置加载 | 代码审查 |
| 12 | 事件订阅机制 | 支持对话事件的订阅和发布 | 单元测试 |
| 13 | 安全集成 | 与Kernel安全服务集成，支持权限检查 | 集成测试 |
| 14 | 文档完整性 | 包含术语定义和相关文档索引 | 文档审查 |

---

## 术语定义

| 术语 | 定义 |
|------|------|
| Kernel | 系统核心引擎，提供基础服务和运行环境，不包含具体业务逻辑 |
| Plugin | 功能扩展单元，实现具体业务逻辑，通过标准接口与Kernel交互 |
| 核心对话Plugin | 与项目高度绑定的核心Plugin，处理用户与系统的自然语言交互 |
| 会话 (Session) | 用户与系统一次完整对话的上下文容器，包含消息历史和状态 |
| 上下文 (Context) | 对话过程中维护的信息载体，包含消息历史和相关的上下文数据 |
| 上下文窗口 (Context Window) | 一次处理中可访问的消息范围，解决长对话场景下的token限制 |
| PluginContext | Plugin初始化时接收的上下文对象，包含Kernel服务和配置 |
| CLI | Command Line Interface，命令行界面，文字级别交互 |
| 流式输出 (Streaming) | 分块逐步返回输出，提升用户体验 |

---

## 相关文档

| 文档编号 | 文档名称 | 关联关系 |
|----------|----------|----------|
| DOC-001 | feature-001-agent-architecture.md | Agent架构参考 |
| DOC-006 | feature-006-plugin-spec.md | Plugin系统架构规范 |
| DOC-007 | feature-007-tool-system.md | 工具系统规范参考 |
| DOC-008 | feature-008-context-management.md | 上下文管理参考 |
| DOC-011 | feature-011-security-system.md | 安全管理系统参考 |

---

## 附录

### 附录A：错误消息模板

```
[错误码] 错误描述
详细信息: {details}
建议操作: {recovery_hint}
时间: {timestamp}
会话ID: {session_id}
请求ID: {request_id}
```

### 附录B：状态机转换表

| 当前状态 | 事件 | 下一状态 | 动作 |
|----------|------|----------|------|
| IDLE | USER_INPUT | PROCESSING | 解析输入 |
| PROCESSING | TOOL_CALL | EXECUTING_TOOL | 调用工具 |
| PROCESSING | PROCESS_COMPLETE | GENERATING_RESPONSE | 生成响应 |
| EXECUTING_TOOL | TOOL_COMPLETE | GENERATING_RESPONSE | 处理结果 |
| WAITING_CONFIRMATION | CONFIRMATION_RESPONSE | PROCESSING | 继续处理 |
| GENERATING_RESPONSE | RESPONSE_COMPLETE | SENDING_RESPONSE | 发送响应 |
| 任意状态 | ERROR_OCCURRED | ERROR | 错误处理 |

### 附录C：版本兼容性声明

- 本Plugin兼容Kernel API版本: `1.0.x`
- 最低Kernel版本要求: `1.0.0`
