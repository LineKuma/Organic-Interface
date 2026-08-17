# 任务文档：Kernel文字交互能力强化

## 基本信息

| 字段 | 值 |
|------|-----|
| **任务编号** | task-P0-003 |
| **任务名称** | Kernel文字交互能力强化 |
| **所属模块** | 核心架构 (kernel) |
| **优先级** | P0 |
| **状态** | completed |
| **完成日期** | 2026-04-25 |
| **执行分支** | agent-develop |
| **创建日期** | 2026-04-25 |
| **可并行** | 否 |
| **依赖任务** | 无（可与task-P0-001和task-P0-002并行规划） |
| **对应文档** | feature-006-plugin-spec.md, feature-007-tool-system.md |

---

## 任务背景

### 设计原则

根据用户设计理念：
- **kernel要求**：必须完整支持文字交互
- **plugin要求**：基本CLI文字级别输入输出，可选GUI支持

Kernel作为系统核心引擎，必须提供完善的基础文字交互能力，使Plugin能够在纯文字环境下正常工作。

### 当前状态

根据 `task-P0-102-kernel-core.md` 和 `task-P0-103-plugin-system.md` 的实现结果：
- Kernel主类、生命周期管理、事件总线已实现
- Plugin系统基础已实现
- 但Kernel的文字交互服务接口尚未完整定义和实现

### 目标

强化Kernel的文字交互能力，提供：
1. 完善的信息服务接口
2. 文字输出格式化服务
3. 文字输入解析服务
4. 流式输出支持

---

## 任务目标

在 `@organic/kernel` 包中新增/强化文字交互相关服务：

1. **强化 InfoService 信息服务**
   - 添加更多系统信息获取接口
   - 添加项目上下文管理接口

2. **新增 TextService 文字服务**
   - 文字输出格式化
   - 流式输出支持
   - ANSI颜色支持
   - 表格格式化

3. **强化 KernelApi 接口**
   - 暴露 TextService 给Plugin
   - 确保Plugin可通过Kernel调用文字服务

---

## 输入文件（参考）

| 文件路径 | 用途 |
|----------|------|
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/kernel/Kernel.ts` | Kernel主类 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/kernel/PluginManager.ts` | Plugin管理器 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/base/BasePlugin.ts` | Plugin基类参考 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/utils/src/types/` | 类型定义参考 |

---

## 输出文件

| 文件路径 | 内容描述 |
|----------|----------|
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/services/TextService.ts` | 文字服务 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/services/InfoService.ts` | 强化后的信息服务 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/services/index.ts` | 服务导出 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/types/kernel-api.ts` | 强化后的KernelApi类型 |

---

## 实现要求

### 1. TextService 文字服务

**服务职责**
- 提供文字输出格式化能力
- 支持流式输出
- 提供表格、列表等格式化工具

**接口定义**
```typescript
interface TextService {
  // 基础输出
  print(text: string, options?: PrintOptions): void;
  println(text?: string): void;
  
  // 格式化输出
  formatTable(data: TableData, options?: TableOptions): string;
  formatList(items: string[], options?: ListOptions): string;
  formatSection(title: string, content: string): string;
  
  // 样式输出（ANSI）
  styled(text: string, style: TextStyle): string;
  success(text: string): string;
  error(text: string): string;
  warning(text: string): string;
  info(text: string): string;
  
  // 流式输出
  createStream(options?: StreamOptions): TextStream;
  
  // 进度显示
  progress(current: number, total: number, message?: string): string;
  spinner(message?: string): SpinnerController;
}

interface PrintOptions {
  prefix?: string;
  suffix?: string;
  indent?: number;
  timestamp?: boolean;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

interface TableOptions {
  borders?: boolean;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
}

interface TextStream {
  write(chunk: string): void;
  writeln(chunk?: string): void;
  flush(): void;
  end(): void;
}

interface SpinnerController {
  start(): void;
  stop(): void;
  success(message?: string): void;
  error(message?: string): void;
}
```

**实现要点**
- 使用ANSI转义序列实现颜色和样式
- 表格格式化需处理列宽自适应
- 流式输出使用可写的流接口
- Spinner需支持多种动画类型

### 2. 强化 InfoService 信息服务

**新增接口**
```typescript
interface InfoService {
  // 现有接口保留
  get_config(key: string): ConfigValue;
  get_all_configs(): Record<string, ConfigValue>;
  get_runtime_info(): RuntimeInfo;
  
  // 新增项目上下文接口
  get_project_context(): ProjectContext;
  get_project_root(): string;
  get_project_name(): string;
  get_project_version(): string;
  
  // 新增系统信息接口
  get_system_info(): SystemInfo;
  get_platform_info(): PlatformInfo;
  
  // 新增环境接口
  get_env(key: string): string | undefined;
  get_all_envs(): Record<string, string>;
}
```

**类型定义**
```typescript
interface ProjectContext {
  root: string;
  name: string;
  version: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  kernelVersion: string;
  uptime: number;
}

interface PlatformInfo {
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  isCI: boolean;
  homeDir: string;
  tempDir: string;
  cwd: string;
}
```

### 3. 强化 KernelApi 类型

**更新接口定义**
```typescript
interface KernelApi {
  // 现有接口
  info: InfoService;
  tools: KernelToolService;
  plugins: KernelPluginService;
  events: EventBus;
  
  // 新增文字服务
  text: TextService;
  
  // 新增便捷方法
  logger: Logger;
  
  // 现有方法保留
  registerPlugin(plugin: PluginInterface): Promise<void>;
  unregisterPlugin(name: string): Promise<void>;
  call_tool(name: string, params: Record<string, unknown>): Promise<ToolResult>;
}
```

### 4. 更新 Kernel 主类

**集成 TextService**
```typescript
class Kernel implements KernelApi {
  // ... 现有属性
  
  public readonly text: TextService;
  
  constructor(config: KernelConfig) {
    // ... 现有初始化
    
    // 初始化文字服务
    this.text = new TextService({
      enableColor: config.text?.enableColor ?? true,
      enableTimestamp: config.text?.enableTimestamp ?? false,
    });
  }
}
```

---

## 验收条件

- [x] 创建 `TextService` 类并实现所有接口方法
- [x] TextService 支持 ANSI 颜色输出（success/error/warning/info）
- [x] TextService 支持表格格式化（formatTable）
- [x] TextService 支持列表格式化（formatList）
- [x] TextService 支持流式输出（TextStream）
- [x] TextService 支持 Spinner 动画
- [x] 强化 InfoService 添加项目上下文接口
- [x] 强化 InfoService 添加系统信息接口
- [x] 更新 KernelApi 类型定义包含 text 服务
- [x] Kernel 主类正确初始化 TextService
- [x] Plugin 可通过 context.kernel_api.text 访问文字服务
- [x] 所有新增类型定义遵循 @organic/utils 规范
- [x] 通过 TypeScript 类型检查
- [x] 更新 Kernel 模块导出

---

## 执行步骤

1. [ ] 创建 `packages/kernel/src/services/` 目录
2. [ ] 创建 `TextService.ts` 实现文字服务
3. [ ] 创建 `InfoService.ts` 或更新现有实现
4. [ ] 更新 `packages/kernel/src/types/kernel-api.ts`
5. [ ] 更新 `Kernel.ts` 集成 TextService
6. [ ] 更新 `packages/kernel/src/services/index.ts`
7. [ ] 更新 `packages/kernel/src/index.ts`
8. [ ] 运行 TypeScript 类型检查
9. [ ] 验证构建通过

---

## 验证方式

```bash
# 1. TypeScript 类型检查
cd packages/kernel && pnpm typecheck

# 2. 构建验证
cd packages/kernel && pnpm build

# 3. 验证服务导出
grep -r "TextService" packages/kernel/src/

# 4. 验证KernelApi更新
grep -r "text:" packages/kernel/src/types/
```

---

## 注意事项

1. **跨平台兼容**：TextService 需兼容 Windows/Linux/macOS
2. **TTY检测**：颜色输出应根据终端是否支持自动调整
3. **流式输出**：使用 Node.js Stream API，确保内存效率
4. **性能考虑**：格式化方法应避免频繁的字符串拼接
5. **向后兼容**：不影响现有的 KernelApi 使用方式

---

## 文档同步要求

- [ ] 更新 `packages/kernel/README.md` 添加 TextService 说明
- [ ] 更新 `docs/feature-006-plugin-spec.md` 标注Kernel文字服务能力

---

## 后续关联任务

- **task-P0-002-core-conversation-plugin-impl**：核心对话Plugin实现（会使用TextService）

---

## Reviewer 审核记录

### 审核结论
**通过 (APPROVED)**

### 审核时间
2026-04-25

### 审核内容摘要

#### 1. 代码质量检查
- TextService 完整实现，包含所有必需接口
- InfoService 强化完整，包含项目上下文和系统信息接口
- 类型定义符合 @organic/utils 规范
- 代码符合项目编码规范，跨平台兼容

#### 2. 任务完成度验证
| 验收标准 | 状态 |
|----------|------|
| TextService 基础输出 (print/println) | 通过 |
| TextService 格式化输出 (formatTable/formatList/formatSection) | 通过 |
| TextService ANSI样式 (success/error/warning/info/styled) | 通过 |
| TextService 流式输出 (TextStream) | 通过 |
| TextService Spinner动画 | 通过 |
| InfoService 项目上下文接口 | 通过 |
| InfoService 系统信息接口 | 通过 |
| InfoService 环境变量接口 | 通过 |
| KernelApi 类型定义 | 通过 |
| Kernel 主类集成 | 通过 |

#### 3. 构建验证
- `pnpm build` 执行成功
- 无 TypeScript 编译错误
- 无编译警告
- 产物正确生成

#### 4. Git提交验证
- 提交ID: `6308fe4`
- 提交信息格式正确 (feat(kernel): ...)
- 包含 Implements 引用
- 包含 Design 说明
- 作者信息: linecat <linecatstudio@outlook.com>

#### 5. 变更文件
| 文件 | 变更类型 |
|------|----------|
| packages/kernel/src/services/TextService.ts | 新增 (706行) |
| packages/kernel/src/services/InfoService.ts | 新增 (472行) |
| packages/kernel/src/services/index.ts | 新增 |
| packages/kernel/src/kernel/Kernel.ts | 修改 (集成服务) |
| packages/kernel/src/index.ts | 修改 (导出服务) |
| packages/utils/src/types/Plugin.ts | 修改 (类型定义) |

### 变更文件内容验证
1. **TextService.ts**: 完整实现，包含ANSI颜色、表格格式化、列表格式化、流式输出、Spinner
2. **InfoService.ts**: 完整实现，包含项目上下文、系统信息、平台检测、环境变量访问
3. **Kernel.ts**: 正确集成 text 和 info 服务
4. **Plugin.ts**: KernelApi 接口已更新，包含 text 和 info 服务

### 最终结论
任务 `task-P0-003-kernel-text-interaction` 已完成，所有验收标准均已通过。实现符合设计规范，代码质量良好，构建成功。

