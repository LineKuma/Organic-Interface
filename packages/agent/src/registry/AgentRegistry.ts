/**
 * AgentRegistry - Central registry for agent management
 *
 * Provides agent registration, discovery, health monitoring,
 * and load balancing capabilities.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import type { AgentType } from './AgentMetadata.js';
import {
  type AgentMetadata,
  type AgentSelector,
  type RegistryEntry,
  type HealthCheckResult,
  type RegistryStats,
  AgentRegistryStatus,
  createAgentMetadata,
  createHealthCheckResult,
  isAgentHealthy,
  canAgentAcceptTasks,
  compareByLoad,
} from './AgentMetadata.js';

/**
 * Registry configuration
 */
export interface AgentRegistryConfig {
  /** Registry name */
  name?: string;
  /** Default heartbeat timeout in milliseconds */
  heartbeatTimeout?: number;
  /** Default lease duration in milliseconds */
  leaseDuration?: number;
  /** Enable automatic cleanup */
  enableAutoCleanup?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
  /** Enable health check */
  enableHealthCheck?: boolean;
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
}

/**
 * Default registry configuration
 */
export const DEFAULT_REGISTRY_CONFIG: Required<AgentRegistryConfig> = {
  name: 'default',
  heartbeatTimeout: 30000,
  leaseDuration: 60000,
  enableAutoCleanup: true,
  cleanupInterval: 60000,
  enableHealthCheck: true,
  healthCheckInterval: 10000,
};

/**
 * Registry events
 */
export interface RegistryEvents {
  'agent:registered': { agentId: string; metadata: AgentMetadata };
  'agent:unregistered': { agentId: string };
  'agent:updated': { agentId: string; metadata: AgentMetadata };
  'agent:heartbeat': { agentId: string; timestamp: number };
  'agent:health-check': { agentId: string; result: HealthCheckResult };
  'cleanup:completed': { removed: number };
}

/**
 * AgentRegistry - Central registry for agent management
 *
 * Features:
 * - Agent registration and unregistration
 * - Capability-based discovery
 * - Health monitoring with heartbeats
 * - Load balancing for task distribution
 * - Automatic cleanup of stale entries
 */
export class AgentRegistry extends EventEmitter {
  private config: Required<AgentRegistryConfig>;
  private logger: Logger;
  private entries: Map<string, RegistryEntry> = new Map();
  private heartbeatTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private isRunning: boolean = false;

  /**
   * Create a new AgentRegistry
   */
  constructor(config: AgentRegistryConfig = {}) {
    super();
    this.config = {
      ...DEFAULT_REGISTRY_CONFIG,
      ...config,
    };
    this.logger = createLogger({ prefix: `registry:${this.config.name}` });
  }

  // ==================== Lifecycle ====================

  /**
   * Start the registry
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.logger.info(`Agent registry started: ${this.config.name}`);

    if (this.config.enableAutoCleanup) {
      this.startCleanupTimer();
    }

    if (this.config.enableHealthCheck) {
      this.startHealthCheckTimer();
    }
  }

  /**
   * Stop the registry
   */
  stop(): void {
    this.isRunning = false;

    // Clear timers
    this.stopCleanupTimer();
    this.stopHealthCheckTimer();
    this.clearHeartbeatTimers();

    this.logger.info(`Agent registry stopped: ${this.config.name}`);
  }

  // ==================== Registration ====================

  /**
   * Register an agent
   */
  register(metadata: AgentMetadata): AgentMetadata {
    const now = Date.now();
    const leaseExpiresAt = now + this.config.leaseDuration;

    const entry: RegistryEntry = {
      agent: metadata,
      leaseExpiresAt,
      version: 1,
    };

    this.entries.set(metadata.id, entry);
    this.startHeartbeatTimer(metadata.id);

    this.logger.info(`Agent registered: ${metadata.id} (${metadata.name})`);
    this.emit('agent:registered', { agentId: metadata.id, metadata });

    return metadata;
  }

  /**
   * Register a new agent with basic info
   */
  registerAgent(
    id: string,
    name: string,
    type: AgentType,
    options?: {
      version?: string;
      capabilities?: Array<{ id: string; description?: string; version?: string }>;
      maxConcurrentTasks?: number;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }
  ): AgentMetadata {
    const metadata = createAgentMetadata(id, name, type, options);
    return this.register(metadata);
  }

  /**
   * Unregister an agent
   */
  unregister(agentId: string): boolean {
    const entry = this.entries.get(agentId);
    if (!entry) {
      return false;
    }

    this.stopHeartbeatTimer(agentId);
    this.entries.delete(agentId);

    this.logger.info(`Agent unregistered: ${agentId}`);
    this.emit('agent:unregistered', { agentId });
    this.emit('agent:status-change', { agentId, status: AgentRegistryStatus.OFFLINE });

    return true;
  }

  /**
   * Update agent metadata
   */
  update(agentId: string, updates: Partial<AgentMetadata>): AgentMetadata | null {
    const entry = this.entries.get(agentId);
    if (!entry) {
      return null;
    }

    const updatedAgent: AgentMetadata = {
      ...entry.agent,
      ...updates,
      id: agentId, // Prevent ID change
    };

    entry.agent = updatedAgent;
    entry.version++;

    this.logger.debug(`Agent updated: ${agentId}`);
    this.emit('agent:updated', { agentId, metadata: updatedAgent });

    return updatedAgent;
  }

  // ==================== Discovery ====================

  /**
   * Get agent by ID
   */
  get(agentId: string): AgentMetadata | null {
    const entry = this.entries.get(agentId);
    return entry?.agent ?? null;
  }

  /**
   * List all agents
   */
  list(): AgentMetadata[] {
    return Array.from(this.entries.values()).map(e => e.agent);
  }

  /**
   * List agents matching selector
   */
  find(selector: AgentSelector): AgentMetadata[] {
    return this.list().filter(agent => {
      // Type filter
      if (selector.type && agent.type !== selector.type) {
        return false;
      }

      // Status filter
      if (selector.status && agent.status !== selector.status) {
        return false;
      }

      // Capability filter
      if (selector.capability) {
        const hasCapability = agent.capabilities.some(c => c.id === selector.capability);
        if (!hasCapability) {
          return false;
        }
      }

      // Load filter
      if (selector.maxLoad !== undefined && agent.load > selector.maxLoad) {
        return false;
      }

      // Tags filter
      if (selector.tags && selector.tags.length > 0) {
        const hasAllTags = selector.tags.every(tag => agent.tags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }

      // Custom filter
      if (selector.filter && !selector.filter(agent)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Discover agents by capability
   */
  discover(
    capability: string,
    options?: {
      maxLoad?: number;
      status?: AgentRegistryStatus;
    }
  ): AgentMetadata[] {
    return this.find({
      capability,
      maxLoad: options?.maxLoad,
      status: options?.status,
    });
  }

  // ==================== Heartbeat & Health ====================

  /**
   * Record heartbeat from agent
   */
  heartbeat(
    agentId: string,
    stats?: {
      load: number;
      activeTaskCount: number;
      completedTasks?: number;
    }
  ): boolean {
    const entry = this.entries.get(agentId);
    if (!entry) {
      this.logger.warn(`Heartbeat from unknown agent: ${agentId}`);
      return false;
    }

    const now = Date.now();

    // Update metadata
    entry.agent.lastHeartbeatAt = now;
    if (stats) {
      entry.agent.load = stats.load;
      entry.agent.activeTaskCount = stats.activeTaskCount;
    }

    // Extend lease
    entry.leaseExpiresAt = now + this.config.leaseDuration;

    this.emit('agent:heartbeat', { agentId, timestamp: now });
    return true;
  }

  /**
   * Update agent status
   */
  updateStatus(agentId: string, status: AgentRegistryStatus): boolean {
    const entry = this.entries.get(agentId);
    if (!entry) {
      return false;
    }

    const oldStatus = entry.agent.status;
    entry.agent.status = status;
    entry.version++;

    this.emit('agent:status-change', { agentId, oldStatus, newStatus: status });
    return true;
  }

  /**
   * Update agent health check result
   */
  updateHealthCheck(agentId: string, result: HealthCheckResult): boolean {
    const entry = this.entries.get(agentId);
    if (!entry) {
      return false;
    }

    entry.agent.healthCheck = result;
    this.emit('agent:health-check', { agentId, result });
    return true;
  }

  /**
   * Check if agent is healthy
   */
  isHealthy(agentId: string): boolean {
    const agent = this.get(agentId);
    if (!agent) {
      return false;
    }
    return isAgentHealthy(agent, this.config.heartbeatTimeout);
  }

  /**
   * Check if agent can accept tasks
   */
  canAcceptTasks(agentId: string): boolean {
    const agent = this.get(agentId);
    if (!agent) {
      return false;
    }
    return canAgentAcceptTasks(agent);
  }

  // ==================== Load Balancing ====================

  /**
   * Get available agents for a capability
   */
  getAvailableAgents(capability?: string): AgentMetadata[] {
    const agents = capability
      ? this.discover(capability, { status: AgentRegistryStatus.ONLINE })
      : this.find({ status: AgentRegistryStatus.ONLINE });

    return agents.filter(agent => canAgentAcceptTasks(agent));
  }

  /**
   * Select best agent for task distribution
   */
  selectAgent(
    capability?: string,
    options?: {
      preferIdle?: boolean;
      maxLoad?: number;
    }
  ): AgentMetadata | null {
    const candidates = this.getAvailableAgents(capability);

    if (candidates.length === 0) {
      return null;
    }

    // Filter by max load if specified
    let filtered = candidates;
    if (options?.maxLoad !== undefined) {
      filtered = candidates.filter(a => a.load <= options.maxLoad!);
    }

    if (filtered.length === 0) {
      return null;
    }

    // Sort by load (lowest first) or active task count
    if (options?.preferIdle) {
      filtered.sort((a, b) => a.activeTaskCount - b.activeTaskCount);
    } else {
      filtered.sort(compareByLoad);
    }

    return filtered[0];
  }

  /**
   * Select multiple agents for parallel execution
   */
  selectAgents(capability: string, count: number): AgentMetadata[] {
    const candidates = this.getAvailableAgents(capability);

    // Sort by load
    candidates.sort(compareByLoad);

    return candidates.slice(0, count);
  }

  // ==================== Statistics ====================

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const agents = this.list();

    let totalLoad = 0;
    const capabilitySet = new Set<string>();

    let onlineCount = 0;
    let busyCount = 0;
    let offlineCount = 0;

    for (const agent of agents) {
      totalLoad += agent.load;

      if (agent.status === AgentRegistryStatus.ONLINE) {
        onlineCount++;
      } else if (agent.status === AgentRegistryStatus.BUSY) {
        busyCount++;
      } else {
        offlineCount++;
      }

      for (const cap of agent.capabilities) {
        capabilitySet.add(cap.id);
      }
    }

    return {
      totalAgents: agents.length,
      onlineAgents: onlineCount,
      busyAgents: busyCount,
      offlineAgents: offlineCount,
      totalCapabilities: capabilitySet.size,
      averageLoad: agents.length > 0 ? totalLoad / agents.length : 0,
    };
  }

  // ==================== Cleanup ====================

  /**
   * Clean up stale entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [agentId, entry] of this.entries) {
      if (entry.leaseExpiresAt < now) {
        this.stopHeartbeatTimer(agentId);
        this.entries.delete(agentId);
        removed++;
        this.emit('agent:unregistered', { agentId });
      }
    }

    if (removed > 0) {
      this.logger.info(`Cleanup removed ${removed} stale entries`);
      this.emit('cleanup:completed', { removed });
    }

    return removed;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Start health check timer
   */
  private startHealthCheckTimer(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health check timer
   */
  private stopHealthCheckTimer(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Perform health checks on all agents
   */
  private performHealthChecks(): void {
    const now = Date.now();

    for (const [agentId, entry] of this.entries) {
      const timeSinceHeartbeat = now - entry.agent.lastHeartbeatAt;

      if (timeSinceHeartbeat > this.config.heartbeatTimeout) {
        // Agent is stale
        if (entry.agent.status !== AgentRegistryStatus.OFFLINE) {
          entry.agent.status = AgentRegistryStatus.OFFLINE;

          const result = createHealthCheckResult(false, undefined, 'Heartbeat timeout');
          entry.agent.healthCheck = result;

          this.emit('agent:health-check', { agentId, result });
          this.emit('agent:status-change', {
            agentId,
            oldStatus: entry.agent.status,
            newStatus: AgentRegistryStatus.OFFLINE,
          });
        }
      }
    }
  }

  /**
   * Start heartbeat timer for agent
   */
  private startHeartbeatTimer(agentId: string): void {
    this.stopHeartbeatTimer(agentId);

    // Check heartbeat timeout
    this.heartbeatTimers.set(
      agentId,
      setTimeout(() => {
        const entry = this.entries.get(agentId);
        if (entry && entry.leaseExpiresAt < Date.now()) {
          this.logger.warn(`Agent heartbeat timeout: ${agentId}`);
          this.emit('agent:heartbeat-timeout', { agentId });
        }
      }, this.config.heartbeatTimeout + 5000)
    );
  }

  /**
   * Stop heartbeat timer for agent
   */
  private stopHeartbeatTimer(agentId: string): void {
    const timer = this.heartbeatTimers.get(agentId);
    if (timer) {
      clearTimeout(timer);
      this.heartbeatTimers.delete(agentId);
    }
  }

  /**
   * Clear all heartbeat timers
   */
  private clearHeartbeatTimers(): void {
    for (const timer of this.heartbeatTimers.values()) {
      clearTimeout(timer);
    }
    this.heartbeatTimers.clear();
  }

  // ==================== Utilities ====================

  /**
   * Clear all entries
   */
  clear(): void {
    this.clearHeartbeatTimers();
    this.entries.clear();
    this.logger.info('Registry cleared');
  }

  /**
   * Get entry count
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Check if registry contains agent
   */
  has(agentId: string): boolean {
    return this.entries.has(agentId);
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.stop();
    this.clear();
    this.removeAllListeners();
    this.logger.info('AgentRegistry disposed');
  }
}

/**
 * Create default registry instance
 */
export function createRegistry(name?: string): AgentRegistry {
  const registry = new AgentRegistry({ name });
  registry.start();
  return registry;
}
