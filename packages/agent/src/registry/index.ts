/**
 * Registry module - Agent registration and discovery
 *
 * Provides agent registration, capability-based discovery,
 * health monitoring, and load balancing.
 */

// AgentMetadata - Agent metadata definitions
export {
  type AgentMetadata,
  type AgentCapability,
  type RegistryEntry,
  type HealthCheckResult,
  type AgentSelector,
  type RegistryStats,
  AgentType,
  AgentRegistryStatus,
  createAgentMetadata,
  createHealthCheckResult,
  isAgentHealthy,
  canAgentAcceptTasks,
  compareByLoad,
  compareByCapability,
  serializeEntry,
  deserializeEntry,
} from './AgentMetadata.js';

// AgentRegistry - Central registry
export {
  type AgentRegistryConfig,
  type RegistryEvents,
  AgentRegistry,
  DEFAULT_REGISTRY_CONFIG,
  createRegistry,
} from './AgentRegistry.js';
