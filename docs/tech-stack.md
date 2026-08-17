# 技术选型文档

## 基本信息

**文档类型**: 技术规格
**创建日期**: 2026-04-15
**版本**: 1.1.0
**状态**: 已确定（按实际实现更新）

---

## 技术选型概述

Organic-Interface项目基于Node.js运行时环境开发，采用TypeScript作为主导编程语言。项目采用Monorepo多模块架构组织代码结构，通过pnpm和Turborepo实现高效的包管理和构建流程。

AI调度方面，系统使用自研的Agent/OrchestrationLayer/WorkflowEngine架构实现任务分解、调度和执行管理，而非依赖外部AI SDK。

**核心技术栈**：Node.js 18+ / TypeScript 5.x / 自研Agent调度引擎 / pnpm / Turborepo

---

## 核心语言和运行时

### Node.js

**选择版本**: Node.js 18 LTS

**选择理由**：

- 稳定的LTS版本，提供长期支持和安全保障
- 18版本对ES Modules支持完善，支持顶层await
- 强大的异步I/O能力，适合I/O密集型应用
- 成熟的生态系统，丰富的npm包支持
- V8引擎持续优化，性能表现优秀

**运行环境要求**：

- 最低版本：Node.js 18.0.0
- 推荐版本：Node.js 20 LTS
- 支持平台：Linux、macOS、Windows

### TypeScript

**选择版本**: TypeScript 5.x

**选择理由**：

- 强类型检查能力，在编译阶段发现潜在错误
- 完整的IDE支持，提供智能提示和代码补全
- 最新的装饰器支持和更好的类型推断
- 支持ES Module和CommonJS的互操作
- 与现代JavaScript标准保持同步

**配置要求**：

- strict模式开启所有严格类型检查
- 禁止使用any类型，必须使用unknown或具体类型
- 所有导出接口必须完整定义类型
- 使用esModuleInterop确保兼容性

**代码规范**：

- 变量命名：camelCase
- 类型命名：PascalCase
- 常量命名：UPPER_SNAKE_CASE
- 文件命名：kebab-case.ts

---

## AI调度与Agent架构

### 自研Agent调度引擎

**状态**: 已实现

系统采用自研的Agent调度架构，而非外部AI SDK（如LiteLLM）。实际实现包含以下核心组件：

**核心组件**：

| 组件                 | 所属包         | 职责                          |
| -------------------- | -------------- | ----------------------------- |
| Agent                | @organic/agent | 核心Agent实体，任务执行单元   |
| OrchestrationLayer   | @organic/agent | 任务分解、计划编排、结果聚合  |
| WorkflowEngine       | @organic/agent | 工作流定义、DAG执行、节点调度 |
| ExecutionCoordinator | @organic/agent | 执行协调、重试策略、结果汇总  |
| TaskScheduler        | @organic/agent | 任务队列管理、优先级调度      |
| ContextManager       | @organic/agent | 会话上下文管理、窗口控制      |
| ContextService       | @organic/agent | 执行上下文传播、框架管理      |

**架构特点**：

- 支持并行多层Agent架构，上层Agent负责任务规划和分解，下层Agent负责具体执行
- 采用发布订阅模式进行Agent间通信
- 支持同步和异步两种调用方式
- 工作流以DAG（有向无环图）形式定义，支持条件分支、循环、并行执行
- 状态同步通过共享存储实现，确保多Agent环境下数据一致性

**Agent类型**（AgentType）：

- 支持不同优先级的Agent注册（AgentPriority）
- 可配置的Agent状态管理（AgentStatus）
- 内置任务统计（AgentStats）和状态追踪

> **注意**：LiteLLM 曾作为规划中的AI模型统一接口，但实际代码中并未导入或使用。当前Agent调度完全基于自研引擎实现。

---

## 包管理和构建工具

### pnpm

**版本**: 8.x+（实际使用 10.x）

**选择理由**：

- 节省磁盘空间，相同依赖只存储一份
- 严格的依赖隔离，避免幽灵依赖
- 极快的安装速度
- 原生支持workspace协议
- 良好的monorepo支持

**Workspace配置**：

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

**常用命令**：

- pnpm install - 安装所有依赖
- pnpm add \<pkg\> - 添加依赖
- pnpm --filter \<pkg\> - 针对特定包执行命令
- pnpm -r - 在所有包中执行命令

### Turborepo

**版本**: 2.x

**选择理由**：

- 智能增量构建，只构建变更模块
- 任务管道编排，支持并行和串行任务
- 远程缓存支持（可选）
- 构建产物缓存，提高CI/CD效率
- 跨平台支持

**配置示例**：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

---

## Monorepo工具选型

### 架构方案：pnpm + Turborepo

**组合优势**：

- pnpm负责包管理和workspace管理
- Turborepo负责构建编排和任务调度
- 两者天然互补，覆盖开发全流程

**替代方案比较**：

| 方案                    | 优点     | 缺点         |
| ----------------------- | -------- | ------------ |
| npm workspaces + Lerna  | 简单直接 | 增量构建弱   |
| yarn workspaces + Lerna | 社区成熟 | 构建性能一般 |
| pnpm + Turborepo        | 性能最佳 | 学习曲线     |
| Nx                      | 功能强大 | 配置复杂     |

### 内部包命名规范

**命名格式**: @organic/{module-name}

**已定义包（7个，全部已实现）**：

| 包名             | 说明                      | 依赖关系                           |
| ---------------- | ------------------------- | ---------------------------------- |
| @organic/utils   | 共享类型、错误和工具函数  | 无外部依赖                         |
| @organic/kernel  | 核心引擎、生命周期和事件  | 依赖 @organic/utils                |
| @organic/plugins | Plugin系统、加载和注册    | 依赖 @organic/utils                |
| @organic/tools   | 工具管理、执行和安全沙箱  | 依赖 @organic/utils                |
| @organic/agent   | Agent调度、工作流和上下文 | 依赖 utils, kernel, plugins, tools |
| @organic/storage | 多后端存储抽象层          | 依赖 @organic/utils                |
| @organic/ui      | 终端UI组件、CLI和TUI      | 依赖 @organic/utils                |

**包间依赖关系**：

```
@organic/utils          ← 基础工具层，所有包依赖
@organic/kernel         ← 核心引擎
@organic/plugins        ← 插件系统
@organic/tools          ← 工具服务
@organic/storage        ← 存储抽象
@organic/ui             ← 用户界面
@organic/agent          ← 聚合层，依赖 utils + kernel + plugins + tools
```

---

## 数据库和存储

### 存储后端（已实现）

系统通过 @organic/storage 包提供统一存储抽象，支持三种后端：

| 后端     | 类名            | 说明                   | 适用场景             |
| -------- | --------------- | ---------------------- | -------------------- |
| Memory   | MemoryStorage   | 内存存储，高速临时     | 会话缓存、测试       |
| File     | FileStorage     | 文件持久化存储         | 本地持久化、配置     |
| Database | DatabaseStorage | 基于SQLite的结构化存储 | 事务性数据、正式存储 |

**选择理由**：

- 零配置，开箱即用
- 单文件数据库，便于部署
- 性能足够，支持大部分场景
- 便于数据迁移和备份

**使用场景**：

- 项目配置存储
- Plugin元数据存储
- 会话持久化（SessionPersistenceStorage）
- 轻量级数据持久化

### 可选升级方案

**PostgreSQL**（推荐用于生产环境）：

- 支持高并发访问
- 更好的数据一致性保证
- 丰富的扩展生态

**Redis**（缓存层）：

- 会话缓存
- 热点数据缓存
- 发布订阅消息

---

## 其他工具库选型

### 日志库

**选型**: pino（规划中）

**选择理由**：

- 高性能JSON日志
- 结构化日志输出
- 低开销异步日志
- 支持日志传输协议

**当前状态**：createLogger 工具函数已实现于 @organic/utils，但 pino 尚未作为依赖引入。当前使用简单的 console 包装。

### 配置管理

**选型**: zod + dotenv（规划中）

**选择理由**：

- zod提供运行时配置验证
- dotenv提供环境变量加载
- 类型安全的配置访问

**当前状态**：zod 和 dotenv 尚未在代码中实际导入使用。配置验证目前通过 TypeScript 类型系统实现。

### 测试框架

**选型**: Vitest（已实现）

**选择理由**：

- 兼容Jest API，易于迁移
- 极快的测试执行速度
- 原生TypeScript支持
- 开箱即用的ESM支持

**当前版本**: 4.x（devDependencies）

### 代码格式化

**选型**: Prettier + ESLint（已实现）

**配置**：

- Prettier处理代码格式化
- ESLint处理代码检查
- 统一2空格缩进
- 单引号字符串
- 不加分号

**当前版本**: ESLint 9.x, Prettier 3.x（devDependencies）

---

## 环境配置要求

### 开发环境

**Node.js**: 20.x（推荐）或 18.x（最低）

**pnpm**: 8.x+

**操作系统**: macOS / Linux / Windows (WSL2)

**推荐工具**：

- VSCode + TypeScript插件
- Zsh + oh-my-zsh
- Git

### 构建环境

**Node.js**: 20.x LTS

**pnpm**: 8.x+

**内存**: 最少2GB可用内存

**磁盘**: 最少1GB可用空间

### 生产环境

**Node.js**: 20.x LTS

**操作系统**: Linux (Ubuntu 20.04+ / Debian 11+)

**内存**: 最少512MB可用内存

**磁盘**: 根据数据量配置

---

## 技术栈汇总

### 运行时和语言

| 类别     | 选择       | 版本         | 说明                     |
| -------- | ---------- | ------------ | ------------------------ |
| 运行时   | Node.js    | 18+ / 20 LTS | JavaScript执行环境       |
| 编程语言 | TypeScript | 5.x          | 类型安全的JavaScript超集 |

### 核心依赖（已实现）

| 类别   | 选择                                        | 说明                     |
| ------ | ------------------------------------------- | ------------------------ |
| AI调度 | 自研Agent/OrchestrationLayer/WorkflowEngine | 任务分解、编排和执行管理 |
| 存储   | Memory / File / Database (SQLite)           | 多后端存储抽象层         |

### 核心依赖（规划中）

| 类别     | 选择   | 说明                     |
| -------- | ------ | ------------------------ |
| 日志     | pino   | 高性能结构化日志库       |
| 配置验证 | zod    | TypeScript优先schema验证 |
| 环境变量 | dotenv | 环境变量加载             |

### 构建和工具（已实现）

| 类别       | 选择      | 版本 | 说明               |
| ---------- | --------- | ---- | ------------------ |
| 包管理     | pnpm      | 8.x+ | 高效的包管理器     |
| 构建编排   | Turborepo | 2.x  | 增量构建工具       |
| 代码检查   | ESLint    | 9.x  | JavaScript代码检查 |
| 代码格式化 | Prettier  | 3.x  | 代码格式化         |
| 测试框架   | Vitest    | 4.x  | 快速测试框架       |

### 数据库

| 类别       | 选择                   | 状态   | 说明             |
| ---------- | ---------------------- | ------ | ---------------- |
| 默认存储   | Memory / File / SQLite | 已实现 | 多后端存储抽象   |
| 生产数据库 | PostgreSQL             | 规划中 | 可选高性能数据库 |
| 缓存       | Redis                  | 规划中 | 可选缓存层       |

---

## 相关文档

- feature-013-monorepo-architecture.md - Monorepo架构设计
- feature-001-agent-architecture.md - Agent并行多层架构设计
- feature-006-plugin-spec.md - Plugin插件系统架构
- feature-009-workflow-engine.md - 工作流引擎设计
- feature-012-storage-system.md - 存储系统设计
- requirements.md - 需求规格说明
