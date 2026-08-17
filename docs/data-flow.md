# Organic-Interface 数据流设计文档

> 本文档基于 `@organic` 各包的实际代码实现，详细描述了系统内各组件之间的数据流动路径、状态转换和交互协议。

---

## 目录

1. [概述](#1-概述)
2. [用户请求流](#2-用户请求流)
3. [插件生命周期流](#3-插件生命周期流)
4. [事件总线流](#4-事件总线流)
5. [工具执行流](#5-工具执行流)
6. [上下文管理流](#6-上下文管理流)
7. [工作流执行流](#7-工作流执行流)
8. [存储持久化流](#8-存储持久化流)
9. [Agent 通信流](#9-agent-通信流)
10. [编排流](#10-编排流)
11. [TUI 渲染流](#11-tui-渲染流)
12. [错误传播流](#12-错误传播流)
13. [配置加载流](#13-配置加载流)

---

## 1. 概述

### 1.1 系统架构总览

Organic-Interface 是一个基于 monorepo 架构的 AI 工作台系统，由 7 个内聚的包组成，按依赖层级分为 4 层：

```
┌─────────────────────────────────────────────────────────────────┐
│  Level 4: @organic/ui                                           │
│  CLI, Terminal, Screen, Theme, Output, Spinner, Banner, Box,     │
│  Prompt, Progress, Table, MouseHandler, UIOperationManager,      │
│  Sandbox, UIAgent                                                │
├─────────────────────────────────────────────────────────────────┤
│  Level 3: @organic/agent                                        │
│  Agent, TaskQueue, TaskScheduler, ContextManager,                │
│  ContextWindowManager, ContextService, WorkflowEngine,           │
│  WorkflowExecutor, OrchestrationLayer, ExecutionCoordinator,     │
│  AgentRegistry, AgentChannel, MessageQueue                       │
├──────────────────────┬──────────────────────────────────────────┤
│  Level 2:            │  Level 2:                                │
│  @organic/plugins    │  @organic/tools                          │
│  PluginInterface,    │  ToolService, ToolExecutor,              │
│  PluginLoader,       │  SecurityGuard, ApprovalService,         │
│  PluginRegistry,     │  FileTool, ShellTool, SearchTool         │
│  BasePlugin,         ├──────────────────────────────────────────┤
│  CoreConversation    │  Level 2: @organic/storage               │
│  Plugin              │  StorageService, StorageManager,         │
│                      │  SessionPersistenceStorage,               │
│                      │  MemoryStorage, FileStorage,              │
│                      │  DatabaseStorage                          │
├──────────────────────┴──────────────────────────────────────────┤
│  Level 1: @organic/kernel                                       │
│  Kernel, EventBus, LifecycleManager, PluginManager,              │
│  TextService, InfoService                                        │
├─────────────────────────────────────────────────────────────────┤
│  Level 0: @organic/utils                                        │
│  Types (Config, Plugin, Tool, Result), Errors (BaseError,       │
│  ValidationError, NotFoundError), Logger, Async, Validation      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 各包职责

| 包名               | 层级    | 职责                                                                                                                                                                                                                                                                            |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@organic/utils`   | Level 0 | 共享类型定义、错误基类、日志工具、验证工具、异步工具                                                                                                                                                                                                                            |
| `@organic/kernel`  | Level 1 | 核心运行时：Kernel 生命周期、EventBus 事件系统、PluginManager 插件管理、TextService 和 InfoService 基础服务                                                                                                                                                                     |
| `@organic/plugins` | Level 2 | 插件系统：PluginInterface 接口定义、PluginLoader 加载器、PluginRegistry 注册表、BasePlugin 基类、CoreConversationPlugin 核心对话插件                                                                                                                                            |
| `@organic/tools`   | Level 2 | 工具系统：ToolService 工具注册执行、ToolExecutor 执行器、SecurityGuard 安全守卫、ApprovalService 审批服务、FileTool/ShellTool/SearchTool 内置工具                                                                                                                               |
| `@organic/storage` | Level 2 | 存储系统：StorageService CRUD 服务、StorageManager 后端管理、MemoryStorage/FileStorage/DatabaseStorage 三种后端、SessionPersistenceStorage 会话持久化                                                                                                                           |
| `@organic/agent`   | Level 3 | Agent 系统：Agent 核心执行体、TaskQueue/TaskScheduler 任务调度、ContextManager/ContextWindowManager/ContextService 上下文管理、WorkflowEngine/WorkflowExecutor 工作流引擎、OrchestrationLayer/ExecutionCoordinator 编排层、AgentRegistry/AgentChannel/MessageQueue 通信基础设施 |
| `@organic/ui`      | Level 4 | 用户界面：CLI 命令行接口、Terminal 终端能力检测、Screen 屏幕缓冲管理、Theme 主题系统、Output/Spinner/Banner/Box 终端组件、Prompt/Progress/Table 交互组件、MouseHandler 鼠标事件、UIOperationManager/UIAgent/Sandbox UI 操作体系                                                 |

### 1.3 核心数据流图

```
                        ┌──────────────┐
                        │  User Input  │
                        └──────┬───────┘
                               │
                    ┌──────────▼──────────┐
                    │   @organic/ui       │
                    │   CLI.parse()       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   @organic/agent    │
                    │   OrchestrationLayer│
                    │   ExecutionCoord.   │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
┌─────────▼─────────┐ ┌───────▼───────┐ ┌─────────▼─────────┐
│  @organic/kernel  │ │ @organic/     │ │  @organic/        │
│  Kernel.run()     │ │ plugins       │ │  tools            │
│  EventBus.emit()  │ │ CorePlugin    │ │  ToolService      │
│  PluginManager    │ │ SessionMgr    │ │  SecurityGuard    │
└─────────┬─────────┘ └───────┬───────┘ └─────────┬─────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  @organic/storage   │
                    │  StorageService     │
                    │  Memory/File/DB     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   @organic/ui       │
                    │   Output/Screen     │
                    └─────────────────────┘
```

---

## 2. 用户请求流

### 2.1 完整流程

用户输入的命令行文本经过解析、路由、编排和执行，最终返回结果。

```
User Input (string)
    │
    ▼
┌──────────────────────────────────────┐
│ CLI.run(args: string[])              │
│   ├─ 检查 --help / --version         │
│   ├─ parser.parse(input)             │
│   │   └─ CommandParser.parse()       │
│   │       ├─ 词法分析: 分割命令/参数/选项 │
│   │       └─ 返回 { command, args,    │
│   │                 options, raw }     │
│   └─ executeCommand(parsed)          │
│       ├─ 查找 rootCommand.subcommands │
│       ├─ 检查子命令 (递归)             │
│       └─ command.handler(args, logger) │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ OrchestrationLayer.orchestrate()     │
│   ├─ 检查并发限制                      │
│   ├─ autoDecompose? → decomposeTask() │
│   │   └─ 将 payload.subTasks 拆分为   │
│   │       多个 OrchestrationRequest   │
│   ├─ 策略选择:                         │
│   │   ├─ SEQUENTIAL → executeSequential│
│   │   ├─ PARALLEL   → executeParallel │
│   │   └─ AUTO       → createPlan +    │
│   │                     executeWithPlan│
│   └─ aggregateResults()               │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ ExecutionCoordinator.execute()       │
│   ├─ registry.selectAgent(capability) │
│   ├─ getOrCreateChannel(agentId)     │
│   ├─ createExecuteMessage()          │
│   ├─ channel.sendAndWait()           │
│   │   ├─ pendingRequests.set()       │
│   │   ├─ setTimeout (超时控制)        │
│   │   └─ 等待响应或超时               │
│   └─ 重试: exponential backoff       │
│       (baseDelay * 2^(attempt-1))     │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ Agent.execute(input)                 │
│   ├─ createExecutionContext()        │
│   ├─ handler(payload, context)       │
│   │   └─ 调用 ToolService / Kernel   │
│   ├─ executeWithTimeout()            │
│   └─ 返回 AgentResult<T>             │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ Result Return                        │
│   OrchestrationResult {              │
│     success, data, error, duration,  │
│     stepResults[], agentId           │
│   }                                  │
│       │                              │
│       ▼                              │
│   CLI output (console.log / theme)   │
└──────────────────────────────────────┘
```

### 2.2 CLI 命令解析流程

```
Input: "agent run --timeout 5000 task_name"
       │
       ▼
CommandParser.parse(input)
    │
    ├─ 词法分割: ["agent", "run", "--timeout", "5000", "task_name"]
    │
    ├─ 识别命令: command = "agent"
    ├─ 识别子命令: raw = ["run", "task_name"]
    ├─ 识别选项: options = { timeout: 5000 }
    │
    └─ 返回:
        {
          success: true,
          parsed: {
            command: "agent",
            args: {},
            options: { timeout: 5000 },
            raw: ["run", "task_name"]
          }
        }
```

### 2.3 交互模式 (REPL) 流程

```
CLI.startInteractive()
    │
    ├─ new Screen(terminal)           ← 创建屏幕管理器
    ├─ screen.enterAltScreen()        ← 进入备用屏幕缓冲
    ├─ screen.hideCursor()            ← 隐藏光标
    ├─ screen.setupCleanup()          ← 注册 SIGINT/SIGTERM 清理
    ├─ readline.createInterface()     ← 创建 REPL 接口
    │
    └─ rl.on('line', async (line) =>  ← 事件循环
        ├─ "exit"/"quit" → rl.close()
        ├─ "clear"/"cls" → screen.clear()
        └─ others       → CLI.run(args)
            └─ 输出结果 (theme colors)
                      │
                      ▼
        rl.on('close') → screen.restore() → process.exit(0)
```

---

## 3. 插件生命周期流

### 3.1 插件加载和初始化

```
┌────────────────────────────────────────────────────────────────┐
│ Phase 1: 发现 (Discovery)                                       │
│                                                                │
│ PluginLoader.discover(sourcePath)                              │
│   ├─ 扫描指定路径下的插件包                                      │
│   ├─ 读取 package.json 中的 @organic 元数据                     │
│   ├─ 验证插件兼容性 (版本、API 版本)                              │
│   └─ 返回 PluginDiscoveryResult {                                │
│         plugins: PluginInterface[],                             │
│         errors: CompatibilityIssue[]                            │
│       }                                                         │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│ Phase 2: 注册 (Registration)                                    │
│                                                                │
│ PluginRegistry.register(plugin)                                │
│   ├─ 检查是否已注册 (name 唯一性)                                │
│   ├─ 存储 PluginInfo { name, version, description, ... }       │
│   ├─ 触发 'plugin:registered' 事件                              │
│   └─ 返回注册结果                                               │
│                                                                │
│ PluginManager.register(plugin, options)                        │
│   ├─ 检查重复注册 (plugins.has(plugin.name))                    │
│   ├─ 创建 PluginMetadata {                                      │
│   │     plugin, config, registeredAt,                          │
│   │     executionCount: 0, enabled: autoEnable                  │
│   │   }                                                         │
│   ├─ 存储到 plugins Map                                         │
│   ├─ eventBus.emit('plugin:register', { name, version })       │
│   └─ 注册完成                                                   │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│ Phase 3: 初始化 (Initialization) - Kernel.start() 触发          │
│                                                                │
│ PluginManager.initialize(name)                                 │
│   ├─ 检查 enabled 状态                                          │
│   ├─ 构建 PluginContext { kernel: KernelApi, config }           │
│   ├─ plugin.initialize(context)                                │
│   │   └─ 返回 InitializeResult { success, error? }             │
│   ├─ 成功: logger.info("initialized")                           │
│   └─ 失败: eventBus.emit('plugin:error', { name, error })      │
│            throw error                                          │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│ Phase 4: 活跃 (Active)                                          │
│                                                                │
│ PluginManager.execute(name, input)                             │
│   ├─ 检查注册状态和 enabled 状态                                 │
│   ├─ plugin.execute(input)                                     │
│   │   └─ 返回 PluginOutput { success, data?, error? }          │
│   ├─ 更新统计: lastExecutedAt, executionCount++                 │
│   └─ 返回结果                                                   │
│                                                                │
│ PluginManager.enable(name) / disable(name)                     │
│   └─ metadata.enabled = true/false                             │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│ Phase 5: 关闭 (Shutdown) - Kernel.stop() 触发                   │
│                                                                │
│ PluginManager.shutdownAll()                                    │
│   ├─ Promise.allSettled( shutdownPromises )                    │
│   ├─ 每个插件: plugin.shutdown()                                │
│   ├─ plugins.clear()                                           │
│   └─ 完成                                                       │
│                                                                │
│ PluginManager.unregister(name)                                 │
│   ├─ plugin.shutdown()                                         │
│   ├─ plugins.delete(name)                                      │
│   └─ eventBus.emit('plugin:unregister', { name })              │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 插件状态转换

```
         ┌──────────┐
         │  CREATED │ (PluginLoader 发现)
         └────┬─────┘
              │ register()
              ▼
         ┌──────────┐
         │REGISTERED│ (PluginManager 注册)
         └────┬─────┘
              │ initialize()
              ▼
         ┌──────────┐
    ┌────│  ACTIVE  │────┐
    │    └────┬─────┘    │
    │         │           │
    │  enable()│disable() │
    │         │           │
    │    ┌────▼─────┐    │
    │    │ DISABLED │    │
    │    └──────────┘    │
    │                    │
    │    shutdown()      │ unregister()
    │         │          │
    │         ▼          │
    │    ┌──────────┐    │
    └───►│ SHUTDOWN │◄───┘
         └──────────┘
```

### 3.3 CoreConversationPlugin 初始化流程

```
CoreConversationPlugin.initialize(context)
    │
    ├─ SessionManager 创建会话管理
    │   ├─ 维护会话状态 (active, idle, archived)
    │   ├─ 管理会话元数据
    │   └─ 会话生命周期控制
    │
    ├─ ContextManager 创建上下文管理
    │   ├─ 管理对话上下文窗口
    │   ├─ 消息历史存储和检索
    │   └─ 上下文状态管理
    │
    ├─ InputParser 创建输入解析器
    │   ├─ 解析用户输入为 ParsedInput
    │   ├─ 提取意图、实体、参数
    │   └─ 输入验证
    │
    ├─ OutputFormatter 创建输出格式化器
    │   ├─ 格式化 Agent 响应为 FormattedOutput
    │   ├─ 支持多种输出格式
    │   └─ 输出美化
    │
    └─ 返回 InitializeResult { success: true }
```

---

## 4. 事件总线流

### 4.1 EventBus 核心机制

```
┌─────────────────────────────────────────────────────────────────┐
│ EventBus 事件分发机制                                            │
│                                                                 │
│ 订阅:                                                           │
│   eventBus.on(type, listener) → EventSubscription               │
│   eventBus.once(type, listener) → EventSubscription             │
│   eventBus.onWildcard(pattern, listener) → EventSubscription    │
│                                                                 │
│ 通配符匹配规则:                                                   │
│   "plugin:*"  → 匹配 "plugin:register", "plugin:error" 等       │
│   "*:error"   → 匹配 "plugin:error", "tool:error" 等            │
│   "a*b"       → 正则匹配                                         │
│                                                                 │
│ 分发:                                                           │
│   eventBus.emit(type, data, source?)                            │
│   ├─ 构建 KernelEvent { type, data, timestamp, source }         │
│   ├─ async: true  → setImmediate(() => 分发)                    │
│   ├─ async: false → 同步分发                                     │
│   ├─ 精确匹配: listeners.get(type) → 逐个调用                    │
│   ├─ 通配符匹配: wildcardListeners.forEach() → 匹配模式          │
│   └─ 每个 listener 错误被 try/catch 捕获，不会中断其他订阅者       │
│                                                                 │
│ 取消订阅:                                                        │
│   subscription.unsubscribe() → eventBus.off(type, listener)     │
│   eventBus.removeAllListeners(type?) → 清除所有/指定类型          │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 事件类别和流向

```
┌────────────────────────────────────────────────────────────────┐
│ Kernel Events (kernel:* 命名空间)                                │
│                                                                 │
│ kernel:init                                                      │
│   Kernel.initialize() ──emit──► 订阅者 (插件初始化、日志记录)     │
│   data: { name, version }                                       │
│                                                                 │
│ kernel:start                                                     │
│   Kernel.start() ──emit──► 订阅者 (启动后处理)                   │
│   data: { name, version }                                       │
│                                                                 │
│ kernel:stop                                                      │
│   Kernel.stop() ──emit──► 订阅者 (清理资源)                      │
│   data: { name }                                                │
│                                                                 │
│ config:update                                                    │
│   Kernel.updateConfig() ──emit──► 订阅者 (配置变更响应)           │
│   data: { oldConfig, newConfig }                                │
├────────────────────────────────────────────────────────────────┤
│ Plugin Events (plugin:* 命名空间)                                 │
│                                                                 │
│ plugin:register                                                  │
│   PluginManager.register() ──emit──► EventBus 订阅者             │
│   data: { name, version, description }                          │
│                                                                 │
│ plugin:unregister                                                │
│   PluginManager.unregister() ──emit──► EventBus 订阅者           │
│   data: { name }                                                │
│                                                                 │
│ plugin:error                                                     │
│   PluginManager.init/exec 失败 ──emit──► EventBus 订阅者         │
│   data: { name, error }                                         │
├────────────────────────────────────────────────────────────────┤
│ Agent Events (agent:* 命名空间)                                   │
│                                                                 │
│ task:start / task:complete / task:error                         │
│   Agent.execute() ──emit──► 订阅者 (任务监控)                    │
│                                                                 │
│ status:change                                                    │
│   Agent.setStatus() ──emit──► 订阅者 (状态跟踪)                  │
│   data: { oldStatus, newStatus }                                │
│                                                                 │
│ heartbeat                                                        │
│   Agent.startHeartbeat() ──emit──► 订阅者 (健康检查)             │
│   data: { timestamp, load }                                     │
│                                                                 │
│ child:register / child:unregister                               │
│   Agent.registerChildAgent() ──emit──► 订阅者                    │
├────────────────────────────────────────────────────────────────┤
│ Tool Events (tool:* / execution:*)                               │
│                                                                 │
│ tool:registered / tool:unregistered                             │
│   ToolService.registerTool() ──emit──► 订阅者                    │
│                                                                 │
│ tool:enabled / tool:disabled                                    │
│   ToolService.enableTool() ──emit──► 订阅者                      │
│                                                                 │
│ execution:start / execution:complete / execution:error           │
│   ToolService.execute() ──emit──► 订阅者 (执行监控)              │
│                                                                 │
│ execution:queued / execution:started / execution:completed       │
│ execution:failed / execution:cancelled                           │
│   ToolExecutor ──emit──► 订阅者 (队列管理)                        │
├────────────────────────────────────────────────────────────────┤
│ Security Events                                                  │
│                                                                 │
│ preset:changed                                                   │
│   SecurityGuard.switchPreset() ──emit──► 订阅者                  │
│   data: [newPreset, oldPreset]                                  │
│                                                                 │
│ operation:blocked / operation:allowed                            │
│   SecurityGuard.checkOperation() ──emit──► 订阅者                │
│                                                                 │
│ approval:requested / approval:approved / approval:denied         │
│ approval:timeout                                                 │
│   ApprovalService.requestApproval() ──emit──► 订阅者 (UI 处理)   │
├────────────────────────────────────────────────────────────────┤
│ UI Events                                                        │
│                                                                 │
│ window:created / window:slid / window:optimized                  │
│   ContextWindowManager ──emit──► 订阅者                          │
│                                                                 │
│ context:created / context:deleted                                │
│   ContextService ──emit──► 订阅者                                │
│                                                                 │
│ item:added / item:updated / item:deleted                         │
│   ContextService ──emit──► 订阅者                                │
│                                                                 │
│ frame:pushed / frame:popped                                      │
│   ContextService ──emit──► 订阅者 (执行栈监控)                    │
│                                                                 │
│ workflow:registered / execution:started / execution:completed    │
│ execution:paused / execution:resumed / execution:failed          │
│   WorkflowEngine ──emit──► 订阅者 (工作流监控)                    │
│                                                                 │
│ orchestration:start / orchestration:step-start                   │
│ orchestration:step-complete / orchestration:complete             │
│ orchestration:failed / orchestration:paused                      │
│   OrchestrationLayer ──emit──► 订阅者 (编排监控)                  │
│                                                                 │
│ message:sent / message:enqueued / message:dequeued               │
│ message:dead-letter / queue:full / queue:empty                   │
│   AgentChannel / MessageQueue ──emit──► 订阅者                    │
└────────────────────────────────────────────────────────────────┘
```

### 4.3 事件传播路径

```
事件源 (Emitter)
    │
    ├─ 直接订阅者 (EventBus.on)
    │   └─ 同步或异步调用 (setImmediate)
    │
    ├─ 通配符订阅者 (EventBus.onWildcard)
    │   └─ 模式匹配后调用
    │
    └─ 事件转发 (Forwarding)
        ├─ ContextService 转发 ContextManager 的事件
        ├─ WorkflowEngine 转发 WorkflowExecutor 的事件
        └─ OrchestrationLayer 转发 ExecutionCoordinator 的事件
```

---

## 5. 工具执行流

### 5.1 完整执行路径

```
调用方: Agent.execute() / Kernel.executeTool() / Plugin.execute()
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ ToolService.execute(toolId, input, context, options)            │
│                                                                 │
│ Step 1: 查找工具                                                 │
│   ├─ tools.get(toolId) → ToolRegistryEntry                      │
│   ├─ 检查 enabled 状态                                           │
│   └─ 生成 executionId = `${toolId}_${counter}_${Date.now()}`    │
│                                                                 │
│ Step 2: 输入验证                                                 │
│   ├─ enableValidation? → tool.validate(input)                   │
│   └─ 失败: 返回 { success: false, validationErrors }             │
│                                                                 │
│ Step 3: 安全守卫 (如果有)                                        │
│   ├─ mapCategoryToPermission(toolId, input)                     │
│   │   ├─ category='file'  + op='read'  → 'read'                │
│   │   ├─ category='file'  + op='write' → 'write'               │
│   │   ├─ category='shell'             → 'execute'               │
│   │   ├─ category='search'            → 'read'                  │
│   │   └─ category='http'              → 'network'               │
│   │                                                             │
│   ├─ securityGuard.authorize(toolId, input, operation, meta)    │
│   │   ├─ checkOperation() → allowed?                            │
│   │   ├─ preset.requiresApproval? → ApprovalService             │
│   │   └─ 返回 ApprovalResponse { approved, reason }             │
│   │                                                             │
│   └─ 失败: 返回 { success: false, authResult }                   │
│                                                                 │
│ Step 4: 构建执行上下文                                           │
│   └─ ToolExecutionContext {                                     │
│        toolId, executionId, workingDirectory,                   │
│        environment, cancelled, permissionLevel, metadata        │
│      }                                                          │
│                                                                 │
│ Step 5: 执行 (带超时)                                            │
│   ├─ Promise.race([tool.execute(input, context), timeout])      │
│   ├─ 更新统计: ToolStats (totalExecutions, avgExecutionTime)    │
│   └─ 触发 'execution:complete' 或 'execution:error'             │
│                                                                 │
│ Step 6: 返回 ToolResult                                         │
│   └─ { success, data?, error?, executionTime, metadata? }       │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 安全预设体系

```
Security Preset 层级 (从低到高):

┌─────────────────────────────────────────────────────────────────┐
│ plan (L1)  - 只读模式                                            │
│   allowedOperations: ['read']                                   │
│   requiresApproval: true                                        │
│   描述: 可读文件、搜索代码、分析。不允许任何修改。                    │
├─────────────────────────────────────────────────────────────────┤
│ create (L2) - 读写模式                                           │
│   allowedOperations: ['read', 'write', 'filesystem']            │
│   requiresApproval: true                                        │
│   描述: 可读写文件、创建目录。不允许执行命令。                        │
├─────────────────────────────────────────────────────────────────┤
│ work (L3) - 读写执行模式                                          │
│   allowedOperations: ['read', 'write', 'execute',               │
│                       'filesystem', 'network']                  │
│   requiresApproval: true                                        │
│   描述: 完整工具访问，包括 Shell 命令。需要审批。                     │
├─────────────────────────────────────────────────────────────────┤
│ yolo (L4) - 无限制模式                                           │
│   allowedOperations: ['read', 'write', 'execute',               │
│                       'filesystem', 'network']                  │
│   requiresApproval: false                                       │
│   描述: 完全访问，无需审批。                                        │
└─────────────────────────────────────────────────────────────────┘

预设切换规则:
  - 升级 (plan→create→work→yolo): 需要 allowEscalation=true
  - 降级 (yolo→work→create→plan): 始终允许

getPresetIndex(): plan=0, create=1, work=2, yolo=3
```

### 5.3 审批流程

```
SecurityGuard.authorize()
    │
    ├─ checkOperation() → allowed?
    │   ├─ YES → 继续
    │   └─ NO  → 返回 { approved: false, reason }
    │
    ├─ preset.requiresApproval?
    │   ├─ NO (yolo) → 返回 { approved: true, "Auto-approved" }
    │   └─ YES → ApprovalService.requestApproval()
    │
    └─ ApprovalService.requestApproval()
        │
        ├─ 创建 ApprovalRequest { id, toolId, input, preset, operation }
        │
        ├─ 检查监听器:
        │   ├─ 无监听器 & autoApproveOnNoListeners → auto-approve
        │   ├─ 无监听器 → deny "No approval handler registered"
        │   └─ 有监听器 → 继续
        │
        ├─ 设置超时 (defaultTimeout: 60000ms)
        │   └─ 超时 → deny "Approval timed out"
        │
        ├─ emit('approval:requested', request)
        │   └─ UI 层监听并展示给用户
        │
        └─ 等待用户响应:
            ├─ approve(requestId, reason) → { approved: true }
            └─ deny(requestId, reason)    → { approved: false }
```

### 5.4 ToolExecutor 队列执行

```
ToolExecutor.execute(tool, input, context, options)
    │
    ├─ activeExecutions.size < maxConcurrent (5)?
    │   ├─ YES → executeDirect() 直接执行
    │   └─ NO  → 入队
    │       ├─ maxQueueSize (100) 检查
    │       ├─ 按 priority 插入队列
    │       └─ 返回 Promise, 等待队列处理
    │
    └─ processQueue() (每 100ms 轮询)
        └─ activeExecutions < maxConcurrent → shift() 并执行

executeDirect():
    │
    ├─ enableSandbox → applySandbox(context)
    │   ├─ 降级权限: L4 → L3
    │   └─ 过滤敏感环境变量 (API_KEY, SECRET, PASSWORD, TOKEN, PRIVATE_KEY)
    │
    ├─ enableCancellation & signal → 监听 abort 事件
    │
    ├─ Promise.race([tool.execute(), timeoutPromise])
    │
    └─ 返回 ToolResult
```

### 5.5 内置工具一览

```
┌───────────┬──────────────────────────────────────────────────────┐
│ FileTool  │ 文件操作: read, write, copy, move, delete,           │
│           │            exists, stat, list, mkdir                 │
│           │ category: 'file'                                     │
├───────────┼──────────────────────────────────────────────────────┤
│ ShellTool │ Shell 命令执行                                        │
│           │ category: 'shell'                                    │
├───────────┼──────────────────────────────────────────────────────┤
│ SearchTool│ 代码搜索: 文本搜索、正则搜索、文件搜索                    │
│           │ category: 'search'                                   │
└───────────┴──────────────────────────────────────────────────────┘
```

---

## 6. 上下文管理流

### 6.1 上下文生命周期

```
┌─────────────────────────────────────────────────────────────────┐
│ ContextService.createContext(sessionId, participants, metadata)  │
│                                                                 │
│ Step 1: ContextManager.create(sessionId, participants)          │
│   ├─ 生成 contextId = "ctx_" + timestamp + random               │
│   ├─ 创建 ConversationContext {                                  │
│   │     id, sessionId, participants, messages: [],              │
│   │     metadata: {}, createdAt, updatedAt,                     │
│   │     expiresAt: now + ttl (3600000ms),                       │
│   │     status: ContextStatus.ACTIVE                            │
│   │   }                                                          │
│   ├─ 初始化状态存储 initializeStateStore(contextId)              │
│   └─ contexts.set(contextId, context)                            │
│                                                                 │
│ Step 2: ContextService 初始化                                    │
│   ├─ contextItems.set(context.id, new Map())                    │
│   ├─ emit('context:created', context)                            │
│   └─ 返回 context                                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 消息添加                                                        │
│                                                                 │
│ ContextService.addMessage(contextId, message)                   │
│   ├─ ContextManager.addMessage(contextId, message)              │
│   │   ├─ context.messages.push(message)                         │
│   │   ├─ 滑动窗口: messages > maxWindowSize (100)               │
│   │   │   └─ messages = messages.slice(-maxWindowSize)          │
│   │   ├─ context.updatedAt = Date.now()                         │
│   │   └─ emit('message:added', { contextId, message })          │
│   │                                                             │
│   └─ ContextService.addContextItem(                             │
│         createMessageContextItem(contextId, message)             │
│       )                                                         │
│       └─ contextItems Map 存储                                   │
│                                                                 │
│ 便捷方法:                                                        │
│   addUserMessage(ctxId, userId, userName, text)                 │
│   addAssistantMessage(ctxId, agentId, agentName, text)          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 状态管理                                                        │
│                                                                 │
│ ContextService.setState(contextId, key, value, options)         │
│   ├─ ContextManager.setState()                                  │
│   │   ├─ 构建 fullKey = "${namespace}:${key}"                    │
│   │   ├─ 创建 StateItem { key, value, type, namespace, ... }    │
│   │   ├─ 存储到 states Map                                       │
│   │   ├─ 生成 StateChange { id, key, oldValue, newValue,        │
│   │   │                     changeType }                        │
│   │   ├─ notifySubscribers(change)                              │
│   │   └─ emit('state:changed', { contextId, change })           │
│   │                                                             │
│   └─ ContextService.addContextItem(                             │
│         createStateContextItem(contextId, key, value, options)   │
│       )                                                         │
│                                                                 │
│ StateType: session | persistent | temporary                     │
│ readonly: 不可删除的状态                                          │
└───────────────────────────┬─────────────────────────────────────┘
```

### 6.2 ContextWindowManager 窗口管理

```
┌─────────────────────────────────────────────────────────────────┐
│ ContextWindowManager.createWindow(contextId, allMessages, config)│
│                                                                 │
│ 窗口类型:                                                        │
│   RECENT_MESSAGES: 最近 N 条消息 (windowSize: 50)                │
│   RECENT_MINUTES:  最近 N 分钟 (timeWindowMinutes: 30)           │
│   TOKEN_BASED:     Token 限制 (maxTokens: 4096)                  │
│   SEMANTIC_BASED:  语义相似度窗口                                 │
│                                                                 │
│ 创建步骤:                                                        │
│   ├─ filterMessages(messages, config)                           │
│   │   ├─ includeSystemMessages? → 过滤 system_message           │
│   │   ├─ includeToolCalls? → 过滤 tool_call/tool_response       │
│   │   └─ RECENT_MINUTES → 过滤过期消息 (cutoffTime)             │
│   │                                                             │
│   ├─ createMessageSlice(filtered, 0, config)                    │
│   │   ├─ RECENT_MESSAGES  → slice(0, windowSize)                │
│   │   └─ TOKEN_BASED      → sliceByTokens()                     │
│   │                                                             │
│   ├─ estimateTokenCount(windowedMessages)                       │
│   │   └─ charsPerToken: 4, 每条消息 +5 overhead tokens           │
│   │                                                             │
│   └─ 返回 ContextWindow {                                       │
│        id, contextId, config, messages, items,                  │
│        tokenCount, startIndex, endIndex,                        │
│        hasPrevious, hasNext, createdAt                          │
│      }                                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 窗口滑动

```
滑动窗口机制:

forward:
  slideForward(windowId, allMessages)
    ├─ newStartIndex = endIndex + 1 - overlapSize (5)
    ├─ newEndIndex = min(newStartIndex + windowSize - 1, total - 1)
    ├─ 更新 messages, startIndex, endIndex, hasPrevious, hasNext
    └─ emit('window:slid', { direction: 'forward' })

backward:
  slideBackward(windowId, allMessages)
    ├─ newEndIndex = startIndex - 1 + overlapSize
    ├─ newStartIndex = max(0, newEndIndex - windowSize + 1)
    └─ 同上

优化:
  optimizeWindow(windowId)
    ├─ tokenCount > maxTokens?
    │   └─ trimToTokenLimit(): 从最新消息开始保留，直到 token 限制
    └─ emit('window:optimized')
```

### 6.4 上下文传播 (ContextService.propagateContext)

```
┌─────────────────────────────────────────────────────────────────┐
│ ContextService.propagateContext(sourceId, targetAgentId,        │
│                                 mode, scope)                    │
│                                                                 │
│ PropagationMode:                                                │
│                                                                 │
│   DIRECT:                                                       │
│     └─ 返回 { contextId: sourceContextId }                      │
│                                                                 │
│   REFERENCE:                                                    │
│     └─ 返回 { referenceId: sourceContextId }                    │
│                                                                 │
│   INCREMENTAL:                                                  │
│     └─ getIncrementalContext(sourceId, scope)                   │
│         ├─ includeMessages → 过滤时间范围/数量限制               │
│         ├─ includeStates   → 收集所有状态                        │
│         └─ includeToolCalls/Attachments → 收集 ContextItem      │
│                                                                 │
│   HYBRID:                                                       │
│     ├─ items.length < 10 → DIRECT                               │
│     └─ items.length >= 10 → INCREMENTAL                         │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 执行上下文栈

```
ContextService 执行帧管理:

pushExecutionFrame(contextId, agentId)
    │
    ├─ 获取或创建 ExecutionContextStack
    ├─ 检查 maxNestingDepth (5)
    ├─ 创建 ExecutionFrame {
    │     id, contextId, agentId,
    │     parentFrameId, childFrameIds: [],
    │     enterTime, status: 'running'
    │   }
    ├─ 更新父帧 childFrameIds
    ├─ stack.push(frame)
    └─ emit('frame:pushed', { contextId, frame })

popExecutionFrame(contextId, result?, error?)
    │
    ├─ stack.pop()
    ├─ 设置 exitTime, status: 'completed' | 'failed'
    ├─ 设置 result, error
    └─ emit('frame:popped')

执行栈结构:
  rootContextId
    └─ stack: [
         Frame-1 (agent-1, depth=0)
           └─ Frame-2 (agent-2, depth=1, parentFrameId=Frame-1)
               └─ Frame-3 (agent-3, depth=2, parentFrameId=Frame-2)
       ]
```

---

## 7. 工作流执行流

### 7.1 DAG 工作流模型

```
Workflow 结构:
  {
    id: string,
    name: string,
    nodes: Task[],          // DAG 节点列表
    edges: WorkflowEdge[],  // 有向边列表
    variables: WorkflowVariable[],
    config: WorkflowConfig
  }

Task 结构:
  {
    id: string,
    type: TaskType (SIMPLE | CONDITION | LOOP | PARALLEL),
    dependencies: TaskDependency[],
    config: { handler, timeout?, retryPolicy? },
    timeout?: { duration, onTimeout },
    condition?: ConditionExpression,
    loopConfig?: LoopConfig,
    parallelConfig?: ParallelConfig
  }

WorkflowEdge 结构:
  {
    id: string,
    sourceId: string,      // 源节点 ID
    targetId: string,      // 目标节点 ID
    condition?: EdgeCondition,
    type: EdgeConditionType
  }
```

### 7.2 完整执行流程

```
┌─────────────────────────────────────────────────────────────────┐
│ WorkflowEngine.startExecution(workflowId, input)                │
│                                                                 │
│ Step 1: 准备                                                    │
│   ├─ workflows.get(workflowId) → Workflow                       │
│   ├─ createWorkflowExecution(workflowId, input)                 │
│   ├─ getEntryNode(workflow) → 入口节点                           │
│   ├─ execution.currentNodeIds = [entryNode.id]                  │
│   └─ initializeNodeStates(executionId, workflow)                │
│       └─ 为每个节点创建 NodeExecutionState {                     │
│            task, execution,                                      │
│            status: 'pending',                                    │
│            dependenciesCompleted: dependencies.length === 0      │
│          }                                                       │
│                                                                 │
│ Step 2: 调度                                                    │
│   └─ scheduleNextNodes(executionId, workflow)                   │
│       ├─ getExecutableNodes()                                   │
│       │   ├─ 过滤 status === 'pending'                          │
│       │   ├─ 过滤 dependenciesCompleted === true                │
│       │   └─ 检查 maxParallelNodes (10)                         │
│       │                                                         │
│       ├─ 无可执行节点: checkWorkflowCompletion()                  │
│       └─ 有可执行节点: 逐个 executeNode()                         │
│                                                                 │
│ Step 3: 节点执行                                                 │
│   └─ executeNode(executionId, workflow, task, taskExecution)    │
│       ├─ updateNodeState → 'running'                            │
│       ├─ executor.executeTask(task, taskExecution, input, ctx)  │
│       │   ├─ 检查是否已在执行                                     │
│       │   ├─ updateTaskExecution → RUNNING                      │
│       │   ├─ 设置超时定时器                                       │
│       │   ├─ nodeExecutor(task, input, context)                 │
│       │   └─ 返回 TaskExecutionResult {                         │
│       │        success, output?, error?, duration                │
│       │      }                                                   │
│       │                                                         │
│       └─ processNodeResult()                                    │
│           ├─ 更新节点状态 (completed/failed)                      │
│           ├─ 更新执行上下文 (execution.context)                   │
│           ├─ updateDependencyStatus()                            │
│           │   └─ 检查下游节点依赖是否全部完成                       │
│           └─ scheduleNextNodes() 递归调度                        │
│                                                                 │
│ Step 4: 完成检查                                                 │
│   └─ checkWorkflowCompletion()                                  │
│       ├─ 所有节点状态 != pending/running?                        │
│       ├─ YES → 设置最终状态:                                      │
│       │   ├─ hasFailed → FAILED                                 │
│       │   └─ !hasFailed → COMPLETED                             │
│       ├─ collectResults() → 聚合所有节点输出                      │
│       └─ cleanupExecution()                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 执行路径类型

```
序列执行 (Serial):
  节点 A → 节点 B → 节点 C (依赖链)

  实现: sequential 策略
  ┌─────┐   ┌─────┐   ┌─────┐
  │  A  │──►│  B  │──►│  C  │
  └─────┘   └─────┘   └─────┘

  前一个节点的 output 会注入到下一个节点的 payload 中:
    B.payload.previousResult = A.result
    B.payload.previousSuccess = A.success

并行执行 (Parallel):
  节点 A ↗ 节点 B  (无依赖关系)
         ↘ 节点 C

  实现: parallel 策略
  ┌─────┐        ┌─────┐
  │  A  │──┐  ┌──│  B  │
  └─────┘  │  │  └─────┘
           ├──┤
  ┌─────┐  │  │  ┌─────┐
  │  C  │──┘  └──│  D  │
  └─────┘        └─────┘

  条件执行 (Conditional):
  节点 A → 条件检查 → 成功 → 节点 B
                   → 失败 → 节点 C

  ConditionExpression 评估后选择边

循环执行 (Loop):
  LoopConfig { maxIterations, condition, iterationVariable }

  节点 A → 节点 B → 条件检查 → 通过 → 节点 B (循环)
                            → 失败 → 节点 C
```

### 7.4 重试和快照

```
重试机制:
  WorkflowExecutor.shouldRetry(task, execution)
    ├─ autoRetry? → canTaskRetry(execution, task)
    │   ├─ retryCount < maxRetries?
    │   └─ 检查 retryPolicy.retryOn 条件
    │
    └─ scheduleRetry()
        ├─ calculateRetryInterval() → 指数退避
        ├─ 创建 retryExecution (retryCount + 1)
        └─ setTimeout → executeTask()

快照和恢复:
  enableRecovery → startSnapshotTimer()
    └─ 每 30 秒对 RUNNING 状态的执行创建快照

  createSnapshot(executionId)
    └─ createWorkflowSnapshot(execution) → WorkflowExecutionSnapshot

  recoverFromSnapshot(snapshot)
    ├─ 恢复 execution 状态
    └─ resumeExecution()
```

### 7.5 工作流执行状态

```
WorkflowExecutionStatus:
  PENDING → RUNNING → COMPLETED
                     → FAILED
                     → PAUSED → RUNNING (resume)
                     → CANCELLED

TaskStatus:
  PENDING → RUNNING → COMPLETED
                     → FAILED → RETRYING → RUNNING → ...
                     → TIMEOUT
                     → CANCELLED
```

---

## 8. 存储持久化流

### 8.1 存储架构

```
┌─────────────────────────────────────────────────────────────────┐
│ StorageManager (后端管理器)                                      │
│   ├─ backends: Map<string, BackendEntry>                        │
│   │   └─ BackendEntry { backend: IStorageBackend, service, type }│
│   │                                                             │
│   ├─ createStorage(name, type) → StorageService                 │
│   │   ├─ createBackend(type)                                    │
│   │   │   ├─ MEMORY    → new MemoryStorage(config)              │
│   │   │   ├─ FILE      → new FileStorage(config)  (需 basePath) │
│   │   │   └─ DATABASE  → new DatabaseStorage(config) (需 dbPath)│
│   │   ├─ new StorageService(backend)                            │
│   │   └─ backend.initialize()                                   │
│   │                                                             │
│   └─ getStorage(name?) → StorageService                         │
│       └─ 默认返回 'default' 存储                                  │
│                                                                 │
│ 静态工厂方法:                                                     │
│   StorageManager.createMemoryStorage(config) → StorageService   │
│   StorageManager.createFileStorage(config)   → StorageService   │
│   StorageManager.createDatabaseStorage(config) → StorageService │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 CRUD 操作流

```
┌─────────────────────────────────────────────────────────────────┐
│ StorageService                                                  │
│                                                                 │
│ create(type, data, options?)                                    │
│   ├─ 检查 ID 重复                                                │
│   ├─ createStorageEntity(type, data, options)                   │
│   │   └─ StorageEntity { id, type, data, metadata,              │
│   │        created_at, updated_at, version }                    │
│   ├─ 检查唯一索引 (checkUniqueIndex)                              │
│   ├─ backend.set(entity.toObject())                             │
│   └─ 返回 CreateResult { success, entity?, error? }             │
│                                                                 │
│ read(id)                                                        │
│   └─ backend.get(id) → StorageEntity | null                     │
│                                                                 │
│ update(id, data, updatedBy?)                                    │
│   ├─ backend.get(id) → entity                                   │
│   ├─ StorageEntityImpl.updateData(data, updatedBy)              │
│   │   └─ version++ (乐观锁)                                      │
│   ├─ backend.set(entity.toObject())                             │
│   └─ 返回 UpdateResult { success, entity?, error?, version }    │
│                                                                 │
│ delete(id)                                                      │
│   ├─ backend.delete(id) → boolean                               │
│   └─ 返回 DeleteResult { success, error? }                      │
│                                                                 │
│ query(filter)                                                   │
│   ├─ 构建 backendFilter (where, createdAfter, updatedAfter...)  │
│   ├─ backend.query(backendFilter) → entities[]                  │
│   ├─ 应用 OR 条件 (orWhere)                                      │
│   ├─ applyOrderBy() → 排序                                      │
│   ├─ 分页: offset + limit                                       │
│   ├─ 字段过滤: include / exclude                                 │
│   └─ 返回 QueryResult { success, entities, total, error? }      │
│                                                                 │
│ findByType(type) → backend.getByType(type)                      │
│ findByTags(tags) → query({ where: { tags } })                   │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 事务流

```
┌─────────────────────────────────────────────────────────────────┐
│ StorageService 事务                                              │
│                                                                 │
│ beginTransaction(options?)                                      │
│   ├─ 检查是否已有活跃事务                                         │
│   ├─ 创建 Transaction { id, startTime, isolation, status }      │
│   ├─ currentTransaction = transaction                           │
│   ├─ 设置超时: setTimeout → rollbackTransaction()               │
│   └─ 返回 Transaction                                           │
│                                                                 │
│ [执行 CRUD 操作...]                                              │
│                                                                 │
│ commitTransaction()                                             │
│   ├─ 检查 currentTransaction 存在                               │
│   ├─ 清除超时定时器                                               │
│   ├─ transaction.status = COMMITTED                             │
│   └─ currentTransaction = null                                  │
│                                                                 │
│ rollbackTransaction()                                           │
│   ├─ 检查 currentTransaction 存在                               │
│   ├─ 清除超时定时器                                               │
│   ├─ transaction.status = ROLLED_BACK                           │
│   └─ currentTransaction = null                                  │
│                                                                 │
│ IsolationLevel:                                                  │
│   READ_UNCOMMITTED | READ_COMMITTED | REPEATABLE_READ |         │
│   SERIALIZABLE (默认: READ_COMMITTED)                             │
│                                                                 │
│ TransactionStatus:                                               │
│   ACTIVE → COMMITTED | ROLLED_BACK | EXPIRED                    │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 三种后端对比

```
┌──────────────┬─────────────────┬────────────────┬────────────────┐
│ 特性         │ MemoryStorage   │ FileStorage    │ DatabaseStorage│
├──────────────┼─────────────────┼────────────────┼────────────────┤
│ 持久化        │ ❌ 内存中        │ ✅ JSON 文件    │ ✅ 数据库      │
│ 速度          │ ⚡ 极快          │ 🔶 中等         │ 🔶 中等        │
│ 容量          │ 受内存限制       │ 受磁盘限制       │ 受磁盘限制      │
│ 并发          │ 单进程           │ 文件锁           │ 事务支持        │
│ 查询          │ 简单过滤         │ 简单过滤         │ 结构化查询      │
│ 适用场景      │ 缓存/会话/临时   │ 配置/会话持久化 │ 生产数据        │
│ 配置要求      │ 无              │ basePath        │ dbPath         │
│ 索引          │ 支持            │ 支持            │ 支持           │
└──────────────┴─────────────────┴────────────────┴────────────────┘
```

### 8.5 SessionPersistenceStorage 会话持久化

```
SessionPersistenceStorage
    │
    ├─ saveSession(sessionId, persistence)
    │   └─ StorageService.create('session', data)
    │
    ├─ loadSession(sessionId)
    │   └─ StorageService.read(id)
    │
    ├─ saveContextWindow(sessionId, window)
    │   └─ StorageService.create('context_window', data)
    │
    ├─ loadContextWindow(windowId)
    │   └─ StorageService.read(id)
    │
    └─ SessionAdapter (适配器)
        └─ 将 Session 对象转换为可存储的 SessionPersistence 格式
```

---

## 9. Agent 通信流

### 9.1 通信架构

```
┌─────────────────────────────────────────────────────────────────┐
│ Agent A                             Agent B                     │
│                                     │                           │
│ ExecutionCoordinator ────send──────►│                           │
│   │                                 │                           │
│   ├─ getOrCreateChannel(agentB.id)  │                           │
│   │                                 │                           │
│   ├─ createExecuteMessage(          │                           │
│   │     source, target, payload,    │                           │
│   │     options)                    │                           │
│   │                                 │                           │
│   └─ channel.sendAndWait(message)──►│                           │
│       │                             │                           │
│       │   ┌─────────────────────────┘                           │
│       │   │                                                     │
│       │   ▼                                                     │
│       │ MessageQueue.enqueue(message)                           │
│       │   │                                                     │
│       │   ├─ 优先级排序插入                                       │
│       │   └─ emit('message:enqueued')                           │
│       │                                                         │
│       │ MessageQueue.dequeue()                                  │
│       │   │                                                     │
│       │   ├─ 检查过期 (isMessageExpired)                        │
│       │   │   └─ 过期 → 死信队列 (Dead Letter)                  │
│       │   └─ emit('message:dequeued')                           │
│       │                                                         │
│       │ AgentChannel.handleMessage(message)                     │
│       │   │                                                     │
│       │   ├─ 检查过期                                             │
│       │   ├─ addToHistory(message)                              │
│       │   ├─ 检查 pendingRequests (correlationId)              │
│       │   │   └─ 匹配 → handlePendingResponse                  │
│       │   │       ├─ SUCCESS → resolve(payload)                 │
│       │   │       └─ ERROR   → reject(error)                    │
│       │   │                                                     │
│       │   └─ 查找 handler (handlers.get(action))               │
│       │       ├─ 找到 → handler(message)                        │
│       │       │   └─ request_response? → send(response)         │
│       │       ├─ 通配符 '*' → wildcardHandler(message)          │
│       │       └─ 未找到 → throw error                           │
│       │                                                         │
│       └────── response ──────► pendingRequests.resolve()       │
│               (or timeout)                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 消息格式

```
AgentMessage:
  {
    id: string,              // 唯一消息 ID
    source: string,          // 发送方 Agent ID
    target: string,          // 接收方 Agent ID
    action: MessageAction,   // 消息动作
    payload: unknown,        // 消息载荷
    priority: 0 | 1 | 2,    // 优先级 (0=最高)
    timestamp: number,       // 创建时间
    expiresAt?: number,      // 过期时间
    deliveryMode:            // 投递模式
      'fire_and_forget' | 'request_response',
    metadata?: {
      correlationId?: string,   // 关联 ID
      replyTo?: string,         // 回复地址
      headers?: Record<string, string>,
      ttl?: number
    },
    error?: { code, message, details }
  }

MessageAction:
  EXECUTE_TASK | RESPONSE | ERROR | QUERY | NOTIFY | ...
```

### 9.3 通信模式

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 发送即忘 (Fire and Forget)                                   │
│                                                                 │
│   channel.send(message)                                         │
│     └─ 不等待响应，仅触发 'message:sent' 事件                     │
│                                                                 │
│ 2. 请求-响应 (Request-Response)                                  │
│                                                                 │
│   channel.sendAndWait(message, options)                         │
│     ├─ 创建 PendingRequest { resolve, reject, timeout }         │
│     ├─ 发送消息                                                   │
│     └─ 等待响应或超时 (defaultTimeout: 5000ms)                    │
│                                                                 │
│ 3. 发布-订阅 (Pub/Sub)                                          │
│                                                                 │
│   channel.subscribe(filter, handler) → subscriptionId           │
│   channel.publish(message)                                      │
│     └─ 遍历 subscriptions，匹配 filter 的调用 handler           │
│                                                                 │
│   SubscriptionFilter:                                           │
│     { action?, source?, target?, predicate? }                   │
│                                                                 │
│ 4. 带重试发送                                                    │
│                                                                 │
│   channel.sendWithRetry(message, options)                       │
│     └─ 指数退避重试 (maxRetries: 3, retryDelayBase: 100ms)      │
└─────────────────────────────────────────────────────────────────┘
```

### 9.4 MessageQueue 死信队列

```
过期消息处理:
  MessageQueue.dequeue()
    ├─ isMessageExpired → stats.expiredCount++
    └─ handleDeadLetter(message, 'EXPIRED')
        ├─ enableDeadLetter?
        │   ├─ YES → deadLetterQueue.push(message)
        │   │   └─ 添加元数据头: x-dead-letter-reason, x-dead-letter-at
        │   └─ NO  → 丢弃
        │
        └─ deadLetterQueue.size > deadLetterMaxSize (100)?
            └─ deadLetterQueue.shift() (FIFO)

死信恢复:
  retryDeadLetter(messageId)
    └─ 从死信队列移除 → 重新 enqueue()

定时处理:
  startProcessing(interval: 1000ms)
    └─ 每 1 秒清理过期消息 → 移入死信队列
```

---

## 10. 编排流

### 10.1 编排架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      OrchestrationLayer                         │
│                                                                 │
│ 请求入口:                                                        │
│   orchestrate(request: OrchestrationRequest)                    │
│     │                                                           │
│     ├─ 检查并发限制 (maxConcurrentOrchestrations: 10)           │
│     │                                                           │
│     ├─ autoDecompose & shouldDecompose?                         │
│     │   ├─ YES → decomposeTask(request)                         │
│     │   │   └─ payload.subTasks[] → OrchestrationRequest[]     │
│     │   └─ NO  → [request] (单任务)                             │
│     │                                                           │
│     ├─ 策略选择:                                                  │
│     │   ├─ SEQUENTIAL → coordinator.executeSequential()         │
│     │   ├─ PARALLEL   → coordinator.executeParallel()          │
│     │   └─ AUTO       → coordinator.createPlan()               │
│     │                     → coordinator.executeWithPlan()       │
│     │                                                           │
│     └─ aggregateResults() → OrchestrationResult                 │
│                                                                 │
│ 计划管理:                                                        │
│   createPlan(requests) → OrchestrationLayerPlan                 │
│   pause(planId) / resume(planId)                                │
│   cancel(requestId) / cancelAll()                               │
│                                                                 │
│ Agent 选择:                                                      │
│   selectAgent(capability?, strategy?)                           │
│     └─ registry.selectAgent(capability, { preferIdle: true })  │
│                                                                 │
│   getAvailableAgents(capability?)                               │
│     └─ registry.getAvailableAgents(capability)                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 ExecutionCoordinator 执行协调

```
┌─────────────────────────────────────────────────────────────────┐
│ ExecutionCoordinator.execute(request, signal?)                  │
│                                                                 │
│ Step 1: Agent 选择                                               │
│   ├─ targetAgentId? → registry.get(targetAgentId)              │
│   └─ 否则 → selectAgent(requiredCapability)                     │
│       └─ registry.selectAgent(capability, { preferIdle: true })│
│                                                                 │
│ Step 2: 通道建立                                                 │
│   └─ getOrCreateChannel(agent.id) → AgentChannel               │
│                                                                 │
│ Step 3: 执行 (带重试)                                            │
│   └─ for (attempts 1..maxAttempts)                             │
│       ├─ 检查 signal.aborted? → cancel                         │
│       ├─ createExecuteMessage(coordinator, agent.id, payload)  │
│       ├─ channel.sendAndWait(message, { timeout })             │
│       ├─ success → 返回 ExecutionResult { success, data }      │
│       └─ failure → exponential backoff + retry                 │
│           delay = min(baseDelay * 2^(attempt-1), maxDelay)     │
│                                                                 │
│ Step 4: 结果返回                                                 │
│   └─ ExecutionResult {                                          │
│        success, data?, error?, errorCode?,                     │
│        duration, agentId, attempts, metadata?                  │
│      }                                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 10.3 编排计划执行

```
ExecutionCoordinator.executeWithPlan(plan)
    │
    ├─ 创建 execution: { plan, stepResults, startTime, abortController }
    │
    └─ 遍历 plan.steps (按依赖顺序):
        │
        ├─ 检查 abortController.signal.aborted → break
        │
        ├─ 检查依赖: dependsOn 所有步骤是否 success?
        │   ├─ NO → step.status = 'skipped'
        │   └─ YES → 继续
        │
        ├─ emit('execution:step-start')
        ├─ step.status = 'running'
        │
        ├─ execute(step.request, abortController.signal)
        │   └─ 返回 ExecutionResult
        │
        ├─ step.result = result
        ├─ step.status = result.success ? 'completed' : 'failed'
        │
        ├─ success → emit('execution:step-complete')
        │   └─ 继续下一个 step
        │
        └─ failure → emit('execution:step-failed')
            └─ break (默认停止，除非 continueOnError)

并行组识别:
  identifyParallelGroups(steps)
    └─ 找出具有相同依赖集的步骤，归入同一并行组
```

### 10.4 编排策略

```
OrchestrationStrategy:
  ┌────────────┬─────────────────────────────────────────────────┐
  │ PARALLEL   │ 所有独立任务同时执行                              │
  │            │ coordinator.executeParallel(requests)           │
  │            │   └─ Promise.all(reqs.map(execute))             │
  ├────────────┼─────────────────────────────────────────────────┤
  │ SEQUENTIAL │ 按顺序执行，前一个结果注入下一个                   │
  │            │ coordinator.executeSequential(requests)         │
  │            │   └─ 循环: 注入 previousResult → execute()      │
  │            │   └─ 任何步骤失败则停止                           │
  ├────────────┼─────────────────────────────────────────────────┤
  │ AUTO       │ 系统根据依赖关系决定                              │
  │            │ createPlan() → executeWithPlan()                │
  │            │   └─ 依赖分析 → 拓扑排序 → 尽可能并行             │
  └────────────┴─────────────────────────────────────────────────┘
```

---

## 11. TUI 渲染流

### 11.1 终端能力检测

```
┌─────────────────────────────────────────────────────────────────┐
│ Terminal.init(config?)                                          │
│                                                                 │
│ 检测项目:                                                        │
│   ├─ isTTY: process.stdout.isTTY                               │
│   ├─ termType: $TERM                                           │
│   ├─ termProgram: $TERM_PROGRAM                                │
│   ├─ mouse:     支持鼠标事件的终端列表                            │
│   ├─ trueColor: COLORTERM='truecolor'/'24bit' 或 TERM_PROGRAM  │
│   ├─ colors256: TERM 包含 '256color' 或 iTerm                   │
│   ├─ unicode:   LANG/LC_ALL/LC_CTYPE 包含 'utf-8'              │
│   ├─ emoji:     unicode + 支持的终端 (iTerm, WezTerm, kitty...) │
│   ├─ alternateScreen: isTTY                                    │
│   ├─ bracketedPaste: isTTY                                     │
│   ├─ focusEvents: 特定终端 (iTerm, kitty, WezTerm, ghostty)    │
│   ├─ cursorControl: isTTY                                      │
│   ├─ resizeEvents: isTTY                                       │
│   ├─ colorDepth: truecolor → 256 → 16 → 8 → none              │
│   ├─ width:  process.stdout.columns || 80                      │
│   └─ height: process.stdout.rows || 24                         │
│                                                                 │
│ FeatureConfig: 每个功能可配置 'auto' | 'on' | 'off'              │
│   resolve(key, detectFn):                                       │
│     'on'  → true                                                │
│     'off' → false                                               │
│     'auto'→ detectFn()                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 屏幕缓冲管理

```
Screen 组件:
    │
    ├─ enterAltScreen()
    │   ├─ 检查 features.alternateScreen
    │   └─ process.stdout.write(ANSI.altScreenOn)  ← \x1b[?1049h
    │
    ├─ exitAltScreen()
    │   └─ process.stdout.write(ANSI.altScreenOff) ← \x1b[?1049l
    │
    ├─ hideCursor() / showCursor()
    │   └─ ANSI.cursorHide (\x1b[?25l) / ANSI.cursorShow (\x1b[?25h)
    │
    ├─ 光标移动:
    │   ├─ moveTo(row, col)  ← \x1b[{row};{col}H
    │   ├─ moveUp/Down/Left/Right(n)
    │   ├─ saveCursor()      ← \x1b[s
    │   └─ restoreCursor()   ← \x1b[u
    │
    ├─ clear() / clearLine() / clearDown()
    │
    ├─ listenResize()
    │   └─ process.stdout.on('resize', handler)
    │       └─ terminal.refreshDimensions()
    │       └─ emit('resize', { width, height })
    │
    └─ setupCleanup()
        └─ process.on('SIGINT'/'SIGTERM'/'exit', cleanup)
            └─ restore(): showCursor + exitAltScreen + unlistenResize
```

### 11.3 主题渲染

```
Theme 自动选择:
    │
    ├─ Terminal.get().colorDepth
    │   ├─ 'none' → noneTheme (无颜色，纯文本)
    │   ├─ '8'    → lowColorTheme (基本颜色，ASCII 前缀)
    │   └─ '16'/'256'/'truecolor' → defaultTheme (完整主题)
    │
    └─ createAutoTheme()

defaultTheme 颜色映射:
    primary:    chalk.cyan
    secondary:  chalk.blue
    success:    chalk.green
    warning:    chalk.yellow
    error:      chalk.red
    info:       chalk.blue
    muted:      chalk.gray
    highlight:  chalk.magenta
    title:      chalk.bold.cyan
    subtitle:   chalk.bold.blue
    border:     chalk.gray
    accent:     chalk.cyanBright

前缀符号:
    unicode:    ℹ(info) ✔(success) ⚠(warning) ✖(error)
    ascii:      info     ok          warn        ERR
```

### 11.4 组件渲染层次

```
┌─────────────────────────────────────────────────────────────────┐
│ CLI 输出渲染                                                     │
│                                                                 │
│ CLI.startInteractive()                                          │
│   │                                                             │
│   ├─ new Screen(terminal)                                       │
│   ├─ screen.enterAltScreen() (如果支持)                          │
│   ├─ screen.hideCursor()                                        │
│   │                                                             │
│   ├─ Welcome Banner:                                            │
│   │   └─ colors.title() + colors.muted()                        │
│   │                                                             │
│   └─ readline REPL:                                             │
│       └─ colors.primary() 提示符                                │
│       └─ 命令结果:                                               │
│           ├─ success → colors.muted(message)                    │
│           └─ error   → colors.error(message)                    │
│                                                                 │
│ 组件渲染 (独立调用):                                              │
│                                                                 │
│   Spinner:                                                      │
│     ├─ new Spinner({ text, spinner, color })                    │
│     ├─ spinner.start()  → 显示动画                               │
│     ├─ spinner.setText() → 更新文本                              │
│     ├─ spinner.succeed() → ✔ 成功                               │
│     └─ spinner.fail()    → ✖ 失败                               │
│                                                                 │
│   Banner:                                                       │
│     └─ createBanner(config) → 带边框的标题文本                    │
│                                                                 │
│   Box:                                                          │
│     └─ createBox(config) → 盒子边框绘制                          │
│                                                                 │
│   Output:                                                       │
│     ├─ output.heading(text)  → 标题 + 分隔线                     │
│     ├─ output.subheading()   → 缩进副标题                        │
│     └─ output.log(level, msg) → 带前缀的日志                     │
│                                                                 │
│   Prompt:                                                       │
│     └─ createPrompt(config) → 用户输入提示                       │
│                                                                 │
│   Progress:                                                     │
│     └─ createProgress(config) → 进度条显示                       │
│                                                                 │
│   Table:                                                        │
│     └─ renderTable(config) → 格式化表格                          │
│                                                                 │
│ 鼠标交互:                                                        │
│   MouseHandler                                                  │
│     ├─ ANSI.mouseOn (\x1b[?1000h\x1b[?1002h\x1b[?1006h)       │
│     ├─ 监听 stdin 的鼠标事件序列                                  │
│     └─ 解析 SGR 扩展鼠标协议                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 11.5 UIAgent 和 Sandbox 体系

```
UIAgent 操作流程:
    │
    ├─ UIOperationManager (管理 UI 操作)
    │   ├─ click(page, selector, options)
    │   ├─ input(page, selector, text)
    │   ├─ select(page, selector, value)
    │   ├─ scroll(page, direction, amount)
    │   ├─ hover(page, selector)
    │   ├─ wait(page, condition)
    │   ├─ getText(page, selector)
    │   ├─ getAttribute(page, selector, attr)
    │   └─ screenshot(page, options)
    │
    ├─ Sandbox (沙箱隔离)
    │   ├─ createSandbox(config)
    │   ├─ 网络限制 (SandboxNetworkRestrictions)
    │   ├─ 权限检查 (PermissionCheckResult)
    │   └─ 操作上下文 (SandboxOperationContext)
    │
    └─ UIAgent (高级 UI Agent)
        ├─ 状态: IDLE | BUSY | ERROR | OFFLINE
        ├─ 操作请求: UIOperationRequest
        └─ 权限管理: OPERATION_PERMISSIONS + SENSITIVE_OPERATIONS
```

---

## 12. 错误传播流

### 12.1 错误层级

```
┌─────────────────────────────────────────────────────────────────┐
│ @organic/utils 错误基类                                          │
│                                                                 │
│ BaseError                                                       │
│   ├─ name: string                                               │
│   ├─ message: string                                            │
│   ├─ code: string                                               │
│   ├─ details?: unknown                                          │
│   └─ timestamp: number                                          │
│                                                                 │
│   ├─ ValidationError (code: ValidationErrorCode)                │
│   └─ NotFoundError (code: NotFoundErrorCode)                    │
│                                                                 │
│ @organic/storage 扩展                                            │
│   └─ StorageError (code: StorageErrorCode)                      │
│       NOT_INITIALIZED | ENTITY_NOT_FOUND | DUPLICATE_ENTITY      │
│       INVALID_FILTER | TRANSACTION_FAILED | OPERATION_FAILED     │
│                                                                 │
│ @organic/plugins 扩展                                            │
│   ├─ ConversationError                                          │
│   ├─ SessionError                                               │
│   └─ ContextError                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 12.2 错误传播路径

```
错误发生点
    │
    ├─ try/catch 捕获
    │   ├─ 记录日志: logger.error(message, error)
    │   ├─ 发送事件: eventBus.emit('plugin:error', ...) 或
    │   │            eventBus.emit('execution:error', ...)
    │   └─ 包装为结构化错误结果
    │
    ├─ 向上传播:
    │   ├─ Tool.execute()     → ToolResult { success: false, error }
    │   ├─ Plugin.execute()   → PluginOutput { success: false, error }
    │   ├─ Agent.execute()    → AgentResult { success: false, error }
    │   ├─ Coordinator.exec() → ExecutionResult { success: false, error }
    │   └─ OrchestrationLayer → OrchestrationResult { success: false, error }
    │
    └─ 最终呈现:
        └─ CLI.run() → CommandResult { success: false, error }
            └─ console.log(theme.colors.error(error))
```

### 12.3 错误处理模式

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 工具执行错误                                                  │
│                                                                 │
│ ToolService.execute()                                           │
│   ├─ 工具未找到:  { success: false, error: "Tool not found" }    │
│   ├─ 工具已禁用:  { success: false, error: "Tool is disabled" }  │
│   ├─ 验证失败:    { success: false, validationErrors }           │
│   ├─ 授权拒绝:    { success: false, authResult }                 │
│   ├─ 执行超时:    { success: false, error: "timed out" }         │
│   └─ 执行异常:    catch → { success: false, error }              │
│                                                                 │
│ 2. 插件错误                                                      │
│                                                                 │
│ PluginManager.initialize() / execute()                          │
│   ├─ 初始化失败: throw error                                    │
│   │   └─ eventBus.emit('plugin:error', { name, error })         │
│   └─ 执行异常:   catch → PluginOutput { success: false, error } │
│                                                                 │
│ 3. Agent 错误                                                    │
│                                                                 │
│ Agent.execute()                                                 │
│   ├─ 未初始化:    throw Error("Agent not initialized")          │
│   ├─ 无处理器:    throw Error("No handler registered")          │
│   ├─ 执行超时:    AgentResult { success: false, error }          │
│   └─ 执行异常:    catch → AgentResult { success: false, error } │
│       └─ emit('task:error', { taskId, error })                  │
│                                                                 │
│ 4. 工作流错误                                                    │
│                                                                 │
│ WorkflowEngine                                                  │
│   ├─ 任务失败:    processNodeResult() → 更新状态                  │
│   │   ├─ continueOnError → 继续执行下一个节点                     │
│   │   └─ !continueOnError → handleWorkflowFailure()              │
│   ├─ 任务超时:    handleTimeout() → 自动重试或标记失败             │
│   └─ 工作流失败:  emit('execution:failed')                       │
│                                                                 │
│ 5. 编排错误                                                      │
│                                                                 │
│ OrchestrationLayer.orchestrate()                                │
│   ├─ 并发限制:    { success: false, errorCode: "MAX_CONCURRENT" }│
│   ├─ 无可用 Agent: { success: false, errorCode: "NO_AGENT" }     │
│   ├─ 执行失败:    aggregateResults → 找到第一个错误               │
│   └─ 异常:        catch → { success: false, errorCode:           │
│                             "ORCHESTRATION_ERROR" }              │
│                                                                 │
│ 6. 存储错误                                                      │
│                                                                 │
│ StorageService                                                  │
│   ├─ 实体不存在:  read → null; update → error                    │
│   ├─ 重复实体:    create → error                                │
│   ├─ 唯一约束:    create → checkUniqueIndex → error              │
│   └─ 事务错误:    beginTransaction → throw StorageError          │
│                                                                 │
│ 7. 通信错误                                                      │
│                                                                 │
│ AgentChannel                                                    │
│   ├─ 消息过期:    handleMessage → throw Error                    │
│   ├─ 无处理器:    handleMessage → throw Error                    │
│   ├─ 请求超时:    sendAndWait → reject("timed out")              │
│   └─ 通道销毁:    dispose → pendingRequests reject("disposed")   │
│                                                                 │
│ MessageQueue                                                    │
│   ├─ 队列满:      enqueue → false + emit('queue:full')           │
│   ├─ 消息过期:    dequeue → 跳过 + 死信队列                       │
│   └─ 死信:        handleDeadLetter → 死信队列 (可重试)            │
└─────────────────────────────────────────────────────────────────┘
```

### 12.4 错误恢复策略

```
┌─────────────────────────────────────────────────────────────────┐
│ 自动恢复:                                                        │
│   ├─ 工具执行: 重试 (指数退避)                                    │
│   ├─ 工作流任务: canTaskRetry + scheduleRetry                     │
│   ├─ Agent 通信: sendWithRetry (exponential backoff)            │
│   └─ 工作流执行: enableRecovery + snapshot/restore               │
│                                                                 │
│ 降级处理:                                                        │
│   ├─ 编排: 步骤失败 → 跳过 (continueOnError)                     │
│   ├─ 工具: 超时 → 返回错误结果 (不阻塞)                           │
│   └─ 插件: 初始化失败 → 跳过该插件 (不阻塞启动)                    │
│                                                                 │
│ 用户通知:                                                        │
│   ├─ CLI: theme.colors.error() 输出错误信息                      │
│   ├─ 事件: error 事件 → 日志/监控系统                            │
│   └─ 审批: 安全拒绝 → 用户可见的拒绝理由                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. 配置加载流

### 13.1 Kernel 配置结构

```
KernelConfig:
  {
    name: string,              // 内核名称
    version: string,           // 版本号
    plugins: PluginConfig[],   // 插件配置列表
    tools: ToolConfig[],       // 工具配置列表
    // ... 扩展配置
  }

KernelOptions:
  {
    config: KernelConfig,      // 必需配置
    logger?: Logger,           // 自定义日志
    debug?: boolean,           // 调试模式
    textServiceConfig?: TextServiceConfig,
    infoServiceConfig?: InfoServiceConfig
  }
```

### 13.2 配置加载优先级

```
配置加载层次 (优先级从低到高):

  ┌──────────────────────────────────────────────────────────────┐
  │ 1. 默认配置 (Default)                                        │
  │    └─ 代码中硬编码的默认值                                     │
  │    └─ 例: DEFAULT_TOOL_SERVICE_CONFIG                        │
  │           DEFAULT_EXECUTOR_CONFIG                            │
  │           DEFAULT_CONTEXT_CONFIG                             │
  │           DEFAULT_ORCHESTRATION_CONFIG                       │
  ├──────────────────────────────────────────────────────────────┤
  │ 2. 系统配置 (System)                                         │
  │    └─ 系统级配置文件 (如 /etc/organic/config.json)            │
  │    └─ 系统环境变量 (ORGANIC_*)                                │
  ├──────────────────────────────────────────────────────────────┤
  │ 3. 项目配置 (Project)                                        │
  │    └─ 项目目录下的配置文件 (.organicrc, organic.config.json)  │
  │    └─ 项目环境变量文件 (.env)                                  │
  ├──────────────────────────────────────────────────────────────┤
  │ 4. 用户配置 (User)                                           │
  │    └─ 用户主目录下的配置文件 (~/.organic/config.json)         │
  │    └─ 用户环境变量                                            │
  ├──────────────────────────────────────────────────────────────┤
  │ 5. 环境变量 (Environment Variables)                          │
  │    └─ ORGANIC_* 前缀的环境变量                                │
  │    └─ 运行时注入的环境变量                                     │
  ├──────────────────────────────────────────────────────────────┤
  │ 6. 运行时配置 (Runtime)                                       │
  │    └─ 代码中显式传入的配置                                     │
  │    └─ 构造函数参数、方法参数                                   │
  └──────────────────────────────────────────────────────────────┘
```

### 13.3 配置合并流

```
┌─────────────────────────────────────────────────────────────────┐
│ 配置合并策略:                                                    │
│                                                                 │
│ 浅合并 (Shallow Merge):                                          │
│   config = { ...defaults, ...userConfig }                       │
│   用于大部分服务配置 (ToolService, ContextManager, Agent 等)      │
│                                                                 │
│ 完整合并流程:                                                    │
│                                                                 │
│   new ConfigLoader()                                            │
│     │                                                           │
│     ├─ loadDefaults()                                           │
│     │   └─ 从各包导出 DEFAULT_* 常量                             │
│     │                                                           │
│     ├─ loadSystemConfig()                                       │
│     │   └─ 读取系统级配置文件                                    │
│     │                                                           │
│     ├─ loadProjectConfig()                                      │
│     │   └─ 读取 .organicrc / organic.config.json               │
│     │                                                           │
│     ├─ loadUserConfig()                                         │
│     │   └─ 读取 ~/.organic/config.json                         │
│     │                                                           │
│     ├─ loadEnvConfig()                                          │
│     │   └─ 解析 ORGANIC_* 环境变量                              │
│     │                                                           │
│     ├─ merge() → 逐层合并                                       │
│     │   └─ 深层合并 (deep merge) 用于嵌套配置                    │
│     │                                                           │
│     └─ validate() → 验证合并后的配置                            │
│         └─ 检查必需字段、类型、取值范围                           │
│                                                                 │
│ 例如: ToolService 初始化配置                                     │
│                                                                 │
│   DEFAULT_TOOL_SERVICE_CONFIG = {                               │
│     defaultTimeout: 30000,                                      │
│     maxConcurrentExecutions: 10,                                │
│     enableValidation: true,                                     │
│     enableLogging: true,                                        │
│     enableMetrics: true                                         │
│   }                                                             │
│                                                                 │
│   new ToolService({ defaultTimeout: 60000 })                    │
│     └─ config = { ...DEFAULT_CONFIG, ...{ defaultTimeout: 60000 }}│
│     └─ 最终: { defaultTimeout: 60000, maxConcurrent: 10, ... }  │
└─────────────────────────────────────────────────────────────────┘
```

### 13.4 配置传递图

```
配置流向:

  KernelOptions.config
      │
      ├─► Kernel
      │     ├─ EventBus (async, captureLimit)
      │     ├─ LifecycleManager (hooks)
      │     ├─ PluginManager (defaultPluginConfig)
      │     ├─ TextService (textServiceConfig)
      │     └─ InfoService (infoServiceConfig)
      │
      ├─► PluginLoader (sourcePath, compatibility)
      │     └─► Plugin.initialize(PluginContext) ← kernel + config
      │
      ├─► ToolService (timeout, concurrency, validation, metrics)
      │     ├─► ToolExecutor (maxConcurrent, sandbox, timeout)
      │     │     └─► SandboxConfig (enabled, restrictions)
      │     ├─► SecurityGuard (preset, allowEscalation, auditLog)
      │     │     └─► ApprovalService (defaultTimeout, autoApprove)
      │     └─► Builtin Tools (各自的配置)
      │
      ├─► Agent (agentConfig, heartbeatInterval, maxParallelTasks)
      │     ├─► ContextManager (maxWindowSize, ttl, compress)
      │     │     ├─► ContextWindowManager (windowSize, maxTokens)
      │     │     └─► ContextService (propagation, nesting depth)
      │     ├─► WorkflowEngine (maxConcurrency, parallel, recovery)
      │     │     └─► WorkflowExecutor (maxConcurrency, timeout)
      │     ├─► OrchestrationLayer (timeout, maxConcurrent, decompose)
      │     │     └─► ExecutionCoordinator (defaultTimeout)
      │     └─► AgentChannel (defaultTimeout, maxRetries, retryDelay)
      │
      ├─► StorageManager (defaultBackend, autoInitialize, configs)
      │     └─► StorageService (backend)
      │           ├─► MemoryStorage (config)
      │           ├─► FileStorage (basePath, config)
      │           └─► DatabaseStorage (dbPath, config)
      │
      └─► CLI (name, version, interactive, terminalFeatures)
            ├─► Terminal (FeatureConfig: mouse, colors, unicode...)
            ├─► Theme (auto-detect: noneTheme | lowColorTheme | defaultTheme)
            └─► Screen (cursor, altScreen, resize)
```

### 13.5 CLI 配置

```
CLIConfig:
  {
    name: 'organic-cli',
    version: '0.1.0',
    description: 'Organic Interface CLI',
    logger?: Logger,
    parser?: CommandParser,
    interactive: false,
    historyPath: '.organic-cli-history',
    terminalFeatures?: Partial<FeatureConfig>
  }

Terminal FeatureConfig:
  {
    mouse: 'auto',         // → Terminal.detectFeatures()
    trueColor: 'auto',     // → COLORTERM 环境变量检测
    colors256: 'auto',     // → TERM 环境变量检测
    unicode: 'auto',       // → LANG 环境变量检测
    emoji: 'auto',         // → TERM_PROGRAM 检测
    alternateScreen: 'auto',
    bracketedPaste: 'auto',
    focusEvents: 'auto',
    cursorControl: 'auto',
    resizeEvents: 'auto',
    colorDepth: 'auto',    // → 自动检测 truecolor/256/16/8/none
    width: 'auto',         // → process.stdout.columns
    height: 'auto'         // → process.stdout.rows
  }
```

---

## 附录

### A. 关键常量汇总

| 常量                                                       | 值             | 所属模块 |
| ---------------------------------------------------------- | -------------- | -------- |
| `DEFAULT_TOOL_SERVICE_CONFIG.defaultTimeout`               | 30000ms        | tools    |
| `DEFAULT_TOOL_SERVICE_CONFIG.maxConcurrentExecutions`      | 10             | tools    |
| `DEFAULT_EXECUTOR_CONFIG.maxConcurrent`                    | 5              | tools    |
| `DEFAULT_EXECUTOR_CONFIG.maxQueueSize`                     | 100            | tools    |
| `DEFAULT_EXECUTOR_CONFIG.defaultTimeout`                   | 30000ms        | tools    |
| `DEFAULT_APPROVAL_CONFIG.defaultTimeout`                   | 60000ms        | tools    |
| `DEFAULT_CONTEXT_CONFIG.maxWindowSize`                     | 100            | agent    |
| `DEFAULT_CONTEXT_CONFIG.ttl`                               | 3600000ms (1h) | agent    |
| `DEFAULT_CONTEXT_WINDOW_CONFIG.windowSize`                 | 50             | agent    |
| `DEFAULT_CONTEXT_WINDOW_CONFIG.maxTokens`                  | 4096           | agent    |
| `DEFAULT_CONTEXT_SERVICE_CONFIG.maxNestingDepth`           | 5              | agent    |
| `DEFAULT_CONTEXT_SERVICE_CONFIG.cleanupInterval`           | 60000ms        | agent    |
| `DEFAULT_WORKFLOW_ENGINE_CONFIG.maxParallelNodes`          | 10             | agent    |
| `DEFAULT_WORKFLOW_ENGINE_CONFIG.snapshotInterval`          | 30000ms        | agent    |
| `DEFAULT_WORKFLOW_ENGINE_CONFIG.defaultTimeout`            | 3600000ms (1h) | agent    |
| `DEFAULT_ORCHESTRATION_CONFIG.defaultTimeout`              | 60000ms        | agent    |
| `DEFAULT_ORCHESTRATION_CONFIG.maxConcurrentOrchestrations` | 10             | agent    |
| `DEFAULT_RETRY_CONFIG.maxAttempts`                         | 3              | agent    |
| `DEFAULT_RETRY_CONFIG.baseDelay`                           | 100ms          | agent    |
| `DEFAULT_RETRY_CONFIG.maxDelay`                            | 5000ms         | agent    |
| `DEFAULT_CHANNEL_CONFIG.defaultTimeout`                    | 5000ms         | agent    |
| `DEFAULT_CHANNEL_CONFIG.maxRetries`                        | 3              | agent    |
| `DEFAULT_QUEUE_CONFIG.maxSize`                             | 1000           | agent    |
| `DEFAULT_QUEUE_CONFIG.defaultTTL`                          | 30000ms        | agent    |
| `DEFAULT_QUEUE_CONFIG.deadLetterMaxSize`                   | 100            | agent    |

### B. 状态枚举汇总

| 枚举                      | 值                                                                              | 所属模块 |
| ------------------------- | ------------------------------------------------------------------------------- | -------- |
| `LifecycleState`          | CREATED, INITIALIZING, INITIALIZED, STARTING, RUNNING, STOPPING, STOPPED, ERROR | kernel   |
| `AgentStatus`             | INITIALIZING, IDLE, BUSY, ERROR, SHUTTING_DOWN, OFFLINE                         | agent    |
| `ContextStatus`           | INITIALIZING, ACTIVE, IDLE, ARCHIVED, DELETED                                   | agent    |
| `ContextWindowType`       | RECENT_MESSAGES, RECENT_MINUTES, TOKEN_BASED, SEMANTIC_BASED                    | agent    |
| `PropagationMode`         | DIRECT, REFERENCE, INCREMENTAL, HYBRID                                          | agent    |
| `WorkflowExecutionStatus` | PENDING, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED                          | agent    |
| `TaskStatus`              | PENDING, RUNNING, COMPLETED, FAILED, RETRYING, TIMEOUT, CANCELLED               | agent    |
| `OrchestrationStrategy`   | PARALLEL, SEQUENTIAL, AUTO                                                      | agent    |
| `OrchestrationPlanStatus` | PENDING, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED                          | agent    |
| `TransactionStatus`       | ACTIVE, COMMITTED, ROLLED_BACK, EXPIRED                                         | storage  |
| `IsolationLevel`          | READ_UNCOMMITTED, READ_COMMITTED, REPEATABLE_READ, SERIALIZABLE                 | storage  |
| `StorageBackendType`      | MEMORY, FILE, DATABASE                                                          | storage  |
| `SecurityPreset`          | plan, create, work, yolo                                                        | tools    |
| `ContextItemType`         | MESSAGE, STATE, TOOL_CALL, RESULT, ATTACHMENT, CUSTOM                           | agent    |
| `StateType`               | SESSION, PERSISTENT, TEMPORARY                                                  | agent    |

### C. 包依赖关系

```
@organic/ui
  └── @organic/utils (types, logger)
  └── @organic/kernel (KernelApi type)

@organic/agent
  └── @organic/utils (types, logger)
  └── @organic/kernel (KernelApi)

@organic/plugins
  └── @organic/utils (types)

@organic/tools
  └── @organic/utils (types, logger)

@organic/storage
  └── @organic/utils (types, logger, BaseError)

@organic/kernel
  └── @organic/utils (types, logger)

@organic/utils
  └── (无依赖，Level 0)
```
