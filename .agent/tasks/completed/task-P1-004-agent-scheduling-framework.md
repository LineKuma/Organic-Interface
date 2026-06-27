# 任务文档：完善Agent调度框架

## 基本信息

- **任务ID**: task-P1-004-agent-scheduling-framework
- **优先级**: P1
- **创建日期**: 2026-04-22
- **状态**: completed
- **执行分支**: agent-develop
- **执行者**: Coder

## 任务概述

根据 feature-001-agent-architecture.md 和 feature-008-context-management.md 文档定义，完善 Organic-Interface 的 Agent 调度框架。现有 Agent 核心模块已实现基本功能，本任务将扩展以下能力：

1. **Agent 通信协议** - 实现标准化的 Agent 间消息传递机制
2. **任务队列增强** - 添加依赖追踪、重试管理、死锁检测
3. **Agent 注册中心** - 实现动态注册、发现、健康检查
4. **编排层** - 整合各组件，提供统一的任务编排能力

## 输入文件

- `/workspaces/agent-workspace/projects/Organic-Interface/docs/feature-001-agent-architecture.md`
- `/workspaces/agent-workspace/projects/Organic-Interface/docs/feature-008-context-management.md`
- `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/core/Agent.ts`
- `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/scheduler/TaskScheduler.ts`
- `/workspaces/agent-workspace/projects/Organic-Interface/packages/agent/src/workflow/engine/WorkflowEngine.ts`

## 输出文件

### 新建文件

1. **通信协议**
   - `packages/agent/src/communication/AgentMessage.ts` - Agent消息定义
   - `packages/agent/src/communication/AgentChannel.ts` - Agent通信通道
   - `packages/agent/src/communication/MessageQueue.ts` - 消息队列管理
   - `packages/agent/src/communication/index.ts` - 模块导出

2. **注册中心**
   - `packages/agent/src/registry/AgentRegistry.ts` - Agent注册中心
   - `packages/agent/src/registry/AgentMetadata.ts` - Agent元数据
   - `packages/agent/src/registry/index.ts` - 模块导出

3. **编排层**
   - `packages/agent/src/orchestration/OrchestrationLayer.ts` - 编排层
   - `packages/agent/src/orchestration/ExecutionCoordinator.ts` - 执行协调器
   - `packages/agent/src/orchestration/index.ts` - 模块导出

### 修改文件

- `packages/agent/src/index.ts` - 更新导出

## 实现内容

### 1. Agent通信协议 (communication/)

#### AgentMessage.ts

**消息结构**
- `AgentMessage`: 完整消息定义（包含id, source, target, action, payload, timestamp, correlationId）
- `MessageAction`: 消息动作类型（EXECUTE, QUERY, RESPONSE, SUBSCRIBE, NOTIFY, HEARTBEAT, ERROR）
- `MessagePriority`: 优先级（HIGH, NORMAL, LOW）
- `MessageMetadata`: 元数据

**工厂函数**
- `createAgentMessage()`, `createExecuteMessage()`, `createQueryMessage()`, `createResponseMessage()`, `createHeartbeatMessage()`

#### AgentChannel.ts

**通道功能**
- 消息发送（支持同步/异步）
- 消息订阅
- 请求-响应模式
- 超时控制
- 重试机制
- 消息序列化/反序列化

**事件**
- `message:received`, `message:sent`, `error`, `timeout`

#### MessageQueue.ts

**队列操作**
- 消息入队/出队
- 优先级排序
- 消息过滤
- TTL管理
- 死信队列

### 2. Agent注册中心 (registry/)

#### AgentMetadata.ts

**元数据定义**
- `AgentMetadata`: Agent元数据（id, name, type, capabilities, status, load, endpoint）
- `RegistryEntry`: 注册表条目
- `HealthCheckResult`: 健康检查结果

#### AgentRegistry.ts

**注册功能**
- `register(agent)`: 注册Agent
- `unregister(agentId)`: 注销Agent
- `discover(criteria)`: 发现Agent
- `get(agentId)`: 获取Agent
- `list()`: 列出所有Agent

**健康检查**
- `startHealthCheck(interval)`: 启动健康检查
- `stopHealthCheck()`: 停止健康检查
- `isHealthy(agentId)`: 检查健康状态

**负载均衡**
- `getAvailableAgents(capability)`: 获取可用Agent
- `selectAgent(agents)`: 选择最优Agent

### 3. 编排层 (orchestration/)

#### OrchestrationLayer.ts

**编排功能**
- `orchestrate(request)`: 编排任务
- `registerAgent(agent)`: 注册Agent
- `getOrchestrationPlan()`: 获取编排计划
- `pause()`/`resume()`: 暂停/恢复编排

**策略**
- 任务分解策略
- Agent选择策略
- 负载均衡策略

#### ExecutionCoordinator.ts

**协调功能**
- 协调多个Agent执行
- 处理并行/串行执行
- 收集结果整合
- 处理超时和错误

### 4. 任务队列增强 (scheduler/)

- 添加依赖追踪可视化
- 死锁检测机制
- 重试策略配置

## 验收标准

1. Agent间通信支持同步/异步模式
2. 消息传递有超时和重试机制
3. Agent注册中心支持动态注册和发现
4. 健康检查机制正常工作
5. 编排层能协调多个Agent执行
6. 所有导出正确集成到主包
7. pnpm build 通过
8. pnpm test 通过

## Coder 执行记录

- **开始时间**: 2026-04-22
- **最后更新**: 2026-04-29
- **执行状态**: completed