/**
 * Runner module - Agent execution runners
 *
 * Provides a pluggable execution layer for agents. Runners abstract
 * the "where" and "how" of task execution:
 *
 * - LocalRunner: in-process execution
 * - RemoteRunner: HTTP/WebSocket remote execution
 * - RemoteRunnerServer: HTTP server that hosts agents for remote dispatch
 * - RunnerRegistry: capability/mode based runner selection
 *
 * All runners share a common AgentRunner base class, making the
 * execution layer fully modular and swappable.
 */

// AgentRunner - Abstract base class
export {
  AgentRunner,
  RunnerMode,
  RunnerHealthStatus,
  type RunnerCapability,
  type RunnerConfig,
  type RunnerStats,
  type RunnerEvents,
  DEFAULT_RUNNER_CONFIG,
} from './AgentRunner.js';

// LocalRunner - In-process execution
export { LocalRunner, type LocalRunnerConfig } from './LocalRunner.js';

// RemoteRunner - HTTP/WebSocket remote execution
export {
  RemoteRunner,
  RemoteTransport,
  type RemoteRunnerConfig,
  DEFAULT_REMOTE_RUNNER_CONFIG,
} from './RemoteRunner.js';

// RemoteRunnerServer - HTTP server hosting remote agents
export { RemoteRunnerServer, type RemoteRunnerServerConfig } from './RemoteRunnerServer.js';

// RunnerRegistry - Runner registration and selection
export { RunnerRegistry, type RunnerSelector, type RunnerRegistryStats } from './RunnerRegistry.js';
