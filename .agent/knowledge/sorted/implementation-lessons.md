# 实现经验教训

## 文档信息

| 字段 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 创建日期 | 2026-04-21 |
| 作者 | Learner |
| 描述 | Organic-Interface 项目实现过程中的经验教训总结 |

---

## 1. Monorepo 组织经验

### 1.1 包命名规范

**经验**: 使用语义明确的包名

| 推荐 | 不推荐 | 原因 |
|------|--------|------|
| `utils` | `shared` | `shared` 可能与 Node.js 内置模块冲突 |
| `utils` | `common` | `common` 命名过于宽泛 |
| `lib` | `core` | `core` 可用于特定场景 |

**项目应用**: 所有业务包使用 `@organic/{功能}` 命名格式

---

### 1.2 工作区依赖配置

**经验**: 使用 `workspace:*` 协议

```json
// package.json
{
  "dependencies": {
    "@organic/utils": "workspace:*",
    "@organic/kernel": "workspace:*"
  }
}
```

**优势**:
- 自动使用本地最新版本
- 无需手动维护版本号
- pnpm 自动处理依赖解析

---

### 1.3 TypeScript 配置

**经验**: 使用基础配置继承

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**各包配置**:
```json
// packages/utils/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

---

## 2. 模块设计经验

### 2.1 分层架构

**经验**: 严格的分层依赖

```
基础层 (utils) → 内核层 (kernel) → 功能层 (plugins/storage/tools)
                                              ↓
                                        业务层 (agent) → 展示层 (ui)
```

**优势**:
- 清晰的依赖关系
- 便于单元测试
- 支持独立开发

---

### 2.2 接口设计

**经验**: 使用 `index.ts` 统一导出

```typescript
// src/types/index.ts
export * from './Config.js';
export * from './Plugin.js';
export * from './Tool.js';

// src/index.ts
export * from './types/index.js';
export * from './errors/index.js';
export * from './utils/index.js';
```

**优势**:
- 提供统一的公共 API
- 便于重构内部结构
- 简化使用者导入

---

### 2.3 错误处理

**经验**: 统一错误类层次

```typescript
// utils/src/errors/BaseError.ts
export class BaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// 具体错误类
export class NotFoundError extends BaseError {
  constructor(resource: string, id: string) {
    super(
      `${resource} not found: ${id}`,
      'NOT_FOUND',
      { resource, id }
    );
  }
}
```

---

### 2.4 配置管理

**经验**: 使用配置对象模式

```typescript
// Kernel 构造器选项
interface KernelOptions {
  config: KernelConfig;
  logger?: Logger;
  debug?: boolean;
}

export class Kernel {
  constructor(options: KernelOptions) {
    this.config = { ...options.config };
    this.logger = options.logger ?? createLogger({ prefix: 'kernel' });
  }
}
```

**优势**:
- 明确的必需/可选参数
- 支持默认配置
- 便于扩展

---

## 3. 模块间集成经验

### 3.1 类型重导出

**经验**: 在入口文件中重导出依赖模块的类型

```typescript
// kernel/src/index.ts
import type {
  KernelConfig,
  PluginInterface,
  PluginContext,
} from '@organic/utils';

// Re-export for convenience
export type {
  KernelConfig,
  PluginInterface,
  PluginContext,
};
```

**优势**:
- 减少使用者的 import 路径
- 保持类型一致性
- 便于 API 演进

---

### 3.2 日志集成

**经验**: 统一的日志创建方式

```typescript
// 使用前缀区分模块
const logger = createLogger({ prefix: 'StorageManager' });

// 或使用模块名
import { createLogger } from '@organic/utils';
const logger = createLogger('StorageService');
```

---

### 3.3 生命周期管理

**经验**: 使用状态机模式管理生命周期

```typescript
// 定义状态枚举
export enum LifecycleState {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}
```

**优势**:
- 清晰的状态转换
- 防止非法状态操作
- 便于调试和监控

---

## 4. 存储模块特殊经验

### 4.1 多后端设计

**经验**: 使用抽象接口统一不同后端

```typescript
// 定义统一接口
export interface IStorageBackend {
  initialize(): Promise<void>;
  close(): Promise<void>;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

// 实现多种后端
export class MemoryStorage implements IStorageBackend { ... }
export class FileStorage implements IStorageBackend { ... }
export class DatabaseStorage implements IStorageBackend { ... }
```

---

### 4.2 工厂模式

**经验**: 使用工厂模式管理多个存储实例

```typescript
export class StorageManager {
  private backends: Map<string, BackendEntry> = new Map();

  async createStorage(name: string, type: StorageBackendType): Promise<StorageService> {
    const backend = this.createBackend(type);
    return new StorageService(backend);
  }
}
```

---

## 5. 任务状态管理经验

### 5.1 状态流转

**经验**: 任务必须伴随状态流转

```
pending → active → completed/failed
```

**关键操作**:
1. 更新任务文档状态字段
2. 将任务文档移动到对应目录
3. 记录完成时间

---

### 5.2 文档持久化

**经验**: 任务完成后必须验证

| 检查项 | 方法 |
|--------|------|
| 目标文件存在 | `ls docs/` |
| 内容完整 | 读取文件检查 |
| 状态已更新 | 检查文档状态字段 |
| 目录正确 | 检查文件位置 |

---

## 6. 最佳实践总结

| 类别 | 实践 | 说明 |
|------|------|------|
| 架构 | 分层设计 | 每层只依赖下层 |
| 包管理 | workspace:* | 使用工作区协议 |
| 类型 | 统一导出 | 使用 index.ts |
| 配置 | 选项对象 | 支持默认值 |
| 错误 | 层次结构 | 继承自 BaseError |
| 日志 | 统一工厂 | createLogger() |
| 测试 | 模块独立 | 支持单独测试 |
| 文档 | 状态追踪 | 记录进度和变更 |

---

## 更新历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-04-21 | 1.0.0 | 初始版本，记录实现经验 |