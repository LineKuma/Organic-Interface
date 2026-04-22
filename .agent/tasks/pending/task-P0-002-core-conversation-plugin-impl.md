# 任务文档：核心对话Plugin实现

## 基本信息

| 字段 | 值 |
|------|-----|
| **任务编号** | task-P0-002 |
| **任务名称** | 核心对话Plugin实现 |
| **所属模块** | 核心架构 (core-conversation-plugin) |
| **优先级** | P0 |
| **状态** | pending |
| **执行分支** | agent-develop |
| **创建日期** | 2026-04-25 |
| **可并行** | 否 |
| **依赖任务** | task-P0-001-core-conversation-plugin-spec.md |
| **对应文档** | feature-014-core-conversation-plugin.md, feature-006-plugin-spec.md |

---

## 任务目标

根据 `feature-014-core-conversation-plugin.md` 规范文档，实现核心对话Plugin的完整代码，包括：

1. Plugin主类实现
2. 会话管理器实现
3. 上下文管理器实现
4. 输入解析器实现
5. 输出格式化器实现
6. 错误处理机制实现

---

## 输入文件（参考）

| 文件路径 | 用途 |
|----------|------|
| `/workspaces/agent-workspace/projects/Organic-Interface/docs/feature-014-core-conversation-plugin.md` | 核心对话Plugin规范文档 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/kernel/Kernel.ts` | Kernel实现参考 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/base/BasePlugin.ts` | Plugin基类参考 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/utils/src/types/` | 类型定义参考 |

---

## 输出文件

| 文件路径 | 内容描述 |
|----------|----------|
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/core-conversation/` | 核心对话Plugin包目录 |
| `packages/plugins/src/core-conversation/src/CoreConversationPlugin.ts` | Plugin主类 |
| `packages/plugins/src/core-conversation/src/SessionManager.ts` | 会话管理器 |
| `packages/plugins/src/core-conversation/src/ContextManager.ts` | 上下文管理器 |
| `packages/plugins/src/core-conversation/src/InputParser.ts` | 输入解析器 |
| `packages/plugins/src/core-conversation/src/OutputFormatter.ts` | 输出格式化器 |
| `packages/plugins/src/core-conversation/src/errors/` | 错误定义目录 |
| `packages/plugins/src/core-conversation/src/types/` | 类型定义目录 |
| `packages/plugins/src/core-conversation/src/index.ts` | 模块入口 |
| `packages/plugins/src/core-conversation/package.json` | 包定义文件 |

---

## 目录结构要求

```
packages/plugins/src/core-conversation/
├── src/
│   ├── CoreConversationPlugin.ts    # Plugin主类
│   ├── SessionManager.ts            # 会话管理器
│   ├── ContextManager.ts            # 上下文管理器
│   ├── InputParser.ts               # 输入解析器
│   ├── OutputFormatter.ts           # 输出格式化器
│   ├── errors/
│   │   ├── ConversationError.ts     # 错误基类
│   │   ├── SessionError.ts          # 会话错误
│   │   ├── ContextError.ts          # 上下文错误
│   │   └── index.ts                 # 错误导出
│   ├── types/
│   │   ├── session.ts               # 会话类型定义
│   │   ├── context.ts               # 上下文类型定义
│   │   ├── input.ts                 # 输入类型定义
│   │   ├── output.ts                # 输出类型定义
│   │   └── index.ts                 # 类型导出
│   └── index.ts                     # 模块主入口
├── package.json                      # 包定义
├── tsconfig.json                    # TypeScript配置
└── README.md                        # 包说明文档
```

---

## 实现要求

### 1. CoreConversationPlugin 主类

**核心方法实现**
```typescript
class CoreConversationPlugin implements PluginInterface {
  // 初始化方法
  async initialize(context: PluginContext): Promise<InitializeResult>;
  
  // 执行方法 - 处理对话输入
  async execute(input: PluginInput): Promise<PluginOutput>;
  
  // 关闭方法
  async shutdown(): Promise<void>;
  
  // 元数据
  getMetadata(): PluginMetadata;
}
```

**Plugin元数据定义**
```typescript
const METADATA: PluginMetadata = {
  name: 'core-conversation',
  version: '1.0.0',
  description: 'Core conversation plugin for text-based interaction',
  api_version: '1.0.0',
  min_kernel_version: '1.0.0',
  dependencies: [],
  default_config: {
    max_session_history: 100,
    default_timeout: 30000,
    enable_streaming: false,
  },
  config_schema: { /* ... */ },
};
```

### 2. SessionManager 会话管理器

**核心功能**
- 创建新会话（generateSessionId）
- 获取会话（getSession）
- 恢复会话（resumeSession）
- 关闭会话（closeSession）
- 列出活跃会话（listActiveSessions）
- 会话超时管理

**接口定义**
```typescript
interface SessionManager {
  createSession(userId?: string): Session;
  getSession(sessionId: string): Session | null;
  resumeSession(sessionId: string): Session | null;
  closeSession(sessionId: string): void;
  listActiveSessions(): Session[];
  cleanupExpiredSessions(): void;
}
```

### 3. ContextManager 上下文管理器

**核心功能**
- 获取上下文（getContext）
- 更新上下文（updateContext）
- 追加消息（appendMessage）
- 获取历史（getHistory）
- 清除上下文（clearContext）

**接口定义**
```typescript
interface ContextManager {
  getContext(sessionId: string): ConversationContext;
  updateContext(sessionId: string, updates: Partial<ConversationContext>): void;
  appendMessage(sessionId: string, message: Message): void;
  getHistory(sessionId: string, limit?: number): Message[];
  clearContext(sessionId: string): void;
}
```

### 4. InputParser 输入解析器

**核心功能**
- 解析用户输入文本
- 提取意图标识
- 提取参数
- 验证输入格式

**接口定义**
```typescript
interface InputParser {
  parse(input: string): ParsedInput;
  extractIntent(input: string): string | null;
  extractParameters(input: string): Record<string, any>;
  validate(input: string): ValidationResult;
}
```

### 5. OutputFormatter 输出格式化器

**核心功能**
- 格式化响应文本
- 支持流式输出
- 错误信息格式化
- 元数据附加

**接口定义**
```typescript
interface OutputFormatter {
  format(response: PluginOutput): FormattedOutput;
  formatError(error: ConversationError): FormattedOutput;
  formatStream(chunk: any): string;
}
```

### 6. 错误类型定义

**错误分类**
- `ConversationError`: 基础错误类
- `SessionError`: 会话相关错误（会话不存在、会话已关闭等）
- `ContextError`: 上下文相关错误（上下文过期、上下文已满等）
- `ParsingError`: 解析错误（输入格式错误、意图识别失败等）
- `TimeoutError`: 超时错误
- `KernelError`: Kernel交互错误

---

## 验收条件

- [ ] 创建 `packages/plugins/src/core-conversation/` 目录结构
- [ ] 实现 CoreConversationPlugin 主类，包含 initialize/execute/shutdown 方法
- [ ] 实现 SessionManager 会话管理器，支持会话创建/获取/恢复/关闭
- [ ] 实现 ContextManager 上下文管理器，支持上下文获取/更新/追加/清除
- [ ] 实现 InputParser 输入解析器，支持文本解析和意图提取
- [ ] 实现 OutputFormatter 输出格式化器，支持结构化响应输出
- [ ] 定义完整的错误类型体系（至少6种错误类型）
- [ ] 定义所有TypeScript类型（Session/Context/Input/Output）
- [ ] 创建 package.json 并正确配置organic插件元数据
- [ ] 创建模块入口 index.ts 导出所有公开接口
- [ ] 实现与Kernel服务的交互（通过PluginContext）
- [ ] 遵循 @organic/utils 类型定义规范
- [ ] 通过 TypeScript 类型检查
- [ ] 编写 README.md 文档

---

## 执行步骤

1. [ ] 创建目录结构
2. [ ] 实现类型定义（types/目录）
3. [ ] 实现错误定义（errors/目录）
4. [ ] 实现 SessionManager.ts
5. [ ] 实现 ContextManager.ts
6. [ ] 实现 InputParser.ts
7. [ ] 实现 OutputFormatter.ts
8. [ ] 实现 CoreConversationPlugin.ts
9. [ ] 创建 index.ts 模块入口
10. [ ] 创建 package.json
11. [ ] 创建 tsconfig.json
12. [ ] 创建 README.md
13. [ ] 运行 TypeScript 类型检查
14. [ ] 更新 packages/plugins/src/index.ts 导出新模块

---

## 验证方式

```bash
# 1. 验证目录结构
ls -la packages/plugins/src/core-conversation/

# 2. TypeScript 类型检查
cd packages/plugins && pnpm typecheck

# 3. 构建验证
cd packages/plugins && pnpm build

# 4. 确认导出
grep -r "core-conversation" packages/plugins/src/index.ts
```

---

## 注意事项

1. **CLI文字级别**：输入输出基于纯文本交互，不依赖特定UI框架
2. **与Kernel解耦**：通过PluginContext与Kernel交互，不直接依赖具体实现
3. **会话隔离**：每个会话的状态独立，互不干扰
4. **资源清理**：shutdown时必须清理所有会话和资源
5. **错误恢复**：支持部分失败场景，不会因单次错误导致整个Plugin崩溃

---

## 文档同步要求

- [ ] 更新 `packages/plugins/README.md` 添加 core-conversation 插件说明
- [ ] 更新 `docs/feature-014-core-conversation-plugin.md` 标注"已实现"状态

---

## 后续关联任务

- **task-P0-003-kernel-text-interaction**：强化Kernel文字交互能力
