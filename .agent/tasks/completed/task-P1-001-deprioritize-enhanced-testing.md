# 任务文档：停用 task-P1-001-organic-enhanced-testing 任务

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P1-001-deprioritize-enhanced-testing |
| **优先级** | P1 |
| **标题** | deprioritize-enhanced-testing |
| **描述** | 停用与已完成工作重叠的 task-P1-001-organic-enhanced-testing 任务 |
| **依赖任务** | 无 |
| **可并行** | 否 |
| **创建时间** | 2026-04-30 |
| **执行分支** | agent-develop |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |

---

## 任务背景

### 问题描述

task-P1-001-organic-enhanced-testing.md 任务与已完成工作存在重叠，需要进行冲突性分析和验证。

### 重叠分析

#### 已有完成的工作

根据已完成的任务文档，以下测试工作已经完成：

| 已完成任务 | 测试覆盖 |
|---------|---------|
| task-P1-001-organic-testing.md | vitest 配置、kernel、plugins/base、plugins/interfaces、utils 模块的测试 |
| task-P1-002-run-tests.md | 7 个测试文件，185 个测试用例，全部通过 |

#### task-P1-001-organic-enhanced-testing.md 规划的工作

| 待完成工作 | 说明 |
|---------|------|
| 修复 vitest.config.ts 添加 storage 测试 | 原 task-P1-001 已配置 |
| 为 agent 包创建 33 个测试文件 | 完全无测试 |
| 为 tools 包创建 11 个测试文件 | 完全无测试 |
| 为 ui 包创建 12 个测试文件 | 完全无测试 |

#### 重叠部分

- **vitest.config.ts 配置**：已在 task-P1-001 中完成，无需重复
- **storage 包测试配置**：已在 task-P1-001 中完成

#### 有效工作部分

- **agent 包测试**：33 个源文件无测试，这是有效的工作需求
- **tools 包测试**：11 个源文件无测试，这是有效的工作需求
- **ui 包测试**：12 个源文件无测试，这是有效的工作需求

---

## 决策分析

### 时效性验证

| 检查项 | 状态 | 说明 |
|-------|------|------|
| 任务创建时间 | 2026-04-29 | 较新 |
| 依赖代码是否存在 | 是 | agent、tools、ui 包存在 |
| 任务目标是否已实现 | 部分 | vitest 配置已完成，测试覆盖未完成 |

### 冲突性验证

| 检查项 | 状态 | 说明 |
|-------|------|------|
| 与已完成任务是否冲突 | 是 | vitest 配置部分与 task-P1-001 重叠 |
| 与项目当前方向是否冲突 | 否 | 项目需要更多测试覆盖 |
| 是否导致重复工作 | 是 | vitest 配置会重复 |

### 合理性验证

| 检查项 | 状态 | 说明 |
|-------|------|------|
| 任务范围是否合理 | 部分合理 | agent/tools/ui 包测试是合理的，但配置部分与已有任务重叠 |
| 预期输出是否有价值 | 是 | 增加测试覆盖率是有价值的工作 |
| 是否符合项目当前阶段 | 是 | 项目处于发展阶段，需要更多测试 |

---

## 处理建议

### 选项 A：停用并拆分（推荐）

停用 task-P1-001-organic-enhanced-testing.md，创建新的独立任务：

1. **停用当前任务**：将 task-P1-001-organic-enhanced-testing.md 移至 failed 目录并标注原因
2. **创建新任务**：仅针对 agent 包创建测试任务（去除与已有工作重叠的部分）

**优点**：
- 避免重复工作
- 任务范围更清晰
- 验收标准更明确

**缺点**：
- 需要创建新任务文档

### 选项 B：修改后执行

保留 task-P1-001-organic-enhanced-testing.md，但修改任务范围：

1. **移除重叠部分**：去除 vitest.config.ts 配置相关的验收条件
2. **保留有效部分**：仅保留 agent、tools、ui 包的测试创建工作

**优点**：
- 无需创建新任务
- 直接复用现有任务文档

**缺点**：
- 任务文档需要较大修改
- 可能产生更多冲突

### 选项 C：废弃后重建

直接废弃 task-P1-001-organic-enhanced-testing.md，不创建替代任务：

1. **评估是否必要**：当前项目测试通过率是否可以接受
2. **决定是否创建替代任务**：根据项目需求决定

**优点**：
- 简化任务管理

**缺点**：
- 如果确实需要测试，则缺乏后续计划

---

## 推荐方案

**推荐选项 A：停用并拆分**

1. 将 task-P1-001-organic-enhanced-testing.md 移至 failed 目录
2. 创建 task-P1-006-add-agent-tests 新任务（仅针对 agent 包测试）

**理由**：
1. 避免与已完成工作（task-P1-001、task-P1-002）重复
2. 保持任务原子性（一个包一个任务）
3. 降低任务复杂度，便于执行和验收
4. 符合 AGENTS_PLANNER.xml 中的任务粒度限制（单个任务不超过 3 个主要文件/模块）

---

## 执行操作

### 1. 停用 task-P1-001-organic-enhanced-testing.md

**操作**：
1. 将文件从 `pending/` 目录移至 `failed/` 目录
2. 在文档末尾添加停用原因

**停用原因**：
```
### 停用记录
- 停用时间：2026-04-30
- 停用原因：与已完成工作（task-P1-001、task-P1-002）存在重叠
- 后续操作：创建独立的新任务文档，仅针对新增测试需求
```

### 2. 创建新的 agent 包测试任务

**新任务文档**：task-P1-006-add-agent-tests.md

**任务范围**：
- 仅针对 agent 包创建测试
- 覆盖 agent 包的所有 33 个源文件
- 与已有测试框架（task-P1-001 配置的 vitest）配合工作

---

## 验收标准

- [ ] task-P1-001-organic-enhanced-testing.md 已移至 failed 目录
- [ ] 停用原因已记录在原任务文档中
- [ ] 新的 agent 包测试任务文档已创建

---

## 技术规范

- 遵循 AGENTS_GENERAL.xml 中的测试规范
- 遵循 AGENTS_PLANNER.xml 中的任务文档验证规则
- 确保新任务与已有任务不重复
