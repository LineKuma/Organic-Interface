# task-FIX-20260524-organic-interface-playwright-deps

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-FIX-20260524 |
| **任务类型** | code-modification |
| **优先级** | P1 |
| **标题** | organic-interface-playwright-deps-fix |
| **描述** | 修复 E2E 测试框架依赖缺失问题 - 添加 @playwright/test 到 devDependencies |
| **依赖任务** | 无 |
| **可并行** | 否 |
| **创建时间** | 2026-05-24 |
| **执行分支** | agent-develop |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |

---

## 1. 任务背景

### 1.1 问题发现

| 检查项 | 状态 | 说明 |
|--------|------|------|
| playwright.config.ts 存在 | ✓ | 已创建配置文件 |
| E2E 测试文件存在 | ✓ | 3个测试文件已创建 |
| @playwright/test 在 package.json | ✗ | **缺失** - 这是问题根因 |
| E2E 测试可运行 | ✗ | 因依赖缺失无法运行 |

### 1.2 问题根因

commit `83db321` (feat(e2e): add Playwright E2E test framework and test suites) 创建了：
- `playwright.config.ts` - 配置文件
- `e2e/*.spec.ts` - 测试文件

但**遗漏**了：
- 未将 `@playwright/test` 添加到 `package.json` 的 `devDependencies`

### 1.3 影响范围

- E2E 测试无法执行 (`pnpm exec playwright test` 会失败)
- 开发者无法运行端到端测试验证功能

---

## 2. 任务目标

### 2.1 核心目标

1. **添加 @playwright/test 到 devDependencies**
2. **验证 playwright 包是否需要** (通常 @playwright/test 已足够)

### 2.2 验收标准

- [ ] 在 worktree 中修改 package.json 添加 @playwright/test
- [ ] package.json 的 devDependencies 包含 @playwright/test
- [ ] E2E 测试可通过 `pnpm exec playwright test` 执行
- [ ] 合并到 agent-develop 分支

---

## 3. 执行步骤

### 阶段 0：Worktree 创建

**步骤 0.1：创建 worktree**

```bash
cd /workspaces/agent-workspace/projects/Organic-Interface
git worktree add /workspaces/agent-workspace/worktrees/Organic-Interface/playwright-fix-20260524-001/ -b wt/fix/playwright-deps agent-develop
```

**步骤 0.2：验证 worktree 创建**

```bash
git worktree list
```

预期：新的 worktree 条目出现

---

### 阶段 1：修复依赖

**步骤 1.1：读取 package.json**

```bash
cat /workspaces/agent-workspace/worktrees/Organic-Interface/playwright-fix-20260524-001/package.json
```

**步骤 1.2：添加 @playwright/test 到 devDependencies**

修改 `package.json`，在 `devDependencies` 中添加：

```json
"@playwright/test": "^1.40.0"
```

**步骤 1.3：安装依赖**

```bash
cd /workspaces/agent-workspace/worktrees/Organic-Interface/playwright-fix-20260524-001
pnpm install
```

**步骤 1.4：验证安装**

```bash
pnpm exec playwright --version
```

预期：返回 Playwright 版本号

---

### 阶段 2：验证 E2E 测试

**步骤 2.1：运行 E2E 测试（dry-run 验证语法）**

```bash
cd /workspaces/agent-workspace/worktrees/Organic-Interface/playwright-fix-20260524-001
pnpm exec playwright test --dry-run
```

预期：测试文件可被识别，无 "module not found" 错误

---

### 阶段 3：合并与清理

**步骤 3.1：提交更改**

```bash
cd /workspaces/agent-workspace/projects/Organic-Interface
git add package.json
git commit -m "fix(e2e): add @playwright/test to devDependencies"
```

**步骤 3.2：合并到 agent-develop**

```bash
git checkout agent-develop
git merge wt/fix/playwright-deps
```

**步骤 3.3：删除临时分支和 worktree**

```bash
git branch -d wt/fix/playwright-deps
git worktree remove /workspaces/agent-workspace/worktrees/Organic-Interface/playwright-fix-20260524-001/
```

---

## 4. 文件清单

### 4.1 输入文件

| 文件路径 | 用途 |
|---------|------|
| `projects/Organic-Interface/package.json` | 需添加 @playwright/test 依赖 |

### 4.2 修改文件

| 文件路径 | 操作 | 内容 |
|---------|------|------|
| `worktree/.../package.json` | modify | 添加 @playwright/test 到 devDependencies |

---

## 5. 命令列表

### 5.1 创建 Worktree

```bash
cd /workspaces/agent-workspace/projects/Organic-Interface
git worktree add /workspaces/agent-workspace/worktrees/Organic-Interface/playwright-fix-20260524-001/ -b wt/fix/playwright-deps agent-develop
```

### 5.2 安装依赖

```bash
cd /workspaces/agent-workspace/worktrees/Organic-Interface/playwright-fix-20260524-001
pnpm add -D @playwright/test
```

### 5.3 验证 E2E 测试

```bash
cd /workspaces/agent-workspace/worktrees/Organic-Interface/playwright-fix-20260524-001
pnpm exec playwright test --dry-run
```

### 5.4 合并与清理

```bash
cd /workspaces/agent-workspace/projects/Organic-Interface
git checkout agent-develop
git merge wt/fix/playwright-deps
git branch -d wt/fix/playwright-deps
git worktree remove /workspaces/agent-workspace/worktrees/Organic-Interface/playwright-fix-20260524-001/
```

---

## 6. 失败处理

### 6.1 Worktree 创建失败

- 检查 git 仓库状态
- 确认 agent-develop 分支存在

### 6.2 依赖安装失败

- 检查 Node.js 版本（需要 >=18.0.0）
- 检查 pnpm 版本（需要 >=8.0.0）

---

## 7. 验证清单

### 7.1 Worktree 验证

- [ ] `git worktree list` 显示新的 worktree 条目

### 7.2 依赖验证

- [ ] `package.json` 中 `@playwright/test` 在 devDependencies 内
- [ ] `pnpm exec playwright --version` 返回版本号

### 7.3 E2E 测试验证

- [ ] `pnpm exec playwright test --dry-run` 可执行

### 7.4 清理验证

- [ ] `git worktree list` 无新 worktree 条目
- [ ] `git branch -l wt/*` 无结果

---

## 8. 技术说明

### 8.1 @playwright/test vs playwright

- **`@playwright/test`**: 测试框架，包含 Test Runner 和断言库，**必须**
- **`playwright`**: CLI 工具，用于浏览器安装和管理，**可选**（大多数情况 @playwright/test 已足够）

### 8.2 版本选择

使用 `^1.40.0` 与现有配置文件 `playwright.config.ts` 兼容

---

## 9. 任务进度追踪

### 文档构建状态

| 阶段 | 状态 | 完成时间 |
|------|------|----------|
| 阶段0：Worktree 创建 | 待执行 | - |
| 阶段1：修复依赖 | 待执行 | - |
| 阶段2：验证 E2E 测试 | 待执行 | - |
| 阶段3：合并与清理 | 待执行 | - |

---

*文档生成时间: 2026-05-24*
*Planner: Planner Agent*