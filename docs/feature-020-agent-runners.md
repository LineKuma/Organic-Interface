# Agent Runners 本机与远程执行

## 基本信息

**文档编号**: DOC-020
**所属模块**: 核心 SDK（@organic/agent）
**优先级**: P1
**创建日期**: 2026-08-17
**对应需求**: 项目核心与 remote agent 作为 runner 实现，支持在本机或远程运行，完全模块化和隔离执行能力

---

## 1. 概述

Agent Runners 是 `@organic/agent` 的执行层抽象，将任务的 **执行位置** 与 **执行方式** 从 Agent 的业务逻辑中解耦。通过统一的 `AgentRunner` 接口，同一套 Agent 代码可以透明地运行在：

- **本机进程内**（`LocalRunner`）— 零序列化开销、最低延迟
- **远程主机**（`RemoteRunner` + `RemoteRunnerServer`）— 跨网络分发、独立部署、负载均衡
- **隔离沙箱**（`InProcessIsolation` / `ChildProcessIsolation`）— 逻辑隔离或 OS 级进程隔离

| 组件                      | 职责                                                         |
| ------------------------- | ------------------------------------------------------------ |
| **AgentRunner**           | 所有 runner 的抽象基类，统一生命周期、任务跟踪与健康检查接口 |
| **LocalRunner**           | 本机进程内执行，直接委托给 Agent 实例                        |
| **RemoteRunner**          | 远程执行客户端，通过 HTTP / WebSocket 提交任务               |
| **RemoteRunnerServer**    | 远程执行服务器，将 Agent 能力暴露为 HTTP / WS 服务           |
| **RunnerRegistry**        | 多个 runner 的注册、发现与基于能力/模式的选择                |
| **ExecutionIsolation**    | 隔离执行契约接口，可插拔的隔离策略                           |
| **InProcessIsolation**    | 进程内逻辑隔离：超时、并发限制、任务名白/黑名单              |
| **ChildProcessIsolation** | 子进程 OS 级隔离：独立内存、V8 沙箱、进程级超时              |

### 典型使用场景

- **分布式 Agent 集群**：多个 worker 机器运行 `RemoteRunnerServer`，主节点用 `RunnerRegistry` 负载均衡分发任务
- **敏感任务隔离**：将不可信代码放进 `ChildProcessIsolation`，与主进程内存完全隔离
- **资源受限部署**：无独立进程预算时使用 `LocalRunner` + `InProcessIsolation`
- **跨网络调用**：`RemoteRunner` 通过 REST API 调用其他网络上的 Agent

---

## 2. 架构

```
┌────────────────────────────────────────────────────────────────────┐
│                          RunnerRegistry                           │
│  注册 / 发现 / 能力匹配 / 健康跟踪 / 统计                            │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ selectAvailable()
        ┌──────────────────┼─────────────────────┐
        ▼                  ▼                     ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ LocalRunner  │  │   RemoteRunner   │  │  (sandboxed)     │
│  本机进程内   │  │  HTTP/WebSocket  │  │  隔离执行         │
└──────┬───────┘  └────────┬─────────┘  └────────┬─────────┘
       │                   │                      │
       ▼                   ▼                      ▼
┌──────────────┐  ┌──────────────────┐  ┌─────────────────────────┐
│   Agent      │  │RemoteRunnerServer│  │   ExecutionIsolation    │
│  实例委托     │  │  HTTP 服务       │  │   ┌─────────────────┐   │
└──────────────┘  │  /api/v1/execute │  │   │ InProcessIsol.  │   │
                  │  /api/v1/health  │  │   └─────────────────┘   │
                  │  /ws             │  │   ┌─────────────────┐   │
                  └────────┬─────────┘  │   │ChildProcessIsol │   │
                           │            │   └─────────────────┘   │
                           ▼            └─────────────────────────┘
                      ┌──────────┐
                      │  Agent   │
                      └──────────┘
```

**数据流**：`RunnerRegistry` 按能力/模式选择 runner → `LocalRunner` 直接委托 Agent，或 `RemoteRunner` 通过 HTTP/WS 调用 `RemoteRunnerServer` → 服务端 Agent 执行 → 结果按统一 `AgentResult` 结构返回。

---

## 3. 快速开始

### 3.1 本机执行（LocalRunner）

```typescript
import { Agent, LocalRunner, RunnerMode } from '@organic/agent';

const agent = new Agent({
  kernel: kernelApi,
  config: { id: 'local-001', name: 'LocalWorker', version: '1.0.0' },
});
await agent.initialize();
agent.registerTaskHandler('greet', async input => `Hello ${input.name}`);

const runner = new LocalRunner({
  runnerId: 'local-runner-1',
  name: 'Local Worker',
  agent,
});
await runner.start();

const result = await runner.execute({
  taskId: 'greet',
  payload: { name: 'Organic' },
});
console.log(result.data); // "Hello Organic"
await runner.stop();
```

### 3.2 远程执行（RemoteRunner + RemoteRunnerServer）

```typescript
import { Agent, RemoteRunnerServer, RemoteRunner, RemoteTransport } from '@organic/agent';

// ---- 服务端（worker 机器）----
const workerAgent = new Agent({
  kernel: kernelApi,
  config: { id: 'remote-001', name: 'RemoteWorker', version: '1.0.0' },
});
await workerAgent.initialize();
workerAgent.registerTaskHandler('compute', async input => input.a + input.b);

const server = new RemoteRunnerServer({
  port: 8080,
  agent: workerAgent,
  apiKey: 'secret-key', // 可选鉴权
});
await server.start();
console.log(server.getUrl()); // http://0.0.0.0:8080

// ---- 客户端（调度机器）----
const runner = new RemoteRunner({
  runnerId: 'remote-client-1',
  name: 'Remote Client',
  remoteUrl: 'http://worker-host:8080',
  transport: RemoteTransport.HTTP,
  apiKey: 'secret-key',
});
await runner.start();

const result = await runner.execute({
  taskId: 'compute',
  payload: { a: 2, b: 3 },
});
console.log(result.data); // 5
```

### 3.3 隔离执行（Isolation）

```typescript
import { InProcessIsolation, ChildProcessIsolation } from '@organic/agent';

// 进程内逻辑隔离
const inProcess = new InProcessIsolation({
  defaultTimeout: 5000,
  maxConcurrent: 4,
  forbiddenTaskNames: ['dangerous'],
});

const r1 = await inProcess.execute(
  { taskName: 'sum', payload: { a: 1, b: 2 } },
  payload => payload.a + payload.b
);
console.log(r1.data); // 3

// 子进程 OS 级隔离（handler 必须自包含，会被序列化到子进程）
const child = new ChildProcessIsolation({ defaultTimeout: 10000 });
const r2 = await child.execute(
  { taskName: 'multiply', payload: { a: 6, b: 7 } },
  payload => payload.a * payload.b
);
console.log(r2.data); // 42
```

### 3.4 多 runner 管理与选择

```typescript
import { RunnerRegistry, LocalRunner, RunnerMode, RunnerHealthStatus } from '@organic/agent';

const registry = new RunnerRegistry('production');

// 注册多个 runner
registry.register(localRunner);
registry.register(remoteRunner);

// 按模式选择
const remotes = registry.find({ mode: RunnerMode.REMOTE });

// 选择可接受任务的健康 runner（自动负载均衡）
const available = registry.selectAvailable({ capability: 'compute' });

// 聚合统计
const stats = registry.getStats();
console.log(stats.total, stats.healthy, stats.byMode);
```

---

## 4. AgentRunner 抽象基类

所有 runner 继承 `AgentRunner`，统一暴露以下能力：

### 4.1 生命周期

```typescript
abstract class AgentRunner extends EventEmitter {
  async start(): Promise<void>; // 启动（幂等）
  async stop(): Promise<void>; // 优雅停止（幂等）
  isStarted(): boolean; // 是否已启动
}
```

### 4.2 抽象方法（子类必须实现）

```typescript
abstract execute<R = unknown>(input: AgentTaskInput): Promise<AgentResult<R>>;
abstract healthCheck(): Promise<RunnerHealthStatus>;
```

### 4.3 任务跟踪与统计

每个 runner 自动维护任务计数与负载，并派发事件：

```typescript
const runner = new LocalRunner({...});
runner.on('task:start', ({ taskId }) => {});
runner.on('task:complete', ({ taskId, result }) => {});
runner.on('task:error', ({ taskId, error }) => {});
runner.on('health:change', ({ oldStatus, newStatus }) => {});

const stats = runner.getStats();
// { runnerId, mode, health, activeTaskCount, completedTaskCount,
//   failedTaskCount, load, uptime, lastHealthCheckAt }

const canAccept = runner.canAcceptTasks(); // 启动 && 健康 && 未满载
```

### 4.4 RunnerHealthStatus

| 值          | 说明               |
| ----------- | ------------------ |
| `HEALTHY`   | 健康，可接受任务   |
| `DEGRADED`  | 降级，功能部分可用 |
| `UNHEALTHY` | 不健康，执行失败   |
| `OFFLINE`   | 离线，未启动/断开  |

### 4.5 RunnerMode

| 值          | 说明                    |
| ----------- | ----------------------- |
| `LOCAL`     | 本机进程内执行          |
| `REMOTE`    | HTTP/WebSocket 远程执行 |
| `SANDBOXED` | 隔离沙箱执行            |

---

## 5. LocalRunner 本机执行

`LocalRunner` 直接包装一个 `Agent` 实例，任务在同一个 Node.js 进程内执行。

**特性**：

- 直接委托 Agent，零序列化开销
- 共享内存空间，最小延迟
- 生命周期自动同步（start → agent.initialize()）
- 健康检查委托给 Agent 的 `canAcceptTasks()`

```typescript
const runner = new LocalRunner({
  runnerId: 'local-1',
  name: 'Local Worker',
  agent,
  maxConcurrentTasks: 10, // 最大并发
  defaultTimeout: 30000, // 默认超时
});
```

---

## 6. RemoteRunnerServer 远程服务端

将 Agent 暴露为 HTTP / WebSocket 服务，供 `RemoteRunner` 客户端远程调用。

### 6.1 API 端点

| 方法 | 路径                | 说明                 |
| ---- | ------------------- | -------------------- |
| GET  | `/api/v1/health`    | 健康检查             |
| GET  | `/api/v1/info`      | Agent 信息（能力等） |
| POST | `/api/v1/execute`   | 执行任务             |
| GET  | `/api/v1/tasks/:id` | 查询任务结果         |
| WS   | `/ws`               | WebSocket 实时通道   |

### 6.2 配置

```typescript
const server = new RemoteRunnerServer({
  host: '0.0.0.0', // 绑定地址（默认 0.0.0.0）
  port: 8080, // 监听端口（0 表示随机端口）
  agent, // 要暴露的 Agent
  apiKey: 'secret', // Bearer 鉴权（可选）
  enableCors: true, // 启用 CORS（默认 true）
  allowedOrigins: ['*'], // 允许的跨域来源
});

await server.start();
console.log(server.getPort()); // 实际监听端口（端口 0 时返回真实端口）
console.log(server.getUrl()); // 完整 URL
```

---

## 7. RemoteRunner 远程客户端

### 7.1 HTTP 传输

通过 `POST /api/v1/execute` 提交任务，使用 `AbortController` 实现请求超时，返回结果兼容 `AgentResult<R>`。

### 7.2 WebSocket 传输

建立 `/ws` 长连接，支持：

- 实时结果推送（`result` / `error` 消息）
- 心跳（`heartbeat`）维持健康状态
- 断线自动重连（指数退避）
- 待处理任务的超时管理

```typescript
const runner = new RemoteRunner({
  runnerId: 'remote-1',
  name: 'Remote Worker',
  remoteUrl: 'http://worker:8080',
  transport: RemoteTransport.WEBSOCKET, // 默认 HTTP
  apiKey: 'secret',
  requestTimeout: 30000,
  reconnect: { maxAttempts: 5, baseDelay: 1000 },
});
```

### 7.3 默认配置

| 配置项           | 默认值   | 说明                |
| ---------------- | -------- | ------------------- |
| `transport`      | `HTTP`   | 传输协议            |
| `requestTimeout` | `30000`  | 请求超时（ms）      |
| `reconnect`      | 5 / 1000 | 重连次数 / 基础延迟 |

---

## 8. RunnerRegistry 注册中心

管理多个 runner，提供能力/模式选择与统计。

```typescript
const registry = new RunnerRegistry('production');

// 注册 / 注销
registry.register(runner);
registry.unregister('local-1');
registry.has('local-1');
registry.get('local-1');

// 选择
registry.find({ mode: RunnerMode.REMOTE }); // 按模式
registry.find({ capability: 'compute' }); // 按能力
registry.select({ name: 'Primary' }); // 取第一个匹配
registry.selectAvailable({ capability: 'compute' }); // 选健康可用者

// 统计
const stats = registry.getStats();
// { total, byMode, healthy, degraded, unhealthy, offline, totalActiveTasks }

// 事件
registry.on('runner:registered', ({ runnerId }) => {});
registry.on('runner:unregistered', ({ runnerId }) => {});
```

选择逻辑：先按 `mode` / `name` / `capability` / 自定义 `filter` 过滤，再在候选集中优先返回 `canAcceptTasks()` 的健康 runner，天然实现负载均衡。

---

## 9. 执行隔离

`ExecutionIsolation` 是可插拔的隔离契约，所有实现共享同一接口：

```typescript
interface ExecutionIsolation {
  readonly name: string;
  execute<T>(
    request: IsolatedExecutionRequest,
    handler: IsolatedTaskHandler
  ): Promise<IsolatedExecutionResult<T>>;
  isAvailable(): boolean;
}
```

### 9.1 InProcessIsolation 进程内逻辑隔离

| 特性            | 说明                                        |
| --------------- | ------------------------------------------- |
| 任务名白/黑名单 | `permittedTaskNames` / `forbiddenTaskNames` |
| 超时与取消      | `AbortController` + `Promise.race`          |
| 并发限制        | 信号量（默认 16）                           |
| 执行上下文      | 每次执行独立上下文，无状态泄漏              |

```typescript
const isolation = new InProcessIsolation({
  defaultTimeout: 30000,
  maxConcurrent: 16,
  permittedTaskNames: ['safe-task'],
  forbiddenTaskNames: ['dangerous-task'],
});
```

### 9.2 ChildProcessIsolation 子进程 OS 级隔离

| 特性           | 说明                                       |
| -------------- | ------------------------------------------ |
| 独立进程       | 每个任务 spawn 一个 Node.js 子进程         |
| V8 沙箱        | 子进程内使用 `node:vm` 重建 handler 并执行 |
| 内存限制       | `--max-old-space-size`（默认 128MB）       |
| 进程级超时     | `SIGTERM` → 2s 后 `SIGKILL`                |
| JSON-line 协议 | 子进程 stdin/stdout 通信                   |

**注意**：handler 通过 `Function.prototype.toString()` 序列化到子进程，**必须自包含**（不能闭包捕获外部作用域变量）。

```typescript
const isolation = new ChildProcessIsolation({
  defaultTimeout: 60000,
  maxConcurrent: 4,
  maxOldSpaceSize: 128,
});
```

---

## 10. 完整示例：分布式 Agent 集群

以下示例展示一个由远程 worker + 本地编排器组成的分布式 Agent 集群。

```typescript
import {
  Agent,
  LocalRunner,
  RemoteRunnerServer,
  RemoteRunner,
  RunnerRegistry,
  RunnerHealthStatus,
  ChildProcessIsolation,
} from '@organic/agent';

// ============================================================
// 1. 在 worker 机器上：启动远程服务
// ============================================================
async function startWorker(): Promise<RemoteRunnerServer> {
  const agent = new Agent({
    kernel: kernelApi,
    config: { id: 'worker-01', name: 'ComputeWorker', version: '1.0.0' },
  });
  await agent.initialize();
  agent.registerTaskHandler('compute', async input => input.a + input.b);
  agent.registerTaskHandler('hash', async input => {
    // 通过隔离沙箱执行
    const isolation = new ChildProcessIsolation();
    const r = await isolation.execute(
      { taskName: 'sha256', payload: input },
      p => `sha256(${p.value})`
    );
    return r.data;
  });

  const server = new RemoteRunnerServer({ port: 8080, agent });
  await server.start();
  return server;
}

// ============================================================
// 2. 在调度机器上：注册本机与远程 runner
// ============================================================
async function createRegistry() {
  const registry = new RunnerRegistry('cluster');

  // 本机 runner
  const localAgent = new Agent({
    kernel: kernelApi,
    config: { id: 'local-01', name: 'LocalWorker', version: '1.0.0' },
  });
  await localAgent.initialize();
  localAgent.registerTaskHandler('compute', async input => input.a + input.b);
  const local = new LocalRunner({
    runnerId: 'local-01',
    name: 'Local Worker',
    agent: localAgent,
  });
  await local.start();

  // 远程 runner
  const remote = new RemoteRunner({
    runnerId: 'remote-01',
    name: 'Remote Worker',
    remoteUrl: 'http://worker-host:8080',
  });
  await remote.start();

  registry.register(local);
  registry.register(remote);
  return registry;
}

// ============================================================
// 3. 负载均衡分发任务
// ============================================================
async function dispatch(
  registry: RunnerRegistry,
  taskId: string,
  payload: Record<string, unknown>
) {
  const runner = registry.selectAvailable({ capability: 'compute' });
  if (!runner) {
    throw new Error('No available runner');
  }
  return runner.execute({ taskId, payload });
}

// 使用
async function main() {
  const registry = await createRegistry();
  const result = await dispatch(registry, 'compute', { a: 10, b: 32 });
  console.log(result.success, result.data); // true 42

  const stats = registry.getStats();
  console.log(`Runners: ${stats.total}, Healthy: ${stats.healthy}`);

  registry.dispose();
}
```

---

## 11. 事件速查

### 11.1 AgentRunner 事件

| 事件名          | 参数                                      |
| --------------- | ----------------------------------------- |
| `task:start`    | `{ taskId, runnerId, timestamp }`         |
| `task:complete` | `{ taskId, runnerId, result, timestamp }` |
| `task:error`    | `{ taskId, runnerId, error, timestamp }`  |
| `health:change` | `{ runnerId, oldStatus, newStatus }`      |
| `heartbeat`     | `{ runnerId, timestamp, load }`           |
| `error`         | `{ runnerId, error }`                     |

### 11.2 RunnerRegistry 事件

| 事件名                | 参数           |
| --------------------- | -------------- |
| `runner:registered`   | `{ runnerId }` |
| `runner:unregistered` | `{ runnerId }` |

---

## 12. 配置参考

### 12.1 RunnerConfig

| 配置项               | 类型                      | 默认值  | 说明               |
| -------------------- | ------------------------- | ------- | ------------------ |
| `runnerId`           | `string`                  | 必填    | runner 唯一标识    |
| `name`               | `string`                  | 必填    | runner 名称        |
| `mode`               | `RunnerMode`              | 必填    | 执行模式           |
| `maxConcurrentTasks` | `number`                  | `10`    | 最大并发任务数     |
| `defaultTimeout`     | `number`                  | `30000` | 默认任务超时（ms） |
| `heartbeatInterval`  | `number`                  | `15000` | 心跳间隔（ms）     |
| `capabilities`       | `RunnerCapability[]`      | `[]`    | 能力列表           |
| `metadata`           | `Record<string, unknown>` | `{}`    | 自定义元数据       |

### 12.2 RemoteRunnerConfig

| 配置项           | 类型                       | 默认值   | 说明           |
| ---------------- | -------------------------- | -------- | -------------- |
| `remoteUrl`      | `string`                   | 必填     | 远程服务器 URL |
| `transport`      | `RemoteTransport`          | `HTTP`   | 传输协议       |
| `apiKey`         | `string`                   | 无       | Bearer 鉴权    |
| `requestTimeout` | `number`                   | `30000`  | 请求超时（ms） |
| `reconnect`      | `{maxAttempts, baseDelay}` | `5/1000` | 重连配置       |

### 12.3 RemoteRunnerServerConfig

| 配置项           | 类型       | 默认值    | 说明         |
| ---------------- | ---------- | --------- | ------------ |
| `port`           | `number`   | 必填      | 监听端口     |
| `host`           | `string`   | `0.0.0.0` | 绑定地址     |
| `agent`          | `Agent`    | 必填      | 暴露的 Agent |
| `apiKey`         | `string`   | 无        | 鉴权密钥     |
| `enableCors`     | `boolean`  | `true`    | 启用 CORS    |
| `allowedOrigins` | `string[]` | `['*']`   | 允许的来源   |

### 12.4 InProcessIsolationConfig

| 配置项               | 类型       | 默认值  | 说明           |
| -------------------- | ---------- | ------- | -------------- |
| `defaultTimeout`     | `number`   | `30000` | 默认超时（ms） |
| `maxConcurrent`      | `number`   | `16`    | 最大并发       |
| `permittedTaskNames` | `string[]` | `[]`    | 允许的任务名   |
| `forbiddenTaskNames` | `string[]` | `[]`    | 禁止的任务名   |

### 12.5 ChildProcessIsolationConfig

| 配置项            | 类型       | 默认值             | 说明               |
| ----------------- | ---------- | ------------------ | ------------------ |
| `defaultTimeout`  | `number`   | `60000`            | 默认超时（ms）     |
| `maxConcurrent`   | `number`   | `4`                | 最大并发子进程     |
| `nodeExecPath`    | `string`   | `process.execPath` | Node.js 可执行路径 |
| `maxOldSpaceSize` | `number`   | `128`              | 内存上限（MB）     |
| `execArgv`        | `string[]` | `[]`               | 附加 Node 参数     |

---

## 13. 最佳实践

### 13.1 何时使用哪种 runner

```
✅ LocalRunner：
  - 任务在本机，无需进程隔离
  - 追求最低延迟、最大吞吐
  - 任务可信（自身业务逻辑）

✅ RemoteRunner + RemoteRunnerServer：
  - 需要跨网络分发任务
  - worker 独立部署、独立扩缩容
  - 多主机负载均衡

✅ ChildProcessIsolation：
  - 执行不可信代码（插件、用户脚本）
  - 需要内存隔离、防崩溃影响主进程
  - 需要进程级超时强制回收

✅ InProcessIsolation：
  - 只需要超时/并发/任务名管控
  - 进程预算受限，不能开子进程
```

### 13.2 组合使用

```typescript
// 本机执行 + 进程内隔离（限制任务名与并发）
const runner = new LocalRunner({
  runnerId: 'guarded-local',
  name: 'Guarded Local',
  agent,
});
// 在 Agent handler 内部使用 InProcessIsolation 执行不可信逻辑

// 远程执行 + 子进程隔离（worker 内部再隔离）
// RemoteRunnerServer 的 Agent handler 内部使用 ChildProcessIsolation
```

### 13.3 可靠性

```typescript
// ✅ 总是优雅清理
async function gracefulShutdown() {
  await registry.dispose(); // 停止所有 runner
  for (const runner of registry.list()) {
    await runner.stop(); // 显式停止，清理 WebSocket / 拒绝挂起任务
  }
}

// ✅ 监听健康变化做故障转移
registry.on('runner:unregistered', () => {
  // 补充新的 runner 或切换流量
});
```

### 13.4 远程安全

```typescript
// ✅ 生产环境务必启用 apiKey 鉴权
const server = new RemoteRunnerServer({
  port: 8080,
  agent,
  apiKey: process.env.RUNNER_API_KEY, // 环境变量注入
});

// ✅ 客户端携带 Bearer token
const runner = new RemoteRunner({
  remoteUrl: 'http://worker:8080',
  apiKey: process.env.RUNNER_API_KEY,
});
```

---

## 附录 A：类型速查

```typescript
// Runner 抽象
(AgentRunner,
  RunnerMode, // LOCAL | REMOTE | SANDBOXED
  RunnerHealthStatus, // HEALTHY | DEGRADED | UNHEALTHY | OFFLINE
  RunnerCapability,
  RunnerConfig,
  RunnerStats,
  RunnerEvents,
  DEFAULT_RUNNER_CONFIG);

// 本机执行
(LocalRunner, LocalRunnerConfig);

// 远程执行
(RemoteRunner,
  RemoteTransport, // HTTP | WEBSOCKET
  RemoteRunnerConfig,
  DEFAULT_REMOTE_RUNNER_CONFIG,
  RemoteRunnerServer,
  RemoteRunnerServerConfig);

// 注册中心
(RunnerRegistry, RunnerSelector, RunnerRegistryStats);

// 隔离执行
(ExecutionIsolation,
  IsolatedExecutionRequest,
  IsolatedExecutionResult<T>,
  IsolatedTaskHandler,
  InProcessIsolation,
  InProcessIsolationConfig,
  DEFAULT_IN_PROCESS_CONFIG,
  ChildProcessIsolation,
  ChildProcessIsolationConfig,
  DEFAULT_CHILD_PROCESS_CONFIG);
```
