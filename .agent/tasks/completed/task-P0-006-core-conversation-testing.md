# 任务文档：恢复 core-conversation 测试覆盖

## 基本信息

| 字段 | 内容 |
|------|------|
| **任务编号** | task-P0-006 |
| **任务名称** | 恢复 core-conversation 测试覆盖 |
| **所属模块** | 测试质量 |
| **优先级** | P0 |
| **状态** | pending |
| **执行分支** | agent-develop |
| **创建日期** | 2026-04-26 |
| **可并行** | 否 |
| **依赖任务** | 无 |
| **项目路径** | /workspaces/agent-workspace/projects/Organic-Interface |

---

## 任务背景

### 问题描述

在最近的测试执行中，core-conversation 插件的测试文件被排除在测试运行之外：

```
core-conversation | 5 | 0 (已排除) | 跳过
```

这意味着 core-conversation 模块没有有效的测试覆盖，存在以下风险：

1. **质量风险**: 核心对话功能没有自动化测试验证
2. **回归风险**: 后续修改可能破坏现有功能
3. **规范违规**: AGENTS_GENERAL.xml 要求任何错误修复必须伴随完整测试

### 根本原因分析

core-conversation 插件的测试被排除可能原因：

1. **vitest 配置问题**: 测试文件可能配置为 exclude
2. **导入问题**: 测试文件导入的模块有编译错误
3. **测试隔离问题**: 测试可能依赖未初始化的全局状态

### 相关任务参考

- task-P0-002: 核心对话Plugin实现 - 已完成
- task-P1-002: 运行测试 - 已完成（但core-conversation测试被跳过）

---

## 任务目标

1. **诊断问题**: 确定 core-conversation 测试被排除的根本原因
2. **修复配置**: 使测试文件可正常运行
3. **完善测试**: 为以下模块编写/补充测试：
   - SessionManager
   - ContextManager
   - InputParser
   - OutputFormatter
   - CoreConversationPlugin
4. **验证通过**: 确保所有测试通过

---

## 涉及的文件

### 需要分析的文件

| 文件路径 | 用途 |
|----------|------|
| /workspaces/agent-workspace/projects/Organic-Interface/vitest.config.ts | Vitest 配置 |
| /workspaces/agent-workspace/projects/Organic-Interface/packages/plugins/src/core-conversation/src/__tests__/*.test.ts | 测试文件 |

### 需要完善的测试文件

| 测试文件 | 目标模块 | 测试用例数 |
|----------|----------|-----------|
| SessionManager.test.ts | SessionManager | 15-20 |
| ContextManager.test.ts | ContextManager | 15-20 |
| InputParser.test.ts | InputParser | 10-15 |
| OutputFormatter.test.ts | OutputFormatter | 10-15 |
| CoreConversationPlugin.test.ts | CoreConversationPlugin | 15-20 |

### 参考文件

| 文件路径 | 用途 |
|----------|------|
| packages/plugins/src/core-conversation/src/SessionManager.ts | SessionManager 实现 |
| packages/plugins/src/core-conversation/src/ContextManager.ts | ContextManager 实现 |
| packages/plugins/src/core-conversation/src/InputParser.ts | InputParser 实现 |
| packages/plugins/src/core-conversation/src/OutputFormatter.ts | OutputFormatter 实现 |
| packages/plugins/src/core-conversation/src/CoreConversationPlugin.ts | CoreConversationPlugin 实现 |

---

## 执行步骤

### 步骤 1: 诊断问题

1. 检查 `vitest.config.ts` 配置，确认是否有排除规则
2. 尝试单独运行 core-conversation 测试：
   ```bash
   cd /workspaces/agent-workspace/projects/Organic-Interface
   pnpm test packages/plugins/src/core-conversation
   ```
3. 分析错误输出，确定根本原因

### 步骤 2: 修复配置问题

根据诊断结果，修复以下可能的问题：

**选项 A**: 修复 vitest 配置
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // 移除对 core-conversation 的排除
    ],
  },
});
```

**选项 B**: 修复测试文件导入问题
```typescript
// 确保导入路径正确
import { SessionManager } from '../SessionManager.js';
import { PluginContext } from '@organic/utils';
```

**选项 C**: 修复测试隔离问题
```typescript
// 使用 beforeEach/afterEach 清理状态
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 步骤 3: 补充测试用例

为每个模块补充测试用例：

#### 3.1 SessionManager 测试

```typescript
describe('SessionManager', () => {
  describe('createSession()', () => {
    it('should create a new session with default config', async () => { });
    it('should create a session with custom name', async () => { });
    it('should generate unique session ID', async () => { });
    it('should set initial status to ACTIVE', async () => { });
  });

  describe('getSession()', () => {
    it('should return session by ID', async () => { });
    it('should return null for non-existent session', async () => { });
  });

  describe('closeSession()', () => {
    it('should update session status to CLOSED', async () => { });
    it('should throw for non-existent session', async () => { });
  });
});
```

#### 3.2 ContextManager 测试

```typescript
describe('ContextManager', () => {
  describe('getContext()', () => {
    it('should return empty context for new session', async () => { });
    it('should throw for non-existent session', async () => { });
  });

  describe('addMessage()', () => {
    it('should add message to context', async () => { });
    it('should update message count', async () => { });
  });

  describe('clearContext()', () => {
    it('should remove all messages', async () => { });
    it('should respect keep_recent option', async () => { });
  });
});
```

#### 3.3 InputParser 测试

```typescript
describe('InputParser', () => {
  describe('parse()', () => {
    it('should parse plain text input', () => { });
    it('should parse markdown input', () => { });
    it('should parse JSON input', () => { });
    it('should detect input format automatically', () => { });
  });

  describe('extractVariables()', () => {
    it('should extract template variables', () => { });
    it('should return empty array for plain text', () => { });
  });
});
```

#### 3.4 OutputFormatter 测试

```typescript
describe('OutputFormatter', () => {
  describe('format()', () => {
    it('should format plain text output', () => { });
    it('should format structured output', () => { });
    it('should apply styling for different result types', () => { });
  });

  describe('formatTable()', () => {
    it('should format data as table', () => { });
    it('should handle empty data', () => { });
  });
});
```

#### 3.5 CoreConversationPlugin 测试

```typescript
describe('CoreConversationPlugin', () => {
  describe('initialize()', () => {
    it('should initialize session manager', async () => { });
    it('should initialize context manager', async () => { });
  });

  describe('execute()', () => {
    it('should handle CREATE_SESSION action', async () => { });
    it('should handle SEND_MESSAGE action', async () => { });
    it('should handle CLOSE_SESSION action', async () => { });
    it('should return error for invalid action', async () => { });
  });

  describe('getStatus()', () => {
    it('should return current plugin status', () => { });
  });
});
```

### 步骤 4: 验证测试

```bash
cd /workspaces/agent-workspace/projects/Organic-Interface
pnpm test
```

期望输出：
```
Test Files  12 passed (12)
Tests      200+ passed
```

---

## 验收条件

- [ ] core-conversation 测试可正常运行
- [ ] SessionManager 测试覆盖 > 80%
- [ ] ContextManager 测试覆盖 > 80%
- [ ] InputParser 测试覆盖 > 80%
- [ ] OutputFormatter 测试覆盖 > 80%
- [ ] CoreConversationPlugin 测试覆盖 > 80%
- [ ] 所有测试通过（无失败）
- [ ] 测试输出无 error 级别日志

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 测试修复后发现大量bug | 中 | 中 | 分批修复，每次修复后运行测试 |
| 依赖注入复杂导致测试难以编写 | 低 | 低 | 参考现有测试的mock模式 |
| 测试运行时间过长 | 低 | 低 | 优化测试用例数量 |

---

## 注意事项

1. **测试隔离**: 每个测试用例必须独立，不依赖其他测试的状态
2. **Mock使用**: 适当使用mock避免依赖外部服务
3. **错误模拟**: 测试必须覆盖错误场景
4. **日志监控**: 测试期间监控error级别日志，发现则判定失败

---

## 后续关联任务

- task-P1-004: Agent 调度框架完善
- task-P1-005: 存储系统完善

---

## 元信息

| 字段 | 内容 |
|------|------|
| **Planner** | Agent |
| **计划日期** | 2026-04-26 |
| **版本** | 1.0.0 |

---
