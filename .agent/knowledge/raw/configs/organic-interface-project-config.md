# Organic-Interface 项目配置说明

## 文档信息

| 字段 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 更新日期 | 2026-05-02 |
| 项目 | Organic-Interface |

## 项目技术栈

| 配置项 | 值 |
|--------|-----|
| 运行时 | Node.js 18+ |
| 包管理器 | pnpm 8+ |
| 语言 | TypeScript 5.4+ |
| 构建工具 | Turborepo 1.13+ |
| 测试框架 | Vitest 1.4+ |

## 项目结构

```
organic-interface/
├── packages/              # 7个内部包
│   ├── agent/            # Agent 调度模块
│   ├── kernel/           # Kernel 主逻辑
│   ├── plugins/          # 插件系统
│   ├── storage/          # 存储系统
│   ├── tools/            # 工具服务
│   ├── ui/               # CLI 界面
│   └── utils/            # 工具库
├── docs/                  # 项目文档
├── .agent/               # Agent 配置
│   ├── tasks/           # 任务目录
│   └── knowledge/       # 知识库
├── package.json          # 根配置
├── pnpm-workspace.yaml   # workspace 配置
├── turbo.json            # Turborepo 配置
├── tsconfig.base.json    # 基础 TS 配置
└── vitest.config.ts      # Vitest 配置
```

## 关键配置文件

### package.json 脚本

| 脚本 | 功能 |
|------|------|
| `pnpm build` | 构建所有模块 |
| `pnpm turbo build` | 增量构建 |
| `pnpm dev` | 开发模式 |
| `pnpm test` | 运行测试 |
| `pnpm test:coverage` | 测试覆盖率 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm clean` | 清理构建产物 |

### 分支策略

| 分支 | 用途 |
|------|------|
| `agent-develop` | 自动化代理可写入的开发分支 |
| `main/master` | 稳定分支，仅存放经审核验证的稳定版本 |

## 包依赖关系

```
utils (Level 0) ← kernel (Level 1) ← plugins, tools (Level 2) ← agent (Level 3) ← ui (Level 4)
```

## 验证命令输出

### pnpm build 结果
- 7/7 modules 构建成功

### pnpm typecheck 结果
- 12/12 类型检查通过

## 标签

#organic-config #monorepo #pnpm #turborepo