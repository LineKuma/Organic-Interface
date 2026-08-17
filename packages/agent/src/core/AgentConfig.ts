/**
 * Agent Configuration
 *
 * Configuration interface for Agent instances
 */

import type { KernelApi } from '@organic/kernel';

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** Unique agent identifier */
  id: string;

  /** Agent name */
  name: string;

  /** Agent version */
  version: string;

  /** Agent description */
  description?: string;

  /** Maximum nesting depth for sub-agents */
  maxDepth: number;

  /** Maximum parallel tasks */
  maxParallelTasks: number;

  /** Communication timeout in milliseconds */
  communicationTimeout: number;

  /** Heartbeat interval in seconds */
  heartbeatInterval: number;

  /** Enabled capabilities */
  capabilities: string[];

  /** Custom configuration options */
  options?: Record<string, unknown>;

  /** Parent agent ID (if nested) */
  parentId?: string;

  /** Agent type */
  type: AgentType;

  /** Priority level */
  priority: AgentPriority;
}

/**
 * Agent type enumeration
 */
export enum AgentType {
  /** Orchestrator agent - coordinates sub-agents */
  ORCHESTRATOR = 'orchestrator',
  /** Executor agent - executes tasks */
  EXECUTOR = 'executor',
  /** Planner agent - plans and decomposes tasks */
  PLANNER = 'planner',
  /** Monitor agent - monitors and reports */
  MONITOR = 'monitor',
  /** Custom agent type */
  CUSTOM = 'custom',
}

/**
 * Agent priority levels
 */
export enum AgentPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Agent configuration options for creation
 */
export interface AgentConfigOptions {
  /** Kernel API instance */
  kernel: KernelApi;

  /** Agent configuration */
  config: Partial<AgentConfig>;

  /** Enable debug logging */
  debug?: boolean;

  /** Custom agent logger prefix */
  prefix?: string;
}

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG: Omit<AgentConfig, 'id' | 'name' | 'version'> = {
  description: '',
  maxDepth: 3,
  maxParallelTasks: 10,
  communicationTimeout: 5000,
  heartbeatInterval: 30,
  capabilities: [],
  options: {},
  parentId: undefined,
  type: AgentType.EXECUTOR,
  priority: AgentPriority.NORMAL,
};

/**
 * Create agent configuration with defaults
 */
export function createAgentConfig(
  partial: Partial<AgentConfig> & { id: string; name: string; version: string }
): AgentConfig {
  return {
    ...DEFAULT_AGENT_CONFIG,
    ...partial,
  };
}
