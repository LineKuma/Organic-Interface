/**
 * Isolation module - Execution isolation strategies
 *
 * Provides multiple isolation strategies for executing agent tasks
 * with configurable boundaries:
 *
 * - InProcessIsolation: logical isolation (timeout, concurrency, gating)
 * - ChildProcessIsolation: OS-level process isolation
 *
 * The ExecutionIsolation interface makes it possible to swap
 * strategies without changing the runner code.
 */

// ExecutionIsolation - Contract
export {
  type ExecutionIsolation,
  type IsolatedExecutionRequest,
  type IsolatedExecutionResult,
  type IsolatedTaskHandler,
} from './ExecutionIsolation.js';

// InProcessIsolation - Logical isolation
export {
  InProcessIsolation,
  type InProcessIsolationConfig,
  DEFAULT_IN_PROCESS_CONFIG,
} from './InProcessIsolation.js';

// ChildProcessIsolation - OS-level process isolation
export {
  ChildProcessIsolation,
  type ChildProcessIsolationConfig,
  DEFAULT_CHILD_PROCESS_CONFIG,
} from './ChildProcessIsolation.js';
