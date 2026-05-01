# core-conversation Plugin

## 概述

`core-conversation` 是 Organic-Interface 的核心对话插件，提供基于文本的 CLI 交互界面。它作为用户与系统之间的主要接口，类似于 Linux 系统中的 "shell"。

## 设计理念

- **Kernel (核心)**: 提供基础服务、任务调度、资源管理
- **Plugin (插件)**: 实现具体业务逻辑、用户交互
- **core-conversation**: 主要的用户面插件，等价于 Linux 中的 "shell"

## 插件信息

| 属性 | 值 |
|------|-----|
| ID | `core-conversation` |
| 版本 | `1.0.0` |
| API 版本 | `1.0.0` |
| 最低 Kernel 版本 | `1.0.0` |

## 默认配置

```typescript
{
  maxSessionHistory: 100,        // 会话历史最大消息数
  defaultTimeout: 30000,          // 默认超时时间（毫秒）
  enableStreaming: false,         // 启用流式响应
  maxSessions: 100,               // 最大并发会话数
  defaultContextWindowSize: 50    // 默认上下文窗口大小
}
```

## 支持的操作

### create_session

创建新会话。

**参数**:
- `userId?: string` - 用户 ID
- `config?: SessionConfig` - 会话配置

**返回**: `Session` 对象

**示例**:
```typescript
const result = await plugin.execute({
  action: 'create_session',
  params: { userId: 'user-123' }
});
```

### send_message

发送消息到会话。

**参数**:
- `text: string` - 消息文本
- `sessionId?: string` - 会话 ID（可选，使用当前活跃会话）

**返回**: `ConversationResult` 包含消息、会话和上下文窗口

**示例**:
```typescript
const result = await plugin.execute({
  action: 'send_message',
  params: {
    text: 'Hello, world!',
    sessionId: 'session-id-123'
  }
});
```

### resume_session

恢复已存在的会话。

**参数**:
- `sessionId: string` - 会话 ID

**返回**: `Session` 对象

**示例**:
```typescript
const result = await plugin.execute({
  action: 'resume_session',
  params: { sessionId: 'session-id-123' }
});
```

### close_session

关闭会话。

**参数**:
- `sessionId?: string` - 会话 ID（可选，使用当前活跃会话）

**返回**: 确认消息

**示例**:
```typescript
await plugin.execute({
  action: 'close_session',
  params: { sessionId: 'session-id-123' }
});
```

### list_sessions

列出所有会话。

**参数**:
- `filter?: SessionFilter` - 过滤条件

**返回**: 会话列表

**示例**:
```typescript
const result = await plugin.execute({
  action: 'list_sessions',
  params: { filter: { status: 'active' } }
});
```

### get_session

获取会话信息。

**参数**:
- `sessionId?: string` - 会话 ID

**返回**: `Session` 对象

### get_context

获取会话的上下文窗口。

**参数**:
- `sessionId?: string` - 会话 ID

**返回**: `ContextWindow` 对象

### clear_context

清除会话的上下文。

**参数**:
- `sessionId?: string` - 会话 ID

**返回**: 确认消息

### update_context

更新会话的上下文。

**参数**:
- `sessionId?: string` - 会话 ID
- `updates: Record<string, unknown>` - 更新内容

**返回**: 更新后的 `ContextWindow`

## 核心组件

### SessionManager

管理会话的生命周期。

**主要功能**:
- 创建新会话
- 恢复已存在的会话
- 关闭会话
- 跟踪会话状态
- 管理会话超时

**示例**:
```typescript
const sessionManager = plugin.getSessionManager();
const session = await sessionManager.createSession({
  userId: 'user-123',
  config: { ttl: 60000 }
});
```

### ContextManager

管理对话上下文和消息历史。

**主要功能**:
- 维护消息历史
- 管理上下文窗口大小
- 支持系统消息和工具调用
- 提供上下文查询和更新

**示例**:
```typescript
const contextManager = plugin.getContextManager();
const contextWindow = await contextManager.getContextWindow('session-id-123');
await contextManager.addMessage('session-id-123', message);
```

### InputParser

解析用户输入，支持命令识别和意图提取。

**主要功能**:
- 文本规范化
- 命令识别
- 意图提取
- 输入验证

**示例**:
```typescript
const parsedInput = plugin.parseInput('Hello, how are you?');
// {
//   normalizedText: 'hello how are you',
//   intent: 'greeting',
//   entities: {},
//   confidence: 0.95,
//   metadata: { ... }
// }
```

### OutputFormatter

格式化输出结果。

**主要功能**:
- 格式化对话结果
- 添加时间戳
- 处理样式和颜色
- 支持多种输出格式

**示例**:
```typescript
const formatted = plugin.formatOutput(result);
// {
//   text: '...',
//   metadata: { timestamp: 1234567890 }
// }
```

## 类型定义

### Session

```typescript
interface Session {
  id: string;
  userId?: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  metadata?: Record<string, unknown>;
}
```

### Message

```typescript
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, unknown>;
}
```

### ContextWindow

```typescript
interface ContextWindow {
  sessionId: string;
  messages: Message[];
  systemMessages: Message[];
  toolCalls: Message[];
  windowSize: number;
}
```

### ParsedInput

```typescript
interface ParsedInput {
  originalText: string;
  normalizedText: string;
  intent?: string;
  entities: Record<string, unknown>;
  confidence: number;
  metadata: {
    timestamp: number;
    requestId: string;
  };
}
```

### ConversationResult

```typescript
interface ConversationResult {
  type: 'session' | 'message' | 'confirmation' | 'session_list' | 'context';
  session?: Session;
  message?: ResponseMessage;
  sessions?: Session[];
  contextWindow?: ContextWindow;
}
```

## 错误处理

### ConversationError

```typescript
enum ConversationErrorCode {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',
  TIMEOUT = 'TIMEOUT',
  PARSER_ERROR = 'PARSER_ERROR',
  FORMATTER_ERROR = 'FORMATTER_ERROR'
}
```

### 处理错误

```typescript
try {
  await plugin.execute({
    action: 'send_message',
    params: { text: 'Hello' }
  });
} catch (error) {
  if (error instanceof ConversationError) {
    console.error(`Error [${error.code}]: ${error.message}`);
  }
}
```

## 使用完整示例

```typescript
import { CoreConversationPlugin } from '@organic/plugins';

async function main() {
  const plugin = new CoreConversationPlugin();

  await plugin.initialize({
    kernel: kernelApi,
    config: {
      maxSessions: 50,
      defaultTimeout: 60000
    }
  });

  // 创建会话
  const createResult = await plugin.execute({
    action: 'create_session',
    params: { userId: 'user-123' }
  });
  const sessionId = createResult.data.session.id;
  console.log(`Created session: ${sessionId}`);

  // 发送消息
  const messageResult = await plugin.execute({
    action: 'send_message',
    params: {
      text: 'Hello, world!',
      sessionId
    }
  });
  console.log(`Response: ${messageResult.data.message.content.text}`);

  // 获取上下文
  const contextResult = await plugin.execute({
    action: 'get_context',
    params: { sessionId }
  });
  console.log(`Context window size: ${contextResult.data.contextWindow.messages.length}`);

  // 关闭会话
  await plugin.execute({
    action: 'close_session',
    params: { sessionId }
  });

  // 关闭插件
  await plugin.shutdown();
}

main().catch(console.error);
```