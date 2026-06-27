# Task: Cleanup Stale Task Documents and Project Review

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P2-001-stale-tasks-cleanup |
| **优先级** | P2 |
| **标题** | stale-tasks-cleanup |
| **描述** | 清理过期的pending任务文档，更新项目状态并规划下一步工作 |
| **依赖任务** | 无 |
| **可并行** | 是 |
| **创建时间** | 2026-05-02 |
| **执行分支** | agent-develop |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |

---

## 任务背景

### 问题描述

在审查 Organic-Interface 项目时，发现 `.agent/tasks/pending/` 目录中存在 **3 个过期的任务文档**，但项目当前状态表明这些问题已经解决：

| 任务文档 | 记录的问题 | 当前状态 |
|---------|-----------|---------|
| task-P0-002-fix-typescript-errors-in-core-conversation.md | core-conversation 包 TypeScript 错误 | ✅ `pnpm --filter @organic/plugins typecheck` 通过 |
| task-P0-003-fix-typescript-errors-in-agent-package.md | agent 包 TypeScript 错误（91个） | ✅ `pnpm --filter @organic/agent typecheck` 通过 |
| task-P1-001-improve-test-coverage.md | 测试覆盖率 74.35% → 85% | ✅ 已完成（当前 ~80%）|

### 根本原因分析

1. **任务状态管理失误**：之前的 Coder 执行了修复工作并记录在任务文档中，但任务文档未被移动到 `completed/` 目录
2. **信息不同步**：pending 目录中的任务状态与实际项目状态不一致
3. **缺少清理机制**：过期任务文档长期占用 pending 目录

---

## 任务内容

### 1. 验证项目当前状态

**执行验证命令**：
```bash
# TypeScript 类型检查
cd /workspaces/agent-workspace/projects/Organic-Interface
pnpm --filter @organic/plugins typecheck
pnpm --filter @organic/agent typecheck
pnpm --filter @organic/kernel typecheck
pnpm --filter @organic/ui typecheck
pnpm --filter @organic/storage typecheck
pnpm --filter @organic/utils typecheck

# 构建验证
pnpm build

# 测试验证
pnpm test
```

**预期结果**：
- 所有包的 typecheck 通过（无错误输出）
- 构建成功（7/7 packages）
- 测试 100% 通过（1427 tests）

### 2. 分析 pending 目录任务

**任务清单分析**：

#### task-P0-002-fix-typescript-errors-in-core-conversation.md
- **记录问题**：38 个 TypeScript 类型错误在 core-conversation 测试文件
- **Coder 记录**：显示执行了修复（无详细记录）
- **Reviewer 记录**：无审核记录
- **当前状态**：问题已解决（plugins 包 typecheck 通过）
- **建议操作**：移动到 completed/

#### task-P0-003-fix-typescript-errors-in-agent-package.md  
- **记录问题**：91 个 TypeScript 类型错误在 agent 包测试文件
- **Coder 记录**：显示执行了修复（无详细记录）
- **Reviewer 记录**：无审核记录
- **当前状态**：问题已解决（agent 包 typecheck 通过）
- **建议操作**：移动到 completed/

#### task-P1-001-improve-test-coverage.md
- **记录问题**：测试覆盖率 74.35%，目标 85%+
- **Coder 记录**：已完成，新增测试用例，覆盖率提升到 80.31%
- **Reviewer 记录**：审核通过，修复了 2 个 TypeScript 错误
- **当前状态**：已完成
- **建议操作**：移动到 completed/

### 3. 移动过期任务到 completed/

**操作命令**：
```bash
cd /workspaces/agent-workspace/projects/Organic-Interface

# 移动过期任务
mv .agent/tasks/pending/task-P0-002-fix-typescript-errors-in-core-conversation.md .agent/tasks/completed/
mv .agent/tasks/pending/task-P0-003-fix-typescript-errors-in-agent-package.md .agent/tasks/completed/
mv .agent/tasks/pending/task-P1-001-improve-test-coverage.md .agent/tasks/completed/
```

### 4. 更新任务文档内容

在移动前，为每个任务文档添加：
- **过期原因**：项目状态已解决此问题
- **解决时间**：基于 git log 分析
- **最终状态**：标记为 OBSOLETE

### 5. 检查 failed 目录任务

**检查 failed 目录**：
- `task-P0-002-core-conversation-plugin-impl.md` - 原始实现任务被拒绝
- `task-P1-001-organic-enhanced-testing.md` - 测试任务失败

**分析**：
- 这些任务失败有历史原因，需要决定是否重新规划

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| `.agent/tasks/pending/task-P0-002-fix-typescript-errors-in-core-conversation.md` | 待清理的任务 |
| `.agent/tasks/pending/task-P0-003-fix-typescript-errors-in-agent-package.md` | 待清理的任务 |
| `.agent/tasks/pending/task-P1-001-improve-test-coverage.md` | 待清理的任务 |
| `packages/plugins/src/core-conversation/src/__tests__/*.test.ts` | 验证源文件 |
| `packages/agent/src/**/*.test.ts` | 验证源文件 |

---

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| `.agent/tasks/completed/task-P0-002-fix-typescript-errors-in-core-conversation.md` | 更新状态后的任务 |
| `.agent/tasks/completed/task-P0-003-fix-typescript-errors-in-agent-package.md` | 更新状态后的任务 |
| `.agent/tasks/completed/task-P1-001-improve-test-coverage.md` | 更新状态后的任务 |

---

## 验收标准

- [ ] 验证所有包的 TypeScript 类型检查通过
- [ ] 验证 pnpm build 构建成功
- [ ] 验证 pnpm test 测试 100% 通过
- [ ] 将 3 个过期任务移动到 completed/ 目录
- [ ] 每个移动的任务文档添加过期说明和最终状态
- [ ] 更新 git 提交记录清理结果

---

## 失败处理

1. **验证失败**：停止操作，报告具体哪个验证失败
2. **权限问题**：检查文件权限，确保可以移动
3. **冲突检测**：如果文件已在 completed/ 存在则跳过

---

## 后续工作建议（不包含在此任务中）

完成清理后，建议 Planner 重新评估 Organic-Interface 项目的下一步工作：

1. **覆盖率提升**：当前 80%，目标 85%，可继续优化
2. **文档完善**：feature-013 等核心文档需要更新以反映实现状态
3. **集成测试**：增加包间集成测试验证
4. **性能优化**：根据需求文档的性能要求进行优化

---

## 最终状态

| 状态 | 值 |
|------|-----|
| **最终状态** | COMPLETED |
| **完成时间** | 2026-05-02 |
| **归档原因** | 过期任务清理工作已完成，commit c818235 已归档相关任务文档 |
| **备注** | 本任务文档也需要归档，因为任务本身已完成 |

---

## 技术规范

- 操作范围：/workspaces/agent-workspace/projects/Organic-Interface/
- Git 分支：agent-develop
- 任务状态管理遵循 AGENTS_GENERAL.xml 规范