# 任务文档：修复 core-conversation 插件的 TypeScript 类型错误

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P0-002-fix-typescript-errors |
| **优先级** | P0 |
| **标题** | fix-typescript-errors-in-core-conversation |
| **描述** | 修复 core-conversation 插件测试文件中的 38 个 TypeScript 类型错误 |
| **依赖任务** | task-P0-001-core-conversation-plugin-spec.md |
| **可并行** | 否 |
| **创建时间** | 2026-04-30 |
| **执行分支** | agent-develop |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |

---

## 任务背景

### 问题描述

task-P0-002-core-conversation-plugin-impl.md 任务虽被标记为 completed，但 Reviewer 实际审核结论为 **REJECTED**（拒绝），原因是：

- **38 个 TypeScript 类型错误**，全部出现在测试文件中
- CoreConversationPlugin.test.ts: 31 个错误
- OutputFormatter.test.ts: 7 个错误

### 根本原因分析

1. **Mock 对象类型不完整**：测试中的 mock 对象缺少必需属性（如 `callTool`、`PluginConfig` 缺少 `name`/`enabled`）
2. **枚举类型不兼容**：使用了字符串类型 `status: string` 而非正确的 `SessionStatus` 枚举
3. **接口属性缺失**：`PluginOutput` 缺少 `metadata` 属性，`ResponseMessage` 缺少可选属性 `stream`
4. **任务状态管理失误**：任务文档状态仍显示 "completed"，但 Reviewer 审核结果为 "REJECTED"

---

## 任务内容

### 1. 修复 CoreConversationPlugin.test.ts 类型错误

**文件路径**: `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/core-conversation/src/__tests__/CoreConversationPlugin.test.ts`

**需要修复的错误（共 31 个）**:

1. Mock 对象缺少 `callTool` 方法 - 添加完整的 callTool mock 实现
2. `PluginConfig` 缺少 `name` 属性 - 在 mock config 中添加
3. `PluginConfig` 缺少 `enabled` 属性 - 在 mock config 中添加
4. `SessionStatus` 枚举类型不匹配 - 修改 `status: string` 为 `status: SessionStatus`
5. `PluginOutput` 缺少 `metadata` 属性 - 添加可选的 metadata 属性

**修复方案**:
```typescript
// 添加完整的 mock 实现
const mockKernel: Partial<KernelInterface> = {
  callTool: vi.fn().mockResolvedValue({ success: true, result: 'mocked' }),
  getPlugin: vi.fn(),
  getConfig: vi.fn().mockReturnValue({}),
  // ...
};

// 确保 config 包含所有必需属性
const mockConfig: PluginConfig = {
  name: 'core-conversation',
  enabled: true,
  max_session_history: 100,
  default_timeout: 30000,
  enable_streaming: false,
};

// 使用正确的枚举类型
const mockSession: Session = {
  id: 'test-session-id',
  userId: 'test-user',
  status: SessionStatus.ACTIVE,  // 使用枚举而非字符串
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
};
```

### 2. 修复 OutputFormatter.test.ts 类型错误

**文件路径**: `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/core-conversation/src/__tests__/OutputFormatter.test.ts`

**需要修复的错误（共 7 个）**:

1. `ResponseMessage` 缺少可选属性 `stream` - 添加 stream 可选属性
2. `PluginOutput` 类型定义不完整 - 添加 metadata 等可选属性

**修复方案**:
```typescript
// 确保 ResponseMessage 包含所有属性
const mockResponse: ResponseMessage = {
  type: 'text',
  content: 'test content',
  timestamp: new Date(),
  stream: undefined,  // 添加可选属性
};

// 确保 PluginOutput 完整
const mockOutput: PluginOutput = {
  success: true,
  result: { message: mockResponse },
  metadata: { processed: true },  // 添加 metadata
};
```

### 3. 验证 TypeScript 类型检查通过

**执行命令**:
```bash
cd /workspaces/agent-workspace/projects/Organic-Interface/packages/plugins
pnpm typecheck
```

**预期结果**: 无 TypeScript 错误输出

### 4. 验证构建成功

**执行命令**:
```bash
cd /workspaces/agent-workspace/projects/Organic-Interface/packages/plugins
pnpm build
```

**预期结果**: 构建成功，退出码 0

### 5. 更新任务文档状态

**操作**:
- 将 task-P0-002-core-conversation-plugin-impl.md 从 completed 目录移回 pending 目录
- 或更新任务文档中的验收条件，将 "通过 TypeScript 类型检查" 标记为已完成

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/core-conversation/src/__tests__/CoreConversationPlugin.test.ts` | 需要修复的测试文件 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/core-conversation/src/__tests__/OutputFormatter.test.ts` | 需要修复的测试文件 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/core-conversation/src/types/*.ts` | 类型定义参考 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/core-conversation/src/errors/*.ts` | 错误类型参考 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/kernel/src/interfaces/KernelInterface.ts` | Kernel 接口定义 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/interfaces/PluginInterface.ts` | Plugin 接口定义 |

---

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/core-conversation/src/__tests__/CoreConversationPlugin.test.ts` | 修复后的测试文件 |
| `/workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/core-conversation/src/__tests__/OutputFormatter.test.ts` | 修复后的测试文件 |

---

## 验收标准

- [ ] CoreConversationPlugin.test.ts 中的 31 个类型错误全部修复
- [ ] OutputFormatter.test.ts 中的 7 个类型错误全部修复
- [ ] `pnpm typecheck` 在 packages/plugins 目录执行成功，无错误输出
- [ ] `pnpm build` 构建成功
- [ ] 任务文档 task-P0-002-core-conversation-plugin-impl.md 状态正确更新

---

## 失败处理

1. **类型定义不完整**：检查并补充接口/类型的可选属性定义
2. **枚举值错误**：验证 SessionStatus 枚举的实际值定义
3. **构建失败**：检查 tsconfig.json 配置是否正确

---

## 执行计划

### 阶段 1: 文件分析
1. 读取 CoreConversationPlugin.test.ts 分析错误原因
2. 读取 OutputFormatter.test.ts 分析错误原因
3. 读取类型定义文件确认正确类型

### 阶段 2: 修复 CoreConversationPlugin.test.ts
1. 修复 mock 对象类型
2. 修复枚举类型不匹配
3. 添加缺失的必需属性

### 阶段 3: 修复 OutputFormatter.test.ts
1. 修复 ResponseMessage 类型
2. 修复 PluginOutput 类型

### 阶段 4: 验证
1. 运行 `pnpm typecheck`
2. 运行 `pnpm build`
3. 验证构建结果

### 阶段 5: 文档更新
1. 更新相关任务文档状态

---

---

## 最终状态

- **归档时间**: 2026-05-02
- **归档原因**: TypeScript 类型错误已修复，问题已解决
- **最终状态**: 已完成 (archived)

---

## 技术规范

- 测试框架: vitest
- TypeScript 严格模式
- Mock 对象必须完整实现接口所需的所有方法
- 枚举类型必须使用实际枚举值而非字符串
