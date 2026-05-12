# Task: Verify Docker Configuration and Complete Task Cleanup

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P0-002-docker-config-verification |
| **优先级** | P0 |
| **标题** | Docker配置验证与任务清理 |
| **描述** | 验证Organic-Interface项目的Docker配置是否正确工作，清理残留worktree，解决任务状态不一致问题 |
| **任务类型** | code-verification |
| **依赖任务** | 无 |
| **可并行** | 否 |
| **创建时间** | 2026-05-13 |
| **执行分支** | agent-develop |
| **项目路径** | projects/Organic-Interface |
| **Worktree路径** | worktrees/Organic-Interface/Organic-Interface-P0-002-docker-verification |

---

## 任务背景

### 状态不一致问题

**观察到的状态**:
- Dockerfile存在于 `projects/Organic-Interface/Dockerfile`（1741字节）
- docker-compose.yml存在于 `projects/Organic-Interface/docker-compose.yml`（551字节）
- 但 `task-P0-001-docker-config.md` 仍标记为pending状态

**可能的问题**:
1. Dockerfile创建后未经验证构建
2. 测试命令未执行
3. 任务未正确完成并清理

### 残留worktree问题

**发现的残留worktree**:
- `worktrees/Organic-Interface/Organic-Interface-P2-002` (对应 wt/P2-002/oi-cleanup 分支)
- 该worktree是之前P2任务遗留，未清理

### 需要清理的分支

```
wt/P2-002/oi-cleanup - 残留分支，对应过期任务
```

---

## 任务内容

### 阶段1：环境准备

#### 1.1 创建worktree用于Docker验证

在仓库根目录创建worktree：

```bash
git worktree add worktrees/Organic-Interface/Organic-Interface-P0-002-docker-verification -b wt/P0-002/docker-verification projects/Organic-Interface/agent-develop
```

#### 1.2 检查Dockerfile和docker-compose.yml内容

验证以下文件存在且内容合理：
- `worktrees/Organic-Interface/Organic-Interface-P0-002-docker-verification/Dockerfile`
- `worktrees/Organic-Interface/Organic-Interface-P0-002-docker-verification/docker-compose.yml`

### 阶段2：Docker构建验证

#### 2.1 执行Docker构建

在worktree中通过tmux执行：

```bash
cd worktrees/Organic-Interface/Organic-Interface-P0-002-docker-verification
tmux new-session -d -s docker-build 'docker build -t organic-interface:test .'
tmux attach -t docker-build
```

**验证标准**:
- 构建命令成功执行（退出码0）
- 无error级别输出
- 镜像成功创建

#### 2.2 验证docker-compose服务

执行测试服务验证：

```bash
cd worktrees/Organic-Interface/Organic-Interface-P0-002-docker-verification
tmux new-session -d -s docker-test 'docker compose run --rm test'
tmux attach -t docker-test
```

**验证标准**:
- 测试服务成功启动
- pnpm test 命令正常执行
- 无error级别输出

**超时设置**: 5分钟，如超时则判定失败

### 阶段3：Worktree与分支清理

#### 3.1 清理残留worktree

```bash
# 清理残留的P2-002 worktree
git worktree remove worktrees/Organic-Interface/Organic-Interface-P2-002 --force

# 删除残留分支
git branch -D wt/P2-002/oi-cleanup
```

#### 3.2 清理本任务创建的临时分支

任务完成后删除本任务的worktree和分支：

```bash
git worktree remove worktrees/Organic-Interface/Organic-Interface-P0-002-docker-verification --force
git branch -D wt/P0-002/docker-verification
```

### 阶段4：更新任务状态

#### 4.1 更新task-P0-001-docker-config.md状态

如果Docker验证通过，需要更新原任务文档：
- 将task-P0-001-docker-config.md移动到completed目录
- 记录验证结果

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| `projects/Organic-Interface/Dockerfile` | Docker镜像构建文件（待验证） |
| `projects/Organic-Interface/docker-compose.yml` | Docker Compose配置（待验证） |
| `projects/Organic-Interface/.agent/tasks/pending/task-P0-001-docker-config.md` | 原始Docker配置任务 |

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| `projects/Organic-Interface/.agent/tasks/completed/task-P0-001-docker-config.md` | 完成的任务文档 |
| `projects/Organic-Interface/.agent/tasks/completed/task-P0-002-docker-config-verification.md` | 本验证任务完成记录 |

---

## 验收标准

### Docker构建成功

- [ ] `docker build -t organic-interface:test .` 执行成功
- [ ] 无error级别构建输出
- [ ] 镜像成功创建并可运行

### Docker Compose测试成功

- [ ] `docker compose run --rm test` 执行成功
- [ ] pnpm test 命令正常执行
- [ ] 无error级别测试输出

### Worktree清理完成

- [ ] `worktrees/Organic-Interface/Organic-Interface-P2-002` 已删除
- [ ] `wt/P2-002/oi-cleanup` 分支已删除
- [ ] 无残留worktree

### 任务状态更新

- [ ] task-P0-001-docker-config.md 已移动到completed目录
- [ ] 本验证任务已完成记录已写入

---

## 失败处理

### Docker构建失败

1. 分析构建错误日志
2. 修复Dockerfile中的问题
3. 重新执行构建
4. 如无法修复，记录问题并报告Manager

### 测试执行失败

1. 检查测试命令是否正确
2. 验证vitest配置
3. 确认package.json中的test脚本配置
4. 如无法修复，记录问题并报告Manager

### Worktree清理失败

1. 检查是否有未提交的更改
2. 强制清理（--force）
3. 如仍失败，报告Manager处理

---

## 回滚方案

### 恢复原始状态

如果验证失败，需要：
1. 保持worktree用于调试
2. 记录具体的失败原因
3. 报告Manager进行决策

### 清理临时资源

无论成功或失败，都需要清理：
1. 本任务创建的worktree
2. 本任务创建的临时分支
3. 任何残留的临时文件

---

## 后置任务

- 更新知识库，记录Docker配置验证经验
- 检查是否需要进一步优化Dockerfile（多阶段构建、构建缓存优化等）