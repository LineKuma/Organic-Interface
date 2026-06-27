# Task: Archive Obsolete Task Document

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P3-001-archive-stale-task-cleanup-doc |
| **优先级** | P3 |
| **标题** | archive-stale-task-cleanup-doc |
| **描述** | 将已过期的任务文档 task-P2-001-stale-tasks-cleanup.md 移动到 completed/ |
| **依赖任务** | 无 |
| **可并行** | 是 |
| **创建时间** | 2026-05-02 |
| **执行分支** | agent-develop |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |

---

## 任务背景

task-P2-001-stale-tasks-cleanup.md 任务文档描述的工作已经完成（commit c818235），但该文档本身仍留在 pending/ 目录中未被移动到 completed/。

需要将此过期的任务文档移动到 completed/ 以保持任务状态管理的一致性。

---

## 任务内容

### 1. 验证工作已完成

**检查命令**：
```bash
cd /workspaces/agent-workspace/projects/Organic-Interface
git log --oneline -1 c818235
```

**预期结果**：显示 "archive: move expired task documents to completed/"

### 2. 移动文档到 completed/

**操作命令**：
```bash
mv .agent/tasks/pending/task-P2-001-stale-tasks-cleanup.md .agent/tasks/completed/
```

### 3. 验证移动结果

```bash
ls -la .agent/tasks/pending/task-P2-001-stale-tasks-cleanup.md  # 应报错：文件不存在
ls -la .agent/tasks/completed/task-P2-001-stale-tasks-cleanup.md  # 应存在
```

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| `.agent/tasks/pending/task-P2-001-stale-tasks-cleanup.md` | 待归档的任务文档 |

---

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| `.agent/tasks/completed/task-P2-001-stale-tasks-cleanup.md` | 归档后的任务文档 |

---

## 验收标准

- [ ] 验证 git log 确认 c818235 已完成相关工作
- [ ] 将 task-P2-001-stale-tasks-cleanup.md 从 pending/ 移动到 completed/
- [ ] 验证 pending/ 目录中无此文档
- [ ] 验证 completed/ 目录中存在此文档

---

## 失败处理

1. **文件不存在**：如果文件不存在则跳过，记录异常
2. **已在 completed/**：如果文件已在 completed/ 中则验证通过
3. **权限问题**：报告权限错误

---

## 后续工作建议

归档完成后，Organic-Interface 项目当前无 pending 任务。建议 Planner 评估项目下一步工作方向。
