# Task Document: Organic-Interface Enhanced Testing

## Metadata
- **Version**: 1.0.0
- **LastModified**: 2026-04-29
- **Author**: Planner
- **Description**: 为Organic-Interface项目创建更丰富的单元测试和集成测试，提升测试覆盖率
- **Project**: /workspaces/agent-workspace/projects/Organic-Interface/

---

## 1. 任务目标

### 1.1 主要目标
创建更丰富的单元测试和集成测试，提升Organic-Interface项目的测试覆盖率

### 1.2 具体目标
- [ ] 修复vitest.config.ts配置，将storage包测试纳入测试范围
- [ ] 为agent包创建完整的单元测试（33个源文件）
- [ ] 为tools包创建完整的单元测试（11个源文件）
- [ ] 为ui包创建完整的单元测试（12个源文件）
- [ ] 验证所有测试通过

---

## 2. 项目现状分析

### 2.1 技术栈
- **语言**: TypeScript
- **测试框架**: Vitest v1.4.0
- **覆盖率工具**: @vitest/coverage-v8
- **构建工具**: Turborepo (monorepo)
- **Node版本**: >=18.0.0

### 2.2 测试文件分布

| 包名 | 源文件数 | 测试文件数 | 覆盖率状态 |
|------|---------|-----------|-----------|
| kernel | ~10 | 5 | 已有测试 |
| plugins | ~20+ | 6+ | 部分覆盖 |
| utils | ~5 | 1 | 已有测试 |
| storage | ~10 | 2 | 有测试但未配置 |
| **agent** | **33** | **0** | **完全无测试** |
| **tools** | **11** | **0** | **完全无测试** |
| **ui** | **12** | **0** | **完全无测试** |

### 2.3 发现的问题

#### 问题1: storage包测试未纳入vitest配置
- **文件**: `/workspaces/agent-workspace/projects/Organic-Interface/vitest.config.ts`
- **问题**: vitest.config.ts的include数组中缺少storage包的测试路径
- **影响**: storage包的测试不会被执行

#### 问题2: agent包完全无测试
- **源文件**: 33个TypeScript文件
- **模块**: communication, context, core, orchestration, registry, scheduler, workflow
- **风险**: 核心agent逻辑无测试保护

#### 问题3: tools包完全无测试
- **源文件**: 11个TypeScript文件
- **模块**: executor, services, builtin
- **风险**: 工具执行逻辑无测试保护

#### 问题4: ui包完全无测试
- **源文件**: 12个TypeScript文件
- **模块**: core, cli, components
- **风险**: UI组件逻辑无测试保护

---

## 3. 任务范围

### 3.1 涉及文件

#### 需要修改的配置文件
- `vitest.config.ts` - 添加storage包测试路径

#### 需要创建的测试文件

**agent包 (33个源文件)**:
- `packages/agent/src/communication/__tests__/AgentChannel.test.ts`
- `packages/agent/src/communication/__tests__/AgentMessage.test.ts`
- `packages/agent/src/communication/__tests__/MessageQueue.test.ts`
- `packages/agent/src/context/__tests__/ContextManager.test.ts`
- `packages/agent/src/context/__tests__/Message.test.ts`
- `packages/agent/src/context/__tests__/services/ContextService.test.ts`
- `packages/agent/src/context/__tests__/services/ContextWindowManager.test.ts`
- `packages/agent/src/core/__tests__/Agent.test.ts`
- `packages/agent/src/core/__tests__/AgentConfig.test.ts`
- `packages/agent/src/core/__tests__/AgentState.test.ts`
- `packages/agent/src/registry/__tests__/AgentRegistry.test.ts`
- `packages/agent/src/registry/__tests__/AgentMetadata.test.ts`
- `packages/agent/src/scheduler/__tests__/TaskQueue.test.ts`
- `packages/agent/src/scheduler/__tests__/TaskScheduler.test.ts`
- `packages/agent/src/workflow/__tests__/models/Task.test.ts`
- `packages/agent/src/workflow/__tests__/models/Workflow.test.ts`
- `packages/agent/src/workflow/__tests__/engine/WorkflowEngine.test.ts`
- `packages/agent/src/workflow/__tests__/engine/WorkflowExecutor.test.ts`
- `packages/agent/src/orchestration/__tests__/ExecutionCoordinator.test.ts`
- `packages/agent/src/orchestration/__tests__/OrchestrationLayer.test.ts`

**tools包 (11个源文件)**:
- `packages/tools/src/executor/__tests__/ToolExecutor.test.ts`
- `packages/tools/src/executor/__tests__/ToolContext.test.ts`
- `packages/tools/src/services/__tests__/ToolService.test.ts`
- `packages/tools/src/services/__tests__/BuiltinToolService.test.ts`
- `packages/tools/src/builtin/__tests__/FileTool.test.ts`
- `packages/tools/src/builtin/__tests__/ShellTool.test.ts`
- `packages/tools/src/builtin/__tests__/SearchTool.test.ts`

**ui包 (12个源文件)**:
- `packages/ui/src/core/__tests__/UIAgent.test.ts`
- `packages/ui/src/core/__tests__/UIOperation.test.ts`
- `packages/ui/src/core/__tests__/Sandbox.test.ts`
- `packages/ui/src/cli/__tests__/Command.test.ts`
- `packages/ui/src/cli/__tests__/CommandParser.test.ts`
- `packages/ui/src/cli/__tests__/CLI.test.ts`
- `packages/ui/src/components/__tests__/Prompt.test.ts`
- `packages/ui/src/components/__tests__/Table.test.ts`
- `packages/ui/src/components/__tests__/Progress.test.ts`

### 3.2 执行分支

#### 成功路径
- 所有测试文件创建完成
- vitest.config.ts正确更新
- 所有测试通过 `pnpm test`

#### 失败路径
- 测试运行失败 - 记录失败用例，修复后重新执行
- 依赖问题 - 检查node_modules完整性，必要时重新安装

---

## 4. 验收标准

### 4.1 配置修复
- [ ] `vitest.config.ts` include数组包含 `packages/storage/src/__tests__/*.test.ts`

### 4.2 agent包测试
- [ ] 创建至少15个测试文件
- [ ] 覆盖Agent, AgentConfig, AgentState, AgentRegistry, TaskQueue, TaskScheduler等核心类
- [ ] 每个测试文件至少5个测试用例
- [ ] 所有测试通过

### 4.3 tools包测试
- [ ] 创建至少5个测试文件
- [ ] 覆盖ToolExecutor, ToolService, BuiltinToolService等核心类
- [ ] 每个测试文件至少5个测试用例
- [ ] 所有测试通过

### 4.4 ui包测试
- [ ] 创建至少6个测试文件
- [ ] 覆盖UIAgent, UIOperation, CLI, CommandParser等核心类
- [ ] 每个测试文件至少5个测试用例
- [ ] 所有测试通过

### 4.5 整体验收
- [ ] `pnpm test` 执行成功，无失败用例
- [ ] 测试覆盖率显著提升

---

## 5. 风险评估

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| 测试代码与源代码接口不匹配 | 中 | 高 | 先读取源代码，分析接口后再编写测试 |
| 部分模块依赖复杂难以隔离 | 中 | 中 | 使用Vitest的mock功能模拟依赖 |
| 时间估计偏差 | 低 | 低 | 分批执行，逐步验收 |

---

## 6. 执行计划

### Phase 1: 配置修复
1. 修改 `vitest.config.ts`，添加storage测试路径

### Phase 2: agent包测试
1. 分析agent包源代码结构
2. 创建communication模块测试
3. 创建context模块测试
4. 创建core模块测试
5. 创建registry模块测试
6. 创建scheduler模块测试
7. 创建workflow模块测试
8. 创建orchestration模块测试

### Phase 3: tools包测试
1. 分析tools包源代码结构
2. 创建executor模块测试
3. 创建services模块测试
4. 创建builtin模块测试

### Phase 4: ui包测试
1. 分析ui包源代码结构
2. 创建core模块测试
3. 创建cli模块测试
4. 创建components模块测试

### Phase 5: 整体验证
1. 运行 `pnpm test` 验证所有测试
2. 检查测试覆盖率

---

---

## 最终状态

- **归档时间**: 2026-05-02
- **归档原因**: 问题已被后续任务修复（task-P1-001-improve-test-coverage.md）
- **最终状态**: 已完成 (archived)
