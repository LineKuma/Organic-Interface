/**
 * Orchestration module - High-level task orchestration
 *
 * Provides orchestration capabilities for coordinating multiple
 * agents, managing execution plans, and handling complex workflows.
 */

// OrchestrationLayer - Main orchestration coordinator
export {
  type OrchestrationRequest,
  OrchestrationStrategy,
  type OrchestrationResult,
  type OrchestrationLayerPlan,
  OrchestrationPlanStatus,
  type OrchestrationLayerEvents,
  type DecomposedTask,
  type AgentSelectionStrategy,
  type OrchestrationLayerConfig,
  DEFAULT_ORCHESTRATION_CONFIG,
  OrchestrationLayer,
  createOrchestrationLayer,
} from './OrchestrationLayer.js';

// ExecutionCoordinator - Multi-agent execution coordinator
export {
  type ExecutionRequest,
  type RetryConfig,
  DEFAULT_RETRY_CONFIG,
  type ExecutionResult,
  type ExecutionPlan,
  type ExecutionStep,
  type CoordinatorEvents,
  ExecutionCoordinator,
} from './ExecutionCoordinator.js';
