# 任务文档：清理过时的任务文档

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P1-007-task-docs-cleanup |
| **优先级** | P1 |
| **标题** | task-docs-cleanup |
| **描述** | 清理和更新过时的任务文档，确保任务文档与项目当前状态一致 |
| **依赖任务** | 无 |
| **可并行** | 否 |
| **创建时间** | 2026-04-30 |
| **执行分支** | agent-develop |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |

---

## 任务背景

### 问题描述

项目中存在部分过时的任务文档，可能导致后续规划和执行混乱。

### 需要清理的任务文档

| 任务文档 | 状态 | 问题 |
|---------|------|------|
| task-P0-002-core-conversation-plugin-impl.md | 已标记为 completed，但实际被 REJECTED | 状态不一致 |
| task-P1-001-organic-testing.md | 已完成（被 task-P1-001-organic-enhanced-testing 替代） | 已过时 |
| task-P1-001-organic-enhanced-testing.md | pending | 与已完成工作重叠 |
| task-P0-004-build-fix-typescript-errors.md | completed | 需验证是否仍需要 |
| task-P0-006-core-conversation-testing.md | completed | 需验证是否仍需要 |

### 清理策略

#### 1. task-P0-002-core-conversation-plugin-impl.md

**问题**：状态显示 completed，实际审核结果为 REJECTED

**操作**：
1. 将文档移回 pending 目录（从 completed 移回）
2. 更新文档状态为 "pending"（被拒绝状态）
3. 在 Reviewer 审核记录后添加修复状态

**新状态**：pending - 待修复 38 个 TypeScript 类型错误

#### 2. task-P1-001-organic-testing.md

**问题**：已被 task-P1-001-organic-enhanced-testing 替代，但两者存在重叠

**操作**：
1. 保留在 tasks 目录（根目录下的主任务文档）
2. 添加备注说明与 task-P1-001-organic-enhanced-testing 的关系
3. 验证其验收标准是否仍符合项目需求

#### 3. 过时但已完成的任务

**问题**：已完成的任务（如 task-P0-004、task-P0-006）可能已过时

**操作**：
1. 验证已完成任务对应的功能是否仍然需要
2. 如已不需要，添加 "已归档" 标记
3. 如仍需要，验证其验收标准是否仍符合当前项目状态

---

## 任务内容

### 1. 识别所有过时任务文档

**检查范围**：
- `.agent/tasks/pending/` 目录
- `.agent/tasks/completed/` 目录
- `.agent/tasks/active/` 目录（如有）

**识别标准**：
1. 任务创建时间超过 7 天且未更新
2. 任务依赖的代码已被重构或删除
3. 任务目标已被其他任务实现
4. 任务状态与实际审核结果不一致

### 2. 分析每个过时任务

对每个识别出的过时任务进行三维度验证：

| 验证维度 | 检查内容 | 处理建议 |
|---------|---------|---------|
| **时效性** | 任务是否已过期 | 废弃或更新 |
| **冲突性** | 是否与其他任务冲突 | 废弃或合并 |
| **合理性** | 目标是否仍符合项目需求 | 保留、修改或废弃 |

### 3. 执行清理操作

根据分析结果执行相应操作：

| 操作 | 适用场景 | 执行命令 |
|------|---------|---------|
| 移至 failed/ | 任务已过时且无价值 | `mv pending/task-xxx.md failed/` |
| 移至 completed/ | 任务已完成并通过审核 | `mv pending/task-xxx.md completed/` |
| 添加归档标记 | 任务已完成但已过时 | 在文档末尾添加归档备注 |
| 更新内容 | 任务仍需要但内容需更新 | 修改文档内容 |

### 4. 生成清理报告

**报告内容**：
1. 识别的过时任务列表
2. 每个任务的处理决定及理由
3. 执行的操作摘要
4. 建议的后续行动

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| `.agent/tasks/pending/*.md` | 待处理的 pending 任务文档 |
| `.agent/tasks/completed/*.md` | 已完成的 completed 任务文档 |
| `packages/*/src/**/*.ts` | 源代码文件（用于验证任务依赖是否仍有效） |

---

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| `.agent/tasks/failed/task-P0-002-*.md` | 被拒绝但未正确状态的任务 |
| `.agent/tasks/failed/task-P1-001-*.md` | 被废弃的任务（如适用） |
| `.agent/tasks/completed/task-xxx-archive.md` | 添加归档标记的任务（如适用） |

---

## 验收标准

- [ ] 所有过时任务文档已识别并分类
- [ ] task-P0-002-core-conversation-plugin-impl.md 状态已更正
- [ ] task-P1-001-organic-enhanced-testing.md 已停用（移至 failed 或添加停用标记）
- [ ] 清理报告已生成
- [ ] 所有操作已记录在案

---

## 失败处理

1. **无法判断任务是否过时**：咨询项目负责人或查看相关提交记录
2. **任务有有效依赖**：保留任务，仅更新描述
3. **任务状态冲突**：以 Reviewer 审核结果为准

---

## 执行计划

### 阶段 1: 识别过时任务
1. 列出所有任务文档
2. 检查每个文档的创建时间和最后修改时间
3. 对比任务目标与项目当前状态
4. 生成过时任务列表

### 阶段 2: 分析评估
1. 对每个过时任务进行三维度验证
2. 确定处理建议
3. 与 Manager 确认（如有疑问）

### 阶段 3: 执行清理
1. 按决策执行移动或标记操作
2. 更新任务文档状态
3. 记录操作日志

### 阶段 4: 生成报告
1. 汇总清理结果
2. 提出后续建议
3. 报告给 Manager

---

## 技术规范

- 遵循 AGENTS_GENERAL.xml 中的任务状态定义
- 遵循 AGENTS_PLANNER.xml 中的任务文档验证规则
- 确保操作可追溯，所有变更记录在案
