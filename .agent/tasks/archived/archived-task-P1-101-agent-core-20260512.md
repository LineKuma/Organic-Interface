# 任务文档：实现 @organic/agent 核心模块

## 基本信息

- **任务编号**: task-P1-101
- **任务名称**: 实现 @organic/agent 核心模块
- **所属模块**: 核心架构 (agent)
- **优先级**: P1
- **状态**: completed
- **执行分支**: agent-develop
- **创建日期**: 2026-04-15
- **完成日期**: 2026-04-20
- **对应文档**: feature-001-agent-architecture.md, feature-008-context-management.md

---

## 任务目标

根据 feature-001-agent-architecture.md（并行多层Agent架构）和 feature-008-context-management.md（上下文管理服务系统）文档定义，实现 @organic/agent 模块的核心功能，包括 Agent 主类、任务调度器、上下文管理器。

---

## 交付物清单

### 目录结构

```
packages/agent/src/
├── core/                # Agent 核心组件
│   ├── Agent.ts        # Agent 主类
│   ├── AgentConfig.ts  # Agent 配置
│   ├── AgentState.ts   # Agent 状态
│   └── index.ts        # Core 模块导出
├── scheduler/           # 调度器组件
│   ├── TaskQueue.ts    # 任务队列
│   ├── TaskScheduler.ts # 任务调度器
│   └── index.ts        # Scheduler 模块导出
├── context/             # 上下文管理组件
│   ├── Message.ts      # 消息结构
│   ├── ContextManager.ts # 上下文管理器
│   └── index.ts        # Context 模块导出
└── index.ts            # 模块主入口
```

---

## 实现详情

### 1. Agent 核心 (core/)

#### AgentConfig.ts

**配置接口**
- `AgentConfig`: Agent 完整配置
- `AgentConfigOptions`: 创建选项
- `AgentType`: Agent 类型枚举 (ORCHESTRATOR, EXECUTOR, PLANNER, MONITOR, CUSTOM)
- `AgentPriority`: 优先级枚举 (LOW, NORMAL, HIGH, CRITICAL)

**默认配置**
- `maxDepth`: 3
- `maxParallelTasks`: 10
- `communicationTimeout`: 5000ms
- `heartbeatInterval`: 30s

#### AgentState.ts

**状态枚举**
- `AgentStatus`: 状态枚举 (IDLE, BUSY, ERROR, OFFLINE, INITIALIZING, SHUTTING_DOWN)

**状态接口**
- `AgentState`: 包含 agentId, name, status, capabilities, load, 任务统计等
- `AgentStats`: 统计信息接口

**状态工厂**
- `createAgentState()`: 创建初始状态
- `getAgentStats()`: 获取统计信息

#### Agent.ts

**核心功能**
- `initialize()`: 初始化 Agent
- `shutdown()`: 关闭 Agent
- `execute(input)`: 执行任务
- `registerTaskHandler(name, handler)`: 注册任务处理器
- `unregisterTaskHandler(name)`: 注销任务处理器
- `registerChildAgent(agent)`: 注册子 Agent
- `unregisterChildAgent(agentId)`: 注销子 Agent
- `getChildAgents()`: 获取所有子 Agent
- `sendMessage(target, action, payload)`: 发送消息
- `hasCapability(capability)`: 检查能力
- `canAcceptTasks()`: 检查是否可接受任务

**事件**
- `task:start`, `task:complete`, `task:error`: 任务生命周期
- `status:change`: 状态变更
- `child:register`, `child:unregister`: 子 Agent 管理
- `heartbeat`: 心跳

**特性**
- 继承 EventEmitter
- 集成 Kernel API
- 心跳监控
- 任务超时控制
- 子 Agent 管理
- 执行统计追踪

### 2. 调度器 (scheduler/)

#### TaskQueue.ts

**任务结构**
- `Task`: 完整任务定义
- `TaskOptions`: 创建选项

**枚举**
- `TaskPriority`: 优先级 (LOW=0, NORMAL=1, HIGH=2, CRITICAL=3)
- `TaskStatus`: 状态 (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)

**队列操作**
- `enqueue(task)`: 入队（按优先级排序）
- `dequeue()`: 出队（返回下一个可执行任务）
- `peek()`: 查看下一个任务
- `remove(taskId)`: 移除任务
- `clear()`: 清空队列

**任务状态管理**
- `complete(taskId, result)`: 标记完成
- `fail(taskId, error)`: 标记失败（支持重试）
- `cancel(taskId)`: 取消任务

**查询方法**
- `size()`: 待执行任务数
- `getPendingTasks()`: 获取待执行任务
- `getRunningTasks()`: 获取运行中任务
- `getCompletedTasks()`: 获取已完成任务
- `areDependenciesMet(task)`: 检查依赖是否满足

#### TaskScheduler.ts

**调度器功能**
- `start()`: 启动调度器
- `stop()`: 停止调度器
- `schedule(options)`: 调度任务
- `scheduleMany(tasks)`: 批量调度
- `cancel(taskId)`: 取消任务
- `cancelAll()`: 取消所有任务
- `setExecutor(executor)`: 设置执行器

**并发控制**
- `maxParallelTasks`: 最大并行数
- `hasCapacity()`: 检查是否可接受任务
- `getRunningCount()`: 获取运行中任务数

**事件**
- `task:scheduled`, `task:started`, `task:completed`, `task:failed`, `task:cancelled`
- `queue:empty`, `queue:full`
- `status:change`

**特性**
- 自动/手动处理模式
- 任务超时控制
- 失败重试
- 依赖管理
- 优先级调度

### 3. 上下文管理 (context/)

#### Message.ts

**消息结构**
- `Message`: 完整消息定义
- `MessageSender`: 发送者信息
- `MessageContent`: 消息内容
- `Attachment`: 附件信息
- `ToolCall`: 工具调用信息
- `ToolResponse`: 工具响应

**枚举**
- `MessageType`: 消息类型 (USER_MESSAGE, ASSISTANT_MESSAGE, SYSTEM_MESSAGE, TOOL_CALL, TOOL_RESPONSE, ERROR_MESSAGE, STATUS_UPDATE)
- `MessageStatus`: 状态 (SENDING, SENT, DELIVERED, READ, FAILED)
- `MessageFlag`: 标记 (FLAGGED, STARRED, DELETED, ARCHIVED, PRIVATE)
- `ContentFormat`: 内容格式 (PLAIN_TEXT, MARKDOWN, HTML, JSON, CODE)
- `AttachmentType`: 附件类型 (IMAGE, VIDEO, AUDIO, DOCUMENT, CODE_FILE, OTHER)

**工厂函数**
- `createMessage()`: 创建消息
- `createUserMessage()`: 创建用户消息
- `createAssistantMessage()`: 创建助手消息
- `createToolCallMessage()`: 创建工具调用消息
- `createToolResponseMessage()`: 创建工具响应消息
- `createSystemMessage()`: 创建系统消息
- `createErrorMessage()`: 创建错误消息
- `isValidMessage()`: 验证消息

#### ContextManager.ts

**上下文结构**
- `ConversationContext`: 完整上下文定义
- `Participant`: 参与者信息
- `ContextMetadata`: 元数据
- `StateItem`: 状态条目
- `StateChange`: 状态变更记录

**枚举**
- `ContextStatus`: 状态 (INITIALIZING, ACTIVE, IDLE, ARCHIVED, DELETED)
- `ContextItemType`: 条目类型 (MESSAGE, STATE, TOOL_CALL, RESULT, ATTACHMENT, CUSTOM)
- `StateType`: 状态类型 (SESSION, PERSISTENT, TEMPORARY)

**上下文操作**
- `create(sessionId, participants)`: 创建上下文
- `get(contextId)`: 获取上下文
- `delete(contextId)`: 删除上下文
- `archive(contextId)`: 归档上下文
- `restore(contextId)`: 恢复上下文

**消息管理**
- `addMessage(contextId, message)`: 添加消息
- `addUserMessage()`: 添加用户消息
- `addAssistantMessage()`: 添加助手消息
- `getMessages(options?)`: 获取消息列表
- `getRecentMessages(count)`: 获取最近消息

**状态管理**
- `setState(key, value, options?)`: 设置状态
- `getState(key, namespace?)`: 获取状态
- `deleteState(key, namespace?)`: 删除状态
- `getStates(namespace?)`: 获取命名空间下所有状态
- `clearStates(namespace?)`: 清空命名空间

**订阅机制**
- `subscribe(keys, callback, namespace?)`: 订阅状态变更

**统计与清理**
- `getStats(contextId)`: 获取统计信息
- `cleanup()`: 清理过期上下文

---

## 执行步骤

1. [x] 创建目录结构 (core/, scheduler/, context/)
2. [x] 实现 Agent 核心
   - [x] AgentConfig.ts
   - [x] AgentState.ts
   - [x] Agent.ts
   - [x] index.ts
3. [x] 实现调度器
   - [x] TaskQueue.ts
   - [x] TaskScheduler.ts
   - [x] index.ts
4. [x] 实现上下文管理
   - [x] Message.ts
   - [x] ContextManager.ts
   - [x] index.ts
5. [x] 更新 src/index.ts 主入口
6. [x] 创建任务完成文档

---

## 验证方式

```bash
# 类型检查
cd packages/agent && pnpm typecheck

# 构建模块
cd packages/agent && pnpm build
```

---

## 相关文档

- DOC-001: feature-001-agent-architecture.md
- DOC-008: feature-008-context-management.md
- 前置任务: task-P0-101-utils-module.md (@organic/utils), task-P0-102-kernel-core.md (@organic/kernel)

---

## 依赖关系

- 被依赖: (后续模块)
- 依赖: @organic/utils, @organic/kernel, @organic/plugins, @organic/tools

---

## 验收条件

| 验收项 | 验收标准 | 状态 |
|--------|----------|------|
| Agent 主类 | 实现 initialize/shutdown/execute/registerTaskHandler | 通过 |
| Agent 状态管理 | 实现状态转换、心跳监控、负载更新 | 通过 |
| Agent 配置 | 支持自定义配置项和默认值 | 通过 |
| 子 Agent 管理 | 支持注册、注销、获取子 Agent | 通过 |
| 任务队列 | 实现优先级调度、依赖管理、出入队操作 | 通过 |
| 任务调度器 | 支持自动/手动处理、并发控制、失败重试 | 通过 |
| 消息结构 | 实现完整消息定义、多种消息类型、工具调用 | 通过 |
| 上下文管理器 | 实现上下文创建、消息管理、状态管理 | 通过 |
| 状态订阅 | 支持订阅状态变更并提供取消订阅 | 通过 |
| 模块导出 | src/index.ts 正确导出所有公开接口 | 通过 |
| TypeScript 类型安全 | 所有代码使用 @organic/utils 类型定义 | 通过 |
| 层级嵌套支持 | Agent 支持最大 3 层嵌套调用 | 通过 |
| 并行任务支持 | 支持最多 10 个并行任务 | 通过 |
| 通信超时控制 | 默认 5000ms 超时配置 | 通过 |
