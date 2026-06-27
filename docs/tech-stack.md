# 技术选型文档

## 基本信息

**文档类型**: 技术规格
**创建日期**: 2026-04-15
**版本**: 1.0.0
**状态**: 已确定

---

## 技术选型概述

Organic-Interface项目基于Node.js运行时环境开发，采用TypeScript作为主导编程语言，使用LiteLLM作为AI模型的统一接口。项目采用Monorepo多模块架构组织代码结构，通过pnpm和Turborepo实现高效的包管理和构建流程。

**核心技术栈**：Node.js 18+ / TypeScript 5.x / LiteLLM / pnpm / Turborepo

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

## AI模型集成

### LiteLLM

**版本**: latest（v1.x）

**选择理由**：

- 支持对接多种大语言模型提供商（OpenAI、Anthropic、Azure等）
- 提供统一的API调用接口，简化多模型切换
- 支持流式输出和函数调用
- 完善的错误处理和重试机制
- 支持代理和自定义端点配置

**应用场景**：

- 作为Plugin的AI能力底座
- 统一的模型调用接口
- 多模型负载均衡
- 模型响应缓存

**配置方式**：

```typescript
import { litellm } from 'litellm';

// 配置API密钥
litellm.setKey('your-api-key');

// 调用模型
const response = await litellm.completion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

**支持的模型提供商**：

- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Azure OpenAI
- 本地模型（Ollama等）

---

## 包管理和构建工具

### pnpm

**版本**: 8.x

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
- pnpm add <pkg> - 添加依赖
- pnpm --filter <pkg> - 针对特定包执行命令
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

**已定义包**：

- @organic/utils - 共享类型和工具
- @organic/kernel - 核心引擎
- @organic/plugins - Plugin系统
- @organic/tools - 工具服务
- @organic/agent - Agent调度

---

## 数据库和缓存

### SQLite（默认）

**选择理由**：

- 零配置，开箱即用
- 单文件数据库，便于部署
- 性能足够，支持大部分场景
- 便于数据迁移和备份

**使用场景**：

- 项目配置存储
- Plugin元数据存储
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

**选型**: pino

**选择理由**：

- 高性能JSON日志
- 结构化日志输出
- 低开销异步日志
- 支持日志传输协议

### 配置管理

**选型**: zod + dotenv

**选择理由**：

- zod提供运行时配置验证
- dotenv提供环境变量加载
- 类型安全的配置访问

### 测试框架

**选型**: Vitest

**选择理由**：

- 兼容Jest API，易于迁移
- 极快的测试执行速度
- 原生TypeScript支持
- 开箱即用的ESM支持

### 代码格式化

**选型**: Prettier + ESLint

**配置**：

- Prettier处理代码格式化
- ESLint处理代码检查
- 统一2空格缩进
- 单引号字符串
- 不加分号

---

## 环境配置要求

### 开发环境

**Node.js**: 20.x（推荐）或 18.x（最低）

**pnpm**: 8.x

**操作系统**: macOS / Linux / Windows (WSL2)

**推荐工具**：

- VSCode + TypeScript插件
- Zsh + oh-my-zsh
- Git

### 构建环境

**Node.js**: 20.x LTS

**pnpm**: 8.x

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

### 核心依赖

| 类别     | 选择    | 版本 | 说明                     |
| -------- | ------- | ---- | ------------------------ |
| AI集成   | LiteLLM | 1.x  | 多模型统一接口           |
| 日志     | pino    | 8.x  | 高性能日志库             |
| 配置验证 | zod     | 3.x  | TypeScript优先schema验证 |
| 环境变量 | dotenv  | 16.x | 环境变量加载             |

### 构建和工具

| 类别       | 选择      | 版本 | 说明               |
| ---------- | --------- | ---- | ------------------ |
| 包管理     | pnpm      | 8.x  | 高效的包管理器     |
| 构建编排   | Turborepo | 2.x  | 增量构建工具       |
| 代码检查   | ESLint    | 8.x  | JavaScript代码检查 |
| 代码格式化 | Prettier  | 3.x  | 代码格式化         |
| 测试框架   | Vitest    | 1.x  | 快速测试框架       |

### 数据库

| 类别       | 选择       | 版本 | 说明             |
| ---------- | ---------- | ---- | ---------------- |
| 默认数据库 | SQLite     | 3.x  | 零配置数据库     |
| 生产数据库 | PostgreSQL | 15.x | 可选高性能数据库 |
| 缓存       | Redis      | 7.x  | 可选缓存层       |

---

## 相关文档

- feature-013-monorepo-architecture.md - Monorepo架构设计
- feature-006-plugin-spec.md - Plugin插件系统架构
- requirements.md - 需求规格说明
