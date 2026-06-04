# 功能文档：Kernel工具调用服务系统

## 基本信息

**文档编号**: DOC-007
**所属模块**: 核心架构
**优先级**: P1
**创建日期**: 2026-04-15
**对应需求章节**: 3.3 可扩展性需求

---

## 功能概述

Kernel工具调用服务是Organic-Interface的核心能力接口，为Plugin提供标准化的工具调用能力。系统通过统一的服务接口封装各类工具操作，包括文件系统操作、代码搜索、执行命令等，实现工具的标准化注册、管理和调用。工具服务作为Kernel与Plugin之间的重要桥梁，支持运行时动态注册和权限控制，确保系统安全可控。

---

## 设计理念

### 工具服务定位

Kernel工具服务是Kernel向Plugin提供的基础能力之一，承担以下核心职责：

**统一接口抽象**：将各类底层工具操作封装为统一的标准化接口，Plugin无需关心工具的具体实现细节。

**安全权限控制**：通过权限体系控制工具的可用范围，防止越权操作和安全风险。

**执行结果标准化**：统一工具执行结果的格式和数据结构，便于Plugin进行处理和响应。

**生命周期管理**：管理工具的注册、加载、调用和卸载全过程，确保工具状态可控。

### 架构优势

- **接口统一**：不同类型的工具使用相同的调用接口，降低Plugin开发复杂度
- **安全隔离**：工具执行在受控环境中进行，避免对系统的破坏性影响
- **动态扩展**：支持运行时动态注册新工具，无需重启系统
- **结果标准化**：统一的返回格式简化Plugin对结果的处理逻辑
- **可追溯性**：完整的调用日志支持问题排查和审计需求

---

## 工具分类体系

### 工具类型定义

系统中的工具按照功能特性分为以下四大类别：

**文件操作类工具**：提供文件系统相关的操作能力，包括读取、写入、创建、删除、复制、移动等文件操作。这类工具直接与项目文件交互，是Plugin实现文件处理功能的基础。文件操作类工具受权限系统严格控制，写操作需要额外的权限验证。

**搜索类工具**：提供代码和文件的搜索能力，包括全文搜索、路径搜索、模式匹配等。搜索类工具通常作用于大量文件，需要优化搜索效率和结果缓存。支持的搜索场景包括：代码搜索、注释搜索、文档搜索等。

**执行类工具**：提供系统命令和脚本的执行能力，包括Shell命令执行、脚本运行、进程管理等。执行类工具具有最高的安全风险，系统对其进行了严格的权限控制和执行限制。Plugin需要申请特定的执行权限才能使用这类工具。

**工具类工具**：提供系统管理和运维相关的辅助能力，包括日志查询、状态获取、配置管理等。这类工具主要用于系统监控和运维场景，帮助用户了解系统运行状态和进行问题诊断。

---

## KernelToolService接口定义

### 核心接口规范

```typescript
/**
 * Kernel工具服务接口
 * 提供标准化的工具调用、注册和管理能力
 */
interface KernelToolService {
  // ==================== 工具调用 ====================
  /**
   * 调用指定工具并返回执行结果
   * @param tool_name 工具名称，唯一标识要调用的工具
   * @param args 工具参数，传递给工具的输入参数对象
   * @returns ToolResult 标准化工具执行结果
   */
  call_tool(tool_name: string, args: ToolArgs): ToolResult;

  /**
   * 异步调用工具，适用于长时间运行的工具
   * @param tool_name 工具名称
   * @param args 工具参数
   * @returns Promise<ToolResult> 工具执行结果的Promise
   */
  call_tool_async(tool_name: string, args: ToolArgs): Promise<ToolResult>;

  // ==================== 工具注册 ====================
  /**
   * 注册新工具到系统
   * @param tool 工具定义对象，包含工具的完整元数据
   */
  register_tool(tool: ToolDefinition): void;

  /**
   * 批量注册多个工具
   * @param tools 工具定义数组
   */
  register_tools(tools: ToolDefinition[]): void;

  /**
   * 注销指定工具
   * @param tool_name 要注销的工具名称
   */
  unregister_tool(tool_name: string): void;

  // ==================== 工具查询 ====================
  /**
   * 获取所有已注册工具列表
   * @returns ToolDefinition[] 所有工具的定义数组
   */
  list_tools(): ToolDefinition[];

  /**
   * 获取指定工具的定义信息
   * @param tool_name 工具名称
   * @returns ToolDefinition | null 工具定义，如不存在则返回null
   */
  get_tool(tool_name: string): ToolDefinition | null;

  /**
   * 按类型查询工具
   * @param type 工具类型
   * @returns ToolDefinition[] 符合类型的所有工具
   */
  list_tools_by_type(type: ToolType): ToolDefinition[];

  // ==================== 权限管理 ====================
  /**
   * 检查Plugin是否有权限调用指定工具
   * @param plugin_id Plugin标识
   * @param tool_name 工具名称
   * @returns boolean 是否有权限
   */
  check_permission(plugin_id: string, tool_name: string): boolean;

  /**
   * 授予Plugin调用工具的权限
   * @param plugin_id Plugin标识
   * @param tool_name 工具名称
   */
  grant_permission(plugin_id: string, tool_name: string): void;

  /**
   * 撤销Plugin的工具调用权限
   * @param plugin_id Plugin标识
   * @param tool_name 工具名称
   */
  revoke_permission(plugin_id: string, tool_name: string): void;
}
```

### 工具类型枚举

```typescript
/**
 * 工具类型枚举
 * 定义系统中所有工具的分类
 */
enum ToolType {
  /** 文件系统操作类工具 */
  FILE_OPERATION = 'file_operation',
  /** 代码和文件搜索类工具 */
  SEARCH = 'search',
  /** 系统命令执行类工具 */
  EXECUTION = 'execution',
  /** 系统管理和运维类工具 */
  SYSTEM = 'system',
}

/**
 * 工具调用级别
 * 反映工具的安全等级和风险程度
 */
enum ToolCallLevel {
  /** 普通级别，常规操作 */
  NORMAL = 'normal',
  /** 受限级别，需要明确授权 */
  RESTRICTED = 'restricted',
  /** 危险级别，高风险操作 */
  DANGEROUS = 'dangerous',
}
```

---

## 工具注册与管理机制

### 工具注册流程

工具注册是Plugin与系统建立工具能力连接的过程。注册流程包含以下关键步骤：

**元数据验证**：系统首先验证工具定义元数据的完整性和合法性，包括工具名称格式、参数定义、返回类型等。验证失败的工具将被拒绝注册并返回详细的错误信息。

**权限检查**：系统检查注册请求的合法性，确保只有经过授权的Plugin才能注册工具。未经授权的注册请求将被系统拒绝。

**依赖解析**：系统分析工具定义中的依赖声明，验证所有依赖工具是否已注册。对于缺失依赖的工具，注册将被延迟直到依赖满足。

**执行环境准备**：系统为新工具分配执行环境和资源，包括内存配额、执行超时配置等。确保工具在受控环境中运行。

**注册完成通知**：注册成功后，系统向请求的Plugin返回注册确认，并分配唯一的工具标识符。工具可以立即被调用。

### 内置工具注册

系统启动时自动注册一组内置工具，这些工具提供基础的通用能力：

| 工具名称     | 类型           | 描述           | 调用级别   |
| ------------ | -------------- | -------------- | ---------- |
| file_read    | FILE_OPERATION | 读取文件内容   | NORMAL     |
| file_write   | FILE_OPERATION | 写入文件内容   | RESTRICTED |
| file_list    | FILE_OPERATION | 列出目录文件   | NORMAL     |
| file_search  | SEARCH         | 文件内容搜索   | NORMAL     |
| code_search  | SEARCH         | 代码模式搜索   | NORMAL     |
| path_resolve | SYSTEM         | 路径解析转换   | NORMAL     |
| glob_search  | SEARCH         | 文件名模式匹配 | NORMAL     |

### 动态工具管理

系统支持运行时的动态工具管理，允许在系统不中断的情况下进行以下操作：

**热注册**：新工具可以在系统运行期间注册，无需重启。注册的工具有即时可用性。

**热卸载**：已注册的工具可以被动态卸载，卸载后的工具将不再接受新的调用请求。

**版本更新**：工具可以更新到新版本，更新过程对调用方透明。

---

## 工具执行流程与结果处理

### 执行流程详解

工具执行遵循严格的流程规范，确保执行的安全性和可追溯性：

**参数验证阶段**：系统首先验证传入参数的类型和格式是否符合工具定义。验证包括必填参数检查、类型检查、格式检查和约束验证。任何验证失败都会立即返回错误结果，不会进入执行阶段。

**权限校验阶段**：参数验证通过后，系统检查当前Plugin是否有权限调用目标工具。权限校验基于Plugin标识和工具名称的对应关系。无权限调用将被拒绝并返回权限错误。

**执行准备阶段**：通过权限校验后，系统进入执行准备阶段。该阶段完成以下工作：分配执行资源、设置执行超时、准备执行上下文、初始化日志记录器。准备阶段的任何失败都会导致执行终止。

**实际执行阶段**：准备工作完成后，系统调用工具的实际执行逻辑。执行过程中，系统持续监控执行状态，记录执行日志，处理中间结果。长时间执行的工具支持进度回调和取消机制。

**结果处理阶段**：执行完成后，系统对执行结果进行标准化处理。处理包括：结果格式转换、敏感信息过滤、日志记录、统计更新。结果处理完成后返回给调用方。

### 执行结果结构

```typescript
/**
 * 工具执行结果
 * 所有工具调用的返回结果遵循此结构
 */
interface ToolResult {
  /** 执行是否成功 */
  success: boolean;

  /** 工具返回的实际数据，成功时有效 */
  data?: any;

  /** 错误信息，执行失败时有效 */
  error?: ToolError;

  /** 执行元数据 */
  metadata: {
    /** 工具名称 */
    tool_name: string;
    /** 执行开始时间戳 */
    start_time: number;
    /** 执行结束时间戳 */
    end_time: number;
    /** 执行耗时毫秒 */
    execution_time: number;
    /** 调用请求标识 */
    request_id: string;
  };
}

/**
 * 工具执行错误信息
 */
interface ToolError {
  /** 错误代码 */
  code: ToolErrorCode;
  /** 错误描述 */
  message: string;
  /** 错误详情 */
  details?: any;
}

/**
 * 工具错误代码枚举
 */
enum ToolErrorCode {
  /** 参数验证失败 */
  INVALID_ARGUMENTS = 'invalid_arguments',
  /** 权限不足 */
  PERMISSION_DENIED = 'permission_denied',
  /** 工具不存在 */
  TOOL_NOT_FOUND = 'tool_not_found',
  /** 工具执行超时 */
  TIMEOUT = 'timeout',
  /** 执行过程中发生错误 */
  EXECUTION_ERROR = 'execution_error',
  /** 系统资源不足 */
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  /** 工具已禁用 */
  TOOL_DISABLED = 'tool_disabled',
}
```

### 执行结果处理策略

调用方接收ToolResult后应按以下策略处理：

**成功结果处理**：当success为true时，调用方可以从data字段获取工具返回的实际数据。结果数据已经是标准化格式，可以直接使用。

**失败结果处理**：当success为false时，调用方应检查error字段获取错误信息。根据错误代码进行相应处理：INVALID_ARGUMENTS表示参数问题应修正后重试；PERMISSION_DENIED表示需要申请权限；TOOL_NOT_FOUND表示工具不可用需要降级处理；其他错误通常需要人工介入或记录日志。

---

## 工具权限控制与安全机制

### 权限模型设计

系统采用基于Plugin身份的权限控制模型。权限控制包含以下核心要素：

**权限主体**：Plugin作为权限请求的主体，每个Plugin拥有唯一的plugin_id。系统基于plugin_id管理其权限集合。

**权限客体**：工具作为权限控制的客体，每个工具拥有唯一的tool_name。系统维护每个工具的可访问Plugin列表。

**权限类型**：系统支持细粒度的权限类型区分。基础权限控制工具是否可被调用，高级权限控制工具的调用范围和限制。

### 权限控制策略

**默认拒绝策略**：系统的默认策略是拒绝所有未明确授权的工具调用。新注册的Plugin默认没有任何工具调用权限。

**最小权限原则**：Plugin只能获得完成其功能所必需的最小权限集。系统不支持获取超出必要范围的权限。

**权限有效期**：权限可以设置有效期，过期后自动失效。临时权限适用于临时性的工具使用需求。

**权限继承机制**：Plugin创建的子Plugin可以继承父Plugin的部分权限。继承需要明确配置，不支持自动继承。

### 安全控制措施

**参数过滤**：所有工具参数在传递前经过安全过滤，防止注入攻击和危险参数。过滤规则包括：路径规范化、特殊字符转义、危险命令检测。

**执行限制**：工具执行受到严格的资源限制，包括：最大执行时间、最大内存使用、最大输出大小。超出限制的执行将被强制终止。

**审计日志**：所有工具调用都被完整记录，包括调用者、工具名、参数、结果、时间等。日志支持安全审计和问题排查。

**异常隔离**：工具执行中的异常不会影响Kernel和其他Plugin的正常运行。异常被捕获并转换为标准化的错误结果。

---

## 数据模型定义

### ToolDefinition工具定义

```typescript
/**
 * 工具定义
 * 描述一个工具的完整元数据
 */
interface ToolDefinition {
  /** 工具唯一名称 */
  name: string;

  /** 工具版本号，遵循semver规范 */
  version: string;

  /** 工具功能描述 */
  description: string;

  /** 工具所属分类 */
  type: ToolType;

  /** 工具调用级别 */
  call_level: ToolCallLevel;

  /** 参数定义 */
  parameters: ToolParameterDefinition;

  /** 返回值定义 */
  returns: ToolReturnDefinition;

  /** 工具执行函数 */
  handler: ToolHandler;

  /** 权限要求 */
  permissions: string[];

  /** 资源限制 */
  limits?: ToolLimits;

  /** 依赖的其他工具 */
  dependencies?: string[];

  /** 工具配置选项 */
  options?: ToolOptions;
}
```

### 工具参数定义

```typescript
/**
 * 工具参数定义
 * 描述工具输入参数的结构和约束
 */
interface ToolParameterDefinition {
  /** 参数类型 */
  type: 'object';

  /** 参数属性定义 */
  properties: {
    [paramName: string]: ParameterProperty;
  };

  /** 必填参数列表 */
  required: string[];

  /** 额外参数是否允许 */
  additionalProperties: boolean;
}

/**
 * 单个参数属性定义
 */
interface ParameterProperty {
  /** 参数类型 */
  type: ParameterType;

  /** 参数描述 */
  description: string;

  /** 默认值 */
  default?: any;

  /** 枚举值限制 */
  enum?: any[];

  /** 最小值（数字类型） */
  minimum?: number;

  /** 最大值（数字类型） */
  maximum?: number;

  /** 最小长度（字符串类型） */
  minLength?: number;

  /** 最大长度（字符串类型） */
  maxLength?: number;

  /** 正则表达式验证（字符串类型） */
  pattern?: string;
}

/**
 * 参数类型
 */
type ParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object';
```

### 工具资源限制

```typescript
/**
 * 工具资源限制
 * 定义工具执行的资源约束
 */
interface ToolLimits {
  /** 最大执行时间（毫秒） */
  max_execution_time: number;

  /** 最大内存使用（字节） */
  max_memory: number;

  /** 最大输出大小（字节） */
  max_output_size: number;

  /** 最大调用次数（每时间窗口） */
  max_calls_per_window?: {
    count: number;
    window_seconds: number;
  };

  /** 允许的操作范围 */
  allowed_operations?: string[];
}
```

### 工具执行上下文

```typescript
/**
 * 工具执行上下文
 * 传递给工具执行函数的上下文信息
 */
interface ToolExecutionContext {
  /** 调用请求标识 */
  request_id: string;

  /** 调用者Plugin标识 */
  caller_plugin_id: string;

  /** 调用者Plugin名称 */
  caller_plugin_name: string;

  /** 调用时间戳 */
  timestamp: number;

  /** 执行配置 */
  config: ToolExecutionConfig;

  /** 日志记录器 */
  logger: ToolLogger;
}

/**
 * 工具执行配置
 */
interface ToolExecutionConfig {
  /** 是否启用详细日志 */
  verbose: boolean;

  /** 执行超时时间 */
  timeout: number;

  /** 工作目录 */
  working_directory: string;
}

/**
 * 工具日志接口
 */
interface ToolLogger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
}
```

---

## 验收条件

| 序号 | 验收项                | 验收标准                                                             |
| ---- | --------------------- | -------------------------------------------------------------------- |
| 1    | 工具类型分类          | 系统包含FILE_OPERATION、SEARCH、EXECUTION、SYSTEM四种工具类型        |
| 2    | KernelToolService接口 | 接口包含call_tool、register_tool、list_tools等核心方法               |
| 3    | 工具注册机制          | 支持工具的动态注册和注销，注册流程包含验证和权限检查                 |
| 4    | 权限控制              | 实现Plugin级别的工具调用权限控制，支持权限授予和撤销                 |
| 5    | 结果标准化            | 所有工具返回统一的ToolResult结构，包含success、data、error、metadata |
| 6    | 错误处理              | 定义完整的ToolErrorCode枚举，覆盖所有可能的错误场景                  |
| 7    | 执行流程              | 工具执行包含参数验证、权限校验、执行、结果处理四个阶段               |
| 8    | 资源限制              | 支持工具执行的资源限制配置，包括超时、内存、输出大小                 |
| 9    | 工具分类查询          | 支持按ToolType查询已注册工具列表                                     |
| 10   | 文档编号              | 文档编号为DOC-007，与feature-006保持一致的结构风格                   |

---

## 与现有功能的关系

### 与Plugin系统的协同

工具服务是Plugin系统的基础能力之一。每个Plugin可以通过KernelToolService调用其他Plugin注册的工具，实现功能协作。工具注册本身也是一种Plugin行为，通过Plugin的register_tool方法完成。

### 与Agent架构的协作

Agent可以作为工具的调用方，通过KernelToolService访问系统提供的各种工具能力。Agent的决策结果可以通过工具调用转化为实际操作。

### 与文件系统的集成

文件操作类工具直接与项目文件系统交互。工具服务与文件系统模块协同工作，提供安全可控的文件操作能力。

---

## 术语定义

| 术语              | 定义                     |
| ----------------- | ------------------------ |
| Tool              | 系统中的可调用能力单元   |
| KernelToolService | Kernel提供的工具服务接口 |
| ToolDefinition    | 工具的元数据定义         |
| ToolResult        | 工具调用的标准化返回结果 |
| ToolType          | 工具的功能分类           |
| ToolCallLevel     | 工具调用的安全级别       |

---

## 相关文档

- feature-006-plugin-spec.md - Plugin插件系统架构
- feature-001-agent-architecture.md - Agent架构设计
- feature-003-prompt-system.md - 提示词系统设计
- requirements.md - 需求规格说明
