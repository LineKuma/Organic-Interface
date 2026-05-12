# 任务文档：上下文管理服务

## 基本信息

- **任务ID**: task-P1-102-context-service
- **优先级**: P1
- **创建日期**: 2026-04-15
- **状态**: completed
- **执行者**: Coder
- **对应需求**: feature-008-context-management.md

## 任务概述

实现 Organic-Interface 的上下文管理服务，提供对话上下文管理、状态管理、上下文窗口管理和上下文传播机制。

## 输入文件

- `/workspaces/agent-workspace/projects/Organic-Interface/docs/feature-008-context-management.md`
- `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/context/ContextManager.ts`
- `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/context/Message.ts`

## 输出文件

### 新建文件

1. **ContextItem 模型**
   - 路径: `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/context/models/ContextItem.ts`
   - 描述: 上下文条目模型，包含类型枚举、创建函数、更新函数等

2. **ContextWindowManager 服务**
   - 路径: `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/context/services/ContextWindowManager.ts`
   - 描述: 上下文窗口管理器，支持多种窗口类型、滑动窗口、窗口优化

3. **ContextService 服务**
   - 路径: `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/context/services/ContextService.ts`
   - 描述: 核心上下文服务，整合上下文管理、状态管理、执行栈和传播机制

4. **模块导出文件**
   - `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/context/models/index.ts`
   - `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/context/services/index.ts`

### 修改文件

- `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/context/index.ts`
- `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/index.ts`

## 实现内容

### 1. ContextItem 模型

- `ContextItemType` 枚举: MESSAGE, STATE, TOOL_CALL, RESULT, ATTACHMENT, CUSTOM
- `ContextItem` 接口: 包含 id, type, content, contextId, timestamps, metadata 等
- 创建函数: `createContextItem`, `createMessageContextItem`, `createStateContextItem` 等
- 工具函数: `updateContextItem`, `isContextItemExpired`, `touchContextItem`, `isValidContextItem`

### 2. ContextWindowManager

- `ContextWindowType` 枚举: RECENT_MESSAGES, RECENT_MINUTES, TOKEN_BASED, SEMANTIC_BASED
- `ContextWindowConfig` 接口: 窗口大小、类型、token 限制等配置
- `ContextWindow` 接口: 窗口数据结构和统计信息
- 功能:
  - 创建窗口
  - 滑动窗口（前进/后退）
  - 窗口优化（基于 token 限制）
  - 自动清理

### 3. ContextService

- 继承 ContextManager 功能
- 上下文项目（ContextItem）管理
- 执行上下文栈（嵌套调用支持）
- 上下文传播机制:
  - DIRECT: 直接传播完整上下文
  - REFERENCE: 仅传递引用
  - INCREMENTAL: 增量传播变化部分
  - HYBRID: 自动选择最优方式
- 自动清理机制

## 验收标准

1. ContextItem 模型正确导出所有类型和函数
2. ContextWindowManager 支持创建、滑动、优化窗口
3. ContextService 整合所有上下文管理功能
4. 支持上下文在多个 Agent 之间传播
5. 所有导出正确集成到主包

## Coder 执行记录

- **开始时间**: 2026-04-15
- **完成时间**: 2026-04-15
- **修改文件数**: 6
- **新建文件数**: 5
- **执行状态**: completed
