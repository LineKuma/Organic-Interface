/**
 * LifecycleManager - Manages kernel and plugin lifecycle states
 */

import type { Logger } from '@organic/utils';

/**
 * Lifecycle state of kernel
 */
export enum LifecycleState {
  /** Kernel is created but not initialized */
  CREATED = 'created',
  /** Kernel is being initialized */
  INITIALIZING = 'initializing',
  /** Kernel is initialized and ready to start */
  INITIALIZED = 'initialized',
  /** Kernel is starting */
  STARTING = 'starting',
  /** Kernel is running */
  RUNNING = 'running',
  /** Kernel is stopping */
  STOPPING = 'stopping',
  /** Kernel has stopped */
  STOPPED = 'stopped',
  /** Kernel is in error state */
  ERROR = 'error',
}

/**
 * Lifecycle transition event data
 */
export interface LifecycleTransition {
  /** Previous state */
  from: LifecycleState;
  /** New state */
  to: LifecycleState;
  /** Timestamp of transition */
  timestamp: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Lifecycle hook callback
 */
export type LifecycleHook = (
  state: LifecycleState,
  transition?: LifecycleTransition
) => void | Promise<void>;

/**
 * LifecycleManager configuration
 */
export interface LifecycleManagerConfig {
  /** Logger instance */
  logger?: Logger;
  /** Hook to call before state transition */
  onBeforeTransition?: LifecycleHook;
  /** Hook to call after state transition */
  onAfterTransition?: LifecycleHook;
}

/**
 * LifecycleManager - Manages kernel lifecycle states and transitions
 */
export class LifecycleManager {
  private state: LifecycleState = LifecycleState.CREATED;
  private previousState: LifecycleState | null = null;
  private logger: Logger;
  private hooks: {
    before: LifecycleHook[];
    after: LifecycleHook[];
  } = {
    before: [],
    after: [],
  };

  constructor(config: LifecycleManagerConfig = {}) {
    this.logger = config.logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    if (config.onBeforeTransition) {
      this.hooks.before.push(config.onBeforeTransition);
    }
    if (config.onAfterTransition) {
      this.hooks.after.push(config.onAfterTransition);
    }
  }

  /**
   * Get the current lifecycle state
   */
  getState(): LifecycleState {
    return this.state;
  }

  /**
   * Get the previous lifecycle state
   */
  getPreviousState(): LifecycleState | null {
    return this.previousState;
  }

  /**
   * Check if the kernel is in a specific state
   */
  isState(state: LifecycleState): boolean {
    return this.state === state;
  }

  /**
   * Check if the kernel is in any of the given states
   */
  isAnyState(...states: LifecycleState[]): boolean {
    return states.includes(this.state);
  }

  /**
   * Check if the kernel is running (started and not stopped)
   */
  isRunning(): boolean {
    return this.state === LifecycleState.RUNNING;
  }

  /**
   * Check if the kernel is active (initialized or running)
   */
  isActive(): boolean {
    return (
      this.state === LifecycleState.INITIALIZED ||
      this.state === LifecycleState.RUNNING ||
      this.state === LifecycleState.STARTING
    );
  }

  /**
   * Transition to a new state
   */
  async transition(newState: LifecycleState, metadata?: Record<string, unknown>): Promise<void> {
    const transition: LifecycleTransition = {
      from: this.state,
      to: newState,
      timestamp: Date.now(),
      metadata,
    };

    this.logger.debug(`Lifecycle transition: ${this.state} -> ${newState}`);

    // Execute before hooks
    for (const hook of this.hooks.before) {
      try {
        await hook(this.state, transition);
      } catch (error) {
        this.logger.error(`Error in before lifecycle hook:`, error);
      }
    }

    // Execute transition
    this.previousState = this.state;
    this.state = newState;

    // Execute after hooks
    for (const hook of this.hooks.after) {
      try {
        await hook(this.state, transition);
      } catch (error) {
        this.logger.error(`Error in after lifecycle hook:`, error);
      }
    }
  }

  /**
   * Register a before transition hook
   */
  onBeforeTransition(hook: LifecycleHook): void {
    this.hooks.before.push(hook);
  }

  /**
   * Register an after transition hook
   */
  onAfterTransition(hook: LifecycleHook): void {
    this.hooks.after.push(hook);
  }

  /**
   * Clear all lifecycle hooks
   */
  clearHooks(): void {
    this.hooks.before = [];
    this.hooks.after = [];
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.previousState = this.state;
    this.state = LifecycleState.CREATED;
    this.logger.debug('Lifecycle manager reset to CREATED state');
  }

  /**
   * Get a descriptive state summary
   */
  getStatus(): {
    state: LifecycleState;
    previousState: LifecycleState | null;
    isRunning: boolean;
    isActive: boolean;
  } {
    return {
      state: this.state,
      previousState: this.previousState,
      isRunning: this.isRunning(),
      isActive: this.isActive(),
    };
  }
}
