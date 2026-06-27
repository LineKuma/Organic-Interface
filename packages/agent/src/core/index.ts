/**
 * Core module exports
 */

export {
  Agent,
  type AgentResult,
  type AgentTaskInput,
  type AgentTaskHandler,
  type AgentExecutionContext,
  type AgentEvents,
} from './Agent.js';

export {
  type AgentConfig,
  type AgentConfigOptions,
  AgentType,
  AgentPriority,
  DEFAULT_AGENT_CONFIG,
  createAgentConfig,
} from './AgentConfig.js';

export {
  type AgentState,
  type AgentStateOptions,
  type AgentStats,
  AgentStatus,
  createAgentState,
  getAgentStats,
} from './AgentState.js';
