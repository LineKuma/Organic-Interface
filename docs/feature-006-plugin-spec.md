# 功能文档：Plugin插件系统架构

## 基本信息

**文档编号**: DOC-006
**所属模块**: 核心架构
**优先级**: P1
**创建日期**: 2026-04-15
**对应需求章节**: 3.3 可扩展性需求

---

## 功能概述

Plugin插件系统是Organic-Interface的核心扩展机制，采用Kernel-Plugin双层架构设计。Kernel作为核心引擎，提供基础信息、工具调用服务和运行环境；Plugin作为功能扩展，负责实现具体业务逻辑和人机交互。系统支持在Kernel上同时运行任意多个Plugin，实现功能的灵活扩展和动态加载。

---

## 设计理念

### Kernel与Plugin职责划分

**Kernel职责**：作为系统的核心引擎，Kernel负责任务调度、资源管理、基础服务提供和Plugin生命周期管理。Kernel不包含具体业务逻辑，仅提供可被Plugin调用的基础能力和标准接口。

**Plugin职责**：作为功能扩展单元，Plugin负责实现具体业务逻辑、人机交互和领域功能。Plugin通过标准接口与Kernel交互，获取必要的信息和服务。

### 架构优势

- **关注点分离**：Kernel与Plugin各司其职，Kernel专注调度，Plugin专注业务
- **灵活扩展**：新增功能只需实现Plugin，无需修改Kernel代码
- **独立演进**：Kernel和Plugin可独立版本迭代，互不影响
- **动态加载**：支持运行时动态加载和卸载Plugin
- **沙箱隔离**：Plugin运行在隔离环境中，错误不会影响Kernel稳定性

---

## Kernel架构规范

### Kernel核心职责

Kernel承担以下核心职责：

1. **基础信息服务**
   - 提供系统配置和运行时信息
   - 管理项目上下文和状态
   - 提供文件系统和路径操作抽象

2. **工具调用服务**
   - 封装标准工具接口供Plugin调用
   - 管理工具注册和权限控制
   - 提供工具执行结果标准化

3. **Plugin生命周期管理**
   - Plugin的加载、初始化、运行、销毁
   - Plugin间通信协调
   - Plugin状态监控和错误处理

4. **运行环境提供**
   - 内存管理和资源分配
   - 异步任务调度
   - 日志和审计服务

### Kernel服务接口

#### 信息服务接口

```typescript
interface KernelInfoService {
  // 获取系统配置
  get_config(key: string): ConfigValue;
  get_all_configs(): Record<string, ConfigValue>;

  // 获取运行时信息
  get_runtime_info(): RuntimeInfo;
  get_project_context(): ProjectContext;

  // 文件系统抽象
  read_file(path: string): FileContent;
  write_file(path: string, content: string): WriteResult;
  list_files(pattern: string): FileEntry[];
}
```

#### 工具服务接口

```typescript
interface KernelToolService {
  // 工具调用
  call_tool(tool_name: string, args: ToolArgs): ToolResult;

  // 工具注册
  register_tool(tool: ToolDefinition): void;
  unregister_tool(tool_name: string): void;

  // 工具查询
  list_tools(): ToolDefinition[];
  get_tool(tool_name: string): ToolDefinition | null;
}
```

#### Plugin管理接口

```typescript
interface KernelPluginService {
  // Plugin生命周期
  load_plugin(plugin_id: string): Promise<PluginInstance>;
  unload_plugin(plugin_id: string): Promise<void>;

  // Plugin通信
  send_message(target: string, message: PluginMessage): void;
  broadcast_message(message: PluginMessage): void;

  // 状态查询
  list_plugins(): PluginInfo[];
  get_plugin_status(plugin_id: string): PluginStatus;
}
```

---

## Plugin接口规范

### 核心方法定义

所有Plugin必须实现以下核心方法：

```typescript
interface PluginInterface {
  // 初始化方法
  // 系统加载Plugin时调用，用于准备运行环境和依赖
  initialize(context: PluginContext): Promise<InitializeResult>;

  // 执行方法
  // 接收任务输入，执行具体业务逻辑，返回执行结果
  execute(input: PluginInput): Promise<PluginOutput>;

  // 关闭方法
  // 系统卸载Plugin时调用，用于清理资源和保存状态
  shutdown(): Promise<void>;
}
```

### PluginContext上下文对象

Plugin初始化时接收的上下文对象包含以下信息：

```typescript
interface PluginContext {
  plugin_id: string;
  kernel_api: KernelApi;
  config: PluginConfig;
  logger: Logger;
}
```

### PluginInput输入对象

```typescript
interface PluginInput {
  action: string;
  parameters: Record<string, any>;
  metadata: {
    request_id: string;
    user_id?: string;
    timestamp: number;
  };
}
```

### PluginOutput输出对象

```typescript
interface PluginOutput {
  success: boolean;
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    execution_time: number;
    plugin_version: string;
  };
}
```

---

## Plugin数据结构

### Plugin元数据定义

```typescript
interface PluginMetadata {
  // 基本信息
  name: string; // Plugin名称，唯一标识
  version: string; // 版本号，遵循semver规范
  description: string; // 功能描述

  // 兼容性信息
  api_version: string; // 兼容的Kernel API版本
  min_kernel_version: string; // 最低Kernel版本要求

  // 依赖信息
  dependencies: PluginDependency[];

  // 配置信息
  default_config: Record<string, any>;
  config_schema: ConfigSchema;

  // 生命周期钩子
  hooks?: PluginHooks;
}
```

### PluginDependency依赖定义

```typescript
interface PluginDependency {
  plugin_name: string; // 依赖的Plugin名称
  version_range: string; // 版本范围，遵循semver规范
  optional: boolean; // 是否可选依赖
}
```

### PluginHooks钩子定义

```typescript
interface PluginHooks {
  on_load?: () => void | Promise<void>;
  on_unload?: () => void | Promise<void>;
  on_error?: (error: Error) => void;
  on_config_change?: (config: any) => void;
}
```

---

## Plugin生命周期管理

### 完整生命周期流程

```
┌─────────┐    ┌─────────────┐    ┌─────────┐    ┌───────────┐
│  DISCOVERY  │ → │  RESOLVE   │ → │ LOADING │ → │ INITIALIZE │
└─────────┘    └─────────────┘    └─────────┘    └───────────┘
     │              │                │               │
     ↓              ↓                ↓               ↓
┌─────────┐    ┌─────────────┐    ┌─────────┐    ┌───────────┐
│  EXECUTE │ ← │   RUNNING   │ ← │ ACTIVE  │ ←─└───────────┘
└─────────┘    └─────────────┘    └─────────┘
     │              │
     ↓              ↓
┌─────────┐    ┌─────────────┐
│ SHUTDOWN│    │   ERROR     │
└─────────┘    └─────────────┘
```

### 各阶段详细说明

**DISCOVERY阶段**：系统扫描Plugin目录，发现可用的Plugin并读取元数据。

**RESOLVE阶段**：解析Plugin依赖关系，检测版本兼容性，确定加载顺序。

**LOADING阶段**：加载Plugin代码文件，验证代码完整性，初始化运行时环境。

**INITIALIZE阶段**：调用Plugin.initialize()方法，传递上下文，准备运行环境。

**ACTIVE阶段**：Plugin进入就绪状态，可以接收和处理请求。

**RUNNING阶段**：Plugin正在执行任务，处理PluginInput并返回PluginOutput。

**SHUTDOWN阶段**：调用Plugin.shutdown()方法，清理资源，保存状态。

**ERROR阶段**：Plugin发生错误，根据错误类型进行恢复或卸载。

### 生命周期状态定义

```typescript
enum PluginLifecycleState {
  DISCOVERED = 'discovered',
  RESOLVED = 'resolved',
  LOADING = 'loading',
  INITIALIZED = 'initialized',
  ACTIVE = 'active',
  RUNNING = 'running',
  SHUTTING_DOWN = 'shutting_down',
  SHUTDOWN = 'shutdown',
  ERROR = 'error',
  UNLOADED = 'unloaded',
}
```

---

## Plugin间通信机制

### 消息格式定义

```typescript
interface PluginMessage {
  message_id: string;
  source: string;
  target: string;
  action: string;
  payload: any;
  timestamp: number;
  priority: MessagePriority;
}
```

### 通信模式

**点对点通信**：Plugin之间直接消息传递，适用于一对一的数据交换。

**发布订阅模式**：Plugin订阅特定主题，接收广播消息，适用于事件通知场景。

**请求响应模式**：Plugin发送请求并等待响应，适用于需要结果的调用场景。

---

## Plugin配置管理

### 配置加载优先级

Plugin配置按以下优先级加载（从低到高）：

1. Plugin默认配置（default_config）
2. 系统级Plugin配置
3. 项目级Plugin配置
4. 用户级Plugin配置

### 配置Schema定义

```typescript
interface ConfigSchema {
  type: 'object';
  properties: {
    [key: string]: {
      type: string;
      default: any;
      description: string;
      required?: boolean;
      validation?: ValidationRule;
    };
  };
  required?: string[];
}
```

---

## 技术实现规范

### 运行时环境

**Node.js运行时**：系统运行在Node.js 18+环境中。Node.js提供高效的异步I/O能力和丰富的生态系统支持。选择18+版本是因为其对ES Modules的完善支持以及稳定的性能表现。

**TypeScript主导**：所有核心代码使用TypeScript编写。TypeScript提供强类型检查能力，在编译阶段发现潜在错误，提升代码质量和可维护性。所有类型定义必须完整，避免使用any类型。

### 模块系统

**ES Modules为主**：系统采用ES Modules（import/export）作为主要模块系统，同时保持对CommonJS的兼容。ES Modules提供静态分析能力，支持Tree Shaking优化，支持异步动态导入。每个Plugin必须导出标准的ES Module接口。

**代码格式规范**：代码遵循统一的格式规范，使用Prettier进行代码格式化。缩进使用2个空格。变量命名采用camelCase，类型和接口命名采用PascalCase，常量命名采用UPPER_SNAKE_CASE。

### LiteLLM集成

**LiteLLM统一接口**：系统使用LiteLLM作为AI模型的统一调用接口。LiteLLM支持对接多种大语言模型提供商（如OpenAI、Anthropic、Azure等），提供标准化的API调用方式。

**Plugin与LiteLLM交互**：Plugin通过Kernel暴露的AI服务接口调用LiteLLM，无需直接依赖具体的模型提供商。这种设计使系统可以灵活切换AI模型，同时保持Plugin代码的稳定性。

**AI工具注册**：Plugin可以注册基于AI的工具，利用LiteLLM实现智能化的功能扩展。AI工具通过KernelToolService统一管理和调用。

---

## 动态模块加载机制

### 动态导入概述

Plugin作为可动态导入的模块，支持运行时动态加载和卸载。系统使用Node.js原生的动态导入能力（import()表达式或require()函数）实现Plugin的运行时加载，无需重启Kernel即可加载新的Plugin。

### Plugin包结构

每个Plugin必须遵循标准的包结构：

```
plugin-name/
├── package.json          # 包定义文件
├── src/
│   └── index.ts         # 入口文件
├── dist/                # 编译输出目录
│   └── index.js         # 编译后的入口文件
├── types/                # TypeScript类型定义
│   └── index.d.ts       # 类型声明文件
└── README.md            # Plugin说明文档
```

**package.json定义**：

```json
{
  "name": "plugin-example",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "types/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./types/index.d.ts"
    }
  },
  "organic": {
    "plugin": true,
    "api_version": "1.0.0"
  }
}
```

### 动态加载流程

**步骤1：路径解析**。系统根据Plugin标识解析Plugin包路径，支持从本地目录或Registry安装目录加载。

**步骤2：模块加载**。使用动态import()加载Plugin的入口模块，获取Plugin的导出对象。

**步骤3：元数据提取**。调用Plugin的getMetadata()方法或从package.json读取Plugin元数据。

**步骤4：依赖验证**。验证Plugin依赖的其他模块是否已加载，必要时先加载依赖。

**步骤5：实例化**。创建Plugin实例，调用initialize()方法完成初始化。

### PluginInterface扩展

```typescript
/**
 * Plugin动态加载接口
 * 支持运行时动态导入的Plugin必须实现此接口
 */
interface PluginInterface {
  // 核心方法
  initialize(context: PluginContext): Promise<InitializeResult>;
  execute(input: PluginInput): Promise<PluginOutput>;
  shutdown(): Promise<void>;

  // 动态加载相关方法
  /**
   * 静态工厂方法，用于动态导入
   * @param packagePath Plugin包路径
   * @returns Promise<PluginInterface> Plugin实例
   */
  static async load(packagePath: string): Promise<PluginInterface>;

  /**
   * 获取Plugin元数据
   * @returns PluginMetadata Plugin元数据对象
   */
  getMetadata(): PluginMetadata;
}
```

### 加载器实现

```typescript
/**
 * Plugin动态加载器
 * 负责Plugin的运行时加载和实例化
 */
class PluginLoader {
  private cache: Map<string, PluginInterface>;
  private registry: PluginRegistry;

  constructor(registry: PluginRegistry) {
    this.cache = new Map();
    this.registry = registry;
  }

  /**
   * 加载指定Plugin
   * @param pluginId Plugin标识
   * @returns Promise<PluginInterface> Plugin实例
   */
  async load(pluginId: string): Promise<PluginInterface> {
    // 检查缓存
    if (this.cache.has(pluginId)) {
      return this.cache.get(pluginId)!;
    }

    // 获取Plugin信息
    const info = await this.registry.getPluginInfo(pluginId);
    if (!info) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // 动态导入模块
    const module = await import(info.packagePath);

    // 调用静态load方法或直接使用默认导出
    const plugin = module.load ? await module.load(info.packagePath) : new module.default();

    // 缓存实例
    this.cache.set(pluginId, plugin);

    return plugin;
  }

  /**
   * 卸载Plugin
   * @param pluginId Plugin标识
   */
  async unload(pluginId: string): Promise<void> {
    const plugin = this.cache.get(pluginId);
    if (plugin) {
      await plugin.shutdown();
      this.cache.delete(pluginId);
    }
  }
}
```

---

## Plugin安装管理机制

### 安装管理概述

系统支持Plugin的自主安装管理，允许用户在运行时安装、升级和卸载Plugin。Plugin通过Plugin Registry进行分发和管理，支持本地安装和远程安装两种模式。

### Plugin Registry接口

```typescript
/**
 * Plugin注册表接口
 * 负责Plugin的存储、索引和分发
 */
interface PluginRegistry {
  // 信息查询
  /**
   * 获取Plugin信息
   * @param pluginId Plugin标识
   */
  getPluginInfo(pluginId: string): Promise<PluginInfo | null>;

  /**
   * 搜索Plugin
   * @param query 搜索关键词
   */
  search(query: string): Promise<PluginInfo[]>;

  /**
   * 列出已安装的Plugin
   */
  listInstalled(): Promise<PluginInfo[]>;

  // 安装管理
  /**
   * 安装Plugin
   * @param source 安装源（本地路径或远程标识）
   */
  install(source: string): Promise<InstallResult>;

  /**
   * 升级Plugin
   * @param pluginId Plugin标识
   * @param version 目标版本
   */
  upgrade(pluginId: string, version?: string): Promise<UpgradeResult>;

  /**
   * 卸载Plugin
   * @param pluginId Plugin标识
   */
  uninstall(pluginId: string): Promise<void>;

  // 状态管理
  /**
   * 获取安装状态
   * @param pluginId Plugin标识
   */
  getInstallStatus(pluginId: string): Promise<InstallStatus>;
}

/**
 * Plugin信息
 */
interface PluginInfo {
  plugin_id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  package_path: string;
  install_time: number;
  status: PluginStatus;
}

/**
 * 安装状态
 */
interface InstallStatus {
  installed: boolean;
  version?: string;
  latest_version?: string;
  update_available: boolean;
}
```

### 安装流程

**步骤1：来源解析**。解析安装来源，支持以下格式：

- 本地路径：`/path/to/plugin` 或 `./local-plugin`
- NPM包：`npm:plugin-name@1.0.0`
- Git仓库：`git:https://github.com/user/plugin.git`
- 远程包：`https://example.com/plugins/plugin.tar.gz`

**步骤2：元数据获取**。从源获取Plugin包元数据，验证包的合法性和兼容性。

**步骤3：依赖解析**。分析Plugin依赖，检测与现有Plugin的冲突，列出需要同时安装的依赖。

**步骤4：下载和解压**。下载Plugin包（如为远程源），解压到安装目录。

**步骤5：验证和注册**。验证Plugin包的完整性，向Registry注册Plugin信息。

**步骤6：初始化加载**。调用Plugin的load方法，完成Plugin的初始化。

### 升级流程

**版本检测**：检查当前安装版本与Registry中最新版本的差异。

**兼容性检查**：验证新版本是否与当前Kernel版本和其他Plugin兼容。

**备份**：备份当前版本的Plugin文件和数据。

**替换**：下载新版本包，替换原有文件。

**迁移**：如有数据迁移需求，执行迁移脚本。

**重启**：重新加载Plugin使升级生效。

### 卸载流程

**依赖检查**：检查是否有其他Plugin依赖目标Plugin。

**状态保存**：保存Plugin的运行时状态和配置。

**清理**：删除Plugin文件、缓存和临时数据。

**注销**：从Registry注销Plugin信息。

### 内置安装命令

系统提供一组内置的安装管理命令：

**plugin:install** - 安装Plugin，支持本地路径或远程包。

**plugin:uninstall** - 卸载Plugin，保留配置备份。

**plugin:upgrade** - 升级Plugin到最新版本或指定版本。

**plugin:list** - 列出所有已安装的Plugin。

**plugin:search** - 搜索可用的Plugin。

**plugin:info** - 查看Plugin详细信息。

---

## 验收条件

| 序号 | 验收项           | 验收标准                                                               |
| ---- | ---------------- | ---------------------------------------------------------------------- |
| 1    | Kernel职责定义   | Kernel明确定义为系统核心引擎，承担信息提供、工具调用、生命周期管理职责 |
| 2    | Plugin核心接口   | Plugin必须实现initialize()、execute()、shutdown()三个核心方法          |
| 3    | Plugin元数据结构 | Plugin元数据包含名称、版本、API版本、依赖等完整信息                    |
| 4    | 生命周期流程     | Plugin具有完整的生命周期流程，包含发现、加载、初始化、运行、卸载各阶段 |
| 5    | 版本兼容性       | 支持semver规范的版本范围定义和兼容性检测                               |
| 6    | 配置管理         | 支持多级配置覆盖机制                                                   |
| 7    | 通信机制         | 支持点对点和发布订阅两种通信模式                                       |
| 8    | 错误处理         | Plugin错误不影响Kernel和其他Plugin运行                                 |

---

## 与现有功能的关系

### 与Agent架构的协同

Plugin系统与Agent架构紧密协作：

- Agent可以作为Plugin的实现载体
- Plugin可调用Agent进行任务处理
- Plugin支持嵌套调用其他Plugin

### 与配置系统的对齐

Plugin配置遵循配置系统设计原则：

- 支持三级配置覆盖
- 支持运行时热更新
- 支持配置版本管理

---

## 术语定义

| 术语        | 定义                                 |
| ----------- | ------------------------------------ |
| Kernel      | 系统核心引擎，提供基础服务和运行环境 |
| Plugin      | 功能扩展单元，实现具体业务逻辑       |
| Lifecycle   | Plugin从发现到卸载的完整生命周期     |
| API Version | Kernel暴露给Plugin的接口版本号       |
| Dependency  | Plugin之间的依赖关系定义             |

---

## 相关文档

- 技术架构设计文档
- Agent通信协议规范
- 配置系统使用指南
- 插件开发SDK文档
