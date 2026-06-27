# P1-008 补充单元测试任务知识产出

## 文档信息

| 字段 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 创建日期 | 2026-06-03 |
| 作者 | Learner |
| 来源任务 | P1-008: 补充 Organic-Interface 剩余单元测试 |
| 来源文档 | projects/Organic-Interface/.agent/tasks/pending-task-P1-008-supplement-unit-tests/01-task.md |
| ExternalVerification | vitest.dev/guide/mocking, vitest.dev/api/vi |

---

## 1. 任务执行概览

| 指标 | 数值 |
|------|------|
| 新增测试文件 | 7 个 |
| 新增测试用例 | 402 个 |
| 修复预存测试文件 | 4 个（126 个用例） |
| 全量测试 | 78 文件 / 2287 用例 / 100% 通过 |
| 涉及包 | kernel, plugins, utils, agent |
| 发现的源码 Bug | 1 个（createMessage 丢失 tool_response） |

---

## 2. 知识点

### 2.1 vitest monorepo 测试配置渐进式管理

**KnowledgeLevel**: L4（模式/最佳实践）

**场景**：在 monorepo 中，多个子任务并行或串行为不同包添加测试文件时，vitest.config.ts 的 `include` 数组需要逐步扩展。

**模式描述**：
- 使用单一根目录 `vitest.config.ts` 管理所有包的测试
- `include` 数组按包分组排列，每个包使用独立的 glob 模式
- 新增包的测试路径时，在 `include` 数组中按包追加新行
- 使用通配 glob（如 `packages/agent/src/**/*.test.ts`）覆盖整个包，避免逐文件添加

**P1-008 实践**：
```
初始 include: kernel, plugins/base, plugins/interfaces, utils
子任务1添加: （kernel 路径已存在，无需修改）
子任务2添加: packages/plugins/src/loaders/__tests__/*.test.ts
子任务3添加: packages/utils/src/errors/__tests__/*.test.ts
             packages/plugins/src/core-conversation/src/errors/__tests__/*.test.ts
子任务4验证: packages/agent/src/**/*.test.ts（已存在，无需修改）
```

**注意事项**：
- 子任务间需协调避免重复添加同一路径
- 优先使用宽泛的 glob（`src/**/*.test.ts`）而非精确路径
- 新增 include 可能导致该路径下已有但之前未被执行的测试首次运行，需先验证

### 2.2 Node.js isTTY 在 vitest 中的 Mock 方式

**KnowledgeLevel**: L5（关键知识/问题解决方案）

**问题**：`vi.spyOn(process.stdout, 'isTTY', 'get')` 报错 `"isTTY" does not exist`。

**根因**：`process.stdout.isTTY` 是 Node.js 内置 getter 属性，不是普通函数方法。`vi.spyOn()` 使用 Tinyspy 底层实现，无法直接 spy 内置对象的 getter。

**正确方案**：使用 `Object.defineProperty` 定义 getter：

```typescript
// ✅ 正确：使用 Object.defineProperty mock isTTY getter
Object.defineProperty(process.stdout, 'isTTY', {
  get: () => true,
  configurable: true,  // 必须，允许后续恢复/重新定义
});

// 恢复
Object.defineProperty(process.stdout, 'isTTY', {
  get: () => originalIsTTY,
  configurable: true,
});
```

**适用场景**：需要 mock Node.js 内置对象上的 getter/setter 属性（如 `process.stdout.isTTY`、`process.stdout.columns`、`process.platform` 等）时。

**ExternalVerification**: vitest.dev/guide/mocking — vi.spyOn 仅支持函数和对象方法，内置 getter 需使用 Object.defineProperty。

### 2.3 预存测试修复模式

**KnowledgeLevel**: L4（模式/最佳实践）

**场景**：当 vitest.config.ts 新增 include 路径后，该路径下已存在但之前未被执行的测试文件会被首次运行。这些预存测试可能存在与当前代码不一致的问题。

**三种典型修复模式**：

#### 模式 A：导入路径修正

**症状**：`Cannot find module` 或引用错误的导出源。

**案例**：`ContextError.test.ts` 和 `SessionError.test.ts` 从各自源文件导入 `ConversationErrorCode`，但该枚举实际定义在 `ConversationError.ts` 中。

**修复**：统一导入源为实际定义文件。
```typescript
// ❌ 错误
import { ConversationErrorCode } from '../ContextError.js';
// ✅ 正确
import { ConversationErrorCode } from '../ConversationError.js';
```

#### 模式 B：时间戳竞态条件

**症状**：连续的 `Date.now()` 调用在同一毫秒内返回相同值，导致时间戳对比测试失败（如 `expect(timestamp1).toBeLessThan(timestamp2)`）。

**修复**：使用 `vi.useFakeTimers()` + `vi.advanceTimersByTime(1)` 精确控制时间推进。
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

it('should create unique timestamps', () => {
  const obj1 = new MyClass();
  vi.advanceTimersByTime(1);  // 推进 1ms
  const obj2 = new MyClass();
  expect(obj1.timestamp).toBeLessThan(obj2.timestamp);
});
```

**ExternalVerification**: vitest.dev/guide/mocking#dates — vitest 使用 @sinonjs/fake-timers，`vi.useFakeTimers()` 冻结时间，需手动推进。

#### 模式 C：API 不匹配

**症状**：测试期望与实际 API 行为不一致（如 `toJSON()` 输出字段变化、`fromJSON()` 行为变化）。

**案例**：
- `errors.test.ts` 期望 `ConversationError.toJSON()` 包含 `stack` 字段，但实际实现不含
- `errors.test.ts` 期望 `fromJSON()` 保留原始 `timestamp`，但实际实现创建新时间戳

**修复策略**：
1. 确认当前 API 实际行为（读取源码）
2. 如 API 行为正确，修正测试期望以匹配实际
3. 如 API 行为是 bug，记录 bug 并编写反映当前行为的测试（附注释说明）

### 2.4 createMessage() tool_response 源码 Bug

**KnowledgeLevel**: L5（关键知识）

**Bug 描述**：`packages/agent/src/context/Message.ts` 中 `createMessage()` 函数接收 `MessageOptions.tool_response` 参数但不将其传递到返回对象中。

**影响**：`createToolResponseMessage()` 工厂函数明确传递了 `tool_response` 参数，但被 `createMessage()` 静默丢弃，导致创建的 TOOL_RESPONSE 类型消息丢失 `tool_response` 字段。

**当前状态**：未修复。测试已记录当前实际行为（`tool_response` 为 `undefined`），等待后续任务处理。

**建议修复**：在 `createMessage()` 返回对象中添加：
```typescript
tool_response: options.tool_response,
```

**审核记录**：Reviewer 标记为 L2-05 建议改进项（不阻塞 P1-008 通过）。

### 2.5 测试覆盖率进一步提升经验

**KnowledgeLevel**: L3（经验总结）

**前次基线**（P1-001）：74.35% → 80.31%（+5.96%）

**P1-008 策略差异**：
- P1-001 聚焦：已部分覆盖的模块（补充缺失的测试用例提升行覆盖率）
- P1-008 聚焦：**完全缺失**测试覆盖的模块（从 0 到 1 创建测试文件）

**P1-008 涉及的模块类型及测试策略**：

| 模块类型 | 示例 | 测试策略 |
|----------|------|----------|
| 服务类 | TextService (671行), InfoService (461行) | 完整 mock 外部依赖（process.stdout, fs），覆盖所有公开方法 |
| 加载器类 | RemotePluginLoader (321行) | Mock HTTP/网络层，测试构造函数、委托方法、错误路径 |
| 错误类 | ConversationError, ValidationError | 覆盖构造函数、序列化、工厂方法、错误码枚举 |
| 数据模型 | ContextItem, Message | 覆盖工厂函数、验证函数、更新函数、排序函数、枚举值 |

**关键经验**：
1. 从 0 到 1 创建测试时，优先阅读源码而非仅看接口定义，因为接口可能不完整
2. 服务类测试的难点不在业务逻辑，而在正确 mock 外部依赖（process.stdout, fs, http）
3. 错误类测试需要考虑继承链（如 ValidationError extends BaseError extends Error）
4. 数据模型测试需同时验证：枚举完整性、工厂函数正确性、验证函数边界条件

---

## 3. 关联知识

| 文档 | 说明 |
|------|------|
| [test-coverage-improvement.md](test-coverage-improvement.md) | 前次覆盖率提升经验（P1-001） |
| [vitest-monorepo-testing.md](vitest-monorepo-testing.md) | Vitest monorepo 配置经验 |
| [testing-problem-solutions.md](testing-problem-solutions.md) | 测试问题与解决方案 |

---

*整理者: Learner*
*整理时间: 2026-06-03*
*SourceRawFile: projects/Organic-Interface/.agent/tasks/pending-task-P1-008-supplement-unit-tests/01-task.md*