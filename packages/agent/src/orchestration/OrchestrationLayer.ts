/**
 * OrchestrationLayer - Main orchestration coordinator
 *
 * Provides high-level orchestration capabilities for coordinating
 * multiple agents, managing execution plans, and handling complex
 * task workflows.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import { AgentRegistry, type AgentMetadata } from '../registry/index.js';
import {
  ExecutionCoordinator,
  type ExecutionRequest,
  type ExecutionResult,
  type ExecutionPlan,
  type RetryConfig,
} from './ExecutionCoordinator.js';

/**
 * Orchestration request
 */
export interface OrchestrationRequest {
  /** Unique request ID */
  requestId: string;
  /** Task name */
  taskName: string;
  /** Task payload */
  payload: Record<string, unknown>;
  /** Required capability */
  requiredCapability?: string;
  /** Target agent ID */
  targetAgentId?: string;
  /** Execution timeout */
  timeout?: number;
  /** Retry configuration */
  retryConfig?: RetryConfig;
  /** Priority (0-3) */
  priority?: number;
  /** Dependencies on other requests */
  dependencies?: string[];
  /** Strategy for execution */
  strategy?: OrchestrationStrategy;
}

/**
 * Orchestration strategy
 */
export enum OrchestrationStrategy {
  /** Execute steps in parallel when possible */
  PARALLEL = 'parallel',
  /** Execute steps sequentially */
  SEQUENTIAL = 'sequential',
  /** Let the system decide based on dependencies */
  AUTO = 'auto',
}

/**
 * Orchestration result
 */
export interface OrchestrationResult<T = unknown> {
  /** Whether orchestration succeeded */
  success: boolean;
  /** Result data */
  data?: T;
  /** Error message */
  error?: string;
  /** Error code */
  errorCode?: string;
  /** Duration in ms */
  duration: number;
  /** Individual step results */
  stepResults?: ExecutionResult[];
  /** Agent that executed */
  agentId?: string;
}

/**
 * Orchestration plan
 */
export interface OrchestrationLayerPlan {
  /** Plan ID */
  planId: string;
  /** Original request */
  request: OrchestrationRequest;
  /** Execution plan */
  executionPlan: ExecutionPlan;
  /** Created at */
  createdAt: number;
  /** Status */
  status: OrchestrationPlanStatus;
}

/**
 * Orchestration plan status
 */
export enum OrchestrationPlanStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Orchestration events
 */
export interface OrchestrationLayerEvents {
  'orchestration:start': { requestId: string };
  'orchestration:step-start': { requestId: string; stepId: string };
  'orchestration:step-complete': { requestId: string; stepId: string; result: ExecutionResult };
  'orchestration:step-failed': { requestId: string; stepId: string; error: string };
  'orchestration:complete': { requestId: string; result: OrchestrationResult };
  'orchestration:failed': { requestId: string; error: string };
  'orchestration:paused': { planId: string };
  'orchestration:resumed': { planId: string };
  'agent:registered': { agentId: string };
  'agent:unregistered': { agentId: string };
}

/**
 * Task decomposition result
 */
export interface DecomposedTask {
  /** Sub-task ID */
  subTaskId: string;
  /** Task name */
  taskName: string;
  /** Sub-task payload */
  payload: Record<string, unknown>;
  /** Dependencies */
  dependsOn: string[];
  /** Capability required */
  requiredCapability?: string;
}

/**
 * Agent selection strategy
 */
export interface AgentSelectionStrategy {
  /** Prefer idle agents */
  preferIdle?: boolean;
  /** Prefer specific agent type */
  preferType?: string;
  /** Consider load balancing */
  loadBalancing?: boolean;
}

/**
 * OrchestrationLayer configuration
 */
export interface OrchestrationLayerConfig {
  /** Default timeout for orchestration */
  defaultTimeout?: number;
  /** Maximum concurrent orchestrations */
  maxConcurrentOrchestrations?: number;
  /** Enable automatic task decomposition */
  autoDecompose?: boolean;
  /** Default strategy */
  defaultStrategy?: OrchestrationStrategy;
}

/**
 * Default configuration
 */
export const DEFAULT_ORCHESTRATION_CONFIG: Required<OrchestrationLayerConfig> = {
  defaultTimeout: 60000,
  maxConcurrentOrchestrations: 10,
  autoDecompose: false,
  defaultStrategy: OrchestrationStrategy.AUTO,
};

/**
 * OrchestrationLayer - High-level orchestration coordinator
 *
 * Coordinates multiple agents and execution flows, manages orchestration
 * plans, and provides a unified interface for complex task execution.
 */
export class OrchestrationLayer extends EventEmitter {
  private logger: Logger;
  private registry: AgentRegistry;
  private coordinator: ExecutionCoordinator;
  private config: Required<OrchestrationLayerConfig>;
  private plans: Map<string, OrchestrationLayerPlan> = new Map();
  private pausedPlans: Set<string> = new Set();
  private activeOrchestrations: Map<string, {
    request: OrchestrationRequest;
    startTime: number;
  }> = new Map();

  /**
   * Create a new OrchestrationLayer
   */
  constructor(
    registry: AgentRegistry,
    coordinator?: ExecutionCoordinator,
    config?: OrchestrationLayerConfig
  ) {
    super();
    this.registry = registry;
    this.coordinator = coordinator ?? new ExecutionCoordinator(registry);
    this.config = {
      ...DEFAULT_ORCHESTRATION_CONFIG,
      ...config,
    };
    this.logger = createLogger({ prefix: 'orchestration-layer' });

    this.setupEventHandlers();
  }

  // ==================== Event Setup ====================

  /**
   * Setup event handlers from coordinator
   */
  private setupEventHandlers(): void {
    this.coordinator.on('execution:start', (data: { requestId: string }) => {
      this.emit('orchestration:start', data);
    });

    this.coordinator.on('execution:step-start', (data: { requestId: string; stepId: string }) => {
      this.emit('orchestration:step-start', data);
    });

    this.coordinator.on('execution:step-complete', (data: { requestId: string; stepId: string; result: ExecutionResult }) => {
      this.emit('orchestration:step-complete', data);
    });

    this.coordinator.on('execution:step-failed', (data: { requestId: string; stepId: string; error: string }) => {
      this.emit('orchestration:step-failed', data);
    });

    this.coordinator.on('execution:complete', (data: { requestId: string; results: ExecutionResult[] }) => {
      const active = this.activeOrchestrations.get(data.requestId);
      if (active) {
        const duration = Date.now() - active.startTime;
        const success = data.results.every((r) => r.success);
        this.emit('orchestration:complete', {
          requestId: data.requestId,
          result: {
            success,
            data: data.results,
            duration,
            stepResults: data.results,
          },
        });
        this.activeOrchestrations.delete(data.requestId);
      }
    });

    this.coordinator.on('execution:failed', (data: { requestId: string; error: string }) => {
      const active = this.activeOrchestrations.get(data.requestId);
      if (active) {
        this.emit('orchestration:failed', data);
        this.activeOrchestrations.delete(data.requestId);
      }
    });
  }

  // ==================== Agent Registration ====================

  /**
   * Register an agent with the orchestration layer
   */
  registerAgent(metadata: AgentMetadata): void {
    this.registry.register(metadata);
    this.emit('agent:registered', { agentId: metadata.id });
    this.logger.debug(`Agent registered: ${metadata.id}`);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): boolean {
    const success = this.registry.unregister(agentId);
    if (success) {
      this.emit('agent:unregistered', { agentId });
      this.logger.debug(`Agent unregistered: ${agentId}`);
    }
    return success;
  }

  /**
   * Get registered agent
   */
  getAgent(agentId: string): AgentMetadata | undefined {
    return this.registry.get(agentId) ?? undefined;
  }

  /**
   * List all registered agents
   */
  listAgents(): AgentMetadata[] {
    return this.registry.list();
  }

  // ==================== Orchestration ====================

  /**
   * Orchestrate a request
   */
  async orchestrate<T = unknown>(
    request: OrchestrationRequest
  ): Promise<OrchestrationResult<T>> {
    const startTime = Date.now();

    if (this.activeOrchestrations.size >= this.config.maxConcurrentOrchestrations) {
      return {
        success: false,
        error: 'Max concurrent orchestrations reached',
        errorCode: 'MAX_CONCURRENT',
        duration: Date.now() - startTime,
      };
    }

    this.emit('orchestration:start', { requestId: request.requestId });
    this.activeOrchestrations.set(request.requestId, {
      request,
      startTime,
    });

    try {
      // Auto-decompose if enabled and needed
      let tasks: OrchestrationRequest[] = [request];
      if (this.config.autoDecompose && this.shouldDecompose(request)) {
        tasks = this.decomposeTask(request);
        this.logger.debug(`Decomposed into ${tasks.length} sub-tasks`);
      }

      // Select execution strategy
      const strategy = request.strategy ?? this.config.defaultStrategy;

      let results: ExecutionResult[];

      if (tasks.length === 1) {
        // Single task - direct execution
        const executionRequest = this.convertToExecutionRequest(tasks[0]);
        const result = await this.coordinator.execute(executionRequest);
        results = [result];
      } else {
        // Multiple tasks - use coordinator
        const executionRequests = tasks.map((t) => this.convertToExecutionRequest(t));

        if (strategy === OrchestrationStrategy.SEQUENTIAL) {
          results = await this.coordinator.executeSequential(executionRequests);
        } else if (strategy === OrchestrationStrategy.PARALLEL) {
          results = await this.coordinator.executeParallel(executionRequests);
        } else {
          // AUTO - create plan
          const plan = this.coordinator.createPlan(executionRequests);
          results = await this.coordinator.executeWithPlan(plan);
        }
      }

      const duration = Date.now() - startTime;
      const success = results.every((r) => r.success);

      return {
        success,
        data: success ? this.aggregateResults(results) as T : undefined,
        error: success ? undefined : this.findError(results),
        duration,
        stepResults: results,
        agentId: results[0]?.agentId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'ORCHESTRATION_ERROR',
        duration,
      };
    } finally {
      this.activeOrchestrations.delete(request.requestId);
    }
  }

  /**
   * Convert orchestration request to execution request
   */
  private convertToExecutionRequest(request: OrchestrationRequest): ExecutionRequest {
    return {
      requestId: request.requestId,
      taskName: request.taskName,
      payload: request.payload,
      requiredCapability: request.requiredCapability,
      targetAgentId: request.targetAgentId,
      timeout: request.timeout ?? this.config.defaultTimeout,
      retryConfig: request.retryConfig,
      priority: request.priority,
    };
  }

  /**
   * Check if task should be decomposed
   */
  private shouldDecompose(request: OrchestrationRequest): boolean {
    return (
      Array.isArray(request.payload?.subTasks) &&
      (request.payload.subTasks as unknown[]).length > 0
    );
  }

  /**
   * Decompose a task into sub-tasks
   */
  private decomposeTask(request: OrchestrationRequest): OrchestrationRequest[] {
    const subTasks = request.payload.subTasks as DecomposedTask[];
    return subTasks.map((subTask, index) => ({
      requestId: `${request.requestId}_${index}`,
      taskName: subTask.taskName,
      payload: subTask.payload,
      requiredCapability: subTask.requiredCapability,
      targetAgentId: request.targetAgentId,
      timeout: request.timeout,
      retryConfig: request.retryConfig,
      priority: request.priority,
      dependencies: subTask.dependsOn,
      strategy: request.strategy,
    }));
  }

  /**
   * Aggregate results from multiple executions
   */
  private aggregateResults(results: ExecutionResult[]): Record<string, unknown> {
    return {
      totalCount: results.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results: results.map((r) => r.data),
    };
  }

  /**
   * Find error from results
   */
  private findError(results: ExecutionResult[]): string {
    const failed = results.find((r) => !r.success);
    return failed?.error ?? 'Unknown error';
  }

  // ==================== Plan Management ====================

  /**
   * Create an orchestration plan
   */
  createPlan(requests: OrchestrationRequest[]): OrchestrationLayerPlan {
    const planId = `orchestration_plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const executionRequests = requests.map((r) => this.convertToExecutionRequest(r));
    const executionPlan = this.coordinator.createPlan(executionRequests);

    const plan: OrchestrationLayerPlan = {
      planId,
      request: requests[0],
      executionPlan,
      createdAt: Date.now(),
      status: OrchestrationPlanStatus.PENDING,
    };

    this.plans.set(planId, plan);
    return plan;
  }

  /**
   * Get orchestration plan
   */
  getOrchestrationPlan(planId: string): OrchestrationLayerPlan | undefined {
    return this.plans.get(planId);
  }

  /**
   * List all plans
   */
  listPlans(): OrchestrationLayerPlan[] {
    return Array.from(this.plans.values());
  }

  // ==================== Pause/Resume ====================

  /**
   * Pause orchestration
   */
  pause(planId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan) {
      return false;
    }

    plan.status = OrchestrationPlanStatus.PAUSED;
    this.pausedPlans.add(planId);
    this.emit('orchestration:paused', { planId });
    this.logger.info(`Orchestration paused: ${planId}`);
    return true;
  }

  /**
   * Resume orchestration
   */
  async resume<T = unknown>(planId: string): Promise<OrchestrationResult<T>> {
    const plan = this.plans.get(planId);
    if (!plan) {
      return {
        success: false,
        error: 'Plan not found',
        errorCode: 'PLAN_NOT_FOUND',
        duration: 0,
      };
    }

    if (!this.pausedPlans.has(planId)) {
      return {
        success: false,
        error: 'Plan is not paused',
        errorCode: 'NOT_PAUSED',
        duration: 0,
      };
    }

    plan.status = OrchestrationPlanStatus.RUNNING;
    this.pausedPlans.delete(planId);
    this.emit('orchestration:resumed', { planId });
    this.logger.info(`Orchestration resumed: ${planId}`);

    try {
      const results = await this.coordinator.executeWithPlan(plan.executionPlan);
      plan.status = OrchestrationPlanStatus.COMPLETED;

      return {
        success: true,
        data: this.aggregateResults(results) as T,
        duration: Date.now() - plan.createdAt,
        stepResults: results,
      };
    } catch (error) {
      plan.status = OrchestrationPlanStatus.FAILED;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'RESUME_FAILED',
        duration: Date.now() - plan.createdAt,
      };
    }
  }

  // ==================== Cancellation ====================

  /**
   * Cancel an orchestration
   */
  cancel(requestId: string): boolean {
    const cancelled = this.coordinator.cancel(requestId);
    if (cancelled) {
      const active = this.activeOrchestrations.get(requestId);
      if (active) {
        this.activeOrchestrations.delete(requestId);
      }
    }
    return cancelled;
  }

  /**
   * Cancel all orchestrations
   */
  cancelAll(): void {
    this.coordinator.cancelAll();
    this.activeOrchestrations.clear();
  }

  // ==================== Agent Selection ====================

  /**
   * Select agent for capability
   */
  selectAgent(
    capability?: string,
    strategy?: AgentSelectionStrategy
  ): AgentMetadata | null {
    return this.registry.selectAgent(capability, {
      preferIdle: strategy?.preferIdle ?? true,
    });
  }

  /**
   * Get available agents for capability
   */
  getAvailableAgents(capability?: string): AgentMetadata[] {
    return this.registry.getAvailableAgents(capability);
  }

  // ==================== Status ====================

  /**
   * Get active orchestration count
   */
  getActiveCount(): number {
    return this.activeOrchestrations.size;
  }

  /**
   * Check if orchestration is active
   */
  isActive(requestId: string): boolean {
    return this.activeOrchestrations.has(requestId);
  }

  /**
   * Get coordinator for direct access
   */
  getCoordinator(): ExecutionCoordinator {
    return this.coordinator;
  }

  /**
   * Get registry for direct access
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }

  // ==================== Lifecycle ====================

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.cancelAll();
    this.plans.clear();
    this.pausedPlans.clear();
    this.coordinator.dispose();
    this.removeAllListeners();
    this.logger.info('OrchestrationLayer disposed');
  }
}

/**
 * Create a new OrchestrationLayer with default configuration
 */
export function createOrchestrationLayer(
  registry: AgentRegistry,
  config?: OrchestrationLayerConfig
): OrchestrationLayer {
  return new OrchestrationLayer(registry, undefined, config);
}
