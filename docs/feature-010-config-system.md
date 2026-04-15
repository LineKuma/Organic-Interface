# 功能文档：多级配置系统

## 基本信息

**文档编号**: DOC-010
**所属模块**: 核心架构
**优先级**: P1
**创建日期**: 2026-04-15
**对应需求章节**: 3.2 配置管理需求

---

## 功能概述

多级配置系统是Organic-Interface的基础配置管理模块，采用分层架构设计，支持系统级、项目级、用户级、环境变量四级配置覆盖机制。系统提供统一的配置访问接口、动态配置更新能力和配置变更通知机制，为整个平台提供灵活、可扩展的配置管理能力。

---

## 设计理念

### 配置管理核心原则

**优先级明确**：配置值遵循明确的优先级规则，高优先级配置覆盖低优先级配置。

**来源可追溯**：每个配置项都记录其来源，便于调试和审计。

**运行时可更新**：支持运行时动态修改配置，无需重启系统。

**类型安全**：配置值经过验证和类型转换，确保类型一致性。

### 架构设计目标

- 提供统一的配置访问接口，屏蔽底层配置源差异
- 支持多级配置覆盖，满足不同场景的配置需求
- 实现配置变更通知，支持配置驱动的动态行为
- 保证配置加载性能，优化启动时间和运行时开销
- 提供配置验证机制，防止无效配置导致系统异常

---

## 配置层级体系

### 四级配置架构

系统采用四级配置架构，从低到高依次为：系统级配置、项目级配置、用户级配置、环境变量配置。

#### 第一级：系统级配置（System Config）

系统级配置是应用的默认配置，提供所有配置的初始值。系统级配置存放在代码仓库中，作为配置的基础默认值。

```typescript
interface SystemConfig {
  // 应用基础配置
  app_name: string;
  app_version: string;
  environment: "development" | "staging" | "production";
  
  // 日志配置
  log_level: "debug" | "info" | "warn" | "error";
  log_output: "console" | "file" | "remote";
  
  // API配置
  api_timeout: number;
  api_retry_count: number;
  
  // 存储配置
  storage_driver: "local" | "remote";
  storage_path: string;
}
```

#### 第二级：项目级配置（Project Config）

项目级配置覆盖系统级配置，存储在项目根目录的配置文件或配置数据库中。每个项目可以有独立的配置值。

```typescript
interface ProjectConfig {
  // 项目标识
  project_id: string;
  project_name: string;
  
  // 项目级配置覆盖
  custom_settings: Record<string, any>;
  feature_flags: Record<string, boolean>;
  
  // 项目级插件配置
  plugin_overrides: Record<string, PluginConfig>;
  
  // 项目级路径配置
  paths: {
    data: string;
    cache: string;
    output: string;
  };
}
```

#### 第三级：用户级配置（User Config）

用户级配置覆盖项目级配置，存储在用户主目录或用户配置存储中，支持同一项目在不同用户间的配置差异。

```typescript
interface UserConfig {
  // 用户标识
  user_id: string;
  
  // 用户偏好设置
  preferences: {
    theme: "light" | "dark" | "auto";
    language: string;
    timezone: string;
    editor_font_size: number;
  };
  
  // 用户级配置覆盖
  custom_overrides: Record<string, any>;
  
  // 用户凭证
  credentials: {
    api_key?: string;
    access_token?: string;
  };
}
```

#### 第四级：环境变量配置（Environment Config）

环境变量配置拥有最高优先级，直接覆盖其他所有级别配置。适用于容器化部署、CI/CD流程和敏感信息管理。

```typescript
interface EnvironmentConfig {
  // 环境变量前缀约定：OI_
  // 读取以OI_开头的环境变量
  // 示例：OI_API_KEY、OI_LOG_LEVEL、OI_STORAGE_PATH
}
```

### 配置来源优先级

```
优先级从高到低：
┌─────────────────────────────────────────────────────────────┐
│  环境变量配置 (Environment Config) - OI_* 前缀              │
│  优先级: 4 (最高)                                           │
├─────────────────────────────────────────────────────────────┤
│  用户级配置 (User Config) - ~/.organic/user.json            │
│  优先级: 3                                                   │
├─────────────────────────────────────────────────────────────┤
│  项目级配置 (Project Config) - .organic/config.json          │
│  优先级: 2                                                   │
├─────────────────────────────────────────────────────────────┤
│  系统级配置 (System Config) - src/config/default.ts          │
│  优先级: 1 (最低)                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 配置覆盖规则

### 优先级合并策略

配置合并采用深度合并策略，遵循以下规则：

1. **高优先级覆盖低优先级**：当同一配置项在多个层级存在时，高优先级值覆盖低优先级值。

2. **深度合并对象**：对于对象类型的配置项，执行深度合并而非整体替换。

3. **数组整体替换**：对于数组类型的配置项，高优先级配置整体替换低优先级配置。

4. **null值清除**：如果高优先级配置显式设置为null，则清除该配置项。

### 配置覆盖示例

```typescript
// 系统级配置
const systemConfig = {
  api: {
    timeout: 5000,
    retry: 3,
    endpoints: {
      default: "https://api.example.com",
      backup: "https://backup.example.com"
    }
  },
  features: {
    darkMode: true,
    autoSave: true
  }
};

// 项目级配置（覆盖部分值）
const projectConfig = {
  api: {
    timeout: 10000,
    endpoints: {
      default: "https://project-api.example.com"
    }
  },
  features: {
    darkMode: false
  }
};

// 合并结果
const mergedConfig = {
  api: {
    timeout: 10000,        // 被项目级覆盖
    retry: 3,             // 继承自系统级
    endpoints: {
      default: "https://project-api.example.com",  // 被项目级覆盖
      backup: "https://backup.example.com"         // 继承自系统级
    }
  },
  features: {
    darkMode: false,       // 被项目级覆盖
    autoSave: true         // 继承自系统级
  }
};
```

### 冲突处理规则

当多个配置源同时定义同一配置项时，按以下规则处理：

- **简单值冲突**：高优先级覆盖低优先级
- **对象属性冲突**：深度合并后高优先级属性覆盖
- **数组冲突**：高优先级数组整体替换低优先级数组
- **类型不一致**：高优先级类型转换或覆盖

---

## 配置加载机制

### 启动时加载流程

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 加载系统配置 │ → │ 加载项目配置 │ → │ 加载用户配置 │ → │ 加载环境变量 │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
        │                  │                  │                  │
        ↓                  ↓                  ↓                  ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  解析并验证  │ ← │  解析并验证  │ ← │  解析并验证  │ ← │  解析并验证  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
        │                  │                  │                  │
        └──────────────────┴────────┬────────┴──────────────────┘
                                    ↓
                           ┌─────────────────┐
                           │   配置合并处理   │
                           └─────────────────┘
                                    ↓
                           ┌─────────────────┐
                           │  配置验证通过   │
                           └─────────────────┘
```

### 配置源发现机制

```typescript
class ConfigSourceDiscovery {
  // 发现配置源优先级列表
  discoverSources(): ConfigSource[] {
    return [
      new SystemConfigSource(),      // 优先级1
      new ProjectConfigSource(),     // 优先级2
      new UserConfigSource(),       // 优先级3
      new EnvironmentConfigSource() // 优先级4
    ];
  }
}
```

### 延迟加载策略

对于非关键配置项，采用延迟加载策略以优化启动性能：

```typescript
interface LazyConfigEntry {
  key: string;
  load: () => Promise<ConfigValue>;
  cache: ConfigValue | null;
}

// 延迟加载配置访问
class LazyConfigAccessor {
  private lazyEntries: Map<string, LazyConfigEntry> = new Map();
  
  async get(key: string): Promise<ConfigValue> {
    const entry = this.lazyEntries.get(key);
    if (!entry) {
      throw new Error(`配置项 ${key} 未注册延迟加载`);
    }
    
    if (entry.cache === null) {
      entry.cache = await entry.load();
    }
    return entry.cache;
  }
}
```

### 热更新机制

配置系统支持运行时配置热更新，通过以下机制实现：

1. **文件系统监听**：监听配置文件变更事件
2. **发布订阅通知**：配置变更时通知所有订阅者
3. **增量更新**：仅更新变化的配置项

```typescript
interface ConfigChangeListener {
  onConfigChange(changes: ConfigChange[]): void;
}

class HotReloadConfigSource implements ConfigSource {
  private listeners: ConfigChangeListener[] = [];
  
  async watch(callback: ConfigChangeListener): Promise<void> {
    this.listeners.push(callback);
    // 启动文件系统监听
  }
  
  notifyChange(changes: ConfigChange[]): void {
    this.listeners.forEach(listener => listener.onConfigChange(changes));
  }
}
```

---

## 配置验证与类型转换

### 配置Schema验证

```typescript
interface ConfigSchema {
  type: ConfigType;
  default?: ConfigValue;
  required?: boolean;
  validation?: ValidationRule[];
  transform?: TypeTransformer;
}

type ConfigType = "string" | "number" | "boolean" | "object" | "array" | "enum";

interface ValidationRule {
  name: string;
  params?: any;
  message?: string;
}
```

### 内置验证规则

- **min**：最小值/长度验证，参数为value: number
- **max**：最大值/长度验证，参数为value: number
- **pattern**：正则表达式验证，参数为regex: string
- **enum**：枚举值验证，参数为values: any[]
- **custom**：自定义验证函数，参数为fn: Function

### 类型自动转换

配置值在加载时自动进行类型转换，确保类型一致性：

```typescript
const typeTransformers: Record<string, (value: any) => any> = {
  "string": (v) => String(v),
  "number": (v) => Number(v),
  "boolean": (v) => {
    if (typeof v === "boolean") return v;
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
    return Boolean(v);
  },
  "array": (v) => Array.isArray(v) ? v : [v],
  "object": (v) => typeof v === "object" ? v : JSON.parse(String(v))
};
```

---

## 配置服务接口

### ConfigService API

```typescript
interface ConfigService {
  // 配置访问
  get<T = any>(key: string): T;
  get<T = any>(key: string, defaultValue: T): T;
  has(key: string): boolean;
  getAll(): ConfigSnapshot;
  
  // 配置修改
  set(key: string, value: any): void;
  set(keyValueMap: Record<string, any>): void;
  delete(key: string): boolean;
  reset(): void;
  
  // 配置监听
  watch(key: string, callback: ConfigChangeCallback): UnsubscribeFn;
  watchAll(callback: ConfigChangeCallback): UnsubscribeFn;
  
  // 配置源管理
  addSource(source: ConfigSource): void;
  removeSource(sourceId: string): void;
  reload(): Promise<void>;
  
  // 配置查询
  getMetadata(key: string): ConfigMetadata | null;
  listKeys(pattern?: string): string[];
}

interface ConfigChangeCallback {
  (change: ConfigChange): void;
}

interface ConfigChange {
  key: string;
  oldValue: any;
  newValue: any;
  source: ConfigSourceInfo;
  timestamp: number;
}

interface ConfigMetadata {
  key: string;
  value: any;
  source: ConfigSourceInfo;
  type: string;
  lastModified: number;
}
```

### 配置快照

```typescript
interface ConfigSnapshot {
  timestamp: number;
  version: string;
  values: Record<string, any>;
  metadata: Record<string, ConfigMetadata>;
}
```

---

## 数据模型定义

### ConfigSource配置源

```typescript
interface ConfigSource {
  // 配置源标识
  id: string;
  name: string;
  priority: number;
  
  // 加载配置
  load(): Promise<Record<string, ConfigValue>>;
  
  // 存储配置（可选）
  save?(key: string, value: ConfigValue): Promise<void>;
  
  // 检查可用性
  isAvailable(): boolean;
  
  // 获取配置来源信息
  getSourceInfo(): ConfigSourceInfo;
}

interface ConfigSourceInfo {
  id: string;
  name: string;
  type: "system" | "project" | "user" | "environment";
  path?: string;
  description?: string;
}
```

### ConfigValue配置值

```typescript
type ConfigValue = 
  | string 
  | number 
  | boolean 
  | null 
  | ConfigValue[] 
  | { [key: string]: ConfigValue };

interface TypedConfigValue<T = ConfigValue> {
  value: T;
  type: string;
  metadata?: ConfigMetadata;
}
```

### 配置解析结果

```typescript
interface ParsedConfig {
  raw: string;
  parsed: ConfigValue;
  source: ConfigSourceInfo;
  errors: ConfigError[];
}

interface ConfigError {
  key: string;
  message: string;
  severity: "warning" | "error";
  location?: {
    line: number;
    column: number;
  };
}
```

---

## 配置访问示例

### 基础访问模式

```typescript
// 同步访问（启动时配置）
const logLevel = configService.get("log.level");
const apiTimeout = configService.get<number>("api.timeout", 5000);

// 异步访问（运行时配置）
const value = await configService.getAsync("dynamic.config");

// 检查配置存在
if (configService.has("feature.darkMode")) {
  const darkMode = configService.get("feature.darkMode");
}

// 获取所有配置
const allConfig = configService.getAll();
```

### 监听配置变更

```typescript
// 监听单个配置项
const unsubscribe = configService.watch("theme.color", (change) => {
  console.log(`主题颜色从 ${change.oldValue} 变更为 ${change.newValue}`);
  applyTheme(change.newValue);
});

// 监听所有变更
const unsubscribeAll = configService.watchAll((change) => {
  console.log(`配置 ${change.key} 发生变更`);
  logConfigChange(change);
});

// 取消监听
unsubscribe();
```

### 动态配置更新

```typescript
// 设置配置值
configService.set("feature.newFeature", true);

// 批量设置
configService.set({
  "api.timeout": 10000,
  "log.level": "debug",
  "feature.darkMode": false
});

// 从外部重新加载配置
await configService.reload();
```

---

## 验收条件

1. **四级配置层级**：系统支持系统级、项目级、用户级、环境变量四级配置层级
2. **配置优先级**：高优先级配置正确覆盖低优先级配置，优先级顺序正确
3. **深度合并**：对象类型配置项执行深度合并，保留未覆盖的属性
4. **加载流程**：配置按优先级从低到高依次加载，最终合并为统一配置
5. **环境变量支持**：环境变量（OI_前缀）正确读取并覆盖其他配置
6. **ConfigService接口**：提供get、set、watch、reload等完整API
7. **配置验证**：支持Schema验证和类型转换，无效配置抛出错误
8. **变更通知**：配置变更时正确通知所有监听者
9. **配置源扩展**：支持添加自定义配置源并正确集成
10. **配置快照**：提供配置快照功能，支持配置状态回溯

---

## 与现有功能的关系

### 与Plugin系统的协作

配置系统为Plugin系统提供配置管理能力：

- Plugin通过Kernel API获取配置
- Plugin支持声明式配置Schema
- Plugin配置遵循四级覆盖规则
- Plugin配置变更触发通知

### 与Agent架构的协同

Agent运行时依赖配置系统：

- Agent任务参数可从配置获取
- Agent执行环境由配置决定
- Agent日志级别由配置控制
- Agent能力开关由配置管理

### 与存储系统的集成

配置值可存储到持久化系统：

- 项目级配置存储到配置数据库
- 用户级配置存储到用户存储
- 配置变更自动同步到存储后端

---

## 术语定义

- **ConfigSource**：配置源，提供配置值的来源抽象
- **ConfigValue**：配置值，支持多种类型的配置值类型
- **配置覆盖**：高优先级配置值替换低优先级值的过程
- **配置合并**：将多个配置源的值合并为统一配置
- **配置快照**：某一时刻配置状态的完整记录
- **热更新**：运行时动态更新配置，无需重启系统

---

## 相关文档

- feature-006-plugin-spec.md - Plugin插件系统
- feature-001-agent-architecture.md - Agent架构设计
- 配置系统API参考文档
- 配置系统开发指南
