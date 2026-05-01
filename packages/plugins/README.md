# @organic/plugins - Plugin System Module

## 概述

`@organic/plugins` 是 Organic-Interface 的核心插件系统模块，采用 Kernel-Plugin 双层架构设计。Kernel 作为核心引擎提供基础服务，Plugin 作为功能扩展负责实现具体业务逻辑。

## 核心概念

### PluginInterface

所有插件必须实现的核心接口：

```typescript
interface PluginInterface {
  readonly name: string;
  readonly version: string;
  readonly description?: string;

  initialize(context: PluginContext): Promise<InitializeResult>;
  execute(input: PluginInput): Promise<PluginOutput>;
  shutdown(): Promise<void>;
}
```

### PluginContext

插件初始化时接收的上下文对象：

```typescript
interface PluginContext {
  /** Kernel API interface */
  kernel: KernelApi;
  /** Plugin configuration */
  config: PluginConfig;
}
```

### PluginMetadata

插件元数据定义：

```typescript
interface PluginMetadata {
  /** Plugin unique identifier */
  readonly id: string;
  /** Plugin name */
  readonly name: string;
  /** Plugin version (semver) */
  readonly version: string;
  /** Plugin description */
  readonly description?: string;
  /** Compatible API version */
  readonly apiVersion: string;
  /** Minimum kernel version required */
  readonly minKernelVersion?: string;
  /** Plugin dependencies */
  readonly dependencies?: PluginDependency[];
  /** Default configuration */
  readonly defaultConfig?: Record<string, unknown>;
  /** Lifecycle hooks */
  readonly hooks?: PluginHooks;
  /** Author information */
  readonly author?: string;
}
```

## 生命周期

插件具有完整的生命周期：`DISCOVERED → RESOLVED → LOADING → INITIALIZED → ACTIVE → RUNNING → SHUTTING_DOWN → SHUTDOWN`

### 初始化流程

1. **Discovery**: 系统扫描插件目录，发现可用插件
2. **Resolve**: 解析插件依赖关系，检测版本兼容性
3. **Loading**: 加载插件代码文件
4. **Initialize**: 调用 `initialize()` 方法，传递上下文

### 核心方法

#### initialize(context: PluginContext)

初始化插件，准备运行环境。

```typescript
async initialize(context: PluginContext): Promise<InitializeResult> {
  return { success: true };
}
```

#### execute(input: PluginInput)

执行插件动作，处理业务逻辑。

```typescript
async execute(input: PluginInput): Promise<PluginOutput> {
  return { success: true, data: result };
}
```

#### shutdown()

优雅关闭插件，清理资源。

```typescript
async shutdown(): Promise<void> {
  // cleanup resources
}
```

## 基础类

### BasePlugin

提供了 `PluginInterface` 的基础实现，所有自定义插件可以继承此类：

```typescript
import { BasePlugin } from '@organic/plugins';

class MyPlugin extends BasePlugin {
  constructor() {
    super({
      name: 'my-plugin',
      version: '1.0.0',
      description: 'My custom plugin',
      defaultConfig: { option: 'value' }
    });
  }

  protected async onInitialize(context: PluginContext): Promise<void> {
    // Custom initialization logic
  }

  protected async onExecute(input: PluginInput): Promise<unknown> {
    // Custom execution logic
    return { result: 'processed' };
  }

  protected async onShutdown(): Promise<void> {
    // Custom shutdown logic
  }
}
```

## 插件加载器

### PluginLoader

用于动态加载本地插件：

```typescript
import { PluginLoader } from '@organic/plugins';

const loader = new PluginLoader(registry);
const plugin = await loader.load('plugin-name');
await plugin.initialize(context);
```

### RemotePluginLoader

用于从远程源加载插件：

```typescript
import { RemotePluginLoader } from '@organic/plugins';

const remoteLoader = new RemotePluginLoader();
const plugin = await remoteLoader.loadFromUrl('https://example.com/plugin.tar.gz');
```

## 插件注册表

### PluginRegistry

管理所有已安装的插件：

```typescript
import { PluginRegistry } from '@organic/plugins';

const registry = new PluginRegistry();

// 注册插件
await registry.register(plugin);

// 搜索插件
const plugins = await registry.search('conversation');

// 列出已安装的插件
const installed = await registry.listInstalled();
```

## 内置插件

### core-conversation

核心对话插件，提供基于文本的 CLI 交互界面。

#### 插件信息

- **ID**: `core-conversation`
- **版本**: `1.0.0`
- **描述**: 核心对话插件，用于文本交互

#### 配置选项

```typescript
{
  maxSessionHistory: 100,        // 会话历史最大消息数
  defaultTimeout: 30000,         // 默认超时时间（毫秒）
  enableStreaming: false,        // 启用流式响应
  maxSessions: 100,              // 最大并发会话数
  defaultContextWindowSize: 50   // 默认上下文窗口大小
}
```

#### 支持的操作

| 操作 | 描述 | 参数 |
|------|------|------|
| `create_session` | 创建新会话 | `userId?: string`, `config?: SessionConfig` |
| `send_message` | 发送消息 | `text: string`, `sessionId?: string` |
| `resume_session` | 恢复会话 | `sessionId: string` |
| `close_session` | 关闭会话 | `sessionId?: string` |
| `list_sessions` | 列出所有会话 | `filter?: SessionFilter` |
| `get_session` | 获取会话信息 | `sessionId?: string` |
| `get_context` | 获取上下文窗口 | `sessionId?: string` |
| `clear_context` | 清除上下文 | `sessionId?: string` |
| `update_context` | 更新上下文 | `sessionId?: string`, `updates: Record<string, unknown>` |

#### 使用示例

```typescript
import { CoreConversationPlugin } from '@organic/plugins';

// 创建插件实例
const plugin = new CoreConversationPlugin();

// 初始化
await plugin.initialize({
  kernel: kernelApi,
  config: { maxSessions: 50 }
});

// 创建会话
const result = await plugin.execute({
  action: 'create_session',
  params: { userId: 'user-123' }
});

// 发送消息
const messageResult = await plugin.execute({
  action: 'send_message',
  params: {
    text: 'Hello, world!',
    sessionId: result.data.session.id
  }
});

// 关闭会话
await plugin.execute({
  action: 'close_session',
  params: { sessionId: result.data.session.id }
});

// 关闭插件
await plugin.shutdown();
```

#### 核心组件

**SessionManager**: 管理会话的生命周期，包括创建、恢复、关闭和状态跟踪。

**ContextManager**: 管理对话上下文，支持上下文窗口管理和消息历史。

**InputParser**: 解析用户输入，支持命令识别和意图提取。

**OutputFormatter**: 格式化输出结果，支持多种格式和样式。

## 错误处理

### 错误类型

| 错误类型 | 描述 |
|----------|------|
| `ConversationError` | 对话相关错误 |
| `SessionError` | 会话相关错误 |
| `ContextError` | 上下文相关错误 |

### 错误代码

```typescript
enum ConversationErrorCode {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',
  TIMEOUT = 'TIMEOUT'
}
```

## 开发新插件

### 步骤 1: 创建插件目录结构

```
packages/plugins/src/my-plugin/
├── package.json
├── src/
│   └── index.ts
└── README.md
```

### 步骤 2: 实现 PluginInterface

```typescript
import type { PluginInterface, PluginContext, PluginInput, PluginOutput, InitializeResult } from '@organic/utils';

export class MyPlugin implements PluginInterface {
  readonly name = 'my-plugin';
  readonly version = '1.0.0';
  readonly description = 'My custom plugin';

  async initialize(context: PluginContext): Promise<InitializeResult> {
    // Initialize plugin
    return { success: true };
  }

  async execute(input: PluginInput): Promise<PluginOutput> {
    // Execute action
    return { success: true, data: {} };
  }

  async shutdown(): Promise<void> {
    // Cleanup
  }
}
```

### 步骤 3: 定义元数据

```typescript
export const METADATA = {
  id: 'my-plugin',
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom plugin',
  apiVersion: '1.0.0',
  minKernelVersion: '1.0.0',
  dependencies: [],
  defaultConfig: {}
};
```

### 步骤 4: 导出插件

```typescript
export { MyPlugin } from './src/index.js';
export { METADATA } from './src/index.js';
```

### 步骤 5: 测试插件

```typescript
import { describe, it, expect } from 'vitest';
import { MyPlugin } from './src/index.js';

describe('MyPlugin', () => {
  it('should initialize successfully', async () => {
    const plugin = new MyPlugin();
    const result = await plugin.initialize({ kernel: {}, config: {} });
    expect(result.success).toBe(true);
  });
});
```

## API 参考

### 导出类型

```typescript
// Plugin 相关类型
export type {
  PluginInterface,
  PluginMetadata,
  PluginDependency,
  PluginHooks,
  PluginLifecycleState,
  PluginConfig,
  ValidateResult,
  ValidationError,
  PluginStatus,
  PluginStats,
  PluginContext,
  PluginInput,
  PluginOutput,
  InitializeResult
};

// Loader 相关类型
export type {
  PluginLoaderInterface,
  PluginLoaderOptions,
  PluginLoadResult,
  PluginDiscoveryResult,
  CompatibilityResult,
  CompatibilityIssue,
  RemotePluginSource,
  RemotePluginLoadResult
};

// Registry 相关类型
export type {
  PluginInfo,
  PluginSearchOptions,
  InstallResult,
  UpgradeResult,
  RegistryEvent
};
```

### 导出类

```typescript
export { PluginLoader } from './loaders/PluginLoader.js';
export { RemotePluginLoader } from './loaders/RemotePluginLoader.js';
export { PluginRegistry } from './registry/PluginRegistry.js';
export { BasePlugin } from './base/BasePlugin.js';
export { CoreConversationPlugin } from './core-conversation/src/index.js';
```

### 导出常量

```typescript
export const VERSION = '0.1.0';
```