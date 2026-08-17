# Monorepo 最佳实践

## 概述
本文档记录 Organic-Interface 项目的 Monorepo 优化经验，基于 pnpm workspace + Turbo 构建。

## 包命名规范

### 标准包名约定
| 名称 | 说明 | 适用场景 |
|------|------|----------|
| `utils` | 通用工具函数库 | 跨项目共享的工具函数 |
| `shared` | 共享代码 | **不推荐** - 不符合 Node.js 社区规范 |
| `common` | 公共代码 | **不推荐** - 命名过于宽泛 |
| `lib` | 库代码 | 封装性较强的独立库 |

**推荐使用 `utils` 而非 `shared`**：
- 语义更明确：utils 强调工具性质
- 符合 npm 社区惯例
- 避免与 `shared` 预编译模块冲突（Node.js 内置模块）

## 重命名包后的操作清单

重命名包（如 `shared` -> `utils`）需要执行以下步骤：

### 1. 重命名目录
```bash
mv packages/shared packages/utils
```

### 2. 更新所有 package.json 引用
- 根目录 `package.json`（如有 workspace 依赖）
- 各子包的 `package.json` 中的 `dependencies` / `devDependencies`
- `pnpm-workspace.yaml`（如需特殊配置）

### 3. 更新源文件 import 路径
```typescript
// 之前
import { xxx } from '@organic-interface/shared'

// 之后
import { xxx } from '@organic-interface/utils'
```

### 4. 更新文档引用
- README.md
- API 文档
- 示例代码

## package.json 问题排查

### 常见问题：重复内容
检查 `package.json` 是否存在：
- 重复的字段（如多个 `dependencies` 块）
- 重复的依赖项
- 字段顺序混乱

**修复方法**：使用 `pnpm dedupe` 或手动清理后重新生成。

### 验证工具
```bash
# 检查 package.json 格式
pnpm pkg validate

# 检查依赖一致性
pnpm install --frozen-lockfile
```

## 项目结构示例

```
organic-interface/
├── packages/
│   ├── utils/        # 通用工具（推荐命名）
│   ├── ui/          # UI 组件
│   ├── agent/       # Agent 核心
│   ├── kernel/      # 内核
│   ├── storage/     # 存储
│   ├── tools/       # 工具集
│   └── plugins/     # 插件
├── package.json     # Workspace 根配置
├── pnpm-workspace.yaml
├── turbo.json       # Turbo 构建配置
└── tsconfig.base.json
```

## 相关命令

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 清理并重新安装
pnpm clean && pnpm install

# 验证 workspace 配置
pnpm ls --depth 0
```

---
*最后更新：2024*
