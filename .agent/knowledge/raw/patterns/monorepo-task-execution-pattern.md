# Monorepo 项目任务执行模式

## 文档信息

| 字段 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 更新日期 | 2026-05-02 |
| 适用项目 | Organic-Interface (pnpm monorepo) |

## 模式描述

本模式描述了 Organic-Interface 这类 pnpm monorepo 项目中多任务并行/顺序执行的执行方式。

## 模式特征

### 1. 分支策略
- projects子项目必须切换到 `agent-develop` 分支执行任务
- 任务完成后需提交推送所有更改

### 2. 任务依赖处理
- 无依赖任务可并行执行（如 task-P2-002 和 task-P2-004）
- 有依赖任务需等待前置任务完成（如 task-P2-003 依赖 task-P2-002）
- 依赖关系在任务文档中明确声明

### 3. 验证流程
```
pnpm install  → pnpm build  → pnpm typecheck  → 提交推送
```
- 所有模块构建成功（7/7）才算完成任务
- 类型检查通过（12/12）才算代码质量合格

### 4. 文档结构
- README.md 作为项目入口文档
- API文档放在各包的 README.md 中
- 知识库结构：raw → sorted → verified → user

## 适用场景

- **Monorepo 多模块项目**：7个独立 packages
- **并行任务执行**：多个P2优先级任务同时进行
- **验证驱动完成**：以 build/typecheck 通过作为完成标准

## 代码示例

### pnpm workspace 配置验证

```bash
# 验证 workspace 依赖正确链接
cd /workspaces/agent-workspace/projects/Organic-Interface
pnpm install

# 验证构建成功
pnpm build  # 7/7 modules

# 验证类型检查
pnpm typecheck  # 12/12 checks
```

### 任务并行执行

```
task-P2-002 (README完善)     ─┐
                             ├─→ task-P2-003 (API文档)
task-P2-004 (依赖检查)       ─┘
```

## 相关文档

- [Organic-Interface README.md](file://../../../README.md)
- [Monorepo架构文档](file://../../../docs/feature-013-monorepo-architecture.md)

## 标签

#monorepo-pattern #pnpm-workspace #task-execution #parallel-tasks