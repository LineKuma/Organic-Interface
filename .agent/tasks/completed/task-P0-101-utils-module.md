# 任务文档：实现 @organic/utils 核心模块

## 基本信息

- **任务编号**: task-P0-101
- **任务名称**: 实现 @organic/utils 核心模块
- **所属模块**: 核心架构 (utils)
- **优先级**: P0
- **状态**: completed
- **执行分支**: agent-develop
- **创建日期**: 2026-04-20
- **完成日期**: 2026-04-20
- **对应文档**: feature-007-tool-system.md, feature-013-monorepo-architecture.md

---

## 任务目标

根据 feature-007-tool-system.md 和 feature-013-monorepo-architecture.md 文档定义，实现 @organic/utils 模块的核心功能，作为所有其他模块的共享基础。

---

## 交付物清单

### 目录结构

```
packages/utils/src/
├── types/           # 类型定义
│   ├── Config.ts    # 通用配置类型
│   ├── Plugin.ts    # 插件相关类型
│   ├── Tool.ts      # 工具相关类型
│   ├── Result.ts    # 操作结果类型
│   └── index.ts      # 类型导出
├── errors/          # 通用错误类
│   ├── BaseError.ts         # 基础错误类
│   ├── ValidationError.ts    # 验证错误
│   ├── NotFoundError.ts      # 未找到错误
│   └── index.ts             # 错误导出
├── utils/           # 通用工具函数
│   ├── logger.ts    # 日志工具
│   ├── async.ts     # 异步工具函数
│   ├── validation.ts # 验证工具
│   └── index.ts     # 工具导出
└── index.ts         # 模块主入口
```

---

## 实现详情

### 1. 类型定义 (types/)

**Config.ts**
- KernelConfig: 内核配置接口
- PluginConfig: 插件配置接口
- GenericConfig: 通用配置接口

**Plugin.ts**
- PluginContext: 插件上下文
- InitializeResult: 初始化结果
- PluginInput/PluginOutput: 插件输入输出
- PluginInterface: 插件接口定义
- KernelApi: 内核API接口

**Tool.ts**
- ToolType: 工具类型枚举 (FILE_OPERATION, SEARCH, EXECUTION, SYSTEM)
- ToolCallLevel: 工具调用级别枚举
- ToolParameter/ToolParameterDefinition: 工具参数定义
- ToolDefinition: 工具定义
- ToolResult/ToolError/ToolMetadata: 工具执行结果
- ToolErrorCode: 工具错误代码枚举
- ToolExecutionContext: 工具执行上下文
- ToolHandler: 工具处理函数类型

**Result.ts**
- Result<T>: 标准结果包装器
- ResultMetadata: 结果元数据
- PaginatedResult<T>: 分页结果
- successResult/errorResult: 结果创建工厂函数

### 2. 错误类 (errors/)

**BaseError.ts**
- 基础错误类，提供 name、code、details、timestamp 属性
- toJSON/toString 方法
- Error.captureStackTrace 支持

**ValidationError.ts**
- 继承 BaseError
- ValidationErrorCode 枚举
- 静态工厂方法: requiredField, invalidType, outOfRange, patternMismatch, enumMismatch

**NotFoundError.ts**
- 继承 BaseError
- NotFoundErrorCode 枚举
- 静态工厂方法: plugin, tool, config, file

### 3. 工具函数 (utils/)

**logger.ts**
- LogLevel: debug/info/warn/error
- LogEntry: 日志条目结构
- Logger: 日志接口
- createLogger: 创建日志实例
- defaultLogger: 默认日志实例
- createChildLogger: 创建子日志实例

**async.ts**
- sleep: 延迟函数
- withRetry: 带重试的异步操作
- withTimeout: 带超时的异步操作
- withConcurrencyLimit: 限制并发数
- AsyncQueue: 异步队列类

**validation.ts**
- 类型检查函数: isObject, isString, isNumber, isBoolean, isArray, isEmpty
- 验证函数: validateRequired, validateType, validateLength, validateRange, validatePattern, validateEnum
- validateSchema: 根据schema验证对象

---

## 执行步骤

1. [x] 创建目录结构 (types/, errors/, utils/)
2. [x] 实现 Config.ts 类型定义
3. [x] 实现 Plugin.ts 类型定义
4. [x] 实现 Tool.ts 类型定义
5. [x] 实现 Result.ts 类型定义
6. [x] 实现 BaseError.ts 错误类
7. [x] 实现 ValidationError.ts 错误类
8. [x] 实现 NotFoundError.ts 错误类
9. [x] 实现 logger.ts 日志工具
10. [x] 实现 async.ts 异步工具
11. [x] 实现 validation.ts 验证工具
12. [x] 更新 src/index.ts 主入口
13. [x] 创建任务文档

---

## 验证方式

```bash
# 类型检查
cd packages/utils && pnpm typecheck

# 构建模块
cd packages/utils && pnpm build
```

---

## 相关文档

- DOC-007: feature-007-tool-system.md
- DOC-013: feature-013-monorepo-architecture.md

---

## 依赖关系

- 被依赖: kernel, plugins, tools, agent, ui, storage
- 依赖: 无 (基础模块)

---

## 验收条件

| 验收项 | 验收标准 | 状态 |
|--------|----------|------|
| 类型定义完整 | 包含 Config, Plugin, Tool, Result 所有类型 | 通过 |
| 错误类完整 | 包含 BaseError, ValidationError, NotFoundError | 通过 |
| 日志工具 | 支持 createLogger 和日志级别控制 | 通过 |
| 异步工具 | 支持 sleep, withRetry, withTimeout, withConcurrencyLimit | 通过 |
| 验证工具 | 支持类型检查和 schema 验证 | 通过 |
| 模块导出 | src/index.ts 正确导出所有公开接口 | 通过 |
| TypeScript 类型安全 | 所有代码通过类型检查 | 待验证 |