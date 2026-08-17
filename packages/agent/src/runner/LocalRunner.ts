/**
 * LocalRunner - In-process agent execution runner
 *
 * Executes agent tasks directly within the current Node.js process.
 * Wraps an existing Agent instance and delegates task execution to it.
 * This is the simplest runner mode and is suitable for most use cases
 * where process isolation is not required.
 */

import { type AgentResult, type AgentTaskInput, type Agent } from '../core/Agent.js';
import { AgentRunner, RunnerMode, RunnerHealthStatus, type RunnerConfig } from './AgentRunner.js';

/**
 * Local runner configuration
 */
export interface LocalRunnerConfig extends RunnerConfig {
  /** Agent instance to delegate to */
  agent: Agent;
}

/**
 * LocalRunner - In-process execution
 *
 * Features:
 * - Direct delegation to Agent instance
 * - Zero serialization overhead
 * - Shared memory space with parent
 * - Minimal latency
 */
export class LocalRunner extends AgentRunner {
  private agent: Agent;

  constructor(config: LocalRunnerConfig) {
    super({
      ...config,
      mode: RunnerMode.LOCAL,
    });
    this.agent = config.agent;
  }

  /**
   * Start the local runner
   */
  async start(): Promise<void> {
    await super.start();
    await this.agent.initialize();
    this.logger.info(`Local runner delegating to agent: ${this.agent.getId()}`);
  }

  /**
   * Stop the local runner
   */
  async stop(): Promise<void> {
    await super.stop();
    this.logger.info('Local runner stopped');
  }

  /**
   * Execute a task by delegating to the wrapped Agent
   */
  async execute<T = unknown, R = unknown>(input: AgentTaskInput): Promise<AgentResult<R>> {
    if (!this.started) {
      return {
        success: false,
        error: 'Runner not started',
        executionTime: 0,
      };
    }

    this.trackTaskStart(input.taskId);

    try {
      const result = await this.agent.execute<T, R>(input);
      this.trackTaskComplete(input.taskId, result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.trackTaskError(input.taskId, err);
      return {
        success: false,
        error: err.message,
        executionTime: 0,
      };
    }
  }

  /**
   * Perform a health check
   */
  async healthCheck(): Promise<RunnerHealthStatus> {
    try {
      const canAccept = this.agent.canAcceptTasks();
      if (canAccept) {
        this.setHealth(RunnerHealthStatus.HEALTHY);
        return RunnerHealthStatus.HEALTHY;
      }

      this.setHealth(RunnerHealthStatus.DEGRADED);
      return RunnerHealthStatus.DEGRADED;
    } catch {
      this.setHealth(RunnerHealthStatus.UNHEALTHY);
      return RunnerHealthStatus.UNHEALTHY;
    }
  }

  /**
   * Get the underlying agent instance
   */
  getAgent(): Agent {
    return this.agent;
  }
}
