# 功能文档：Monorepo多模块架构设计

## 基本信息

**文档编号**: DOC-013
**所属模块**: 核心架构
**优先级**: P1
**创建日期**: 2026-04-15
**对应需求章节**: 3.1 技术选型要求

---

## 功能概述

Organic-Interface项目采用Monorepo多模块架构设计，将系统拆分为多个独立的功能模块，统一存放在单一代码仓库中管理。这种架构结合了多仓库的模块隔离优势和单仓库的代码共享便利，通过Turborepo作为构建编排工具，实现高效的增量构建和任务并行执行。

---

## 设计理念

### Monorepo架构目标

**代码共享与复用**：多个模块之间可以方便地共享类型定义、工具函数和公共代码，避免重复实现。

**一致的开发和测试体验**：所有模块使用统一的工具链、代码规范和测试框架，降低开发者的认知负担。

**简化的依赖管理**：所有依赖集中在根目录管理，版本一致性更容易保证。

**原子提交**：相关改动可以在一次提交中完成，确保模块间的版本一致性。

### 架构原则

**模块自治**：每个模块是独立的功能单元，有自己的package.json、源码目录和测试。

**明确依赖**：模块间的依赖关系必须明确声明，禁止循环依赖。

**接口隔离**：模块间通过导出的接口交互，隐藏内部实现细节。

**渐进式复杂度**：从简单模块到复杂模块，从基础模块到业务模块。

---

## 目录结构设计

### 顶层目录结构

```
organic-interface/
├── packages/              # 所有功能模块
│   ├── kernel/          # 核心引擎模块
│   ├── plugins/         # Plugin系统模块
│   ├── tools/           # 工具服务模块
│   ├── agent/           # Agent调度模块
│   ├── ui/              # 界面模块（可选）
│   └── utils/          # 共享类型和工具模块
├── scripts/             # 构建和维护脚本
├── docs/                # 项目文档
├── configs/             # 共享配置文件
├── package.json         # 根目录配置
├── pnpm-workspace.yaml  # pnpm workspace定义
├── turbo.json           # Turborepo配置
├── tsconfig.base.json   # 基础TypeScript配置
└── README.md            # 项目说明
```

### packages目录说明

**packages/kernel**：核心引擎模块，包含Kernel的主逻辑、生命周期管理、Plugin加载器等核心功能。

**packages/plugins**：Plugin系统模块，包含Plugin接口定义、Plugin管理器、Plugin Registry等。

**packages/tools**：工具服务模块，包含KernelToolService接口实现、工具注册与管理、权限控制等。

**packages/agent**：Agent调度模块，包含Agent接口、任务调度器、上下文管理器等。

**packages/ui**：界面模块（可选），包含命令行界面或Web界面的实现。

**packages/utils**：共享类型和工具模块，包含TypeScript类型定义、通用工具函数、日志格式化等，所有其他模块都依赖此模块。

---

## 模块定义

### 核心模块：kernel

**模块职责**：kernel是系统的核心引擎，负责整体架构的组织和协调。

**核心功能**：
- Kernel主进程和生命周期管理
- Plugin加载、初始化、卸载管理
- 系统配置管理和运行时信息提供
- 基础服务的初始化和协调

**依赖关系**：
- 依赖：shared
- 被依赖：plugins、tools、agent、ui

**导出接口**：
- Kernel主类
- KernelApi接口
- 生命周期钩子

```json
{
  "name": "@organic/kernel",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "dependencies": {
    "@organic/utils": "workspace:*"
  }
}
```

### 核心模块：plugins

**模块职责**：plugins模块实现Plugin系统的核心功能。

**核心功能**：
- PluginInterface接口定义
- PluginLoader动态加载器
- PluginRegistry注册表
- Plugin生命周期管理

**依赖关系**：
- 依赖：shared、kernel
- 被依赖：tools、agent

**导出接口**：
- PluginInterface
- PluginLoader
- PluginRegistry
- 生命周期类型定义

```json
{
  "name": "@organic/plugins",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@organic/utils": "workspace:*",
    "@organic/kernel": "workspace:*"
  }
}
```

### 核心模块：tools

**模块职责**：tools模块实现工具服务的核心功能。

**核心功能**：
- KernelToolService接口实现
- 内置工具注册（文件操作、搜索等）
- 工具权限控制
- 工具执行和结果标准化

**依赖关系**：
- 依赖：shared、kernel、plugins
- 被依赖：agent、ui

**导出接口**：
- KernelToolService
- ToolDefinition
- ToolResult
- 内置工具集

```json
{
  "name": "@organic/tools",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@organic/utils": "workspace:*",
    "@organic/kernel": "workspace:*",
    "@organic/plugins": "workspace:*"
  }
}
```

### 核心模块：agent

**模块职责**：agent模块实现任务调度和Agent协调功能。

**核心功能**：
- Agent接口和实现
- 任务队列和调度器
- 上下文管理
- 与Plugin的协作机制

**依赖关系**：
- 依赖：shared、kernel、plugins、tools
- 被依赖：ui

**导出接口**：
- Agent接口
- TaskScheduler
- ContextManager

```json
{
  "name": "@organic/agent",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@organic/utils": "workspace:*",
    "@organic/kernel": "workspace:*",
    "@organic/plugins": "workspace:*",
    "@organic/tools": "workspace:*"
  }
}
```

### 共享模块：utils

**模块职责**：utils模块存放所有模块共享的类型定义和工具函数。

**核心功能**：
- TypeScript类型定义和接口
- 通用工具函数
- 日志格式化
- 错误类型定义

**依赖关系**：
- 无依赖
- 被依赖：所有其他模块

**导出内容**：
- Config相关类型
- Plugin相关类型
- Tool相关类型
- 通用工具函数
- 日志工具

```json
{
  "name": "@organic/utils",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

---

## 依赖关系管理

### 依赖层级结构

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

**层级规则**：
- 只能依赖同层或下层模块
- 禁止循环依赖
- utils是基础层，所有模块都依赖它
- 层级越高，依赖越多，功能越具体

### 依赖声明规范

每个模块的package.json必须明确声明所有依赖：

**内部依赖**：使用workspace协议指向内部模块。
```json
"dependencies": {
  "@organic/utils": "workspace:*"
}
```

**外部依赖**：使用精确版本号或锁定版本范围。
```json
"dependencies": {
  "typescript": "^5.0.0"
}
```

**开发依赖**：仅在开发时需要的工具库。
```json
"devDependencies": {
  "@types/node": "^18.0.0"
}
```

### 循环依赖检测

使用Turborepo和TypeScript的工程化能力检测循环依赖：
- Turborepo的任务图分析可以检测模块间的依赖环
- TypeScript的noEmitOnError可以检测类型层面的循环依赖

---

## 构建配置

### Turborepo配置

**turbo.json配置**：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**", "tests/**"]
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["build"]
    }
  }
}
```

**构建流程**：
1. 首先构建shared模块（无内部依赖）
2. 然后构建kernel模块（依赖shared）
3. 接着并行构建plugins和tools（依赖shared和kernel）
4. 最后构建agent（依赖所有上游模块）
5. ui模块最后构建（依赖所有模块）

### TypeScript配置

**tsconfig.base.json（基础配置）**：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist"
  },
  "exclude": ["node_modules", "dist"]
}
```

**各模块的tsconfig.json继承基础配置**：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## 包管理方案

### pnpm Workspaces

**pnpm-workspace.yaml配置**：

```yaml
packages:
  - 'packages/*'
```

**优势**：
- 节省磁盘空间，相同的依赖只存储一份
- 严格的依赖隔离
- 快速的安装速度
- 原生的workspace协议支持

### 依赖安装命令

**安装所有依赖**：
```bash
pnpm install
```

**为单个模块添加依赖**：
```bash
pnpm --filter @organic/kernel add <package>
```

**为所有模块添加依赖**：
```bash
pnpm -r add <package>
```

**更新依赖**：
```bash
pnpm up
pnpm --filter @organic/kernel up <package>
```

---

## 共享代码管理

### 类型共享策略

**utils模块导出的类型**必须包含：
- 所有核心接口（KernelApi、PluginInterface、ToolService等）
- 所有数据传输对象（DTO）
- 所有枚举类型
- 所有配置类型

**使用示例**：
```typescript
// packages/tools/src/index.ts
import { PluginInterface, KernelApi } from '@organic/utils';

// 在utils中定义
// packages/utils/src/types/plugin.ts
export interface PluginInterface {
  initialize(context: PluginContext): Promise<InitializeResult>;
  execute(input: PluginInput): Promise<PluginOutput>;
  shutdown(): Promise<void>;
}
```

### 工具函数共享策略

**可共享的工具**：
- 日期时间处理函数
- 字符串处理函数
- 通用算法实现
- 日志格式化工具

**不可共享的工具**：
- 涉及具体业务逻辑的函数
- 依赖特定模块的函数
- 运行时上下文相关的函数

### 版本同步策略

**内部模块版本**：
- 所有内部模块使用相同的版本号
- 在根目录的package.json中管理版本
- 使用pnpm的workspace协议保持同步

**外部依赖版本**：
- 优先使用pnpm的strict peer dependencies
- 在根目录配置 resolutions 字段统一版本

---

## 构建和发布流程

### 开发流程

**启动开发模式**：
```bash
pnpm dev
```

**监视模式构建**：
```bash
pnpm --filter @organic/kernel --filter @organic/plugins watch
```

### 构建流程

**全量构建**：
```bash
pnpm build
```

**增量构建**（仅构建变更的模块）：
```bash
pnpm turbo build
```

### 测试流程

**运行所有测试**：
```bash
pnpm test
```

**运行单个模块测试**：
```bash
pnpm --filter @organic/kernel test
```

### 发布流程

**版本更新**：
```bash
pnpm version patch  # 或 minor, major
```

**发布到npm**：
```bash
pnpm publish --access public
```

---

## 验收条件

| 序号 | 验收项 | 验收标准 |
|------|--------|----------|
| 1 | 目录结构定义 | 明确定义packages/、scripts/、docs/等目录结构 |
| 2 | 模块划分 | 定义kernel、plugins、tools、agent、utils五个核心模块 |
| 3 | 依赖关系 | 定义模块间依赖关系和共享策略，无循环依赖 |
| 4 | 包管理 | 确定使用pnpm workspaces管理内部模块 |
| 5 | 构建配置 | 定义turbo.json配置实现增量构建 |
| 6 | 类型共享 | 所有模块共享的类型定义存放在utils模块 |
| 7 | 层级规范 | 模块依赖遵循层级规范，只能依赖下层模块 |
| 8 | 文档编号 | 文档编号为DOC-013，与feature系列保持一致 |

---

## 与现有功能的关系

### 与Plugin系统的协同

monorepo架构下的plugins模块是Plugin系统的核心载体。plugins模块定义了PluginInterface接口和PluginLoader加载器，kernel模块依赖plugins实现Plugin的生命周期管理。

### 与工具服务的协同

tools模块作为独立模块实现工具服务的核心功能。tools模块依赖kernel模块获取KernelApi接口，通过KernelToolService向其他模块提供服务。

### 与Agent架构的协同

agent模块位于依赖层级的高层，整合了kernel、plugins、tools的功能，提供完整的Agent调度能力。

---

## 术语定义

| 术语 | 定义 |
|------|------|
| Monorepo | 将多个项目或模块存放在单一代码仓库中管理的架构 |
| Workspace | pnpm的包管理机制，支持内部包之间的相互引用 |
| Turborepo | 增量构建工具，优化monorepo项目的构建性能 |
| 内部依赖 | 项目内部模块之间的依赖关系 |
| 外部依赖 | 项目与npm包之间的依赖关系 |
| 增量构建 | 仅构建变更模块及其下游依赖的构建方式 |

---

## 相关文档

- feature-006-plugin-spec.md - Plugin插件系统架构
- feature-007-tool-system.md - 工具调用服务系统
- feature-001-agent-architecture.md - Agent架构设计
- tech-stack.md - 技术选型文档
- requirements.md - 需求规格说明
