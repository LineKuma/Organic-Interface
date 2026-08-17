# 任务文档：工作流引擎

## 基本信息

- **任务ID**: task-P1-103-workflow-engine
- **优先级**: P1
- **创建日期**: 2026-04-15
- **状态**: completed
- **执行者**: Coder
- **对应需求**: feature-009-workflow-engine.md

## 任务概述

实现 Organic-Interface 的工作流引擎，提供业务流程自动化编排能力，支持串行、并行、条件分支、循环等多种执行模式。

## 输入文件

- `/workspaces/agent-workspace/projects/Organic-Interface/docs/feature-009-workflow-engine.md`

## 输出文件

### 新建文件

1. **Task 模型**
   - 路径: `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/workflow/models/Task.ts`
   - 描述: 任务定义和执行记录模型

2. **Workflow 模型**
   - 路径: `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/workflow/models/Workflow.ts`
   - 描述: 工作流定义、执行记录、边定义模型

3. **WorkflowExecutor 执行器**
   - 路径: `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/workflow/engine/WorkflowExecutor.ts`
   - 描述: 任务执行器，处理单个任务执行、超时、重试

4. **WorkflowEngine 引擎**
   - 路径: `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/workflow/engine/WorkflowEngine.ts`
   - 描述: 工作流编排引擎，管理整体执行流程

5. **模块导出文件**
   - `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/workflow/models/index.ts`
   - `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/workflow/engine/index.ts`
   - `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/workflow/index.ts`

### 修改文件

- `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/index.ts`

## 实现内容

### 1. Task 模型

- `TaskStatus` 枚举: PENDING, RUNNING, COMPLETED, FAILED, SKIPPED, CANCELLED, TIMEOUT, RETRYING
- `TaskType` 枚举: TASK, CONDITION, PARALLEL, LOOP, SUBWORKFLOW, START, END, DELAY, MANUAL
- `RetryPolicy` 接口: 重试策略配置
- `TaskConfig` 接口: 任务配置、输入输出定义
- `ConditionExpression` 接口: 条件表达式
- `LoopConfig` 接口: 循环配置
- `ParallelConfig` 接口: 并行执行配置
- `TaskExecution` 接口: 任务执行记录
- 工具函数: `createTask`, `createTaskExecution`, `updateTaskExecution`, `canTaskRetry`, `calculateRetryInterval`

### 2. Workflow 模型

- `WorkflowStatus` 枚举: DRAFT, PUBLISHED, ARCHIVED
- `WorkflowExecutionStatus` 枚举: PENDING, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED
- `EdgeConditionType` 枚举: ALWAYS, ON_SUCCESS, ON_FAILURE, ON_COMPLETE, EXPRESSION
- `Workflow` 接口: 工作流定义（节点、边、配置）
- `WorkflowEdge` 接口: 边定义（source, target, condition）
- `WorkflowExecution` 接口: 执行记录
- `WorkflowExecutionSnapshot` 接口: 执行快照（用于恢复）
- 工具函数: `createWorkflow`, `createWorkflowEdge`, `createWorkflowExecution`, `isValidDAG`, `getTopologicalOrder`

### 3. WorkflowExecutor

- 任务执行（支持超时控制）
- 重试逻辑
- 错误处理
- 暂停/取消任务
- 事件发射

### 4. WorkflowEngine

- 工作流注册和管理
- 执行启动、暂停、恢复、取消
- 节点调度（基于依赖关系）
- 并行执行支持
- 执行快照和恢复
- 错误处理策略（fail-fast, continue, compensate）
- DAG 验证

## 验收标准

1. Task 和 Workflow 模型正确实现
2. WorkflowExecutor 支持任务执行和重试
3. WorkflowEngine 支持完整工作流编排
4. 支持串行和并行执行
5. 支持 DAG 验证和拓扑排序
6. 支持执行快照和恢复
7. 所有导出正确集成到主包

## Coder 执行记录

- **开始时间**: 2026-04-15
- **完成时间**: 2026-04-15
- **修改文件数**: 2
- **新建文件数**: 8
- **执行状态**: completed
