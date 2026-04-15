# Task: organic项目重试仓库ssh链接

## 基本信息

- **任务ID**: task-P1-521-fix-ssh-url.md
- **优先级**: P1
- **项目**: Organic-Interface
- **创建时间**: 2026-04-15 11:05:46
- **状态**: pending

## 任务描述

将Organic-Interface仓库的远程URL从HTTPS改为SSH格式，解决SSH连接问题。

## 当前状态

- **当前remote URL**: https://github.com/LineCatOvO/Organic-Interface.git
- **目标remote URL**: git@github.com:LineCatOvO/Organic-Interface.git

## 执行步骤

1. 进入项目目录 `/workspaces/agent-workspace/projects/Organic-Interface`
2. 执行 `git remote set-url origin git@github.com:LineCatOvO/Organic-Interface.git`
3. 验证修改结果，执行 `git remote -v` 确认URL已变更

## 验收标准

- git remote -v 显示 origin 的fetch和push URL均为 `git@github.com:LineCatOvO/Organic-Interface.git`
- URL格式必须是SSH格式（git@github.com:开头），不是HTTPS格式

## 回滚方案

如需回滚，执行：`git remote set-url origin https://github.com/LineCatOvO/Organic-Interface.git`

## 依赖关系

无
