/**
 * ExecutionCoordinator - Coordinates multi-agent task execution
 *
 * Manages the execution flow, coordinates parallel and sequential
 * execution, and aggregates results from multiple agents.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import type { AgentRegistry} from '../registry/index.js';
import { type AgentMetadata } from '../registry/index.js';
import {
  AgentChannel,
  type AgentMessage,
  MessageAction,
  createExecuteMessage,
  createQueryMessage,
} from '../communication/index.js';

/**
 * Execution request
 */
export interface ExecutionRequest {
  /** Unique request ID */
  requestId: string;
  /** Task name/identifier */
  taskName: string;
  /** Task payload */
  payload: Record<string, unknown>;
  /** Target capability required */
  requiredCapability?: string;
  /** Target agent ID (if specific) */
  targetAgentId?: string;
  /** Execution timeout */
  timeout?: number;
  /** Retry configuration */
  retryConfig?: RetryConfig;
  /** Priority */
  priority?: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum retry attempts */
  maxAttempts?: number;
  /** Base delay in ms */
  baseDelay?: number;
  /** Max delay in ms */
  maxDelay?: number;
  /** Exponential backoff factor */
  backoffFactor?: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelay: 100,
  maxDelay: 5000,
  backoffFactor: 2,
};

/**
 * Execution result
 */
export interface ExecutionResult<T = unknown> {
  /** Whether execution succeeded */
  success: boolean;
  /** Result data */
  data?: T;
  /** Error message */
  error?: string;
  /** Error code */
  errorCode?: string;
  /** Execution duration in ms */
  duration: number;
  /** Agent that executed */
  agentId?: string;
  /** Attempt count */
  attempts: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Coordinated execution plan
 */
export interface ExecutionPlan {
  requestId: string;
  steps: ExecutionStep[];
  parallelGroups: string[][];
  estimatedDuration?: number;
}

/**
 * Execution step
 */
export interface ExecutionStep {
  stepId: string;
  request: ExecutionRequest;
  dependsOn: string[];
  agentId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: ExecutionResult;
}

/**
 * Coordinator events
 */
export interface CoordinatorEvents {
  'execution:start': { requestId: string };
  'execution:step-start': { requestId: string; stepId: string };
  'execution:step-complete': { requestId: string; stepId: string; result: ExecutionResult };
  'execution:step-failed': { requestId: string; stepId: string; error: string };
  'execution:complete': { requestId: string; results: ExecutionResult[] };
  'execution:failed': { requestId: string; error: string };
}

/**
 * ExecutionCoordinator - Manages multi-agent coordination
 *
 * Coordinates task execution across multiple agents, handles
 * parallel execution, result aggregation, and error handling.
 */
export class ExecutionCoordinator extends EventEmitter {
  private logger: Logger;
  private registry: AgentRegistry;
  private channels: Map<string, AgentChannel> = new Map();
  private activeExecutions: Map<string, {
    plan: ExecutionPlan;
    stepResults: Map<string, ExecutionResult>;
    startTime: number;
    abortController: AbortController;
  }> = new Map();
  private defaultTimeout: number = 30000;

  /**
   * Create a new ExecutionCoordinator
   */
  constructor(registry: AgentRegistry) {
    super();
    this.registry = registry;
    this.logger = createLogger({ prefix: 'execution-coordinator' });
  }

  // ==================== Execution ====================

  /**
   * Execute a single task
   */
  async execute<T = unknown, R = unknown>(
    request: ExecutionRequest
  ): Promise<ExecutionResult<R>> {
    const startTime = Date.now();
    const attempts: ExecutionResult[] = [];

    this.emit('execution:start', { requestId: request.requestId });

    // Find target agent
    const agent = request.targetAgentId
      ? this.registry.get(request.targetAgentId)
      : this.selectAgent(request.requiredCapability);

    if (!agent) {
      return {
        success: false,
        error: 'No suitable agent found',
        errorCode: 'NO_AGENT',
        duration: Date.now() - startTime,
        attempts: 0,
      };
    }

    // Get or create channel
    const channel = this.getOrCreateChannel(agent.id);

    // Execute with retry
    const retryConfig: Required<RetryConfig> = {
      ...DEFAULT_RETRY_CONFIG,
      ...request.retryConfig,
    };

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        // Create execution message
        const message = createExecuteMessage(
          'coordinator',
          agent.id,
          {
            taskName: request.taskName,
            payload: request.payload,
          },
          {
            priority: request.priority ? {
              0: 0, 1: 1, 2: 2, 3: 3
            }[request.priority] as 0 | 1 | 2 : undefined,
            correlationId: request.requestId,
            ttl: request.timeout ?? this.defaultTimeout,
          }
        );

        // Send and wait
        const result = await channel.sendAndWait<R>(message, {
          timeout: request.timeout ?? this.defaultTimeout,
        });

        const duration = Date.now() - startTime;

        this.emit('execution:complete', {
          requestId: request.requestId,
          results: [{ success: true, data: result, duration, attempts: attempt }],
        });

        return {
          success: true,
          data: result,
          duration,
          agentId: agent.id,
          attempts: attempt,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts.push({
          success: false,
          error: lastError.message,
          duration: Date.now() - startTime,
          attempts: attempt,
        });

        this.logger.warn(`Execution attempt ${attempt} failed: ${lastError.message}`);

        // Wait before retry with exponential backoff
        if (attempt < retryConfig.maxAttempts) {
          const delay = Math.min(
            retryConfig.baseDelay * Math.pow(retryConfig.backoffFactor, attempt - 1),
            retryConfig.maxDelay
          );
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    this.emit('execution:failed', {
      requestId: request.requestId,
      error: lastError?.message ?? 'Unknown error',
    });

    return {
      success: false,
      error: lastError?.message ?? 'Execution failed',
      errorCode: 'EXECUTION_FAILED',
      duration: Date.now() - startTime,
      attempts: retryConfig.maxAttempts,
    };
  }

  /**
   * Execute multiple tasks in parallel
   */
  async executeParallel(
    requests: ExecutionRequest[]
  ): Promise<ExecutionResult[]> {
    const promises = requests.map((req) => this.execute(req));
    return Promise.all(promises);
  }

  /**
   * Execute tasks sequentially with dependency chain
   */
  async executeSequential(
    requests: ExecutionRequest[],
    context?: Map<string, unknown>
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const request of requests) {
      // Inject previous results into payload
      if (context && results.length > 0) {
        const previousResult = results[results.length - 1];
        request.payload = {
          ...request.payload,
          previousResult: previousResult.data,
          previousSuccess: previousResult.success,
        };
      }

      const result = await this.execute(request);
      results.push(result);

      // Stop if any step fails
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute with a plan
   */
  async executeWithPlan(plan: ExecutionPlan): Promise<ExecutionResult[]> {
    const execution = {
      plan,
      stepResults: new Map<string, ExecutionResult>(),
      startTime: Date.now(),
      abortController: new AbortController(),
    };

    this.activeExecutions.set(plan.requestId, execution);

    try {
      // Execute steps in dependency order
      const results: ExecutionResult[] = [];

      for (const step of plan.steps) {
        if (execution.abortController.signal.aborted) {
          break;
        }

        // Check dependencies
        const dependenciesMet = step.dependsOn.every((depId) => {
          const depResult = execution.stepResults.get(depId);
          return depResult?.success;
        });

        if (!dependenciesMet) {
          step.status = 'skipped';
          continue;
        }

        // Execute step
        step.status = 'running';
        this.emit('execution:step-start', {
          requestId: plan.requestId,
          stepId: step.stepId,
        });

        const result = await this.execute(step.request);
        execution.stepResults.set(step.stepId, result);

        step.result = result;
        step.status = result.success ? 'completed' : 'failed';

        if (result.success) {
          this.emit('execution:step-complete', {
            requestId: plan.requestId,
            stepId: step.stepId,
            result,
          });
        } else {
          this.emit('execution:step-failed', {
            requestId: plan.requestId,
            stepId: step.stepId,
            error: result.error ?? 'Unknown error',
          });

          // Stop on failure unless configured to continue
          break;
        }

        results.push(result);
      }

      return results;
    } finally {
      this.activeExecutions.delete(plan.requestId);
    }
  }

  // ==================== Plan Building ====================

  /**
   * Create execution plan from requests
   */
  createPlan(requests: ExecutionRequest[]): ExecutionPlan {
    const plan: ExecutionPlan = {
      requestId: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      steps: [],
      parallelGroups: [],
    };

    // Create steps
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const step: ExecutionStep = {
        stepId: `step_${i}`,
        request,
        dependsOn: request.payload?.dependsOn as string[] ?? [],
        status: 'pending',
      };

      plan.steps.push(step);
    }

    // Identify parallel groups
    plan.parallelGroups = this.identifyParallelGroups(plan.steps);

    return plan;
  }

  /**
   * Identify steps that can run in parallel
   */
  private identifyParallelGroups(steps: ExecutionStep[]): string[][] {
    const groups: string[][] = [];
    const assigned = new Set<string>();

    for (const step of steps) {
      if (assigned.has(step.stepId)) {
        continue;
      }

      // Find steps with same dependencies that can run in parallel
      const parallelSteps = steps.filter((s) => {
        if (assigned.has(s.stepId)) return false;
        if (s.stepId === step.stepId) return true;

        // Check if dependencies are the same
        const depsMatch =
          s.dependsOn.length === step.dependsOn.length &&
          s.dependsOn.every((d) => step.dependsOn.includes(d));

        return depsMatch;
      });

      if (parallelSteps.length > 1) {
        groups.push(parallelSteps.map((s) => s.stepId));
        parallelSteps.forEach((s) => assigned.add(s.stepId));
      }
    }

    return groups;
  }

  // ==================== Agent Selection ====================

  /**
   * Select agent for task
   */
  private selectAgent(capability?: string): AgentMetadata | null {
    return this.registry.selectAgent(capability, { preferIdle: true });
  }

  /**
   * Get or create channel for agent
   */
  private getOrCreateChannel(agentId: string): AgentChannel {
    let channel = this.channels.get(agentId);
    if (!channel) {
      channel = new AgentChannel({ agentId: agentId });
      this.channels.set(agentId, channel);
    }
    return channel;
  }

  // ==================== Lifecycle ====================

  /**
   * Cancel an execution
   */
  cancel(requestId: string): boolean {
    const execution = this.activeExecutions.get(requestId);
    if (!execution) {
      return false;
    }

    execution.abortController.abort();
    return true;
  }

  /**
   * Cancel all active executions
   */
  cancelAll(): void {
    for (const execution of this.activeExecutions.values()) {
      execution.abortController.abort();
    }
  }

  /**
   * Get active execution count
   */
  getActiveCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Set default timeout
   */
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.cancelAll();
    this.channels.clear();
    this.activeExecutions.clear();
    this.removeAllListeners();
    this.logger.info('ExecutionCoordinator disposed');
  }
}