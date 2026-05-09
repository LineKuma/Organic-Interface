# Organic-Interface

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-blue.svg)](https://pnpm.js.org/)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)
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

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js 18+ |
| 语言 | TypeScript 5.4+ |
| 包管理 | pnpm 8+ |
| 构建工具 | Turborepo 1.13+ |
| 测试框架 | Vitest 1.4+ |

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

| 架构层 | 核心包 | 职责 |
|--------|--------|------|
| 内核层 | `@organic/kernel`, `@organic/utils` | 提供稳定、可靠、低延迟的底层功能 |
| 外围层 | `@organic/agent`, `@organic/plugins`, `@organic/tools` | 提供灵活、可扩展的交互和调度能力 |
| 自定义层 | `@organic/ui`, `@organic/storage` | 提供用户扩展和定制能力 |

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

| 模块 | 描述 | 依赖层级 |
|------|------|----------|
| `@organic/utils` | 共享类型定义和通用工具函数 | Level 0 (基础层) |
| `@organic/kernel` | Kernel 主逻辑、生命周期管理、Plugin 加载器 | Level 1 |
| `@organic/plugins` | Plugin 接口、PluginLoader、PluginRegistry | Level 2 |
| `@organic/tools` | 内置工具注册、工具执行、权限控制 | Level 2 |
| `@organic/agent` | Agent 接口、任务调度、上下文管理 | Level 3 |
| `@organic/ui` | 命令行界面、Web 界面实现 | Level 4 (最高) |

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

### 安装步骤

```bash
# 克隆项目
git clone <repository-url>
cd organic-interface

# 安装依赖
pnpm install
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

更多信息请参考以下文档：

- [架构设计文档](docs/architecture.md)
- [Plugin 系统规范](docs/feature-006-plugin-spec.md)
- [Monorepo 架构设计](docs/feature-013-monorepo-architecture.md)
- [Agent 架构设计](docs/feature-001-agent-architecture.md)