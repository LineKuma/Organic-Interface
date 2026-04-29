# TypeScript 类型修复知识整理

## 文档信息

| 字段 | 值 |
|------|-----|
| 文档编号 | KNOWLEDGE-2026-0428-001 |
| 版本 | 1.0.0 |
| 创建日期 | 2026-04-28 |
| 作者 | Learner |
| 描述 | task-P0-004 TypeScript类型错误修复的经验总结 |

---

## 1. 任务概述

### 1.1 基本信息

| 字段 | 值 |
|------|-----|
| 任务ID | task-P0-004 |
| 任务标题 | 修复TypeScript类型错误 |
| 影响范围 | 52个文件 |
| 状态 | 已完成 |
| 提交信息 | `fix(organic): build` |

### 1.2 问题背景

Organic-Interface 项目存在大量TypeScript类型错误，导致 `pnpm build` 失败。这些错误分布在多个包中，需要系统性修复。

---

## 2. 常见类型错误模式与解决方案

### 2.1 Mock对象类型缺失

**问题描述**: 测试文件中的Mock对象缺少必需属性

**典型错误**:
```
Type 'MockObject' is missing the following properties from type 'Config':
  - apiKey
  - baseUrl
```

**解决方案**:
```typescript
// 错误写法
const mockConfig = {};

// 正确写法
const mockConfig: Partial<Config> & Required<Config> = {
  apiKey: 'test-key',
  baseUrl: 'https://test.com'
};

// 或使用类型断言
const mockConfig = {
  apiKey: 'test-key',
  baseUrl: 'https://test.com'
} as Config;
```

**适用场景**: 单元测试中的Mock对象定义

### 2.2 接口属性类型不匹配

**问题描述**: 实现类缺少接口定义的属性或类型不兼容

**典型错误**:
```
Property 'sessionId' is missing in type 'SessionImpl' but required in type 'Session'
```

**解决方案**:
```typescript
// 确保实现类包含所有接口属性
interface Session {
  sessionId: string;
  createdAt: Date;
}

class SessionImpl implements Session {
  sessionId: string;
  createdAt: Date;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.createdAt = new Date();
  }
}
```

### 2.3 泛型约束不足

**问题描述**: 泛型类型未定义足够的约束

**典型错误**:
```
Type 'T' cannot be used to index type 'Map<string, T>'
```

**解决方案**:
```typescript
// 错误写法
function getItem<T>(map: Map<string, T>, key: string): T | undefined {
  return map.get(key);
}

// 正确写法 - 添加泛型约束
function getItem<T extends object>(map: Map<string, T>, key: string): T | undefined {
  return map.get(key);
}
```

### 2.4 可选属性处理

**问题描述**: 访问可能为undefined的可选属性

**典型错误**:
```
Cannot read properties of undefined (reading 'name')
```

**解决方案**:
```typescript
// 使用可选链
const name = config?.name;

// 使用空值合并
const name = config?.name ?? 'default';

// 使用类型守卫
if (config && config.name) {
  processName(config.name);
}
```

---

## 3. Monorepo 类型修复策略

### 3.1 依赖顺序修复

在TypeScript Monorepo中，类型错误可能因依赖顺序导致：

```
@organic/utils (无依赖) → @organic/kernel (依赖utils) → @organic/plugins (依赖kernel)
```

**修复策略**:
1. 先修复底层包（utils）
2. 再修复中层包（kernel）
3. 最后修复上层包（plugins）
4. 使用 `pnpm build` 增量验证

### 3.2 类型导出规范化

确保每个包的 `src/index.ts` 正确导出所有公共类型：

```typescript
// packages/plugins/src/core-conversation/src/types/index.ts
export * from './session.js';
export * from './context.js';
export * from './input.js';
export * from './output.js';

// packages/plugins/src/core-conversation/src/errors/index.ts
export * from './ConversationError.js';
export * from './SessionError.js';
export * from './ContextError.js';
```

### 3.3 包间类型引用

使用 workspace 协议引用本地包：

```json
{
  "dependencies": {
    "@organic/kernel": "workspace:*",
    "@organic/utils": "workspace:*"
  }
}
```

---

## 4. 测试文件类型修复

### 4.1 Mock工厂函数

创建可复用的Mock工厂函数：

```typescript
// test-utils.ts
export function createMockSession(options?: Partial<SessionOptions>): Session {
  return {
    sessionId: `mock-session-${Date.now()}`,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    metadata: {},
    ...options
  };
}

export function createMockContext(
  overrides?: Partial<ConversationPluginContext>
): ConversationPluginContext {
  return {
    sessionId: 'mock-session',
    pluginId: 'mock-plugin',
    kernel_api: createMockKernelApi(),
    // ... 其他必需属性
    ...overrides
  };
}
```

### 4.2 深度Partial类型

测试中需要大量可选属性的场景：

```typescript
// 创建深度可选类型
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// 使用
const mockConfig: DeepPartial<Config> = {
  api: {
    timeout: 5000
  }
};
```

---

## 5. 验证与构建

### 5.1 构建验证命令

```bash
# 清理并重建
pnpm clean && pnpm build

# 仅类型检查（不生成输出）
pnpm typecheck

# 单包构建
cd packages/{package-name} && pnpm build
```

### 5.2 类型检查脚本

在 `package.json` 中添加：

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc && tsc --project tsconfig.build.json"
  }
}
```

---

## 6. 可复用代码片段

### 6.1 错误类定义模板

```typescript
// errors/BaseError.ts
export class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// errors/SpecificError.ts
export class SpecificError extends BaseError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'SPECIFIC_ERROR_CODE', details);
  }
}
```

### 6.2 Plugin类型定义模板

```typescript
// types/plugin.ts
import type { KernelApi, PluginContext } from '@organic/kernel';

export interface ConversationPluginContext extends PluginContext {
  kernel_api: KernelApi;
  conversation_service: ConversationService;
}

export interface ConversationPluginOptions {
  maxSessions?: number;
  defaultTimeout?: number;
  enableCompression?: boolean;
}

export interface ConversationPlugin {
  initialize(context: ConversationPluginContext): Promise<void>;
  execute(input: ConversationInput): Promise<ConversationOutput>;
  destroy(): Promise<void>;
}
```

---

## 7. 最佳实践总结

### 7.1 类型设计原则

| 原则 | 说明 |
|------|------|
| 明确required vs optional | 必需属性不能有默认值(undefined) |
| 使用接口组合 | 避免深层继承，优先使用组合 |
| 统一错误类型 | 继承BaseError，便于错误处理 |
| 导出一致性 | index.ts导出所有公共类型 |

### 7.2 测试类型原则

| 原则 | 说明 |
|------|------|
| Mock对象必须完整 | 包含所有必需属性 |
| 使用类型守卫 | 检查可选属性访问 |
| 工厂函数复用 | 减少重复的Mock定义 |

### 7.3 构建验证原则

| 原则 | 说明 |
|------|------|
| 从底层包开始 | utils → kernel → plugins → agent |
| 增量验证 | 每修复一批文件就验证一次 |
| 完整构建验证 | 最后执行 `pnpm build` 确认全部通过 |

---

## 8. 关联知识

| 关联文档 | 说明 |
|----------|------|
| [p0-tasks-execution-summary.md](p0-tasks-execution-summary.md) | P0级任务执行总结 |
| [execution-knowledge.md](execution-knowledge.md) | 任务执行规范与常见问题处理 |
| [monorepo-best-practices.md](monorepo-best-practices.md) | Monorepo管理经验 |

---

## 9. 更新历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-04-28 | 1.0.0 | 初始版本，记录TypeScript类型修复经验 |
| 2026-04-30 | 1.1.0 | task-P0-006补充ui包修复经验：接口属性必选化、索引签名模式 |

---

## 10. @organic/ui包修复 (task-P0-006)

### 10.1 任务概述

| 字段 | 值 |
|------|-----|
| 任务ID | task-P0-006 |
| 修复文件数 | 3 |
| 修复错误数 | 12 |
| 提交 | f0f6e3a |

### 10.2 修复详情

**Command.ts - 接口属性必选化**
```typescript
// 修复前
interface Command {
  name: string;
  subcommands?: Command[];
}

// 修复后
interface Command {
  name: string;
  subcommands: Command[];
}
```

**Table.test.ts - 索引签名**
```typescript
// 修复前
interface Person {
  name: string;
  age: number;
}

// 修复后
interface Person {
  name: string;
  age: number;
  [key: string]: any;  // 支持动态属性访问
}
```

**UIOperation.test.ts - 导入补全**
```typescript
import { beforeEach, describe, expect, it } from 'vitest';
```

### 10.3 ui包 vs agent包修复对比

| 对比项 | agent包 (task-P0-003) | ui包 (task-P0-006) |
|--------|----------------------|-------------------|
| 错误数量 | 91 | 12 |
| 主要问题 | Mock对象缺失属性 | 接口定义不一致、索引签名缺失 |
| 修复模式 | 类型断言、Partial补全 | 接口修改、索引签名 |

---

*整理者: Learner*
*整理时间: 2026-04-28*