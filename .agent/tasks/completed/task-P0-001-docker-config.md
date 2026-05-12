# Task: Add Docker Configuration - Resolve Rule Conflict

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P0-001-docker-config |
| **优先级** | P0 |
| **标题** | 添加Docker配置 - 解决规则冲突 |
| **描述** | 为Organic-Interface项目添加Dockerfile和docker-compose.yml，解决与全局规则project-authoring-rule.md的冲突 |
| **任务类型** | code-modification |
| **依赖任务** | 无 |
| **可并行** | 否 |
| **创建时间** | 2026-05-12 |
| **执行分支** | agent-develop |
| **项目路径** | projects/Organic-Interface |
| **Worktree路径** | worktrees/Organic-Interface/Organic-Interface-P0-001-docker-config |

---

## 执行模式

**必须使用worktree模式执行**，projects目录只读，严禁直接修改。

### Worktree执行流程

1. **创建worktree**: 从projects/Organic-Interface的agent-develop分支创建worktree
2. **文件操作**: 所有Dockerfile和docker-compose.yml的创建操作在worktree目录中进行
3. **合并清理**: 任务成功后合并到agent-develop并清理worktree

---

## 任务背景

### 规则冲突说明

**冲突来源**: `.agent/rules/global/project-authoring-rule.md` 第3章容器化要求

**规则要求**:
- 必须使用Docker进行环境隔离和部署
- 项目根目录必须包含Dockerfile
- 推荐使用docker-compose.yml进行多服务编排

**当前状态**: Organic-Interface项目根目录不存在Dockerfile和docker-compose.yml

**影响**: 项目不满足容器化要求，无法通过规则验证，属于P0级别冲突

### 项目技术栈

- 运行时: Node.js 18+
- 包管理: pnpm 8+
- 构建工具: Turborepo 1.13+
- 测试框架: Vitest 1.4+
- Monorepo结构: pnpm workspaces

---

## 任务内容

### 步骤1：创建项目Dockerfile

**文件路径**: `worktrees/Organic-Interface/Organic-Interface-P0-001-docker-config/Dockerfile`

**内容要求**:
- 基于 Node.js 18+ LTS 镜像
- 安装 pnpm 8+
- 使用 turbo run build 构建项目
- 使用 pnpm test 运行测试
- 设置工作目录为 /app
- 复制必要文件进行增量构建

**Dockerfile结构**:
```dockerfile
FROM node:18-slim

# Install pnpm
RUN npm install -g pnpm@8

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/*/package.json packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build
RUN pnpm build

# Default command
CMD ["pnpm", "test"]
```

### 步骤2：创建docker-compose.yml

**文件路径**: `worktrees/Organic-Interface/Organic-Interface-P0-001-docker-config/docker-compose.yml`

**内容要求**:
- 定义 development 服务（用于开发测试）
- 定义 test 服务（用于运行测试）
- 使用独立网络
- 配置卷挂载进行开发时热重载
- test服务使用 --rm 自动清理

**docker-compose结构**:
```yaml
version: '3.8'

services:
  dev:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: pnpm dev

  test:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=test
    command: pnpm test
    profiles:
      - ci
```

### 步骤3：验证Docker配置

**验证步骤**:
1. 在worktree中执行 `docker build -t organic-interface:test .` 构建镜像
2. 执行 `docker compose run --rm test` 运行测试
3. 验证构建和测试均成功

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| `projects/Organic-Interface/package.json` | 项目依赖和脚本配置 |
| `projects/Organic-Interface/pnpm-workspace.yaml` | pnpm workspace配置 |
| `projects/Organic-Interface/turbo.json` | Turborepo配置 |
| `.agent/rules/global/project-authoring-rule.md` | 容器化规则参考 |

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| `worktrees/Organic-Interface/Organic-Interface-P0-001-docker-config/Dockerfile` | 项目Docker镜像构建文件 |
| `worktrees/Organic-Interface/Organic-Interface-P0-001-docker-config/docker-compose.yml` | Docker Compose多服务编排文件 |

## 预期修改文件

| 文件路径 | 预期修改内容 |
|---------|-------------|
| `worktrees/Organic-Interface/Organic-Interface-P0-001-docker-config/.dockerignore` | 确保构建上下文正确 |

---

## 验收标准

### Docker配置完整性

- [ ] `Dockerfile` 文件已创建
- [ ] Dockerfile基于Node.js 18+镜像
- [ ] Dockerfile安装pnpm 8+
- [ ] Dockerfile包含项目构建命令
- [ ] Dockerfile包含测试运行命令
- [ ] `docker-compose.yml` 文件已创建
- [ ] docker-compose定义dev服务
- [ ] docker-compose定义test服务
- [ ] dev服务支持卷挂载热重载
- [ ] test服务使用 --rm 自动清理

### 验证通过

- [ ] `docker build -t organic-interface:test .` 构建成功
- [ ] `docker compose run --rm test` 测试成功
- [ ] 无error级别输出

---

## 合并与清理

### 合并到agent-develop

任务成功后执行以下步骤：

1. 切换到agent-develop分支：`git checkout agent-develop`
2. 合并临时分支：`git merge wt/P0-001/docker-config`
3. 推送agent-develop：`git push origin agent-develop`

### Worktree清理

合并完成后执行以下清理：

1. 删除worktree目录：`git worktree remove worktrees/Organic-Interface/Organic-Interface-P0-001-docker-config`
2. 删除临时分支：`git branch -d wt/P0-001/docker-config`

### 失败清理

任务失败时执行以下清理：

1. 删除worktree目录：`git worktree remove --force worktrees/Organic-Interface/Organic-Interface-P0-001-docker-config`
2. 删除临时分支：`git branch -D wt/P0-001/docker-config`

---

## 失败处理

1. **构建失败**: 检查Dockerfile语法，确保基础镜像可用
2. **测试失败**: 检查测试命令是否正确，确认vitest配置
3. **卷挂载问题**: 确认路径格式正确，Windows使用正确路径分隔符

---

## 回滚方案

1. 删除 `Dockerfile`
2. 删除 `docker-compose.yml`
3. 使用 `git checkout -- <file>` 恢复（如有）

---

## 后置任务

- 更新知识库，记录Docker配置经验
- 更新项目README，添加Docker使用说明
