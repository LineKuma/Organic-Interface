/**
 * RunnerRegistry - Registry for agent execution runners
 *
 * Manages available runners (local, remote, sandboxed) and provides
 * capability-based selection, health tracking, and statistics.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import { type AgentRunner, RunnerHealthStatus, type RunnerMode } from './AgentRunner.js';

/**
 * Runner selection criteria
 */
export interface RunnerSelector {
  /** Match by runner mode */
  mode?: RunnerMode;
  /** Match by capability */
  capability?: string;
  /** Match by name */
  name?: string;
  /** Custom filter */
  filter?: (runner: AgentRunner) => boolean;
}

/**
 * Registry statistics
 */
export interface RunnerRegistryStats {
  total: number;
  byMode: Partial<Record<RunnerMode, number>>;
  healthy: number;
  degraded: number;
  unhealthy: number;
  offline: number;
  totalActiveTasks: number;
}

/**
 * RunnerRegistry - Registry for agent execution runners
 *
 * Features:
 * - Runner registration and unregistration
 * - Capability and mode based selection
 * - Health tracking
 * - Aggregate statistics
 */
export class RunnerRegistry extends EventEmitter {
  private runners: Map<string, AgentRunner> = new Map();
  private logger: Logger;

  constructor(name = 'runner-registry') {
    super();
    this.logger = createLogger({ prefix: name });
  }

  /**
   * Register a runner
   */
  register(runner: AgentRunner): void {
    const id = runner.getRunnerId();
    if (this.runners.has(id)) {
      this.logger.warn(`Runner already registered: ${id}`);
      return;
    }
    this.runners.set(id, runner);
    this.logger.info(`Runner registered: ${id} (${runner.getName()}, ${runner.getMode()})`);
    this.emit('runner:registered', { runnerId: id });
  }

  /**
   * Unregister a runner
   */
  unregister(runnerId: string): boolean {
    const deleted = this.runners.delete(runnerId);
    if (deleted) {
      this.logger.info(`Runner unregistered: ${runnerId}`);
      this.emit('runner:unregistered', { runnerId });
    }
    return deleted;
  }

  /**
   * Get a runner by ID
   */
  get(runnerId: string): AgentRunner | undefined {
    return this.runners.get(runnerId);
  }

  /**
   * Check if a runner is registered
   */
  has(runnerId: string): boolean {
    return this.runners.has(runnerId);
  }

  /**
   * List all registered runners
   */
  list(): AgentRunner[] {
    return Array.from(this.runners.values());
  }

  /**
   * Find runners matching a selector
   */
  find(selector: RunnerSelector): AgentRunner[] {
    return this.list().filter(runner => {
      if (selector.mode && runner.getMode() !== selector.mode) {
        return false;
      }
      if (selector.name && runner.getName() !== selector.name) {
        return false;
      }
      if (selector.capability) {
        const caps = runner.getConfig().capabilities ?? [];
        if (!caps.some(c => c.id === selector.capability)) {
          return false;
        }
      }
      if (selector.filter && !selector.filter(runner)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Select a runner matching criteria
   */
  select(selector: RunnerSelector = {}): AgentRunner | undefined {
    return this.find(selector)[0];
  }

  /**
   * Select a healthy runner that can accept tasks
   */
  selectAvailable(selector: RunnerSelector = {}): AgentRunner | undefined {
    return this.find(selector).find(runner => runner.canAcceptTasks());
  }

  /**
   * Get runner count
   */
  size(): number {
    return this.runners.size;
  }

  /**
   * Get aggregate statistics
   */
  getStats(): RunnerRegistryStats {
    const stats: RunnerRegistryStats = {
      total: this.runners.size,
      byMode: {},
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      offline: 0,
      totalActiveTasks: 0,
    };

    for (const runner of this.runners.values()) {
      const mode = runner.getMode();
      stats.byMode[mode] = (stats.byMode[mode] ?? 0) + 1;

      const runnerStats = runner.getStats();
      stats.totalActiveTasks += runnerStats.activeTaskCount;

      switch (runnerStats.health) {
        case RunnerHealthStatus.HEALTHY:
          stats.healthy++;
          break;
        case RunnerHealthStatus.DEGRADED:
          stats.degraded++;
          break;
        case RunnerHealthStatus.UNHEALTHY:
          stats.unhealthy++;
          break;
        default:
          stats.offline++;
      }
    }

    return stats;
  }

  /**
   * Remove all runners
   */
  clear(): void {
    this.runners.clear();
    this.logger.info('Runner registry cleared');
  }

  /**
   * Dispose the registry
   */
  dispose(): void {
    this.clear();
    this.removeAllListeners();
  }
}
