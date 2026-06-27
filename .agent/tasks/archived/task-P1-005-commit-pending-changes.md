# Task Document: Organic-Interface Commit Pending Changes

## Metadata
- **Version**: 1.0.0
- **LastModified**: 2026-04-29
- **Author**: Planner
- **Description**: 提交Organic-Interface项目的所有待提交更改，包括测试文件、配置更新和文档整理
- **Project**: /workspaces/agent-workspace/projects/Organic-Interface/

## 归档信息
- **归档时间**: 2026-04-30
- **归档原因**: Git状态为clean，与任务描述不符（任务声称有待提交更改）
- **当前状态**: 已归档，无需执行

---

## 1. 任务目标

### 1.1 主要目标
提交项目所有待提交更改，确保代码库状态一致

### 1.2 具体目标
- [ ] 清理core dump文件
- [ ] 提交修改的storage测试文件
- [ ] 提交修改的vitest.config.ts
- [ ] 提交所有新创建的测试文件(agent/tools/ui包)
- [ ] 更新task-P1-001-organic-enhanced-testing.md状态
- [ ] 删除stale task文档
- [ ] 确保提交信息清晰描述变更内容

---

## 2. 当前状态分析

### 2.1 Git状态
```
未提交更改:
- M vitest.config.ts (添加了agent/tools/ui/storage测试路径)
- M packages/storage/src/__tests__/*.test.ts (2个文件修改)
- ?? packages/agent/src/*/__tests__/*.test.ts (大量新测试文件)
- ?? packages/tools/src/*/__tests__/*.test.ts (大量新测试文件)
- ?? packages/ui/src/*/__tests__/*.test.ts (大量新测试文件)
- ?? coverage/ (覆盖率报告)
- ?? core.75931 (core dump文件,需清理)

Stale task文档:
- D .agent/tasks/active/task-P1-002-run-tests.md
- D .agent/tasks/pending/task-P1-004-agent-scheduling-framework.md
```

### 2.2 测试状态
- 42个测试文件
- 1014个测试全部通过
- vitest.config.ts已正确配置

---

## 3. 任务范围

### 3.1 需要清理的文件
- `core.75931` - core dump文件

### 3.2 需要提交的文件

**配置修改:**
- `vitest.config.ts`

**测试文件修改:**
- `packages/storage/src/__tests__/DatabaseStorage.test.ts`
- `packages/storage/src/__tests__/StorageService.test.ts`

**新测试文件 (agent包):**
- `packages/agent/src/core/__tests__/`
- `packages/agent/src/orchestration/__tests__/`
- `packages/agent/src/registry/__tests__/`
- `packages/agent/src/scheduler/__tests__/`
- `packages/agent/src/workflow/__tests__/`

**新测试文件 (tools包):**
- `packages/tools/src/builtin/__tests__/`
- `packages/tools/src/executor/__tests__/`
- `packages/tools/src/services/__tests__/`

**新测试文件 (ui包):**
- `packages/ui/src/cli/__tests__/`
- `packages/ui/src/components/__tests__/`
- `packages/ui/src/core/__tests__/`

### 3.3 需要更新的文档
- `.agent/tasks/pending/task-P1-001-organic-enhanced-testing.md` - 更新为完成状态

### 3.4 需要删除的stale文档
- `.agent/tasks/active/task-P1-002-run-tests.md`
- `.agent/tasks/pending/task-P1-004-agent-scheduling-framework.md`

---

## 4. 验收标准

- [ ] `core.75931`文件已删除
- [ ] 所有修改的测试文件已提交
- [ ] vitest.config.ts已提交
- [ ] 所有新测试文件已提交
- [ ] task文档已正确整理
- [ ] `git status`显示clean状态

---

## 5. 执行步骤

### Step 1: 清理core dump
```bash
rm -f core.75931
```

### Step 2: 暂存所有更改
```bash
git add -A
```

### Step 3: 提交更改
```bash
git commit -m "test(organic): add comprehensive tests for agent, tools, and ui packages

- Add vitest configuration for storage, agent, tools, ui packages
- Add agent package tests: core, orchestration, registry, scheduler, workflow
- Add tools package tests: executor, services, builtin modules
- Add ui package tests: core, cli, components modules
- Fix storage tests to be more robust
- All 1014 tests passing
"
```

### Step 4: 验证状态
```bash
git status
```

---

## 6. 风险评估

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 无重大风险 | - | - | 纯提交操作 |

---

## 7. 参考信息

- 测试运行: `pnpm test` (通过)
- 分支: `agent-develop`