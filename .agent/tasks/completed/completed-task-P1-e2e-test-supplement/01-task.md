# task-E2E-SUPPLEMENT-20260524

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-E2E-SUPPLEMENT-20260524 |
| **任务类型** | code-modification |
| **优先级** | P1 |
| **标题** | e2e-test-supplement |
| **描述** | 补充Organic-Interface项目E2E测试覆盖范围 |
| **依赖任务** | 无 |
| **可并行** | 否 |
| **创建时间** | 2026-05-24 |
| **执行分支** | agent-develop |
| **工作分支** | wt/e2e-supplement/add-new-tests |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |
| **Worktree路径** | /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524/ |

---

## 1. 任务背景

### 1.1 当前E2E测试状态

| 文件 | 测试数 | 测试场景 |
|------|--------|----------|
| `e2e/kernel-lifecycle.test.ts` | 3 | 初始化/停止/重启 |
| `e2e/plugin-system.test.ts` | 3 | 加载/启用禁用/错误处理 |
| `e2e/agent-scheduling.test.ts` | 3 | 调度/并发/失败恢复 |
| **总计** | **9** | **全部通过** |

### 1.2 项目结构分析

Organic-Interface是monorepo结构，包含以下包：
- `@organic/kernel` - 内核模块
- `@organic/plugins` - 插件系统
- `@organic/agent` - Agent框架
- `@organic/storage` - 存储系统
- `@organic/tools` - 工具服务
- `@organic/ui` - UI组件
- `@organic/utils` - 工具库

### 1.3 补充测试需求（来自探索代理分析）

| 序号 | 建议测试场景 | 优先级 | 说明 |
|------|-------------|--------|------|
| 1 | 事件总线完整订阅链 | P1 | onEvent/onceEvent/offEvent |
| 2 | 工作流引擎和执行器 | P1 | workflow/engine/executor |
| 3 | Agent元数据注册表 | P1 | registry/AgentMetadata |
| 4 | 工具服务（内置工具执行） | P2 | tools/services |
| 5 | UI组件更多交互场景 | P2 | ui/components |

---

## 2. 任务目标

### 2.1 核心目标

1. 新增5个E2E测试文件，覆盖跨包集成场景
2. 保持与现有测试相同的质量标准（vitest + 直接import）
3. 验证所有新增测试通过

### 2.2 新增测试文件清单

| 文件路径 | 测试场景 | 依赖包 |
|----------|----------|--------|
| `e2e/event-bus.test.ts` | 事件总线订阅/取消订阅 | @organic/kernel |
| `e2e/workflow-engine.test.ts` | 工作流引擎创建/执行 | @organic/agent |
| `e2e/agent-registry.test.ts` | Agent元数据注册/查询 | @organic/agent |
| `e2e/tool-service.test.ts` | 内置工具注册/执行 | @organic/tools |
| `e2e/ui-interactions.test.ts` | UI组件交互测试 | @organic/ui |

### 2.3 验收标准

- [ ] 创建 `e2e/event-bus.test.ts` 测试onEvent/onceEvent/offEvent
- [ ] 创建 `e2e/workflow-engine.test.ts` 测试工作流引擎
- [ ] 创建 `e2e/agent-registry.test.ts` 测试Agent元数据注册表
- [ ] 创建 `e2e/tool-service.test.ts` 测试工具服务
- [ ] 创建 `e2e/ui-interactions.test.ts` 测试UI组件交互
- [ ] 运行 `pnpm test` 验证所有测试通过（12个原有 + 15个新增 = 27个）
- [ ] Reviewer合并到agent-develop分支
- [ ] 清理worktree和临时分支

---

## 3. 执行步骤

### 阶段 0：Worktree创建（Repo执行）

**步骤 0.1：创建Worktree**

```bash
cd /workspaces/agent-workspace/projects/Organic-Interface
git fetch origin
git checkout agent-develop
git pull origin agent-develop
git worktree add /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524 -b wt/e2e-supplement/add-new-tests agent-develop
```

**步骤 0.2：验证Worktree创建成功**

```bash
git worktree list
cd /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524
git status
```

---

### 阶段 1：创建事件总线测试

**步骤 1.1：创建e2e/event-bus.test.ts**

- 文件：`/workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524/e2e/event-bus.test.ts`
- 操作：create
- 测试内容：
  - onEvent：注册事件监听器，触发事件验证回调执行
  - onceEvent：注册单次事件监听器，验证只触发一次
  - offEvent：取消事件监听器，验证不再触发
  - 多事件监听器：验证多个监听器同时工作

---

### 阶段 2：创建工作流引擎测试

**步骤 2.1：创建e2e/workflow-engine.test.ts**

- 文件：`/workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524/e2e/workflow-engine.test.ts`
- 操作：create
- 测试内容：
  - 工作流引擎创建和初始化
  - 工作流任务执行和完成
  - 工作流任务失败和恢复
  - 多任务并发执行

---

### 阶段 3：创建Agent注册表测试

**步骤 3.1：创建e2e/agent-registry.test.ts**

- 文件：`/workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524/e2e/agent-registry.test.ts`
- 操作：create
- 测试内容：
  - Agent元数据注册
  - Agent元数据查询
  - Agent元数据更新
  - Agent元数据删除
  - 注册表状态验证

---

### 阶段 4：创建工具服务测试

**步骤 4.1：创建e2e/tool-service.test.ts**

- 文件：`/workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524/e2e/tool-service.test.ts`
- 操作：create
- 测试内容：
  - 内置工具注册
  - 内置工具执行
  - 工具执行结果验证
  - 工具执行失败处理

---

### 阶段 5：创建UI组件测试

**步骤 5.1：创建e2e/ui-interactions.test.ts**

- 文件：`/workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524/e2e/ui-interactions.test.ts`
- 操作：create
- 测试内容：
  - 组件状态管理
  - 组件事件处理
  - 组件渲染验证
  - 组件交互流程

---

### 阶段 6：验证所有测试

**步骤 6.1：安装依赖**

```bash
cd /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524
pnpm install
```

**步骤 6.2：运行测试**

```bash
cd /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524
pnpm test
```

**预期结果**：
- 通过27个测试（原9个 + 新18个）
- 无error级别日志
- 测试超时设置正确

---

### 阶段 7：Git提交（Reviewer执行）

**步骤 7.1：提交变更**

```bash
cd /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524
git add -A
git commit -m "test(e2e): supplement E2E test coverage

Add 5 new E2E test files:
- e2e/event-bus.test.ts: test onEvent/onceEvent/offEvent
- e2e/workflow-engine.test.ts: test workflow engine
- e2e/agent-registry.test.ts: test agent metadata registry
- e2e/tool-service.test.ts: test tool service
- e2e/ui-interactions.test.ts: test UI components

Total: 18 new tests (9 existing + 18 new = 27 passing tests

Closes task-E2E-SUPPLEMENT-20260524"
```

**步骤 7.2：合并到agent-develop**

```bash
cd /workspaces/agent-workspace/projects/Organic-Interface
git checkout agent-develop
git merge wt/e2e-supplement/add-new-tests --no-edit
```

**步骤 7.3：清理worktree**

```bash
git worktree remove /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-supplement-20260524
git branch -D wt/e2e-supplement/add-new-tests
```

---

## 4. 文件操作清单

| 文件路径 | 操作类型 | 说明 |
|----------|----------|------|
| `e2e/event-bus.test.ts` | create | 事件总线订阅链测试（约80行） |
| `e2e/workflow-engine.test.ts` | create | 工作流引擎测试（约100行） |
| `e2e/agent-registry.test.ts` | create | Agent注册表测试（约90行） |
| `e2e/tool-service.test.ts` | create | 工具服务测试（约80行） |
| `e2e/ui-interactions.test.ts` | create | UI组件测试（约90行） |

---

## 5. 测试代码规范

### 5.1 导入模式

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { AgentRegistry } from '@organic/agent/registry';
```

### 5.2 测试结构

```typescript
describe('TestScenario', () => {
  let kernel: Kernel;

  beforeEach(async () => {
    kernel = new Kernel({ config: { name: 'test', version: '1.0.0' } });
    await kernel.initialize();
  });

  afterEach(async () => {
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  it('should perform specific action', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### 5.3 质量标准

- 每个测试文件至少3个测试用例
- 每个测试用例必须包含Act和Assert
- 使用beforeEach/afterEach管理测试资源
- 清理状态避免测试间污染

---

## 6. 风险与注意事项

### 6.1 依赖风险

- 需要确认各包的导出接口是否稳定
- 需要确认测试的包内模块路径

### 6.2 环境风险

- 确保worktree中node_modules已正确链接
- 确保vitest配置包含新的测试文件

### 6.3 测试隔离

- 每个测试独立运行，不依赖其他测试
- 测试后清理资源，避免状态污染

---

## Planner执行记录

- [x] 阶段0：任务文档骨架创建完成
- [x] 阶段1：完成项目分析和方案设计
- [x] 阶段2：文件操作清单已确定
- [x] 阶段3：任务文档已提交等待审核
- [x] 阶段4：任务已归档完成

## Reviewer审核记录

- [x] 审核通过

## Coder执行记录

- [x] 阶段1-6：已完成所有E2E测试文件创建
- [x] 阶段7：Git提交和合并已完成
- [x] Worktree清理完成

---

## 归档信息

| 字段 | 内容 |
|------|------|
| **归档时间** | 2026-05-24 |
| **归档状态** | 已完成 |
| **目标分支** | agent-develop |
| **合并状态** | 已合并 |