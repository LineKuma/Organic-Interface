# Organic-Interface

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-blue.svg)](https://pnpm.js.org/)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-orange.svg)](package.json)

**Organic-Interface** 是一个多模态自动化 AI CLI 工具，采用三层分离架构（内核层 / 外围模块化交互层 / 自定义层）设计，专注于代码领域的智能代理应用。

## 项目概述

Organic-Interface 提供了一个稳定、灵活、可扩展的智能代理框架。核心理念是"内核稳定 + 外围灵活 + 一切皆可组合"，符合 Unix/Linux 哲学。

### 核心功能

- **三层分离架构**: 内核层提供稳定底层功能，外围层提供灵活交互能力，自定义层支持用户扩展
- **插件化设计**: 支持运行时动态加载和卸载插件，无缝扩展系统功能
- **AI Router 调度**: 智能任务路由和多视觉模型 Provider 统一调用
- **Monorepo 结构**: 使用 pnpm workspaces 和 Turborepo 管理多模块项目
- **TypeScript 原生**: 全项目使用 TypeScript 编写，提供完整的类型检查
- **工具服务**: 内置工具系统，支持文件操作、Shell 命令等常用功能
- **存储抽象**: 多后端存储支持（Memory、File、Database）

### 目标用户

- 开发者需要构建可扩展的 AI Agent 应用
- 研究者需要模块化的对话系统架构
- 团队需要统一的插件开发和部署标准

### 技术栈

| 类别     | 技术            |
| -------- | --------------- |
| 运行时   | Node.js 18+     |
| 语言     | TypeScript 5.4+ |
| 包管理   | pnpm 8+         |
| 构建工具 | Turborepo 1.13+ |
| 测试框架 | Vitest 1.4+     |

## 架构说明

Organic-Interface 采用三层分离架构，将系统划分为内核层、外围模块化交互层和自定义层。详细的架构设计请参考 [架构设计文档](docs/architecture.md)。

### 三层架构概述

```
┌─────────────────────────────────────────────────────┐
│                  自定义层 (Customization)             │
│   CLI 命令定义 · 任务模板 · Provider 注册 · 配置存储  │
├─────────────────────────────────────────────────────┤
│              外围模块化交互层 (Peripheral/Agent)       │
│   AI Router · 多 Provider · 脚本组合 · 策略 · 异常处理 │
├─────────────────────────────────────────────────────┤
│                   内核层 (Kernel)                     │
│   截图 · 输入控制 · ADB · 模块管理 · 日志 · 状态反馈   │
└─────────────────────────────────────────────────────┘
```

| 架构层   | 核心包                                                 | 职责                             |
| -------- | ------------------------------------------------------ | -------------------------------- |
| 内核层   | `@organic/kernel`, `@organic/utils`                    | 提供稳定、可靠、低延迟的底层功能 |
| 外围层   | `@organic/agent`, `@organic/plugins`, `@organic/tools` | 提供灵活、可扩展的交互和调度能力 |
| 自定义层 | `@organic/ui`, `@organic/storage`                      | 提供用户扩展和定制能力           |

> `@organic/plugins` 跨越外围层和自定义层，既是外围层的扩展骨架，又是自定义层的接入通道。

### 模块结构

```
organic-interface/
└── packages/
    ├── @organic/kernel      # 核心引擎模块
    ├── @organic/plugins     # 插件系统模块
    ├── @organic/agent       # Agent 调度模块
    ├── @organic/tools       # 工具服务模块
    ├── @organic/storage     # 存储系统模块
    ├── @organic/ui          # CLI 界面模块
    └── @organic/utils       # 工具库模块
```

### 模块职责

| 模块               | 描述                                       | 依赖层级         |
| ------------------ | ------------------------------------------ | ---------------- |
| `@organic/utils`   | 共享类型定义和通用工具函数                 | Level 0 (基础层) |
| `@organic/kernel`  | Kernel 主逻辑、生命周期管理、Plugin 加载器 | Level 1          |
| `@organic/plugins` | Plugin 接口、PluginLoader、PluginRegistry  | Level 2          |
| `@organic/tools`   | 内置工具注册、工具执行、权限控制           | Level 2          |
| `@organic/agent`   | Agent 接口、任务调度、上下文管理           | Level 3          |
| `@organic/ui`      | 命令行界面、Web 界面实现                   | Level 4 (最高)   |

### 依赖层级图

```
          utils (level 0)
             ↑
       kernel (level 1)
        ↗       ↖
   plugins      tools (level 2)
      ↖           ↗
       agent (level 3)
          ↑
          ui (level 4)
```

## 快速开始

### 前置要求

- Node.js 18.0.0 或更高版本
- pnpm 8.0.0 或更高版本

### 安装方式

#### 方式一：网络安装脚本（推荐）

一键安装，无需克隆仓库：

```bash
# 安装最新稳定版本 (master 分支，默认)
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash

# 安装开发版本 (develop 分支)
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- --branch develop

# 安装指定版本
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- --version v0.1.0

# 安装指定版本和分支
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- --version v0.1.0 --branch develop

# 安装到指定目录
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- --dir /opt/organic
```

**分支说明：**

- `master` (或 `stable`)：稳定版本，适合生产环境
- `develop` (或 `dev`)：开发版本，包含最新功能，可能不稳定

安装完成后，运行以下命令使环境变量生效：

```bash
source ~/.bashrc  # 或 ~/.zshrc
```

然后即可使用：

```bash
organic --help     # 查看帮助
organic --version  # 查看版本
organic            # 启动交互式 CLI
```

卸载：

```bash
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- --uninstall
```

#### 方式二：从 GitHub Release 下载

从 [GitHub Releases](https://github.com/LineKuma/Organic-Interface/releases) 下载预构建的 tarball：

```bash
# 下载
wget https://github.com/LineKuma/Organic-Interface/releases/download/v0.1.0/organic-v0.1.0.tar.gz

# 解压
tar -xzf organic-v0.1.0.tar.gz

# 安装依赖
cd organic-v0.1.0
pnpm install --prod

# 运行
node packages/ui/cli.js
```

#### 方式三：克隆仓库（开发用）

适合开发者贡献代码：

```bash
# 克隆项目
git clone https://github.com/LineKuma/Organic-Interface.git
cd Organic-Interface

# 安装依赖
pnpm install

# 构建
pnpm build
```

### 构建命令

```bash
# 构建所有模块
pnpm build

# 增量构建（仅构建变更的模块）
pnpm turbo build

# 监视模式（开发时使用）
pnpm dev
```

### 测试命令

```bash
# 运行所有测试
pnpm test

# 监视模式运行测试
pnpm test:watch

# 运行测试覆盖率
pnpm test:coverage
```

### 类型检查

```bash
# 类型检查
pnpm typecheck
```

### 代码清理

```bash
# 清理构建产物和 node_modules
pnpm clean
```

### 基本使用示例

```typescript
import { Kernel } from '@organic/kernel';
import { CoreConversationPlugin } from '@organic/plugins';

// 创建 Kernel 实例
const kernel = new Kernel();

// 注册插件
kernel.registerPlugin(new CoreConversationPlugin());

// 初始化
await kernel.initialize();
```

## 项目结构

```
organic-interface/
├── .agent/                  # Agent 相关配置
│   ├── tasks/              # 任务目录
│   │   ├── pending/        # 待处理任务
│   │   └── completed/      # 已完成任务
│   └── knowledge/          # 知识库
├── docs/                    # 项目文档
│   ├── feature-001-agent-architecture.md
│   ├── feature-006-plugin-spec.md
│   ├── feature-013-monorepo-architecture.md
│   └── ...
├── packages/                # 源代码包
│   ├── agent/              # Agent 模块
│   ├── kernel/             # Kernel 模块
│   ├── plugins/            # 插件系统
│   │   └── src/
│   │       ├── base/       # 基础插件类
│   │       ├── interfaces/ # 插件接口定义
│   │       ├── loaders/    # 插件加载器
│   │       ├── registry/   # 插件注册表
│   │       └── core-conversation/  # 核心对话插件
│   ├── storage/            # 存储模块
│   ├── tools/              # 工具模块
│   ├── ui/                 # 界面模块
│   └── utils/              # 工具库
├── coverage/                # 测试覆盖率报告
├── node_modules/           # 依赖包
├── package.json            # 根目录配置
├── pnpm-workspace.yaml     # pnpm workspace 配置
├── turbo.json              # Turborepo 配置
├── tsconfig.base.json      # 基础 TypeScript 配置
└── vitest.config.ts        # Vitest 配置
```

## 贡献指南

### 分支策略

- `agent-develop`: 自动化代理可写入的开发分支
- `main/master`: 稳定分支，仅存放经审核验证的稳定版本

### 开发流程

1. 从 `agent-develop` 创建功能分支
2. 进行开发并确保通过所有测试
3. 提交代码并创建 Pull Request
4. 由 Reviewer 审核通过后合并

### 代码规范

- 使用 TypeScript 进行开发
- 遵循项目现有的代码风格
- 确保通过类型检查 (`pnpm typecheck`)
- 保持测试覆盖

### 文档更新

- 新功能需要添加相应的文档
- 更新现有文档以反映代码变更
- 文档位于 `docs/` 目录下

---

## 文档索引

### 入门文档

| 文档                                                           | 说明                                      |
| -------------------------------------------------------------- | ----------------------------------------- |
| [需求规格说明](docs/requirements.md)                           | 项目需求文档，功能需求详细说明            |
| [技术选型文档](docs/tech-stack.md)                             | 技术栈选型及理由                          |
| [架构设计文档](docs/architecture.md)                           | 三层架构设计、Agent 多层架构、包-架构映射 |
| [Monorepo 架构设计](docs/feature-013-monorepo-architecture.md) | 多模块架构、包间依赖、构建配置            |

### 功能文档

| 编号     | 文档                                                                | 说明                                  |
| -------- | ------------------------------------------------------------------- | ------------------------------------- |
| FEAT-002 | [交互界面作为工具](docs/feature-002-ui-as-tool.md)                  | UI 操作接口、AI 自主操作界面          |
| FEAT-003 | [高度自定义提示词系统](docs/feature-003-prompt-system.md)           | 模板引擎、版本管理、变量系统          |
| FEAT-004 | [文件引用功能](docs/feature-004-file-reference.md)                  | 代码文件引用、上下文关联              |
| FEAT-005 | [项目定位与设计原则](docs/feature-005-product-positioning.md)       | 产品定位、差异化方向                  |
| FEAT-006 | [Plugin 插件系统架构](docs/feature-006-plugin-spec.md)              | Kernel-Plugin 双层架构、接口规范      |
| FEAT-007 | [Kernel 工具调用服务](docs/feature-007-tool-system.md)              | 工具分类、注册、执行、权限控制        |
| FEAT-008 | [上下文管理](docs/feature-008-context-management.md)                | 对话上下文、消息管理、状态传播        |
| FEAT-009 | [工作流引擎](docs/feature-009-workflow-engine.md)                   | DAG 工作流、串行/并行/条件/循环执行   |
| FEAT-010 | [配置管理系统](docs/feature-010-config-system.md)                   | 多级配置、继承覆盖、热更新            |
| FEAT-011 | [安全管理系统](docs/feature-011-security-system.md)                 | RBAC 权限模型、审计日志               |
| FEAT-012 | [Storage 存储系统](docs/feature-012-storage-system.md)              | 多后端存储、事务、数据迁移            |
| FEAT-014 | [核心对话插件](docs/feature-014-core-conversation-plugin.md)        | CoreConversationPlugin 完整规格       |
| FEAT-015 | [Agent SDK](docs/feature-015-agent-sdk.md)                          | Agent 创建、任务执行、调度、上下文    |
| FEAT-016 | [Sub-agents 子代理](docs/feature-016-sub-agents.md)                 | 任务分解、编排、Agent 注册中心        |
| FEAT-017 | [Hooks 钩子系统](docs/feature-017-hooks-system.md)                  | 生命周期钩子、事件拦截、中间件        |
| FEAT-018 | [Memory 记忆系统](docs/feature-018-memory-system.md)                | 三层记忆、上下文窗口、持久化          |
| FEAT-019 | [Skills 插件开发指南](docs/feature-019-skills-development.md)       | 插件开发教程、完整示例                |
| FEAT-020 | [Agent Runners](docs/feature-020-agent-runners.md)                  | 本机/远程/隔离执行层抽象              |
| FEAT-021 | [TUI/WebUI 标准功能接口](docs/feature-021-ui-frontend-interface.md) | 前后端统一契约、全量 stub、一致性审计 |

### 技术设计文档

| 文档                                            | 说明                                                     |
| ----------------------------------------------- | -------------------------------------------------------- |
| [数据流设计](docs/data-flow.md)                 | 请求流、事件流、工具执行流、工作流、存储流等完整数据流图 |
| [状态机规范](docs/state-machines.md)            | 10 个核心状态机：生命周期、插件、Agent、任务、工作流等   |
| [通信协议规范](docs/communication-protocols.md) | EventBus、AgentChannel、MessageQueue、跨包通信协议       |

### 用户指南

| 文档                                   | 说明                               |
| -------------------------------------- | ---------------------------------- |
| [CLI 参考手册](docs/cli-reference.md)  | CLI 命令、选项、子命令完整参考     |
| [配置参考](docs/configuration.md)      | 5 级配置覆盖、环境变量、配置项说明 |
| [常见工作流](docs/common-workflows.md) | 7 个完整使用工作流                 |
| [安全模型](docs/security-model.md)     | L1-L4 权限等级、操作矩阵           |
| [TUI 组件参考](docs/tui-components.md) | 终端 UI 组件 API 参考              |

### 开发者指南

| 文档                                  | 说明                             |
| ------------------------------------- | -------------------------------- |
| [开发指南](docs/development-guide.md) | 开发环境搭建、代码规范、贡献流程 |
| [测试指南](docs/testing-guide.md)     | 测试框架、编写测试、覆盖率       |
| [部署指南](docs/deployment.md)        | 构建、部署、运维                 |
| [故障排查](docs/troubleshooting.md)   | 8 类常见问题及解决方案           |
