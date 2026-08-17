# 安全模型详解

## 基本信息

**文档类型**: 安全设计文档
**版本**: 0.1.0
**状态**: 已发布

---

## 概述

Organic-Interface 的安全模型基于四层权限体系，为 UI 操作提供细粒度的访问控制。安全系统覆盖沙箱隔离、权限验证、操作审计、选择器安全等维度，确保 AI Agent 的操作在可控范围内进行。

---

## 权限级别体系

### 四级权限模型

| 级别 | 名称 | 可执行操作                                             | 典型场景                       |
| ---- | ---- | ------------------------------------------------------ | ------------------------------ |
| L1   | 只读 | scroll, hover, wait, getText, getAttribute, screenshot | 信息采集、页面监控             |
| L2   | 交互 | L1 + click, select                                     | 页面导航、选项选择（默认级别） |
| L3   | 输入 | L2 + input                                             | 表单填写、搜索操作             |
| L4   | 完全 | 所有操作                                               | 管理员操作、系统配置           |

### 权限继承

```
L4 (完全权限)
 ├── L3 (可输入)
 │    ├── L2 (可交互) ← 默认
 │    │    ├── L1 (只读)
```

高级别自动拥有低级别的所有权限。

### 权限选择指南

| 场景           | 推荐级别 | 理由                         |
| -------------- | -------- | ---------------------------- |
| 数据采集 Agent | L1       | 只需读取界面信息，无需交互   |
| 页面导航 Agent | L2       | 需要点击和选择，但不需要输入 |
| 表单填写 Agent | L3       | 需要输入文本内容             |
| 管理后台 Agent | L4       | 需要完全控制权限             |

---

## 沙箱隔离机制

### 沙箱架构

```
┌─────────────────────────────────────────┐
│              AI Agent 请求               │
├─────────────────────────────────────────┤
│           沙箱 (Sandbox)                  │
│  ┌───────────────────────────────────┐   │
│  │        权限检查 (Permission Check)  │   │
│  │  • 会话有效性验证                   │   │
│  │  • 权限级别比对                     │   │
│  │  • 操作白名单/黑名单                │   │
│  │  • 操作数限制                       │   │
│  │  • 选择器安全验证                   │   │
│  ├───────────────────────────────────┤   │
│  │        操作记录 (Recording)         │   │
│  │  • 操作类型、选择器、时间戳          │   │
│  │  • 操作前后状态                     │   │
│  │  • 错误信息记录                     │   │
│  ├───────────────────────────────────┤   │
│  │        会话管理 (Session)           │   │
│  │  • 会话生命周期                     │   │
│  │  • 操作计数限制                     │   │
│  │  • 会话统计                         │   │
│  └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│              实际 UI 操作                 │
└─────────────────────────────────────────┘
```

### 会话隔离

每个 Agent 会话独立运行，拥有独立的权限级别和操作计数：

```typescript
const sessionA = sandbox.createSession('agent-a', 'L2');
const sessionB = sandbox.createSession('agent-b', 'L3');

// sessionA 不能执行 input 操作（需要 L3）
sandbox.checkPermission(sessionA.sessionId, 'input', '#field');
// → { allowed: false, reason: 'Insufficient permission level' }

// sessionB 可以执行 input 操作
sandbox.checkPermission(sessionB.sessionId, 'input', '#field');
// → { allowed: true, requiresConfirmation: true }
```

---

## 操作权限矩阵

### 完整权限表

| 操作         | L1  | L2  | L3  | L4  | 敏感 | 可拒绝 |
| ------------ | :-: | :-: | :-: | :-: | :--: | :----: |
| scroll       |  ✓  |  ✓  |  ✓  |  ✓  |  —   |   ✓    |
| hover        |  ✓  |  ✓  |  ✓  |  ✓  |  —   |   ✓    |
| wait         |  ✓  |  ✓  |  ✓  |  ✓  |  —   |   ✓    |
| getText      |  ✓  |  ✓  |  ✓  |  ✓  |  —   |   ✓    |
| getAttribute |  ✓  |  ✓  |  ✓  |  ✓  |  —   |   ✓    |
| screenshot   |  ✓  |  ✓  |  ✓  |  ✓  |  —   |   ✓    |
| click        |  —  |  ✓  |  ✓  |  ✓  |  —   |   ✓    |
| select       |  —  |  ✓  |  ✓  |  ✓  |  —   |   ✓    |
| input        |  —  |  —  |  ✓  |  ✓  |  ✓   |   ✓    |

### 敏感操作

`input` 操作被标记为敏感操作，需要额外的确认步骤：

```typescript
const result = sandbox.checkPermission(sessionId, 'input', '#username');
// → { allowed: true, requiresConfirmation: true, warnings: ['This operation may involve sensitive data'] }
```

通过 `confirm` 方法完成确认：

```typescript
if (result.requiresConfirmation) {
  const confirmed = await sandbox.confirm({
    sessionId,
    message: 'Allow input to #username?',
  });
  if (!confirmed) {
    throw new Error('User denied input operation');
  }
}
```

---

## 选择器安全

### 安全验证

系统对所有 CSS/XPath 选择器进行安全验证，防止注入攻击：

```typescript
// 安全的选择器
sandbox.validateSelector('#my-button'); // ✓ CSS 选择器
sandbox.validateSelector('//div[@class="main"]'); // ✓ XPath 选择器

// 危险的选择器（被拒绝）
sandbox.validateSelector('javascript:alert(1)'); // ✗ javascript: 协议
sandbox.validateSelector('data:text/html,...'); // ✗ data: 协议
```

### 危险模式检测

| 模式          | 检测 | 说明          |
| ------------- | ---- | ------------- |
| `javascript:` | 拒绝 | 防止 XSS 攻击 |
| `data:`       | 拒绝 | 防止数据注入  |
| `eval(`       | 拒绝 | 防止代码执行  |

---

## 操作记录与审计

### 记录内容

每次操作记录包含：

```typescript
interface OperationRecord {
  operation: UIOperationType; // 操作类型
  selector: string; // 目标选择器
  timestamp: number; // 操作时间戳
  sessionId: string; // 会话 ID
  agentId: string; // Agent ID
  parameters?: Record<string, unknown>; // 操作参数
  status: 'success' | 'failed'; // 执行状态
  errorMessage?: string; // 错误信息
}
```

### 历史查询

```typescript
// 查看单个会话的操作历史
const history = sandbox.getOperationHistory(sessionId);

// 查看所有会话的操作历史
const allHistory = sandbox.getAllOperationHistory();

// 清除历史
sandbox.clearHistory(sessionId); // 指定会话
sandbox.clearHistory(); // 所有会话
```

### CLI 日志查询

```bash
# 查看操作日志
organic log

# 按状态筛选
organic log --status failed

# 按操作类型筛选
organic log --type click

# 按 Agent 筛选
organic log --agent agent-001
```

---

## 安全最佳实践

### 原则 1：最小权限

始终使用完成任务所需的最低权限级别：

```typescript
// ✗ 不推荐 — 使用 L4 完成简单任务
const session = sandbox.createSession('agent', 'L4');

// ✓ 推荐 — 使用 L1 完成只读任务
const session = sandbox.createSession('agent', 'L1');
```

### 原则 2：默认拒绝

未明确允许的操作默认被拒绝：

```typescript
// 只允许特定操作
sandbox.updateConfig({
  allowedOperations: ['scroll', 'getText', 'screenshot'],
  deniedOperations: ['click', 'input', 'select'],
});
```

### 原则 3：操作计数限制

限制单会话操作数，防止资源滥用：

```typescript
sandbox.updateConfig({ maxOperationsPerSession: 100 });
```

### 原则 4：敏感操作确认

保持敏感操作的确认机制：

```typescript
sandbox.updateConfig({ requireConfirmation: true });
```

### 原则 5：定期审计

定期查看操作日志，检查异常行为：

```bash
organic log --status failed
organic log --agent suspicious-agent
```

---

## 安全事件

### 事件监听

沙箱触发以下安全相关事件：

| 事件                 | 触发时机 | 数据          |
| -------------------- | -------- | ------------- |
| `session:created`    | 创建会话 | `{ session }` |
| `session:terminated` | 终止会话 | `{ session }` |
| `operation:recorded` | 记录操作 | `{ context }` |

### 事件监听示例

```typescript
sandbox.on('session:created', data => {
  console.log(`新会话创建: ${data.session.sessionId}`);
  // 发送告警或记录日志
});

sandbox.on('operation:recorded', data => {
  if (data.context.operation === 'input') {
    // 对敏感操作进行额外监控
    console.log(`敏感操作: ${data.context.selector}`);
  }
});
```

---

## 相关文档

- [配置参考](./configuration.md) — 安全配置选项
- [架构设计](./architecture.md) — 系统架构
- [故障排除](./troubleshooting.md) — 安全相关问题
- [feature-011-security-system.md](./feature-011-security-system.md) — 安全系统详细设计
