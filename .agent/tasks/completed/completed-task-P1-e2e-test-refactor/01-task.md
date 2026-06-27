# task-E2E-FIX-20260524

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-E2E-FIX-20260524 |
| **任务类型** | code-modification |
| **优先级** | P1 |
| **标题** | e2e-test-refactor |
| **描述** | 将E2E测试从Playwright重构为vitest直接import测试 |
| **依赖任务** | 无 |
| **可并行** | 否 |
| **创建时间** | 2026-05-24 |
| **执行分支** | agent-develop |
| **工作分支** | wt/e2e-fix/refactor-to-vitest |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |
| **Worktree路径** | /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-fix-20260524/ |

---

## 1. 任务背景

### 1.1 项目现状

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 单元测试框架 | ✓ Vitest 1.4.0 | 已有配置，覆盖多个包 |
| E2E测试框架 | ✗ Playwright | 项目是库/包系统，无HTTP服务器，Playwright不适合 |
| 跨包集成测试 | ✗ 不存在 | 当前E2E测试依赖Web UI，无法真实测试跨包集成 |
| 测试运行命令 | pnpm test | vitest运行正常 |

### 1.2 问题描述

当前E2E测试（`e2e/*.spec.ts`）使用Playwright测试Web UI，但Organic-Interface项目是**库/包系统**（monorepo结构，包含kernel、plugins、agent、storage等包），没有HTTP服务器。这种设计存在以下问题：

1. **架构不匹配**：Playwright用于浏览器自动化测试，适合Web应用；项目是库系统，应该用单元测试方式验证
2. **跨包集成无法验证**：Playwright只能测试UI层面，无法直接验证包之间的import集成
3. **依赖不必要的服务**：Playwright需要启动dev服务器，增加了测试复杂度
4. **测试目标错误**：需要测试的是包之间的接口调用，不是UI交互

### 1.3 解决方案

将Playwright E2E测试重构为**vitest直接import测试**：
- 删除`playwright.config.ts`
- 将`e2e/*.spec.ts`改为vitest测试格式
- 使用`import`直接测试跨包集成
- 保持相同的测试场景覆盖（Kernel生命周期、插件系统、Agent调度）

---

## 2. 任务目标

### 2.1 核心目标

1. **删除Playwright配置**：移除`playwright.config.ts`
2. **重构E2E测试**：将`e2e/*.spec.ts`从Playwright格式改为vitest格式
3. **验证跨包集成**：使用直接import测试包之间接口

### 2.2 测试重构对照表

| 原Playwright测试 | 目标vitest测试 | 测试方式 |
|-----------------|----------------|----------|
| agent-scheduling.spec.ts | 导入kernel/agent包测试调度逻辑 | 直接import + 函数调用 |
| kernel-lifecycle.spec.ts | 导入kernel包测试生命周期 | 直接import + 状态验证 |
| plugin-system.spec.ts | 导入plugins包测试插件系统 | 直接import + 插件注册验证 |

### 2.3 验收标准

- [ ] 删除 `/workspaces/agent-workspace/projects/Organic-Interface/playwright.config.ts`
- [ ] 重构 `e2e/agent-scheduling.spec.ts` 为vitest格式
- [ ] 重构 `e2e/kernel-lifecycle.spec.ts` 为vitest格式
- [ ] 重构 `e2e/plugin-system.spec.ts` 为vitest格式
- [ ] 更新 `vitest.config.ts` 的include配置，添加e2e测试路径
- [ ] 从 `package.json` 中移除 `@playwright/test` 依赖
- [ ] 运行 `pnpm test` 验证测试通过
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
git worktree add /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-fix-20260524 -b wt/e2e-fix/refactor-to-vitest agent-develop
```

---

### 阶段 1：删除Playwright配置

**步骤 1.1：删除playwright.config.ts**

- 文件：`/workspaces/agent-workspace/worktrees/Organic-Interface/e2e-fix-20260524/playwright.config.ts`
- 操作：delete

---

### 阶段 2：重构E2E测试文件

**步骤 2.1：重构agent-scheduling.spec.ts**

- 文件：`/workspaces/agent-workspace/worktrees/Organic-Interface/e2e-fix-20260524/e2e/agent-scheduling.spec.ts`
- 操作：modify
- 重构内容：
  - 将`import { test, expect } from '@playwright/test'`改为`import { describe, it, expect } from 'vitest'`
  - 将`async ({ page }) => { await page.goto('/'); ... }`改为直接调用包函数测试

**步骤 2.2：重构kernel-lifecycle.spec.ts**

- 文件：`/workspaces/agent-workspace/worktrees/Organic-Interface/e2e-fix-20260524/e2e/kernel-lifecycle.spec.ts`
- 操作：modify
- 重构内容：同上模式

**步骤 2.3：重构plugin-system.spec.ts**

- 文件：`/workspaces/agent-workspace/worktrees/Organic-Interface/e2e-fix-20260524/e2e/plugin-system.spec.ts`
- 操作：modify
- 重构内容：同上模式

---

### 阶段 3：更新vitest配置

**步骤 3.1：更新vitest.config.ts**

- 文件：`/workspaces/agent-workspace/worktrees/Organic-Interface/e2e-fix-20260524/vitest.config.ts`
- 操作：modify
- 修改内容：在include数组中添加`'e2e/**/*.test.ts'`

---

### 阶段 4：更新package.json

**步骤 4.1：移除Playwright依赖**

- 文件：`/workspaces/agent-workspace/worktrees/Organic-Interface/e2e-fix-20260524/package.json`
- 操作：modify
- 修改内容：从devDependencies中移除`@playwright/test`

---

### 阶段 5：验证测试

**步骤 5.1：运行vitest**

```bash
cd /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-fix-20260524
pnpm install
pnpm test
```

---

### 阶段 6：Git提交（Reviewer执行）

**步骤 6.1：提交变更**

```bash
cd /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-fix-20260524
git add -A
git commit -m "refactor(e2e): migrate from Playwright to vitest direct import tests

- Remove playwright.config.ts (no longer needed for library/package system)
- Refactor e2e/*.spec.ts to use vitest with direct import testing
- Test cross-package integration via direct module import
- Remove @playwright/test dependency

Closes task-E2E-FIX-20260524"
```

**步骤 6.2：合并到agent-develop**

```bash
cd /workspaces/agent-workspace/projects/Organic-Interface
git checkout agent-develop
git merge wt/e2e-fix/refactor-to-vitest --no-edit
```

**步骤 6.3：清理worktree**

```bash
git worktree remove /workspaces/agent-workspace/worktrees/Organic-Interface/e2e-fix-20260524
git branch -D wt/e2e-fix/refactor-to-vitest
```

---

## 4. 文件操作清单

| 文件路径 | 操作类型 | 说明 |
|----------|----------|------|
| `playwright.config.ts` | delete | Playwright配置不再需要 |
| `e2e/agent-scheduling.spec.ts` | modify | 改为vitest格式 |
| `e2e/kernel-lifecycle.spec.ts` | modify | 改为vitest格式 |
| `e2e/plugin-system.spec.ts` | modify | 改为vitest格式 |
| `vitest.config.ts` | modify | 添加e2e测试路径 |
| `package.json` | modify | 移除@playwright/test |

---

## 5. 风险与注意事项

1. **架构适配风险**：原Playwright测试依赖UI选择器（如`[data-testid="..."]`），重构后需要改为直接测试包API
2. **测试覆盖度**：确保重构后的测试仍然覆盖核心场景（Kernel生命周期、插件系统、Agent调度）
3. **包导出验证**：需要确认各包有正确的export才能直接import测试

---

## Planner执行记录

- [x] 阶段0：任务文档骨架创建完成
- [x] 阶段1：完成项目分析和方案设计
- [x] 阶段2：文件操作清单已确定
- [x] 阶段3：任务文档已提交等待审核

## 归档状态

| 字段 | 内容 |
|------|------|
| **归档时间** | 2026-05-24 |
| **归档操作** | 重命名pending目录为completed目录 |
| **任务状态** | 已完成 |

---

## Reviewer审核记录

等待审核

---

## Coder执行记录

等待执行