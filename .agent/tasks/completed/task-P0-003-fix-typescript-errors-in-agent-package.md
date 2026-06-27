# 任务文档：修复 @organic/agent 包的 TypeScript 类型错误

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P0-003-fix-typescript-errors-in-agent-package |
| **优先级** | P0 |
| **标题** | fix-typescript-errors-in-agent-package |
| **描述** | 修复 @organic/agent 包测试文件中的 TypeScript 类型错误（共91个错误，涉及6个测试文件） |
| **可并行** | 否 |
| **创建时间** | 2026-04-30 |
| **执行分支** | agent-develop |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |

---

## 任务背景

### 问题描述

Reviewer 反馈 `pnpm typecheck` 在 @organic/agent 包失败，共有 **91 个 TypeScript 类型错误**，全部出现在测试文件中。

### 错误文件分布

| 文件 | 错误数量 | 主要问题 |
|------|---------|---------|
| ContextService.test.ts | ~15 | 使用字符串字面量而非枚举值 |
| ContextWindowManager.test.ts | ~50 | 使用字符串字面量而非枚举值 |
| AgentMessage.test.ts | 1 | 缺少必需属性 deliveryMode, timestamp |
| AgentMetadata.test.ts | 8 | 缺少必需属性 childIds |
| AgentRegistry.test.ts | 2 | 缺少必需属性 childIds |
| TaskScheduler.test.ts | 2 | 从错误模块导入枚举 |
| WorkflowExecutor.test.ts | 6 | Mock 方法不存在于类型上 |
| Task.test.ts | 4 | RetryPolicy 属性不完整 |

### 根本原因分析

1. **枚举类型不匹配**：测试中使用字符串字面量（如 'plain_text'）而非 TypeScript 枚举值（如 ContentFormat.PLAIN_TEXT）
2. **接口属性缺失**：Mock 对象缺少必需属性（childIds, deliveryMode, timestamp）
3. **导入路径错误**：从错误的模块导入类型/枚举
4. **Mock 类型不完整**：NodeExecutor 类型没有 vi.fn() 的 mock 方法

---

## 任务内容

### 1. 修复 ContextService.test.ts 类型错误

**文件路径**: /workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/context/services/ContextService.test.ts

**需要修复的错误类型**:
- format: 'plain_text' 应改为 format: ContentFormat.PLAIN_TEXT
- type: 'user_message' 应改为 type: MessageType.USER_MESSAGE
- status: 'sent' 应改为 status: MessageStatus.SENT

**修复方案**: 在文件顶部添加导入并替换字符串字面量为枚举值

### 2. 修复 ContextWindowManager.test.ts 类型错误

**文件路径**: /workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/context/services/ContextWindowManager.test.ts

**需要修复的错误类型**: 与 ContextService.test.ts 相同

**修复方案**: 在 createTestMessages 函数中使用枚举值

### 3. 修复 AgentMessage.test.ts 类型错误

**文件路径**: /workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/communication/AgentMessage.test.ts

**错误位置**: 第 316 行

**问题**: 对象缺少 AgentMessage<unknown> 必需的 deliveryMode 和 timestamp 属性

**修复方案**: 在 invalidMessage 对象中添加缺失的属性

### 4. 修复 AgentMetadata.test.ts 类型错误

**文件路径**: /workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/registry/__tests__/AgentMetadata.test.ts

**问题**: AgentMetadata 接口要求 childIds: string[] 属性，但 mock 对象缺失

**修复方案**: 在所有 mock AgentMetadata 对象中添加 childIds: []

### 5. 修复 AgentRegistry.test.ts 类型错误

**文件路径**: /workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/registry/__tests__/AgentRegistry.test.ts

**问题**: 与 AgentMetadata.test.ts 相同，缺少 childIds 属性

**修复方案**: 在所有 mock AgentMetadata 对象中添加 childIds: []

### 6. 修复 TaskScheduler.test.ts 类型错误

**文件路径**: /workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/scheduler/__tests__/TaskScheduler.test.ts

**问题**: TaskPriority 和 TaskStatus 未从 TaskScheduler.js 导出，它们实际定义在 TaskQueue.js

**修复方案**: 修改导入语句从 TaskQueue.js 而非 TaskScheduler.js

### 7. 修复 WorkflowExecutor.test.ts 类型错误

**文件路径**: /workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/workflow/__tests__/engine/WorkflowExecutor.test.ts

**问题**: NodeExecutor 类型没有 mockResolvedValueOnce 和 mockRejectedValueOnce 方法

**修复方案**: 使用 vi.fn().mockImplementation() 替代

### 8. 修复 Task.test.ts 类型错误

**文件路径**: /workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/workflow/__tests__/models/Task.test.ts

**问题**: RetryPolicy 接口要求 retryInterval 属性，但 mock 对象只提供 maxRetries

**修复方案**: 提供完整的 RetryPolicy 属性

### 9. 验证修复

**执行命令**:
```bash
cd /workspaces/agent-workspace/projects/Organic-Interface
pnpm --filter @organic/agent typecheck
```

**预期结果**: 无 TypeScript 错误输出

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| packages/agent/src/context/services/ContextService.test.ts | 需要修复的测试文件 |
| packages/agent/src/context/services/ContextWindowManager.test.ts | 需要修复的测试文件 |
| packages/agent/src/communication/AgentMessage.test.ts | 需要修复的测试文件 |
| packages/agent/src/registry/__tests__/AgentMetadata.test.ts | 需要修复的测试文件 |
| packages/agent/src/registry/__tests__/AgentRegistry.test.ts | 需要修复的测试文件 |
| packages/agent/src/scheduler/__tests__/TaskScheduler.test.ts | 需要修复的测试文件 |
| packages/agent/src/workflow/__tests__/engine/WorkflowExecutor.test.ts | 需要修复的测试文件 |
| packages/agent/src/workflow/__tests__/models/Task.test.ts | 需要修复的测试文件 |
| packages/agent/src/context/Message.ts | Message 类型定义（枚举来源） |
| packages/agent/src/registry/AgentMetadata.ts | AgentMetadata 类型定义 |
| packages/agent/src/scheduler/TaskQueue.ts | TaskPriority/TaskStatus 定义来源 |
| packages/agent/src/workflow/models/Task.ts | RetryPolicy 类型定义 |
| packages/agent/src/workflow/engine/WorkflowExecutor.ts | NodeExecutor 类型定义 |

---

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| 所有上述测试文件 | 修复后的测试文件 |

---

## 验收标准

- [ ] ContextService.test.ts 所有类型错误已修复
- [ ] ContextWindowManager.test.ts 所有类型错误已修复
- [ ] AgentMessage.test.ts 所有类型错误已修复
- [ ] AgentMetadata.test.ts 所有类型错误已修复
- [ ] AgentRegistry.test.ts 所有类型错误已修复
- [ ] TaskScheduler.test.ts 所有类型错误已修复
- [ ] WorkflowExecutor.test.ts 所有类型错误已修复
- [ ] Task.test.ts 所有类型错误已修复
- [ ] pnpm --filter @organic/agent typecheck 执行成功，无错误输出

---

## 失败处理

1. **枚举值问题**：检查 Message.ts 中的枚举定义，确保使用正确的枚举成员
2. **类型断言问题**：如需使用 as const，确保添加所有必需属性
3. **导入路径问题**：验证 TaskQueue.ts 中是否正确导出了 TaskPriority 和 TaskStatus
4. **构建失败**：检查 tsconfig.json 配置是否正确

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
- 所有 mock 对象必须完整实现接口所需的所有必需属性
- 枚举类型必须使用实际枚举值而非字符串
- 导入路径必须指向正确导出位置
