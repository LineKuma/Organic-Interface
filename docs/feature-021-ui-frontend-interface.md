# TUI / WebUI 标准功能接口

## 基本信息

**文档编号**: DOC-021
**所属模块**: @organic/ui — frontend
**优先级**: P1
**创建日期**: 2026-08-17
**对应需求**: 2.2 交互界面作为工具、MVP 之外的 Web UI 界面规划

---

## 1. 概述

Organic-Interface 既有的用户入口是 **TUI**（`packages/ui` 中的终端界面），而 **WebUI** 处于待规划阶段。为了让两者在未来长期共存、能力对齐，本项目定义一套 **标准功能接口（Standard Frontend Interface）**。

标准功能接口的核心理念：

> **任何 TUI 或 WebUI 前端，必须实现标准接口的全部功能；无法实现的功能，必须以"可接受的 stub"形式存在——即既不能缺失，也不能静默失败。**

这条硬约束通过以下方式被 **结构化强制**，而非仅靠约定：

1. **契约即代码**：单一抽象基类 `UIFrontend` 定义了全部功能方法，覆盖所有产品能力域。
2. **全量默认 stub**：基类为每一个方法都提供 stub 实现，stub 会以 `NotImplementedError` 明确抛错（绝不静默），因此任何前端天生"有可接受的 stub"。
3. **一致性审计**：`getCoverage()` 逐方法审计前端实现情况，把"必须全部实现或存在 stub"变成可检查、可进 CI 的保证。

---

## 2. 能力域与方法清单

标准接口共划分 **10 个能力域**，映射到产品的全部功能面。每个方法标注其分级：

- **Tier A（`required: true`）**：前端**必须真正实现**，否则 `getCoverage()` 判定为不合规。
- **Tier B（`required: false`）**：允许仅保留 stub，但仍必须在接口中声明存在。

| 能力域           | id             | 方法（A=必实现，B=可 stub）                                                                                                                                                    |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 系统与运行时     | `system`       | `getInfo`(A) · `healthCheck`(A) · `getLogs`(B)                                                                                                                                 |
| 会话与对话       | `conversation` | `createSession`(A) · `listSessions`(A) · `loadSession`(A) · `deleteSession`(B) · `sendMessage`(A) · `streamMessage`(B)                                                         |
| Agent 任务与编排 | `tasks`        | `submitTask`(A) · `getTaskStatus`(A) · `listTasks`(A) · `cancelTask`(A) · `previewPlan`(B) · `decidePlan`(B)                                                                   |
| 工作流引擎       | `workflow`     | `listWorkflows`(A) · `createWorkflow`(A) · `updateWorkflow`(B) · `deleteWorkflow`(A) · `runWorkflow`(A) · `pauseWorkflow`(B) · `resumeWorkflow`(B) · `getWorkflowExecution`(A) |
| 提示词管理       | `prompt`       | `listPrompts`(A) · `getPrompt`(A) · `createPrompt`(A) · `updatePrompt`(A) · `deletePrompt`(A) · `previewPrompt`(B) · `listPromptVersions`(B) · `rollbackPrompt`(B)             |
| 文件引用         | `fileref`      | `referenceFile`(A) · `referenceDirectory`(B) · `listReferences`(A) · `removeReference`(A) · `getFileSymbols`(B) · `getFileDependencies`(B)                                     |
| 配置             | `config`       | `getAllConfig`(A) · `updateConfig`(A) · `resetConfig`(B) · `listConfigWizards`(B) · `runConfigWizard`(A)                                                                       |
| 安全与审批       | `security`     | `getSecurityPresets`(A) · `setSecurityPreset`(A) · `requestApproval`(A) · `respondApproval`(A) · `listAuditLogs`(B)                                                            |
| 界面即工具       | `uiops`        | `runUIOperation`(A) · `getUIState`(A) · `setUIPermissionLevel`(B)                                                                                                              |
| 操作录制与回放   | `recording`    | `startRecording`(A) · `stopRecording`(A) · `listRecordings`(A) · `replayRecording`(B) · `diffRecordings`(B)                                                                    |

方法签名、入参/出参类型的权威定义见 [`packages/ui/src/frontend/types.ts`](../packages/ui/src/frontend/types.ts)，能力域注册表见 [`packages/ui/src/frontend/capabilities.ts`](../packages/ui/src/frontend/capabilities.ts)。

---

## 3. 契约实现与一致性机制

### 3.1 抽象基类 `UIFrontend`

所有前端（现在的 TUI、未来的 WebUI）都必须继承 [`UIFrontend`](../packages/ui/src/frontend/UIFrontend.ts)：

```typescript
import { UIFrontend } from '@organic/ui';

export class MyTuiFrontend extends UIFrontend {
  constructor() {
    super({ kind: 'tui', name: 'my-tui', version: '1.0.0' });
  }
  // 实现需要真实支持的方法；其余方法自动沿用基类 stub。
}
```

- 基类为**每一个**方法提供默认 stub，满足"至少有可接受的 stub"要求。
- stub 调用时抛出 `NotImplementedError`（错误码 `NOT_IMPLEMENTED`，消息含完整方法键如 `workflow.listWorkflows`），**绝不静默**。
- 两个方法 `getInfo` 与 `healthCheck` 在基类中已有真实实现，前端无需覆写。

### 3.2 可接受的 stub：显式声明

对于有意暂不实现的 Tier B 功能，建议用 `declareStub()` 声明原因，使 stub 从"可接受的可读性"提升到"可审计"：

```typescript
const frontend = new MyTuiFrontend();
frontend.declareStub('prompt.rollbackPrompt', '计划在 v2 提供');

// 触发该方法时，错误会携带该说明
await frontend.rollbackPrompt('p', '1.0.0');
// → NotImplementedError: ... Reason: 计划在 v2 提供
```

也可在构造参数中批量声明：`super({ kind: 'web', name: 'web', version: '1', stubs: { 'prompt.rollbackPrompt': 'deferred to v2' } })`。构造时会校验 `stubs` 中声明的键必须是已知方法，否则抛错，避免写错方法名。

### 3.3 一致性审计 `getCoverage()`

`getCoverage()` 返回结构化报告，据此可一键判断前端是否达标：

```typescript
const coverage = frontend.getCoverage();
// {
//   capabilities: [...],           // 逐能力域、逐方法的状态
//   total, implemented, stubbed,   // 汇总
//   conformat: boolean,            // 是否全部 Tier A 均实现
//   violations: string[],          // 仍为 stub 的 Tier A 方法（不合规项）
//   stubReasons: {...},            // 每个 stub 的声明原因
// }
```

判定规则：

- `status === 'implemented'`：前端覆写了该方法（或该方法在基类有真实实现）。
- `status === 'stub'`：方法沿用基类 stub（即未覆写），且在结果中报告 `reason`（如有）。
- `conformat === true` ⟺ 无任何 Tier A 方法停留在 stub。

> **这就是"必须全部实现所有功能或至少有可以接受的 stub"的可检查保证**：Tier A 必须真实现，Tier B 允许 stub，但所有方法都必须存在且可审计。

---

## 4. 使用方式与模板

### 4.1 最小可达前端（全部走 stub，不合规，会被覆盖度审计标记）

```typescript
class MinimalTui extends UIFrontend {
  constructor() {
    super({ kind: 'tui', name: 'minimal', version: '0.0.1' });
  }
}
```

`getCoverage().conformat === false`，`violations` 列出所有仍为 stub 的 Tier A 方法。

### 4.2 达标前端（实现全部 Tier A）

只需覆写 `capabilities.ts` 中 `required: true` 的方法，`getCoverage().conformat === true`。

```typescript
class TuiFrontend extends UIFrontend {
  constructor() {
    super({ kind: 'tui', name: 'organic-tui', version: '1.0.0' });
  }
  override async sendMessage(input: SendMessageInput): Promise<MessageResult> {
    // 委托给对话/Agent 核心逻辑 ...
  }
  // ... 覆写其余 Tier A 方法
}
```

### 4.3 将一致性并入 CI

任何前端新增时，可断言其报告达标：

```typescript
import { createMyFrontend } from './my-frontend';

expect(createMyFrontend().getCoverage().violations).toEqual([]);
```

现有单测 [`packages/ui/src/frontend/__tests__/UIFrontend.test.ts`](../packages/ui/src/frontend/__tests__/UIFrontend.test.ts) 已覆盖：结构性完整性、stub 抛错、覆盖度报告、Tier A 强制、Tier B 允许 stub、`declareStub` 校验。

---

## 5. 约定与边界

- **契约独立于渲染技术**：前端方法入参/出参使用 `frontend/types.ts` 中自包含的类型，不绑定具体后端服务实现或渲染库，TUI 与 WebUI 实现同一套契约。
- **不允许静默 stub**：基类 stub 一律抛错；前端不得在覆写中吞掉错误后静默返回"成功但无操作"。
- **Tier B 也要存在**：Tier B 允许 stub，但方法必须仍然在接口中存在（基类已保证），不可从前端删除导致签名漂移。
- **新增功能域的方法**：修改 `capabilities.ts` 的 `FRONTEND_CAPABILITIES` 并同步在 `UIFrontend` 增加 stub 与方法类型，保证新功能对所有前端要么可实现要么有 stub。

---

## 6. 相关文档

- [需求文档 requirements.md](requirements.md) — 2.2 交互界面作为工具、Web UI 规划
- [技术选型 tech-stack.md](tech-stack.md) — TUI 现状与 Web UI 规划
- [架构设计 architecture.md](architecture.md) — 自定义层（@organic/ui）定位
- [TUI 组件参考 tui-components.md](tui-components.md) — 终端 UI 组件
