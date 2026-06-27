# 任务文档：修复 @organic/ui 包的 TypeScript 类型错误

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P0-006-fix-typescript-errors-in-ui-package |
| **优先级** | P0 |
| **标题** | fix-typescript-errors-in-ui-package |
| **描述** | 修复 @organic/ui 包测试文件中的 TypeScript 类型错误（共11个错误，涉及3个测试文件） |
| **可并行** | 否 |
| **创建时间** | 2026-04-30 |
| **执行分支** | agent-develop |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |

---

## 任务背景

### 问题描述

Reviewer 反馈 `pnpm typecheck` 在 @organic/ui 包失败，共有 **11 个 TypeScript 类型错误**，全部出现在测试文件中。

### 错误文件分布

| 文件 | 错误数量 | 主要问题 |
|------|---------|---------|
| Command.test.ts | 1 | `cmd.subcommands` possibly undefined |
| Table.test.ts | 9 | Person 类型不满足 `Record<string, unknown>` 约束 |
| UIOperation.test.ts | 1 | `beforeEach` 未从 vitest 导入 |

### 根本原因分析

1. **Command.test.ts**：接口定义 `subcommands?` 为可选属性，但 `createCommand` 实际总是初始化 `subcommands` 为空 Map，测试代码直接访问 `.size` 触发 TS18048 错误
2. **Table.test.ts**：`Table<T>` 泛型约束为 `T extends Record<string, unknown>`，但 TypeScript 接口 `Person { name: string; age: string }` 默认没有索引签名，不满足约束
3. **UIOperation.test.ts**：代码使用了 `beforeEach` 钩子函数但未从 vitest 导入

---

## 任务内容

### 1. 修复 Command.test.ts 类型错误

**文件路径**: /workspaces/agent-workspace/projects/Organic-Interface/packages/ui/src/cli/__tests__/Command.test.ts

**错误位置**: 第 118 行

**问题代码**:
```typescript
expect(cmd.subcommands.size).toBe(0);
```

**错误原因**: `subcommands` 在接口中定义为可选属性 `subcommands?: Map<string, Command>`，TypeScript 认为可能是 undefined

**修复方案**: 在 `createCommand` 返回类型中，`subcommands` 应始终存在（初始化为空 Map），因此修改接口定义将 `subcommands` 改为非可选：
```typescript
// Command.ts 接口定义
subcommands: Map<string, Command>;  // 移除 ? 使其必选
```

或者修改测试使用可选链：
```typescript
expect(cmd.subcommands?.size).toBe(0);
```

**推荐方案**: 修改 `Command.ts` 接口定义，将 `subcommands` 从可选改为必选，因为 `createCommand` 总是初始化它。

### 2. 修复 Table.test.ts 类型错误

**文件路径**: /workspaces/agent-workspace/projects/Organic-Interface/packages/ui/src/components/__tests__/Table.test.ts

**错误位置**: 第 4-7 行（Person 接口定义）、第 16, 27, 41, 55, 56, 67, 81, 82 行

**问题代码**:
```typescript
interface Person {
  name: string;
  age: string;
}
```

**错误原因**: `Table` 类的泛型约束 `T extends Record<string, unknown>` 要求类型必须有字符串索引签名，而 `Person` 接口没有索引签名。

**修复方案**: 为 `Person` 接口添加索引签名：
```typescript
interface Person {
  name: string;
  age: string;
  [key: string]: unknown;  // 添加索引签名
}
```

或者修改 Table 泛型约束为更宽松的类型（如 `object`）。

**推荐方案**: 修改 `Person` 接口添加索引签名以满足 `Record<string, unknown>` 约束。

### 3. 修复 UIOperation.test.ts 类型错误

**文件路径**: /workspaces/agent-workspace/projects/Organic-Interface/packages/ui/src/core/__tests__/UIOperation.test.ts

**错误位置**: 第 86 行

**问题代码**:
```typescript
beforeEach(() => {
  manager = new UIOperationManager();
});
```

**错误原因**: `beforeEach` 未从 vitest 导入

**修复方案**: 修改导入语句，从：
```typescript
import { describe, it, expect, vi } from 'vitest';
```
改为：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| packages/ui/src/cli/Command.ts | Command 接口定义（需修改 subcommands 为必选） |
| packages/ui/src/cli/__tests__/Command.test.ts | 需要修复的测试文件 |
| packages/ui/src/components/Table.ts | Table 类定义（泛型约束） |
| packages/ui/src/components/__tests__/Table.test.ts | 需要修复的测试文件 |
| packages/ui/src/core/__tests__/UIOperation.test.ts | 需要修复的测试文件 |

---

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| packages/ui/src/cli/Command.ts | 修改 subcommands 为必选属性 |
| packages/ui/src/cli/__tests__/Command.test.ts | 修复后测试文件 |
| packages/ui/src/components/__tests__/Table.test.ts | 修改 Person 接口添加索引签名 |
| packages/ui/src/core/__tests__/UIOperation.test.ts | 添加 beforeEach 到导入 |

---

## 验收标准

- [ ] Command.test.ts 第 118 行类型错误已修复
- [ ] Table.test.ts 所有 Person 类型错误已修复（共9处）
- [ ] UIOperation.test.ts 第 86 行 beforeEach 错误已修复
- [ ] `pnpm --filter @organic/ui typecheck` 执行成功，无错误输出

---

## 失败处理

1. **可选链 vs 接口修改**：如果修改接口后其他代码出现问题，可改用可选链方式修复测试
2. **索引签名冲突**：如果添加 `[key: string]: unknown` 与现有属性冲突，可考虑修改 Table 泛型约束
3. **构建失败**：检查 tsconfig.json 配置是否正确

---

## 技术规范

- 测试框架: vitest
- TypeScript 严格模式
- 所有泛型约束必须满足才能通过类型检查
- 导入语句必须完整包含所有使用的函数和类型
