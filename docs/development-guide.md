# 开发指南

## 基本信息

**文档类型**: 开发指南
**版本**: 0.1.0
**状态**: 已发布

---

## 概述

本文档提供 Organic-Interface 项目的开发环境搭建、代码规范、调试方法和贡献流程指南。

---

## 环境搭建

### 前置要求

- **Node.js** 18.0.0+（推荐 20 LTS）
- **pnpm** 8.0.0+
- **Git**
- **VSCode**（推荐）

### 克隆仓库

```bash
git clone https://github.com/LineKuma/Organic-Interface.git
cd Organic-Interface
```

### 安装依赖

```bash
pnpm install
```

### 构建项目

```bash
# 构建所有包
pnpm build

# 增量构建
pnpm turbo build

# 监视模式
pnpm dev
```

---

## 项目结构

```
organic-interface/
├── packages/                    # Monorepo 包
│   ├── utils/                   # 共享工具和类型 (Level 0)
│   ├── kernel/                  # 核心引擎 (Level 1)
│   ├── plugins/                 # 插件系统 (Level 2)
│   ├── tools/                   # 工具服务 (Level 2)
│   ├── storage/                 # 存储系统 (Level 3)
│   ├── agent/                   # Agent 调度 (Level 4)
│   └── ui/                      # 用户界面 (Level 5)
├── e2e/                         # 端到端测试
├── docs/                        # 项目文档
├── scripts/                     # 构建和安装脚本
├── vitest.config.ts             # Vitest 配置
├── turbo.json                   # Turborepo 配置
├── eslint.config.mjs            # ESLint 配置
└── tsconfig.base.json           # 基础 TypeScript 配置
```

### 依赖层级

```
utils (Level 0)
  ↑
kernel (Level 1)
  ↗       ↖
plugins   tools (Level 2)
  ↖       ↗    ↑
  agent (Level 3)  storage (Level 3)
    ↑
    ui (Level 4)
```

**规则**: 上层可以依赖下层，下层不能依赖上层。

---

## 开发工作流

### 创建新功能

```bash
# 1. 创建功能分支
git checkout -b feature/my-feature

# 2. 开发代码
# ...

# 3. 运行测试
pnpm test

# 4. 类型检查
pnpm typecheck

# 5. 代码检查
pnpm lint

# 6. 提交
git add .
git commit -m "feat: add my feature"

# 7. 推送
git push origin feature/my-feature
```

### 构建单个包

```bash
# 构建特定包
pnpm --filter @organic/ui build

# 构建包及其依赖
pnpm --filter @organic/ui... build
```

### 运行特定包的测试

```bash
# 运行单个包的测试
pnpm --filter @organic/ui test

# 监视模式
pnpm --filter @organic/ui test:watch
```

---

## 代码规范

### TypeScript

- 使用严格模式 `strict: true`
- 禁止使用 `any` 类型（测试文件例外）
- 导出接口必须完整定义类型
- 文件名使用 `kebab-case.ts`

### 命名规范

| 元素     | 规范             | 示例                |
| -------- | ---------------- | ------------------- |
| 变量     | camelCase        | `userName`          |
| 函数     | camelCase        | `getConfig()`       |
| 类       | PascalCase       | `Sandbox`           |
| 接口     | PascalCase       | `SandboxConfig`     |
| 类型别名 | PascalCase       | `UIPermissionLevel` |
| 常量     | UPPER_SNAKE_CASE | `DEFAULT_CONFIG`    |
| 文件名   | kebab-case       | `sandbox.ts`        |

### ESLint

```bash
# 检查代码
pnpm lint

# 自动修复
pnpm lint:fix
```

### Prettier

```bash
# 格式化代码
pnpm lint:fix
```

---

## 测试

### 测试结构

```
packages/<package>/src/
├── __tests__/           # 单元测试
│   ├── Module.test.ts
│   └── ...
├── Module.ts
└── ...
e2e/                     # 端到端测试
├── ui-sandbox-user-flow.test.ts
├── ui-agent-user-workflow.test.ts
├── ui-components-user-interaction.test.ts
├── ui-cli-user-workflow.test.ts
├── tui-terminal-screen.test.ts
├── tui-rendering.test.ts
├── tui-mouse-interaction.test.ts
├── tui-cli-full-workflow.test.ts
└── ...
```

### 测试类型

| 类型     | 位置                            | 说明             |
| -------- | ------------------------------- | ---------------- |
| 单元测试 | `packages/<pkg>/src/__tests__/` | 测试单个模块     |
| E2E 测试 | `e2e/`                          | 测试用户操作流程 |

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行 E2E 测试
pnpm --filter . vitest run e2e/

# 监视模式
pnpm test:watch

# 覆盖率
pnpm test:coverage
```

### 测试规范

1. **纯 UI 测试**: E2E 测试必须从用户视角出发，测试用户可见的 UI 行为
2. **无跳过逻辑**: 不允许使用 `if` 条件跳过断言
3. **用户操作逻辑**: 测试步骤按用户实际操作顺序编写

---

## 调试

### VSCode 调试配置

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Current Test",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["run", "${relativeFile}"],
      "console": "integratedTerminal"
    }
  ]
}
```

### 日志调试

```typescript
import { createLogger } from '@organic/utils';

const logger = createLogger('my-module');
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning');
logger.error('Error');
```

---

## 添加新包

### 步骤

1. 创建包目录：

```bash
mkdir -p packages/my-package/src
```

2. 创建 `package.json`：

```json
{
  "name": "@organic/my-package",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

3. 创建 `tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

4. 创建 `src/index.ts` 导出入口。

5. 安装依赖并构建：

```bash
pnpm install
pnpm build
```

---

## 发布流程

### 版本发布

```bash
# 1. 更新版本号
pnpm version patch  # 或 minor / major

# 2. 构建
pnpm build

# 3. 运行测试
pnpm test

# 4. 创建 Git Tag
git tag v0.1.0

# 5. 推送
git push --tags

# 6. 创建 GitHub Release
# 在 GitHub 上手动创建 Release
```

### 安装脚本发布

安装脚本自动从 GitHub Release 下载，创建 Release 后即可使用：

```bash
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash
```

---

## CI/CD

### GitHub Actions

项目配置了 CI 工作流，在 `master` 和 `develop` 分支推送时自动运行：

```yaml
# .github/workflows/ci.yml
- 安装依赖
- 类型检查
- 代码检查
- 构建
- 测试
```

### 本地 CI 模拟

```bash
# 模拟 CI 流程
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

---

## 相关文档

- [架构设计](./architecture.md) — 系统架构
- [配置参考](./configuration.md) — 配置选项
- [测试指南](./testing-guide.md) — 测试策略
- [部署指南](./deployment.md) — 部署说明
