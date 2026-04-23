/**
 * AgentMetadata - Agent registry metadata definition
 *
 * Defines metadata structures for agent registration, discovery,
 * and health monitoring.
 */

/**
 * Agent type enumeration
 */
export enum AgentType {
  /** Orchestrator agent - coordinates task execution */
  ORCHESTRATOR = 'orchestrator',
  /** Executor agent - performs specific tasks */
  EXECUTOR = 'executor',
  /** Planner agent - creates execution plans */
  PLANNER = 'planner',
  /** Monitor agent - observes system state */
  MONITOR = 'monitor',
  /** Custom agent type */
  CUSTOM = 'custom',
}

/**
 * Agent status for registration
 */
export enum AgentRegistryStatus {
  /** Agent is online and ready */
  ONLINE = 'online',
  /** Agent is busy processing */
  BUSY = 'busy',
  /** Agent is temporarily unavailable */
  UNAVAILABLE = 'unavailable',
  /** Agent is offline */
  OFFLINE = 'offline',
}

/**
 * Agent capability definition
 */
export interface AgentCapability {
  /** Capability identifier */
  id: string;
  /** Capability description */
  description?: string;
  /** Version requirements */
  version?: string;
}

/**
 * Agent metadata
 *
 * Complete metadata for an agent registered in the registry.
 */
export interface AgentMetadata {
  /** Unique agent identifier */
  id: string;

  /** Human-readable agent name */
  name: string;

  /** Agent type */
  type: AgentType;

  /** Agent version */
  version: string;

  /** List of capabilities */
  capabilities: AgentCapability[];

  /** Current status */
  status: AgentRegistryStatus;

  /** Current load (0-1) */
  load: number;

  /** Endpoint URL or identifier */
  endpoint?: string;

  /** Parent agent ID (if nested) */
  parentId?: string;

  /** Children agent IDs */
  childIds: string[];

  /** Maximum concurrent tasks */
  maxConcurrentTasks: number;

  /** Active task count */
  activeTaskCount: number;

  /** Tags for categorization */
  tags: string[];

  /** Custom metadata */
  metadata?: Record<string, unknown>;

  /** Registration timestamp */
  registeredAt: number;

  /** Last heartbeat timestamp */
  lastHeartbeatAt: number;

  /** Health check result */
  healthCheck?: HealthCheckResult;
}

/**
 * Registry entry containing agent metadata and state
 */
export interface RegistryEntry {
  /** Agent metadata */
  agent: AgentMetadata;

  /** Lease expiration time */
  leaseExpiresAt: number;

  /** Registration version for optimistic locking */
  version: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether health check passed */
  healthy: boolean;

  /** Last check timestamp */
  checkedAt: number;

  /** Response time in milliseconds */
  responseTime?: number;

  /** Error message if unhealthy */
  error?: string;

  /** Detailed status info */
  details?: Record<string, unknown>;
}

/**
 * Agent selector criteria for discovery
 */
export interface AgentSelector {
  /** Match by agent type */
  type?: AgentType;
  /** Match by capability */
  capability?: string;
  /** Match by status */
  status?: AgentRegistryStatus;
  /** Maximum load threshold */
  maxLoad?: number;
  /** Match by tags */
  tags?: string[];
  /** Custom filter function */
  filter?: (agent: AgentMetadata) => boolean;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalAgents: number;
  onlineAgents: number;
  busyAgents: number;
  offlineAgents: number;
  totalCapabilities: number;
  averageLoad: number;
}

/**
 * Create default agent metadata
 */
export function createAgentMetadata(
  id: string,
  name: string,
  type: AgentType,
  options?: {
    version?: string;
    capabilities?: AgentCapability[];
    maxConcurrentTasks?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }
): AgentMetadata {
  const now = Date.now();

  return {
    id,
    name,
    type,
    version: options?.version ?? '0.1.0',
    capabilities: options?.capabilities ?? [],
    status: AgentRegistryStatus.ONLINE,
    load: 0,
    childIds: [],
    maxConcurrentTasks: options?.maxConcurrentTasks ?? 10,
    activeTaskCount: 0,
    tags: options?.tags ?? [],
    metadata: options?.metadata,
    registeredAt: now,
    lastHeartbeatAt: now,
  };
}

/**
 * Create default health check result
 */
export function createHealthCheckResult(
  healthy: boolean,
  responseTime?: number,
  error?: string,
  details?: Record<string, unknown>
): HealthCheckResult {
  return {
    healthy,
    checkedAt: Date.now(),
    responseTime,
    error,
    details,
  };
}

/**
 * Check if agent is healthy based on metadata
 */
export function isAgentHealthy(agent: AgentMetadata, heartbeatTimeout: number = 30000): boolean {
  const now = Date.now();
  const lastHeartbeat = now - agent.lastHeartbeatAt;

  return (
    agent.status === AgentRegistryStatus.ONLINE &&
    lastHeartbeat < heartbeatTimeout &&
    (agent.healthCheck?.healthy ?? true)
  );
}

/**
 * Check if agent can accept tasks
 */
export function canAgentAcceptTasks(agent: AgentMetadata): boolean {
  return (
    isAgentHealthy(agent) &&
    agent.load < 1 &&
    agent.activeTaskCount < agent.maxConcurrentTasks
  );
}

/**
 * Compare agents by load (for load balancing)
 */
export function compareByLoad(a: AgentMetadata, b: AgentMetadata): number {
  return a.load - b.load;
}

/**
 * Compare agents by capability match
 */
export function compareByCapability(
  a: AgentMetadata,
  b: AgentMetadata,
  requiredCapability: string
): number {
  const aHas = a.capabilities.some((c) => c.id === requiredCapability);
  const bHas = b.capabilities.some((c) => c.id === requiredCapability);

  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;

  // If both have, compare by load
  return compareByLoad(a, b);
}

/**
 * Serialize registry entry for storage
 */
export function serializeEntry(entry: RegistryEntry): string {
  return JSON.stringify(entry);
}

/**
 * Deserialize registry entry from storage
 */
export function deserializeEntry(data: string): RegistryEntry {
  return JSON.parse(data) as RegistryEntry;
}