# 功能文档：Skills (Plugin/Extension) 开发指南

## 基本信息

**文档编号**: DOC-019
**所属模块**: 插件系统架构
**优先级**: P1
**创建日期**: 2026-07-03
**对应需求章节**: 3.3 可扩展性需求

---

## 1. 概述

### 1.1 插件系统概念

Organic Interface 的插件系统（Skills 系统）是核心扩展机制，采用 Kernel-Plugin 双层架构设计：

- **Kernel**：系统核心引擎，提供基础服务、工具调用、生命周期管理
- **Plugin**：功能扩展单元，实现具体业务逻辑和用户交互

这种设计遵循关注点分离原则：Kernel 专注调度和基础服务，Plugin 专注业务功能，二者可以独立演进。

### 1.2 为什么需要插件系统

插件系统带来以下核心优势：

- **灵活扩展**：新增功能只需开发新插件，无需修改 Kernel 代码
- **独立版本控制**：插件可以独立于 Kernel 进行版本迭代和发布
- **动态加载**：支持运行时动态加载、卸载、升级插件
- **按需启用**：用户可以根据需求启用或禁用特定功能
- **生态共建**：第三方开发者可以贡献自己的插件，扩展系统能力

### 1.3 可以构建什么类型的插件

Organic Interface 插件系统支持多种类型的功能扩展：

| 插件类型       | 描述                        | 示例                              |
| -------------- | --------------------------- | --------------------------------- |
| **工具插件**   | 扩展 Kernel 的工具调用能力  | 文件搜索工具、Git 工具、Lint 工具 |
| **对话插件**   | 扩展对话能力和用户交互模式  | 代码评审插件、文档生成插件        |
| **UI 插件**    | 添加新的 TUI 组件和界面元素 | 自定义仪表盘、交互式预览          |
| **工作流插件** | 实现自动化工作流            | 代码审查工作流、发布流程          |
| **集成插件**   | 集成外部服务和系统          | GitHub 集成、Jira 集成            |

---

## 2. 插件架构

### 2.1 Plugin ↔ Kernel 关系

```
┌─────────────────────────────────────────────────────────────┐
│                      Kernel (核心引擎)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ 信息服务    │ │  工具服务    │ │ 事件总线    │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│                    ↑ ↓                   ↑ ↓                  │
│              ┌───────────────┐   ┌───────────────┐            │
│              │  PluginManager│   │  PluginLoader│            │
│              └───────────────┘   └───────────────┘            │
└─────────────────────────────────────────────────────────────┘
                    ↑ ↓        ↑ ↓        ↑ ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Plugin A    │ │  Plugin B    │ │  Plugin C    │ │  Plugin D    │
│  (工具插件)  │ │ (对话插件)   │ │  (UI 插件)   │ │ (工作流插件) │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Kernel 职责：**

- 提供 Kernel API 接口（`KernelApi`）供插件调用
- 管理插件完整生命周期（从发现到卸载）
- 提供基础服务：信息查询、工具执行、日志输出
- 处理插件间通信和事件广播

**Plugin 职责：**

- 实现具体业务功能
- 通过标准接口与 Kernel 交互
- 管理自身状态和资源
- 遵守生命周期约定，正确初始化和清理

### 2.2 完整生命周期状态流转

```
┌────────────┐
│ DISCOVERED │  ← 插件被发现，读取元数据完成
└──────┬─────┘
       ↓
┌────────────┐
│  RESOLVED  │  ← 依赖解析完成，兼容性验证通过
└──────┬─────┘
       ↓
┌────────────┐
│  LOADING   │  ← 正在加载代码模块，创建实例
└──────┬─────┘
       ↓
┌────────────┐
│ INITIALIZED│  ← initialize() 执行成功，准备就绪
└──────┬─────┘
       ↓
┌────────────┐
│   ACTIVE   │  ← 插件激活，可以接收请求
└──────┬─────┘
       ↓
┌────────────┐
│  RUNNING   │  ← 正在执行 execute()
└──────┬─────┘
       ↓
┌────────────┐
│SHUTTING_DOWN│ ← 正在关闭，清理资源
└──────┬─────┘
       ↓
┌────────────┐
│  SHUTDOWN  │  ← 关闭完成
└──────┬─────┘
       ↓
┌────────────┐
│  UNLOADED  │  ← 从内存卸载完成
└────────────┘
```

任何阶段发生错误都会进入 `ERROR` 状态：

```
┌────────────┐
│   ERROR    │  ← 发生错误，记录错误信息
└────────────┘
```

### 2.3 插件间通信

插件通过 Kernel 的事件总线进行通信：

- **点对点通信**：通过 `getPlugin()` 获取插件实例直接调用
- **事件订阅**：订阅 Kernel 事件总线的事件，实现松耦合

---

## 3. 入门：创建一个最小插件

### 3.1 项目结构

最简单的插件项目结构：

```
my-first-plugin/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

### 3.2 package.json 配置

```json
{
  "name": "my-first-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "dependencies": {
    "@organic/utils": "workspace:*"
  },
  "organic": {
    "plugin": true,
    "api_version": "1.0.0"
  }
}
```

### 3.3 最小插件实现

```typescript
// src/index.ts
import { BasePlugin } from '@organic/plugins';
import type { PluginInput, PluginOutput } from '@organic/utils';

/**
 * 我的第一个插件 - 问候插件
 */
export class GreetingPlugin extends BasePlugin {
  constructor() {
    super({
      name: 'greeting',
      version: '1.0.0',
      description: '一个简单的问候插件',
      apiVersion: '1.0.0',
      defaultConfig: {
        defaultName: 'World',
        uppercase: false,
      },
      hooks: {
        onLoad: () => console.log('Greeting plugin loaded'),
        onUnload: () => console.log('Greeting plugin unloaded'),
      },
    });
  }

  protected override async onExecute(input: PluginInput): Promise<unknown> {
    const { action, params } = input;

    if (action === 'greet') {
      const name = (params?.name as string) || (this.config.defaultName as string);
      let message = `Hello, ${name}!`;

      if (this.config.uppercase as boolean) {
        message = message.toUpperCase();
      }

      return { message };
    }

    throw new Error(`Unknown action: ${action}`);
  }
}

// 默认导出插件类
export default GreetingPlugin;
```

这就完成了一个可运行的插件！`BasePlugin` 提供了所有默认实现，你只需要重写 `onExecute` 处理你的业务逻辑。

### 3.4 加载和使用插件

```typescript
// 在应用中加载插件
import { Kernel } from '@organic/kernel';
import { PluginLoader } from '@organic/plugins';

const kernel = new Kernel({
  config: { name: 'my-app', version: '0.1.0' },
});

await kernel.initialize();

// 使用 PluginLoader 加载插件
const loader = new PluginLoader({ baseDir: './plugins' });
const result = await loader.load('my-first-plugin');

if (result.success) {
  // 注册到 Kernel
  await kernel.registerPlugin(result.plugin);

  // 执行插件动作
  const output = await kernel.executePlugin('greeting', {
    action: 'greet',
    params: { name: 'Organic' },
  });

  console.log(output);
  // => { success: true, data: { message: "Hello, Organic!" } }
}
```

---

## 4. 插件接口规范

### 4.1 PluginInterface 核心契约

所有插件必须实现 `PluginInterface` 接口：

```typescript
export interface PluginInterface {
  /** 插件唯一名称 */
  readonly name: string;
  /** 插件版本 */
  readonly version: string;
  /** 插件描述 */
  readonly description?: string;

  /**
   * 初始化插件
   * @param context 插件上下文，包含 Kernel API 和配置
   */
  initialize(context: PluginContext): Promise<InitializeResult>;

  /**
   * 执行插件动作
   * @param input 输入，包含动作名称和参数
   */
  execute(input: PluginInput): Promise<PluginOutput>;

  /**
   * 关闭插件，清理资源
   */
  shutdown(): Promise<void>;

  /**
   * 获取插件元数据（可选，扩展接口要求）
   */
  getMetadata?(): PluginMetadata;

  /**
   * 验证配置（可选，扩展接口要求）
   */
  validateConfig?(config: Record<string, unknown>): Promise<ValidateResult>;
}
```

### 4.2 PluginMetadata 元数据结构

```typescript
export interface PluginMetadata {
  /** 插件唯一标识符 */
  readonly id: string;
  /** 插件显示名称 */
  readonly name: string;
  /** 插件版本（semver） */
  readonly version: string;
  /** 插件描述 */
  readonly description?: string;
  /** 兼容的 API 版本 */
  readonly apiVersion: string;
  /** 要求的最低 Kernel 版本 */
  readonly minKernelVersion?: string;
  /** 插件依赖列表 */
  readonly dependencies?: PluginDependency[];
  /** 默认配置 */
  readonly defaultConfig?: Record<string, unknown>;
  /** 生命周期钩子 */
  readonly hooks?: PluginHooks;
  /** 作者信息 */
  readonly author?: string;
}
```

### 4.3 PluginDependency 依赖定义

```typescript
export interface PluginDependency {
  /** 依赖的插件名称 */
  pluginName: string;
  /** 版本范围（遵循 semver） */
  versionRange: string;
  /** 是否为可选依赖 */
  optional?: boolean;
}
```

示例：

```typescript
const dependencies = [
  { pluginName: 'git-tools', versionRange: '^1.0.0', optional: false },
  { pluginName: 'lint-tools', versionRange: '>=2.0.0', optional: true },
];
```

### 4.4 PluginHooks 生命周期钩子

```typescript
export interface PluginHooks {
  /** 插件加载完成后调用 */
  onLoad?: () => void | Promise<void>;
  /** 插件卸载前调用 */
  onUnload?: () => void | Promise<void>;
  /** 发生错误时调用 */
  onError?: (error: Error) => void;
  /** 配置变更时调用 */
  onConfigChange?: (config: Record<string, unknown>) => void;
}
```

### 4.5 类型汇总

| 类型                   | 说明             |
| ---------------------- | ---------------- |
| `PluginLifecycleState` | 生命周期状态枚举 |
| `PluginConfig`         | 初始化配置       |
| `PluginStatus`         | 插件状态信息     |
| `PluginStats`          | 执行统计信息     |
| `PluginContext`        | 初始化上下文     |
| `PluginInput`          | 执行输入         |
| `PluginOutput`         | 执行输出         |
| `InitializeResult`     | 初始化结果       |

---

## 5. 插件生命周期

### 5.1 完整状态说明

| 状态            | 说明                                     |
| --------------- | ---------------------------------------- |
| `DISCOVERED`    | 插件已被发现，元数据已读取，等待依赖解析 |
| `RESOLVED`      | 依赖解析完成，兼容性验证通过，准备加载   |
| `LOADING`       | 正在加载代码模块，创建插件实例           |
| `INITIALIZED`   | `initialize()` 执行成功，插件已准备就绪  |
| `ACTIVE`        | 插件已激活，可以接收和处理请求           |
| `RUNNING`       | 插件正在执行 `execute()`，处理请求中     |
| `SHUTTING_DOWN` | 正在关闭插件，清理资源中                 |
| `SHUTDOWN`      | 关闭完成，等待卸载                       |
| `ERROR`         | 发生错误，包含错误信息                   |
| `UNLOADED`      | 已从内存卸载完成                         |

### 5.2 生命周期回调顺序

```typescript
// 1. 构造函数
constructor(options: BasePluginOptions) {
  // 只做最小化初始化，不要做耗时操作
  // 耗时操作放到 onInitialize
}

// 2. 初始化
async initialize(context: PluginContext): Promise<InitializeResult> {
  // BasePlugin 会：
  // - 保存 Kernel API 引用
  // - 合并配置（默认 + 用户提供）
  // - 调用 onLoad 钩子
  // - 调用 onInitialize
  // 返回 { success: true } 或 { success: false, error: message }
}

// 3. 用户自定义初始化
protected async onInitialize(context: PluginContext): Promise<void> {
  // 在这里进行实际的初始化工作
  // - 连接数据库
  // - 注册工具
  // - 预热缓存
}

// 4. 执行请求
async execute(input: PluginInput): Promise<PluginOutput> {
  // BasePlugin 会：
  // - 检查是否已初始化
  // - 调用 onExecute
  // - 捕获异常并调用 onError 钩子
  // - 返回标准化输出
}

// 5. 用户自定义执行
protected async onExecute(input: PluginInput): Promise<unknown> {
  // 在这里处理具体业务逻辑
  // 返回结果数据，会被包装到 PluginOutput
}

// 6. 关闭
async shutdown(): Promise<void> {
  // BasePlugin 会：
  // - 调用 onUnload 钩子
  // - 调用 onShutdown
  // - 标记为未初始化
}

// 7. 用户自定义关闭
protected async onShutdown(): Promise<void> {
  // 在这里清理资源
  // - 关闭连接
  // - 保存状态
  // - 清理定时器
}
```

---

## 6. 插件上下文

### 6.1 PluginContext 结构

```typescript
export interface PluginContext {
  /** Kernel API 接口，插件可以调用 Kernel 提供的服务 */
  kernel: KernelApi;
  /** 插件配置 */
  config: PluginConfig;
}
```

### 6.2 KernelApi 可用接口

```typescript
export interface KernelApi {
  /** 获取 Kernel 配置 */
  getConfig(): KernelConfig;

  /** 获取 Kernel 版本 */
  getVersion(): string;

  /** 文本输出服务（用于 CLI 格式化） */
  text: TextServiceInterface;

  /** 信息服务（获取系统和项目信息） */
  info: InfoServiceInterface;

  /** 注册一个插件 */
  registerPlugin(plugin: PluginInterface): Promise<void>;

  /** 注销一个插件 */
  unregisterPlugin(name: string): Promise<void>;

  /** 根据名称获取插件 */
  getPlugin(name: string): PluginInterface | undefined;

  /** 列出所有已注册插件 */
  listPlugins(): PluginInterface[];

  /** 执行工具 */
  executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult>;
}
```

### 6.3 TextServiceInterface 文本服务

```typescript
export interface TextServiceInterface {
  /** 打印文本到标准输出 */
  print(text: string, options?: unknown): void;

  /** 打印文本并换行 */
  println(text?: string): void;

  /** 格式化为表格 */
  formatTable(data: unknown, options?: unknown): string;

  /** 格式化为列表 */
  formatList(items: string[], options?: unknown): string;

  /** 格式化分区（标题 + 内容） */
  formatSection(title: string, content: string): string;

  /** 应用样式 */
  styled(text: string, style: unknown): string;

  /** 成功样式文本 */
  success(text: string): string;

  /** 错误样式文本 */
  error(text: string): string;

  /** 警告样式文本 */
  warning(text: string): string;

  /** 信息样式文本 */
  info(text: string): string;

  /** 创建文本流（用于流式输出） */
  createStream(options?: unknown): unknown;

  /** 进度条 */
  progress(current: number, total: number, message?: string): string;

  /** 创建加载 spinner */
  spinner(type?: string): unknown;
}
```

### 6.4 InfoServiceInterface 信息服务

```typescript
export interface InfoServiceInterface {
  /** 获取系统配置 */
  getConfig(key: string): unknown;

  /** 获取所有配置 */
  getAllConfigs(): Record<string, unknown>;

  /** 获取运行时信息 */
  getRuntimeInfo(): unknown;

  /** 获取项目上下文 */
  getProjectContext(): unknown;

  /** 获取项目根目录 */
  getProjectRoot(): string;

  /** 获取项目名称 */
  getProjectName(): string;

  /** 获取项目版本 */
  getProjectVersion(): string;

  /** 获取系统信息 */
  getSystemInfo(): unknown;

  /** 获取平台信息 */
  getPlatformInfo(): unknown;

  /** 获取环境变量 */
  getEnv(key: string): string | undefined;

  /** 获取所有环境变量 */
  getAllEnvs(): Record<string, string>;
}
```

### 6.5 PluginInput 执行输入

```typescript
export interface PluginInput {
  /** 要执行的动作名称 */
  action: string;

  /** 动作参数 */
  params?: Record<string, unknown>;
}
```

示例：

```typescript
const input = {
  action: 'greet',
  params: {
    name: 'Alice',
    uppercase: true,
  },
};
```

### 6.6 PluginOutput 执行输出

```typescript
export interface PluginOutput {
  /** 执行是否成功 */
  success: boolean;

  /** 成功时返回结果数据 */
  data?: unknown;

  /** 失败时返回错误信息 */
  error?: string;
}
```

成功示例：

```typescript
{
  success: true,
  data: { message: "Hello, Alice!" }
}
```

失败示例：

```typescript
{
  success: false,
  error: "Name cannot be empty"
}
```

---

## 7. BasePlugin 基类使用

### 7.1 BasePlugin 提供的默认实现

`BasePlugin` 是一个抽象基类，提供了：

- 默认的 `initialize()`、`execute()`、`shutdown()` 实现
- 配置合并和默认配置处理
- 内置配置验证支持
- 钩子自动调用
- 错误处理包装

你只需要继承 `BasePlugin`，选择性重写需要自定义的方法即可。

### 7.2 BasePluginOptions 配置选项

```typescript
export interface BasePluginOptions {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description?: string;
  /** API 版本 */
  apiVersion?: string;
  /** 最低 Kernel 版本 */
  minKernelVersion?: string;
  /** 默认配置 */
  defaultConfig?: Record<string, unknown>;
  /** 生命周期钩子 */
  hooks?: {
    onLoad?: () => void | Promise<void>;
    onUnload?: () => void | Promise<void>;
    onError?: (error: Error) => void;
    onConfigChange?: (config: Record<string, unknown>) => void;
  };
}
```

### 7.3 可重写的方法

| 方法                | 说明                | 默认实现                         |
| ------------------- | ------------------- | -------------------------------- |
| `onInitialize()`    | 自定义初始化逻辑    | 空实现，需要子类重写             |
| `onExecute()`       | 自定义执行逻辑      | 返回 `not implemented`，必须重写 |
| `onShutdown()`      | 自定义关闭清理逻辑  | 空实现                           |
| `getConfigSchema()` | 返回配置验证 schema | undefined，不验证                |
| `validateConfig()`  | 验证配置            | 使用 schema 进行默认验证         |

### 7.4 子类可用的保护方法

| 方法              | 说明             |
| ----------------- | ---------------- |
| `updateConfig()`  | 更新配置         |
| `getConfig()`     | 获取当前配置     |
| `isInitialized()` | 检查是否已初始化 |

### 7.5 完整示例

```typescript
import { BasePlugin } from '@organic/plugins';
import type { PluginInput } from '@organic/utils';

export class MyPlugin extends BasePlugin {
  constructor() {
    super({
      name: 'my-plugin',
      version: '1.0.0',
      description: 'My custom plugin',
      defaultConfig: {
        enabled: true,
        maxItems: 10,
        timeout: 5000,
      },
    });
  }

  protected getConfigSchema() {
    return {
      enabled: { type: 'boolean', required: false, default: true },
      maxItems: { type: 'number', required: false, default: 10 },
      timeout: { type: 'number', required: true },
    };
  }

  protected async onInitialize(): Promise<void> {
    // 初始化资源
    this.kernel; // 可以访问 Kernel API
    this.config; // 可以访问当前配置
  }

  protected async onExecute(input: PluginInput): Promise<unknown> {
    const { action, params } = input;

    switch (action) {
      case 'doSomething':
        return this.doSomething(params);
      case 'getInfo':
        return this.getInfo();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  protected async onShutdown(): Promise<void> {
    // 清理资源
  }

  private doSomething(params: Record<string, unknown>) {
    // 实际业务逻辑
    return { result: 'done' };
  }

  private getInfo() {
    return {
      config: this.getConfig(),
      initialized: this.isInitialized(),
    };
  }
}
```

---

## 8. 插件配置

### 8.1 PluginConfig 结构

```typescript
export interface PluginConfig {
  /** 插件 ID */
  pluginId: string;
  /** 配置覆盖 */
  config?: Record<string, unknown>;
  /** 默认是否启用 */
  enabled?: boolean;
  /** 加载顺序优先级 */
  priority?: number;
}
```

### 8.2 配置加载优先级

配置按以下优先级合并（从低到高，后面覆盖前面）：

1. 插件 `defaultConfig`（插件默认）
2. 系统级配置
3. 项目级配置
4. 用户级配置
5. 运行时传入配置

### 8.3 配置验证

`BasePlugin` 内置配置验证支持。只需要提供 `getConfigSchema()`：

```typescript
protected getConfigSchema() {
  return {
    apiKey: {
      type: 'string',
      required: true,
      description: 'API key for external service',
    },
    timeout: {
      type: 'number',
      required: false,
      default: 30000,
      description: 'Request timeout in milliseconds',
    },
    enabled: {
      type: 'boolean',
      required: false,
      default: true,
    },
  };
}
```

验证结果格式：

```typescript
export interface ValidateResult {
  valid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  expected?: string;
  actual?: unknown;
}
```

### 8.4 监听配置变化

通过 `onConfigChange` 钩子监听配置更新：

```typescript
constructor() {
  super({
    name: 'my-plugin',
    // ...
    hooks: {
      onConfigChange: (newConfig) => {
        // 重新初始化连接
        this.reconnect(newConfig.apiKey);
      },
    },
  });
}
```

---

## 9. 插件钩子

### 9.1 可用钩子列表

| 钩子             | 调用时机       | 参数         |
| ---------------- | -------------- | ------------ |
| `onLoad`         | 初始化完成后   | 无           |
| `onUnload`       | 卸载前         | 无           |
| `onError`        | 执行发生错误时 | `Error` 对象 |
| `onConfigChange` | 配置更新后     | 新配置对象   |

### 9.2 使用示例

```typescript
export class DatabasePlugin extends BasePlugin {
  private connection: Connection | null = null;

  constructor() {
    super({
      name: 'database',
      version: '1.0.0',
      defaultConfig: {
        host: 'localhost',
        port: 5432,
      },
      hooks: {
        onLoad: async () => {
          // 初始化连接
          this.connection = await this.connect(this.config);
        },
        onUnload: async () => {
          // 关闭连接
          await this.connection?.close();
        },
        onError: error => {
          // 记录错误到日志
          console.error('[database]', error);
        },
        onConfigChange: async newConfig => {
          // 重新连接使用新配置
          await this.connection?.close();
          this.connection = await this.connect(newConfig);
        },
      },
    });
  }
}
```

---

## 10. 插件依赖

### 10.1 声明依赖

在元数据中声明依赖：

```typescript
const metadata: PluginMetadata = {
  id: 'my-plugin',
  name: 'my-plugin',
  version: '1.0.0',
  // ...
  dependencies: [
    {
      pluginName: 'authentication',
      versionRange: '^2.0.0',
      optional: false,
    },
    {
      pluginName: 'logging',
      versionRange: '>=1.0.0',
      optional: true,
    },
  ],
};
```

或者通过 `BasePluginOptions`：

```typescript
// BasePlugin 会自动将 dependencies 放入 metadata
```

### 10.2 使用其他插件

```typescript
protected async onInitialize(): Promise<void> {
  // 获取依赖插件
  const authPlugin = this.kernel!.getPlugin('authentication');

  if (!authPlugin) {
    throw new Error('Required plugin "authentication" not found');
  }

  // 调用依赖插件的方法
  const result = await authPlugin.execute({
    action: 'getToken',
    params: { scope: 'read' },
  });

  if (result.success && result.data) {
    this.token = result.data.token as string;
  }
}
```

### 10.3 可选依赖处理

```typescript
protected async onInitialize(): Promise<void> {
  const logging = this.kernel!.getPlugin('logging');

  if (logging) {
    // 使用可选插件提供的增强功能
    this.logger = (msg: string) => {
      logging.execute({ action: 'log', params: { message: msg } });
    };
  } else {
    // 降级到默认实现
    this.logger = (msg: string) => console.log(msg);
  }
}
```

---

## 11. 插件加载

### 11.1 PluginLoader（本地加载）

`PluginLoader` 从本地文件系统加载插件：

```typescript
import { PluginLoader } from '@organic/plugins';

const loader = new PluginLoader({
  baseDir: './plugins', // 插件根目录
  cacheEnabled: true, // 启用缓存
  cacheTtl: 300000, // 缓存 TTL（5 分钟）
});
```

主要方法：

| 方法                      | 说明                 |
| ------------------------- | -------------------- |
| `load(pluginId, config?)` | 加载插件             |
| `unload(pluginId)`        | 卸载插件             |
| `reload(pluginId)`        | 重新加载插件         |
| `discover()`              | 发现目录中的所有插件 |
| `isLoaded(pluginId)`      | 检查是否已加载       |
| `listLoaded()`            | 列出所有已加载插件   |
| `getStatus(pluginId)`     | 获取插件状态         |

### 11.2 发现插件

```typescript
const results = await loader.discover();

for (const result of results) {
  if (result.success) {
    console.log(`Found plugin: ${result.pluginId} v${result.metadata?.version}`);
  } else {
    console.error(`Failed to discover ${result.pluginId}: ${result.error}`);
  }
}
```

发现结果包含：

```typescript
export interface PluginDiscoveryResult {
  pluginId: string;
  source: string; // 插件路径
  metadata?: PluginMetadata; // 解析出的元数据
  discoveredAt: number;
  success: boolean;
  error?: string;
}
```

### 11.3 RemotePluginLoader（远程加载）

`RemotePluginLoader` 从远程源加载插件：

```typescript
import { RemotePluginLoader } from '@organic/plugins';

const remoteLoader = new RemotePluginLoader({
  installDir: './plugins/remote', // 安装目录
  registryUrl: 'https://registry.organic.example.com', // 注册中心地址
  timeout: 30000, // 网络超时
  verifySsl: true, // SSL 验证
});
```

支持的源类型：

| 类型   | 说明                 | 状态        |
| ------ | -------------------- | ----------- |
| `http` | 从 HTTP/HTTPS 下载   | ✅ 已实现   |
| `npm`  | 从 NPM registry 安装 | ⚠️ 占位实现 |
| `git`  | 从 Git 仓库克隆      | ⚠️ 占位实现 |
| `file` | 本地文件             | ✅ 已实现   |

注册远程源：

```typescript
remoteLoader.registerSource('my-remote-plugin', {
  pluginId: 'my-remote-plugin',
  url: 'https://example.com/plugins/my-plugin-1.0.0.js',
  type: 'http',
  version: '1.0.0',
  checksum: 'sha256:...',
});

// 加载（会自动下载安装）
const result = await remoteLoader.load('my-remote-plugin');
```

### 11.4 兼容性验证

加载器会自动验证插件兼容性：

```typescript
const result = await loader.validateCompatibility(metadata);

console.log('Compatible:', result.compatible);

if (!result.compatible) {
  result.issues?.forEach(issue => {
    console.log(`${issue.severity}: ${issue.message}`);
  });
}
```

问题严重性：

- `error` - 不兼容，不能加载
- `warning` - 警告，可以加载但可能有问题
- `info` - 信息提示

---

## 12. 插件注册表

### 12.1 PluginRegistry 功能

`PluginRegistry` 是插件的中央注册表，提供：

- 插件信息存储和查询
- 搜索和过滤
- 安装/升级/卸载管理
- 事件通知

```typescript
import { PluginRegistry } from '@organic/plugins';
import { PluginLoader } from '@organic/plugins';

const loader = new PluginLoader({ baseDir: './plugins' });
const registry = new PluginRegistry(loader);
```

### 12.2 注册和查询

```typescript
// 注册插件
const pluginInfo = registry.register('my-plugin', metadata, '/path/to/plugin', { enabled: true });

// 查询
console.log(registry.isRegistered('my-plugin')); // true
console.log(registry.getPluginInfo('my-plugin')); // PluginInfo

// 列出所有插件
const all = registry.listAll();
const enabled = registry.listEnabled();
const disabled = registry.listDisabled();

// 搜索插件
const results = registry.search({
  name: 'tool', // 名称包含 "tool"
  enabled: true, // 已启用
  minVersion: '1.0.0', // 最低版本 1.0.0
  hasDependency: 'core', // 依赖 core
});
```

### 12.3 安装和升级

```typescript
// 发现并注册所有可用插件
const results = await registry.discoverPlugins();

// 加载插件
const loadResult = await registry.load('my-plugin', {
  enabled: true,
  config: { apiKey: 'xxx' },
});

// 启用/禁用
registry.enable('my-plugin');
registry.disable('my-plugin');

// 卸载
await registry.unload('my-plugin');
registry.unregister('my-plugin');
```

### 12.4 注册表事件

订阅注册表事件：

```typescript
// 订阅事件
const unsubscribe = registry.on('plugin:registered', event => {
  console.log(`Plugin registered: ${event.data.pluginId}`);
});

// 只订阅一次
registry.once('plugin:loaded', event => {
  console.log(`Plugin loaded: ${event.data.pluginId}`);
});

// 取消订阅
unsubscribe();
```

可用事件：

| 事件                    | 说明         |
| ----------------------- | ------------ |
| `plugin:registered`     | 插件已注册   |
| `plugin:unregistered`   | 插件已注销   |
| `plugin:loaded`         | 插件已加载   |
| `plugin:unloaded`       | 插件已卸载   |
| `plugin:enabled`        | 插件已启用   |
| `plugin:disabled`       | 插件已禁用   |
| `plugin:status_changed` | 状态变更     |
| `registry:cleared`      | 注册表已清空 |

事件格式：

```typescript
export interface RegistryEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}
```

---

## 13. 实例：CoreConversationPlugin 对话插件

`CoreConversationPlugin` 是一个完整的生产级插件实例，展示了最佳实践。

### 13.1 整体架构

```
CoreConversationPlugin/
├── CoreConversationPlugin.ts    # 主插件类
├── SessionManager.ts            # 会话管理器
├── ContextManager.ts            # 上下文管理器
├── InputParser.ts               # 输入解析器
├── OutputFormatter.ts           # 输出格式化器
├── errors/                      # 自定义错误类型
└── types/                       # 类型定义
```

### 13.2 组件职责

**SessionManager** - 管理会话生命周期：

- 创建、恢复、关闭会话
- 过期会话自动清理
- 支持持久化存储后端
- 按用户分组索引

```typescript
const sessionManager = new SessionManager({
  maxSessions: 100,
  defaultTtl: 30 * 60 * 1000, // 30 分钟
  cleanupInterval: 5 * 60 * 1000, // 每 5 分钟清理
});

const session = await sessionManager.createSession({
  userId: 'user-123',
  config: { title: 'My Session' },
});
```

**ContextManager** - 管理对话上下文：

- 维护消息历史
- 支持多种上下文窗口策略（最近 N 条、Token 限制、语义选择）
- 自动压缩避免上下文溢出
- 支持上下文更新和清除

```typescript
const contextManager = new ContextManager({
  maxMessages: 1000,
  autoCompress: true,
});

await contextManager.addMessage(sessionId, message);
const contextWindow = await contextManager.getContextWindow(sessionId, {
  windowSize: 50,
  windowType: ContextWindowType.RECENT_MESSAGES,
  includeSystemMessages: true,
});
```

**InputParser** - 解析用户输入：

- 区分纯文本和命令
- 支持 `/command` 格式
- 支持 `key: value` 参数解析
- 自动意图提取

```typescript
const parser = new InputParser({
  maxLength: 10000,
  enableCommands: true,
  enableIntentExtraction: true,
});

const parsed = parser.parse('/greet name:Alice');
// parsed.type === InputType.COMMAND
// parsed.command === 'greet'
// parsed.arguments === { name: 'Alice' }
```

**OutputFormatter** - 格式化输出：

- 支持多种输出格式
- 支持 ANSI 彩色输出
- 流式输出支持
- 不同结果类型的专用格式化

```typescript
const formatter = new OutputFormatter({
  enableColors: true,
  maxLineWidth: 80,
});

const formatted = formatter.formatMessage(message, startTime);
// => { text, format, metadata }
```

### 13.3 状态机和错误处理

插件使用自定义错误层次结构：

```typescript
// 基础错误类，支持序列化
export class ConversationError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly timestamp: number;

  toJSON(): Record<string, unknown> {
    return { name: this.name, message: this.message, code: this.code, details: this.details };
  }
}

// 特定错误码
ConversationErrorCode = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  CONTEXT_NOT_FOUND: 'CONTEXT_NOT_FOUND',
  // ...
};
```

### 13.4 流式输出支持

输出格式化器支持流式输出块：

```typescript
// 处理流式响应块
const chunkText = outputFormatter.formatStream(chunk);
// 直接输出到终端
process.stdout.write(chunkText);
```

---

## 14. 完整示例：构建自定义工具插件

让我们构建一个完整的工具插件 - **代码统计工具插件**。

### 14.1 创建项目

```
mkdir -p plugins/code-stats/src
```

### 14.2 package.json

```json
{
  "name": "code-stats",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@organic/utils": "workspace:*",
    "@organic/plugins": "workspace:*"
  },
  "organic": {
    "plugin": true,
    "api_version": "1.0.0"
  }
}
```

### 14.3 插件实现

```typescript
// src/index.ts
import * as fs from 'fs';
import * as path from 'path';

import { BasePlugin } from '@organic/plugins';
import type { PluginInput, PluginOutput, KernelApi } from '@organic/utils';

/**
 * 代码统计插件 - 统计代码行数和文件数量
 */
export class CodeStatsPlugin extends BasePlugin {
  private kernel: KernelApi | null = null;

  constructor() {
    super({
      name: 'code-stats',
      version: '1.0.0',
      description: '统计项目代码行数和文件数量',
      apiVersion: '1.0.0',
      defaultConfig: {
        ignorePatterns: ['node_modules', '.git', 'dist', 'build'],
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'],
        maxDepth: 10,
      },
      hooks: {
        onLoad: () => console.log('[code-stats] Plugin loaded'),
      },
    });
  }

  protected getConfigSchema() {
    return {
      ignorePatterns: {
        type: 'object',
        required: false,
        default: ['node_modules', '.git', 'dist'],
      },
      extensions: {
        type: 'object',
        required: false,
        default: ['.ts', '.js'],
      },
      maxDepth: {
        type: 'number',
        required: false,
        default: 10,
      },
    };
  }

  protected async onInitialize(): Promise<void> {
    this.kernel = this.kernel; // BasePlugin 已经保存
  }

  protected async onExecute(input: PluginInput): Promise<unknown> {
    const { action } = input;

    if (action === 'stats') {
      return this.handleStats(input.params);
    }

    if (action === 'list') {
      return this.handleList(input.params);
    }

    throw new Error(`Unknown action: ${action}`);
  }

  private async handleStats(params: Record<string, unknown> = {}): Promise<unknown> {
    const projectRoot = this.kernel!.info.getProjectRoot();
    const ignorePatterns = ((params.ignorePatterns as string[]) ||
      this.config.ignorePatterns) as string[];
    const extensions = ((params.extensions as string[]) || this.config.extensions) as string[];
    const maxDepth = ((params.maxDepth as number) || this.config.maxDepth) as number;

    const stats = await this.walkDirectory(projectRoot, ignorePatterns, extensions, maxDepth);
    return stats;
  }

  private async handleList(params: Record<string, unknown> = {}): Promise<unknown> {
    const projectRoot = this.kernel!.info.getProjectRoot();
    const ignorePatterns = ((params.ignorePatterns as string[]) ||
      this.config.ignorePatterns) as string[];
    const extensions = ((params.extensions as string[]) || this.config.extensions) as string[];
    const maxDepth = ((params.maxDepth as number) || this.config.maxDepth) as number;

    const files = await this.listFiles(projectRoot, ignorePatterns, extensions, maxDepth);
    return { files };
  }

  private async walkDirectory(
    dir: string,
    ignorePatterns: string[],
    extensions: string[],
    maxDepth: number,
    currentDepth: number = 0
  ): Promise<{
    totalFiles: number;
    totalLines: number;
    totalSize: number;
    byExtension: Record<string, { files: number; lines: number }>;
  }> {
    if (currentDepth > maxDepth) {
      return { totalFiles: 0, totalLines: 0, totalSize: 0, byExtension: {} };
    }

    const basename = path.basename(dir);
    if (ignorePatterns.includes(basename)) {
      return { totalFiles: 0, totalLines: 0, totalSize: 0, byExtension: {} };
    }

    const files = await fs.promises.readdir(dir);
    let totalFiles = 0;
    let totalLines = 0;
    let totalSize = 0;
    const byExtension: Record<string, { files: number; lines: number }> = {};

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = await fs.promises.stat(fullPath);

      if (stat.isDirectory()) {
        const subStats = await this.walkDirectory(
          fullPath,
          ignorePatterns,
          extensions,
          maxDepth,
          currentDepth + 1
        );
        totalFiles += subStats.totalFiles;
        totalLines += subStats.totalLines;
        totalSize += subStats.totalSize;
        // Merge byExtension
        for (const [ext, s] of Object.entries(subStats.byExtension)) {
          if (!byExtension[ext]) {
            byExtension[ext] = { files: 0, lines: 0 };
          }
          byExtension[ext].files += s.files;
          byExtension[ext].lines += s.lines;
        }
      } else {
        const ext = path.extname(file);
        if (extensions.length > 0 && !extensions.includes(ext)) {
          continue;
        }

        const content = await fs.promises.readFile(fullPath, 'utf-8');
        const lines = content.split('\n').length;

        totalFiles++;
        totalLines += lines;
        totalSize += stat.size;

        if (!byExtension[ext]) {
          byExtension[ext] = { files: 0, lines: 0 };
        }
        byExtension[ext].files++;
        byExtension[ext].lines += lines;
      }
    }

    return { totalFiles, totalLines, totalSize, byExtension };
  }

  private async listFiles(
    dir: string,
    ignorePatterns: string[],
    extensions: string[],
    maxDepth: number,
    currentDepth: number = 0
  ): Promise<string[]> {
    if (currentDepth > maxDepth) {
      return [];
    }

    const basename = path.basename(dir);
    if (ignorePatterns.includes(basename)) {
      return [];
    }

    const files = await fs.promises.readdir(dir);
    const result: string[] = [];

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = await fs.promises.stat(fullPath);

      if (stat.isDirectory()) {
        const subFiles = await this.listFiles(
          fullPath,
          ignorePatterns,
          extensions,
          maxDepth,
          currentDepth + 1
        );
        result.push(...subFiles);
      } else {
        const ext = path.extname(file);
        if (extensions.length > 0 && !extensions.includes(ext)) {
          continue;
        }
        result.push(fullPath);
      }
    }

    return result;
  }
}

export default CodeStatsPlugin;
```

### 14.4 使用插件

```typescript
// 加载插件
const result = await loader.load('code-stats');
if (result.success) {
  await kernel.registerPlugin(result.plugin);

  // 执行统计
  const output = await kernel.executePlugin('code-stats', {
    action: 'stats',
    params: {
      extensions: ['.ts', '.tsx'],
    },
  });

  if (output.success) {
    console.log(output.data);
    // {
    //   totalFiles: 42,
    //   totalLines: 2847,
    //   totalSize: 89234,
    //   byExtension: {
    //     '.ts': { files: 35, lines: 2456 },
    //     '.tsx': { files: 7, lines: 391 }
    //   }
    // }
  }
}
```

---

## 15. 完整示例：构建对话插件

让我们构建一个 **Markdown 文档对话插件**，支持基于文档的问答。

### 15.1 插件结构

```typescript
// src/MarkdownDocPlugin.ts
import { BasePlugin } from '@organic/plugins';
import type { PluginInput, PluginOutput, KernelApi } from '@organic/utils';

import { DocumentIndex } from './DocumentIndex';
import { QueryProcessor } from './QueryProcessor';

export class MarkdownDocPlugin extends BasePlugin {
  private index: DocumentIndex | null = null;
  private processor: QueryProcessor | null = null;
  private kernel: KernelApi | null = null;

  constructor() {
    super({
      name: 'markdown-doc',
      version: '1.0.0',
      description: '基于 Markdown 文档的问答对话',
      apiVersion: '1.0.0',
      defaultConfig: {
        docDir: './docs',
        chunkSize: 500,
        chunkOverlap: 50,
        maxResults: 5,
      },
    });
  }

  protected async onInitialize(): Promise<void> {
    this.kernel = this.kernel;
    const docDir = this.config.docDir as string;

    // 创建索引
    this.index = new DocumentIndex({
      chunkSize: this.config.chunkSize as number,
      chunkOverlap: this.config.chunkOverlap as number,
    });

    // 索引文档目录
    await this.index.indexDirectory(docDir);

    // 创建查询处理器
    this.processor = new QueryProcessor(this.index, {
      maxResults: this.config.maxResults as number,
    });
  }

  protected async onExecute(input: PluginInput): Promise<unknown> {
    const { action, params } = input;

    if (action === 'ask') {
      const question = params.question as string;
      const results = await this.processor!.processQuery(question);

      // 通过 Kernel 调用 AI 生成回答
      const aiResult = await this.kernel!.executeTool('ai:completion', {
        prompt: this.buildPrompt(question, results),
      });

      if (aiResult.success && aiResult.data) {
        return {
          answer: (aiResult.data as any).completion,
          sources: results.map(r => ({
            title: r.title,
            path: r.path,
            relevance: r.score,
          })),
        };
      }

      throw new Error('AI processing failed');
    }

    if (action === 'reindex') {
      await this.index!.clear();
      await this.index!.indexDirectory(this.config.docDir as string);
      return { success: true, documentCount: this.index!.getDocumentCount() };
    }

    throw new Error(`Unknown action: ${action}`);
  }

  private buildPrompt(question: string, results: any[]): string {
    const context = results.map(r => `### ${r.title}\n\n${r.content}`).join('\n\n---\n\n');

    return `基于以下上下文回答问题。如果答案不在上下文中，说明不知道。

上下文:
${context}

问题: ${question}

回答:`;
  }

  protected async onShutdown(): Promise<void> {
    this.index?.clear();
  }
}

export default MarkdownDocPlugin;
```

### 15.2 使用插件

```typescript
const output = await kernel.executePlugin('markdown-doc', {
  action: 'ask',
  params: {
    question: 'How do I develop a plugin for Organic Interface?',
  },
});

if (output.success) {
  console.log(output.data.answer);
  console.log('Sources:', output.data.sources);
}
```

---

## 16. 完整示例：构建 UI 插件

添加自定义 TUI 组件。

```typescript
import { BasePlugin } from '@organic/plugins';
import type { PluginInput, PluginOutput } from '@organic/utils';

/**
 * 项目仪表盘插件
 * 显示项目概览信息的交互式仪表盘
 */
export class DashboardPlugin extends BasePlugin {
  constructor() {
    super({
      name: 'dashboard',
      version: '1.0.0',
      description: 'Interactive project dashboard',
      defaultConfig: {
        refreshInterval: 5000,
        showGitStatus: true,
        showDependencies: true,
      },
    });
  }

  protected async onExecute(input: PluginInput): Promise<unknown> {
    const { action } = input;

    if (action === 'render') {
      // 收集数据
      const projectInfo = await this.collectData();

      // 使用 Kernel 的 TextService 格式化输出
      const text = this.renderDashboard(projectInfo);

      return { text, projectInfo };
    }

    if (action === 'refresh') {
      // 刷新数据并重新渲染
      const projectInfo = await this.collectData();
      return { refreshed: true, projectInfo };
    }

    throw new Error(`Unknown action: ${action}`);
  }

  private async collectData() {
    // 使用 Kernel API 收集信息
    const projectRoot = this.kernel!.info.getProjectRoot();
    const projectName = this.kernel!.info.getProjectName();
    const projectVersion = this.kernel!.info.getProjectVersion();

    // 如果启用了 Git 状态，调用 git 工具获取状态
    let gitStatus = null;
    if (this.config.showGitStatus as boolean) {
      const result = await this.kernel!.executeTool('git:status', {
        cwd: projectRoot,
      });
      if (result.success) {
        gitStatus = result.data;
}

    return {
      name: projectName,
      version: projectVersion,
      root: projectRoot,
      gitStatus,
      timestamp: Date.now(),
    };
  }

  private renderDashboard(data: any): string {
    const lines: string[] = [];

    lines.push(this.kernel!.text.info(`=== ${data.name} v${data.version} ===`));
    lines.push('');
    lines.push(`Root: ${data.root}`);

    if (data.gitStatus) {
      lines.push('');
      lines.push(this.kernel!.text.info('Git Status:'));
      lines.push(`  Branch: ${data.gitStatus.branch}`);
      lines.push(`  Changes: ${data.gitStatus.changedFiles.length}`);
    }

    return lines.join('\n');
  }
}

export default DashboardPlugin;
```

---

## 17. 测试插件

### 17.1 单元测试

使用 Vitest 测试插件：

```typescript
// __tests__/GreetingPlugin.test.ts
import { describe, it, expect } from 'vitest';
import { GreetingPlugin } from '../src/index';

describe('GreetingPlugin', () => {
  it('should have correct metadata', () => {
    const plugin = new GreetingPlugin();
    expect(plugin.name).toBe('greeting');
    expect(plugin.version).toBe('1.0.0');
  });

  it('should initialize successfully', async () => {
    const plugin = new GreetingPlugin();
    const result = await plugin.initialize({
      kernel: mockKernel,
      config: { name: 'greeting', enabled: true },
    });
    expect(result.success).toBe(true);
  });

  it('should greet with default name', async () => {
    const plugin = new GreetingPlugin();
    await plugin.initialize(mockContext);

    const result = await plugin.execute({
      action: 'greet',
      params: {},
    });

    expect(result.success).toBe(true);
    expect(result.data.message).toBe('Hello, World!');
  });

  it('should greet with custom name', async () => {
    const plugin = new GreetingPlugin();
    await plugin.initialize(mockContext);

    const result = await plugin.execute({
      action: 'greet',
      params: { name: 'Organic' },
    });

    expect(result.success).toBe(true);
    expect(result.data.message).toBe('Hello, Organic!');
  });
});

// Mock Kernel
const mockKernel = {
  getConfig: () => ({ name: 'test', version: '0.1.0' }),
  getVersion: () => '0.1.0',
  executeTool: async () => ({ success: false, error: 'Not implemented' }),
  // ... other required methods
} as unknown as KernelApi;

const mockContext = {
  kernel: mockKernel,
  config: { name: 'greeting', enabled: true },
};
```

### 17.2 集成测试

```typescript
// __tests__/integration/code-stats.integration.test.ts
import { Kernel } from '@organic/kernel';
import { PluginLoader } from '@organic/plugins';
import { describe, it, expect } from 'vitest';

describe('CodeStatsPlugin Integration', () => {
  it('should load and execute', async () => {
    const kernel = new Kernel({
      config: { name: 'test', version: '0.1.0' },
    });
    await kernel.initialize();

    const loader = new PluginLoader({ baseDir: './plugins' });
    const loadResult = await loader.load('code-stats');

    expect(loadResult.success).toBe(true);
    expect(loadResult.metadata?.name).toBe('code-stats');

    await kernel.registerPlugin(loadResult.plugin!);

    const result = await kernel.executePlugin('code-stats', {
      action: 'stats',
      params: { extensions: ['.ts'] },
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('totalFiles');
    expect(result.data).toHaveProperty('totalLines');
  });
});
```

### 17.3 Mocking KernelApi

创建可复用的 mock：

```typescript
// test-utils/mockKernel.ts
import type { KernelApi, TextServiceInterface, InfoServiceInterface } from '@organic/utils';

export function createMockKernel(): KernelApi {
  const mockTextService: TextServiceInterface = {
    print: () => {},
    println: () => {},
    formatTable: data => JSON.stringify(data),
    formatList: items => items.join('\n'),
    formatSection: (title, content) => `${title}\n${content}`,
    styled: text => text,
    success: text => text,
    error: text => text,
    warning: text => text,
    info: text => text,
    createStream: () => ({}),
    progress: () => '',
    spinner: () => ({}),
  };

  const mockInfoService: InfoServiceInterface = {
    getConfig: () => undefined,
    getAllConfigs: () => ({}),
    getRuntimeInfo: () => ({}),
    getProjectContext: () => ({}),
    getProjectRoot: () => process.cwd(),
    getProjectName: () => 'test-project',
    getProjectVersion: () => '1.0.0',
    getSystemInfo: () => ({}),
    getPlatformInfo: () => ({}),
    getEnv: () => undefined,
    getAllEnvs: () => ({}),
  };

  return {
    getConfig: () => ({ name: 'test', version: '0.1.0' }),
    getVersion: () => '0.1.0',
    text: mockTextService,
    info: mockInfoService,
    registerPlugin: async () => {},
    unregisterPlugin: async () => {},
    getPlugin: () => undefined,
    listPlugins: () => [],
    executeTool: async (_name, _params) => ({
      success: false,
      error: 'Tool not implemented in mock',
    }),
  };
}
```

---

## 18. 发布插件

### 18.1 版本控制

遵循语义化版本规范：

- **主版本**：不兼容的 API 修改
- **次版本**：向下兼容的功能性新增
- **修订版本**：向下兼容的问题修正

示例：`1.0.0` → `1.1.0`（新增功能）→ `1.1.1`（修复 bug）→ `2.0.0`（破坏性变更）

### 18.2 兼容性声明

在 `package.json` 中声明兼容性：

```json
{
  "organic": {
    "plugin": true,
    "api_version": "1.0.0",
    "min_kernel_version": "0.1.0"
  }
}
```

### 18.3 分发方式

**本地开发**：放在 `./plugins` 目录即可加载。

**远程分发**：

1. **NPM 包**：发布到 NPM registry，用户通过 `npm install` 安装
2. **Git 仓库**：用户可以直接克隆仓库
3. **单个文件**：直接发布编译后的 JS 文件

### 18.4 发布检查清单

发布前检查：

- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] Lint 检查通过
- [ ] 更新 CHANGELOG
- [ ] 更新版本号
- [ ] 正确声明依赖
- [ ] README 包含使用说明
- [ ] 提供 TypeScript 类型定义

---

## 19. 完整参考示例：全功能插件

以下是一个展示所有概念的完整插件示例：

```typescript
import { BasePlugin } from '@organic/plugins';
import type {
  PluginInput,
  PluginOutput,
  PluginContext,
  KernelApi,
  InitializeResult,
} from '@organic/utils';

/**
 * FullFeaturedPlugin - 展示所有插件开发概念的完整示例
 *
 * 这个插件展示了：
 * - 配置定义和验证
 * - 生命周期钩子
 * - 依赖其他插件
 * - 使用 Kernel API（工具调用、信息服务、文本服务）
 * - 错误处理
 * - 资源清理
 */
export class FullFeaturedPlugin extends BasePlugin {
  private connection: any = null;

  constructor() {
    super({
      name: 'full-featured',
      version: '1.0.0',
      description: '完整功能示例插件，展示所有插件开发概念',
      apiVersion: '1.0.0',
      minKernelVersion: '0.1.0',
      defaultConfig: {
        host: 'localhost',
        port: 8080,
        enabled: true,
        timeout: 30000,
      },
      hooks: {
        onLoad: this.handleLoad.bind(this),
        onUnload: this.handleUnload.bind(this),
        onError: this.handleError.bind(this),
        onConfigChange: this.handleConfigChange.bind(this),
      },
    });
  }

  /**
   * 定义配置验证 schema
   */
  protected getConfigSchema() {
    return {
      host: {
        type: 'string',
        required: true,
        description: 'Server hostname',
      },
      port: {
        type: 'number',
        required: false,
        default: 8080,
        description: 'Server port',
      },
      enabled: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Whether the plugin is enabled',
      },
      timeout: {
        type: 'number',
        required: false,
        default: 30000,
        description: 'Request timeout in milliseconds',
      },
    };
  }

  /**
   * 自定义初始化
   */
  protected async onInitialize(context: PluginContext): Promise<void> {
    // 连接到外部服务
    await this.connect();
  }

  /**
   * 执行请求
   */
  protected async onExecute(input: PluginInput): Promise<unknown> {
    const { action, params } = input;

    switch (action) {
      case 'connect':
        await this.connect();
        return { connected: true };

      case 'disconnect':
        await this.disconnect();
        return { connected: false };

      case 'status':
        return this.getStatus();

      case 'query':
        return this.executeQuery(params);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * 关闭清理
   */
  protected async onShutdown(): Promise<void> {
    await this.disconnect();
  }

  // ==================== 钩子处理 ====================

  private handleLoad(): void {
    console.log('[full-featured] Plugin loaded');
  }

  private handleUnload(): void {
    console.log('[full-featured] Plugin unloaded');
  }

  private handleError(error: Error): void {
    console.error('[full-featured] Error occurred:', error);
  }

  private handleConfigChange(newConfig: Record<string, unknown>): void {
    console.log('[full-featured] Configuration changed', newConfig);
    // 如果连接已建立，重新连接使用新配置
    if (this.connection) {
      this.disconnect().then(() => this.connect());
    }
  }

  // ==================== 私有方法 ====================

  private async connect(): Promise<void> {
    const host = this.config.host as string;
    const port = this.config.port as number;

    // 实际连接逻辑
    this.connection = await createConnection({ host, port });
  }

  private async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  private getStatus() {
    return {
      connected: this.connection !== null,
      config: this.getConfig(),
      initialized: this.isInitialized(),
    };
  }

  private async executeQuery(params: Record<string, unknown>): Promise<unknown> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    // 使用 Kernel 执行工具
    const result = await this.kernel!.executeTool('cache:get', {
      key: `query:${params.sql}`,
    });

    if (result.success && result.data) {
      return { cached: true, result: result.data };
    }

    // 执行查询
    const queryResult = await this.connection.query(params.sql);
    return { cached: false, result: queryResult };
  }
}

// 模拟连接函数
async function createConnection(config: { host: string; port: number }) {
  // 实际连接逻辑
  return {
    close: async () => {},
    query: async (sql: string) => [],
  };
}

export default FullFeaturedPlugin;
```

---

## 20. API 参考速查表

### 20.1 BasePlugin 方法

| 方法/属性              | 说明                | 重写？                           |
| ---------------------- | ------------------- | -------------------------------- |
| `constructor(options)` | 构造函数            | 可选                             |
| `getMetadata()`        | 获取元数据          | 默认提供                         |
| `initialize(context)`  | 初始化              | 默认提供，调用 `onInitialize`    |
| `execute(input)`       | 执行                | 默认提供，调用 `onExecute`       |
| `shutdown()`           | 关闭                | 默认提供，调用 `onShutdown`      |
| `validateConfig()`     | 验证配置            | 默认提供，使用 `getConfigSchema` |
| `onInitialize()`       | 自定义初始化        | 需要，默认空实现                 |
| `onExecute()`          | 自定义执行          | 需要，默认返回 not implemented   |
| `onShutdown()`         | 自定义关闭清理      | 可选，默认空实现                 |
| `getConfigSchema()`    | 获取配置验证 schema | 可选，默认不验证                 |
| `updateConfig()`       | 更新配置            | 可用，自动调用 `onConfigChange`  |
| `getConfig()`          | 获取当前配置        | 可用                             |
| `isInitialized()`      | 检查是否已初始化    | 可用                             |
| `config`               | 当前配置            | 可用（protected）                |
| `kernel`               | Kernel API 引用     | 可用（protected）                |

### 20.2 PluginLoader 方法

| 方法                | 返回类型                           | 说明           |
| ------------------- | ---------------------------------- | -------------- | -------- |
| `load(id, config?)` | `Promise<PluginLoadResult>`        | 加载插件       |
| `unload(id)`        | `Promise<void>`                    | 卸载插件       |
| `reload(id)`        | `Promise<PluginLoadResult>`        | 重新加载       |
| `discover()`        | `Promise<PluginDiscoveryResult[]>` | 发现插件       |
| `isLoaded(id)`      | `boolean`                          | 检查是否已加载 |
| `listLoaded()`      | `string[]`                         | 列出所有已加载 |
| `getStatus(id)`     | `PluginStatus                      | undefined`     | 获取状态 |

### 20.3 PluginRegistry 方法

| 方法                                    | 返回类型                           | 说明                       |
| --------------------------------------- | ---------------------------------- | -------------------------- | ------------ |
| `register(id, metadata, path, config?)` | `PluginInfo`                       | 注册插件                   |
| `unregister(id)`                        | `void`                             | 注销插件                   |
| `getPluginInfo(id)`                     | `PluginInfo                        | null`                      | 获取插件信息 |
| `isRegistered(id)`                      | `boolean`                          | 检查是否已注册             |
| `listAll()`                             | `PluginInfo[]`                     | 列出所有                   |
| `listIds()`                             | `string[]`                         | 列出所有 ID                |
| `listEnabled()`                         | `PluginInfo[]`                     | 列出已启用                 |
| `listDisabled()`                        | `PluginInfo[]`                     | 列出已禁用                 |
| `search(options)`                       | `PluginInfo[]`                     | 搜索插件                   |
| `load(id, config?)`                     | `Promise<PluginLoadResult>`        | 加载插件                   |
| `unload(id)`                            | `Promise<void>`                    | 卸载插件                   |
| `enable(id)`                            | `void`                             | 启用插件                   |
| `disable(id)`                           | `void`                             | 禁用插件                   |
| `discoverPlugins()`                     | `Promise<PluginDiscoveryResult[]>` | 发现并注册                 |
| `on(event, listener)`                   | `() => void`                       | 订阅事件，返回取消订阅函数 |

### 20.4 KernelApi 方法

| 方法                        | 返回类型              | 说明             |
| --------------------------- | --------------------- | ---------------- | -------- |
| `getConfig()`               | `KernelConfig`        | 获取 Kernel 配置 |
| `getVersion()`              | `string`              | 获取 Kernel 版本 |
| `registerPlugin()`          | `Promise<void>`       | 注册插件         |
| `unregisterPlugin(name)`    | `Promise<void>`       | 注销插件         |
| `getPlugin(name)`           | `PluginInterface      | undefined`       | 获取插件 |
| `listPlugins()`             | `PluginInterface[]`   | 列出所有插件     |
| `executeTool(name, params)` | `Promise<ToolResult>` | 执行工具         |
| `text.*`                    | -                     | 文本服务         |
| `info.*`                    | -                     | 信息服务         |

---

## 21. 最佳实践

### 21.1 错误处理

- **总是使用 `try/catch`**：在 `initialize()` 和 `execute()` 中捕获异常
- **提供有意义的错误信息**：错误信息应该能帮助用户理解问题所在
- **使用自定义错误类**：对于特定领域错误，定义自定义错误类
- **不要吞掉错误**：错误应该正确传播到调用者
- **记录错误**：使用 `onError` 钩子记录错误

```typescript
// 好的错误处理
protected async onExecute(input: PluginInput): Promise<unknown> {
  try {
    // 业务逻辑
  } catch (error) {
    // 添加上下文信息
    throw new Error(`Failed to execute ${input.action}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### 21.2 性能

- **延迟初始化**：耗时操作放到 `onInitialize`，不要放到构造函数
- **缓存重复计算**：频繁使用的结果缓存起来
- **及时清理**：关闭时清理定时器、连接、缓存
- **避免内存泄漏**：取消所有订阅，移除所有事件监听器
- **流式处理大数据**：不要一次性把所有数据加载到内存

### 21.3 安全

- **验证所有输入**：不要信任用户输入，验证类型和范围
- **防止路径遍历**：使用 `PluginLoader` 内置的路径检查
- **权限检查**：如果插件执行危险操作，检查用户权限
- **不要硬编码密钥**：密钥应该通过配置传入，不要写在代码里
- **沙箱执行**：不可信插件应该在隔离环境运行

### 21.4 命名约定

- **插件 ID**：使用小写字母加连字符，如 `code-stats`，不要使用驼峰或空格
- **动作名称**：使用小写字母加连字符或下划线，如 `create-session` 或 `create_session`
- **配置项**：使用 camelCase，如 `maxItems`
- **类型/接口**：使用 PascalCase，如 `MyPluginOptions`
- **错误码**：使用 UPPER_SNAKE_CASE，如 `SESSION_NOT_FOUND`

### 21.5 依赖管理

- **声明所有依赖**：不要隐式依赖其他插件
- **使用可选依赖**：如果你降级处理，标记为可选
- **版本范围合理**：使用 `^1.0.0` 允许兼容更新，不要固定到具体版本除非必须
- **检查依赖是否存在**：运行时检查依赖可用性，给出清晰错误

### 21.6 配置

- **提供合理的默认值**：让用户可以零配置运行
- **验证配置**：使用内置的配置验证
- **支持热更新**：在 `onConfigChange` 中应用新配置，不需要重启
- **文档化配置项**：每个配置项都应该有描述说明

### 21.7 测试

- **单元测试覆盖核心逻辑**：测试每个动作的各种情况
- **Mock Kernel API**：单元测试不需要真实 Kernel
- **集成测试完整流程**：测试从加载到执行到关闭的完整流程
- **测试错误路径**：不仅测试成功场景，也要测试失败场景

---

## 22. 相关文档

- [feature-006-plugin-spec.md](./feature-006-plugin-spec.md) - 插件系统规格说明
- [feature-007-tool-system.md](./feature-007-tool-system.md) - 工具调用系统
- [feature-014-core-conversation-plugin.md](./feature-014-core-conversation-plugin.md) - 核心对话插件规范
- [development-guide.md](./development-guide.md) - 项目开发指南

---

## 术语定义

| 术语           | 定义                                 |
| -------------- | ------------------------------------ |
| Kernel         | 系统核心引擎，提供基础服务和运行环境 |
| Plugin         | 功能扩展单元，实现具体业务逻辑       |
| Skill          | Plugin 的同义词，强调能力扩展        |
| Extension      | Plugin 的同义词                      |
| Lifecycle      | 插件从发现到卸载的完整生命周期       |
| Metadata       | 插件元数据，描述插件基本信息         |
| Dependency     | 插件对其他插件的依赖关系             |
| Hook           | 生命周期钩子，在特定事件点执行回调   |
| KernelApi      | Kernel 暴露给插件的接口              |
| PluginLoader   | 负责从文件系统或远程加载插件代码     |
| PluginRegistry | 插件注册表，管理已发现的插件信息     |

---

## 验收标准

| 序号 | 验收项       | 验收标准                                    |
| ---- | ------------ | ------------------------------------------- |
| 1    | 架构描述清晰 | 清晰描述了 Kernel-Plugin 双层架构和职责划分 |
| 2    | 接口文档完整 | 所有核心接口都有完整文档和代码示例          |
| 3    | 生命周期完整 | 完整覆盖从发现到卸载的所有生命周期阶段      |
| 4    | 提供示例代码 | 提供多种类型插件的完整可运行示例            |
| 5    | 测试指南     | 包含单元测试、集成测试和 mocking 指南       |
| 6    | 最佳实践     | 总结错误处理、性能、安全、命名等最佳实践    |
| 7    | 开发流程完整 | 从创建到发布的完整开发流程                  |
