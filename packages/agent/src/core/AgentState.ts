/**
 * Agent State
 *
 * State management for Agent instances
 */

/**
 * Agent status enumeration
 */
export enum AgentStatus {
  /** Agent is idle and ready */
  IDLE = 'idle',
  /** Agent is busy processing */
  BUSY = 'busy',
  /** Agent encountered an error */
  ERROR = 'error',
  /** Agent is offline */
  OFFLINE = 'offline',
  /** Agent is initializing */
  INITIALIZING = 'initializing',
  /** Agent is shutting down */
  SHUTTING_DOWN = 'shutting_down',
}

/**
 * Agent state interface
 */
export interface AgentState {
  /** Agent unique identifier */
  agentId: string;

  /** Agent name */
  name: string;

  /** Current status */
  status: AgentStatus;

  /** Capabilities list */
  capabilities: string[];

  /** Current load (0-1) */
  load: number;

  /** Active task count */
  activeTaskCount: number;

  /** Completed task count */
  completedTaskCount: number;

  /** Failed task count */
  failedTaskCount: number;

  /** Total execution time in milliseconds */
  totalExecutionTime: number;

  /** Average response time in milliseconds */
  avgResponseTime: number;

  /** Last heartbeat timestamp */
  lastHeartbeat: number;

  /** Agent start time */
  startTime: number;

  /** Parent agent ID */
  parentId?: string;

  /** Child agent IDs */
  childIds: string[];

  /** Error message if status is ERROR */
  errorMessage?: string;

  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Agent state options for creation
 */
export interface AgentStateOptions {
  /** Agent ID */
  agentId: string;

  /** Agent name */
  name: string;

  /** Capabilities */
  capabilities?: string[];

  /** Parent agent ID */
  parentId?: string;
}

/**
 * Create initial agent state
 */
export function createAgentState(options: AgentStateOptions): AgentState {
  const now = Date.now();
  return {
    agentId: options.agentId,
    name: options.name,
    status: AgentStatus.IDLE,
    capabilities: options.capabilities ?? [],
    load: 0,
    activeTaskCount: 0,
    completedTaskCount: 0,
    failedTaskCount: 0,
    totalExecutionTime: 0,
    avgResponseTime: 0,
    lastHeartbeat: now,
    startTime: now,
    parentId: options.parentId,
    childIds: [],
    metadata: {},
  };
}

/**
 * Agent statistics
 */
export interface AgentStats {
  /** Total tasks completed */
  completedTasks: number;

  /** Total tasks failed */
  failedTasks: number;

  /** Total execution time */
  totalExecutionTime: number;

  /** Average response time */
  avgResponseTime: number;

  /** Current load percentage */
  loadPercentage: number;

  /** Uptime in milliseconds */
  uptime: number;
}

/**
 * Get agent statistics from state
 */
export function getAgentStats(state: AgentState): AgentStats {
  const uptime = Date.now() - state.startTime;
  return {
    completedTasks: state.completedTaskCount,
    failedTasks: state.failedTaskCount,
    totalExecutionTime: state.totalExecutionTime,
    avgResponseTime: state.avgResponseTime,
    loadPercentage: state.load * 100,
    uptime,
  };
}
